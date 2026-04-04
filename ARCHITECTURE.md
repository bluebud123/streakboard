# Streakboard — Architecture Reference

> **For AI assistants.** Dense, structured context. Read this before touching source files.

---

## Project Summary

Streakboard is a social study-streak tracker built on Next.js 14 App Router with Prisma 5 + Neon PostgreSQL as the data layer, deployed on Vercel. Users log daily study sessions (check-ins), manage hierarchical checklists (projects), track goals, and share public profiles. Key differentiators: revision-tracked checklists, collaborative/template project visibility modes, multi-log-per-day check-ins, and public profile pages with streak heatmaps.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server + Client Components, RSC by default |
| Language | TypeScript | Strict mode |
| ORM | Prisma 5 | `prisma generate && next build` |
| Database | PostgreSQL (Neon) | `DATABASE_URL` + `DIRECT_URL` env vars |
| Auth | NextAuth v5 (beta.25) | Credentials provider, bcryptjs hashing |
| Styling | Tailwind CSS v4 | PostCSS plugin (`@tailwindcss/postcss`) |
| Deployment | Vercel | `npx vercel --prod --yes` |

---

## Directory Structure

```
app/
  admin/              — Admin panel (isAdmin-gated); AdminClient.tsx for client UI
  api/
    admin/            — GET users list, DELETE user, PATCH site settings
    auth/             — NextAuth [...nextauth] catch-all handler
    check-username/   — GET: availability check for registration
    checkin/          — GET/POST/PATCH/DELETE study sessions (multi-log per day)
    checklists/       — Main checklist CRUD; action-based PATCH (see Key API Actions)
    checklists/import/— POST: import checklist from a public template (copy items)
    goals/            — GET/POST/PATCH/DELETE goals
    migrate-guest/    — POST: copy guest localStorage data into DB on signup/login
    profile/[username]/— GET: public profile data (direct Prisma, no auth cookie needed)
    signup/           — POST: user registration
    templates/        — GET: list PUBLIC_TEMPLATE checklists for discover page
  checklist/[slug]/   — Redirect → /project/[slug] (legacy URL support)
  dashboard/          — Main app (server component fetches data, DashboardClient.tsx handles UI)
  discover/           — Browse public templates; DiscoverClient.tsx
  guest/              — Guest mode: client-only, localStorage-backed, no auth required
  logs/               — All study sessions page; page.tsx (server) + LogsClient.tsx (client)
  login/              — Auth page
  project/[slug]/     — Public project view (read-only checklist tree + progress)
  signup/             — Registration page
  u/[username]/       — Public user profile (heatmap, stats, checklists)

components/
  ChecklistSection.tsx  — Core checklist UI: drag-drop reorder, inline edit, collapse,
                          revision badges, depth-aware rendering (sections/tasks/subtasks)
  MiniCalendar.tsx      — Calendar widget: renders check-in dots, multi-log totals,
                          "due for review" highlighting
  ProjectProgress.tsx   — Daily progress bar chart for a single project
  ChecklistImport.tsx   — Import checklist from JSON file
  ChecklistCard.tsx     — Card preview for discover/template listing
  ExamCountdown.tsx     — Days-until-exam widget
  GoalCard.tsx          — Individual goal display + progress
  Heatmap.tsx           — GitHub-style contribution heatmap for public profiles
  SessionProvider.tsx   — Thin wrapper re-exporting NextAuth SessionProvider
  ShareBanner.tsx       — Share link / visibility badge for projects
  StreakStats.tsx        — Current streak + stats display

lib/
  db.ts               — Prisma client singleton (prevents connection pool exhaustion in dev)
  streak.ts           — calcStreaks(checkIns) + localDateKey(date) — pure TS, no Prisma deps;
                        importable client-side for optimistic streak updates

prisma/
  schema.prisma       — Full DB schema (source of truth)

auth.ts               — NextAuth config: Credentials provider, session/JWT callbacks,
                        attaches user.id + user.username to session
```

---

## Data Model

Fields marked `?` are optional. All `id` fields are `cuid()`.

### User
```
id           String   @id
username     String   @unique
name         String
email        String   @unique
password     String   (bcrypt hash)
studyingFor  String
examDate     String?  ← String, NOT DateTime — never call .toISOString() on it
isPublic     Boolean  @default(true)
isAdmin      Boolean  @default(false)
createdAt    DateTime
```

### CheckIn
```
id        String   @id
userId    String
date      String   (YYYY-MM-DD local date string)
minutes   Int      @default(0)
note      String?
createdAt DateTime
@@index([userId, date])
```
Multiple CheckIns per (userId, date) are intentional — unique constraint was removed in S4. Always use `id` for updates/deletes.

### Checklist
```
id          String
userId      String
name        String
description String?
visibility  Visibility  (PRIVATE | PUBLIC_TEMPLATE | PUBLIC_COLLAB | PUBLIC_EDIT)
slug        String?     @unique  — generated on visibility change
templateOf  String?     — id of source checklist if imported
createdAt   DateTime
```

### ChecklistItem
```
id          String
checklistId String
parentId    String?   — null = top-level; self-referential tree
text        String
isSection   Boolean   @default(false)
depth       Int       (0 = section, 1 = task, 2 = subtask)
order       Int       (sort key within siblings)
createdAt   DateTime
@@index([parentId])
@@index([checklistId, order])
```

### ChecklistProgress
```
itemId  String
userId  String
done    Boolean   @default(false)
doneAt  DateTime?
@@unique([itemId, userId])
```

