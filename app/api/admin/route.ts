import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  return user?.isAdmin ? session.user.id : null;
}

// ── GET — all users with stats ─────────────────────────────────────────────

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      studyingFor: true,
      isAdmin: true,
      isPublic: true,
      createdAt: true,
      _count: { select: { checklists: true, checkIns: true } },
      checkIns: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });

  const [checklistCount, userCount, checkInCount] = await Promise.all([
    prisma.checklist.count(),
    prisma.user.count(),
    prisma.checkIn.count(),
  ]);

  const anonymousSetting = await prisma.siteSetting.findUnique({ where: { key: "anonymousGraphs" } });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      studyingFor: u.studyingFor,
      isAdmin: u.isAdmin,
      isPublic: u.isPublic,
      createdAt: u.createdAt,
      projectCount: u._count.checklists,
      checkInCount: u._count.checkIns,
      lastCheckIn: u.checkIns[0]?.date ?? null,
    })),
    stats: { userCount, checklistCount, checkInCount },
    settings: { anonymousGraphs: anonymousSetting?.value === "true" },
  });
}

// ── DELETE — remove user ───────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId === adminId) return NextResponse.json({ error: "Cannot delete your own account here" }, { status: 400 });

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}

// ── PATCH — update site settings ──────────────────────────────────────────

export async function PATCH(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if ("anonymousGraphs" in body) {
    await prisma.siteSetting.upsert({
      where: { key: "anonymousGraphs" },
      update: { value: body.anonymousGraphs ? "true" : "false" },
      create: { key: "anonymousGraphs", value: body.anonymousGraphs ? "true" : "false" },
    });
  }

  return NextResponse.json({ ok: true });
}
