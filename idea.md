# Kolo — Product & Strategy Doc

**Target:** Nimiq Mini Apps Competition (miniappscompetition.com), Cycle I submission → Cycle II resubmission if not a winner.

---

## 1. One-line pitch

**Kolo turns the savings circle your family already runs on WhatsApp into a Nimiq Pay mini app — non-custodial, on-chain-verified, and impossible to run alone.**

(Kolo = Nigerian word for a savings box. The mechanic is a ROSCA: ajo/esusu in Nigeria, tanda in Mexico, chama in Kenya, hui in China, susu in the Caribbean, tontine in Francophone Africa.)

---

## 2. Problem + why now

A **ROSCA** (rotating savings and credit association) works like this: 8 people each put in $20 every week. Each week one member takes the whole $160 pot. After 8 weeks everyone has paid in $160 and everyone has taken out $160 — but seven of them got a lump sum earlier than they could have saved it alone.

- An estimated **hundreds of millions to over a billion people** run these informally, mostly outside banking systems.
- They run today on **WhatsApp groups, paper notebooks, and one trusted "treasurer" who holds everyone's cash.**
- Three failure modes, all of them well-known to anyone who has been in one: the treasurer disappears with the pot; someone skips their contribution and nobody has proof; nobody agrees on whose turn it is.

**Why now / why Nimiq specifically:**

1. **Fee floor.** A ROSCA is many small recurring payments. On most chains a $5 weekly contribution is destroyed by gas. NIM transactions in Nimiq Pay are effectively free and settle in ~1s. This use case is only viable on a chain with Nimiq's cost profile — that is a genuine, defensible reason for this app to exist *here* and not as an Ethereum dApp.
2. **On-chain memo.** `sendBasicTransactionWithData` attaches text to a NIM transfer. Every contribution becomes a permanent, publicly-verifiable receipt (`kolo:<circleId>:r<round>`). The notebook problem disappears without us holding a cent.
3. **Distribution.** Nimiq Pay already has the wallet, the user base, and a deeplink. A savings circle is inherently multi-player — see §3.

---

## 3. Why this angle wins

### 3a. It is the only submission whose growth loop is the product

Scoring is **25 points for Marketing & distribution** — the same weight as functionality. Most entrants will treat that as "post on X and hope." Kolo's core mechanic *cannot function with one user*: to use it at all, a member must recruit 4–9 people, and each of those people must **install Nimiq Pay and hold NIM to participate.**

That is the sentence that wins with this specific jury. The scoring is done by **Nimiq Community Council members** — NIM holders whose interest is NIM adoption, and Nimiq's own [2026 Outlook](https://www.nimiq.com/blog/nimiq-2026-outlook/) states the goal as "the most efficient paths to onboard more NIM users and increase transaction activity." Kolo is a machine that converts one user into eight, and every one of those users makes a recurring NIM transaction on a schedule, forever. No other category in the idea list does that structurally — tip jars, invoicing, games and content unlocks are all one-to-one or one-to-many-passive.

### 3b. The competitive field (Cycle I, 12 submissions) has left this wide open

Public submissions as of 26 Jul 2026:

| App | What it is | Overlap risk |
|---|---|---|
| XcrowHub | P2P escrow, custodial signer | Money app, but 1:1 deals, custodial |
| Nimiq Invoice Pay | Invoicing | 1:1 |
| TipWall | Creator tipping | 1:1 |
| UnlockMedia | Pay-per-view | 1:1 |
| Roundtrip | Trip expense splitting | **Closest** — but settle-once, no rounds, no recurring commitment, no trust history |
| Nimiq Bazar | Local POS inventory | Solo tool |
| NimiqStake | Staking + leaderboard | Solo tool |
| NimJump | Anti-cheat arcade game | Game |
| nimga | AI image gen | Solo tool |
| NimAgent | Conversational crypto | Solo tool |
| Nimiq Radio | Radio | Solo tool |
| VeriLock | (submitted, PR open) | Unknown |

**Nine of twelve are single-player.** The one social-money entry (Roundtrip) settles a past expense; Kolo creates a forward commitment with a recurring schedule. No entrant occupies the **Social** category with a group-formation product. Nimiq's own ideas page lists "Group Savings — pool NIM with friends toward a shared goal" as a suggestion, which confirms they want this shape; Kolo is the strictly better version (rotating payout, so *every* member gets a lump sum, not just one shared goal).

### 3c. It is credibly non-custodial, which is the trust story every money app in this field is missing

Kolo **never holds funds and has no wallet of its own.** Contributions are direct member→recipient NIM transfers signed in Nimiq Pay. Kolo's job is bookkeeping: whose turn it is, who has paid, and proving it against the chain. This kills the "the treasurer ran off" failure mode *and* the "is this a money transmitter?" problem, and it is a sharper answer than XcrowHub's custodial signer.

The tagline for the pitch: **"We never touch your money. We just make sure everyone can see who did."**

