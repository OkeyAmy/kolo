import Link from 'next/link'
import { formatAddress, TRUST_LABEL_COPY } from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { Header } from '@/components/header'
import { LogoutButton } from '@/components/logout-button'
import { Avatar, Badge, Card, Empty, Stat } from '@/components/ui'
import { readSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const session = await readSession()

  if (!session) {
    return (
      <>
        <Header back="/" title="You" />
        <main className="flex-1 px-5 pt-6">
          <Card className="p-0">
            <Empty
              icon="◍"
              title="Not connected"
              body="Connect your Nimiq Pay wallet to see your record."
              action={<Link href="/" className="text-[14px] font-semibold text-gold">Go back</Link>}
            />
          </Card>
        </main>
      </>
    )
  }

  const trust = await getRepository().trustFor(session.address)
  const copy = TRUST_LABEL_COPY[trust.label]

  return (
    <>
      <Header back="/" title="You" />
      <main className="safe-bottom flex-1 space-y-6 px-5 pb-10 pt-3">
        <div className="rise flex flex-col items-center text-center">
          <Avatar address={session.address} name={session.displayName} size={76} ring="gold" />
          <h1 className="mt-3 text-[22px] font-extrabold tracking-tight">{session.displayName}</h1>
          <p className="tnum mt-1 break-all px-6 text-[12px] text-faint">
            {formatAddress(session.address)}
          </p>
          <div className="mt-3">
            <Badge tone={trust.label === 'at-risk' ? 'rose' : trust.label === 'new' ? 'neutral' : 'mint'}>
              {copy.title}
            </Badge>
          </div>
          <p className="mt-2 max-w-[30ch] text-[13.5px] text-muted">{copy.blurb}</p>
        </div>

        <Card>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Rounds paid" value={trust.roundsPaid} tone="mint" />
            <Stat label="On time" value={trust.roundsOnTime} />
            <Stat label="Missed" value={trust.roundsMissed} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Stat label="Circles joined" value={trust.circlesJoined} />
            <Stat label="Finished" value={trust.circlesCompleted} />
          </div>
        </Card>

        <Card>
          <h2 className="text-[15px] font-bold tracking-tight">Where this comes from</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            Every number here is counted from payments that were found on the
            Nimiq chain. Nothing on this screen is self-reported, which is why it
            is worth showing to someone deciding whether to save with you.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            New here counts as
            {' '}
            <span className="font-semibold text-cream">new</span>
            , not bad. Everyone starts somewhere.
          </p>
        </Card>

        <LogoutButton />
      </main>
    </>
  )
}
