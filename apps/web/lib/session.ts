import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { normalizeAddress } from '@kolo/core'
import { cookies } from 'next/headers'

const COOKIE = 'kolo_session'
const CHALLENGE_COOKIE = 'kolo_challenge'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (value)
    return value
  if (process.env.NODE_ENV === 'production')
    throw new Error('SESSION_SECRET must be set in production')
  // Dev only: a per-process secret. Restarting the dev server logs you out,
  // which is a fair trade for not having to configure anything to run locally.
  return devSecret
}

const devSecret = randomBytes(32).toString('hex')

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function seal(value: object): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function unseal<T>(token: string | undefined): T | null {
  if (!token)
    return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(sign(payload), signature))
    return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as T
  }
  catch {
    return null
  }
}

export interface Session {
  address: string
  displayName: string
  expiresAt: number
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies()
  const session = unseal<Session>(store.get(COOKIE)?.value)
  if (!session || session.expiresAt < Date.now())
    return null
  return session
}

export async function writeSession(address: string, displayName: string): Promise<Session> {
  const session: Session = {
    address: normalizeAddress(address),
    displayName,
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  }
  const store = await cookies()
  store.set(COOKIE, seal(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
  return session
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}

/**
 * A login challenge is single-use and short-lived, so a signature captured from
 * one login cannot be replayed into another.
 */
export async function issueChallenge(address: string): Promise<string> {
  const nonce = randomBytes(16).toString('hex')
  const message = `Kolo login\naddress: ${normalizeAddress(address)}\nnonce: ${nonce}`
  const store = await cookies()
  store.set(CHALLENGE_COOKIE, seal({ message, expiresAt: Date.now() + 5 * 60_000 }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 300,
  })
  return message
}

export async function consumeChallenge(): Promise<string | null> {
  const store = await cookies()
  const challenge = unseal<{ message: string, expiresAt: number }>(store.get(CHALLENGE_COOKIE)?.value)
  store.delete(CHALLENGE_COOKIE)
  if (!challenge || challenge.expiresAt < Date.now())
    return null
  return challenge.message
}
