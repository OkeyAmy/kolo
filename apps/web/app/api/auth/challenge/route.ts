import { isNimiqAddress, normalizeAddress } from '@kolo/core'
import { z } from 'zod'
import { apiError, badRequest } from '@/lib/http'
import { issueChallenge } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({ address: z.string().min(36) })

export async function POST(request: Request): Promise<Response> {
  try {
    const { address } = Body.parse(await request.json())
    if (!isNimiqAddress(address))
      return badRequest('That does not look like a Nimiq address.')

    const message = await issueChallenge(normalizeAddress(address))
    return Response.json({ message })
  }
  catch (error) {
    return apiError(error)
  }
}
