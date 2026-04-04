import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { checkIns } = await req.json();

  const safeCheckIns = Array.isArray(checkIns) ? checkIns.slice(0, 365) : [];

  // Check existing dates to avoid duplicates (unique constraint removed, so do it manually)
  const existingDates = new Set(
    (await prisma.checkIn.findMany({ where: { userId }, select: { date: true } })).map((c) => c.date)
  );

  const newEntries = safeCheckIns.filter(
    (ci: { date: string; minutes: number; note: string | null }) => !existingDates.has(ci.date)
  );

  if (newEntries.length > 0) {
    await prisma.checkIn.createMany({
      data: newEntries.map((ci: { date: string; minutes: number; note: string | null }) => ({
        userId,
        date: ci.date,
        minutes: ci.minutes ?? 0,
        note: ci.note ?? null,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
