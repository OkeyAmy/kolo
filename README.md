# Kolo

**Eight friends put in ⌁ 500 every week. Every week, one of them takes the whole pot. After eight weeks everyone has taken a turn.**

That is a savings circle — *ajo* in Nigeria, *tanda* in Mexico, *chama* in Kenya, *susu* in the Caribbean, *hui* in China. Hundreds of millions of people run one right now, on a WhatsApp group and a paper notebook, with one person holding everybody's cash.

Kolo is that circle, as a Nimiq Pay mini app. It keeps the turns, proves every payment on the Nimiq chain, and **never holds your money.**

<!-- Open on your phone, inside Nimiq Pay: -->
```
nimiqpay://miniapp?url=<your-deployment-host>
```

---

## Why it needed Nimiq

- **Small payments have to actually be small.** A circle is dozens of little recurring transfers. On most chains a ⌁ 500 contribution is eaten by gas. NIM transfers in Nimiq Pay cost effectively nothing and settle in about a second, which is the only reason this works at all.
- **The memo field is the receipt.** Every contribution goes out as `sendBasicTransactionWithData` tagged `kolo:<circle>:r<round>`. That turns an ordinary transfer into a public, permanent record of who paid into which round — no trust in Kolo required.
- **Nobody has to be the treasurer.** Money moves member → member. Kolo has no address, holds no balance, and cannot move anyone's funds.

## What Kolo will not do

Being explicit, because this is a money app:

- It **never holds funds.** Search the codebase: there is no Kolo wallet, no signer, no key.
- It **never marks a payment as paid on your word.** A contribution only turns green once a matching transaction — right sender, right recipient, exact amount, right memo — is found on the Nimiq chain.
- It **never reorders a circle by itself.** Turn order is fixed when the circle starts, and only changes when *two* members sign the same swap with their own keys.
- It **cannot claw money back** if somebody stops paying. No app can. The round is marked short and it shows on that member's record. Kolo says so plainly in the UI rather than pretending otherwise.
- The payout order is **never random.** It is join order, visible to everyone from the start.

## What you can do

| | |
| --- | --- |
| **Join in one tap** | Open in Nimiq Pay, sign once. No email, no password, no seed phrase. Under 20 seconds from tap to joined. |
| **Start a circle** | Amount, rhythm, how many people. Share the link. It starts by itself when the last seat fills. |
| **Pay your round** | One button. Straight to whoever collects this round, with the memo attached. |
| **Watch it verify** | Your tile flips to *Paid ✓* when the transaction is found on chain, with a link to the explorer. |
| **Save alone first** | A solo savings box with a streak, for when you have nobody to invite yet. Same rail, same proof. |
| **Swap turns** | Need the money sooner? Ask someone to trade. Both of you sign; both signatures stay on the record. |
| **Build a record** | Rounds paid, rounds on time, rounds missed — all counted from verified on-chain payments. |

Circles run in **NIM** (default, near-zero fees, memo receipts) or **USDT on Polygon** (the app warns you that you need POL for gas — Nimiq Pay's gas abstraction does not apply inside a mini app).

### Mainnet and testnet, side by side

Kolo serves both Nimiq chains from one deployment. A circle is pinned to whichever chain its creator's wallet was on when they made it, worked out from the block height the wallet reports — the two chains are tens of millions of blocks apart, so it is unambiguous. Payments are then only ever verified against that chain: **a testnet transfer can never settle a mainnet obligation.** Testnet circles carry a badge on every screen that shows them, because free money must never look like real money.

That means you can run the whole thing on free faucet NIM (Nimiq Pay → long-press settings for 10s → testnet → **Get free NIM**) without a separate deployment or a config change.

## Screens

<!-- Add before submitting: screenshot-1..4.jpg -->

## Run it

Node 20+, pnpm 10.

```bash
pnpm install
cp .env.example apps/web/.env.local     # everything is optional locally
pnpm dev                                 # binds 0.0.0.0 so a phone can reach it
```

Without `DATABASE_URL` Kolo runs on an in-memory store — the whole app works, it just resets when you restart.

### Testing inside Nimiq Pay

1. Put your phone and laptop on the same Wi-Fi.
2. Nimiq Pay → **Mini Apps** → **Custom URL** → your LAN address (`http://192.168.x.x:3000`).
3. For testnet: open the app menu and **long-press the settings button for 10 seconds** to reveal the dev menu, then switch network.
4. Free testnet NIM: **Get free NIM** on the empty home screen or in the Top Up modal — 110,000 per tap.

### Checks

```bash
pnpm typecheck
pnpm test           # 54 tests: round state machine, payment matching, swaps, signatures
pnpm db:migrate     # applies packages/core/src/db/schema.sql (needs DATABASE_URL)
pnpm security:scan  # no credentials in the repo
pnpm build

pnpm dev            # then, in another terminal:
node scripts/smoke.mjs http://localhost:3000
```

The smoke test stands in for three people with three phones: it generates real Ed25519 keys, derives their Nimiq addresses, signs the real login challenges, then drives the whole flow over HTTP — create, join, pay, swap with two signatures, solo box. Contributions correctly stay unverified, because nothing was put on chain.

## How it is built

```
apps/web/          Next.js (App Router) mini app + API routes
  lib/nimiq-client.ts   @nimiq/mini-app-sdk + window.ethereum, all wallet calls
  lib/signature.ts      Ed25519 verification, public key ↔ address binding
  lib/rpc.ts            read-only Albatross RPC (payment verification)
  lib/verifier.ts       finds the matching transaction, promotes the contribution
packages/core/     Pure domain: circles, rounds, swaps, solo boxes, trust
  src/circle.ts         round state machine and its invariants
  src/verify.ts         the transaction matcher
  src/swap.ts           two-signature position permutation
  src/db/               Postgres repository + schema, mirrors the in-memory one
```

Domain logic is pure and tested; the app layer does IO. Nothing that touches money is allowed to depend on client-supplied state.

Deploy anywhere a Next.js app runs. Set `DATABASE_URL` and `SESSION_SECRET`, apply `packages/core/src/db/schema.sql` with `pnpm db:migrate`, and point Nimiq Pay at the HTTPS URL.

## Licence

MIT — see [LICENSE](LICENSE).
