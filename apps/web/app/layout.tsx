import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { WalletProvider } from '@/components/wallet'
import { readSession } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kolo — savings circles that pay out',
  description:
    'Run the savings circle your family already runs on WhatsApp — with everyone\'s turn, everyone\'s payment, and every receipt on the Nimiq chain. Kolo never holds your money.',
  applicationName: 'Kolo',
  openGraph: {
    title: 'Kolo — savings circles that pay out',
    description: 'Eight friends, one pot, a different person collects every week. Verified on Nimiq.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0C0A10',
  width: 'device-width',
  initialScale: 1,
  // A money app should not zoom out from under someone mid-payment.
  maximumScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await readSession()

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <WalletProvider
          address={session?.address ?? null}
          displayName={session?.displayName ?? null}
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  )
}
