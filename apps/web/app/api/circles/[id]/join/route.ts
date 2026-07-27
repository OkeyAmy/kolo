import { activateCircle, joinCircle, seatsTaken } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { apiError, notFound, unauthorized } from '@/lib/http'
import { readSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const { id } = await params
    const repo = getRepository()
    const circle = await repo.getCircle(id)
    if (!circle)
      return notFound('That circle does not exist.')

    const members = await repo.listMembers(circle.id)
    const member = joinCircle(circle, members, session.address, session.displayName)
    await repo.addMember(member)

    const filled = [...members, member]

    // The last person through the door starts the circle. Nobody has to
    // remember to press a button, which is exactly the kind of coordination
    // failure that kills informal savings groups.
    if (seatsTaken(filled) === circle.seats) {
      const activated = activateCircle(circle, filled)
      await repo.updateCircle(activated.circle)
      await repo.replaceRounds(circle.id, activated.rounds)
    }

    return Response.json({
      id: circle.id,
      code: circle.code,
      position: member.position,
      status: member.status,
    })
  }
  catch (error) {
    return apiError(error)
  }
}
