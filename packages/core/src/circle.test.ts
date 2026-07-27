import type { Contribution, Member } from './types'
import { describe, expect, it } from 'vitest'
import {
  activateCircle,
  advanceCircle,
  createCircle,
  decideRequest,
  isRoundSettled,
  joinCircle,
  roundObligations,
  seatsTaken,
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
    visibility: 'private' as const,
    creatorAddress: addr(1),
    creatorName: 'Ada',
    now: T0,
  }
}

/** An invite-only circle: the link is the vouch, so joining seats you directly. */
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
    roundIndex,
    fromAddress: from,
    toAddress: to,
    amount: toBaseUnits('500', 'NIM'),
    currency: 'NIM',
    network: 'test',
    memo: `kolo:x:r${roundIndex}`,
    txHash: 'abc',
    settledFrom: null,
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

describe('joining a public circle', () => {
  function publicCircle(seats = 3) {
    const { circle, member } = createCircle({
      ...circleInput(),
      seats,
      visibility: 'public',
    })
    return { circle, members: [member] }
  }

  it('does not seat a stranger until the organiser approves', () => {
    const { circle, members } = publicCircle()
    const asked = joinCircle(circle, members, addr(2), 'Stranger', T0)
    // blindfold: invariant — anyone may ask to join a public circle, but a
    // request holds no seat and no payout position until it is approved
    expect(asked.status).toBe('requested')
    expect(asked.position).toBe(0)
  })

  it('does not let pending requests fill the circle', () => {
    const { circle, members } = publicCircle()
    const all = [...members]
    for (let i = 2; i <= 5; i++)
      all.push(joinCircle(circle, all, addr(i), `Asker ${i}`, T0))
    // blindfold: invariant — seatsTaken counts approved members only, so
    // requests can never crowd out the seats or trigger activation
    expect(seatsTaken(all)).toBe(1)
    expect(() => activateCircle(circle, all, T0)).toThrow(/Every seat/)
  })

  it('seats an approved member in the order they were admitted', () => {
    const { circle, members } = publicCircle()
    const asked = joinCircle(circle, members, addr(2), 'Stranger', T0)
    const approved = decideRequest(circle, [...members, asked], addr(1), addr(2), 'approve', T0)
    // blindfold: invariant — a position is assigned on approval, after the
    // seats already taken, so approval never displaces an existing member
    expect(approved.status).toBe('active')
    expect(approved.position).toBe(2)
  })

  it('refuses to let anyone but the organiser approve', () => {
    const { circle, members } = publicCircle()
    const asked = joinCircle(circle, members, addr(2), 'Stranger', T0)
    const all = [...members, asked]
    // blindfold: invariant — only the circle's creator vouches for members;
    // otherwise a stranger could admit themselves
    expect(() => decideRequest(circle, all, addr(2), addr(2), 'approve', T0))
      .toThrow(/Only the person who started/)
  })

  it('keeps a declined person out and off the payout order', () => {
    const { circle, members } = publicCircle()
    const asked = joinCircle(circle, members, addr(2), 'Stranger', T0)
    const declined = decideRequest(circle, [...members, asked], addr(1), addr(2), 'decline', T0)
    // blindfold: invariant — a declined request holds no seat, and asking
    // again must not quietly re-enter them
    expect(declined.status).toBe('declined')
    expect(declined.position).toBe(0)
    expect(() => joinCircle(circle, [...members, declined], addr(2), 'Stranger', T0))
      .toThrow(/did not approve/)
  })

  it('lets the same person ask only once while it is pending', () => {
    const { circle, members } = publicCircle()
    const asked = joinCircle(circle, members, addr(2), 'Stranger', T0)
    // blindfold: invariant — a repeat request must not create a second record
    expect(() => joinCircle(circle, [...members, asked], addr(2), 'Stranger', T0))
      .toThrow(/already asked to join/)
  })

  it('never makes a pending request owe or collect a round', () => {
    const { circle, members } = publicCircle(4)
    const seated = [...members]
    // Two people admitted, then someone asks while a seat is still free.
    for (const i of [2, 3]) {
      const asked = joinCircle(circle, seated, addr(i), `M${i}`, T0)
      seated.push(decideRequest(circle, [...seated, asked], addr(1), addr(i), 'approve', T0))
    }
    const pending = joinCircle(circle, seated, addr(9), 'Latecomer', T0)
    const withPending = [...seated, pending]
    const lastAsk = joinCircle(circle, withPending, addr(4), 'M4', T0)
    const all = [...withPending, decideRequest(circle, [...withPending, lastAsk], addr(1), addr(4), 'approve', T0)]

    const { rounds } = activateCircle(circle, all, T0)
    const owed = roundObligations(rounds[0], all, [], T0)
    // blindfold: invariant — rounds and obligations are built from seat-holders
    // only, so an unapproved person is neither owed money nor asked for any
    expect(rounds).toHaveLength(4)
    expect(rounds.map(r => r.recipientAddress)).not.toContain(pending.address)
    expect(owed.map(o => o.member.address)).not.toContain(pending.address)
  })
})
