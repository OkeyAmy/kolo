import type { Member, SignatureProof } from './types'
import { describe, expect, it } from 'vitest'
import { activateCircle, createCircle, joinCircle } from './circle'
import { toBaseUnits } from './money'
import { acceptSwap, declineSwap, requestSwap, swapPayload } from './swap'

const T0 = '2026-08-01T10:00:00.000Z'

function addr(n: number): string {
  return `NQ${String(10 + n).padStart(2, '0')}${'ABCDEFGH23456789'.repeat(2)}`
}

const SIG: SignatureProof = { publicKey: 'pk', signature: 'sig' }

function activeCircle(seats = 4) {
  const { circle, member } = createCircle({
    name: 'School fees',
    currency: 'NIM',
    network: 'test',
    amount: toBaseUnits('500', 'NIM'),
    cadence: 'weekly',
    seats,
    visibility: 'private',
    creatorAddress: addr(1),
    creatorName: 'Ada',
    now: T0,
  })
  const members: Member[] = [member]
  for (let i = 2; i <= seats; i++)
    members.push(joinCircle(circle, members, addr(i), `Member ${i}`, T0))
  return activateCircle(circle, members, T0)
}

describe('swapPayload', () => {
  it('is order-independent so both parties sign identical bytes', () => {
    const a = swapPayload({ circleId: 'cir_1', positionA: 4, positionB: 2, nonce: 'n1' })
    const b = swapPayload({ circleId: 'cir_1', positionA: 2, positionB: 4, nonce: 'n1' })
    // blindfold: invariant — the two signatures must cover the same message to be comparable
    expect(a).toBe(b)
    // blindfold: contract — payload grammar kolo-swap:<circleId>:<low>:<high>:<nonce> in swap.ts
    expect(a).toBe('kolo-swap:cir_1:2:4:n1')
  })
})

describe('requestSwap', () => {
  function setup(seats = 4) {
    const { circle, rounds } = activeCircle(seats)
    const members = rounds.map((round, i) => ({
      circleId: circle.id,
      address: round.recipientAddress,
      displayName: `Member ${i + 1}`,
      position: i + 1,
      joinedAt: T0,
    }))
    return { circle, rounds, members }
  }

  it('records both parties and their positions', () => {
    const { circle, rounds, members } = setup()
    const swap = requestSwap({
      circle,
      members,
      rounds,
      requesterAddress: members[3].address,
      targetPosition: 2,
      reason: 'rent is due',
      requesterSignature: SIG,
      now: T0,
    })
    // blindfold: invariant — positionA belongs to the requester, positionB to the counterparty
    expect(swap.positionA).toBe(4)
    // blindfold: invariant — positionB is the requested target, here seat 2
    expect(swap.positionB).toBe(2)
    expect(swap.counterpartyAddress).toBe(members[1].address)
    // blindfold: invariant — a fresh swap waits for the counterparty, it never self-applies
    expect(swap.status).toBe('requested')
    // blindfold: invariant — a request carries exactly one signature until it is accepted
    expect(swap.counterpartySignature).toBe(null)
  })

  it('refuses to move a round that has already opened', () => {
    const { circle, rounds, members } = setup()
    // round 1 is 'collecting' the moment the circle activates
    // blindfold: invariant — money is already in flight against that recipient
    expect(() => requestSwap({
      circle,
      members,
      rounds,
      requesterAddress: members[3].address,
      targetPosition: 1,
      reason: 'me first',
      requesterSignature: SIG,
      now: T0,
    })).toThrow(/already started/)
  })

  it('refuses a swap with yourself', () => {
    const { circle, rounds, members } = setup()
    // blindfold: invariant — a swap permutes two distinct positions
    expect(() => requestSwap({
      circle,
      members,
      rounds,
      requesterAddress: members[2].address,
      targetPosition: 3,
      reason: 'no-op',
      requesterSignature: SIG,
      now: T0,
    })).toThrow(/already your position/)
  })

  it('refuses a swap from someone outside the circle', () => {
    const { circle, rounds, members } = setup()
    // blindfold: invariant — only members can reorder a circle
    expect(() => requestSwap({
      circle,
      members,
      rounds,
      requesterAddress: addr(99),
      targetPosition: 2,
      reason: 'let me in',
      requesterSignature: SIG,
      now: T0,
    })).toThrow(/not in this circle/)
  })

  it('refuses a swap before the circle is running', () => {
    const { circle, member } = createCircle({
      name: 'Not started',
      currency: 'NIM',
      network: 'test',
      amount: toBaseUnits('500', 'NIM'),
      cadence: 'weekly',
      seats: 4,
      visibility: 'private',
      creatorAddress: addr(1),
      creatorName: 'Ada',
      now: T0,
    })
    // blindfold: invariant — positions are not final until every seat is filled
    expect(() => requestSwap({
      circle,
      members: [member],
      rounds: [],
      requesterAddress: member.address,
      targetPosition: 2,
      reason: 'early',
      requesterSignature: SIG,
      now: T0,
    })).toThrow(/only possible once the circle is running/)
  })
})

