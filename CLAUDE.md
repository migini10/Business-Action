# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bizness Action is a Next.js (App Router) app for an auto-insurance brokerage (courtier/apporteur d'affaires — not an insurance company itself). It manages quote requests (`Dossier`), client accounts, financial tracking (créances/dettes/paiements), and a WhatsApp bot (Meta Cloud API) that handles customer service, quote collection, and document upload end-to-end.

**Read `node_modules/next/dist/docs/` before writing App Router / Server Action code.** This repo pins a Next.js version (`^16.2.11`) newer than most training data — conventions and APIs may differ from what you expect.

## Commands

```bash
npm run dev              # Next.js dev server
npm run build             # production build
npm run lint               # eslint
npx tsc --noEmit           # typecheck (build has typescript.ignoreBuildErrors: true, so CI-equivalent correctness relies on this)
npm test                   # run the full test suite
```

Tests run via `tsx --test` (Node's built-in test runner, not Jest/Vitest) against files matching `src/lib/**/*.test.ts`, `src/lib/*.test.ts`, `src/components/ui/*.test.tsx`, `src/app/actions/*.test.ts`. To run a single file or subset, bypass the npm script and call tsx directly, keeping the same env/flags:

```bash
npx dotenv-cli -e .env.test -- tsx --experimental-test-module-mocks --test --require ./mock-css.js src/lib/whatsapp/step2.test.ts
```

- Tests load env from `.env.test`, which sets `TEST_DATABASE_URL`. `src/lib/test-prisma.ts` **refuses to run** (hard `process.exit(1)`) if `TEST_DATABASE_URL` is unset or equal to `DATABASE_URL` — tests must hit an isolated local Postgres (`127.0.0.1:55432` per `.env.test`), never dev/prod. Use `testPrisma` from that module in any test that touches the DB, never the default `@/lib/prisma` singleton.
- `mock-css.js` stubs `.css` imports and defines a no-op `WebSocket` global for the Node test environment (needed by component tests that import CSS or touch browser APIs).
- Prisma: `npx prisma migrate dev` / `npx prisma generate` / `npx prisma studio` as usual. `prisma.config.ts` points schema/migrations at `prisma/` and uses `DIRECT_URL` (falling back to `DATABASE_URL`) for the CLI.

## Architecture

### Data model (`prisma/schema.prisma`)
- `User` — clients and staff (`Role`: CLIENT/ADMIN/AGENT), unique by `phone`.
- `Dossier` — a quote request/file; the central entity. Tracks vehicle type, uploaded documents (recto/verso carte grise, CMC), status (`StatutDossier`), and optionally links to a `User` (phone-only tracking is supported for users without an account, via `TrackingSession`).
- `DossierDocument` — individual uploaded files per dossier (type × side), with an `enhancedStoragePath` for the image-enhancement pipeline and TTL fields (`expiresAt`/`deletedAt`).
- `Transaction` — the financial ledger (`TypeTransaction`: PAIEMENT/DETTE/CREANCE/REMBOURSEMENT) tied to a `User`. Balance is computed on the fly (not stored) — see `src/lib/finance.ts`, which applies signed magnitudes per type (`calculateClientBalance`); don't reintroduce naive unsigned summation.
- `WhatsAppConversation` / `WhatsAppMessage` — one conversation per `waId`, with a `botState` state machine (`WhatsAppBotState`: IDLE, MAIN_MENU, QUOTE_VEHICLE, QUOTE_CONFIRM, DOCUMENT_CHOICE, WAITING_FOR_{RECTO,VERSO,CMC}, TRACK_SELECT, HUMAN_SUPPORT) and an optional `activeDossierId` linking the conversation to the dossier being built.
- `MediaStaging` — a queue/staging table for inbound media (WhatsApp or web) before it's downloaded, validated, and attached to a `Dossier`; has its own retry/lease/status lifecycle (`StagingStatus`: RESERVED → DOWNLOADING → STORED → EXTRACTED → MOVED, with RETRYING/FAILED/EXPIRED).
- `docs/*.md` is a point-in-time architecture audit (Aug 2026) with a P0/P1/P2 risk list and a phased roadmap. Treat it as historical context, not current truth — e.g. it flags the balance calc as broken with unsigned sums, but `src/lib/finance.ts` already implements signed balances. Check the code before trusting a claim from there.

### Server Actions vs API routes
Business logic lives in `src/app/actions/*.ts` (Server Actions: auth, dossier, admin, client, whatsapp, first-password, reset-password). Webhooks and cron/worker endpoints live under `src/app/api/`:
- `api/webhooks/whatsapp/route.ts` — Meta webhook. Verifies `x-hub-signature-256` via HMAC (`WHATSAPP_APP_SECRET`) with `crypto.timingSafeEqual` before parsing. Handles inbound text/media messages and outbound delivery-status updates. Text messages are upserted transactionally then dispatched to `processAutoReply`; media messages are staged into `MediaStaging` inside the same transaction, then `processMediaStagingJobs()` runs in `after()` (post-response, non-blocking).
- `api/cron/worker/route.ts` and `api/cron/cleanup/route.ts` — cron-triggered endpoints (see `vercel.json` for schedule), gated by a `CRON_SECRET` bearer token. The worker drains `MediaStaging` jobs (`src/lib/worker/media.ts`).

### WhatsApp bot (`src/lib/customer-service/`)
A stateful conversational flow keyed off `WhatsAppConversation.botState`:
- `auto-reply.ts` is the entry point (`processAutoReply`) — dispatches by state/intent to `quote-flow.ts` (quote collection), `tracking-flow.ts` (dossier status lookup), `human-handoff.ts` (escalation to HUMAN_SUPPORT, after which the bot stops responding), and `knowledge/faq.ts`.
- `intent.ts` / `fuzzy-match.ts` / `language.ts` do intent detection and French/Wolof/English language detection; responses are localized per `finalLanguage`.
- `state-recovery.ts` (`recoverBotState`) is a defensive resync: if a conversation is `IDLE` but still has an `activeDossierId`, it reconstructs the correct in-flight state (e.g. after a crash/redeploy) rather than trusting the stored `botState` blindly. This runs both in the webhook (before routing media) and in `processAutoReply`.
- Numeric menu replies (`1`/`2`/`3`) are mapped to intents contextually (e.g. only in `MAIN_MENU` state) — free-text intent detection is the fallback.

### Auth
Two separate session systems: `admin_session` cookie (checked in `src/middleware.ts` for all `/admin/*` routes except `/admin/login`) for staff, and a client-side session (`src/lib/client-auth.ts` / `client-session`) for customer accounts. Password reset and first-password-change flows use OTP challenges (`PasswordResetChallenge`, `ChallengePurpose`) rather than plain reset links.

### IP handling
`src/middleware.ts` strips any client-supplied `x-businessaction-client-ip` header and re-sets it server-side (from `x-forwarded-for` in production, hardcoded `127.0.0.1` in dev) before it reaches `/suivi` routes — this is the trusted-IP source for rate limiting (`RateLimitWindow`). Don't trust `x-forwarded-for` directly elsewhere; go through this header.

### Database access
`src/lib/prisma.ts` is a singleton `PrismaClient` using the `pg` driver adapter over a `Pool`. TLS policy is resolved by `src/lib/database-ssl.ts` via `DATABASE_RUNTIME_SSL_MODE` (`disable`/`require`/`verify-full`, see `.env.example`) — **defaults to strict Supabase TLS** (pinned CA + `rejectUnauthorized: true`) when the var is absent or unrecognized, so Production is never silently weakened. `disable` exists only for a local/private Postgres (e.g. Docker on a DigitalOcean droplet reachable solely over a private network) — never set it against an internet-reachable host. `database-ssl.ts` also strips any `sslmode`/`sslcert`/`sslkey`/`sslrootcert` query params from the connection string before connecting, so a stray value embedded in `DATABASE_URL` can never override this policy. This is deliberate hardening, not boilerplate to simplify away. Note the Prisma CLI (`migrate`/`studio`/`generate`) is a separate mechanism — it reads TLS only from `sslmode=` in the URL itself, not from `DATABASE_RUNTIME_SSL_MODE`. Tests must use `src/lib/test-prisma.ts` instead (see Commands above), which enforces a separate `TEST_DATABASE_URL`.

### Maintenance scripts
`scripts/dev/clear_db.ts` performs a global delete and must never run against production. Root-level `fix_*.ts`/`fix_*.js` files are one-off data-repair scripts, not part of the app runtime.
