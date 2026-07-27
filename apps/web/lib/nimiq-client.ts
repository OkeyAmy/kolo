import type { NimiqProvider, SignatureResult } from '@nimiq/mini-app-sdk'
import type { Currency } from '@kolo/core'
import { sameAddress } from '@kolo/core'
import { init } from '@nimiq/mini-app-sdk'
import { encodeFunctionData } from 'viem'
import { describeWalletError, isCancellation } from './wallet-error'

/**
 * The wallet layer.
 *
 * Everything that talks to Nimiq Pay lives here so the rest of the app never
 * has to know whether it is running inside the wallet or in a plain browser
 * tab. Two rules hold throughout:
 *
 *   - every provider call can be refused by the user, and a refusal is a normal
 *     outcome, not an error state;
 *   - Kolo never sees a private key. It asks; Nimiq Pay decides.
 */

export class WalletError extends Error {
  constructor(
    message: string,
    readonly kind: 'cancelled' | 'unavailable' | 'failed',
    /** Raw wallet payload, kept so the UI can offer the exact text for a bug report. */
    readonly detail?: string,
  ) {
    super(message)
    this.name = 'WalletError'
  }
}

/** SDK methods resolve with an error envelope instead of throwing. Normalise. */
function unwrap<T>(result: T | { error: { type: string, message: string } }): T {
  if (result && typeof result === 'object' && 'error' in result)
    throw asWalletError(result)
  return result as T
}

function asWalletError(error: unknown): WalletError {
  if (error instanceof WalletError)
    return error

  const detail = describeWalletError(error)
  if (isCancellation(detail))
    return new WalletError('You cancelled that in Nimiq Pay.', 'cancelled', detail)

  // No message at all means the wallet refused without saying why. Say exactly
  // that, rather than inventing a reason the user cannot act on.
  if (!detail)
    return new WalletError('Nimiq Pay could not complete that, and did not say why.', 'failed')

  return new WalletError(detail, 'failed', detail)
}

let provider: Promise<NimiqProvider> | null = null

export function insideNimiqPay(): boolean {
  if (typeof window === 'undefined')
    return false
  return Boolean(window.nimiq || window.nimiqPay)
}

export async function getProvider(): Promise<NimiqProvider> {
  if (typeof window === 'undefined')
    throw new WalletError('The wallet is only available in the browser.', 'unavailable')

  provider ??= init({ timeout: 4000 }).catch((error: unknown) => {
    provider = null
    throw new WalletError(
      'Open Kolo inside Nimiq Pay to connect your wallet.',
      /timeout/i.test(String(error)) ? 'unavailable' : 'failed',
    )
  })

  return provider
}

export async function listAccounts(): Promise<string[]> {
  try {
    const nimiq = await getProvider()
    return unwrap(await nimiq.listAccounts())
  }
  catch (error) {
    throw asWalletError(error)
  }
}

/**
 * The block height the wallet is currently synced to.
 *
 * A mini app cannot ask Nimiq Pay whether the user has flipped to testnet, but
 * the height gives it away: the two chains are tens of millions of blocks
 * apart. We report it and let the server decide (see resolveNetwork in rpc.ts).
 * Returns undefined outside the wallet, where the server falls back to its
 * configured default.
 */
export async function walletHeight(): Promise<number | undefined> {
  try {
    const nimiq = await getProvider()
    const height = await nimiq.getBlockNumber()
    return typeof height === 'number' && height > 0 ? height : undefined
  }
  catch {
    return undefined
  }
}

export async function signMessage(message: string): Promise<SignatureResult> {
  try {
    const nimiq = await getProvider()
    return unwrap(await nimiq.sign(message))
  }
  catch (error) {
    throw asWalletError(error)
  }
}

export interface PaymentRequest {
  recipient: string
  /** Smallest units of the currency. */
  amount: string
  currency: Currency
  memo: string
  /**
   * The address Kolo believes is paying — the one this session signed in with.
   * Checked against the wallet's own account list before sending; see
   * assertSenderMatches.
   */
  expectedSender?: string
}

