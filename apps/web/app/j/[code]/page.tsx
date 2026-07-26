import { notFound } from 'next/navigation'
import { CADENCE_LABEL, formatAmount } from '@kolo/core'
import { Header } from '@/components/header'
import { JoinPanel } from '@/components/join-panel'
import { Avatar, Card, NetworkBadge } from '@/components/ui'
import { loadCircle } from '@/lib/service'
import { readSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * The invite landing screen — the first thing most people ever see of Kolo,
 * because they arrive from a friend's link. It has to explain the whole idea
 * and let them act, without a single word of onboarding copy in the way.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const session = await readSession()
  const view = await loadCircle(code.toUpperCase(), session?.address ?? null)

  if (!view)
    notFound()

  const { circle } = view
  const seatsLeft = circle.seats - view.seatsTaken
  const host = view.members.find(m => m.position === 1)

  return (
    <>
      <Header back="/" />
      <main className="safe-bottom flex-1 space-y-6 px-5 pb-10 pt-4">
        <div className="rise space-y-3 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-gold">
            You have been invited
          </p>
          {circle.network === 'test' && (
            <div className="flex justify-center">
              <NetworkBadge network={circle.network} />
            </div>
          )}
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
            {circle.name}
          </h1>
          <p className="mx-auto max-w-[32ch] text-[15px] leading-relaxed text-muted">
            {circle.seats}
            {' '}
            people each put in
            {' '}
            <span className="font-semibold text-cream">
              {formatAmount(circle.amount, circle.currency)}
            </span>
            {' '}
            {CADENCE_LABEL[circle.cadence]}
            . Every round one person takes the whole
            {' '}
            <span className="font-semibold text-gold">
              {formatAmount(view.potAmount, circle.currency)}
            </span>
            {' '}
            — and everyone gets a turn.
          </p>
        </div>

        <Card className="rise">
          <div className="flex items-center justify-center gap-2">
            {view.members.map(member => (
              <Avatar key={member.address} address={member.address} name={member.displayName} size={40} />
            ))}
            {Array.from({ length: seatsLeft }, (_, i) => (
              <span
                key={i}
                className="grid size-10 place-items-center rounded-full border border-dashed border-line text-muted"
              >
                +
              </span>
            ))}
          </div>
          <p className="mt-3 text-center text-[13.5px] text-muted">
            {host && (
              <>
                <span className="font-semibold text-cream">{host.displayName}</span>
                {' started this · '}
              </>
            )}
            {seatsLeft > 0
              ? `${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left`
              : 'Full'}
          </p>
        </Card>

        <JoinPanel
          circleId={circle.id}
          code={circle.code}
          alreadyIn={Boolean(view.you)}
          full={seatsLeft === 0}
          open={circle.status === 'open'}
        />

        <Card>
          <h2 className="text-[15px] font-bold tracking-tight">Before you join</h2>
          <ul className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-muted">
            <li>
              <span className="font-semibold text-cream">Kolo never holds the money.</span>
              {' '}
              You pay the person collecting, directly from your wallet.
            </li>
            <li>
              <span className="font-semibold text-cream">Every payment is checked on chain</span>
              {' '}
              before it counts, so nobody has to take anyone's word for it.
            </li>
            <li>
              <span className="font-semibold text-cream">Turn order is fixed when the circle starts</span>
              {' '}
              and can only change if two members both sign a swap.
            </li>
            <li>
              If someone stops paying, the round is marked short and it shows on
              their record. Kolo cannot claw money back — no app can.
            </li>
          </ul>
        </Card>
      </main>
    </>
  )
}
