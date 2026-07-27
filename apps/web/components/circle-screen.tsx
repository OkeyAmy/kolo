'use client'

import type { CircleView, MemberView } from '@/lib/views'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CADENCE_LABEL, formatAmount, shortAddress } from '@kolo/core'
import { ApiError, get, post } from '@/lib/api'
import { sendPayment, WalletError } from '@/lib/nimiq-client'
import { CircleRing } from './circle-ring'
import { SwapPanel } from './swap-panel'
import { Avatar, Badge, Button, Card, Divider, NetworkBadge, Stat } from './ui'
import { useWallet } from './wallet'

export function CircleScreen({ view, explorer }: { view: CircleView, explorer: string }) {
  const router = useRouter()
  const { address, connect, connecting } = useWallet()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad', text: string } | null>(null)

  const { circle, members, payment, you } = view
  const seatsLeft = circle.seats - view.seatsTaken

  async function join() {
    if (!address) {
      await connect()
      return
    }
    setBusy(true)
    setNote(null)
    try {
      await post(`/api/circles/${circle.id}/join`)
      router.refresh()
    }
    catch (error) {
      setNote({ tone: 'bad', text: message(error) })
    }
    finally {
      setBusy(false)
    }
  }

  async function pay() {
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
        // Verification matches on the sender address, so a payment made from
        // any other account would never match. Caught before money moves.
        expectedSender: address ?? undefined,
      })

      const result = await post<{ status: string }>(
        `/api/circles/${circle.id}/contributions`,
        { roundIndex: payment.roundIndex, txHint: hint },
      )

      setNote(
        result.status === 'verified'
          ? { tone: 'ok', text: 'Paid and verified on chain.' }
          : { tone: 'ok', text: 'Sent. Confirming on chain — this usually takes a second.' },
      )
      router.refresh()
    }
    catch (error) {
      // Cancelling the Nimiq Pay dialog is a decision, not a failure.
      if (error instanceof WalletError && error.kind === 'cancelled')
        setNote({ tone: 'ok', text: 'No problem — pay whenever you are ready.' })
      else
        setNote({ tone: 'bad', text: message(error) })
    }
    finally {
      setBusy(false)
    }
  }

  async function share() {
    const url = `${window.location.origin}/j/${circle.code}`
    const text = `Join my Kolo circle "${circle.name}" — ${formatAmount(circle.amount, circle.currency)} ${CADENCE_LABEL[circle.cadence]}.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Kolo', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setNote({ tone: 'ok', text: 'Invite copied. Send it to your people.' })
    }
    catch {
      // A dismissed share sheet is not worth an error message.
    }
  }

  return (
    <main className="safe-bottom flex-1 space-y-6 px-5 pb-10 pt-3">
      {circle.network === 'test' && (
        <div className="flex justify-center">
          <NetworkBadge network={circle.network} />
        </div>
      )}

      {circle.status === 'active' && view.currentRound && (
        <div className="rise">
          <CircleRing
            members={members}
            potAmount={view.potAmount}
            currency={circle.currency}
            roundIndex={view.currentRound.index}
            totalRounds={circle.seats}
          />
        </div>
      )}

      {circle.status === 'open' && (
        <Card className="rise text-center">
          <div className="tnum gold-text text-[40px] font-extrabold leading-none tracking-tight">
            {view.seatsTaken}
            <span className="text-muted">/</span>
            {circle.seats}
          </div>
          <p className="mt-2 text-[14.5px] text-muted">
            {seatsLeft === 0
              ? 'Everyone is in. Starting now.'
              : `${seatsLeft} more ${seatsLeft === 1 ? 'person' : 'people'} and this circle starts.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="ghost" size="md" onClick={() => void share()}>Invite</Button>
            {you
              ? <Button variant="quiet" size="md" disabled>You are in</Button>
              : <Button size="md" loading={busy || connecting} onClick={() => void join()}>Join</Button>}
          </div>
        </Card>
      )}

      {note && (
        <p
          className={`rise rounded-2xl px-4 py-3 text-[13.5px] leading-snug ${
            note.tone === 'ok' ? 'bg-mint/10 text-mint' : 'bg-rose/10 text-rose'
          }`}
        >
          {note.text}
        </p>
      )}

      {payment && (
        <Card className="rise border-gold/25 bg-gold/[0.06]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-gold">Your turn to pay</p>
              <p className="tnum mt-1 text-[26px] font-extrabold tracking-tight">
                {formatAmount(payment.amount, payment.currency)}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                straight to
                {' '}
                <span className="font-semibold text-cream">{payment.recipientName}</span>
              </p>
            </div>
            <Avatar address={payment.recipient} name={payment.recipientName} size={46} ring="gold" />
          </div>

          <Button full className="mt-4" loading={busy} onClick={() => void pay()}>
            Pay
            {' '}
            {formatAmount(payment.amount, payment.currency)}
          </Button>

          <p className="mt-3 text-center text-[12px] leading-relaxed text-faint">
            Kolo never touches this. It goes wallet to wallet, tagged
            {' '}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px]">{payment.memo}</code>
            {' '}
            so anyone can check it.
          </p>
        </Card>
      )}

      {you?.isRecipient && circle.status === 'active' && (
        <Card className="rise border-mint/25 bg-mint/[0.06] text-center">
          <p className="text-[13px] font-semibold text-mint">This round is yours</p>
          <p className="tnum mt-1 text-[30px] font-extrabold tracking-tight">
            {formatAmount(view.potAmount, circle.currency)}
          </p>
          <p className="mt-1 text-[13px] text-muted">arrives in your wallet as each person pays</p>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-faint">
            {circle.status === 'open' ? 'Who is in' : 'Payout order'}
          </h2>
          <button className="text-[13px] font-semibold text-gold" onClick={() => void share()}>Share</button>
        </div>

        <ul className="space-y-2">
          {members.map(member => (
            <MemberRow key={member.address} member={member} explorer={explorer} />
          ))}
          {Array.from({ length: seatsLeft }, (_, i) => (
            <li key={`empty-${i}`} className="hairline flex items-center gap-3 rounded-2xl border-dashed px-4 py-3 opacity-60">
              <span className="grid size-[38px] place-items-center rounded-full bg-white/[0.04] text-muted">+</span>
              <span className="text-[14px] text-faint">Open seat</span>
            </li>
          ))}
        </ul>
      </section>

      {circle.status === 'active' && you && (
        <SwapPanel view={view} onDone={() => router.refresh()} />
      )}

      <Divider label="the details" />

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Each round" value={formatAmount(circle.amount, circle.currency)} />
        <Stat label="Pot" value={formatAmount(view.potAmount, circle.currency)} tone="gold" />
        <Stat label="Rhythm" value={CADENCE_LABEL[circle.cadence].replace('every ', '')} />
      </div>

      <Card>
        <h3 className="text-[15px] font-bold tracking-tight">Nobody holds the pot</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Every payment goes straight from one member's wallet to another's. Kolo
          only keeps the order and checks the Nimiq chain before marking anyone
          paid. There is no Kolo account for money to sit in, and no treasurer to
          disappear with it.
        </p>
        <p className="tnum mt-3 text-[12px] text-faint">
          Circle code
          {' '}
          <span className="font-bold text-cream">{circle.code}</span>
        </p>
      </Card>
    </main>
  )
}

