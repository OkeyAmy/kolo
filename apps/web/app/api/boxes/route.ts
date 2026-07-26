import { createSoloBox, isNimiqAddress, toBaseUnits } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, badRequest, unauthorized } from '@/lib/http'
import { resolveNetwork } from '@/lib/rpc'
import { readSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  name: z.string().trim().min(2).max(40),
  currency: z.enum(['NIM', 'USDT']),
  amount: z.string().min(1),
  cadence: z.enum(['weekly', 'biweekly', 'monthly']),
  periods: z.number().int(),
  vaultAddress: z.string().min(36),
  walletHeight: z.number().int().optional(),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const body = Body.parse(await request.json())
    if (!isNimiqAddress(body.vaultAddress))
      return badRequest('That savings address does not look like a Nimiq address.')

    const box = createSoloBox({
      ownerAddress: session.address,
      vaultAddress: body.vaultAddress,
      name: body.name,
      currency: body.currency,
      network: await resolveNetwork(body.walletHeight),
      amount: toBaseUnits(body.amount, body.currency),
      cadence: body.cadence,
      periods: body.periods,
    })

    await getRepository().createBox(box)
    return Response.json({ id: box.id, code: box.code })
  }
  catch (error) {
    return apiError(error)
  }
}
