/**
 * Turning whatever Nimiq Pay rejected with into something a person can read.
 *
 * The mini-app SDK forwards the wallet's response verbatim, and that response
 * is untyped: it can be an Error, an `{ error: { type, message } }` envelope, an
 * EIP-1193-ish `{ code, message }`, or a bare object with none of those. Calling
 * `String()` on the last case produces "[object Object]", which is worse than
 * useless in front of a user who just failed to send money.
 *
 * Kept free of SDK imports so it stays unit-testable.
 */

export type WalletErrorKind = 'cancelled' | 'unavailable' | 'failed'

/** Wallet vocabulary for "the user said no", which is a normal outcome. */
const CANCELLED = /permission|denied|reject|cancel|abort|dismiss|user closed/i

const ENVELOPE_KEYS = ['error', 'data', 'cause', 'reason'] as const
const MESSAGE_KEYS = ['message', 'reason', 'description', 'type'] as const

/**
 * Best available human-readable text for an unknown thrown value.
 * Returns '' when there is genuinely nothing to show, so callers can tell the
 * difference between "no reason given" and a reason they should display.
 */
export function describeWalletError(value: unknown, seen = new Set<unknown>()): string {
  if (value == null)
    return ''
  if (typeof value === 'string')
    return value.trim()
  if (value instanceof Error)
    return value.message
  if (typeof value !== 'object')
    return String(value)

  // Guards against an object graph that points back at itself.
  if (seen.has(value))
    return ''
  seen.add(value)

  const bag = value as Record<string, unknown>

  // Unwrap one layer at a time; the useful message is usually nested.
  for (const key of ENVELOPE_KEYS) {
    const inner = bag[key]
    if (inner != null && typeof inner === 'object') {
      const found = describeWalletError(inner, seen)
      if (found)
        return found
    }
  }

  for (const key of MESSAGE_KEYS) {
    const value = bag[key]
    if (typeof value === 'string' && value.trim())
      return value.trim()
  }

  // Nothing recognisable. Serialising beats "[object Object]" — an unfamiliar
  // shape is still a clue, and it is what gets pasted into a bug report.
  try {
    const json = JSON.stringify(value)
    if (json && json !== '{}' && json !== 'null')
      return json
  }
  catch {
    // Unserialisable. Fall through to the caller's generic wording.
  }

  return ''
}

export function isCancellation(detail: string): boolean {
  return CANCELLED.test(detail)
}
