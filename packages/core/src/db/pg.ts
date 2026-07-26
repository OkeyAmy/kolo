import type { NeonQueryFunction } from '@neondatabase/serverless'
import type { Profile, Repository } from '../store'
import type {
  Circle,
  Contribution,
  Member,
  Round,
  SoloBox,
  Swap,
  TrustRecord,
} from '../types'
import { neon } from '@neondatabase/serverless'
import { normalizeAddress, sameAddress } from '../address'
import { trustRecord } from '../trust'

type Row<T> = { data: T }

/**
 * Postgres-backed repository (Neon). Mirrors MemoryRepository exactly; the two
 * are interchangeable, which is what lets the whole app run locally with no
 * database at all.
 */
export class PgRepository implements Repository {
  private sql: NeonQueryFunction<false, false>

  constructor(connectionString: string) {
    this.sql = neon(connectionString)
  }

  async getProfile(address: string): Promise<Profile | null> {
    const rows = await this.sql`
      select data from profiles where address = ${normalizeAddress(address)}
    ` as Row<Profile>[]
    return rows[0]?.data ?? null
  }

  async upsertProfile(profile: Profile): Promise<Profile> {
    const stored = { ...profile, address: normalizeAddress(profile.address) }
    await this.sql`
      insert into profiles (address, data) values (${stored.address}, ${JSON.stringify(stored)})
      on conflict (address) do update set data = excluded.data
    `
    return stored
  }

  async createCircle(circle: Circle, creator: Member): Promise<Circle> {
    await this.sql`
      insert into circles (id, code, status, visibility, data)
      values (${circle.id}, ${circle.code}, ${circle.status}, ${circle.visibility}, ${JSON.stringify(circle)})
    `
    await this.addMember(creator)
    return circle
  }

  async getCircle(idOrCode: string): Promise<Circle | null> {
    const rows = await this.sql`
      select data from circles where id = ${idOrCode} or code = ${idOrCode.toUpperCase()} limit 1
    ` as Row<Circle>[]
    return rows[0]?.data ?? null
  }

  async updateCircle(circle: Circle): Promise<Circle> {
    await this.sql`
      update circles
      set status = ${circle.status}, visibility = ${circle.visibility}, data = ${JSON.stringify(circle)}
      where id = ${circle.id}
    `
    return circle
  }

  async listPublicCircles(): Promise<Circle[]> {
    const rows = await this.sql`
      select data from circles
      where visibility = 'public' and status <> 'abandoned'
      order by created_at desc limit 50
    ` as Row<Circle>[]
    return rows.map(r => r.data)
  }

  async listCirclesForAddress(address: string): Promise<Circle[]> {
    const rows = await this.sql`
      select c.data from circles c
      join members m on m.circle_id = c.id
      where m.address = ${normalizeAddress(address)}
      order by c.created_at desc
    ` as Row<Circle>[]
    return rows.map(r => r.data)
  }

  async listMembers(circleId: string): Promise<Member[]> {
    const rows = await this.sql`
      select data from members where circle_id = ${circleId} order by position asc
    ` as Row<Member>[]
    return rows.map(r => r.data)
  }

  async addMember(member: Member): Promise<Member> {
    await this.sql`
      insert into members (circle_id, address, position, data)
      values (${member.circleId}, ${normalizeAddress(member.address)}, ${member.position}, ${JSON.stringify(member)})
      on conflict (circle_id, address) do update set position = excluded.position, data = excluded.data
    `
    return member
  }

  async replaceMembers(circleId: string, members: Member[]): Promise<Member[]> {
    for (const member of members)
      await this.addMember({ ...member, circleId })
    return members
  }

  async listRounds(circleId: string): Promise<Round[]> {
    const rows = await this.sql`
      select data from rounds where circle_id = ${circleId} order by idx asc
    ` as Row<Round>[]
    return rows.map(r => r.data)
  }

  async replaceRounds(circleId: string, rounds: Round[]): Promise<Round[]> {
    for (const round of rounds) {
      await this.sql`
        insert into rounds (circle_id, idx, status, data)
        values (${circleId}, ${round.index}, ${round.status}, ${JSON.stringify(round)})
        on conflict (circle_id, idx) do update set status = excluded.status, data = excluded.data
      `
    }
    return rounds
  }

