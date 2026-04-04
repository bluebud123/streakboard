# Streakboard — Gemini Delegation Brief

> **Purpose:** This file is a self-contained implementation guide for an AI collaborator (Gemini).
> It covers four areas: (1) Explore page improvements, (2) User Settings page (new),
> (3) UI polish, and (4) Vercel deployment instructions.
> All Gemini recommendations from the prior review are incorporated.

---

## Project Overview

**Streakboard** is a study-streak tracker built with:

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 — dark theme (`bg-slate-950/900/800`) |
| Database | Neon PostgreSQL via Prisma 5 |
| Auth | NextAuth.js v5 — JWT + Credentials provider |
| Deploy | Vercel (alias: `streakboard-phi.vercel.app`) |

**Key conventions:**
- Server components fetch data; client components (`"use client"`) handle interaction
- API lives entirely in `app/api/` — use `PATCH` with `action` field for mutations
- Optimistic UI: update state immediately, revert on API failure
- Dark palette: `slate-950` (page bg) → `slate-900` (card) → `slate-800` (inner card)
- Accent: `amber-500` (primary), `emerald-500` (success), `red-400` (danger)

---

## Prisma Schema (key models)

```
User          — id, username, name, email, password, studyingFor, examDate?,
                isPublic (bool, default true), isAdmin (bool), createdAt
Checklist     — id, userId, name, description?, visibility (enum), slug? (unique),
                templateOf?, createdAt
ChecklistItem — id, checklistId, parentId?, text, isSection, depth, order
ChecklistParticipant — checklistId + userId (@@unique)
ChecklistProgress    — itemId + userId (@@unique), done, doneAt
ChecklistRevision    — itemId, userId, createdAt
CheckIn       — id, userId, date (YYYY-MM-DD string), minutes, note?, studyTime?, createdAt
SiteSetting   — key (PK), value
```

Visibility enum: `PRIVATE | PUBLIC_TEMPLATE | PUBLIC_COLLAB | PUBLIC_EDIT`

---

## Task 1 — Explore Page Improvements

### Current State
- **File:** `app/discover/page.tsx` (server) + `app/discover/DiscoverClient.tsx` (client)
- DB query: `visibility: { in: ["PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"] }` — correct
- `DiscoverClient` already has: confirmation popup, no auto-redirect, success in-card state
- **Known bug:** If a user sets a project to PUBLIC_COLLAB and the `changeVisibility` API action
  fails to generate a slug, the project gets a `null` slug. The page still renders it (slug is
  optional on the card), but it has no shareable `/project/[slug]` link.

### What to Build / Fix

**1a. Debug the "project not appearing" issue**

In `app/api/checklists/route.ts`, find the `changeVisibility` action. Verify it:
- Calls `prisma.checklist.update({ where: { id: checklistId }, data: { visibility, slug } })`
- Generates a slug like: `${slugify(name)}-${shortId}` when switching from PRIVATE → public
- Ensure the slug is also generated if `slug` is currently null and visibility is already public

Fix: add a guard — if `slug` is null and new visibility is not PRIVATE, always generate one:
```ts
const slug = (visibility !== "PRIVATE" && !existing.slug)
  ? `${slugify(checklist.name)}-${nanoid(6)}`
  : existing.slug;
```

**1b. Add search + filter to Explore page**

In `app/discover/page.tsx`, pass a `description` field to cards.

In `app/discover/DiscoverClient.tsx`, add client-side search:
- Add a text `<input>` search box at the top of each section
- Filter cards by `name` or `ownerUsername` matching the search string (case-insensitive)
- No server round-trips needed — filter the already-fetched array

**1c. Show project description in cards**

The `Checklist` model has a `description String?` field. Include it in the discover query and
render it in `DiscoverClient` below the owner line (2-line clamp, `text-xs text-slate-500`).

**1d. Show owner profile link**

The card already has `ownerUsername`. Wrap it in:
```tsx
<Link href={`/u/${card.ownerUsername}`} className="hover:text-slate-300 transition-colors">
  @{card.ownerUsername}
</Link>
```