/**
 * Refuses to send if the wallet would pay from a different account.
 *
 * `sendBasicTransactionWithData` takes no `from` parameter: Nimiq Pay chooses
 * the sending account itself. If the user switched accounts after signing in,
 * two things go wrong and both are silent. Paying a round would leave the
 * transaction unmatched forever, because verification matches on the sender
 * address. And paying yourself — which happens when the active account is the
 * round's recipient — is rejected by the protocol outright.
 *
 * Catching it here turns both into one sentence the user can act on, before any
 * money moves.
 */
async function assertSenderMatches(expected: string | undefined, recipient: string): Promise<void> {
  if (!expected)
    return

  let accounts: string[]
  try {
    accounts = await listAccounts()
  }
  catch {
    // The wallet would not tell us. Let the send proceed and surface whatever
    // it says, rather than blocking a payment on a failed precheck.
    return
  }

  const active = accounts[0]
  if (!active)
    return

  if (!sameAddress(active, expected)) {
    throw new WalletError(
      'Nimiq Pay is on a different account than the one you signed in with. '
      + 'Switch back to that account, or sign out of Kolo and reconnect.',
      'failed',
    )
  }

  if (sameAddress(active, recipient)) {
    throw new WalletError(
      'This round pays out to the account you are paying from, so there is '
      + 'nothing to send. You collect this round.',
      'failed',
    )
  }
}

/**
 * Sends a contribution.
 *
 * NIM goes through the Nimiq provider with the memo attached to the
 * transaction, which is what makes the payment self-describing on chain. USDT
 * goes through the EVM provider as a plain ERC-20 transfer — the memo cannot
 * ride along there, which is one more reason NIM is the default.
 */
export async function sendPayment(request: PaymentRequest): Promise<string> {
  if (request.currency === 'USDT')
    return sendUsdt(request)

  await assertSenderMatches(request.expectedSender, request.recipient)

  try {
    const nimiq = await getProvider()
    const result = await nimiq.sendBasicTransactionWithData({
      recipient: request.recipient,
      value: Number(request.amount),
      data: request.memo,
    })
    return unwrap(result)
  }
  catch (error) {
    throw asWalletError(error)
  }
}

const POLYGON_CHAIN_ID = '0x89'
const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'

const ERC20_TRANSFER = [{
  name: 'transfer',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
}] as const

interface EthereumProvider {
  request: (args: { method: string, params?: unknown[] }) => Promise<unknown>
}

function ethereum(): EthereumProvider {
  const injected = (window as unknown as { ethereum?: EthereumProvider }).ethereum
  if (!injected)
    throw new WalletError('No Ethereum wallet is available here.', 'unavailable')
  return injected
}

async function sendUsdt(request: PaymentRequest): Promise<string> {
  try {
    const evm = ethereum()
    const accounts = await evm.request({ method: 'eth_requestAccounts' }) as string[]
    const from = accounts[0]
    if (!from)
      throw new WalletError('No Ethereum account was shared.', 'cancelled')

    try {
      await evm.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_CHAIN_ID }],
      })
    }
    catch (error) {
      // 4902 means the chain is not configured in the wallet. Everything else
      // (including a plain refusal) should surface to the user as-is.
      if ((error as { code?: number }).code === 4902)
        throw new WalletError('Polygon is not set up in this wallet yet.', 'unavailable')
      throw error
    }

    const data = encodeFunctionData({
      abi: ERC20_TRANSFER,
      functionName: 'transfer',
      args: [request.recipient as `0x${string}`, BigInt(request.amount)],
    })

    return await evm.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: USDT_POLYGON, data, value: '0x0' }],
    }) as string
  }
  catch (error) {
    throw asWalletError(error)
  }
}

export function hostLanguage(): string {
  if (typeof window === 'undefined')
    return 'en'
  return window.nimiqPay?.language || 'en'
}
