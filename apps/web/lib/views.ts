import type {
  Circle,
  Contribution,
  Member,
  Round,
  SoloBox,
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
  roundsPaid: number
  roundsMissed: number
}

export interface CircleSummary {
  circle: Circle
  seatsTaken: number
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
  you: MemberView | null
  /** Set when the viewer still owes this round. */
  payment: PaymentInstruction | null
  memberSince: string | null
}

export interface PaymentInstruction {
  recipient: string
  recipientName: string
  amount: string
  currency: Circle['currency']
  memo: string
  roundIndex: number
}

export interface BoxPeriodView {
  index: number
  status: 'saved' | 'pending' | 'open' | 'missed' | 'upcoming'
  opensAt: string
  txHash: string | null
}

export interface BoxView {
  box: SoloBox
  periods: BoxPeriodView[]
  streak: number
  saved: string
  target: string
  payment: PaymentInstruction | null
}

export interface HomeView {
  address: string | null
  displayName: string | null
  trust: TrustRecord | null
  myCircles: CircleSummary[]
  publicCircles: CircleSummary[]
  myBoxes: BoxView[]
}
