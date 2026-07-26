'use client'

import type { CircleView } from '@/lib/views'
import type { Swap } from '@kolo/core'
import { useState } from 'react'
import { sameAddress } from '@kolo/core'
import { ApiError, get, post } from '@/lib/api'
import { WalletError } from '@/lib/nimiq-client'
import { Avatar, Badge, Button, Card, Input } from './ui'
import { useWallet } from './wallet'

/**
 * Emergency swap.
 *
 * Two members trade turns. Both of them sign the same message with their own
 * Nimiq key, and Kolo will not move a single position until it has both
 * signatures. That is the point of the feature: the circle is reordered by its
 * members, not by us, and the two signatures stay on the record so anyone can
 * check that later.
 */
export function SwapPanel({ view, onDone }: { view: CircleView, onDone: () => void }) {
  const { address, sign } = useWallet()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const you = view.you
  if (!you || !address)
    return null

  const pending = view.swaps.filter(s => s.status === 'requested')
  const incoming = pending.filter(s => sameAddress(s.counterpartyAddress, address))
  const outgoing = pending.filter(s => sameAddress(s.requesterAddress, address))
  const applied = view.swaps.filter(s => s.status === 'applied')

  // Only rounds that have not opened yet can move; anything else has money
  // already pointed at it.
  const swappable = view.members.filter((member) => {
    if (member.position === you.position)
      return false
    const round = view.rounds.find(r => r.index === member.position)
    return round?.status === 'pending'
  })

  async function request() {
    if (!target)
      return
    setBusy(true)
    setError(null)
    try {
      const prepared = await get<{ message: string, nonce: string }>(
        `/api/circles/${view.circle.id}/swaps?targetPosition=${target}`,
      )
      const signature = await sign(prepared.message)
      await post(`/api/circles/${view.circle.id}/swaps`, {
        targetPosition: target,
        reason,
        nonce: prepared.nonce,
        publicKey: signature.publicKey,
        signature: signature.signature,
      })
      setOpen(false)
      setTarget(null)
      setReason('')
      onDone()
    }
    catch (caught) {
      setError(describe(caught))
    }
    finally {
      setBusy(false)
    }
  }

  async function accept(swap: Swap) {
    setBusy(true)
    setError(null)
    try {
      const prepared = await get<{ message: string }>(`/api/swaps/${swap.id}`)
      const signature = await sign(prepared.message)
      await post(`/api/swaps/${swap.id}`, {
        action: 'accept',
        publicKey: signature.publicKey,
        signature: signature.signature,
      })
      onDone()
    }
    catch (caught) {
      setError(describe(caught))
    }
    finally {
      setBusy(false)
    }
  }

  async function decline(swap: Swap) {
    setBusy(true)
    try {
      await post(`/api/swaps/${swap.id}`, { action: 'decline' })
      onDone()
    }
    catch (caught) {
      setError(describe(caught))
    }
    finally {
      setBusy(false)
    }
  }

  function nameAt(position: number): string {
    return view.members.find(m => m.position === position)?.displayName ?? `Seat ${position}`
  }

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-faint">Turns</h2>

      {incoming.map(swap => (
        <Card key={swap.id} className="border-gold/25 bg-gold/[0.06]">
          <div className="flex items-start gap-3">
            <Avatar address={swap.requesterAddress} name={nameAt(swap.positionA)} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold leading-snug">
                {nameAt(swap.positionA)}
                {' '}
                wants to swap turns with you
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                They take seat
                {' '}
                {swap.positionB}
                , you take seat
                {' '}
                {swap.positionA}
                .
              </p>
              {swap.reason && <p className="mt-1.5 text-[13px] italic text-cream">“{swap.reason}”</p>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="ghost" size="md" disabled={busy} onClick={() => void decline(swap)}>
              No thanks
            </Button>
            <Button size="md" loading={busy} onClick={() => void accept(swap)}>
              Sign and swap
            </Button>
          </div>
          <p className="mt-3 text-center text-[11.5px] text-faint">
            Nothing changes until you sign. Kolo cannot move your turn on its own.
          </p>
        </Card>
      ))}

      {outgoing.map(swap => (
        <Card key={swap.id}>
          <p className="text-[14px]">
            Waiting for
            {' '}
            <span className="font-semibold">{nameAt(swap.positionB)}</span>
            {' '}
            to sign your swap.
          </p>
          <p className="mt-1 text-[12.5px] text-faint">They can accept or decline. Nothing has moved yet.</p>
        </Card>
      ))}

      {applied.length > 0 && (
        <Card>
          <p className="text-[13px] font-semibold text-muted">Signed swaps</p>
          <ul className="mt-2 space-y-2">
            {applied.map(swap => (
              <li key={swap.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate text-muted">
                  Seats
                  {' '}
                  {swap.positionA}
                  {' ↔ '}
                  {swap.positionB}
                </span>
                <Badge tone="mint">2 signatures</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!open && swappable.length > 0 && (
        <Button variant="ghost" full size="md" onClick={() => setOpen(true)}>
          Need the money sooner? Ask to swap turns
        </Button>
      )}

      {open && (
        <Card className="space-y-4">
          <div>
            <p className="text-[15px] font-bold tracking-tight">Ask someone to trade turns</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              You are seat
              {' '}
              {you.position}
              . Pick whose turn you would like to take. They have to sign too.
            </p>
          </div>

          <div className="rail flex gap-2 overflow-x-auto pb-1">
            {swappable.map(member => (
              <button
                key={member.address}
                type="button"
                onClick={() => setTarget(member.position)}
                className={`press hairline flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 ${
                  target === member.position ? 'border-gold/60 bg-gold/10' : 'bg-white/[0.03]'
                }`}
              >
                <Avatar address={member.address} name={member.displayName} size={28} />
                <span className="text-[13.5px] font-semibold">
                  {member.displayName}
                  <span className="ml-1 text-[11.5px] font-medium text-faint">
                    seat
                    {' '}
                    {member.position}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <Input
            placeholder="Why? (school fees, rent…)"
            value={reason}
            maxLength={140}
            onChange={event => setReason(event.target.value)}
          />

          {error && <p className="text-[13px] text-rose">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="md" disabled={!target} loading={busy} onClick={() => void request()}>
              Sign request
            </Button>
          </div>
        </Card>
      )}

      {error && !open && <p className="text-[13px] text-rose">{error}</p>}
    </section>
  )
}

function describe(error: unknown): string {
  if (error instanceof WalletError && error.kind === 'cancelled')
    return 'You cancelled the signature. Nothing changed.'
  if (error instanceof ApiError || error instanceof WalletError)
    return error.message
  return error instanceof Error ? error.message : 'That did not work.'
}
