/** Unambiguous alphabet: no 0/O, no 1/I/L. Codes get read aloud and retyped. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

export function newId(prefix: string): string {
  const bytes = randomBytes(16)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${hex}`
}

/** Short, shareable, case-insensitive circle code. */
export function newCode(length = 6): string {
  const bytes = randomBytes(length)
  return Array.from(bytes).map(b => ALPHABET[b % ALPHABET.length]).join('')
}

export function newNonce(): string {
  const bytes = randomBytes(24)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function normalizeCode(code: string): string {
  return code.replace(/[^0-9a-z]/gi, '').toUpperCase()
}
