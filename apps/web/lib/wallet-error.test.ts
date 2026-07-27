import { describe, expect, it } from 'vitest'
import { describeWalletError, isCancellation } from './wallet-error'

describe('describeWalletError', () => {
  it('never renders an object as [object Object]', () => {
    // The regression this module exists for: a user tried to send money, the
    // wallet refused, and the screen said "[object Object]".
    const shapes: unknown[] = [
      { error: { type: 'error', message: 'Insufficient funds' } },
      { code: -32000, message: 'Insufficient funds' },
      { message: 'Insufficient funds' },
      { data: { message: 'Insufficient funds' } },
      { error: 'Insufficient funds' },
      { someUnknownField: 42 },
      {},
      Object.create(null),
    ]

    for (const shape of shapes)
      expect(describeWalletError(shape)).not.toContain('[object Object]')
  })

  it('reads the message out of the SDK error envelope', () => {
    const envelope = { error: { type: 'error', message: 'Insufficient funds' } }
    // blindfold: doc — @nimiq/mini-app-sdk provider.d.ts declares `ErrorResponse` as `{ error: { type: string, message: string } }`, so `message` carries the reason
    expect(describeWalletError(envelope)).toBe('Insufficient funds')
  })

  it('reads an EIP-1193 style rejection', () => {
    const rejection = { code: 4001, message: 'User rejected the request' }
    // blindfold: standard — EIP-1193 ProviderRpcError puts the human-readable reason in `message` alongside numeric `code` (4001 = user rejected)
    expect(describeWalletError(rejection)).toBe('User rejected the request')
  })

  it('digs through nested envelopes', () => {
    const nested = { error: { data: { message: 'Fee too low' } } }
    // blindfold: contract — ENVELOPE_KEYS declares `error` and `data` as wrappers to unwrap before searching for a message field
    expect(describeWalletError(nested)).toBe('Fee too low')
  })

  it('prefers a real message over a type label', () => {
    const both = { type: 'error', message: 'Address is invalid' }
    // blindfold: contract — MESSAGE_KEYS is ordered `message` before `type`, so the specific reason wins over the generic label
    expect(describeWalletError(both)).toBe('Address is invalid')
  })

  it('falls back to the type when there is no message', () => {
    const typeOnly = { error: { type: 'PermissionDeniedError' } }
    // blindfold: contract — `type` is last in MESSAGE_KEYS, used only when nothing better exists; Nimiq's PermissionDeniedError arrives in this shape
    expect(describeWalletError(typeOnly)).toBe('PermissionDeniedError')
  })

  it('serialises an unrecognised shape rather than losing it', () => {
    // blindfold: contract — JSON.stringify is the declared last resort, so an unfamiliar payload still reaches the user and can be pasted into a bug report
    expect(describeWalletError({ someUnknownField: 42 })).toBe('{"someUnknownField":42}')
  })

  it('unwraps Error instances', () => {
    // blindfold: contract — an Error is described by its `message`
    expect(describeWalletError(new Error('boom'))).toBe('boom')
  })

  it('returns empty for values carrying no information', () => {
    // blindfold: contract — '' is the declared signal for "no reason given", which is what lets the caller substitute its own wording
    expect(describeWalletError(null)).toBe('')
    expect(describeWalletError(undefined)).toBe('')
    expect(describeWalletError({})).toBe('')
    // blindfold: contract — describeWalletError trims strings, so whitespace-only text carries no information and collapses to the same empty signal
    expect(describeWalletError('   ')).toBe('')
  })

  it('survives a self-referencing object', () => {
    const circular: Record<string, unknown> = { message: '' }
    circular.cause = circular
    expect(() => describeWalletError(circular)).not.toThrow()
  })

  it('keeps plain strings intact', () => {
    // blindfold: contract — a string is already the message and passes through unchanged
    expect(describeWalletError('Insufficient funds')).toBe('Insufficient funds')
  })
})

describe('isCancellation', () => {
  it('recognises the ways a wallet says the user backed out', () => {
    // blindfold: doc — CLAUDE.md §4.4 requires PermissionDeniedError (user cancelled) to be handled as a normal outcome, never a red crash screen
    const refusals = [
      'User rejected the request',
      'PermissionDeniedError',
      'Permission denied',
      'The user cancelled the operation',
      'Request aborted',
    ]
    for (const refusal of refusals)
      expect(isCancellation(refusal)).toBe(true)
  })

  it('does not treat a genuine failure as a cancellation', () => {
    // blindfold: invariant — misreading a real failure as "you cancelled" would hide why a payment did not go through; these must stay failures
    expect(isCancellation('Insufficient funds')).toBe(false)
    expect(isCancellation('Fee too low')).toBe(false)
    expect(isCancellation('Address is invalid')).toBe(false)
  })
})
