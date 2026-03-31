import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { calcStreaks, localDateKey } from "@/lib/streak";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [user, checkIns, goals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, username: true, studyingFor: true, examDate: true } }),
    prisma.checkIn.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!user) redirect("/login");

  const dates = checkIns.map((c) => c.date);
  const streaks = calcStreaks(dates);
  const today = localDateKey(new Date());
  const todayCheckIn = checkIns.find((c) => c.date === today) ?? null;

  return (
    <DashboardClient
      user={user}
      streaks={streaks}
      todayCheckIn={todayCheckIn}
      goals={goals}
      username={(session.user as { username: string }).username}
    />
  );
}
