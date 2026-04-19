import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { calcStreaks, localDateKey } from "@/lib/streak";
import DashboardClient from "./DashboardClient";

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
    // currentStreak / longestStreak / totalDays. Keeping this unbounded (but
    // tiny per row) so accurate streaks survive the 365-day payload cap above.
    prisma.checkIn.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: "desc" },
    }),
    prisma.checklist.findMany({
      where: { userId, archivedAt: null },
      include: {
        items: nestedItems(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
        requests: { where: { status: "PENDING" }, include: { requester: { select: { name: true, username: true } } } },
      },
      orderBy: { order: "asc" },
    }),
    // Archived list only renders id/name/archivedAt — skip the heavy nested item
    // tree, participants, and progress to slim payload.
    prisma.checklist.findMany({
      where: { userId, archivedAt: { not: null } },
      select: { id: true, name: true, archivedAt: true },
      orderBy: { archivedAt: "desc" },
    }),
    prisma.checklist.findMany({
      where: { participants: { some: { userId } }, userId: { not: userId } },
      include: {
        user: { select: { name: true, username: true } },
        items: nestedItems(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Only pull notifications the user hasn't already dismissed. Before this,
    // resolved requests kept reappearing after every reload because
    // `dismissedAt` was set server-side but never filtered on read.
    prisma.projectRequest.findMany({
      where: { requesterId: userId, status: { not: "PENDING" }, dismissedAt: null },
      include: { checklist: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  if (!user) redirect("/login");

  // Streaks pull from the unbounded dates-only query so they remain accurate
  // even though `checkIns` above is capped at 12 months.
  const dates = allCheckInDates.map((c) => c.date);
  const streaks = calcStreaks(dates);
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
      archivedChecklists={archivedOwnedChecklists.map((cl) => ({
        id: cl.id,
        name: cl.name,
        archivedAt: cl.archivedAt ? cl.archivedAt.toISOString() : null,
      })) as never}
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
      recentRequests={JSON.parse(JSON.stringify(recentRequests))}
      userId={userId}
    />
  );
}
