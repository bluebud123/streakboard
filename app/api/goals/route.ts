import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { localDateKey } from "@/lib/streak";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, target, unit } = await req.json();
  if (!text || !target) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const goal = await prisma.goal.create({
    data: { userId: session.user.id, text, target: Number(target), unit: unit || "times" },
  });
  return NextResponse.json(goal);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, text, target, unit } = await req.json();
  const goal = await prisma.goal.findFirst({ where: { id, userId: session.user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "increment") {
    const newCurrent = goal.current + 1;
    const achieved = newCurrent >= goal.target;
    const updated = await prisma.goal.update({
      where: { id },
      data: {
        current: newCurrent,
        achieved,
        achievedDate: achieved && !goal.achieved ? localDateKey(new Date()) : goal.achievedDate,
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "decrement") {
    const updated = await prisma.goal.update({
      where: { id },
      data: { current: Math.max(0, goal.current - 1), achieved: false, achievedDate: null },
    });
    return NextResponse.json(updated);
  }

  if (action === "delete") {
    await prisma.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "edit") {
    const updated = await prisma.goal.update({
      where: { id },
      data: { text, target: Number(target), unit },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