### Files to Modify
- `app/discover/page.tsx` — add `description` and pass to cards
- `app/discover/DiscoverClient.tsx` — search input, description display, profile link
- `app/api/checklists/route.ts` — fix slug generation guard in `changeVisibility`

---

## Task 2 — User Settings Page (NEW — currently a dead link)

The dashboard header already links to `/settings` but the route does not exist.

### Files to Create

#### `app/settings/page.tsx` (server component)
```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, username: true, email: true,
              studyingFor: true, examDate: true, isPublic: true },
  });
  if (!user) redirect("/login");

  return <SettingsClient user={user} />;
}
```

#### `app/settings/SettingsClient.tsx` (client component)

Sections (each with its own Save button):

**Profile section** — editable fields:
| Field | Input type | Notes |
|-------|-----------|-------|
| Display name | text | required |
| Username | text | must be unique — call `/api/check-username` on blur |
| Email | email | must be unique |
| Studying for | text | e.g. "USMLE Step 1" |
| Exam date | date | optional |
| Profile visibility | toggle | `isPublic` — if off, `/u/[username]` shows 404 |

**Security section:**
| Field | Input type |
|-------|-----------|
| Current password | password |
| New password | password |
| Confirm new password | password |

**API calls:**
- Profile save → `PATCH /api/settings` with `{ action: "updateProfile", ...fields }`
- Password change → `PATCH /api/settings` with `{ action: "changePassword", currentPassword, newPassword }`

**UX:**
- Show success/error inline below each section (green/red text, not alert())
- Username uniqueness: call existing `GET /api/check-username?username=xxx` on blur
- Page header: `← Dashboard` link top-left, same style as `/admin` page

#### `app/api/settings/route.ts` (new API route)

```ts
// PATCH /api/settings
// action: "updateProfile" | "changePassword"

// updateProfile: validate uniqueness of username/email (excluding current user),
//   then prisma.user.update(...)

// changePassword: bcrypt.compare(currentPassword, user.password),
//   if match: bcrypt.hash(newPassword, 12) → prisma.user.update(...)
//   if no match: return 400 { error: "Current password is incorrect" }
```

Use `bcryptjs` (already installed — used in `app/api/signup/route.ts`).

### Files to Create
- `app/settings/page.tsx`
- `app/settings/SettingsClient.tsx`
- `app/api/settings/route.ts`

---

## Task 3 — UI Polish

### 3a. Toast Notification System

**Install:** `npm install sonner`

**Add to root layout** (`app/layout.tsx`):
```tsx
import { Toaster } from "sonner";
// inside <body>:
<Toaster theme="dark" position="bottom-right" richColors />
```

**Usage pattern** — replace all silent `.catch(() => {})` blocks in `ChecklistSection.tsx`
and `DashboardClient.tsx` with:
```ts
import { toast } from "sonner";
// on optimistic update failure:
toast.error("Change not saved — please try again.");
// on success (optional, for non-obvious actions):
toast.success("Session logged!");
```

**Key locations to add toasts:**
- `ChecklistSection.tsx`: `checkItem`, `uncheckItem`, `removeRevision`, `deleteItem`,
  `saveEdit`, `submitAddItem`, `saveVisibility` — on failure
- `DashboardClient.tsx`: `handleAddLog`, `handleEditLog`, `handleDeleteLog` — on failure

### 3b. Revision History Tooltip

In `ItemNode` in `ChecklistSection.tsx`, the revision count badge `+3 · Jan 12` already shows.
Add a `title` attribute so hovering shows the full context:

```tsx
<span
  className="text-xs text-amber-500/60 shrink-0 font-mono whitespace-nowrap"
  title={`Reviewed ${item.revisions.length}×. Unchecking keeps your history; use − to remove the last review entry.`}
>
  +{item.revisions.length}{dateStr ? ` · ${dateStr}` : ""}
</span>
```

### 3c. Schema: Add Index on ChecklistParticipant(userId)

