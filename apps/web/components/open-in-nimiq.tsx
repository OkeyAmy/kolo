'use client'

import { useEffect, useState } from 'react'
import { insideNimiqPay } from '@/lib/nimiq-client'
import { ConnectPanel } from './connect-panel'
import { Button } from './ui'

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.nimiq.pay'
const APP_STORE = 'https://apps.apple.com/app/nimiq-pay/id6471844738'

/**
 * The way in, for a visitor who is not inside Nimiq Pay — a desktop browser, or
 * a phone browser. A mini app has no wallet out here by design, so instead of a
 * dead "connect" button they get the deeplink and the two install links.
 *
 * Inside Nimiq Pay this renders the normal connect flow. The check runs after
 * mount because `window.nimiqPay` only exists on the client; until then we show
 * the connect panel, so a real wallet user never sees this flash past.
 */
export function OpenInNimiq({ deeplink }: { deeplink: string }) {
  const [outside, setOutside] = useState(false)

  useEffect(() => {
    setOutside(!insideNimiqPay())
  }, [])

  if (!outside)
    return <ConnectPanel />

  return (
    <div className="rise w-full min-w-0 space-y-3">
      <a href={deeplink} className="block">
        <Button full>Open in Nimiq Pay</Button>
      </a>

      <div className="grid grid-cols-2 gap-2.5">
        <StoreLink href={APP_STORE} label="iPhone" sub="App Store" icon={<AppleMark />} />
        <StoreLink href={PLAY_STORE} label="Android" sub="Google Play" icon={<PlayMark />} />
      </div>

      <p className="text-center text-[12.5px] leading-relaxed text-faint">
        Already have it? Open
        {' '}
        <span className="font-semibold text-muted">Mini Apps</span>
        {' '}
        inside Nimiq Pay.
      </p>
    </div>
  )
}

function StoreLink({
  href,
  label,
  sub,
  icon,
}: {
  href: string
  label: string
  sub: string
  icon: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="press hairline flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3 py-2.5"
    >
      <span className="shrink-0 text-cream">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold leading-tight">{label}</span>
        <span className="block truncate text-[11.5px] leading-tight text-faint">{sub}</span>
      </span>
    </a>
  )
}

function AppleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.36 12.78c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.12 2.78-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.69ZM14.1 5.98c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.09 1.76-.95 2.8 1.02.08 2.06-.51 2.68-1.27Z" />
    </svg>
  )
}

function PlayMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.6 2.4c-.3.3-.5.8-.5 1.4v16.4c0 .6.2 1.1.5 1.4l.1.1 9.2-9.2v-.2L3.6 2.4Z" fill="#57A8FF" />
      <path d="m16 15.3-3.1-3.1v-.2l3.1-3.1.1.04 3.7 2.1c1 .6 1 1.6 0 2.2l-3.7 2.1-.1.04Z" fill="#FFC24A" />
      <path d="M16.1 15.26 12.9 12.1 3.6 21.6c.35.36.9.4 1.55.04l10.95-6.38Z" fill="#E8734A" />
      <path d="M16.1 8.94 5.15 2.56C4.5 2.2 3.95 2.24 3.6 2.6l9.3 9.5 3.2-3.16Z" fill="#4FD6A0" />
    </svg>
  )
}
