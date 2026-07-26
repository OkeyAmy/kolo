import { reassignRecipients, requestSwap, sameAddress, swapPayload } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, badRequest, notFound, unauthorized } from '@/lib/http'
import { readSession } from '@/lib/session'
import { verifyNimiqSignature } from '@/lib/signature'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Two-step, two-signature position swap.
 *
 * GET  — hands back the exact payload the requester must sign.
 * POST — records the request, with that signature attached.
 *
 * Kolo verifies the signature here and again on acceptance. It has no way to
 * reorder a circle on its own.
 */

const Prepare = z.object({ targetPosition: z.coerce.number().int().positive() })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const { id } = await params
    const url = new URL(request.url)
    const { targetPosition } = Prepare.parse({ targetPosition: url.searchParams.get('targetPosition') })

    const repo = getRepository()
    const circle = await repo.getCircle(id)
    if (!circle)
      return notFound('That circle does not exist.')

    const members = await repo.listMembers(circle.id)
    const me = members.find(m => sameAddress(m.address, session.address))
    if (!me)
      return badRequest('You are not in this circle.', 'not_member')

    const nonce = crypto.randomUUID().replace(/-/g, '')
    const message = swapPayload({
      circleId: circle.id,
      positionA: me.position,
      positionB: targetPosition,
      nonce,
    })

    return Response.json({ message, nonce })
  }
  catch (error) {
    return apiError(error)
  }
}

const Body = z.object({
  targetPosition: z.number().int().positive(),
  reason: z.string().trim().max(140).default(''),
  nonce: z.string().min(8).max(64),
  publicKey: z.string().min(64),
  signature: z.string().min(128),
})

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

    const circle = await repo.getCircle(id)
    if (!circle)
      return notFound('That circle does not exist.')

    const [members, rounds] = await Promise.all([
      repo.listMembers(circle.id),
      repo.listRounds(circle.id),
    ])

    const me = members.find(m => sameAddress(m.address, session.address))
    if (!me)
      return badRequest('You are not in this circle.', 'not_member')

    const message = swapPayload({
      circleId: circle.id,
      positionA: me.position,
      positionB: body.targetPosition,
      nonce: body.nonce,
    })

    const valid = verifyNimiqSignature({
      message,
      publicKey: body.publicKey,
      signature: body.signature,
      address: session.address,
    })
    if (!valid)
      return badRequest('That signature did not check out.', 'bad_signature')

    const swap = requestSwap({
      circle,
      members,
      rounds,
      requesterAddress: session.address,
      targetPosition: body.targetPosition,
      reason: body.reason,
      requesterSignature: { publicKey: body.publicKey, signature: body.signature },
    })

    // requestSwap generates its own nonce; keep the one both parties signed.
    await repo.createSwap({ ...swap, nonce: body.nonce })

    // Recipients are derived from positions, so nothing moves until acceptance.
    await repo.replaceRounds(circle.id, reassignRecipients(rounds, members))

    return Response.json({ id: swap.id })
  }
  catch (error) {
    return apiError(error)
  }
}
