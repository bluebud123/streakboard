import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { localDateKey } from "@/lib/streak";

function serializeCheckIn(c: any) {
  return {
    id: c.id,
    date: c.date,
    minutes: c.minutes,
    note: c.note,
    studyTime: c.studyTime,
    type: c.type ?? "TIME",
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    checklistId: c.checklistId ?? null,
    checklistName: c.checklist?.name ?? null,
  };
}

// POST — create a new log entry (multiple per day allowed)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { minutes, note, studyTime, date: reqDate, checklistId, type } = await req.json();
  const date = reqDate ?? localDateKey(new Date());

  // Auto-detect type: if no minutes and note exists → NOTE, otherwise TIME
  const resolvedType = type ?? (((!minutes || minutes === 0) && note?.trim()) ? "NOTE" : "TIME");

  const checkIn = await prisma.checkIn.create({
    data: {
      userId: session.user.id,
      date,
      minutes: resolvedType === "NOTE" ? 0 : (minutes ?? 0),
      note: note?.trim() || null,
      studyTime: studyTime?.trim() || null,
      checklistId: checklistId || null,
      type: resolvedType,
    },
    include: { checklist: { select: { name: true } } },
  });

  return NextResponse.json(serializeCheckIn(checkIn));
}

// PATCH — update a specific log entry by id
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, minutes, note, studyTime, type } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const log = await prisma.checkIn.findUnique({ where: { id } });
  if (!log || log.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.checkIn.update({
    where: { id },
    data: {
      minutes: minutes !== undefined ? (minutes ?? 0) : log.minutes,
      note: note !== undefined ? (note?.trim() || null) : log.note,
      studyTime: studyTime !== undefined ? (studyTime?.trim() || null) : log.studyTime,
      type: type !== undefined ? type : log.type,
    },
    include: { checklist: { select: { name: true } } },
  });

  return NextResponse.json(serializeCheckIn(updated));
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

  return NextResponse.json(checkIns.map(serializeCheckIn));
}
