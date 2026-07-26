import type { Cadence, Currency } from './types'

export const LUNA_PER_NIM = 100_000
export const USDT_DECIMALS = 6

export const CURRENCY_META: Record<Currency, { decimals: number, symbol: string, label: string }> = {
  NIM: { decimals: 5, symbol: '⌁', label: 'NIM' },
  USDT: { decimals: 6, symbol: '$', label: 'USDT' },
}

/** Parse a human amount ("500", "12.5") into the currency's smallest unit. */
export function toBaseUnits(input: string | number, currency: Currency): string {
  const { decimals } = CURRENCY_META[currency]
  const text = String(input).trim()
  if (!/^\d+(\.\d+)?$/.test(text))
    throw new Error(`Not a valid amount: ${input}`)

  const [whole, fraction = ''] = text.split('.')
  if (fraction.length > decimals)
    throw new Error(`${currency} supports at most ${decimals} decimal places`)

  const padded = fraction.padEnd(decimals, '0')
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0')).toString()
}

/** Format a smallest-unit amount for display. Trims trailing zeros. */
export function fromBaseUnits(amount: string, currency: Currency): string {
  const { decimals } = CURRENCY_META[currency]
  const value = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)
  const whole = value / divisor
  const fraction = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '')
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

export function formatAmount(amount: string, currency: Currency): string {
  return `${CURRENCY_META[currency].symbol} ${fromBaseUnits(amount, currency)}`
}

/** The full pot a recipient collects in one round: everyone else's contribution. */
export function potTotal(amount: string, seats: number): string {
  return (BigInt(amount) * BigInt(Math.max(seats - 1, 0))).toString()
}

export const CADENCE_DAYS: Record<Cadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'every week',
  biweekly: 'every 2 weeks',
  monthly: 'every month',
}

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}
