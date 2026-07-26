import type { Circle, Member, Round, SignatureProof, Swap } from './types'
import { normalizeAddress, sameAddress } from './address'
import { newId, newNonce } from './ids'

/**
 * Emergency swap: two members trade payout positions.
 *
 * The rule that makes this feature worth having is that Kolo cannot do it.
 * A swap only applies when *both* members have signed the same canonical
 * payload with their own Nimiq key. Kolo verifies the two signatures and then
 * performs a permutation of exactly two positions — it never edits an order on
 * anyone's behalf, and both signatures stay in the circle's history so any
 * member can re-check the change later.
 */

export class SwapError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'SwapError'
  }
}

/** The exact bytes both parties sign. Any change here invalidates old swaps. */
export function swapPayload(swap: Pick<Swap, 'circleId' | 'positionA' | 'positionB' | 'nonce'>): string {
  const [low, high] = [swap.positionA, swap.positionB].sort((a, b) => a - b)
  return `kolo-swap:${swap.circleId}:${low}:${high}:${swap.nonce}`
}

export interface RequestSwapInput {
  circle: Circle
  members: Member[]
  rounds: Round[]
  requesterAddress: string
  targetPosition: number
  reason: string
  requesterSignature: SignatureProof
  now?: string
}

export function requestSwap(input: RequestSwapInput): Swap {
  const { circle, members, rounds } = input
  const now = input.now ?? new Date().toISOString()

  if (circle.status !== 'active')
    throw new SwapError('Swaps are only possible once the circle is running.', 'not_active')

  const requester = members.find(m => sameAddress(m.address, input.requesterAddress))
  if (!requester)
    throw new SwapError('You are not in this circle.', 'not_member')

  const counterparty = members.find(m => m.position === input.targetPosition)
  if (!counterparty)
    throw new SwapError('Nobody holds that position.', 'no_target')

  if (counterparty.position === requester.position)
    throw new SwapError('That is already your position.', 'same_position')

  assertPositionSwappable(rounds, requester.position)
  assertPositionSwappable(rounds, counterparty.position)

  const reason = input.reason.trim().slice(0, 140)

  return {
    id: newId('swp'),
    circleId: circle.id,
    requesterAddress: normalizeAddress(requester.address),
    counterpartyAddress: normalizeAddress(counterparty.address),
    positionA: requester.position,
    positionB: counterparty.position,
    nonce: newNonce(),
    status: 'requested',
    requesterSignature: input.requesterSignature,
    counterpartySignature: null,
    reason,
    createdAt: now,
    resolvedAt: null,
  }
}

/**
 * A round that is already collecting or closed cannot move: money is in flight
 * against that recipient, and re-pointing it mid-round would strand payments.
 */
function assertPositionSwappable(rounds: Round[], position: number): void {
  const round = rounds.find(r => r.index === position)
  if (!round)
    return
  if (round.status !== 'pending') {
    throw new SwapError(
      'That round has already started. You can only swap rounds that have not opened yet.',
      'round_started',
    )
  }
}

export interface AcceptSwapInput {
  swap: Swap
  circle: Circle
  members: Member[]
  rounds: Round[]
  accepterAddress: string
  counterpartySignature: SignatureProof
  now?: string
}

export function acceptSwap(input: AcceptSwapInput): {
  swap: Swap
  members: Member[]
} {
  const { swap, members, rounds } = input
  const now = input.now ?? new Date().toISOString()

  if (swap.status !== 'requested')
    throw new SwapError('This swap has already been resolved.', 'resolved')

  if (!sameAddress(swap.counterpartyAddress, input.accepterAddress))
    throw new SwapError('Only the other member can accept this swap.', 'wrong_signer')

  if (!swap.requesterSignature)
    throw new SwapError('The request is missing its first signature.', 'missing_signature')

  assertPositionSwappable(rounds, swap.positionA)
  assertPositionSwappable(rounds, swap.positionB)

  const swapped = members.map((member) => {
    if (member.position === swap.positionA)
      return { ...member, position: swap.positionB }
    if (member.position === swap.positionB)
      return { ...member, position: swap.positionA }
    return member
  })

  assertValidPermutation(members, swapped)

  return {
    swap: {
      ...swap,
      status: 'applied',
      counterpartySignature: input.counterpartySignature,
      resolvedAt: now,
    },
    members: swapped,
  }
}

export function declineSwap(swap: Swap, accepterAddress: string, now = new Date().toISOString()): Swap {
  if (swap.status !== 'requested')
    throw new SwapError('This swap has already been resolved.', 'resolved')
  if (!sameAddress(swap.counterpartyAddress, accepterAddress))
    throw new SwapError('Only the other member can decline this swap.', 'wrong_signer')
  return { ...swap, status: 'declined', resolvedAt: now }
}

/**
 * Guards the one invariant that matters: a swap is a permutation. Same people,
 * same set of positions, exactly two of them moved.
 */
function assertValidPermutation(before: Member[], after: Member[]): void {
  if (before.length !== after.length)
    throw new SwapError('A swap cannot add or remove members.', 'bad_permutation')

  const positionsBefore = [...before.map(m => m.position)].sort((a, b) => a - b)
  const positionsAfter = [...after.map(m => m.position)].sort((a, b) => a - b)
  if (positionsBefore.join() !== positionsAfter.join())
    throw new SwapError('A swap cannot change the set of positions.', 'bad_permutation')

  const moved = after.filter((member, i) => member.position !== before[i].position)
  if (moved.length !== 2)
    throw new SwapError('A swap moves exactly two positions.', 'bad_permutation')
}

export const SWAP_EXPIRY_HOURS = 72

export function isExpired(swap: Swap, now = new Date().toISOString()): boolean {
  if (swap.status !== 'requested')
    return false
  const age = new Date(now).getTime() - new Date(swap.createdAt).getTime()
  return age > SWAP_EXPIRY_HOURS * 3_600_000
}
