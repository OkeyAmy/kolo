/**
 * Renders Kolo's submission artwork from SVG so it can be regenerated and
 * tweaked instead of being an undocumented binary in the repo.
 *
 *   node scripts/make-assets.mjs
 *
 * Sizes match what the competition submission portal produced for Cycle I:
 *   icon.png       1024 x 1024
 *   thumbnail.jpg  1598 x 523
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT = 'submission'

// Same palette as the app (apps/web/app/globals.css) so the store listing and
// the product do not look like two different products.
const INK = '#0C0A10'
const SURFACE = '#1B1725'
const GOLD_LIGHT = '#FFD98A'
const GOLD = '#FFC24A'
const GOLD_DEEP = '#E39A12'
const CLAY = '#E8734A'
const CREAM = '#F6F1E9'
const MUTED = '#A99FBA'
const MINT = '#4FD6A0'

// Members get muted, closely related tones rather than one hue each. Eight
// saturated colours around a ring reads as a toy; this reads as people.
const MEMBER_TONES = ['#6E6482', '#5F6B7E', '#7C6A5E', '#5E7269', '#71627A', '#67707F', '#7A6E60', '#5C6E74']

const FONT = 'DejaVu Sans'

/** The pot mark: a savings box with a coin slot. Scales to any box. */
function potMark({ x, y, size, fill = 'url(#gold)' }) {
  const s = size / 32
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M6 13.5C6 10.4624 8.46243 8 11.5 8h9C23.5376 8 26 10.4624 26 13.5v6C26 24.7467 21.7467 29 16.5 29h-1C10.2533 29 6 24.7467 6 19.5v-6Z" fill="${fill}"/>
      <rect x="12.5" y="4" width="7" height="2.6" rx="1.3" fill="${fill}"/>
      <rect x="12.9" y="11.6" width="6.2" height="2.4" rx="1.2" fill="#2B1B00" opacity="0.52"/>
    </g>`
}

/**
 * A progress ring: how much of this round has been paid in. Same idea as the
 * one in the app, and it survives being shrunk to a 48px launcher icon in a way
 * that eight little avatars do not.
 */
function progressRing({ cx, cy, radius, stroke, progress }) {
  const circumference = 2 * Math.PI * radius
  return `
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none"
            stroke="${CREAM}" stroke-opacity="0.09" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none"
            stroke="url(#gold)" stroke-width="${stroke}" stroke-linecap="round"
            stroke-dasharray="${circumference * progress} ${circumference}"
            transform="rotate(-90 ${cx} ${cy})"/>`
}

/** Members arranged around a ring, in payout order, clockwise from the top. */
function memberRing({ cx, cy, radius, count, collectorIndex, paidCount, dot }) {
  let out = ''
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)

    if (i === collectorIndex) {
      out += `
        <circle cx="${x}" cy="${y}" r="${dot * 1.62}" fill="${GOLD}" opacity="0.14"/>
        <circle cx="${x}" cy="${y}" r="${dot * 1.24}" fill="none" stroke="${GOLD}" stroke-width="${dot * 0.13}"/>
        <circle cx="${x}" cy="${y}" r="${dot}" fill="url(#gold)"/>`
      continue
    }

    out += `<circle cx="${x}" cy="${y}" r="${dot * 0.9}" fill="${MEMBER_TONES[i % MEMBER_TONES.length]}"/>`
    if (i <= paidCount) {
      out += `
        <circle cx="${x + dot * 0.7}" cy="${y + dot * 0.7}" r="${dot * 0.42}" fill="${MINT}"/>
        <path d="M${x + dot * 0.52} ${y + dot * 0.72} l${dot * 0.14} ${dot * 0.15} l${dot * 0.24} -${dot * 0.28}"
              fill="none" stroke="${INK}" stroke-width="${dot * 0.11}" stroke-linecap="round" stroke-linejoin="round"/>`
    }
  }
  return out
}

// Every gradient here is userSpaceOnUse. With the default objectBoundingBox the
// coordinates below fall far outside 0..1 and every fill clamps to one flat stop.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="120" y1="0" x2="960" y2="1024">
      <stop offset="0" stop-color="${SURFACE}"/>
      <stop offset="1" stop-color="${INK}"/>
    </linearGradient>
    <radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="512" cy="150" r="740">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.26"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="250" y1="180" x2="800" y2="860">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="0.46" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${CLAY}"/>
    </linearGradient>
    <linearGradient id="potGold" gradientUnits="userSpaceOnUse" x1="7" y1="5" x2="25" y2="29">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="0.34" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${GOLD_DEEP}"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" rx="228" fill="url(#bg)"/>
  <rect width="1024" height="1024" rx="228" fill="url(#glow)"/>

  ${progressRing({ cx: 512, cy: 520, radius: 356, stroke: 48, progress: 0.625 })}
  ${potMark({ x: 512 - 236, y: 520 - 262, size: 472, fill: 'url(#potGold)' })}
</svg>`

const thumbnail = `<svg xmlns="http://www.w3.org/2000/svg" width="1598" height="523" viewBox="0 0 1598 523">
  <defs>
    <linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1598" y2="523">
      <stop offset="0" stop-color="#14111B"/>
      <stop offset="1" stop-color="${INK}"/>
    </linearGradient>
    <radialGradient id="glowA" gradientUnits="userSpaceOnUse" cx="1210" cy="250" r="560">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" gradientUnits="userSpaceOnUse" cx="80" cy="40" r="620">
      <stop offset="0" stop-color="${CLAY}" stop-opacity="0.15"/>
      <stop offset="1" stop-color="${CLAY}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="1040" y1="80" x2="1400" y2="440">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="0.5" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${CLAY}"/>
    </linearGradient>
    <linearGradient id="markGold" gradientUnits="userSpaceOnUse" x1="7" y1="5" x2="25" y2="29">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="0.4" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${GOLD_DEEP}"/>
    </linearGradient>
    <linearGradient id="goldText" gradientUnits="userSpaceOnUse" x1="92" y1="272" x2="620" y2="330">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
    <linearGradient id="potText" gradientUnits="userSpaceOnUse" x1="1120" y1="262" x2="1320" y2="300">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>

  <rect width="1598" height="523" fill="url(#bg)"/>
  <rect width="1598" height="523" fill="url(#glowA)"/>
  <rect width="1598" height="523" fill="url(#glowB)"/>

  ${potMark({ x: 92, y: 72, size: 72, fill: 'url(#markGold)' })}
  <text x="182" y="132" font-family="${FONT}" font-size="62" font-weight="bold"
        fill="${CREAM}" letter-spacing="-2">Kolo</text>

  <text x="92" y="252" font-family="${FONT}" font-size="53" font-weight="bold"
        fill="${CREAM}" letter-spacing="-1.5">Eight friends. One pot.</text>
  <text x="92" y="320" font-family="${FONT}" font-size="53" font-weight="bold"
        fill="url(#goldText)" letter-spacing="-1.5">Your turn comes.</text>

  <text x="92" y="386" font-family="${FONT}" font-size="27" fill="${MUTED}">
    Savings circles, verified on the Nimiq chain.
  </text>
  <text x="92" y="424" font-family="${FONT}" font-size="27" fill="${MUTED}">
    Kolo never holds your money.
  </text>

  <rect x="92" y="456" width="296" height="42" rx="21" fill="${GOLD}" fill-opacity="0.13"/>
  <text x="117" y="484" font-family="${FONT}" font-size="21" font-weight="bold" fill="${GOLD}">
    Nimiq Pay mini app
  </text>

  <g>
    <circle cx="1218" cy="262" r="190" fill="none" stroke="${CREAM}" stroke-opacity="0.09"
            stroke-width="3" stroke-dasharray="7 19"/>
    ${memberRing({ cx: 1218, cy: 262, radius: 190, count: 8, collectorIndex: 0, paidCount: 4, dot: 25 })}

    <text x="1218" y="228" text-anchor="middle" font-family="${FONT}" font-size="19"
          fill="${MUTED}" letter-spacing="3">ROUND 5 OF 8</text>
    <text x="1218" y="286" text-anchor="middle" font-family="${FONT}" font-size="46"
          font-weight="bold" fill="url(#potText)" letter-spacing="-1">3,500 NIM</text>
    <text x="1218" y="324" text-anchor="middle" font-family="${FONT}" font-size="21"
          fill="${MUTED}">4 of 7 paid in</text>
  </g>
</svg>`

await mkdir(OUT, { recursive: true })

await writeFile(join(OUT, 'icon.svg'), icon)
await writeFile(join(OUT, 'thumbnail.svg'), thumbnail)

await sharp(Buffer.from(icon)).png({ compressionLevel: 9 }).toFile(join(OUT, 'icon.png'))
await sharp(Buffer.from(thumbnail)).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(join(OUT, 'thumbnail.jpg'))

// A 512px icon is what a phone actually renders, and 96px is roughly what a
// mini-app list shows. Check the artwork at those sizes, not at 1024.
await sharp(Buffer.from(icon)).resize(512, 512).png({ compressionLevel: 9 }).toFile(join(OUT, 'icon-512.png'))
await sharp(Buffer.from(icon)).resize(96, 96).png({ compressionLevel: 9 }).toFile(join(OUT, 'icon-96.png'))

console.log('Wrote submission/icon.png (1024), icon-512.png, icon-96.png, thumbnail.jpg (1598x523)')
