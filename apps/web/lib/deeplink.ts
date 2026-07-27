import { headers } from 'next/headers'

/**
 * The deeplink that opens Kolo inside Nimiq Pay.
 *
 * A mini app is unusable in a desktop browser by design — the wallet provider
 * only exists inside Nimiq Pay's WebView. Rather than let a visitor (or a judge
 * clicking the demo link) hit a dead "connect" button, we hand them the way in.
 */

export async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL)
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

  // Derived from the request so it is correct on a preview deploy, a LAN dev
  // server and production without anyone remembering to set a variable.
  const list = await headers()
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'kolo-web.vercel.app'
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Nimiq Pay takes a bare host in `url=`, no scheme. */
export function deeplinkFor(origin: string, path = ''): string {
  const host = origin.replace(/^https?:\/\//, '')
  return `nimiqpay://miniapp?url=${host}${path}`
}
