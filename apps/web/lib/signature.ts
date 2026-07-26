import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha2'
import { hexToBytes, publicKeyMatchesAddress } from './nimiq-address'

/**
 * Verifies a message signature produced by Nimiq Pay's `sign()`.
 *
 * Two things have to hold before we accept a signature:
 *
 *   1. the signature verifies under the supplied Ed25519 public key, and
 *   2. that public key hashes to the address the caller is claiming.
 *
 * Without (2) anyone could sign a challenge with a throwaway key and claim
 * somebody else's address.
 *
 * Nimiq Pay applies its own framing before signing (the wallet, not us, decides
 * the exact bytes). Rather than hard-code one framing and have logins silently
 * fail if it ever changes, we check the signature against every framing the
 * Nimiq stack has used. All of them require the private key, so accepting any
 * one of them is equally strong — this widens compatibility, not the trust
 * boundary.
 */

const PREFIX = '\x16Nimiq Signed Message:\n'

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function candidates(message: string): Uint8Array[] {
  const raw = encode(message)
  const framed = concat(encode(`${PREFIX}${raw.length}`), raw)
  return [sha256(framed), framed, raw, sha256(raw)]
}

export interface SignatureCheck {
  message: string
  publicKey: string
  signature: string
  address: string
}

export function verifyNimiqSignature(check: SignatureCheck): boolean {
  const publicKey = hexToBytes(check.publicKey)
  const signature = hexToBytes(check.signature)

  if (!publicKey || publicKey.length !== 32)
    return false
  if (!signature || signature.length !== 64)
    return false
  if (!publicKeyMatchesAddress(publicKey, check.address))
    return false

  return candidates(check.message).some((payload) => {
    try {
      return ed25519.verify(signature, payload, publicKey)
    }
    catch {
      return false
    }
  })
}