### 3d. Reuse of the existing repo is real but small — and that's fine

Carried over from CSPR Sentinel: the Next.js App Router + TypeScript monorepo, the Drizzle/Neon repository pattern, the deterministic state-machine + policy-engine discipline (which maps almost 1:1 onto round state), `/api/health`, the security scan script, and the vitest setup. **Everything Casper is deleted** — the chain, the x402 payment layer, the Odra contract, the MCP server, the agent planner, the desktop dashboard. See CLAUDE.md §"What dies, what lives."

---

## 4. MVP scope (must ship)

Hackathon-sized. Everything here is required for a judge to score Functionality above "Competent."

1. **Zero-password onboarding.** Open in Nimiq Pay → `init()` → `listAccounts()` → sign a login challenge with `nimiq.sign()` → session. No email, no seed phrase, no form. Target: **under 20 seconds.**
2. **Create a circle.** Name, contribution amount, currency (NIM default), cadence (weekly/monthly), member count, payout order (join order or shuffled-once-at-start, fixed and visible).
3. **Join by invite.** Share sheet emits `nimiqpay://miniapp?url=<app>/j/<code>`. Tap → Nimiq Pay opens Kolo on the join screen.
4. **Pay your round.** One button. Calls `sendBasicTransactionWithData` with memo `kolo:<circleId>:r<round>` straight to **this round's recipient**. USDT-on-Polygon circles use `eth_sendTransaction` → ERC-20 `transfer`.
5. **On-chain verification.** Backend polls the public Nimiq RPC, matches the tx hash + recipient + amount + memo, and only then marks the contribution *Verified*. **A contribution is never marked paid on the client's word.** Every row links to the explorer.
6. **Circle view (the money screen).** Round N of M, who's collecting this round, a paid/unpaid grid of member avatars, days remaining, and a "Pay ⌁ 500 NIM" button. This is the screenshot that gets submitted.
7. **Trust record.** Per-member: circles completed, rounds paid on time, rounds missed. Derived entirely from verified on-chain events. Visible before you join a circle with a stranger.
8. **Public circles.** 2–3 open circles a judge can join in one tap without knowing anybody. **This is what makes a multiplayer app demoable in 3 minutes — do not skip it.**
9. **Solo Kolo box.** A personal savings box with a target, a cadence and a streak, for the user who opens the app with nobody to invite yet. Same payment rail: a NIM transfer to *your own second address* (or a self-set aside amount) with memo `kolo:solo:<boxId>:w<week>`, verified on chain exactly like a circle contribution. Solves the cold-start problem — the app is never empty on first open — and gives judges a full, satisfying flow they can complete alone in 40 seconds. **This is the single highest-value addition to the MVP.**
10. **Emergency swap.** Two members trade payout positions. Requester picks a target position, the counterparty gets a request, **both sign the swap with `nimiq.sign()`**, and only then does the order change. Both signatures are stored and shown in the circle's history, so the new order is provably consented to rather than admin-edited. This is the feature that answers the obvious "what if I need the money *this* month?" objection, and it's the clearest demonstration in the whole app that Kolo is governed by member signatures, not by Kolo.

## 5. Stretch (only if MVP is done and polished)

- Nudge a late member (push via device identifier / in-app).
- Circle chat / round notes.
- Shareable end-of-circle card ("Our circle paid out ⌁ 40,000 across 8 members, 100% on time") — free marketing artifact.
- Localization via `window.nimiqPay.language` — es / pt / de first (cheap points on Design & UX and a real fit for the target user).

**Scope warning:** items 9 and 10 add roughly a day of work to a four-day plan. If the Cycle I cutoff turns out to be 28 Jul rather than 30 Jul, ship 1–8 plus **solo mode** and hold emergency swap for the first post-submission update — "at least one meaningful update" is a Month-3 payout requirement anyway, and a signed swap is a strong thing to ship into it.

## 6. What "done" looks like on judging day

**The 3-minute demo, in order:**

1. Judge taps the deeplink in the submission. Nimiq Pay opens Kolo. **No signup screen.** (0:00–0:15)
2. Home shows *Kolo Council Circle — 6/8 seats filled, ⌁ 500 weekly*. One tap: **Join**. Nimiq Pay's native dialog asks them to sign. (0:15–0:40)
3. They're in the circle view. It's their round-3 obligation. Tap **Pay ⌁ 500** → native Nimiq Pay confirmation → paid. (0:40–1:10)
4. Their tile flips to *Verified ✓* about a second later, with a live link to the transaction on the Nimiq explorer, memo visible on-chain. (1:10–1:40)
5. The header updates: *Round 3 pot ⌁ 4,000 → @maria collects Friday.* Judge sees the whole group's state, not just their own. (1:40–2:15)
6. Trust tab: their record just got its first green mark. Circle history shows real completed rounds from real users acquired during early access. (2:15–2:40)
7. Closing beat — **the swap.** A member asks to trade positions ("my rent is due"), the counterparty signs, the order visibly changes, and both signatures sit in the history. Kolo did not decide that; the two members did. (2:40–3:00)

