import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha2'
import { describe, expect, it } from 'vitest'
import { addressFromPublicKey, decodeAddress, encodeAddress } from './nimiq-address'
import { verifyNimiqSignature } from './signature'

/**
 * These tests stand in for the wallet. They generate a real Ed25519 key, derive
 * the Nimiq address it maps to, and sign a challenge — which is exactly what
 * Nimiq Pay does, minus the phone.
 */

const PRIVATE_KEY = new Uint8Array(32).fill(7)
const PUBLIC_KEY = ed25519.getPublicKey(PRIVATE_KEY)
const ADDRESS = encodeAddress(addressFromPublicKey(PUBLIC_KEY))
const MESSAGE = 'Kolo login\naddress: NQXX\nnonce: abc123'

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function signRaw(payload: Uint8Array): string {
  return hex(ed25519.sign(payload, PRIVATE_KEY))
}

describe('address encoding', () => {
  it('round-trips through the user-friendly form', () => {
    const bytes = addressFromPublicKey(PUBLIC_KEY)
    // blindfold: invariant — encode and decode are inverses, or every address comparison is wrong
    expect(decodeAddress(ADDRESS)).toEqual(bytes)
  })

  it('produces a 36-character NQ address', () => {
    // blindfold: standard — Nimiq addresses are NQ + 2 check digits + 32 base32 characters
    expect(ADDRESS).toMatch(/^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/)
  })

  it('rejects an address whose body is not valid base32', () => {
    // blindfold: invariant — I, O, W and Z are not in Nimiq's alphabet
    expect(decodeAddress('NQ07 IIII IIII IIII IIII IIII IIII IIII IIII')).toBe(null)
  })
})

describe('verifyNimiqSignature', () => {
  it('accepts a signature over the raw message', () => {
    const signature = signRaw(new TextEncoder().encode(MESSAGE))
    // blindfold: invariant — a valid signature from the address owner authenticates them
    expect(verifyNimiqSignature({
      message: MESSAGE,
      publicKey: hex(PUBLIC_KEY),
      signature,
      address: ADDRESS,
    })).toBe(true)
  })

  it('accepts the prefixed-and-hashed framing the Nimiq stack uses', () => {
    const raw = new TextEncoder().encode(MESSAGE)
    const prefix = new TextEncoder().encode(`\x16Nimiq Signed Message:\n${raw.length}`)
    const framed = new Uint8Array(prefix.length + raw.length)
    framed.set(prefix)
    framed.set(raw, prefix.length)

    // blindfold: invariant — signature.ts accepts every framing the wallet may apply
    expect(verifyNimiqSignature({
      message: MESSAGE,
      publicKey: hex(PUBLIC_KEY),
      signature: signRaw(sha256(framed)),
      address: ADDRESS,
    })).toBe(true)
  })

  it('rejects a signature over a different message', () => {
    const signature = signRaw(new TextEncoder().encode('some other challenge'))
    // blindfold: invariant — a signature is bound to its challenge, so it cannot be replayed
    expect(verifyNimiqSignature({
      message: MESSAGE,
      publicKey: hex(PUBLIC_KEY),
      signature,
      address: ADDRESS,
    })).toBe(false)
  })

  it('rejects a valid signature claiming somebody else’s address', () => {
    const impostor = ed25519.getPublicKey(new Uint8Array(32).fill(9))
    const victim = encodeAddress(addressFromPublicKey(impostor))
    const signature = signRaw(new TextEncoder().encode(MESSAGE))

    // blindfold: invariant — the public key must hash to the claimed address, or
    // anyone could sign with a throwaway key and take over an account
    expect(verifyNimiqSignature({
      message: MESSAGE,
      publicKey: hex(PUBLIC_KEY),
      signature,
      address: victim,
    })).toBe(false)
  })

  it('rejects a malformed signature', () => {
    // blindfold: invariant — length is checked before any curve work
    expect(verifyNimiqSignature({
      message: MESSAGE,
      publicKey: hex(PUBLIC_KEY),
      signature: 'ff'.repeat(32),
      address: ADDRESS,
    })).toBe(false)
  })

  it('rejects a public key that is not 32 bytes', () => {
    // blindfold: invariant — an Ed25519 public key is exactly 32 bytes
    expect(verifyNimiqSignature({
      message: MESSAGE,
      publicKey: 'ab'.repeat(16),
      signature: signRaw(new TextEncoder().encode(MESSAGE)),
      address: ADDRESS,
    })).toBe(false)
  })
})
