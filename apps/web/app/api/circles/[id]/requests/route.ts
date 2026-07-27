import { activateCircle, decideRequest, seatsTaken } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, notFound, unauthorized } from '@/lib/http'
import { readSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const body = z.object({
  address: z.string().min(36),
  decision: z.enum(['approve', 'decline']),
})

/**
 * The organiser admits, or turns away, someone who asked to join.
 *
 * A public circle is the one place a stranger can reach a circle, and a
 * rotating fund only works when somebody vouches for the people in it. The
 * domain layer owns the rules — who may decide, whether a seat is free, what
 * position the newcomer gets — so this route only carries the decision.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const { address, decision } = body.parse(await request.json())

    const { id } = await params
    const repo = getRepository()
    const circle = await repo.getCircle(id)
    if (!circle)
      return notFound('That circle does not exist.')

    const members = await repo.listMembers(circle.id)
    const decided = decideRequest(circle, members, session.address, address, decision)
    await repo.addMember(decided)

    const updated = members
      .filter(m => m.address !== decided.address)
      .concat(decided)

    // Approving the last outstanding seat starts the circle, exactly as the
    // final direct join does.
    if (seatsTaken(updated) === circle.seats) {
      const activated = activateCircle(circle, updated)
      await repo.updateCircle(activated.circle)
      await repo.replaceRounds(circle.id, activated.rounds)
    }

    return Response.json({ address: decided.address, status: decided.status })
  }
  catch (error) {
    return apiError(error)
  }
}
