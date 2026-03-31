import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { localDateKey } from "@/lib/streak";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { minutes, note } = await req.json();
  const date = localDateKey(new Date());

  const checkIn = await prisma.checkIn.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    update: { minutes: minutes ?? 0, note: note ?? null },
    create: { userId: session.user.id, date, minutes: minutes ?? 0, note: note ?? null },
  });

  return NextResponse.json(checkIn);
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = localDateKey(new Date());
  await prisma.checkIn.deleteMany({ where: { userId: session.user.id, date } });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checkIns = await prisma.checkIn.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(checkIns);
}
