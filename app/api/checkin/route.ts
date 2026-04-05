import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { localDateKey } from "@/lib/streak";

// POST — create a new log entry (multiple per day allowed)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { minutes, note, studyTime, date: reqDate, checklistId } = await req.json();
  const date = reqDate ?? localDateKey(new Date());

  const checkIn = await prisma.checkIn.create({
    data: {
      userId: session.user.id,
      date,
      minutes: minutes ?? 0,
      note: note?.trim() || null,
      studyTime: studyTime?.trim() || null,
      checklistId: checklistId || null,
    },
    include: { checklist: { select: { name: true } } },
  });

  return NextResponse.json({
    id: checkIn.id,
    date: checkIn.date,
    minutes: checkIn.minutes,
    note: checkIn.note,
    studyTime: checkIn.studyTime,
    createdAt: checkIn.createdAt.toISOString(),
    checklistId: checkIn.checklistId,
    checklistName: checkIn.checklist?.name ?? null,
  });
}

// PATCH — update a specific log entry by id
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, minutes, note, studyTime } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const log = await prisma.checkIn.findUnique({ where: { id } });
  if (!log || log.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.checkIn.update({
    where: { id },
    data: {
      minutes: minutes ?? log.minutes,
      note: note !== undefined ? (note?.trim() || null) : log.note,
      studyTime: studyTime !== undefined ? (studyTime?.trim() || null) : log.studyTime,
    },
    include: { checklist: { select: { name: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    date: updated.date,
    minutes: updated.minutes,
    note: updated.note,
    studyTime: updated.studyTime,
    createdAt: updated.createdAt.toISOString(),
    checklistId: updated.checklistId,
    checklistName: updated.checklist?.name ?? null,
  });
}

// DELETE — delete a specific log entry by ?id=
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const log = await prisma.checkIn.findUnique({ where: { id } });
  if (!log || log.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.checkIn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// GET — all logs (optionally ?date=YYYY-MM-DD)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFilter = searchParams.get("date");

  const checkIns = await prisma.checkIn.findMany({
    where: {
      userId: session.user.id,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { checklist: { select: { name: true } } },
  });

  return NextResponse.json(
    checkIns.map((c) => ({
      id: c.id,
      date: c.date,
      minutes: c.minutes,
      note: c.note,
      studyTime: c.studyTime,
      createdAt: c.createdAt.toISOString(),
      checklistId: c.checklistId,
      checklistName: c.checklist?.name ?? null,
    }))
  );
}
