# Streakboard Plan (authoritative)

**Owner:** @blue (yohsh9@gmail.com) · **Repo:** bluebud123/streakboard · **Stack:** Next.js 14 App Router, React 18, Prisma 5.22 + Neon, NextAuth v5, Tailwind, Vercel
**Time budget:** ~5–8 hrs/week until Nov 2026 viva, then maintenance-only.
**Philosophy:** Passion project. Monetize only to fund hosting. Never paywall anything currently free. Curation is the moat, not code.

This file replaces `.claude/STREAKBOARD_PLAN.md` (the Claude-web draft — see notes in that file's review). Keep this file tight. Update when a session ships something.

---

## Positioning (revised 2026-04-20)

> *Shared checklists for anything you're working toward.*

Streakboard is a **user-contributed marketplace of roadmaps** — structured lists of topics / milestones that people share, fork, and work through together. Scope is **any structured long-term goal**: exams, certifications, skills, fitness programs, book lists, side-project launches. Generic habits (drink water, floss) are out of scope — there must be a roadmap.

**Contribution model:** tiered open market.
- **Community tab:** anyone can mark a checklist public — no review, ranked by upvotes + activity.
- **Verified tab:** curator-reviewed (by @blue or trusted admins), gets a badge. Quality signal, not exclusivity.

Wedge = **shared + structured + streak.** Three primitives the generic habit trackers miss. The moat is (a) the library of contributed roadmaps, (b) the upvote/verification signal layer, (c) the accountability flywheel between people working the same list.

Not a habit tracker. Not a solo todo app. Not an exam-prep app (narrower than we want).

---

## What's already shipped (do not re-litigate)

Sessions keep suggesting these. They exist.

- **Caching layer:** `unstable_cache` wrappers in `app/dashboard/page.tsx` for `getCheckInDates`, `getArchivedChecklists`, `getRecentRequests`, tagged `checkins:${userId}` / `checklists:${userId}`, 30s revalidate. Mutation routes (`api/checkin`, `api/checklists`, `api/checklists/import`) call `revalidateTag` on every write.
- **Router cache tuning:** `next.config.mjs` `experimental.staleTimes { dynamic: 60, static: 300 }`.
- **Instant /logs nav:** sessionStorage key `streakboard:logs:v1` seeded on dashboard mount; `/logs` page is auth-only server-side, client hydrates from sessionStorage, revalidates via `/api/checkin`. `/logs/loading.tsx` + cold-visit skeleton in `LogsClient`.
- **Per-user deadlines:** `UserChecklistDeadline` model; every viewer can set a personal deadline; falls back to creator's default.
- **Shared progress for PRIVATE_COLLAB:** `applySharedProgress()` in dashboard RSC — any member checking an item shows checked for all.
- **Paste-to-create / markdown import:** `/api/checklists/import` parses `# / ## / - [ ]` markdown. Used by both file upload and template picker.
- **Templates:** USMLE Step 1, Ortho, AWS SAA, Bar, CFA L1, **MBBS (Universiti Malaya)** — last one contributed by @blue. Ortho is special-cased as a single canonical @blue-owned PUBLIC_EDIT checklist that new importers join as participants (so leaderboard works).
- **Rename affordance:** visible ✏️ button next to project title for owners (mobile-discoverable); double-click still works.
- **Custom confirm dialog:** `lib/confirm.tsx` Promise-based modal replaces all native `confirm()` / `alert()`. 10 call sites.
- **StreakBar:** 30-day activity strip on dashboard.
- **RouteProgress bar:** 3px amber with glow; covers inter-route navs.
- **Rotating quotes:** `lib/quotes.ts`, deterministic per user per day.
- **Sentry:** wired via `@sentry/nextjs`, no-ops if DSN unset.
- **Landing page (Session 1):** repositioned to open-market roadmaps framing. New hero, 3-step "How it works," marketplace teaser with preview Verified pill, `/discover` secondary CTA replaces dead-end `/guest`. `app/page.tsx`.

If a future session proposes any of the above, it hasn't read this file.

---

## Known open issues / small debts

Triage before big features.

- **No `prisma/migrations/` directory.** Schema is evolved via `prisma db push`. Fine while small, but migrations need to be baselined before Phase 2-level changes. Half-day of careful work when the time comes — not urgent yet.
- **`.env.example` doesn't exist.** 10-minute fix; do it in the next session that touches env.
- **`.gitattributes`** missing → CRLF warnings. 1-minute fix.
- **Profile page `/u/[username]`** is thin and doesn't show syllabus progress. Blocks Phase 3 (viral loop).
- **Landing page copy** still reads as generic habit-tracker. Highest single-lever item.
- **Discover page** has few public syllabi; empty-state reads as abandoned.

---

## Priority-ordered sessions

Each session is scoped to **~2–3 hours**. Ship one user-visible thing per session. If a session blows past the budget, stop and note it here under "what happened."

### Session 1 — Landing copy + hero reposition **[shipped 2026-04-20]**

Landing repositioned from "exam prep tracker" to "shared roadmaps for anything you're working toward." Single file (`app/page.tsx`). New hero, relabelled demo card (Ironman example), 3-step "How it works," marketplace teaser with a preview `✓ Verified` pill on MBBS, footer updated. CTAs: `/signup` + `/discover` (killed the `/guest` dead-end).

### Session 2 — Upvote / endorsement model **[next]**

**Why:** The marketplace needs a quality signal that isn't "curator picks." Upvotes is the simplest, most legible option and directly matches how the landing now frames Discover ("the best ones rise to the top").

**Scope:**
- New model `ChecklistUpvote { userId, checklistId, createdAt } @@id([userId, checklistId])` in `prisma/schema.prisma`.
- `prisma db push` (still pre-migrations-baseline).
- API: `POST /api/checklists/[id]/upvote` toggles. Auth-gated.
- Surface:
  - Upvote button + count on public checklist pages (`app/project/[slug]/...`).
  - Count on `DiscoverList` cards.
  - Sort Discover default = upvotes desc.
- `revalidateTag` on upvote writes so Discover refreshes.
- Self-upvote prevention.

**Files:** `prisma/schema.prisma`, `app/api/checklists/[id]/upvote/route.ts` (new), `app/discover/DiscoverList.tsx`, `app/project/[slug]/PublicProjectClient.tsx`.
**Acceptance:** I can upvote another user's public checklist; Discover re-sorts; I can't upvote my own.

### Session 3 — Tiered Discover (Verified / Community tabs)

**Why:** The landing explicitly promises a Verified tier. This delivers it.

**Scope:**
- Schema: add `verified Boolean @default(false)`, `verifiedAt DateTime?`, `verifiedBy String?` to `Checklist`.
- Admin-only endpoint (use existing `User.isAdmin`): `POST /api/admin/checklists/[id]/verify`.
- Discover page: two tabs, "Verified" default, "Community" second. Same upvote sort within each.
- `✓ Verified` badge (real, not the preview one on landing) wherever a checklist card/header renders publicly.
- Seed: mark the 6 built-in templates + any @blue-owned PUBLIC checklists as verified.

**Files:** `prisma/schema.prisma`, `app/api/admin/checklists/[id]/verify/route.ts` (new), `app/discover/DiscoverClient.tsx`, `app/discover/DiscoverList.tsx`, `components/ChecklistSection.tsx` (badge render), `app/project/[slug]/PublicProjectClient.tsx` (badge render).
**Acceptance:** Admin can flip verify; verified checklists show up in the Verified tab first and wear the badge everywhere; non-admins can't flip it.

### Session 4 — Confidence scoring (1–5)

**Why:** Still the biggest product differentiator vs a plain checklist. Demoted from Session 2 because the marketplace/contribution story is the bigger near-term bet.

**Scope:**
- Add `confidence Int?` (1–5) to `ChecklistProgress`.
- UI: check toggles done/not-done as today. Long-press (mobile) / right-click (desktop) opens a 5-dot selector. Default = done without confidence.
- Render filled dots on checked items that have a score.

**Files:** `prisma/schema.prisma`, wherever check toggles live (`grep "checklistProgress"`), `components/ChecklistSection.tsx`.
**Acceptance:** Mark a topic "3/5 confidence"; refresh; still there.

### Session 5 — Profile credibility polish

**Why:** Sessions 6+ amplify shares. Fix `/u/[username]` first.

**Scope:**
- Design that looks intentional at 0-day streak AND at 100-day streak.
- Add: "Member since" badge, "Roadmaps joined" count, "Next goal in X days" card if any joined checklist has a deadline (not just user-level `examDate`).
- Per joined roadmap: tiny progress ring (done topics / total).
- Public-safe: never show private checklists or note contents.

**Files:** `app/u/[username]/page.tsx` + client component.

### Session 6 — OG image for profile + public checklist pages

**Scope:**
- `app/u/[username]/opengraph-image.tsx` — avatar, username, streak, roadmaps-joined count.
- `app/project/[slug]/opengraph-image.tsx` — title, participant count, topic count, host avatar, verified badge if set.
- Edge runtime, `@vercel/og`. Test locally (fonts are fiddly).

### Session 7 — Stripe Payment Link "tip the curator"

**Why:** First monetization experiment. The tiered Discover turns this into a real contributor incentive — verified roadmap owners with tip jars have an actual reason to maintain their lists.

**Scope:**
- `tipLink String?` on `Checklist`.
- Owner-only input field in visibility/settings panel.
- "☕ Support @{owner}" button on public pages when set.
- 0% platform take.
- No `Subscription` / `Purchase` models, no webhooks, no Cohort tier.

### Session 8 — `.gitattributes`, `.env.example`, doc cleanup

**Why:** Small debts. Knock them out in one short session.

**Scope:**
- `.gitattributes` with `* text=auto eol=lf`.
- `.env.example` enumerating every `process.env.*` with fake values.
- 1-page `docs/ARCHITECTURE.md` covering RSC boundaries, cache tags, auth flow.

### Session 9+ — Iterate

By this point the product should feel different. Re-read this file, decide what Session 7 is based on **what users are actually complaining about**, not what's next in the plan. Candidates:

- **Streak freeze** (1 free per month) — top retention feature in streak apps.
- **Weekly email digest** (Resend + Vercel cron) — retention lever.
- **Referral attribution** (`?ref=username`, signed cookie) — no rewards, just tracking.
- **Invite-to-syllabus link** — killer feature for study groups.
- **Sitemap + JSON-LD Course schema** — SEO, long-tail organic traffic.
- **PWA manifest + install prompt** — daily-use app wants a home screen icon.
- **Paste-to-create polish** — already works, but the UX could be more prominent on "new project."

---

## Schema rewrite — explicitly rejected

The Claude-web plan proposes renaming `Checklist → Syllabus`, `ChecklistItem → Topic`, new enums, new participant model. **Do not do this.** Reasons:

1. The rename touches ~30 files and ~5 API routes for zero user-visible benefit.
2. The only useful ideas inside that refactor (confidence scoring, category as first-class, exam date) can land additively without renaming. Session 2 covers confidence. Category is already on template metadata. `examDate` is already on `User` and can be promoted to `Checklist` when needed.
3. Migrating without a `prisma/migrations/` baseline on a production DB with real users is risky.
4. Time pressure: viva prep intensifies late 2026. A 4-week refactor with no user-visible delta is how passion projects die.

**If a future session insists on the rename, re-read this section first.** The burden of proof is on the rename, not on the status quo.

---

## Explicit do-not list

Drawing from the web plan's anti-goals plus things I've seen Claude drift toward in practice:

1. **No social graph** (follows, likes, comments) until core primitives are proven.
2. **No gamification** beyond streaks (XP, levels, avatars). Habitica owns that; not our wedge.
3. **No AI-generated syllabi.** Cheap to generate, expensive to maintain, devalues the curation moat. Skip permanently.
4. **No native mobile apps.** PWA first.
5. **No team/org accounts / Cohort tier** until tip jar (§Session 6) makes real money for 3+ months.
6. **No new paid dependencies** (Algolia, Clerk, PostHog Pro) without owner approval.
7. **No full visual redesign.** Iterate on copy and IA. The slate+amber palette is fine.
8. **No migrations off Neon, NextAuth, Prisma, Vercel.** They work.
9. **No `prisma db push` on production after Session 2.** Baseline migrations first if schema changes.
10. **No fake social proof.** <500 users = no counter strip. Be honest; early-and-curated is a better frame than small-and-pretending.
11. **No generic-habit framing.** The wedge is *structured roadmaps*, not "build daily habits." If copy drifts toward habit-tracker language ("daily habits," "routine builder"), reject it.
12. **No narrowing back to exam-prep-only.** The scope was deliberately broadened 2026-04-20 to cover any structured long-term goal. Exam prep is the best-developed example, not the whole product.

---

## Metrics (own-sanity check, not a dashboard)

Check monthly. If Sessions 1–6 don't move the acquisition and retention numbers within 3 months, **the positioning is wrong, not the features.** Stop shipping and talk to users.

| Metric | Baseline | 3-month | 12-month |
|---|---|---|---|
| Registered users | <100 | 300 | 2,000 |
| **D7 retention** (% who check in 7d after signup) | ? | 30% | 40% |
| Weekly active | ? | 100 | 500 |
| Public syllabi (non-seed) | ~1 | 10 | 50 |
| Median participants / public syllabus | small | 8 | 15 |
| Donations (MYR/month) | 0 | 50 | 300 |

**D7 retention is the single most important metric for a streak product.** Add this instrumentation before Session 6 — at minimum, a daily cron that logs "user X made first check-in on day Y," so you can compute cohorts later.

---

## Cost ceiling (missing from the web plan, adding here)

Set a number before growth hits it:

- **Vercel + Neon free tiers** cover <1k WAU comfortably.
- **Hard ceiling: MYR 200/month infra cost.** If it crosses, do one of: (a) shift cold reads to Vercel edge cache aggressively, (b) move Neon to a cheaper region if latency allows, (c) enable donations more prominently.
- **Do not scale infra in anticipation.** Wait for actual bills.

---

## Session hand-off protocol

When a session ends, the session that ran it should:

1. Update the "What's already shipped" list above with anything new.
2. Append to the "Session log" below — one line per session, date + one-sentence summary.
3. If the session discovered a blocker that changes the priority order, note it in the relevant Session entry and flag at the top of this file.
4. If a session shipped something that contradicts the plan, **update the plan, don't leave the contradiction.**

---

## Session log

- *(Pre-plan)* 69b2ca5 — Deadline filter, PRIVATE_COLLAB sync, mobile typography, quotes.
- *(Pre-plan)* 2511364 — Per-user deadlines, StreakBar, confirm dialog, instant /logs nav.
- *(Pre-plan)* 94c0a0f — Rename pencil, MBBS template, perf layer (unstable_cache, revalidateTag, staleTimes).
- *(Pre-plan)* MBBS import 500 fix — revalidateTag + JSON serialization in `/api/checklists/import`. Uncommitted at plan-write time.
- *(Plan written)* 2026-04-19 — Authoritative plan established; web plan superseded.
- *2026-04-20* — Positioning revised from exam-prep-only to open-market roadmaps (any structured long-term goal + tiered Verified/Community contribution + upvote ranking).
- *2026-04-20* — **Session 1 shipped.** Landing rewritten to new positioning. `app/page.tsx`.

---

## Final note to future sessions

If this plan looks wrong to you with fresh eyes, **say so and propose a change** — don't silently deviate. The worst failure mode is a session that quietly ignores the plan and ships something orthogonal. The second-worst is a session that blindly follows an outdated plan. Read the "What's already shipped" list first, always.

The user is @blue. Med student. Viva late 2026. Has limited time. Has taste. Don't waste a session on scaffolding when a 2-hour user-visible win is available.
