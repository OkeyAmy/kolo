import Link from 'next/link'
import { formatAmount } from '@kolo/core'
import { CircleCard } from '@/components/circle-card'
import { ConnectPanel } from '@/components/connect-panel'
import { Header } from '@/components/header'
import { Badge, Card, Divider, Empty } from '@/components/ui'
import { loadHome } from '@/lib/service'
import { readSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await readSession()
  const home = await loadHome(session?.address ?? null, session?.displayName ?? null)

  const needsAction = home.myCircles.filter(c => c.youOwe || c.youCollect)
  const rest = home.myCircles.filter(c => !c.youOwe && !c.youCollect)

  return (
    <>
      <Header />

      <main className="safe-bottom flex-1 space-y-7 px-5 pb-10 pt-2">
        {!session && <Intro />}

        {session && needsAction.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>Needs you</SectionTitle>
            {needsAction.map(summary => (
              <div key={summary.circle.id} className="rise">
                <CircleCard summary={summary} />
              </div>
            ))}
          </section>
        )}

        {session && (
          <section className="space-y-3">
            <SectionTitle
              action={<Link href="/new" className="text-[13px] font-semibold text-gold">New circle</Link>}
            >
              Your circles
            </SectionTitle>

            {rest.length === 0 && needsAction.length === 0
              ? (
                  <Card className="p-0">
                    <Empty
                      icon="◍"
                      title="No circles yet"
                      body="Start one and invite the people you already save with, or join an open circle below."
                      action={(
                        <Link href="/new" className="press gold-fill inline-flex h-12 items-center rounded-2xl px-5 font-semibold">
                          Start a circle
                        </Link>
                      )}
                    />
                  </Card>
                )
              : rest.map(summary => <CircleCard key={summary.circle.id} summary={summary} />)}
          </section>
        )}

        {session && (
          <section className="space-y-3">
            <SectionTitle
              action={<Link href="/solo/new" className="text-[13px] font-semibold text-gold">New box</Link>}
            >
              Your savings box
            </SectionTitle>

            {home.myBoxes.length === 0
              ? (
                  <Link href="/solo/new" className="press glass block rounded-[22px] p-5">
                    <div className="flex items-center gap-4">
                      <div className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-2xl">🪙</div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-bold tracking-tight">Save on your own first</h3>
                        <p className="mt-0.5 text-[13px] leading-snug text-muted">
                          Set a target, put a little away each week, keep the streak. Same proof on chain.
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              : home.myBoxes.map(box => (
                  <Link key={box.box.id} href={`/solo/${box.box.code}`} className="press glass block rounded-[22px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[16px] font-bold tracking-tight">{box.box.name}</h3>
                        <p className="tnum mt-0.5 text-[13px] text-muted">
                          {formatAmount(box.saved, box.box.currency)}
                          {' of '}
                          {formatAmount(box.target, box.box.currency)}
                        </p>
                      </div>
                      {box.streak > 0
                        ? (
                            <Badge tone="gold">
                              🔥
                              {box.streak}
                              {' '}
                              in a row
                            </Badge>
                          )
                        : box.payment ? <Badge tone="sky">Due now</Badge> : null}
                    </div>
                  </Link>
                ))}
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle>Open to join</SectionTitle>
          {home.publicCircles.length === 0
            ? (
                <Card>
                  <p className="text-[14px] leading-relaxed text-muted">
                    No open circles right now. Start one — a circle only needs three people.
                  </p>
                </Card>
              )
            : home.publicCircles.map(summary => (
                <CircleCard key={summary.circle.id} summary={summary} />
              ))}
        </section>

        <Divider label="how it works" />
        <HowItWorks />
      </main>
    </>
  )
}

function SectionTitle({ children, action }: { children: React.ReactNode, action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-faint">{children}</h2>
      {action}
    </div>
  )
}

function Intro() {
  return (
    <div className="space-y-6 pt-4">
      <div className="rise space-y-3">
        <Badge tone="gold">Nimiq Pay mini app</Badge>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em]">
          Eight friends.
          <br />
          One pot.
          <br />
          <span className="gold-text">Your turn comes.</span>
        </h1>
        <p className="max-w-[34ch] text-[15.5px] leading-relaxed text-muted">
          Everyone puts in the same amount every week. Each week one person takes
          the whole pot. Kolo keeps the turns, checks every payment on the Nimiq
          chain, and
          {' '}
          <span className="font-semibold text-cream">never holds your money.</span>
        </p>
      </div>

      <ConnectPanel />
    </div>
  )
}

function HowItWorks() {
  const steps = [
    ['Start or join', 'Pick the amount and how many people. Share the link.'],
    ['Everyone pays', 'One tap sends NIM straight to whoever collects this round.'],
    ['Chain proves it', 'We match your payment on chain before it counts. No word-of-mouth.'],
    ['Your turn arrives', 'The pot lands in your wallet. Nobody holds it in between.'],
  ]

  return (
    <ol className="space-y-3">
      {steps.map(([title, body], i) => (
        <li key={title} className="flex gap-3.5">
          <span className="tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 text-[13px] font-bold text-gold">
            {i + 1}
          </span>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
