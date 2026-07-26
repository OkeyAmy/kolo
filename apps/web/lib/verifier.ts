import type { ChainTransaction, Contribution, NimiqNetwork, Repository } from '@kolo/core'
import {
  advanceCircle,
  applyMatch,
  hasTimedOut,
  matchTransaction,
  normalizeAddress,
} from '@kolo/core'
import { getTransactionsByAddress } from './rpc'

/**
 * Promotes submitted contributions to verified by finding the matching
 * transaction on the Nimiq chain.
 *
 * This runs on demand — whenever anybody loads a circle — rather than on a
 * cron, so a member sees their payment confirm within a second or two of making
 * it without Kolo needing a background worker to stay alive.
 */

export interface VerifyResult {
  checked: number
  verified: number
  timedOut: number
}

export async function verifyContributions(
  repo: Repository,
  contributions: Contribution[],
  now = new Date().toISOString(),
): Promise<VerifyResult> {
  const pending = contributions.filter(c => c.status === 'submitted')
  if (pending.length === 0)
    return { checked: 0, verified: 0, timedOut: 0 }

  // One RPC round trip per recipient address, not per contribution: in a circle
  // every contribution in a round shares the same recipient. Keyed by network
  // too, because a testnet payment must never settle a mainnet obligation.
  const byRecipient = new Map<string, Contribution[]>()
  for (const contribution of pending) {
    const key = `${contribution.network}|${normalizeAddress(contribution.toAddress)}`
    byRecipient.set(key, [...(byRecipient.get(key) ?? []), contribution])
  }

  let verified = 0
  let timedOut = 0

  for (const [key, group] of byRecipient) {
    const [network, recipient] = key.split('|') as [NimiqNetwork, string]
    let transactions: ChainTransaction[] = []
    try {
      transactions = await getTransactionsByAddress(network, recipient, 100)
    }
    catch {
      // A flaky RPC must never lose a payment. The contribution stays
      // 'submitted' and the next page load tries again.
      continue
    }

    const claimed = new Set(
      contributions
        .filter(c => c.status === 'verified' && c.txHash)
        .map(c => c.txHash as string),
    )

    for (const contribution of group) {
      const match = matchTransaction(
        {
          fromAddress: contribution.fromAddress,
          toAddress: contribution.toAddress,
          amount: contribution.amount,
          memo: contribution.memo,
          notBefore: contribution.submittedAt,
        },
        transactions,
        claimed,
      )

      const updated = applyMatch(contribution, match, now)
      if (updated) {
        await repo.updateContribution(updated)
        claimed.add(updated.txHash as string)
        verified += 1
        continue
      }

      if (hasTimedOut(contribution, now)) {
        await repo.updateContribution({ ...contribution, status: 'failed' })
        timedOut += 1
      }
    }
  }

  return { checked: pending.length, verified, timedOut }
}

/** Verify a circle's pending payments, then move its rounds forward. */
export async function refreshCircle(
  repo: Repository,
  circleId: string,
  now = new Date().toISOString(),
): Promise<void> {
  const circle = await repo.getCircle(circleId)
  if (!circle)
    return

  const contributions = await repo.listContributions(circle.id)
  await verifyContributions(repo, contributions, now)

  if (circle.status !== 'active')
    return

  const [members, rounds, fresh] = await Promise.all([
    repo.listMembers(circle.id),
    repo.listRounds(circle.id),
    repo.listContributions(circle.id),
  ])

  const advanced = advanceCircle(circle, rounds, members, fresh, now)

  const roundsChanged = advanced.rounds.some(
    (round, i) => round.status !== rounds[i]?.status,
  )
  if (roundsChanged)
    await repo.replaceRounds(circle.id, advanced.rounds)
  if (advanced.circle.status !== circle.status)
    await repo.updateCircle(advanced.circle)
}

export async function refreshBox(
  repo: Repository,
  boxId: string,
  now = new Date().toISOString(),
): Promise<void> {
  const contributions = await repo.listBoxContributions(boxId)
  await verifyContributions(repo, contributions, now)
}
