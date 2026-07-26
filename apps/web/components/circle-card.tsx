import type { CircleSummary } from '@/lib/views'
import Link from 'next/link'
import { CADENCE_LABEL, formatAmount } from '@kolo/core'
import { Badge, NetworkBadge } from './ui'

export function CircleCard({ summary }: { summary: CircleSummary }) {
  const { circle } = summary
  const open = circle.status === 'open'
  const seatsLeft = circle.seats - summary.seatsTaken

  return (
    <Link
      href={`/c/${circle.code}`}
      className="press glass block rounded-[22px] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16.5px] font-bold tracking-tight">{circle.name}</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            {formatAmount(circle.amount, circle.currency)}
            {' '}
            {CADENCE_LABEL[circle.cadence]}
            {' · '}
            {circle.seats}
            {' '}
            people
          </p>
        </div>
        {summary.youOwe && <Badge tone="gold">Your turn to pay</Badge>}
        {summary.youCollect && <Badge tone="mint">You collect</Badge>}
        {!summary.youOwe && !summary.youCollect && open && (
          <Badge tone="sky">
            {seatsLeft}
            {' '}
            {seatsLeft === 1 ? 'seat' : 'seats'}
            {' '}
            left
          </Badge>
        )}
      </div>

      {circle.network === 'test' && (
        <div className="mt-2.5">
          <NetworkBadge network={circle.network} />
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <SeatBar taken={summary.seatsTaken} total={circle.seats} status={circle.status} round={summary.roundIndex} />
        <span className="tnum shrink-0 text-[13px] font-bold text-gold">
          {formatAmount(summary.potAmount, circle.currency)}
          <span className="ml-1 text-[11px] font-semibold text-faint">pot</span>
        </span>
      </div>

      {circle.status === 'active' && summary.recipientName && (
        <p className="mt-2.5 text-[12.5px] text-muted">
          Round
          {' '}
          {summary.roundIndex}
          {' — '}
          <span className="font-semibold text-cream">{summary.recipientName}</span>
          {' '}
          collects
        </p>
      )}
      {circle.status === 'completed' && (
        <p className="mt-2.5 text-[12.5px] text-mint">Finished — everyone had their turn.</p>
      )}
    </Link>
  )
}

function SeatBar({
  taken,
  total,
  status,
  round,
}: {
  taken: number
  total: number
  status: string
  round: number
}) {
  const filled = status === 'open' ? taken : round
  return (
    <div className="flex flex-1 items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{
            background: i < filled
              ? 'linear-gradient(90deg,#FFD277,#FFC24A)'
              : 'rgba(255,255,255,0.09)',
          }}
        />
      ))}
    </div>
  )
}
