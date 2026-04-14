# Streakboard — AI Context File

> Feed this file to Gemini CLI at the start of every session:
> `gemini --context GEMINI.md`

## Tech Stack (Verified)

- **Framework:** Next.js 14 **App Router**
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 — palette: `slate-950/900/800`, accent `amber-500`
- **Database:** Neon PostgreSQL via **Prisma 5**
- **Auth:** NextAuth.js v5 — JWT strategy + Credentials provider
- **Notifications:** `sonner` v2 (`import { toast } from "sonner"`)
- **Drag-drop:** HTML5 native drag API (No dnd-kit)

## Key File Map

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma client singleton |
| `lib/streak.ts` | Streak & Heatmap logic (Date keys: `localDateKey(date)`) |
| `prisma/schema.prisma` | Full schema (Visibility is `String`) |
| `app/api/checklists/route.ts` | Central PATCH handler for all mutations |
| `components/ChecklistSection.tsx` | Core UI (~1800 lines) — handles state/optimistic updates |
| `app/dashboard/DashboardClient.tsx` | Dashboard shell, manages `ownedState` / `participatingState` |

## Editing Rules (CRITICAL)

1. **Targeted Edits Only:** Never rewrite files >200 lines. Use `replace` with precise `old_string`.
2. **Read in Chunks:** Use `start_line` / `end_line` for large files like `ChecklistSection.tsx`.
3. **Optimistic Sync:** Dashboard state must be synced via `onOwnedChange` / `onParticipatingChange`.
4. **Build Check:** Run `npm run build` after changes to catch Type errors early.

## Data Model & Collaboration

- **Visibility (String):** `PRIVATE`, `PRIVATE_COLLAB`, `PUBLIC_TEMPLATE`, `PUBLIC_COLLAB`, `PUBLIC_EDIT`.
- **Progress:** Per-user via `ChecklistProgress` (itemId + userId).
- **Revisions:** History of checks via `ChecklistRevision`.
- **Item Ordering:** 
  - Owner reorders via `ChecklistItem.order`.
  - Participants reorder via `ChecklistPersonalOrder.order` (synced via `reorderItems` action).
- **Deletions:** 
  - Owners/Creators can delete items directly.
  - Participants deleting items creates a `ProjectRequest` (status: `PENDING`) for owner approval.

## Common API Patterns (`/api/checklists`)

```ts
// All mutations use PATCH + action
const res = await fetch("/api/checklists", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "actionName", ...payload }),
});
```

### Supported Actions:
- `addItem`, `renameItem`, `deleteItem`, `reorderItems`
- `checkItem` (marks done + logs revision), `uncheckItem` (marks not done)
- `removeLastRevision` (undoes check, keeps previous history if any)
- `renameChecklist`, `changeVisibility`, `setDeadline`
- `archiveProject`, `unarchiveProject`, `delete` (entire project)
- `inviteMember`, `removeMember`, `handleProjectRequest`
- `join` (for public projects), `copyTemplate`

## What NOT to Do

- ❌ **Don't use `toISOString()`** for date comparison — use `localDateKey()` from `lib/streak.ts`.
- ❌ **Don't use `patchChecklist`** (not implemented in codebase) — use `patchOwned` or update state directly via `onOwnedChange` / `onParticipatingChange`.
- ❌ **Don't upgrade Prisma to v7** — strictly stick to Prisma 5.
- ❌ **Don't reorganize folders** — project follows standard App Router structure.
