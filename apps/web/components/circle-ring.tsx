import type { MemberView } from '@/lib/views'
import type { Currency } from '@kolo/core'
import { formatAmount } from '@kolo/core'
import { Avatar } from './ui'

/**
 * The circle, drawn as a circle.
 *
 * Members sit around the ring in payout order, the pot sits in the middle, and
 * the person collecting this round is lit. It replaces about four sentences of
 * explanation with one glance, which is the whole reason it is worth the code.
 */
export function CircleRing({
  members,
  potAmount,
  currency,
  roundIndex,
  totalRounds,
  size = 268,
}: {
  members: MemberView[]
  potAmount: string
  currency: Currency
  roundIndex: number
  totalRounds: number
  size?: number
}) {
  const radius = size / 2 - 26
  const centre = size / 2
  const paid = members.filter(m => m.state === 'verified').length
  const owing = members.filter(m => m.state !== 'recipient').length

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        aria-hidden
      >
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1.5"
          strokeDasharray="3 7"
        />
        <circle
          cx={centre}
          cy={centre}
          r={radius - 30}
          fill="none"
          stroke="rgba(255,194,74,0.16)"
          strokeWidth="1"
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Round
            {' '}
            {roundIndex}
            {' '}
            of
            {' '}
            {totalRounds}
          </div>
          <div className="tnum gold-text mt-1 text-[30px] font-extrabold leading-none tracking-tight">
            {formatAmount(potAmount, currency)}
          </div>
          <div className="mt-1.5 text-[12px] font-medium text-muted">
            {paid}
            {' '}
            of
            {' '}
            {owing}
            {' '}
            paid in
          </div>
        </div>
      </div>

      {members.map((member, i) => {
        // Start at the top and go clockwise so position 1 sits where a person
        // expects the first slot to be.
        const angle = (i / members.length) * Math.PI * 2 - Math.PI / 2
        const x = centre + radius * Math.cos(angle)
        const y = centre + radius * Math.sin(angle)

        return (
          <div
            key={member.address}
            className="absolute"
            style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
            title={`${member.displayName} — position ${member.position}`}
          >
            <div className="relative">
              <Avatar
                address={member.address}
                name={member.displayName}
                size={member.isRecipient ? 46 : 38}
                ring={member.isRecipient ? 'gold' : member.state === 'verified' ? 'mint' : 'none'}
              />
              {member.state === 'verified' && (
                <span className="pop absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full bg-mint text-[11px] font-bold text-ink">
                  ✓
                </span>
              )}
              {member.state === 'late' && (
                <span className="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full bg-rose text-[11px] font-bold text-ink">
                  !
                </span>
              )}
              {member.state === 'submitted' && (
                <span className="breathe absolute -bottom-1 -right-1 size-[18px] rounded-full bg-gold" />
              )}
              {member.isRecipient && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-ink">
                  collects
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
