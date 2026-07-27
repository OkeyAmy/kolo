'use client'

import Link from 'next/link'
import { shortAddress } from '@kolo/core'
import { useWallet } from './wallet'
import { Avatar, Button } from './ui'

export function Header({ back, title }: { back?: string, title?: string }) {
  const { address, displayName, connect, connecting } = useWallet()

  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-3 bg-ink/85 px-5 pb-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        {back
          ? (
              <Link
                href={back}
                aria-label="Back"
                className="press hairline grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.04] text-lg"
              >
                ←
              </Link>
            )
          : (
              <Link href="/" className="flex items-center gap-2.5">
                <KoloMark />
                <span className="text-[19px] font-extrabold tracking-tight">Kolo</span>
              </Link>
            )}
        {title && <h1 className="truncate text-[17px] font-bold tracking-tight">{title}</h1>}
      </div>

      {address
        ? (
            <Link href="/me" className="press flex items-center gap-2">
              <span className="hidden text-right text-[12px] leading-tight text-muted xs:block">
                <span className="block font-semibold text-cream">{displayName}</span>
                <span className="tnum">{shortAddress(address)}</span>
              </span>
              <Avatar address={address} name={displayName ?? 'You'} size={36} />
            </Link>
          )
        : (
            <Button size="sm" loading={connecting} onClick={() => void connect()}>
              Connect
            </Button>
          )}
    </header>
  )
}

export function KoloMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="kolo-g" x1="4" y1="2" x2="28" y2="30">
          <stop stopColor="#FFD98A" />
          <stop offset="0.5" stopColor="#FFC24A" />
          <stop offset="1" stopColor="#E8734A" />
        </linearGradient>
      </defs>
      {/* The pot everyone pays into, and one member collects each round. */}
      <path
        d="M6 13.5C6 10.4624 8.46243 8 11.5 8h9C23.5376 8 26 10.4624 26 13.5v6C26 24.7467 21.7467 29 16.5 29h-1C10.2533 29 6 24.7467 6 19.5v-6Z"
        fill="url(#kolo-g)"
      />
      <rect x="12.5" y="4" width="7" height="2.6" rx="1.3" fill="url(#kolo-g)" />
      <rect x="13.25" y="12" width="5.5" height="2.2" rx="1.1" fill="#2B1B00" opacity="0.55" />
    </svg>
  )
}
