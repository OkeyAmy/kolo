import type { Contribution } from '@kolo/core'
import { newId, normalizeAddress, openPeriod, sameAddress, soloMemo, soloPeriods } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, badRequest, notFound, unauthorized } from '@/lib/http'
import { readSession } from '@/lib/session'
import { refreshBox } from '@/lib/verifier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({ txHint: z.string().max(400).optional() })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const { id } = await params
    const body = Body.parse(await request.json().catch(() => ({})))
    const repo = getRepository()

    const box = await repo.getBox(id)
    if (!box)
      return notFound('That savings box does not exist.')
    if (!sameAddress(box.ownerAddress, session.address))
      return badRequest('This is not your box.', 'not_owner')

    const contributions = await repo.listBoxContributions(box.id)
    const period = openPeriod(soloPeriods(box, contributions))
    if (!period)
      return badRequest('Nothing is due right now. Come back next period.', 'nothing_due')

    const contribution: Contribution = {
      id: newId('con'),
      circleId: null,
      boxId: box.id,
      roundIndex: period.index,
      fromAddress: normalizeAddress(box.ownerAddress),
      toAddress: normalizeAddress(box.vaultAddress),
      amount: box.amount,
      currency: box.currency,
      network: box.network,
      memo: soloMemo(box.code, period.index),
      txHash: null,
      status: 'submitted',
      blockNumber: null,
      submittedAt: new Date(Date.now() - 60_000).toISOString(),
      verifiedAt: null,
    }

    await repo.createContribution(contribution)
    await refreshBox(repo, box.id)

    const updated = (await repo.listBoxContributions(box.id)).find(c => c.id === contribution.id)
    return Response.json({ id: contribution.id, status: updated?.status ?? 'submitted', hint: body.txHint ? 'stored' : 'none' })
  }
  catch (error) {
    return apiError(error)
  }
}