*(If the judge arrives with no circle and no friends, the alternate path is the **solo box**: set a target, tap Save ⌁ 500, verified on chain, streak starts. Complete flow, 40 seconds, zero other humans required.)*

**Non-demo criteria that must also be true on judging day:**

- Public GitHub repo, **MIT licensed** (the current Apache-2.0 LICENSE must be replaced).
- No secrets in the repo; RPC/DB access server-side only.
- Live HTTPS URL, up continuously through judging *and for 3 months after* (payout milestones require it).
- Submission via PR to `nimiq/miniappscompetition-submissions`: `submission.yaml`, `README.md`, `icon.png`, `thumbnail.jpg`, 4 screenshots.
- ≤250-word description covering what it does, who it's for, how it uses Nimiq Pay.
- Demo video (optional but scored under storytelling — do it).
- Real users from the Skool community in at least two live circles, and visible progress posts. Marketing is 25 points; it is not optional and it cannot be faked in the last 48 hours.

---

## 7. Open risks & unknowns

| # | Risk | Severity | Handling |
|---|---|---|---|
| 1 | **Cycle I submission deadline is not published as a date.** Rules say deadlines come "through official Nimiq social media"; the calendar shows Pitch 30 Jul, winners 1 Aug; the site countdown implies ~1 Aug. Last accepted submission PR: 25 Jul. | **High** | Treat **28 Jul** as the internal deadline. Confirm the exact cutoff in the Skool "Technical Support" channel or the Registration Dashboard **today**. |
| 2 | Marketing (25 pts) needs real users and community presence; four days is not enough to earn full marks. | **High** | Two-shot strategy: submit v1 to Cycle I (small field, real chance), then — per the rules, non-winning apps may re-enter with significant improvements — submit v2 to Cycle II (11 Aug–3 Sep) with real usage numbers, testimonials, and Sip & Ship attendance behind it. |
| 3 | Deeplink parameter passing: `nimiqpay://miniapp?url=your-app.com` is documented, but URL-encoded paths/queries inside `url=` are **not** documented. | **High** — invite links are the growth loop | Test on-device day 1. Fallback: plain 6-character join codes typed into the app; the deeplink then only needs the bare origin. |
| 4 | Multiplayer demo with zero users. | Medium | Pre-seeded public circles + a seeded "Council Circle" that is genuinely live. |
| 5 | Round defaults (member doesn't pay). | Medium | Grace window → round marked *incomplete*, recipient notified, defaulter's trust record marked. Non-custodial means we cannot and do not claw back — say so plainly in the UI. Honest > magic. |
| 6 | USDT-on-Polygon circles need the user to hold POL for gas, and a mini-app ERC-20 transfer does **not** get Nimiq Pay's gas abstraction. | Medium | NIM is the default and the recommended path; USDT circles are offered with an explicit "you need POL for gas" warning. This also serves the NIM bonus points. |
| 7 | Public RPC (`rpc.nimiqwatch.com`) rate limits / availability. | Medium | Verified reachable (`getBlockNumber` → 57169870 on 26 Jul 2026). Cache aggressively, back off, and store the tx hash regardless so verification is retryable. Identify a second RPC before launch. |
| 8 | Money-adjacent app: any hint of custody, yield, or chance-based payout could trip the rules (gambling is explicitly off-limits). | Medium | Payout order is deterministic and fixed at circle start — **never random**. No yield, no fees, no custody in the competition build. |
| 9 | Council members may not know what a ROSCA is. | Low-Medium | The README and video must open with the 8-people-$20-a-week example, not the word "ROSCA." |
| 10 | Requires a Nimiq Pay install + real NIM to test properly. | Low | Testnet: hidden dev menu (long-press settings 10s) → testnet → free NIM button (110,000 per request). |

---

## 8. Name candidates

| Name | Rationale | Notes |
|---|---|---|
| **Kolo** ✅ recommended | Nigerian for savings box. Four letters, pronounceable everywhere, warm rather than fintech-cold, no crypto cliché, no Nimiq trademark overlap. | Check `kolo.app` / `getkolo.app`; a Hungarian dev tool named "kolo" exists but different class. |
| **Isusu** | Igbo name for exactly this practice. Maximally authentic. | Harder to spell/pronounce for a European jury. |
| **Roundpot** | Describes the mechanic in one word. Zero explanation needed. | Generic, weaker as a brand. |
| **Chipin** | Instantly legible in English. | Crowded name space. |
| **Tanda** | Latin American name for the same practice; large Spanish-speaking Nimiq community. | Existing US fintech used this name — collision risk. |

**Recommendation: Kolo.** Repo `kolo`, package `kolo`, domain `kolo.app` (fallback `getkolo.app` / `kolo.cash`). Avoid any name starting with "Nimiq" — several Cycle I entrants did it and it reads as borrowed credibility rather than a product.
