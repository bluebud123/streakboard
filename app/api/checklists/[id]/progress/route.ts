import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checklist = await prisma.checklist.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true, name: true, isPublic: true } } },
      },
      user: { select: { id: true, username: true, name: true, isPublic: true } },
      items: {
        where: { isSection: false },
        include: { progress: true },
      },
    },
  });

  if (!checklist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allUsers = [
    { id: checklist.user.id, username: checklist.user.username, isPublic: checklist.user.isPublic },
    ...checklist.participants.map((p) => ({
      id: p.user.id,
      username: p.user.username,
      isPublic: p.user.isPublic,
    })),
  ];

  const overall = allUsers.map((u) => {
    const total = checklist.items.length;
    const done = checklist.items.filter((it) =>
      it.progress.some((pr) => pr.userId === u.id && pr.done)
    ).length;
    return { userId: u.id, username: u.username ?? "", done, total };
  });

  // Build section progress
  const sections: { sectionId: string; sectionText: string; participants: { userId: string; username: string; done: number; total: number }[] }[] = [];

  return NextResponse.json({ overall, sections });
}

// DELETE: reset all my progress on this checklist
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // Get all items in this checklist
  const items = await prisma.checklistItem.findMany({
    where: { checklistId: params.id },
    select: { id: true },
  });
  const itemIds = items.map((i) => i.id);

  await prisma.checklistProgress.deleteMany({
    where: { userId, itemId: { in: itemIds } },
  });

  return NextResponse.json({ reset: true });
}