function MemberRow({ member, explorer }: { member: MemberView, explorer: string }) {
  const tone = {
    recipient: { label: 'Collecting', tone: 'gold' as const },
    verified: { label: 'Paid ✓', tone: 'mint' as const },
    submitted: { label: 'Confirming…', tone: 'sky' as const },
    due: { label: 'Not yet', tone: 'neutral' as const },
    late: { label: 'Late', tone: 'rose' as const },
  }[member.state]

  return (
    <li className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="tnum w-4 shrink-0 text-[12px] font-bold text-faint">{member.position}</span>
      <Avatar
        address={member.address}
        name={member.displayName}
        size={38}
        ring={member.isRecipient ? 'gold' : 'none'}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold">
          {member.displayName}
          {member.isYou && <span className="ml-1.5 text-[12px] font-medium text-faint">you</span>}
        </p>
        <p className="tnum truncate text-[11.5px] text-faint">{shortAddress(member.address)}</p>
      </div>

      {member.txHash
        ? (
            <a
              href={`${explorer}/#${member.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="press"
            >
              <Badge tone={tone.tone}>{tone.label}</Badge>
            </a>
          )
        : <Badge tone={tone.tone}>{tone.label}</Badge>}
    </li>
  )
}

function message(error: unknown): string {
  if (error instanceof ApiError || error instanceof WalletError)
    return error.message
  return error instanceof Error ? error.message : 'That did not work.'
}
