import type { Contribution, Member } from './types'
import { describe, expect, it } from 'vitest'
import {
  activateCircle,
  advanceCircle,
  createCircle,
  isRoundSettled,
  joinCircle,
  roundObligations,
} from './circle'
import { toBaseUnits } from './money'

const T0 = '2026-08-01T10:00:00.000Z'

function addr(n: number): string {
  return `NQ${String(10 + n).padStart(2, '0')}${'ABCDEFGH23456789'.repeat(2)}`
}

function circleInput() {
  return {
    name: 'Rent circle',
    currency: 'NIM' as const,
    network: 'test' as const,
    amount: toBaseUnits('500', 'NIM'),
    cadence: 'weekly' as const,
    seats: 3,
    visibility: 'public' as const,
    creatorAddress: addr(1),
    creatorName: 'Ada',
    now: T0,
  }
}

function fill(seats = 3) {
  const { circle, member } = createCircle({ ...circleInput(), seats })
  const members: Member[] = [member]
  for (let i = 2; i <= seats; i++)
    members.push(joinCircle(circle, members, addr(i), `Member ${i}`, T0))
  return { circle, members }
}

function paid(
  circleId: string,
  from: string,
  to: string,
  roundIndex: number,
  verifiedAt: string,
): Contribution {
  return {
    id: `con_${from}_${roundIndex}`,
    circleId,
    boxId: null,
    roundIndex,
    fromAddress: from,
    toAddress: to,
    amount: toBaseUnits('500', 'NIM'),
    currency: 'NIM',
    network: 'test',
    memo: `kolo:x:r${roundIndex}`,
    txHash: 'abc',
    status: 'verified',
    blockNumber: 1,
    submittedAt: verifiedAt,
    verifiedAt,
  }
}

describe('createCircle', () => {
  it('rejects a seat count outside the supported range', () => {
    // blindfold: contract — CIRCLE_LIMITS in circle.ts fixes the range at 3..12
    expect(() => createCircle({ ...circleInput(), seats: 2 })).toThrow(/between 3 and 12/)
    expect(() => createCircle({ ...circleInput(), seats: 13 })).toThrow(/between 3 and 12/)
  })

  it('puts the creator in position 1', () => {
    const { member } = createCircle(circleInput())
    // blindfold: invariant — the creator is the first member, so they take seat 1
    expect(member.position).toBe(1)
  })
})

describe('joinCircle', () => {
  it('refuses a duplicate member', () => {
    const { circle, members } = fill(3)
    // blindfold: invariant — one address holds at most one position in a circle
    expect(() => joinCircle(circle, members, addr(1), 'Ada again')).toThrow(/already in this circle/)
  })

  it('refuses to oversubscribe a circle', () => {
    const { circle, members } = fill(3)
    // blindfold: invariant — member count never exceeds circle.seats
    expect(() => joinCircle(circle, members, addr(9), 'Late')).toThrow(/full/)
  })

  it('refuses to join a circle that already started', () => {
    const { circle, members } = fill(3)
    const { circle: active } = activateCircle(circle, members, T0)
    // blindfold: invariant — joining an active circle would invalidate the fixed payout order
    expect(() => joinCircle(active, members, addr(9), 'Late')).toThrow(/already started/)
  })
})

describe('activateCircle', () => {
  it('builds one round per seat, in position order', () => {
    const { circle, members } = fill(4)
    const { rounds } = activateCircle(circle, members, T0)
    // blindfold: invariant — a rotating circle gives every member exactly one payout
    expect(rounds).toHaveLength(4)
    expect(rounds.map(r => r.index)).toEqual([1, 2, 3, 4])
    // blindfold: invariant — round N pays the member holding position N
    expect(rounds.map(r => r.recipientAddress)).toEqual(members.map(m => m.address))
  })

  it('opens only the first round', () => {
    const { circle, members } = fill(4)
    const { rounds } = activateCircle(circle, members, T0)
    // blindfold: invariant — round N+1 cannot collect before round N closes
    expect(rounds.map(r => r.status)).toEqual(['collecting', 'pending', 'pending', 'pending'])
  })

  it('spaces rounds by the cadence', () => {
    const { circle, members } = fill(3)
    const { rounds } = activateCircle(circle, members, T0)
    const gap = new Date(rounds[1].opensAt).getTime() - new Date(rounds[0].opensAt).getTime()
    // blindfold: contract — CADENCE_DAYS.weekly is 7 days in money.ts
    expect(gap).toBe(7 * 86_400_000)
  })

  it('refuses to start with an empty seat', () => {
    const { circle, member } = createCircle({ ...circleInput(), seats: 4 })
    // blindfold: invariant — an under-filled circle cannot pay a full pot to anyone
    expect(() => activateCircle(circle, [member], T0)).toThrow(/every seat/i)
  })
})

