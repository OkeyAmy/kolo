import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { addressHue, initialsOf } from '@kolo/core'
import { cn } from '@/lib/cn'

/* Small, hand-rolled primitives. A component kit would cost more bytes than the
   whole app and would not look like this. */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <Tag className={cn('glass rounded-[22px] p-5', className)}>
      {children}
    </Tag>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger'
  size?: 'lg' | 'md' | 'sm'
  loading?: boolean
  full?: boolean
}

export function Button({
  variant = 'primary',
  size = 'lg',
  loading = false,
  full = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'press relative inline-flex items-center justify-center gap-2 rounded-2xl font-semibold tracking-tight',
        'disabled:opacity-45',
        size === 'lg' && 'h-14 px-6 text-[17px]',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'sm' && 'h-9 px-3 text-[13px]',
        variant === 'primary' && 'gold-fill shadow-[0_10px_30px_-12px_rgba(255,194,74,0.7)]',
        variant === 'ghost' && 'hairline bg-white/[0.03] text-cream',
        variant === 'quiet' && 'text-muted hover:text-cream',
        variant === 'danger' && 'bg-rose/15 text-rose hairline border-rose/30',
        full && 'w-full',
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'spin inline-block size-4 rounded-full border-2 border-current border-t-transparent opacity-70',
        className,
      )}
    />
  )
}

export function Avatar({
  address,
  name,
  size = 44,
  ring,
}: {
  address: string
  name?: string
  size?: number
  ring?: 'gold' | 'mint' | 'rose' | 'none'
}) {
  const hue = addressHue(address)
  const label = initialsOf(name || 'K')

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        ring === 'gold' && 'ring-2 ring-gold ring-offset-2 ring-offset-ink',
        ring === 'mint' && 'ring-2 ring-mint/70 ring-offset-2 ring-offset-ink',
        ring === 'rose' && 'ring-2 ring-rose/70 ring-offset-2 ring-offset-ink',
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(150deg, hsl(${hue} 62% 46%), hsl(${(hue + 42) % 360} 58% 30%))`,
        color: 'rgba(255,255,255,0.94)',
      }}
    >
      {label}
    </span>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'mint' | 'rose' | 'sky'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tracking-wide',
        tone === 'neutral' && 'bg-white/[0.06] text-muted',
        tone === 'gold' && 'bg-gold/15 text-gold',
        tone === 'mint' && 'bg-mint/15 text-mint',
        tone === 'rose' && 'bg-rose/15 text-rose',
        tone === 'sky' && 'bg-sky/15 text-sky',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Testnet is free money. If someone is looking at a testnet circle they must
 * know it at a glance, or they will believe they have saved something real.
 */
export function NetworkBadge({ network }: { network: 'main' | 'test' }) {
  if (network === 'main')
    return null
  return (
    <Badge tone="sky" className="uppercase">Testnet · not real money</Badge>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] leading-snug text-faint">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'hairline h-13 w-full rounded-2xl bg-ink-2/80 px-4 text-[17px] font-medium',
        'placeholder:text-faint focus:border-gold/50',
        className,
      )}
      style={{ height: 52 }}
    />
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T, label: string, sub?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="hairline grid gap-1 rounded-2xl bg-ink-2/70 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'press rounded-xl py-2.5 text-[14px] font-semibold transition-colors',
            option.value === value ? 'gold-fill' : 'text-muted',
          )}
        >
          {option.label}
          {option.sub && <span className="block text-[11px] font-medium opacity-70">{option.sub}</span>}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, tone }: { label: string, value: ReactNode, tone?: 'gold' | 'mint' }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-faint">{label}</div>
      <div
        className={cn(
          'tnum mt-1 text-[19px] font-bold tracking-tight',
          tone === 'gold' && 'text-gold',
          tone === 'mint' && 'text-mint',
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-white/[0.05] text-3xl">{icon}</div>
      <h3 className="text-[17px] font-bold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-[30ch] text-[14px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Divider({ label }: { label?: string }) {
  if (!label)
    return <div className="h-px bg-line-soft" />
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line-soft" />
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</span>
      <div className="h-px flex-1 bg-line-soft" />
    </div>
  )
}
