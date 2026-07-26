import { isPersistent } from '@kolo/core/db'
import { defaultNetwork, getBlockNumber, rpcUrl } from '@/lib/rpc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Liveness endpoint. The competition's monthly payout milestones require the
 * mini app to stay continuously reachable, so this is deliberately cheap to
 * poll and reports the two things that can actually break: the database and the
 * Nimiq RPC we verify payments against.
 */
export async function GET(): Promise<Response> {
  const started = Date.now()

  const [main, test] = await Promise.all([
    getBlockNumber('main').catch(() => null),
    getBlockNumber('test').catch(() => null),
  ])

  // Kolo serves both chains at once — a circle is pinned to whichever one its
  // creator's wallet was on — so it is healthy as long as one is reachable.
  const chain = main !== null || test !== null ? 'ok' : 'unreachable'

  const body = {
    status: chain === 'ok' ? 'ok' : 'degraded',
    checks: {
      chain,
      mainnet: main === null ? 'unreachable' : { blockNumber: main, rpc: rpcUrl('main') },
      testnet: test === null ? 'unreachable' : { blockNumber: test, rpc: rpcUrl('test') },
      defaultNetwork: defaultNetwork(),
      persistence: isPersistent() ? 'postgres' : 'memory',
    },
    latencyMs: Date.now() - started,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    timestamp: new Date().toISOString(),
  }

  return Response.json(body, { status: chain === 'ok' ? 200 : 503 })
}
