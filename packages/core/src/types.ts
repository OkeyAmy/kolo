/**
 * Kolo domain types.
 *
 * Design rule that governs this whole package: Kolo never holds money and has
 * no address of its own. Every value flow is member -> member. This module
 * therefore only ever describes *obligations* and *evidence*, never balances.
 */

export type Currency = 'NIM' | 'USDT'

/**
 * Which Nimiq chain a circle lives on. Pinned when the circle is created and
 * never changed: a payment on one chain must never settle an obligation on the
 * other, and testnet NIM is free.
 */
export type NimiqNetwork = 'main' | 'test'

export type Cadence = 'weekly' | 'biweekly' | 'monthly'

export type CircleStatus = 'open' | 'active' | 'completed' | 'abandoned'

export type RoundStatus = 'pending' | 'collecting' | 'complete' | 'incomplete'

export type ContributionStatus = 'submitted' | 'verified' | 'failed'

export type SwapStatus = 'requested' | 'applied' | 'declined' | 'expired'

export interface Circle {
  id: string
  /** 6-character human-shareable code. Also the invite code. */
  code: string
  name: string
  currency: Currency
  network: NimiqNetwork
  /** Amount per member per round, in the currency's smallest unit (Luna for NIM, 1e-6 for USDT). */
  amount: string
  cadence: Cadence
  seats: number
  status: CircleStatus
  visibility: 'public' | 'private'
  creatorAddress: string
  /** Hours after a round opens before an unpaid contribution counts as missed. */
  graceHours: number
  createdAt: string
  activatedAt: string | null
  completedAt: string | null
}

export interface Member {
  circleId: string
  address: string
  displayName: string
  /** 1-based payout position. Mutable only through an applied Swap. */
  position: number
  joinedAt: string
}

export interface Round {
  circleId: string
  /** 1-based. Round N pays out to the member holding position N. */
  index: number
  recipientAddress: string
  status: RoundStatus
  opensAt: string
  dueAt: string
  closedAt: string | null
}

export interface Contribution {
  id: string
  circleId: string
  roundIndex: number
  fromAddress: string
  toAddress: string
  amount: string
  currency: Currency
  network: NimiqNetwork
  memo: string
  /** Hint returned by the wallet, used to bind a chain transaction to a member. */
  txHash: string | null
  status: ContributionStatus
  /** Address the money actually left, read off the chain once verified. */
  settledFrom: string | null
  blockNumber: number | null
  submittedAt: string
  verifiedAt: string | null
}

export interface Swap {
  id: string
  circleId: string
  requesterAddress: string
  counterpartyAddress: string
  /** Positions being exchanged. positionA belongs to the requester. */
  positionA: number
  positionB: number
  nonce: string
  status: SwapStatus
  requesterSignature: SignatureProof | null
  counterpartySignature: SignatureProof | null
  reason: string
  createdAt: string
  resolvedAt: string | null
}

export interface SignatureProof {
  publicKey: string
  signature: string
}

export interface TrustRecord {
  address: string
  circlesJoined: number
  circlesCompleted: number
  roundsPaid: number
  roundsOnTime: number
  roundsMissed: number
  /** 0-100. Newcomers are 'new', not zero — absence of history is not bad history. */
  score: number
  label: 'new' | 'building' | 'reliable' | 'trusted' | 'at-risk'
}

/** A transaction as returned by the Albatross RPC, narrowed to what we match on. */
export interface ChainTransaction {
  hash: string
  from: string
  to: string
  /** Luna for NIM. */
  value: number
  /** Hex-encoded memo bytes. */
  recipientData: string
  blockNumber: number
  timestamp: number
  confirmations: number
  networkId: number
}
