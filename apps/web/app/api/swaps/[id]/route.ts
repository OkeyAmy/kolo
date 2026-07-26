import { acceptSwap, declineSwap, reassignRecipients, swapPayload } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, badRequest, notFound, unauthorized } from '@/lib/http'
import { readSession } from '@/lib/session'
import { verifyNimiqSignature } from '@/lib/signature'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET returns the payload the counterparty has to sign to accept. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const { id } = await params
    const swap = await getRepository().getSwap(id)
    if (!swap)
      return notFound('That swap request does not exist.')

    return Response.json({ message: swapPayload(swap) })
  }
  catch (error) {
    return apiError(error)
  }
}

const Body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('accept'),
    publicKey: z.string().min(64),
    signature: z.string().min(128),
  }),
  z.object({ action: z.literal('decline') }),
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const { id } = await params
    const body = Body.parse(await request.json())
    const repo = getRepository()

    const swap = await repo.getSwap(id)
    if (!swap)
      return notFound('That swap request does not exist.')

    if (body.action === 'decline') {
      await repo.updateSwap(declineSwap(swap, session.address))
      return Response.json({ status: 'declined' })
    }

    const circle = await repo.getCircle(swap.circleId)
    if (!circle)
      return notFound('That circle does not exist.')

    // The counterparty signs the same bytes the requester signed. Two
    // signatures over one payload is what makes the reorder provable later.
    const valid = verifyNimiqSignature({
      message: swapPayload(swap),
      publicKey: body.publicKey,
      signature: body.signature,
      address: session.address,
    })
    if (!valid)
      return badRequest('That signature did not check out.', 'bad_signature')

    const [members, rounds] = await Promise.all([
      repo.listMembers(circle.id),
      repo.listRounds(circle.id),
    ])

    const result = acceptSwap({
      swap,
      circle,
      members,
      rounds,
      accepterAddress: session.address,
      counterpartySignature: { publicKey: body.publicKey, signature: body.signature },
    })

    await repo.replaceMembers(circle.id, result.members)
    await repo.replaceRounds(circle.id, reassignRecipients(rounds, result.members))
    await repo.updateSwap(result.swap)

    return Response.json({ status: 'applied' })
  }
  catch (error) {
    return apiError(error)
  }
}
