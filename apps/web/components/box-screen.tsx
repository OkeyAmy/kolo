'use client'

import type { BoxView } from '@/lib/views'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { CADENCE_LABEL, formatAmount, shortAddress } from '@kolo/core'
import { ApiError, post } from '@/lib/api'
import { sendPayment, WalletError } from '@/lib/nimiq-client'
import { Badge, Button, Card, NetworkBadge } from './ui'

export function BoxScreen({ view, explorer }: { view: BoxView, explorer: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad', text: string } | null>(null)

  const { box, payment } = view
  const saved = Number(view.saved)
  const target = Number(view.target)
  const progress = target > 0 ? Math.min(saved / target, 1) : 0
  const done = view.periods.every(p => p.status === 'saved')

  async function save() {
    if (!payment)
      return
    setBusy(true)
    setNote(null)
    try {
      const hint = await sendPayment({
        recipient: payment.recipient,
        amount: payment.amount,
        currency: payment.currency,
        memo: payment.memo,
      })
      const result = await post<{ status: string }>(`/api/boxes/${box.id}/contributions`, { txHint: hint })
      setNote(
        result.status === 'verified'
          ? { tone: 'ok', text: 'Saved and verified on chain.' }
          : { tone: 'ok', text: 'Sent. Confirming on chain.' },
      )
      router.refresh()
    }
    catch (error) {
      if (error instanceof WalletError && error.kind === 'cancelled')
        setNote({ tone: 'ok', text: 'No problem — save when you are ready.' })
      else
        setNote({ tone: 'bad', text: error instanceof ApiError || error instanceof WalletError ? error.message : 'That did not work.' })
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <main className="safe-bottom flex-1 space-y-6 px-5 pb-10 pt-3">
      <div className="rise flex flex-col items-center">
        <ProgressRing progress={progress} />
        <p className="tnum -mt-[122px] text-center text-[30px] font-extrabold leading-none tracking-tight">
          {formatAmount(view.saved, box.currency)}
        </p>
        <p className="tnum mt-1.5 text-center text-[13px] text-muted">
          of
          {' '}
          {formatAmount(view.target, box.currency)}
        </p>
        <div className="mt-[86px] flex flex-wrap items-center justify-center gap-2">
          <NetworkBadge network={box.network} />
          {view.streak > 0 && (
            <Badge tone="gold">
              🔥
              {' '}
              {view.streak}
              {' '}
              in a row
            </Badge>
          )}
          <Badge>
            {formatAmount(box.amount, box.currency)}
            {' '}
            {CADENCE_LABEL[box.cadence]}
          </Badge>
        </div>
      </div>

      {note && (
        <p
          className={`rise rounded-2xl px-4 py-3 text-[13.5px] ${
            note.tone === 'ok' ? 'bg-mint/10 text-mint' : 'bg-rose/10 text-rose'
          }`}
        >
          {note.text}
        </p>
      )}

      {payment && (
        <Card className="border-gold/25 bg-gold/[0.06]">
          <p className="text-[13px] font-semibold text-gold">
            Period
            {' '}
            {payment.roundIndex}
            {' '}
            is open
          </p>
          <Button full className="mt-3" loading={busy} onClick={() => void save()}>
            Save
            {' '}
            {formatAmount(payment.amount, payment.currency)}
          </Button>
          <p className="tnum mt-3 text-center text-[12px] text-faint">
            goes to
            {' '}
            {shortAddress(box.vaultAddress)}
            {' '}
            — your address, not ours
          </p>
        </Card>
      )}

      {done && (
        <Card className="border-mint/25 bg-mint/[0.06] text-center">
          <p className="text-[16px] font-bold">Box full. You did it.</p>
          <p className="mt-1 text-[13.5px] text-muted">
            Every period saved, every one of them provable on chain.
          </p>
          <Link href="/new" className="press gold-fill mt-4 inline-flex h-12 items-center rounded-2xl px-5 font-semibold">
            Now do it with friends
          </Link>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-faint">Every period</h2>
        <div className="grid grid-cols-6 gap-2">
          {view.periods.map((period) => {
            const cell = (
              <div
                key={period.index}
                className={`tnum grid aspect-square place-items-center rounded-2xl text-[13px] font-bold ${
                  period.status === 'saved'
                    ? 'gold-fill'
                    : period.status === 'pending'
                      ? 'breathe bg-gold/25 text-gold'
                      : period.status === 'open'
                        ? 'hairline border-gold/50 bg-gold/10 text-gold'
                        : period.status === 'missed'
                          ? 'bg-rose/12 text-rose'
                          : 'bg-white/[0.04] text-faint'
                }`}
              >
                {period.status === 'saved' ? '✓' : period.index}
              </div>
            )

            return period.txHash
              ? (
                  <a key={period.index} href={`${explorer}/#${period.txHash}`} target="_blank" rel="noreferrer noopener" className="press">
                    {cell}
                  </a>
                )
              : cell
          })}
        </div>
      </section>

      <Card>
        <h3 className="text-[15px] font-bold tracking-tight">Why this counts</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          A tick only appears once the transfer has been found on the Nimiq
          chain. Not when you tap the button, and not because you said so. That
          is the same rule Kolo uses in a circle with seven other people — this
          is just the version you can start alone.
        </p>
      </Card>
    </main>
  )
}

function ProgressRing({ progress }: { progress: number }) {
  const size = 224
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <linearGradient id="ring-g" x1="0" y1="0" x2={size} y2={size}>
          <stop stopColor="#FFD98A" />
          <stop offset="1" stopColor="#E8734A" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#ring-g)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)' }}
      />
    </svg>
  )
}