### ChecklistRevision
```
id        String
itemId    String
userId    String
createdAt DateTime
@@index([itemId, userId])
```
Each checkbox click appends one revision. Multiple revisions per (itemId, userId) are allowed. Revision count shown as `+N · <date>` badge. `-` button calls `removeLastRevision`.

### SiteSetting
```
key   String @id
value String
```
Currently used: `anonymousGraphs` (toggle public heatmap visibility).

---

## Key API Actions

All checklist mutations go through `PATCH /api/checklists` with a JSON body containing `action`.

| action | Description |
|---|---|
| `addItem` | Append item/section to checklist |
| `deleteItem` | Remove item + cascade children |
| `renameItem` | Update item text |
| `reorderItems` | Bulk update `order` + `parentId` after drag-drop |
| `checkItem` | Set `done=true`, `doneAt=now`, append one `ChecklistRevision` |
| `uncheckItem` | Set `done=false`, `doneAt=null` — does NOT add a revision |
| `removeLastRevision` | Delete most recent revision for (itemId, userId); if count reaches 0, also unchecks |
| `toggleProgress` | Used by public project page; toggles ChecklistProgress for viewer |
| `changeVisibility` | Updates `visibility` enum + generates/clears `slug` |
| `getSectionProgress` | Returns per-section per-participant done/total counts for collab view |

---

## Key UI Patterns

### Dashboard Layout (desktop)
```
lg:grid-cols-[280px_1fr_280px]
  Left col:   User stats, streak, exam countdown, goals
  Center col: Active checklist (ChecklistSection)
  Right col:  MiniCalendar + share/visibility panel
```

### Mobile Layout
3-tab bottom nav: **Projects** / **Log** / **Calendar**

### Checklist Tree Rendering
```
depth 0  isSection=true  → section header with collapse toggle + progress bar
depth 1  isSection=false → task row with checkbox + revision badge
depth 2  isSection=false → subtask row (indented)
```
- Drag-drop reorder uses `dragIdRef = useRef` (not `useState`) to avoid stale closure in `handleDrop`. Do not convert to state.
- Inline edit: double-click text → `contentEditable` or input, blur/Enter to save.
- Collapse state: local React state, not persisted.

### Revision Badge
Shown on checked items: `+N · MMM DD` (count of revisions, date of latest).
`-` button → `removeLastRevision` action. `+` button → `checkItem` again (adds another revision, allows re-check after uncheck).

### Public Profile (`/u/[username]`)
Fetches via `GET /api/profile/[username]` which uses direct Prisma — **not** an internal HTTP fetch — to avoid auth cookie forwarding issues in RSC.

---

## Serialization Rules

When passing data from Server Components to Client Components:

| Type | Rule |
|---|---|
| `DateTime` (Prisma) | Always call `.toISOString()` before passing as prop |
| `examDate` (String?) | Pass as-is — it's already a string, never call `.toISOString()` |
| Enum values | Pass as string literals; they serialize fine |

---

## Streak & Date Utilities (`lib/streak.ts`)

```ts
localDateKey(date: Date): string   // → "YYYY-MM-DD" in local timezone
calcStreaks(checkIns): { currentStreak, longestStreak, totalDays }
```

- `localDateKey` avoids UTC offset bugs (never use `toISOString().slice(0,10)`).
- `calcStreaks` is pure (no imports) — safe to import in both server and client code.

---

## Auth Flow

- `auth.ts` configures NextAuth with Credentials provider.
- `session.user.id` and `session.user.username` are injected via `jwt` + `session` callbacks.
- Server components call `auth()` directly. API routes call `auth()` for the session.
- Guest mode (`/guest`) bypasses auth entirely — uses `localStorage` for all data.
- On guest→auth migration: `POST /api/migrate-guest` with guest data; server merges into DB.

---

## Deployment

```bash
# Local dev
npm run dev                          # next dev on :3000

# Build (also runs prisma generate)
npm run build                        # prisma generate && next build

# Deploy to Vercel
npx vercel --prod --yes

# DB schema sync (uses .env.prod for production)
npx prisma db push

# Promote user to admin (run in Neon SQL console or psql)
UPDATE "User" SET "isAdmin" = true WHERE username = 'bluebud';
```

Environment variables required:
- `DATABASE_URL` — pooled Neon connection string
- `DIRECT_URL` — direct (non-pooled) Neon connection string (required by Prisma for migrations)
- `NEXTAUTH_SECRET` — random secret for JWT signing
- `NEXTAUTH_URL` — canonical app URL

---

## Feature History (Session Summary)

| Session | Features |
|---|---|
| S1 | Hierarchical item tree (sections/tasks/subtasks), drag-drop reorder, JSON import fix, visibility modal (PRIVATE/PUBLIC_TEMPLATE/PUBLIC_COLLAB/PUBLIC_EDIT), public tree view at `/project/[slug]` |
| S2 | Revision logging on checkbox, inline text editing (double-click), section collapse, inline item add, delete confirm dialog, per-section progress bars, drag stale-closure fix |
| S3 | Drag visual feedback (RAF-throttled amber border), stale-closure drag fix via `useRef`, revision `-/+` UI buttons, `Collab+Edit` visibility rename, mobile 3-tab layout |
| S4 | Multi-log per day (removed unique constraint on CheckIn), all-logs page (`/logs`), MiniCalendar shows historical multi-logs + review dots, larger revision buttons for mobile, project-specific share card |
