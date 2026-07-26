/**
 * Nimiq addresses arrive from the wallet in user-friendly form
 * ("NQ07 0000 0000 ...") but arrive from the RPC in the same form with
 * different spacing habits. Every comparison in Kolo goes through here, because
 * a whitespace mismatch on an address comparison is a payment that silently
 * never verifies.
 */

const NIMIQ_ADDRESS = /^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/
const EVM_ADDRESS = /^0x[0-9a-f]{40}$/i

/** Canonical form used for storage and every equality check: no spaces, upper. */
export function normalizeAddress(address: string): string {
  const compact = address.replace(/\s+/g, '').toUpperCase()
  if (compact.startsWith('0X'))
    return `0x${compact.slice(2).toLowerCase()}`
  return compact
}

export function isNimiqAddress(address: string): boolean {
  return NIMIQ_ADDRESS.test(normalizeAddress(address))
}

export function isEvmAddress(address: string): boolean {
  return EVM_ADDRESS.test(normalizeAddress(address))
}

export function isValidAddress(address: string): boolean {
  return isNimiqAddress(address) || isEvmAddress(address)
}

export function sameAddress(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b)
}

/** Display form: NQ07 0000 0000 ... in groups of four. */
export function formatAddress(address: string): string {
  const compact = normalizeAddress(address)
  if (!compact.startsWith('NQ'))
    return compact
  return compact.match(/.{1,4}/g)?.join(' ') ?? compact
}

/** Compact display for tight UI: NQ07 0000 … GJKV */
export function shortAddress(address: string): string {
  const pretty = formatAddress(address)
  if (!pretty.startsWith('NQ'))
    return `${pretty.slice(0, 6)}…${pretty.slice(-4)}`
  const parts = pretty.split(' ')
  return `${parts.slice(0, 2).join(' ')} … ${parts.at(-1)}`
}

/**
 * Deterministic display name for an address that has not set one, so the UI
 * never shows a raw address where a person's name belongs.
 */
const ANIMALS = [
  'Otter', 'Falcon', 'Heron', 'Ibex', 'Lynx', 'Marlin', 'Oryx', 'Puffin',
  'Quokka', 'Raven', 'Sable', 'Tapir', 'Vervet', 'Wren', 'Yak', 'Zebu',
]
const COLOURS = [
  'Amber', 'Cobalt', 'Coral', 'Indigo', 'Jade', 'Ochre', 'Plum', 'Slate',
]

export function defaultDisplayName(address: string): string {
  const compact = normalizeAddress(address)
  let hash = 0
  for (let i = 0; i < compact.length; i++)
    hash = (hash * 31 + compact.charCodeAt(i)) >>> 0
  return `${COLOURS[hash % COLOURS.length]} ${ANIMALS[(hash >> 5) % ANIMALS.length]}`
}

/** Stable 0-360 hue for avatars, derived from the address. */
export function addressHue(address: string): number {
  const compact = normalizeAddress(address)
  let hash = 0
  for (let i = 0; i < compact.length; i++)
    hash = (hash * 131 + compact.charCodeAt(i)) >>> 0
  return hash % 360
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0)
    return '?'
  if (parts.length === 1)
    return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
