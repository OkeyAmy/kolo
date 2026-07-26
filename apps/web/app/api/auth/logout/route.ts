import { clearSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(): Promise<Response> {
  await clearSession()
  return Response.json({ ok: true })
}
