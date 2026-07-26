import type { Cadence, Contribution, Currency, NimiqNetwork, SoloBox } from './types'
import { normalizeAddress, sameAddress } from './address'
import { newCode, newId } from './ids'
import { addDays, CADENCE_DAYS } from './money'

/**
 * Solo box: a savings box for one person.
 *
 * It exists because a rotating circle needs other people, and the first thing a
 * new user has is nobody. A solo box gives them a complete, satisfying flow on
 * their own — same payment rail, same on-chain verification, same streak
 * mechanics — while they invite the friends who turn it into a circle.
 *
 * The money goes to an address the owner controls. Kolo is not a counterparty
 * here any more than it is in a circle.
 */

export class SoloError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'SoloError'
  }
}

export interface CreateBoxInput {
  ownerAddress: string
  vaultAddress: string
  name: string
  currency: Currency
  network: NimiqNetwork
  amount: string
  cadence: Cadence
  periods: number
  now?: string
}

export function createSoloBox(input: CreateBoxInput): SoloBox {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 40)
    throw new SoloError('Give the box a name between 2 and 40 characters.', 'bad_name')

  if (!Number.isInteger(input.periods) || input.periods < 2 || input.periods > 52)
    throw new SoloError('A box runs for between 2 and 52 periods.', 'bad_periods')

  if (BigInt(input.amount) <= 0n)
    throw new SoloError('The amount has to be more than zero.', 'bad_amount')

  if (sameAddress(input.ownerAddress, input.vaultAddress))
    throw new SoloError('Save into a different address than the one you pay from.', 'same_address')

  const now = input.now ?? new Date().toISOString()
  return {
    id: newId('box'),
    code: newCode(),
    ownerAddress: normalizeAddress(input.ownerAddress),
    name,
    currency: input.currency,
    network: input.network,
    amount: input.amount,
    cadence: input.cadence,
    periods: input.periods,
    vaultAddress: normalizeAddress(input.vaultAddress),
    status: 'active',
    createdAt: now,
    completedAt: null,
  }
}

export interface SoloPeriod {
  index: number
  opensAt: string
  status: 'saved' | 'pending' | 'open' | 'missed' | 'upcoming'
  contribution: Contribution | null
}

export function soloPeriods(
  box: SoloBox,
  contributions: Contribution[],
  now = new Date().toISOString(),
): SoloPeriod[] {
  const days = CADENCE_DAYS[box.cadence]
  const current = new Date(now).getTime()

  return Array.from({ length: box.periods }, (_, i) => {
    const index = i + 1
    const opensAt = addDays(box.createdAt, i * days)
    const closesAt = addDays(box.createdAt, index * days)
    const contribution = contributions.find(c => c.roundIndex === index) ?? null

    let status: SoloPeriod['status']
    if (contribution?.status === 'verified')
      status = 'saved'
    else if (contribution?.status === 'submitted')
      status = 'pending'
    else if (current < new Date(opensAt).getTime())
      status = 'upcoming'
    else if (current > new Date(closesAt).getTime())
      status = 'missed'
    else
      status = 'open'

    return { index, opensAt, status, contribution }
  })
}

/** The period the user should pay right now, or null when nothing is due. */
export function openPeriod(periods: SoloPeriod[]): SoloPeriod | null {
  return periods.find(p => p.status === 'open') ?? null
}

/** Consecutive saved periods, counted backwards from the most recent one. */
export function soloStreak(periods: SoloPeriod[]): number {
  let streak = 0
  for (const period of periods) {
    if (period.status === 'saved')
      streak += 1
    else if (period.status === 'missed')
      streak = 0
    else break
  }
  return streak
}

export function soloSaved(box: SoloBox, periods: SoloPeriod[]): string {
  const saved = periods.filter(p => p.status === 'saved').length
  return (BigInt(box.amount) * BigInt(saved)).toString()
}

export function soloTarget(box: SoloBox): string {
  return (BigInt(box.amount) * BigInt(box.periods)).toString()
}

export function isBoxComplete(periods: SoloPeriod[]): boolean {
  return periods.every(p => p.status === 'saved')
}
