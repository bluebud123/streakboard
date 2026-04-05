# Streakboard — AI Context File

> Feed this file to Gemini CLI at the start of every session:
> `gemini --context GEMINI.md`

## Tech Stack (IMPORTANT — read carefully before suggesting changes)

- **Framework:** Next.js 14 **App Router** — NOT Vite, NOT Create React App
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 — dark theme `slate-950/900/800`, accent `amber-500`
- **Database:** Neon PostgreSQL via **Prisma 5** — NOT Prisma 7 (not released yet)
- **Auth:** NextAuth.js v5 — JWT strategy + Credentials provider (bcryptjs for passwords)
- **Deploy:** Vercel — alias `streakboard-phi.vercel.app`
- **Notifications:** `sonner` v2 (already installed — `import { toast } from "sonner"`)
- **Drag-drop:** HTML5 native drag API (dnd-kit was tried and reverted — do NOT use it)

## Key File Map

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma client singleton (uses Neon serverless adapter) |
| `lib/streak.ts` | `calcStreaks()`, `buildHeatmap()`, `calcStudyStats()` — already exists, do NOT recreate |
| `prisma/schema.prisma` | Full schema — visibility is a `String` (not enum) |
| `app/api/checklists/route.ts` | ALL checklist mutations — one PATCH handler, dispatched by `action` field |
| `app/api/settings/route.ts` | Profile + password change |
| `app/api/checkin/route.ts` | Study session logging |
| `components/ChecklistSection.tsx` | Main project UI (~1200 lines) |
| `app/dashboard/DashboardClient.tsx` | Dashboard UI (~800 lines) |
| `app/discover/DiscoverList.tsx` | Explore page with search |
| `app/settings/SettingsClient.tsx` | User settings form |

## Editing Rules (CRITICAL — follow to avoid token overflows)

1. **NEVER rewrite files >200 lines** — use targeted `old_string → new_string` edits only
2. **Read in 100–150 line chunks** — use `offset` and `limit` parameters
3. **Grep first** — find function/variable locations before reading
4. **Run `npm run build` after every batch** to catch TypeScript errors early
5. **Schema changes:** run `npx prisma db push` BEFORE deploying
6. **Deploy:** `npx vercel --prod --yes` — user must run this manually (requires browser login)

## Data Model Key Rules

- **Streak** is always calculated from `CheckIn.date` history via `lib/streak.ts` — never stored as a counter in the DB
- **Dates** always use `localDateKey(date)` from `lib/streak.ts` — NEVER `toISOString().slice(0,10)` (UTC bug)
- **Visibility** is stored as `String` in DB. Valid values: `PRIVATE`, `PUBLIC_TEMPLATE`, `PUBLIC_COLLAB`, `PUBLIC_EDIT`
- **Progress** is always per-user — `ChecklistProgress` is keyed on `(itemId, userId)` unique
- **Revisions** count how many times a user has checked (reviewed) an item — `ChecklistRevision` rows

## Collaboration Model

| Visibility | Can check (own progress) | Can add/edit/drag items |
|-----------|--------------------------|------------------------|
| PUBLIC_COLLAB | ✅ | ❌ |
| PUBLIC_EDIT | ✅ | ✅ |

- `patchChecklist(id, updater)` — use this for ALL item mutations; it routes to either `patchOwned` or `patchParticipating` correctly
- NEVER call `patchOwned` directly for item check/edit/add/delete — it will silently skip participating projects

## State Architecture (DashboardClient + ChecklistSection)

```
DashboardClient
  ├── ownedState      → passed as `owned` to ChecklistSection
  ├── participatingState → passed as `participating` to ChecklistSection
  └── onOwnedChange / onParticipatingChange callbacks → instant optimistic updates

ChecklistSection
  ├── patchOwned(id, fn)        — updates owned[] state
  ├── patchParticipating(id, fn) — updates participating[] state
  └── patchChecklist(id, fn)   — routes to correct one automatically
```

## Common Patterns

```ts
// API call pattern
const res = await fetch("/api/checklists", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "actionName", ...params }),
});
if (!res.ok) toast.error("Something went wrong — please try again.");

// Optimistic update pattern
patchChecklist(checklistId, (c) => ({ ...c, items: updatedItems }));
const res = await fetch(...);
if (!res.ok) patchChecklist(checklistId, (c) => ({ ...c, items: revertedItems })); // revert
```

## What NOT to Do

- ❌ Don't use `@dnd-kit` — reverted due to multiple DndContext conflicts
- ❌ Don't use `toISOString()` for date strings — use `localDateKey()`
- ❌ Don't hardcode `'en-US'` locale — use `undefined` (browser locale)
- ❌ Don't reorganize the `app/` folder — App Router routing depends on its structure
- ❌ Don't upgrade Prisma to v7 — not released, current Prisma 5 works correctly
- ❌ Don't create a `/src/features/` folder — this is App Router, not Vite
- ❌ Don't recreate `lib/streak.ts` — it already exists with full implementation
