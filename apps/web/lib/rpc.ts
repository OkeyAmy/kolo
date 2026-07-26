import type { ChainTransaction, NimiqNetwork } from '@kolo/core'

/**
 * Read-only Albatross JSON-RPC client, per network.
 *
 * Server side only. Kolo never sends a transaction — the wallet does that — so
 * this client only ever reads. That is why no key material appears anywhere in
 * this file or its configuration.
 */

const RPC: Record<NimiqNetwork, string> = {
  main: process.env.NIMIQ_RPC_URL || 'https://rpc.nimiqwatch.com',
  test: process.env.NIMIQ_TESTNET_RPC_URL || 'https://rpc.testnet.nimiqwatch.com',
}

const EXPLORER: Record<NimiqNetwork, string> = {
  main: 'https://nimiq.watch',
  test: 'https://test.nimiq.watch',
}

/** Network used when we cannot tell — a fresh install, or a browser tab. */
export function defaultNetwork(): NimiqNetwork {
  return process.env.NIMIQ_NETWORK === 'test' ? 'test' : 'main'
}

export function rpcUrl(network: NimiqNetwork): string {
  return RPC[network]
}

export function explorerTxUrl(hash: string, network: NimiqNetwork): string {
  return `${EXPLORER[network]}/#${hash}`
}

export function explorerBase(network: NimiqNetwork): string {
  return EXPLORER[network]
}

interface RpcEnvelope<T> {
  result?: { data: T }
  error?: { code: number, message: string, data?: string }
}

export class RpcError extends Error {}

async function call<T>(
  network: NimiqNetwork,
  method: string,
  params: unknown[],
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(rpcUrl(network), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok)
      throw new RpcError(`${method} failed with HTTP ${response.status}`)

    const envelope = await response.json() as RpcEnvelope<T>
    if (envelope.error)
      throw new RpcError(`${method}: ${envelope.error.data ?? envelope.error.message}`)
    if (!envelope.result)
      throw new RpcError(`${method}: empty response`)

    return envelope.result.data
  }
  finally {
    clearTimeout(timer)
  }
}

export async function getBlockNumber(network: NimiqNetwork): Promise<number> {
  return call<number>(network, 'getBlockNumber', [])
}

/**
 * Recent transactions involving an address, newest first. We read the
 * *recipient's* history when verifying a contribution, because that is the one
 * address every member of a round has in common.
 */
export async function getTransactionsByAddress(
  network: NimiqNetwork,
  address: string,
  max = 100,
): Promise<ChainTransaction[]> {
  const raw = await call<ChainTransaction[]>(
    network,
    'getTransactionsByAddress',
    [address, max, null],
    12_000,
  )
  return Array.isArray(raw) ? raw : []
}

let heightCache: { at: number, heights: Partial<Record<NimiqNetwork, number>> } = { at: 0, heights: {} }

/**
 * Works out which chain a wallet is on from the block height it reports.
 *
 * Nimiq Pay can be switched to testnet from a hidden dev menu, and a mini app
 * has no direct way to ask which network is active. Heights are the reliable
 * signal: the two chains are tens of millions of blocks apart, so we ask both
 * and take whichever is closer. Comparing against live heights rather than a
 * hard-coded threshold means this keeps working as both chains grow.
 *
 * A wrong answer here cannot cost anyone money: verification would simply look
 * on the wrong chain, find nothing, and leave the contribution unverified.
 */
export async function resolveNetwork(walletHeight: number | undefined): Promise<NimiqNetwork> {
  if (!walletHeight || walletHeight <= 0)
    return defaultNetwork()

  if (Date.now() - heightCache.at > 60_000) {
    const [main, test] = await Promise.all([
      getBlockNumber('main').catch(() => undefined),
      getBlockNumber('test').catch(() => undefined),
    ])
    heightCache = { at: Date.now(), heights: { main, test } }
  }

  const { main, test } = heightCache.heights
  if (main === undefined && test === undefined)
    return defaultNetwork()
  if (main === undefined)
    return 'test'
  if (test === undefined)
    return 'main'

  return Math.abs(walletHeight - test) < Math.abs(walletHeight - main) ? 'test' : 'main'
}
