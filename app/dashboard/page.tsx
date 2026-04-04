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
      progress: { where: { userId } },
      revisions: { where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
      children: {
        orderBy: { order: "asc" as const },
        include: {
          progress: { where: { userId } },
          revisions: { where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
          children: {
            orderBy: { order: "asc" as const },
            include: {
              progress: { where: { userId } },
              revisions: { where: { userId }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
            },
          },
        },
      },
    },
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [user, checkIns, ownedChecklists, participatingChecklists, recentRequests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, username: true, studyingFor: true, examDate: true, isAdmin: true } }),
    prisma.checkIn.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.checklist.findMany({
      where: { userId },
      include: {
        items: nestedItems(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
        requests: { where: { status: "PENDING" }, include: { requester: { select: { name: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
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
    prisma.projectRequest.findMany({
      where: { requesterId: userId, status: { not: "PENDING" } },
      include: { checklist: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  if (!user) redirect("/login");

  const dates = checkIns.map((c) => c.date);
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
  }));

  const todayLogs = allCheckIns.filter((c) => c.date === today);

  // Ensure all fields are plain serializable values
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
      ownedChecklists={ownedChecklists as never}
      participatingChecklists={participatingChecklists as never}
      recentRequests={JSON.parse(JSON.stringify(recentRequests))}
      userId={userId}
    />
  );
}
