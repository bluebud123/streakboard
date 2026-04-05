import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import LogsClient from "./LogsClient";

export default async function LogsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const logs = await prisma.checkIn.findMany({
    where: { userId },
    include: { checklist: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const serialized = logs.map((l) => ({
    id: l.id,
    date: l.date,
    minutes: l.minutes,
    note: l.note,
    studyTime: (l as { studyTime?: string | null }).studyTime ?? null,
    type: (l as any).type ?? "TIME",
    createdAt: l.createdAt.toISOString(),
    checklistId: l.checklistId ?? null,
    checklistName: (l as any).checklist?.name ?? null,
  }));

  return <LogsClient initialLogs={serialized} />;
}
