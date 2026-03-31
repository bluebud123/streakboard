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
      goals: {
        where: { achieved: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, text: true, target: true, current: true, unit: true },
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

  return NextResponse.json({
    name: user.name,
    username: user.username,
    studyingFor: user.studyingFor,
    examDate: user.examDate,
    streaks,
    heatmap,
    study,
    goals: user.goals,
  });
}
