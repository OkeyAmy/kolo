import type { Repository } from '../store'
import { MemoryRepository } from '../store'
import { PgRepository } from './pg'

export { PgRepository } from './pg'

let cached: Repository | null = null

/**
 * One repository per process. Postgres when DATABASE_URL is set, otherwise an
 * in-memory store so the app runs end to end with zero setup — which matters
 * when the first thing a new contributor does is `pnpm dev` on a phone-tethered
 * laptop with no cloud accounts.
 */
export function getRepository(): Repository {
  if (cached)
    return cached
  const url = process.env.DATABASE_URL
  cached = url ? new PgRepository(url) : new MemoryRepository()
  return cached
}

export function isPersistent(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
