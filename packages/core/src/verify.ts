import type { ChainTransaction, Contribution } from './types'
import { sameAddress } from './address'
import { decodeMemoHex } from './memo'

/**
 * Payment verification.
 *
 * The client tells us it paid. We do not believe it. A contribution is only
 * ever promoted to `verified` when a transaction on the Nimiq chain matches the
 * sender, the recipient, the exact amount and the memo we expected. This is the
 * single most important function in Kolo: it is what lets eight people who do
 * not trust each other trust the same scoreboard.
 */

export interface MatchExpectation {
  fromAddress: string
  toAddress: string
  /** Smallest units, as a decimal string. */
  amount: string
  memo: string
  /** Ignore transactions confirmed before the obligation existed. */
  notBefore?: string
}

export interface MatchResult {
  transaction: ChainTransaction
  /** True once the transaction is deep enough to be treated as final. */
  confirmed: boolean
}

export const MIN_CONFIRMATIONS = 1

export function matchTransaction(
  expectation: MatchExpectation,
  transactions: ChainTransaction[],
  usedHashes: ReadonlySet<string> = new Set(),
): MatchResult | null {
  const expected = BigInt(expectation.amount)
  const floor = expectation.notBefore ? new Date(expectation.notBefore).getTime() : 0

  const candidates = transactions.filter((tx) => {
    if (usedHashes.has(tx.hash))
      return false
    if (!sameAddress(tx.from, expectation.fromAddress))
      return false
    if (!sameAddress(tx.to, expectation.toAddress))
      return false
    if (BigInt(tx.value) !== expected)
      return false
    if (decodeMemoHex(tx.recipientData) !== expectation.memo)
      return false
    // Nimiq timestamps are milliseconds. Allow a minute of clock skew so a
    // payment made the instant a round opened is never rejected.
    if (floor && tx.timestamp < floor - 60_000)
      return false
    return true
  })

  if (candidates.length === 0)
    return null

  const best = candidates.sort((a, b) => a.timestamp - b.timestamp)[0]
  return { transaction: best, confirmed: best.confirmations >= MIN_CONFIRMATIONS }
}

/** Apply a match to a contribution record. Returns null when nothing changed. */
export function applyMatch(
  contribution: Contribution,
  match: MatchResult | null,
  now = new Date().toISOString(),
): Contribution | null {
  if (!match || !match.confirmed)
    return null
  if (contribution.status === 'verified')
    return null

  return {
    ...contribution,
    status: 'verified',
    txHash: match.transaction.hash,
    blockNumber: match.transaction.blockNumber,
    verifiedAt: now,
  }
}

/**
 * A submitted contribution that never appears on chain should not sit as
 * "pending" forever — it makes the circle look stuck when in reality the user
 * cancelled or the transaction was dropped.
 */
export const SUBMISSION_TIMEOUT_MINUTES = 30

export function hasTimedOut(
  contribution: Contribution,
  now = new Date().toISOString(),
): boolean {
  if (contribution.status !== 'submitted')
    return false
  const age = new Date(now).getTime() - new Date(contribution.submittedAt).getTime()
  return age > SUBMISSION_TIMEOUT_MINUTES * 60_000
}
