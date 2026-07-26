import type { TrustRecord } from './types'

/**
 * Trust record.
 *
 * Every input here is derived from transactions that were verified on the Nimiq
 * chain, never from self-reported activity. The score exists to answer one
 * question a person actually asks before joining a circle with a stranger:
 * "have they paid before, and did they pay on time?"
 *
 * Newcomers are labelled `new`, not scored badly. Having no history is not the
 * same as having bad history, and treating it that way would make the app
 * hostile to exactly the users Nimiq is trying to onboard.
 */

export interface TrustInput {
  address: string
  circlesJoined: number
  circlesCompleted: number
  roundsPaid: number
  roundsOnTime: number
  roundsMissed: number
}

const MIN_HISTORY = 3

export function trustRecord(input: TrustInput): TrustRecord {
  const attempted = input.roundsPaid + input.roundsMissed

  if (attempted < MIN_HISTORY) {
    return {
      ...input,
      score: 50,
      label: 'new',
    }
  }

  const reliability = input.roundsPaid / attempted
  const punctuality = input.roundsPaid > 0 ? input.roundsOnTime / input.roundsPaid : 0
  const completion = input.circlesJoined > 0
    ? input.circlesCompleted / input.circlesJoined
    : 0

  // Paying at all matters most; paying on time second; finishing what you
  // started third. Weights live here, in the app, so they can be tuned without
  // rewriting anybody's history — the history is the verified payments.
  const raw = reliability * 0.6 + punctuality * 0.25 + completion * 0.15
  const score = Math.round(raw * 100)

  return { ...input, score, label: labelFor(score, input.roundsMissed) }
}

function labelFor(score: number, missed: number): TrustRecord['label'] {
  if (missed > 0 && score < 60)
    return 'at-risk'
  if (score >= 90)
    return 'trusted'
  if (score >= 70)
    return 'reliable'
  return 'building'
}

export const TRUST_LABEL_COPY: Record<TrustRecord['label'], { title: string, blurb: string }> = {
  'new': { title: 'New here', blurb: 'No circle history yet.' },
  'building': { title: 'Building', blurb: 'Has paid before, still early.' },
  'reliable': { title: 'Reliable', blurb: 'Pays their rounds.' },
  'trusted': { title: 'Trusted', blurb: 'Never missed a round.' },
  'at-risk': { title: 'Missed rounds', blurb: 'Has left a circle short before.' },
}
