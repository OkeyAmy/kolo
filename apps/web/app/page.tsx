import type { ReactNode } from 'react'
import Link from 'next/link'
import { formatAmount } from '@kolo/core'
import { CircleCard } from '@/components/circle-card'
import { Header } from '@/components/header'
import { LandingRing } from '@/components/landing-ring'
import { OpenInNimiq } from '@/components/open-in-nimiq'
import { Badge, Card, Divider, Empty } from '@/components/ui'
import { appOrigin, deeplinkFor } from '@/lib/deeplink'
import { loadHome } from '@/lib/service'
import { readSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await readSession()
  const home = await loadHome(session?.address ?? null, session?.displayName ?? null)
  const deeplink = deeplinkFor(await appOrigin())

  const needsAction = home.myCircles.filter(c => c.youOwe || c.youCollect)
  const rest = home.myCircles.filter(c => !c.youOwe && !c.youCollect)

  return (
    <>
      <Header />

      <main className="safe-bottom w-full min-w-0 flex-1 space-y-8 overflow-x-hidden px-5 pb-12 pt-2">
        {!session && <Landing deeplink={deeplink} />}

        {session && needsAction.length > 0 && (
          <Section title="Needs you">
            {needsAction.map(summary => (
              <div key={summary.circle.id} className="rise">
                <CircleCard summary={summary} />
              </div>
            ))}
          </Section>
        )}

        {session && (
          <Section
            title="Your circles"
            action={<Link href="/new" className="text-[13px] font-semibold text-gold">New circle</Link>}
          >
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
          </Section>
        )}

        {session && (
          <Section
            title="Your savings box"
            action={<Link href="/solo/new" className="text-[13px] font-semibold text-gold">New box</Link>}
          >
            {home.myBoxes.length === 0
              ? (
                  <Link href="/solo/new" className="press glass block rounded-[22px] p-5">
                    <div className="flex items-center gap-4">
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-2xl">🪙</div>
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
                              {' '}
                              {box.streak}
                              {' '}
                              in a row
                            </Badge>
                          )
                        : box.payment ? <Badge tone="sky">Due now</Badge> : null}
                    </div>
                  </Link>
                ))}
          </Section>
        )}

        <Section title="Open to join">
          {home.publicCircles.length === 0
            ? (
                <Card>
                  <p className="text-[14px] leading-relaxed text-muted">
                    No open circles right now. A circle only needs three people —
                    start one and send the link to two friends.
                  </p>
                </Card>
              )
            : home.publicCircles.map(summary => (
                <CircleCard key={summary.circle.id} summary={summary} />
              ))}
        </Section>

        {!session && (
          <>
            <Divider label="how it works" />
            <HowItWorks />
            <WhyNimiq />
            <Footer />
          </>
        )}
      </main>
    </>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-faint">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Landing({ deeplink }: { deeplink: string }) {
  return (
    <div className="w-full min-w-0 space-y-8 pt-3">
      <div className="rise space-y-4">
        <Badge tone="gold">Nimiq Pay mini app</Badge>

        <h1 className="text-[34px] font-extrabold leading-[1.06] tracking-[-0.025em]">
          Eight friends.
          <br />
          One pot.
          <br />
          <span className="gold-text">Your turn comes.</span>
        </h1>

        <p className="text-[15.5px] leading-relaxed text-muted">
          Everyone puts in
          {' '}
          <span className="font-semibold text-cream">500 NIM</span>
          {' '}
          a week. Every week one person takes the whole pot — and everyone gets a
          turn. It is the savings circle your family already runs, except the
          turns are kept for you and every payment is proved on the Nimiq chain.
        </p>
      </div>

      <div className="rise">
        <LandingRing />
      </div>

      <OpenInNimiq deeplink={deeplink} />

      <Promises />
    </div>
  )
}

/**
 * The three questions someone asks before installing anything that touches
 * their money. Answered before they have to ask.
 */
function Promises() {
  const promises: [string, string, string][] = [
    ['◇', 'Nobody holds the pot', 'Money goes wallet to wallet. Kolo has no address of its own — there is nothing for it to run off with.'],
    ['✓', 'Proved on the chain', 'A payment only counts once Kolo finds the matching transaction on Nimiq. Never on your word for it.'],
    ['⟡', 'Nothing to sign up for', 'No email, no password, no seed phrase. Your wallet is your account, and one signature gets you in.'],
  ]

  return (
    <ul className="space-y-2.5">
      {promises.map(([icon, title, body]) => (
        <li key={title} className="glass flex min-w-0 items-start gap-3 rounded-2xl px-4 py-3.5">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 text-[13px] font-bold text-gold">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-[14.5px] font-bold tracking-tight">{title}</h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function HowItWorks() {
  const steps: [string, string][] = [
    ['Start or join a circle', 'Pick the amount, the rhythm and how many people. Share the link — it starts by itself when the last seat fills.'],
    ['Pay your round', 'One tap sends NIM straight to whoever collects this round, with a memo attached to the transaction.'],
    ['The chain proves it', 'Kolo reads Nimiq and only marks you paid when it finds that exact payment. Everyone sees the same scoreboard.'],
    ['Your turn arrives', 'The whole pot lands in your wallet. Nobody held it in between, because nobody could.'],
  ]

  return (
    <ol className="space-y-4">
      {steps.map(([title, body], i) => (
        <li key={title} className="flex min-w-0 gap-3.5">
          <span className="tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 text-[13px] font-bold text-gold">
            {i + 1}
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function WhyNimiq() {
  return (
    <Card className="space-y-2">
      <h2 className="text-[15px] font-bold tracking-tight">Why this had to be built on Nimiq</h2>
      <p className="text-[13.5px] leading-relaxed text-muted">
        A savings circle is dozens of small, repeating payments. Anywhere else
        the fees eat them. NIM transfers cost effectively nothing and settle in
        about a second — and the memo field turns every one of them into a
        receipt anybody in the circle can check for themselves.
      </p>
    </Card>
  )
}

function Footer() {
  return (
    <footer className="space-y-2 pt-2 text-center">
      <p className="text-[12.5px] text-faint">
        Open source, MIT licensed.
        {' '}
        <a
          className="font-semibold text-muted underline underline-offset-2"
          href="https://github.com/OkeyAmy/kolo"
          target="_blank"
          rel="noreferrer noopener"
        >
          Read the code
        </a>
        .
      </p>
      <p className="text-[12.5px] text-faint">
        Kolo holds no funds and has no wallet address.
      </p>
    </footer>
  )
}
