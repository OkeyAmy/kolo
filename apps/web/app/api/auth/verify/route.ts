import { defaultDisplayName, formatAddress, isNimiqAddress, normalizeAddress } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { z } from 'zod'
import { apiError, badRequest } from '@/lib/http'
import { consumeChallenge, writeSession } from '@/lib/session'
import { verifyNimiqSignature } from '@/lib/signature'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  address: z.string().min(36),
  publicKey: z.string().min(64),
  signature: z.string().min(128),
  displayName: z.string().trim().min(1).max(24).optional(),
})

export async function POST(request: Request): Promise<Response> {
  try {
    const body = Body.parse(await request.json())
    if (!isNimiqAddress(body.address))
      return badRequest('That does not look like a Nimiq address.')

    const message = await consumeChallenge()
    if (!message)
      return badRequest('That login request expired. Try again.', 'challenge_expired')

    const address = normalizeAddress(body.address)
    if (!message.includes(address))
      return badRequest('That signature was for a different address.', 'address_mismatch')

    const valid = verifyNimiqSignature({
      message,
      publicKey: body.publicKey,
      signature: body.signature,
      address,
    })
    if (!valid)
      return badRequest('That signature did not check out.', 'bad_signature')

    const repo = getRepository()
    const existing = await repo.getProfile(address)
    const displayName = body.displayName
      ?? existing?.displayName
      ?? defaultDisplayName(address)

    await repo.upsertProfile({
      address,
      displayName,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    })

    await writeSession(address, displayName)
    return Response.json({ address: formatAddress(address), displayName })
  }
  catch (error) {
    return apiError(error)
  }
}
