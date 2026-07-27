import type {
  Cadence,
  Circle,
  Contribution,
  Currency,
  Member,
  NimiqNetwork,
  Round,
} from './types'
import { normalizeAddress, sameAddress } from './address'
import { newCode, newId } from './ids'
import { addDays, addHours, CADENCE_DAYS } from './money'

export class CircleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'CircleError'
  }
}

const MIN_SEATS = 3
const MAX_SEATS = 12

export interface CreateCircleInput {
  name: string
  currency: Currency
  network: NimiqNetwork
  /** Smallest units. */
  amount: string
  cadence: Cadence
  seats: number
  visibility: 'public' | 'private'
  creatorAddress: string
  creatorName: string
  graceHours?: number
  now?: string
}

export function createCircle(input: CreateCircleInput): { circle: Circle, member: Member } {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 40)
    throw new CircleError('Give the circle a name between 2 and 40 characters.', 'bad_name')

  if (!Number.isInteger(input.seats) || input.seats < MIN_SEATS || input.seats > MAX_SEATS)
    throw new CircleError(`A circle needs between ${MIN_SEATS} and ${MAX_SEATS} seats.`, 'bad_seats')

  if (BigInt(input.amount) <= 0n)
    throw new CircleError('The contribution has to be more than zero.', 'bad_amount')

  const now = input.now ?? new Date().toISOString()
  const circle: Circle = {
    id: newId('cir'),
    code: newCode(),
    name,
    currency: input.currency,
    network: input.network,
    amount: input.amount,
    cadence: input.cadence,
    seats: input.seats,
    status: 'open',
    visibility: input.visibility,
    creatorAddress: normalizeAddress(input.creatorAddress),
    graceHours: input.graceHours ?? 48,
    createdAt: now,
    activatedAt: null,
    completedAt: null,
  }

  return {
    circle,
    member: {
      circleId: circle.id,
      address: normalizeAddress(input.creatorAddress),
      displayName: input.creatorName,
      position: 1,
      status: 'active',
      joinedAt: now,
      decidedAt: now,
    },
  }
}

export function joinCircle(
  circle: Circle,
  members: Member[],
  address: string,
  displayName: string,
  now = new Date().toISOString(),
): Member {
  if (circle.status !== 'open')
    throw new CircleError('This circle has already started. Ask them to open the next one.', 'not_open')

  const existing = members.find(m => sameAddress(m.address, address))
  if (existing) {
    if (existing.status === 'requested')
      throw new CircleError('You have already asked to join. The organiser has to approve it.', 'already_requested')
    if (existing.status === 'declined')
      throw new CircleError('The organiser did not approve this request.', 'declined')
    throw new CircleError('You are already in this circle.', 'already_member')
  }

  if (seatsTaken(members) >= circle.seats)
    throw new CircleError('This circle is full.', 'full')

  // Anyone can ask to join a public circle, so the organiser vouches for them
  // before they hold a seat. An invite link is itself a vouch, so a private
  // circle admits the holder straight away.
  const requiresApproval = circle.visibility === 'public'
    && !sameAddress(circle.creatorAddress, address)

  return {
    circleId: circle.id,
    address: normalizeAddress(address),
    displayName,
    position: requiresApproval ? 0 : seatsTaken(members) + 1,
    status: requiresApproval ? 'requested' : 'active',
    joinedAt: now,
    decidedAt: requiresApproval ? null : now,
  }
}

/** Only approved members hold a seat; pending requests never fill the circle. */
export function seatsTaken(members: Member[]): number {
  return members.filter(m => m.status === 'active').length
}

export function activeMembers(members: Member[]): Member[] {
  return members.filter(m => m.status === 'active')
}

export function pendingRequests(members: Member[]): Member[] {
  return members.filter(m => m.status === 'requested')
}

/**
 * The organiser admits someone who asked to join, or turns them down.
 *
 * A seat is only assigned on approval, so the payout order still reflects the
 * order people actually entered the circle, and a pending request can never
 * displace someone already in.
 */
export function decideRequest(
  circle: Circle,
  members: Member[],
  deciderAddress: string,
  candidateAddress: string,
  decision: 'approve' | 'decline',
  now = new Date().toISOString(),
): Member {
  if (!sameAddress(circle.creatorAddress, deciderAddress))
    throw new CircleError('Only the person who started this circle can approve members.', 'not_organiser')

  if (circle.status !== 'open')
    throw new CircleError('This circle has already started.', 'not_open')

  const candidate = members.find(m => sameAddress(m.address, candidateAddress))
  if (!candidate || candidate.status !== 'requested')
    throw new CircleError('There is no pending request from that person.', 'no_request')

  if (decision === 'decline')
    return { ...candidate, status: 'declined', position: 0, decidedAt: now }

  if (seatsTaken(members) >= circle.seats)
    throw new CircleError('Every seat is already taken.', 'full')

  return {
    ...candidate,
    status: 'active',
    position: seatsTaken(members) + 1,
    decidedAt: now,
  }
}

