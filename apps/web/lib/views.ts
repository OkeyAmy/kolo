import type {
  Circle,
  Contribution,
  Member,
  Round,
  Swap,
  TrustRecord,
} from '@kolo/core'

/** Everything a screen needs, assembled on the server. */

export interface MemberView extends Member {
  isYou: boolean
  isRecipient: boolean
  /** State in the round currently collecting. */
  state: 'recipient' | 'verified' | 'submitted' | 'due' | 'late'
  txHash: string | null
  trust: TrustRecord | null
  roundsPaid: number
  roundsMissed: number
}

export interface CircleSummary {
  circle: Circle
  seatsTaken: number
  /** Requests waiting on this viewer, when they are the organiser. */
  pendingRequests: number
  roundIndex: number
  potAmount: string
  recipientName: string | null
  /** What the viewer needs to do next, if anything. */
  youOwe: boolean
  youCollect: boolean
}

export interface CircleView {
  circle: Circle
  members: MemberView[]
  rounds: Round[]
  currentRound: Round | null
  contributions: Contribution[]
  swaps: Swap[]
  potAmount: string
  seatsTaken: number
  /** People asking to join a public circle, awaiting the organiser's decision. */
  requests: MemberView[]
  isOrganiser: boolean
  /** Set when the viewer has asked to join and is waiting on the organiser. */
  yourRequest: MemberView | null
  you: MemberView | null
  /** Set when the viewer still owes this round. */
  payment: PaymentInstruction | null
  memberSince: string | null
  /** Who collects the round after this one. Null on the final round. */
  nextRecipientName: string | null
}

export interface PaymentInstruction {
  recipient: string
  recipientName: string
  amount: string
  currency: Circle['currency']
  memo: string
  roundIndex: number
}

export interface HomeView {
  address: string | null
  displayName: string | null
  trust: TrustRecord | null
  myCircles: CircleSummary[]
  publicCircles: CircleSummary[]
}
