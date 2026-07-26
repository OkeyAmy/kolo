import { activateCircle, createCircle, toBaseUnits } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, unauthorized } from '@/lib/http'
import { resolveNetwork } from '@/lib/rpc'
import { readSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  name: z.string().trim().min(2).max(40),
  currency: z.enum(['NIM', 'USDT']),
  amount: z.string().min(1),
  cadence: z.enum(['weekly', 'biweekly', 'monthly']),
  seats: z.number().int(),
  visibility: z.enum(['public', 'private']),
  /** Block height the wallet reports; used to tell testnet from mainnet. */
  walletHeight: z.number().int().optional(),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await readSession()
    if (!session)
      return unauthorized()

    const body = Body.parse(await request.json())
    const repo = getRepository()

    const { circle, member } = createCircle({
      name: body.name,
      currency: body.currency,
      amount: toBaseUnits(body.amount, body.currency),
      cadence: body.cadence,
      seats: body.seats,
      visibility: body.visibility,
      network: await resolveNetwork(body.walletHeight),
      creatorAddress: session.address,
      creatorName: session.displayName,
    })

    await repo.createCircle(circle, member)

    // A one-seat circle is impossible, so this only fires on the smallest
    // allowed circle when the creator is also the last member — never today,
    // but the state machine should not depend on that staying true.
    if (circle.seats === 1) {
      const activated = activateCircle(circle, [member])
      await repo.updateCircle(activated.circle)
      await repo.replaceRounds(circle.id, activated.rounds)
    }

    return Response.json({ id: circle.id, code: circle.code })
  }
  catch (error) {
    return apiError(error)
  }
}
