import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcStreaks, buildHeatmap, calcStudyStats } from "@/lib/streak";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      studyingFor: true,
      examDate: true,
      isPublic: true,
      checkIns: { select: { date: true, minutes: true } },
      checklists: {
        where: { visibility: { in: ["PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"] } },
        select: {
          id: true, name: true, slug: true, visibility: true,
          items: { select: { id: true, progress: { select: { userId: true, done: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user || !user.isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dates = user.checkIns.map((c) => c.date);
  const streaks = calcStreaks(dates);
  const heatmap = buildHeatmap(user.checkIns);
  const study = calcStudyStats(user.checkIns);

  const checklists = user.checklists.map((cl) => ({
    id: cl.id,
    name: cl.name,
    slug: cl.slug,
    visibility: cl.visibility,
    done: cl.items.filter((it) => it.progress.some((p) => p.userId === user.id && p.done)).length,
    total: cl.items.length,
  }));

  return NextResponse.json({
    name: user.name,
    username: user.username,
    studyingFor: user.studyingFor,
    examDate: user.examDate,
    streaks,
    heatmap,
    study,
    checklists,
  });
}