/**
 * A circle activates the moment its last seat is taken. Positions are frozen
 * here in join order — never shuffled, never random. Randomising a payout order
 * would make this a game of chance, which the competition rules forbid, and
 * would make the order unauditable for members.
 */
export function activateCircle(
  circle: Circle,
  members: Member[],
  now = new Date().toISOString(),
): { circle: Circle, rounds: Round[] } {
  if (circle.status !== 'open')
    throw new CircleError('Circle is not open.', 'not_open')
  if (seatsTaken(members) !== circle.seats)
    throw new CircleError('Every seat has to be filled before the circle starts.', 'not_full')

  const activated: Circle = { ...circle, status: 'active', activatedAt: now }
  return { circle: activated, rounds: buildRounds(activated, members, now) }
}

export function buildRounds(circle: Circle, members: Member[], startAt: string): Round[] {
  // Only seat-holders appear in the payout order. A pending or declined request
  // never becomes a round.
  const ordered = activeMembers(members).sort((a, b) => a.position - b.position)
  const days = CADENCE_DAYS[circle.cadence]

  return ordered.map((member, i) => {
    const opensAt = addDays(startAt, i * days)
    return {
      circleId: circle.id,
      index: i + 1,
      recipientAddress: member.address,
      status: i === 0 ? 'collecting' : 'pending',
      opensAt,
      dueAt: addHours(opensAt, circle.graceHours),
      closedAt: null,
    }
  })
}

/** Rounds are recomputed from positions whenever a swap changes the order. */
export function reassignRecipients(rounds: Round[], members: Member[]): Round[] {
  const byPosition = new Map(activeMembers(members).map(m => [m.position, m.address]))
  return rounds.map(round =>
    round.status === 'complete' || round.status === 'incomplete'
      ? round
      : { ...round, recipientAddress: byPosition.get(round.index) ?? round.recipientAddress },
  )
}

export type ObligationState = 'recipient' | 'verified' | 'submitted' | 'due' | 'late'

export interface Obligation {
  member: Member
  state: ObligationState
  contribution: Contribution | null
}

/**
 * Who owes what in a given round. The recipient of a round does not pay into
 * their own pot, which is the whole point of a rotating circle.
 */
export function roundObligations(
  round: Round,
  members: Member[],
  contributions: Contribution[],
  now = new Date().toISOString(),
): Obligation[] {
  const late = new Date(now) > new Date(round.dueAt)

  // Only seat-holders owe a round.
  return activeMembers(members)
    .sort((a, b) => a.position - b.position)
    .map((member) => {
      if (sameAddress(member.address, round.recipientAddress))
        return { member, state: 'recipient' as const, contribution: null }

      const contribution = contributions.find(c =>
        c.roundIndex === round.index && sameAddress(c.fromAddress, member.address),
      ) ?? null

      if (contribution?.status === 'verified')
        return { member, state: 'verified' as const, contribution }
      if (contribution?.status === 'submitted')
        return { member, state: 'submitted' as const, contribution }

      return { member, state: late ? ('late' as const) : ('due' as const), contribution }
    })
}

export function isRoundSettled(obligations: Obligation[]): boolean {
  return obligations.every(o => o.state === 'recipient' || o.state === 'verified')
}

/**
 * Close out any round whose obligations are met, or whose grace window has
 * expired, and open the next one. Pure: returns new arrays, mutates nothing.
 */
export function advanceCircle(
  circle: Circle,
  rounds: Round[],
  members: Member[],
  contributions: Contribution[],
  now = new Date().toISOString(),
): { circle: Circle, rounds: Round[] } {
  if (circle.status !== 'active')
    return { circle, rounds }

  let next = [...rounds].sort((a, b) => a.index - b.index)
  let changed = true

  while (changed) {
    changed = false
    const current = next.find(r => r.status === 'collecting')
    if (!current)
      break

    const obligations = roundObligations(current, members, contributions, now)
    const settled = isRoundSettled(obligations)
    const expired = new Date(now) > new Date(current.dueAt)

    if (!settled && !expired)
      break

    next = next.map((round) => {
      if (round.index === current.index)
        return { ...round, status: settled ? 'complete' : 'incomplete', closedAt: now }
      if (round.index === current.index + 1 && round.status === 'pending')
        return { ...round, status: 'collecting' }
      return round
    })
    changed = true
  }

  const allClosed = next.every(r => r.status === 'complete' || r.status === 'incomplete')
  const updated: Circle = allClosed
    ? { ...circle, status: 'completed', completedAt: now }
    : circle

  return { circle: updated, rounds: next }
}

export function currentRound(rounds: Round[]): Round | null {
  return rounds.find(r => r.status === 'collecting')
    ?? [...rounds].reverse().find(r => r.status !== 'pending')
    ?? rounds[0]
    ?? null
}

export function memberOf(members: Member[], address: string | null | undefined): Member | null {
  if (!address)
    return null
  return members.find(m => sameAddress(m.address, address)) ?? null
}

export const CIRCLE_LIMITS = { MIN_SEATS, MAX_SEATS }