describe('acceptSwap', () => {
  function pending(seats = 4) {
    const { circle, rounds } = activeCircle(seats)
    const members = rounds.map((round, i) => ({
      circleId: circle.id,
      address: round.recipientAddress,
      displayName: `Member ${i + 1}`,
      position: i + 1,
      joinedAt: T0,
    }))
    const swap = requestSwap({
      circle,
      members,
      rounds,
      requesterAddress: members[3].address,
      targetPosition: 2,
      reason: 'rent is due',
      requesterSignature: SIG,
      now: T0,
    })
    return { circle, rounds, members, swap }
  }

  it('exchanges exactly the two positions and nothing else', () => {
    const { circle, rounds, members, swap } = pending()
    const result = acceptSwap({
      swap,
      circle,
      members,
      rounds,
      accepterAddress: members[1].address,
      counterpartySignature: { publicKey: 'pk2', signature: 'sig2' },
      now: T0,
    })
    const positions = new Map(result.members.map(m => [m.address, m.position]))
    // blindfold: invariant — a swap is a permutation of two positions
    expect(positions.get(members[3].address)).toBe(2)
    // blindfold: invariant — the counterparty takes the requester's old seat 4
    expect(positions.get(members[1].address)).toBe(4)
    expect(positions.get(members[0].address)).toBe(1)
    // blindfold: invariant — uninvolved members keep their seats; seat 3 does not move
    expect(positions.get(members[2].address)).toBe(3)
  })

  it('stores both signatures as the record of consent', () => {
    const { circle, rounds, members, swap } = pending()
    const result = acceptSwap({
      swap,
      circle,
      members,
      rounds,
      accepterAddress: members[1].address,
      counterpartySignature: { publicKey: 'pk2', signature: 'sig2' },
      now: T0,
    })
    // blindfold: invariant — an applied swap is provable after the fact by both signatures
    expect(result.swap.status).toBe('applied')
    expect(result.swap.requesterSignature).toEqual(SIG)
    expect(result.swap.counterpartySignature).toEqual({ publicKey: 'pk2', signature: 'sig2' })
  })

  it('refuses acceptance by anyone but the counterparty', () => {
    const { circle, rounds, members, swap } = pending()
    // blindfold: invariant — one signature is never enough to reorder a circle
    expect(() => acceptSwap({
      swap,
      circle,
      members,
      rounds,
      accepterAddress: members[2].address,
      counterpartySignature: { publicKey: 'pk3', signature: 'sig3' },
      now: T0,
    })).toThrow(/only the other member/i)
  })

  it('refuses to apply a swap twice', () => {
    const { circle, rounds, members, swap } = pending()
    const applied = acceptSwap({
      swap,
      circle,
      members,
      rounds,
      accepterAddress: members[1].address,
      counterpartySignature: { publicKey: 'pk2', signature: 'sig2' },
      now: T0,
    })
    // blindfold: invariant — replaying an applied swap would silently reorder the circle again
    expect(() => acceptSwap({
      swap: applied.swap,
      circle,
      members: applied.members,
      rounds,
      accepterAddress: members[1].address,
      counterpartySignature: { publicKey: 'pk2', signature: 'sig2' },
      now: T0,
    })).toThrow(/already been resolved/)
  })
})

describe('declineSwap', () => {
  it('resolves without touching the order', () => {
    const { circle, rounds } = activeCircle(4)
    const members = rounds.map((round, i) => ({
      circleId: circle.id,
      address: round.recipientAddress,
      displayName: `Member ${i + 1}`,
      position: i + 1,
      joinedAt: T0,
    }))
    const swap = requestSwap({
      circle,
      members,
      rounds,
      requesterAddress: members[3].address,
      targetPosition: 2,
      reason: 'rent is due',
      requesterSignature: SIG,
      now: T0,
    })
    const declined = declineSwap(swap, members[1].address, T0)
    // blindfold: invariant — a declined swap changes nothing but its own status
    expect(declined.status).toBe('declined')
    expect(declined.counterpartySignature).toBe(null)
  })
})