describe('roundObligations', () => {
  it('never asks the recipient to pay into their own pot', () => {
    const { circle, members } = fill(3)
    const { rounds } = activateCircle(circle, members, T0)
    const obligations = roundObligations(rounds[0], members, [], T0)
    // blindfold: invariant — in round 1 the position-1 member collects and owes nothing
    expect(obligations.map(o => o.state)).toEqual(['recipient', 'due', 'due'])
  })

  it('marks unpaid members late once the grace window closes', () => {
    const { circle, members } = fill(3)
    const { rounds } = activateCircle(circle, members, T0)
    // T0 + 4 days is past the default 48-hour grace window
    const afterGrace = '2026-08-05T10:00:00.000Z'
    const obligations = roundObligations(rounds[0], members, [], afterGrace)
    // blindfold: invariant — past dueAt every unpaid obligation is 'late', the recipient still 'recipient'
    expect(obligations.map(o => o.state)).toEqual(['recipient', 'late', 'late'])
  })

  it('treats a submitted contribution as distinct from a verified one', () => {
    const { circle, members } = fill(3)
    const { rounds } = activateCircle(circle, members, T0)
    const submitted: Contribution = {
      ...paid(circle.id, members[1].address, members[0].address, 1, T0),
      status: 'submitted',
      verifiedAt: null,
    }
    const obligations = roundObligations(rounds[0], members, [submitted], T0)
    // blindfold: invariant — an unverified payment is never counted as settled
    expect(obligations.map(o => o.state)).toEqual(['recipient', 'submitted', 'due'])
  })
})

describe('advanceCircle', () => {
  it('closes a fully paid round and opens the next one', () => {
    const { circle, members } = fill(3)
    const { circle: active, rounds } = activateCircle(circle, members, T0)
    const contributions = [
      paid(active.id, members[1].address, members[0].address, 1, T0),
      paid(active.id, members[2].address, members[0].address, 1, T0),
    ]
    const result = advanceCircle(active, rounds, members, contributions, T0)
    // blindfold: invariant — a settled round closes as 'complete' and hands off to the next
    expect(result.rounds.map(r => r.status)).toEqual(['complete', 'collecting', 'pending'])
    // blindfold: invariant — the circle only completes once every round is closed
    expect(result.circle.status).toBe('active')
  })

  it('does not advance while a contribution is missing', () => {
    const { circle, members } = fill(3)
    const { circle: active, rounds } = activateCircle(circle, members, T0)
    const contributions = [paid(active.id, members[1].address, members[0].address, 1, T0)]
    const result = advanceCircle(active, rounds, members, contributions, T0)
    // blindfold: invariant — a round stays open until everyone who owes has verified
    expect(result.rounds.map(r => r.status)).toEqual(['collecting', 'pending', 'pending'])
  })

  it('marks a round incomplete when the grace window expires unpaid', () => {
    const { circle, members } = fill(3)
    const { circle: active, rounds } = activateCircle(circle, members, T0)
    // T0 + 3 days: past round 1's grace window, before round 2 opens at T0 + 7 days
    const result = advanceCircle(active, rounds, members, [], '2026-08-04T10:00:00.000Z')
    // blindfold: invariant — an expired unpaid round closes as 'incomplete', it does not block the circle
    expect(result.rounds.map(r => r.status)).toEqual(['incomplete', 'collecting', 'pending'])
  })

  it('completes the circle once every round is closed', () => {
    const { circle, members } = fill(3)
    const { circle: active, rounds } = activateCircle(circle, members, T0)
    // two months out: every round's grace window has expired
    const result = advanceCircle(active, rounds, members, [], '2026-10-01T10:00:00.000Z')
    // blindfold: invariant — all rounds closed implies the circle is finished
    expect(result.circle.status).toBe('completed')
    expect(result.rounds.map(r => r.status)).toEqual(['incomplete', 'incomplete', 'incomplete'])
  })
})

describe('isRoundSettled', () => {
  it('is true only when everybody who owes has verified', () => {
    const { circle, members } = fill(3)
    const { circle: active, rounds } = activateCircle(circle, members, T0)
    const partial = [paid(active.id, members[1].address, members[0].address, 1, T0)]
    // blindfold: invariant — one of two owed contributions leaves the round unsettled
    expect(isRoundSettled(roundObligations(rounds[0], members, partial, T0))).toBe(false)

    const full = [...partial, paid(active.id, members[2].address, members[0].address, 1, T0)]
    expect(isRoundSettled(roundObligations(rounds[0], members, full, T0))).toBe(true)
  })
})
