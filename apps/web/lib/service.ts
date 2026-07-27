import type { Circle, Contribution, Repository, Round } from '@kolo/core'
import type { CircleSummary, CircleView, HomeView, MemberView, PaymentInstruction } from './views'
import {
  circleMemo,
  currentRound as currentRoundOf,
  defaultDisplayName,
  potTotal,
  roundObligations,
  sameAddress,
} from '@kolo/core'
import { getRepository } from '@kolo/core/db'
import { refreshCircle } from './verifier'

export function repo(): Repository {
  return getRepository()
}

export async function loadCircle(
  idOrCode: string,
  viewer: string | null,
): Promise<CircleView | null> {
  const store = repo()
  const found = await store.getCircle(idOrCode)
  if (!found)
    return null

  // Verify anything outstanding before rendering, so a member who just paid
  // sees "verified" rather than "pending" when the page comes back.
  await refreshCircle(store, found.id)

  const circle = (await store.getCircle(found.id)) ?? found
  const [members, rounds, contributions, swaps] = await Promise.all([
    store.listMembers(circle.id),
    store.listRounds(circle.id),
    store.listContributions(circle.id),
    store.listSwaps(circle.id),
  ])

  const round = currentRoundOf(rounds)
  const obligations = round ? roundObligations(round, members, contributions) : []

  const memberViews: MemberView[] = members.map((member) => {
    const obligation = obligations.find(o => sameAddress(o.member.address, member.address))
    const mine = contributions.filter(c => sameAddress(c.fromAddress, member.address))
    const missedRounds = rounds.filter(
      r => r.status === 'incomplete'
        && r.index !== member.position
        && !mine.some(c => c.roundIndex === r.index && c.status === 'verified'),
    )

    return {
      ...member,
      isYou: Boolean(viewer && sameAddress(member.address, viewer)),
      isRecipient: Boolean(round && sameAddress(member.address, round.recipientAddress)),
      state: obligation?.state ?? 'due',
      txHash: obligation?.contribution?.txHash ?? null,
      roundsPaid: mine.filter(c => c.status === 'verified').length,
      roundsMissed: missedRounds.length,
    }
  })

  const you = memberViews.find(m => m.isYou) ?? null

  return {
    circle,
    members: memberViews,
    rounds,
    currentRound: round,
    contributions,
    swaps,
    potAmount: potTotal(circle.amount, circle.seats),
    seatsTaken: members.length,
    you,
    payment: buildPayment(circle, round, memberViews, you),
    memberSince: you?.joinedAt ?? null,
    // Position order is fixed at activation, so whoever holds the next seat is
    // already known — worth showing, because it is the question everyone asks.
    nextRecipientName: round
      ? memberViews.find(m => m.position === round.index + 1)?.displayName ?? null
      : null,
  }
}

function buildPayment(
  circle: Circle,
  round: Round | null,
  members: MemberView[],
  you: MemberView | null,
): PaymentInstruction | null {
  if (!round || !you || circle.status !== 'active')
    return null
  if (round.status !== 'collecting')
    return null
  if (you.state !== 'due' && you.state !== 'late')
    return null

  const recipient = members.find(m => sameAddress(m.address, round.recipientAddress))
  return {
    recipient: round.recipientAddress,
    recipientName: recipient?.displayName ?? defaultDisplayName(round.recipientAddress),
    amount: circle.amount,
    currency: circle.currency,
    memo: circleMemo(circle.code, round.index),
    roundIndex: round.index,
  }
}

async function summarize(circle: Circle, viewer: string | null): Promise<CircleSummary> {
  const store = repo()
  const [members, rounds, contributions] = await Promise.all([
    store.listMembers(circle.id),
    store.listRounds(circle.id),
    store.listContributions(circle.id),
  ])

  const round = currentRoundOf(rounds)
  const obligations = round ? roundObligations(round, members, contributions) : []
  const mine = viewer ? obligations.find(o => sameAddress(o.member.address, viewer)) : undefined
  const recipient = round
    ? members.find(m => sameAddress(m.address, round.recipientAddress))
    : undefined

  return {
    circle,
    seatsTaken: members.length,
    roundIndex: round?.index ?? 0,
    potAmount: potTotal(circle.amount, circle.seats),
    recipientName: recipient?.displayName ?? null,
    youOwe: mine?.state === 'due' || mine?.state === 'late',
    youCollect: mine?.state === 'recipient' && round?.status === 'collecting',
  }
}

export async function loadHome(viewer: string | null, displayName: string | null): Promise<HomeView> {
  const store = repo()

  const [mine, publicCircles, trust] = await Promise.all([
    viewer ? store.listCirclesForAddress(viewer) : Promise.resolve([]),
    store.listPublicCircles(),
    viewer ? store.trustFor(viewer) : Promise.resolve(null),
  ])

  const mineIds = new Set(mine.map(c => c.id))
  const joinable = publicCircles.filter(c => c.status === 'open' && !mineIds.has(c.id))

  const [myCircles, openCircles] = await Promise.all([
    Promise.all(mine.map(c => summarize(c, viewer))),
    Promise.all(joinable.slice(0, 8).map(c => summarize(c, viewer))),
  ])

  return {
    address: viewer,
    displayName,
    trust,
    myCircles,
    publicCircles: openCircles,
  }
}

/** Guard used by every write route: the caller must already be in the circle. */
export function assertMember(view: CircleView): void {
  if (!view.you)
    throw new Error('You are not a member of this circle.')
}

export function contributionFor(
  contributions: Contribution[],
  address: string,
  roundIndex: number,
): Contribution | null {
  return contributions.find(
    c => c.roundIndex === roundIndex && sameAddress(c.fromAddress, address),
  ) ?? null
}
