import type { ChainTransaction, Contribution } from './types'
import { describe, expect, it } from 'vitest'
import { encodeMemoHex, parseMemo } from './memo'
import { toBaseUnits } from './money'
import { applyMatch, matchTransaction } from './verify'

const FROM = 'NQ21ABCDEFGH23456789ABCDEFGH23456789'
const TO = 'NQ22ABCDEFGH23456789ABCDEFGH23456789'
const MEMO = 'kolo:AB2C4D:r1'
const AMOUNT = toBaseUnits('500', 'NIM')

function tx(overrides: Partial<ChainTransaction> = {}): ChainTransaction {
  return {
    hash: 'f177bc9640a2501138ccf7d96bb6322d4d341314d93d4c1972cb15a24ad43310',
    // the RPC returns addresses spaced in groups of four; the wallet does not
    from: 'NQ21 ABCD EFGH 2345 6789 ABCD EFGH 2345 6789',
    to: 'NQ22 ABCD EFGH 2345 6789 ABCD EFGH 2345 6789',
    value: Number(AMOUNT),
    recipientData: encodeMemoHex(MEMO),
    blockNumber: 57170880,
    timestamp: Date.parse('2026-08-01T12:00:00.000Z'),
    confirmations: 12,
    networkId: 24,
    ...overrides,
  }
}

const expectation = {
  fromAddress: FROM,
  toAddress: TO,
  amount: AMOUNT,
  memo: MEMO,
  notBefore: '2026-08-01T10:00:00.000Z',
}

describe('matchTransaction', () => {
  it('matches across the wallet and RPC address spacing conventions', () => {
    const match = matchTransaction(expectation, [tx()])
    // blindfold: invariant — address comparison is whitespace-insensitive, see address.ts
    expect(match?.transaction.hash).toBe(tx().hash)
    expect(match?.confirmed).toBe(true)
  })

  it('rejects a payment to the wrong recipient', () => {
    const wrong = tx({ to: 'NQ99 ABCD EFGH 2345 6789 ABCD EFGH 2345 6789' })
    // blindfold: invariant — a contribution only counts against the round's own recipient
    expect(matchTransaction(expectation, [wrong])).toBe(null)
  })

  it('rejects a short payment', () => {
    const short = tx({ value: Number(toBaseUnits('499', 'NIM')) })
    // blindfold: invariant — the amount must match exactly; partial payments do not settle a round
    expect(matchTransaction(expectation, [short])).toBe(null)
  })

  it('rejects an overpayment just as firmly', () => {
    const over = tx({ value: Number(toBaseUnits('501', 'NIM')) })
    // blindfold: invariant — exact-amount matching, so one transfer can never satisfy two obligations
    expect(matchTransaction(expectation, [over])).toBe(null)
  })

  it('rejects a payment carrying another round’s memo', () => {
    const otherRound = tx({ recipientData: encodeMemoHex('kolo:AB2C4D:r2') })
    // blindfold: invariant — the memo binds a transfer to one specific round
    expect(matchTransaction(expectation, [otherRound])).toBe(null)
  })

  it('rejects a payment with no memo at all', () => {
    // blindfold: invariant — an unmemoed transfer is indistinguishable from an unrelated payment
    expect(matchTransaction(expectation, [tx({ recipientData: '' })])).toBe(null)
  })

  it('ignores a transaction that predates the obligation', () => {
    const old = tx({ timestamp: Date.parse('2026-07-01T12:00:00.000Z') })
    // blindfold: invariant — an old transfer cannot be replayed to satisfy a new round
    expect(matchTransaction(expectation, [old])).toBe(null)
  })

  it('allows a minute of clock skew around the round opening', () => {
    const early = tx({ timestamp: Date.parse('2026-08-01T09:59:30.000Z') })
    // blindfold: invariant — verify.ts allows 60s of skew so an instant payment is not rejected
    expect(matchTransaction(expectation, [early])?.transaction.hash).toBe(tx().hash)
  })

  it('will not reuse a transaction already claimed by another contribution', () => {
    const used = new Set([tx().hash])
    // blindfold: invariant — one on-chain transfer settles at most one obligation
    expect(matchTransaction(expectation, [tx()], used)).toBe(null)
  })

  it('reports an unconfirmed match as not yet confirmed', () => {
    const pending = tx({ confirmations: 0 })
    const match = matchTransaction(expectation, [pending])
    // blindfold: invariant — MIN_CONFIRMATIONS gates promotion to verified
    expect(match?.confirmed).toBe(false)
  })

  it('picks the earliest candidate when a member pays twice', () => {
    const later = tx({ hash: 'bbbb', timestamp: Date.parse('2026-08-02T12:00:00.000Z') })
    const match = matchTransaction(expectation, [later, tx()])
    // blindfold: invariant — deterministic selection, oldest first, so re-runs are stable
    expect(match?.transaction.hash).toBe(tx().hash)
  })
})

describe('applyMatch', () => {
  const contribution: Contribution = {
    id: 'con_1',
    circleId: 'cir_1',
    boxId: null,
    roundIndex: 1,
    fromAddress: FROM,
    toAddress: TO,
    amount: AMOUNT,
    currency: 'NIM',
    network: 'test',
    memo: MEMO,
    txHash: null,
    status: 'submitted',
    blockNumber: null,
    submittedAt: '2026-08-01T11:00:00.000Z',
    verifiedAt: null,
  }

  it('promotes a submitted contribution and records the chain evidence', () => {
    const match = matchTransaction(expectation, [tx()])
    const updated = applyMatch(contribution, match, '2026-08-01T12:00:05.000Z')
    // blindfold: invariant — verification stores the hash and height that justify it
    expect(updated).toMatchObject({
      status: 'verified',
      txHash: tx().hash,
      blockNumber: 57170880,
      verifiedAt: '2026-08-01T12:00:05.000Z',
    })
  })

  it('leaves the contribution alone when nothing matched', () => {
    // blindfold: invariant — no chain evidence means no state change, ever
    expect(applyMatch(contribution, null)).toBe(null)
  })

  it('leaves the contribution alone when the match is unconfirmed', () => {
    const match = matchTransaction(expectation, [tx({ confirmations: 0 })])
    // blindfold: invariant — an unconfirmed transaction is not evidence
    expect(applyMatch(contribution, match)).toBe(null)
  })
})

describe('parseMemo', () => {
  it('round-trips a circle memo', () => {
    // blindfold: contract — memo grammar kolo:<code>:r<index> defined in memo.ts
    expect(parseMemo('kolo:AB2C4D:r7')).toEqual({ kind: 'circle', code: 'ab2c4d', index: 7 })
  })

  it('round-trips a solo memo', () => {
    // blindfold: contract — memo grammar kolo:s<code>:p<index> defined in memo.ts
    expect(parseMemo('kolo:sAB2C4D:p3')).toEqual({ kind: 'solo', code: 'ab2c4d', index: 3 })
  })

  it('returns null for anything else', () => {
    // blindfold: invariant — unrelated transfers must not parse as Kolo activity
    expect(parseMemo('thanks for lunch')).toBe(null)
  })
})
