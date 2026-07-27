/**
 * End-to-end smoke test against a running Kolo server.
 *
 *   pnpm dev            # in one terminal
 *   node scripts/smoke.mjs [baseUrl]
 *
 * It stands in for three people with three phones: each one gets a real
 * Ed25519 keypair, derives its Nimiq address the same way the wallet does, and
 * signs the real login challenge. Everything after that is the same HTTP the
 * mini app makes.
 *
 * The one thing it cannot do is put a transaction on the Nimiq chain, so
 * contributions are expected to stay `submitted` — that is the correct
 * behaviour and the test asserts it. A payment Kolo cannot find on chain must
 * never be counted as paid.
 */

import process from 'node:process'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2'
import { sha256 } from '@noble/hashes/sha2'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

let failures = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`)
  }
  else {
    failures += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function hex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function mod97(input) {
  let remainder = 0
  for (const char of input) {
    const code = char.charCodeAt(0)
    const mapped = code >= 65 && code <= 90 ? String(code - 55) : char
    for (const digit of mapped)
      remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder
}

function encodeAddress(bytes) {
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
  const checkDigits = 98 - mod97(`${base32}NQ00`)
  return `NQ${String(checkDigits).padStart(2, '0')}${base32}`
}

function makeWallet(seed) {
  const privateKey = new Uint8Array(32).fill(seed)
  const publicKey = ed25519.getPublicKey(privateKey)
  const address = encodeAddress(blake2b(publicKey, { dkLen: 32 }).slice(0, 20))
  return {
    address,
    publicKey: hex(publicKey),
    cookies: new Map(),
    sign(message) {
      // Mirrors the framing the Nimiq stack applies before signing.
      const raw = new TextEncoder().encode(message)
      const prefix = new TextEncoder().encode(`\x16Nimiq Signed Message:\n${raw.length}`)
      const framed = new Uint8Array(prefix.length + raw.length)
      framed.set(prefix)
      framed.set(raw, prefix.length)
      return hex(ed25519.sign(sha256(framed), privateKey))
    },
  }
}

async function call(wallet, method, path, body) {
  const cookieHeader = [...wallet.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';')
    const index = pair.indexOf('=')
    wallet.cookies.set(pair.slice(0, index), pair.slice(index + 1))
  }

  const payload = await response.json().catch(() => ({}))
  return { status: response.status, body: payload }
}

async function login(wallet, displayName) {
  const challenge = await call(wallet, 'POST', '/api/auth/challenge', { address: wallet.address })
  if (challenge.status !== 200)
    throw new Error(`challenge failed: ${JSON.stringify(challenge.body)}`)

  const verified = await call(wallet, 'POST', '/api/auth/verify', {
    address: wallet.address,
    publicKey: wallet.publicKey,
    signature: wallet.sign(challenge.body.message),
    displayName,
  })
  if (verified.status !== 200)
    throw new Error(`verify failed: ${JSON.stringify(verified.body)}`)
  return verified.body
}

console.log(`Kolo smoke test against ${BASE}\n`)

const ada = makeWallet(11)
const bem = makeWallet(22)
const chi = makeWallet(33)

console.log('Wallet signature login')
const adaSession = await login(ada, 'Ada')
check('Ada logs in with a wallet signature', adaSession.displayName === 'Ada')
await login(bem, 'Bem')
await login(chi, 'Chi')
check('three sessions established', true)

console.log('\nRejects a forged login')
const forged = makeWallet(44)
const challenge = await call(forged, 'POST', '/api/auth/challenge', { address: forged.address })
const badLogin = await call(forged, 'POST', '/api/auth/verify', {
  address: forged.address,
  publicKey: ada.publicKey,
  signature: ada.sign(challenge.body.message),
  displayName: 'Impostor',
})
check('a signature from another key is refused', badLogin.status === 400, JSON.stringify(badLogin.body))

console.log('\nCreating and filling a circle')
const created = await call(ada, 'POST', '/api/circles', {
  name: 'Smoke circle',
  currency: 'NIM',
  amount: '500',
  cadence: 'weekly',
  seats: 3,
  visibility: 'public',
})
check('circle created', created.status === 200, JSON.stringify(created.body))
const circleId = created.body.id

const joinBem = await call(bem, 'POST', `/api/circles/${circleId}/join`, {})
check('second member joins at seat 2', joinBem.body.position === 2, JSON.stringify(joinBem.body))

const joinTwice = await call(bem, 'POST', `/api/circles/${circleId}/join`, {})
check('the same member cannot join twice', joinTwice.status === 400)

const joinChi = await call(chi, 'POST', `/api/circles/${circleId}/join`, {})
check('third member fills the circle', joinChi.body.position === 3, JSON.stringify(joinChi.body))

const joinFull = await call(forged, 'POST', `/api/circles/${circleId}/join`, {})
check('a fourth member is refused', joinFull.status === 400 || joinFull.status === 401)

console.log('\nPaying a round')
const pay = await call(bem, 'POST', `/api/circles/${circleId}/contributions`, { roundIndex: 1 })
check('contribution accepted', pay.status === 200, JSON.stringify(pay.body))
check(
  'stays unverified because nothing matches on chain',
  pay.body.status === 'submitted',
  `got ${pay.body.status}`,
)

const payAsRecipient = await call(ada, 'POST', `/api/circles/${circleId}/contributions`, { roundIndex: 1 })
check('the round recipient cannot pay into their own pot', payAsRecipient.status === 400)

const payFutureRound = await call(bem, 'POST', `/api/circles/${circleId}/contributions`, { roundIndex: 3 })
check('a round that has not opened cannot be paid', payFutureRound.status === 400)

console.log('\nEmergency swap (two signatures)')
const prepared = await call(chi, 'GET', `/api/circles/${circleId}/swaps?targetPosition=2`)
check('swap payload issued', prepared.status === 200, JSON.stringify(prepared.body))

const requested = await call(chi, 'POST', `/api/circles/${circleId}/swaps`, {
  targetPosition: 2,
  reason: 'school fees',
  nonce: prepared.body.nonce,
  publicKey: chi.publicKey,
  signature: chi.sign(prepared.body.message),
})
check('swap requested with the requester signature', requested.status === 200, JSON.stringify(requested.body))
const swapId = requested.body.id

const wrongSigner = await call(ada, 'POST', `/api/swaps/${swapId}`, {
  action: 'accept',
  publicKey: ada.publicKey,
  signature: ada.sign((await call(ada, 'GET', `/api/swaps/${swapId}`)).body.message),
})
check('a third party cannot accept the swap', wrongSigner.status === 400, JSON.stringify(wrongSigner.body))

const toSign = await call(bem, 'GET', `/api/swaps/${swapId}`)
const accepted = await call(bem, 'POST', `/api/swaps/${swapId}`, {
  action: 'accept',
  publicKey: bem.publicKey,
  signature: bem.sign(toSign.body.message),
})
check('counterparty signature applies the swap', accepted.body.status === 'applied', JSON.stringify(accepted.body))

const replay = await call(bem, 'POST', `/api/swaps/${swapId}`, {
  action: 'accept',
  publicKey: bem.publicKey,
  signature: bem.sign(toSign.body.message),
})
check('the swap cannot be replayed', replay.status === 400)

console.log('\nHealth')
const health = await call(ada, 'GET', '/api/health')
check('health reports the chain reachable', health.body.checks?.chain === 'ok', JSON.stringify(health.body))

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
