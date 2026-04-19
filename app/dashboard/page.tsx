import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { calcStreaks, localDateKey } from "@/lib/streak";
import DashboardClient from "./DashboardClient";

// Cached reads — pure string / primitive shapes only so unstable_cache's JSON
// serialization doesn't mangle Date objects. Busted by revalidateTag() in
// the mutation routes (api/checkin, api/checklists).
const getCheckInDates = (userId: string) =>
  unstable_cache(
    async () => {
      const rows = await prisma.checkIn.findMany({
        where: { userId },
        select: { date: true },
        orderBy: { date: "desc" },
      });
      return rows.map((r) => r.date);
    },
    ["checkin-dates", userId],
    { tags: [`checkins:${userId}`], revalidate: 30 }
  )();

const getArchivedChecklists = (userId: string) =>
  unstable_cache(
    async () => {
      const rows = await prisma.checklist.findMany({
        where: { userId, archivedAt: { not: null } },
        select: { id: true, name: true, archivedAt: true },
        orderBy: { archivedAt: "desc" },
      });
      return rows.map((cl) => ({
        id: cl.id,
        name: cl.name,
        archivedAt: cl.archivedAt ? cl.archivedAt.toISOString() : null,
      }));
    },
    ["archived-checklists", userId],
    { tags: [`checklists:${userId}`], revalidate: 30 }
  )();

