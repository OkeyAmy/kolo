'use client'

import type { Cadence, Currency } from '@kolo/core'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CADENCE_LABEL, CURRENCY_META } from '@kolo/core'
import { ApiError, post } from '@/lib/api'
import { walletHeight } from '@/lib/nimiq-client'
import { Button, Card, Field, Input, Segmented } from './ui'
import { useWallet } from './wallet'

export function NewCircleForm() {
  const router = useRouter()
  const { address, connect, connecting } = useWallet()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('500')
  const [currency, setCurrency] = useState<Currency>('NIM')
  const [cadence, setCadence] = useState<Cadence>('weekly')
  const [seats, setSeats] = useState(5)
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const potPreview = previewPot(amount, seats, currency)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const account = address ?? await connect()
      if (!account) {
        setBusy(false)
        return
      }
      const height = await walletHeight()
      const created = await post<{ code: string }>('/api/circles', {
        name: name.trim(),
        currency,
        amount,
        cadence,
        seats,
        visibility,
        ...(height ? { walletHeight: height } : {}),
      })
      router.push(`/c/${created.code}`)
      router.refresh()
    }
    catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the circle.')
      setBusy(false)
    }
  }

  return (
    <main className="safe-bottom flex-1 space-y-6 px-5 pb-10 pt-3">
      <Card className="text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-faint">
          Each person collects
        </p>
        <p className="tnum gold-text mt-1 text-[38px] font-extrabold leading-none tracking-tight">
          {potPreview}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          {seats}
          {' '}
          people ·
          {' '}
          {CADENCE_LABEL[cadence]}
          {' · '}
          {seats}
          {' '}
          rounds
        </p>
      </Card>

      <Field label="Name it something everyone will recognise">
        <Input
          value={name}
          maxLength={40}
          placeholder="Ìdí Ọ̀rẹ́ savings"
          onChange={event => setName(event.target.value)}
        />
      </Field>

      <Field
        label="How much does each person put in?"
        hint={currency === 'USDT'
          ? 'USDT runs on Polygon. Members need a little POL for gas — NIM does not have that problem.'
          : 'NIM transfers cost effectively nothing and land in about a second.'}
      >
        <div className="flex gap-3">
          <Input
            value={amount}
            inputMode="decimal"
            className="flex-1"
            onChange={event => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
          />
          <div className="w-[132px]">
            <Segmented
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'NIM', label: 'NIM' },
                { value: 'USDT', label: 'USDT' },
              ]}
            />
          </div>
        </div>
      </Field>

      <Field label="How often?">
        <Segmented
          value={cadence}
          onChange={setCadence}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: '2 weeks' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
      </Field>

      <Field label="How many people?" hint="Everyone gets exactly one turn, in join order.">
        <div className="rail flex gap-2 overflow-x-auto pb-1">
          {[3, 4, 5, 6, 8, 10, 12].map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setSeats(option)}
              className={`press hairline tnum size-12 shrink-0 rounded-2xl text-[16px] font-bold ${
                seats === option ? 'gold-fill' : 'bg-white/[0.03] text-muted'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Who can join?"
        hint={visibility === 'public'
          ? 'Anyone can find and join this circle from the home screen.'
          : 'Only people you send the invite link to.'}
      >
        <Segmented
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'private', label: 'Invite only' },
            { value: 'public', label: 'Open to all' },
          ]}
        />
      </Field>

      {error && <p className="rounded-2xl bg-rose/10 px-4 py-3 text-[13.5px] text-rose">{error}</p>}

      <Button full loading={busy || connecting} disabled={name.trim().length < 2} onClick={() => void submit()}>
        {address ? 'Create circle' : 'Connect and create'}
      </Button>

      <p className="text-center text-[12.5px] leading-relaxed text-faint">
        You take the first turn. The circle starts by itself the moment the last
        seat is taken.
      </p>
    </main>
  )
}

function previewPot(amount: string, seats: number, currency: Currency): string {
  const value = Number.parseFloat(amount)
  if (!Number.isFinite(value) || value <= 0)
    return `${CURRENCY_META[currency].symbol} —`
  const pot = value * (seats - 1)
  return `${CURRENCY_META[currency].symbol} ${pot.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}