In `prisma/schema.prisma`, add to `ChecklistParticipant`:
```prisma
@@index([userId])
```

Then run: `npx prisma db push`

### 3d. (Optional / Lower priority) API Refactor

The `PATCH /api/checklists` handler is ~400 lines. Consider extracting action handlers into
`lib/actions/checklists/` sub-files. This is a refactor-only task — no behaviour changes.
**Do this last** after all features are working and tested.

---

## Task 4 — Vercel Deployment

### One-time setup (if not already done)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login (browser will open)
npx vercel login
```

### Environment Variables (must be set in Vercel Dashboard)

Go to: **vercel.com → streakboard project → Settings → Environment Variables**

| Variable | Where to find it |
|----------|-----------------|
| `DATABASE_URL` | Neon dashboard → Connection string (pooled) |
| `DIRECT_URL` | Neon dashboard → Connection string (direct/non-pooled) |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` or use any long random string |
| `NEXTAUTH_URL` | `https://streakboard-phi.vercel.app` |

### Deploy Command

From the project root (`C:\Users\TAN\streakboard`):

```bash
npx vercel --prod --yes
```

This will:
1. Generate Prisma client
2. Run `next build`
3. Upload build artifacts
4. Alias to `streakboard-phi.vercel.app`

### After adding new env vars

If you add new env vars to `.env` locally, add them to Vercel via:
```bash
npx vercel env add VARIABLE_NAME production
```
Then redeploy.

### If schema changes

Always run `npx prisma db push` **before** deploying, as Vercel does not run migrations.

---

## Build Order for Gemini

Execute in this order to avoid breaking changes:

1. **Schema** — add `@@index([userId])` to `ChecklistParticipant` → `npx prisma db push`
2. **Explore fix** — fix `changeVisibility` slug guard in `app/api/checklists/route.ts`
3. **Explore UI** — update `app/discover/page.tsx` + `app/discover/DiscoverClient.tsx`
4. **Settings API** — create `app/api/settings/route.ts`
5. **Settings UI** — create `app/settings/page.tsx` + `app/settings/SettingsClient.tsx`
6. **Toast system** — `npm install sonner`, update `app/layout.tsx`, add toasts in key components
7. **Revision tooltip** — one-line change in `ChecklistSection.tsx`
8. **`npm run build`** — fix any TypeScript errors
9. **`npx vercel --prod --yes`** — deploy

---

## Verification Checklist

- [ ] `/discover` shows both Templates and Open Projects sections
- [ ] A project set to PUBLIC_COLLAB appears in Open Projects within seconds of saving
- [ ] Joining a project → stays on `/discover` → success state shown in card
- [ ] Visiting `/dashboard` after joining shows the new project in Projects panel
- [ ] `/settings` loads (no redirect to dashboard)
- [ ] Updating name/username/email saves correctly — success message shown
- [ ] Password change: wrong current password → error shown; correct → updates silently
- [ ] Username already taken → error on blur before even submitting
- [ ] Optimistic checkbox failure → toast appears bottom-right
- [ ] `npm run build` → zero TypeScript errors
- [ ] `npx vercel --prod --yes` → deployment completes, alias resolves

---

## File Map (all paths relative to `C:\Users\TAN\streakboard`)

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `@@index([userId])` to ChecklistParticipant |
| `app/api/checklists/route.ts` | Fix slug guard in `changeVisibility` |
| `app/discover/page.tsx` | Include `description` in query + pass to cards |
| `app/discover/DiscoverClient.tsx` | Search input, description display, profile link |
| `app/api/settings/route.ts` | **NEW** — updateProfile + changePassword actions |
| `app/settings/page.tsx` | **NEW** — server component, auth guard, load user |
| `app/settings/SettingsClient.tsx` | **NEW** — full settings UI |
| `app/layout.tsx` | Add `<Toaster>` from sonner |
| `components/ChecklistSection.tsx` | Add toasts on failure, revision tooltip |
| `app/dashboard/DashboardClient.tsx` | Add toasts on log failure |
