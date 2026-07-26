/**
 * On-chain memo encoding.
 *
 * Every Kolo payment carries a memo in the Nimiq transaction's data field. That
 * memo is what turns a plain transfer into a receipt anyone can audit without
 * trusting Kolo's database. Keep it short: the data field is size-limited and
 * every extra byte is fee the user pays for nothing.
 *
 *   circle round:  kolo:<code>:r<index>
 *   solo period:   kolo:s<code>:p<index>
 */

const CIRCLE_MEMO = /^kolo:([a-z0-9]{4,10}):r(\d{1,3})$/i
const SOLO_MEMO = /^kolo:s([a-z0-9]{4,10}):p(\d{1,3})$/i

export function circleMemo(code: string, roundIndex: number): string {
  return `kolo:${code.toLowerCase()}:r${roundIndex}`
}

export function soloMemo(code: string, periodIndex: number): string {
  return `kolo:s${code.toLowerCase()}:p${periodIndex}`
}

export type ParsedMemo =
  | { kind: 'circle', code: string, index: number }
  | { kind: 'solo', code: string, index: number }
  | null

export function parseMemo(memo: string): ParsedMemo {
  const solo = SOLO_MEMO.exec(memo)
  if (solo)
    return { kind: 'solo', code: solo[1].toLowerCase(), index: Number(solo[2]) }

  const circle = CIRCLE_MEMO.exec(memo)
  if (circle)
    return { kind: 'circle', code: circle[1].toLowerCase(), index: Number(circle[2]) }

  return null
}

export function encodeMemoHex(memo: string): string {
  return Array.from(new TextEncoder().encode(memo))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function decodeMemoHex(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!clean || clean.length % 2 !== 0)
    return ''
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  catch {
    return ''
  }
}