const getRecentRequests = (userId: string) =>
  unstable_cache(
    async () => {
      const rows = await prisma.projectRequest.findMany({
        where: { requesterId: userId, status: { not: "PENDING" }, dismissedAt: null },
        include: { checklist: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      // Pre-serialize so downstream code doesn't hit Date instances.
      return JSON.parse(JSON.stringify(rows));
    },
    ["recent-requests", userId],
    { tags: [`checklists:${userId}`], revalidate: 30 }
  )();

function nestedItems(userId: string) {
  return {
    where: { parentId: null as null | string },
    orderBy: { order: "asc" as const },
    include: {
      progress: { where: { userId }, select: { done: true } },
      revisions: { where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
      children: {
        orderBy: { order: "asc" as const },
        include: {
          progress: { where: { userId }, select: { done: true } },
          revisions: { where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
          children: {
            orderBy: { order: "asc" as const },
            include: {
              progress: { where: { userId }, select: { done: true } },
              revisions: { where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
            },
          },
        },
      },
    },
  };
}

function serializeChecklist(cl: any) {
  return {
    ...JSON.parse(JSON.stringify(cl)),
    items: cl.items ?? [],
    createdAt: cl.createdAt instanceof Date ? cl.createdAt.toISOString() : cl.createdAt,
    deadline: cl.deadline instanceof Date ? cl.deadline.toISOString() : cl.deadline ?? null,
    archivedAt: cl.archivedAt instanceof Date ? cl.archivedAt.toISOString() : cl.archivedAt ?? null,
  };
}

// For PRIVATE_COLLAB, progress is shared: if ANY member has checked an item,
// it appears checked for all. The dashboard loads progress scoped to the
// viewer only (to keep payload small), so we post-process shared checklists
// by querying all members' progress and rewriting each item's `progress`
// array to reflect the group state.
async function applySharedProgress(checklists: any[]): Promise<void> {
  const shared = checklists.filter((cl) => cl.visibility === "PRIVATE_COLLAB");
  if (shared.length === 0) return;

  // Collect every item id across all shared checklists
  const ids: string[] = [];
  function collect(items: any[]) {
    for (const it of items) {
      ids.push(it.id);
      if (it.children?.length) collect(it.children);
    }
  }
  for (const cl of shared) collect(cl.items ?? []);
  if (ids.length === 0) return;

  // Single query for ALL members' done state across these items
  const allProgress = await prisma.checklistProgress.findMany({
    where: { itemId: { in: ids }, done: true },
    select: { itemId: true },
  });
  const doneSet = new Set(allProgress.map((p) => p.itemId));

  function rewrite(items: any[]) {
    for (const it of items) {
      it.progress = doneSet.has(it.id) ? [{ done: true }] : [];
      if (it.children?.length) rewrite(it.children);
    }
  }
  for (const cl of shared) rewrite(cl.items ?? []);
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [
    user,
    checkIns,
    allCheckInDates,
    ownedChecklists,
    archivedOwnedChecklists,
    participatingChecklists,
    recentRequests,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true, studyingFor: true, examDate: true, isAdmin: true },
    }),
    // Cap check-ins at ~12 months so the dashboard payload stays small.
    // Streak calc + calendar only need recent history; older logs are viewable
    // on /logs. Previously this was unbounded and grew with account age,
    // dominating dashboard load time.
    prisma.checkIn.findMany({
      where: {
        userId,
        date: { gte: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10) },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        minutes: true,
        note: true,
        studyTime: true,
        createdAt: true,
        checklistId: true,
        checklist: { select: { name: true } },
      },
    }),
    // Separate lightweight query of ALL check-in dates — used only for
    // currentStreak / longestStreak / totalDays. Cached via unstable_cache
    // (string-only payload, busted by revalidateTag on checkin writes).
    getCheckInDates(userId),
    prisma.checklist.findMany({
      where: { userId, archivedAt: null },
      include: {
        items: nestedItems(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
        requests: { where: { status: "PENDING" }, include: { requester: { select: { name: true, username: true } } } },
      },
      orderBy: { order: "asc" },
    }),
    // Archived list only renders id/name/archivedAt — cached, string-only
    // payload, busted by revalidateTag on checklist writes.
    getArchivedChecklists(userId),
    prisma.checklist.findMany({
      where: { participants: { some: { userId } }, userId: { not: userId } },
      include: {
        user: { select: { name: true, username: true } },
        items: nestedItems(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Recent non-PENDING requests (notifications). Cached + pre-serialized.
    getRecentRequests(userId),
  ]);

  if (!user) redirect("/login");

  // PRIVATE_COLLAB projects share progress across all members — rewrite
  // each item's `progress` to reflect the group (anyDone) before serializing.
  await applySharedProgress([...ownedChecklists, ...participatingChecklists]);

  // Per-user deadlines: any viewer can set a personal target date that
  // overrides the creator's default. Merge those onto the project objects
  // so the dashboard renders the viewer's own deadline.
  const personalDeadlines = await prisma.userChecklistDeadline.findMany({
    where: { userId, deadline: { not: null } },
    select: { checklistId: true, deadline: true },
  });
  const personalByCl = new Map(personalDeadlines.map((p) => [p.checklistId, p.deadline]));
  for (const cl of [...ownedChecklists, ...participatingChecklists] as any[]) {
    const personal = personalByCl.get(cl.id);
    if (personal) cl.deadline = personal;
    cl.personalDeadline = personal ?? null;
  }

  // Streaks pull from the unbounded dates-only query so they remain accurate
  // even though `checkIns` above is capped at 12 months. getCheckInDates()
  // now returns a flat string[] (cached-friendly shape).
  const streaks = calcStreaks(allCheckInDates);
  const today = localDateKey(new Date());

  // Serialize DateTime → ISO string for client component
  const allCheckIns = checkIns.map((c) => ({
    id: c.id,
    date: c.date,
    minutes: c.minutes,
    note: c.note,
    studyTime: (c as { studyTime?: string | null }).studyTime ?? null,
    createdAt: c.createdAt.toISOString(),
    checklistId: c.checklistId ?? null,
    checklistName: (c as any).checklist?.name ?? null,
  }));

  const todayLogs = allCheckIns.filter((c) => c.date === today);

  const serializedUser = {
    name: user.name ?? "",
    username: user.username ?? "",
    studyingFor: user.studyingFor ?? "",
    examDate: user.examDate ?? null,
    isAdmin: user.isAdmin,
  };

  return (
    <DashboardClient
      user={serializedUser}
      streaks={streaks}
      todayLogs={todayLogs}
      allCheckIns={allCheckIns}
      username={(session.user as { username: string }).username}
      ownedChecklists={ownedChecklists.map(serializeChecklist) as never}
      archivedChecklists={archivedOwnedChecklists as never}
      participatingChecklists={
        // Compute viewerCanEdit per-project from the viewer's participant row
        // so <ChecklistSection /> can flip "Request edit" → "Edit" immediately
        // after the owner approves. Without this, the field stays undefined and
        // the button never changes even on a full page reload.
        participatingChecklists.map((cl: any) => ({
          ...cl,
          viewerCanEdit: !!cl.participants?.find((p: any) => p.userId === userId)?.canEdit,
        })) as never
      }
      recentRequests={recentRequests}
      userId={userId}
    />
  );
}
