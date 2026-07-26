import { blake2b } from '@noble/hashes/blake2'

/**
 * Nimiq address encoding, server side.
 *
 * We need this for exactly one reason: when a user signs a login challenge the
 * wallet hands us a public key, and we have to prove that key belongs to the
 * address claiming the session. An address is the first 20 bytes of
 * Blake2b-256(publicKey), rendered in Nimiq's base32 alphabet.
 */

// Nimiq's base32 alphabet omits I, O, W and Z to survive being read aloud.
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

export function decodeAddress(userFriendly: string): Uint8Array | null {
  const body = userFriendly.replace(/\s+/g, '').toUpperCase()
  if (!/^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/.test(body))
    return null

  const payload = body.slice(4)
  let bits = 0
  let value = 0
  const out = new Uint8Array(20)
  let index = 0

  for (const char of payload) {
    const digit = ALPHABET.indexOf(char)
    if (digit < 0)
      return null
    value = (value << 5) | digit
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out[index++] = (value >> bits) & 0xFF
    }
  }

  return index === 20 ? out : null
}

/** Renders 20 address bytes as the user-friendly NQ.. form, checksum included. */
export function encodeAddress(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let base32 = ''

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      base32 += ALPHABET[(value >> bits) & 0x1F]
    }
  }
  if (bits > 0)
    base32 += ALPHABET[(value << (5 - bits)) & 0x1F]

  // IBAN-style check digits: shift "NQ00" to the end, map letters to numbers,
  // then 98 minus the remainder mod 97.
  const check = 98 - mod97(`${base32}NQ00`)
  return `NQ${check.toString().padStart(2, '0')}${base32}`
}

function mod97(input: string): number {
  let remainder = 0
  for (const char of input) {
    const code = char.charCodeAt(0)
    const mapped = code >= 65 && code <= 90 ? String(code - 55) : char
    for (const digit of mapped)
      remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder
}

export function addressFromPublicKey(publicKey: Uint8Array): Uint8Array {
  return blake2b(publicKey, { dkLen: 32 }).slice(0, 20)
}

export function publicKeyMatchesAddress(publicKey: Uint8Array, address: string): boolean {
  const claimed = decodeAddress(address)
  if (!claimed)
    return false
  const derived = addressFromPublicKey(publicKey)
  let diff = 0
  for (let i = 0; i < 20; i++)
    diff |= claimed[i] ^ derived[i]
  return diff === 0
}

export function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!/^[0-9a-f]*$/i.test(clean) || clean.length % 2 !== 0)
    return null
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return bytes
}
