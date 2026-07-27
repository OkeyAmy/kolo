import type { Contribution } from '@kolo/core'
import { circleMemo, newId, normalizeAddress, sameAddress } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, badRequest, notFound, unauthorized } from '@/lib/http'
import { readSession } from '@/lib/session'
import { refreshCircle } from '@/lib/verifier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  roundIndex: z.number().int().positive(),
  /** What the wallet handed back. Treated as a hint, never as proof. */
  txHint: z.string().max(400).optional(),
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

    const [members, rounds, contributions] = await Promise.all([
      repo.listMembers(circle.id),
      repo.listRounds(circle.id),
      repo.listContributions(circle.id),
    ])

    const me = members.find(m => sameAddress(m.address, session.address))
    if (!me)
      return badRequest('You are not in this circle.', 'not_member')

    const round = rounds.find(r => r.index === body.roundIndex)
    if (!round)
      return notFound('That round does not exist.')
    if (round.status !== 'collecting')
      return badRequest('That round is not collecting right now.', 'round_closed')
    if (sameAddress(round.recipientAddress, session.address))
      return badRequest('This round pays out to you — you do not pay into it.', 'is_recipient')

    const existing = contributions.find(
      c => c.roundIndex === round.index && sameAddress(c.fromAddress, session.address),
    )
    if (existing && existing.status !== 'failed')
      return Response.json({ id: existing.id, status: existing.status })

    const contribution: Contribution = {
      id: newId('con'),
      circleId: circle.id,
      roundIndex: round.index,
      fromAddress: normalizeAddress(session.address),
      toAddress: normalizeAddress(round.recipientAddress),
      amount: circle.amount,
      currency: circle.currency,
      network: circle.network,
      memo: circleMemo(circle.code, round.index),
      txHash: extractHash(body.txHint),
      settledFrom: null,
      status: 'submitted',
      blockNumber: null,
      // Backdated by a minute so a transaction that landed on chain a moment
      // before this request still falls inside the match window.
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      verifiedAt: null,
    }

    await repo.createContribution(contribution)

    // Try to confirm immediately. Nimiq blocks are about a second, so by the
    // time the user's finger leaves the button this usually already succeeds.
    await refreshCircle(repo, circle.id)

    const updated = (await repo.listContributions(circle.id)).find(c => c.id === contribution.id)
    return Response.json({ id: contribution.id, status: updated?.status ?? 'submitted' })
  }
  catch (error) {
    return apiError(error)
  }
}

/**
 * The wallet may return either a transaction hash or a serialised transaction
 * depending on version, so we only keep it when it is unmistakably a hash.
 * Verification never depends on this value.
 */
function extractHash(hint: string | undefined): string | null {
  if (!hint)
    return null
  const clean = hint.trim().toLowerCase().replace(/^0x/, '')
  return /^[0-9a-f]{64}$/.test(clean) ? clean : null
}
