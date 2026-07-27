import type {
  Circle,
  Contribution,
  Member,
  Round,
  Swap,
  TrustRecord,
} from './types'
import { normalizeAddress, sameAddress } from './address'
import { trustRecord } from './trust'

export interface Profile {
  address: string
  displayName: string
  createdAt: string
}

/**
 * Everything Kolo persists, behind one interface.
 *
 * Two implementations ship: an in-memory one used by the tests and by a local
 * dev run with no database configured, and a Postgres one used in production.
 * Keeping the surface this narrow is what makes that swap safe.
 */
export interface Repository {
  getProfile: (address: string) => Promise<Profile | null>
  upsertProfile: (profile: Profile) => Promise<Profile>

  createCircle: (circle: Circle, creator: Member) => Promise<Circle>
  getCircle: (idOrCode: string) => Promise<Circle | null>
  updateCircle: (circle: Circle) => Promise<Circle>
  listPublicCircles: () => Promise<Circle[]>
  listCirclesForAddress: (address: string) => Promise<Circle[]>

  listMembers: (circleId: string) => Promise<Member[]>
  addMember: (member: Member) => Promise<Member>
  replaceMembers: (circleId: string, members: Member[]) => Promise<Member[]>

  listRounds: (circleId: string) => Promise<Round[]>
  replaceRounds: (circleId: string, rounds: Round[]) => Promise<Round[]>

  listContributions: (circleId: string) => Promise<Contribution[]>
  createContribution: (contribution: Contribution) => Promise<Contribution>
  updateContribution: (contribution: Contribution) => Promise<Contribution>
  listUnverifiedContributions: () => Promise<Contribution[]>

  listSwaps: (circleId: string) => Promise<Swap[]>
  getSwap: (id: string) => Promise<Swap | null>
  createSwap: (swap: Swap) => Promise<Swap>
  updateSwap: (swap: Swap) => Promise<Swap>

  trustFor: (address: string) => Promise<TrustRecord>
}

export class MemoryRepository implements Repository {
  private profiles = new Map<string, Profile>()
  private circles = new Map<string, Circle>()
  private members = new Map<string, Member[]>()
  private rounds = new Map<string, Round[]>()
  private contributions: Contribution[] = []
  private swaps: Swap[] = []

  async getProfile(address: string): Promise<Profile | null> {
    return this.profiles.get(normalizeAddress(address)) ?? null
  }

  async upsertProfile(profile: Profile): Promise<Profile> {
    const stored = { ...profile, address: normalizeAddress(profile.address) }
    this.profiles.set(stored.address, stored)
    return stored
  }

  async createCircle(circle: Circle, creator: Member): Promise<Circle> {
    this.circles.set(circle.id, circle)
    this.members.set(circle.id, [creator])
    return circle
  }

  async getCircle(idOrCode: string): Promise<Circle | null> {
    const direct = this.circles.get(idOrCode)
    if (direct)
      return direct
    const code = idOrCode.toUpperCase()
    return [...this.circles.values()].find(c => c.code === code) ?? null
  }

  async updateCircle(circle: Circle): Promise<Circle> {
    this.circles.set(circle.id, circle)
    return circle
  }

  async listPublicCircles(): Promise<Circle[]> {
    return [...this.circles.values()]
      .filter(c => c.visibility === 'public' && c.status !== 'abandoned')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async listCirclesForAddress(address: string): Promise<Circle[]> {
    const mine = new Set(
      [...this.members.entries()]
        .filter(([, members]) => members.some(m => sameAddress(m.address, address)))
        .map(([circleId]) => circleId),
    )
    return [...this.circles.values()]
      .filter(c => mine.has(c.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async listMembers(circleId: string): Promise<Member[]> {
    return [...(this.members.get(circleId) ?? [])].sort((a, b) => a.position - b.position)
  }

  async addMember(member: Member): Promise<Member> {
    const existing = this.members.get(member.circleId) ?? []
    this.members.set(member.circleId, [...existing, member])
    return member
  }

  async replaceMembers(circleId: string, members: Member[]): Promise<Member[]> {
    this.members.set(circleId, members)
    return members
  }

  async listRounds(circleId: string): Promise<Round[]> {
    return [...(this.rounds.get(circleId) ?? [])].sort((a, b) => a.index - b.index)
  }

  async replaceRounds(circleId: string, rounds: Round[]): Promise<Round[]> {
    this.rounds.set(circleId, rounds)
    return rounds
  }

  async listContributions(circleId: string): Promise<Contribution[]> {
    return this.contributions.filter(c => c.circleId === circleId)
  }

  async createContribution(contribution: Contribution): Promise<Contribution> {
    this.contributions.push(contribution)
    return contribution
  }

  async updateContribution(contribution: Contribution): Promise<Contribution> {
    this.contributions = this.contributions.map(c => c.id === contribution.id ? contribution : c)
    return contribution
  }

  async listUnverifiedContributions(): Promise<Contribution[]> {
    return this.contributions.filter(c => c.status === 'submitted')
  }

  async listSwaps(circleId: string): Promise<Swap[]> {
    return this.swaps
      .filter(s => s.circleId === circleId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getSwap(id: string): Promise<Swap | null> {
    return this.swaps.find(s => s.id === id) ?? null
  }

  async createSwap(swap: Swap): Promise<Swap> {
    this.swaps.push(swap)
    return swap
  }

  async updateSwap(swap: Swap): Promise<Swap> {
    this.swaps = this.swaps.map(s => s.id === swap.id ? swap : s)
    return swap
  }

  async trustFor(address: string): Promise<TrustRecord> {
    const target = normalizeAddress(address)
    const circleIds = [...this.members.entries()]
      .filter(([, members]) => members.some(m => sameAddress(m.address, target)))
      .map(([circleId]) => circleId)

    let roundsPaid = 0
    let roundsOnTime = 0
    let roundsMissed = 0
    let circlesCompleted = 0

    for (const circleId of circleIds) {
      const circle = this.circles.get(circleId)
      if (circle?.status === 'completed')
        circlesCompleted += 1

      const rounds = this.rounds.get(circleId) ?? []
      const members = this.members.get(circleId) ?? []
      const mine = members.find(m => sameAddress(m.address, target))
      const contributions = this.contributions.filter(
        c => c.circleId === circleId && sameAddress(c.fromAddress, target),
      )

      for (const round of rounds) {
        if (round.status === 'pending' || round.index === mine?.position)
          continue
        const paid = contributions.find(c => c.roundIndex === round.index && c.status === 'verified')
        if (paid) {
          roundsPaid += 1
          if (paid.verifiedAt && new Date(paid.verifiedAt) <= new Date(round.dueAt))
            roundsOnTime += 1
        }
        else if (round.status === 'incomplete') {
          roundsMissed += 1
        }
      }
    }

    return trustRecord({
      address: target,
      circlesJoined: circleIds.length,
      circlesCompleted,
      roundsPaid,
      roundsOnTime,
      roundsMissed,
    })
  }
}
