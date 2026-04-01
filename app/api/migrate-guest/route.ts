import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { checkIns, goals } = await req.json();

  const safeCheckIns = Array.isArray(checkIns) ? checkIns.slice(0, 365) : [];
  const safeGoals = Array.isArray(goals) ? goals.slice(0, 50) : [];

  await Promise.all([
    ...safeCheckIns.map((ci: { date: string; minutes: number; note: string | null }) =>
      prisma.checkIn.upsert({
        where: { userId_date: { userId, date: ci.date } },
        update: {},
        create: { userId, date: ci.date, minutes: ci.minutes ?? 0, note: ci.note ?? null },
      })
    ),
    safeGoals.length > 0
      ? prisma.goal.createMany({
          data: safeGoals.map((g: { text: string; target: number; current: number; unit: string; achieved: boolean; achievedDate: string | null }) => ({
            userId,
            text: g.text,
            target: g.target,
            current: g.current,
            unit: g.unit,
            achieved: g.achieved,
            achievedDate: g.achievedDate ?? null,
          })),
          skipDuplicates: true,
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
