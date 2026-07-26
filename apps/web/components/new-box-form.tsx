'use client'

import type { Cadence, Currency } from '@kolo/core'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CADENCE_LABEL, CURRENCY_META, isNimiqAddress, sameAddress, shortAddress } from '@kolo/core'
import { ApiError, post } from '@/lib/api'
import { listAccounts, walletHeight } from '@/lib/nimiq-client'
import { Button, Card, Field, Input, Segmented } from './ui'
import { useWallet } from './wallet'

/**
 * A savings box needs somewhere to save *to*. Kolo will not hold it, so the
 * destination has to be another address the user controls — a second Nimiq Pay
 * account, or their Nimiq Wallet. We offer the accounts the wallet already
 * shared and otherwise let them paste one.
 */
export function NewBoxForm() {
  const router = useRouter()
  const { address, connect, connecting } = useWallet()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('250')
  const [currency, setCurrency] = useState<Currency>('NIM')
  const [cadence, setCadence] = useState<Cadence>('weekly')
  const [periods, setPeriods] = useState(8)
  const [vault, setVault] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address)
      return
    listAccounts()
      .then(accounts => setOptions(accounts.filter(a => !sameAddress(a, address))))
      .catch(() => setOptions([]))
  }, [address])

  const target = previewTarget(amount, periods, currency)
  const vaultValid = isNimiqAddress(vault) && !(address && sameAddress(vault, address))

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
      const created = await post<{ code: string }>('/api/boxes', {
        name: name.trim(),
        currency,
        amount,
        cadence,
        periods,
        vaultAddress: vault.trim(),
        ...(height ? { walletHeight: height } : {}),
      })
      router.push(`/solo/${created.code}`)
      router.refresh()
    }
    catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the box.')
      setBusy(false)
    }
  }

  return (
    <main className="safe-bottom flex-1 space-y-6 px-5 pb-10 pt-3">
      <Card className="text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-faint">
          You will have saved
        </p>
        <p className="tnum gold-text mt-1 text-[38px] font-extrabold leading-none tracking-tight">
          {target}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          {periods}
          {' × '}
          {CADENCE_LABEL[cadence]}
        </p>
      </Card>

      <Field label="What are you saving for?">
        <Input
          value={name}
          maxLength={40}
          placeholder="New phone"
          onChange={event => setName(event.target.value)}
        />
      </Field>

      <Field label="How much each time?">
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

      <Field label="For how long?">
        <div className="rail flex gap-2 overflow-x-auto pb-1">
          {[4, 6, 8, 12, 16, 24, 52].map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriods(option)}
              className={`press hairline tnum size-12 shrink-0 rounded-2xl text-[15px] font-bold ${
                periods === option ? 'gold-fill' : 'bg-white/[0.03] text-muted'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Save into which address?"
        hint="Kolo never holds your savings. Pick another address you own — a second Nimiq Pay account, or your wallet at wallet.nimiq.com."
      >
        {options.length > 0 && (
          <div className="mb-2 space-y-2">
            {options.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setVault(option)}
                className={`press hairline tnum flex w-full items-center justify-between rounded-2xl px-4 py-3 text-[13.5px] ${
                  sameAddress(option, vault) ? 'border-gold/60 bg-gold/10' : 'bg-white/[0.03]'
                }`}
              >
                <span>{shortAddress(option)}</span>
                <span className="text-[12px] text-faint">your account</span>
              </button>
            ))}
          </div>
        )}
        <Input
          value={vault}
          placeholder="NQ.. address"
          spellCheck={false}
          autoCapitalize="characters"
          onChange={event => setVault(event.target.value)}
        />
      </Field>

      {error && <p className="rounded-2xl bg-rose/10 px-4 py-3 text-[13.5px] text-rose">{error}</p>}

      <Button
        full
        loading={busy || connecting}
        disabled={name.trim().length < 2 || !vaultValid}
        onClick={() => void submit()}
      >
        {address ? 'Open the box' : 'Connect and open the box'}
      </Button>

      {vault && !vaultValid && (
        <p className="text-center text-[12.5px] text-rose">
          Use a different Nimiq address than the one you are paying from.
        </p>
      )}
    </main>
  )
}

function previewTarget(amount: string, periods: number, currency: Currency): string {
  const value = Number.parseFloat(amount)
  if (!Number.isFinite(value) || value <= 0)
    return `${CURRENCY_META[currency].symbol} —`
  return `${CURRENCY_META[currency].symbol} ${(value * periods).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}