  async listContributions(circleId: string): Promise<Contribution[]> {
    const rows = await this.sql`
      select data from contributions where circle_id = ${circleId} order by created_at asc
    ` as Row<Contribution>[]
    return rows.map(r => r.data)
  }

  async listBoxContributions(boxId: string): Promise<Contribution[]> {
    const rows = await this.sql`
      select data from contributions where box_id = ${boxId} order by created_at asc
    ` as Row<Contribution>[]
    return rows.map(r => r.data)
  }

  async createContribution(contribution: Contribution): Promise<Contribution> {
    await this.sql`
      insert into contributions (id, circle_id, box_id, from_address, status, data)
      values (
        ${contribution.id}, ${contribution.circleId}, ${contribution.boxId},
        ${normalizeAddress(contribution.fromAddress)}, ${contribution.status},
        ${JSON.stringify(contribution)}
      )
    `
    return contribution
  }

  async updateContribution(contribution: Contribution): Promise<Contribution> {
    await this.sql`
      update contributions set status = ${contribution.status}, data = ${JSON.stringify(contribution)}
      where id = ${contribution.id}
    `
    return contribution
  }

  async listUnverifiedContributions(): Promise<Contribution[]> {
    const rows = await this.sql`
      select data from contributions where status = 'submitted' order by created_at asc limit 200
    ` as Row<Contribution>[]
    return rows.map(r => r.data)
  }

  async listSwaps(circleId: string): Promise<Swap[]> {
    const rows = await this.sql`
      select data from swaps where circle_id = ${circleId} order by created_at desc
    ` as Row<Swap>[]
    return rows.map(r => r.data)
  }

  async getSwap(id: string): Promise<Swap | null> {
    const rows = await this.sql`select data from swaps where id = ${id}` as Row<Swap>[]
    return rows[0]?.data ?? null
  }

  async createSwap(swap: Swap): Promise<Swap> {
    await this.sql`
      insert into swaps (id, circle_id, status, data)
      values (${swap.id}, ${swap.circleId}, ${swap.status}, ${JSON.stringify(swap)})
    `
    return swap
  }

  async updateSwap(swap: Swap): Promise<Swap> {
    await this.sql`
      update swaps set status = ${swap.status}, data = ${JSON.stringify(swap)} where id = ${swap.id}
    `
    return swap
  }

  async createBox(box: SoloBox): Promise<SoloBox> {
    await this.sql`
      insert into boxes (id, code, owner_address, data)
      values (${box.id}, ${box.code}, ${normalizeAddress(box.ownerAddress)}, ${JSON.stringify(box)})
    `
    return box
  }

  async getBox(idOrCode: string): Promise<SoloBox | null> {
    const rows = await this.sql`
      select data from boxes where id = ${idOrCode} or code = ${idOrCode.toUpperCase()} limit 1
    ` as Row<SoloBox>[]
    return rows[0]?.data ?? null
  }

  async updateBox(box: SoloBox): Promise<SoloBox> {
    await this.sql`update boxes set data = ${JSON.stringify(box)} where id = ${box.id}`
    return box
  }

  async listBoxesForAddress(address: string): Promise<SoloBox[]> {
    const rows = await this.sql`
      select data from boxes where owner_address = ${normalizeAddress(address)} order by created_at desc
    ` as Row<SoloBox>[]
    return rows.map(r => r.data)
  }

  async trustFor(address: string): Promise<TrustRecord> {
    const target = normalizeAddress(address)
    const circles = await this.listCirclesForAddress(target)

    let roundsPaid = 0
    let roundsOnTime = 0
    let roundsMissed = 0
    let circlesCompleted = 0

    for (const circle of circles) {
      if (circle.status === 'completed')
        circlesCompleted += 1

      const [rounds, members, contributions] = await Promise.all([
        this.listRounds(circle.id),
        this.listMembers(circle.id),
        this.listContributions(circle.id),
      ])

      const mine = members.find(m => sameAddress(m.address, target))
      const paidByMe = contributions.filter(c => sameAddress(c.fromAddress, target))

      for (const round of rounds) {
        if (round.status === 'pending' || round.index === mine?.position)
          continue
        const paid = paidByMe.find(c => c.roundIndex === round.index && c.status === 'verified')
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
      circlesJoined: circles.length,
      circlesCompleted,
      roundsPaid,
      roundsOnTime,
      roundsMissed,
    })
  }
}
