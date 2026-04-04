import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { calcStreaks, buildHeatmap, calcStudyStats } from "@/lib/streak";
import Heatmap from "@/components/Heatmap";
import StreakStats from "@/components/StreakStats";
import ExamCountdown from "@/components/ExamCountdown";
import ChecklistCard from "@/components/ChecklistCard";
import ShareBanner from "@/components/ShareBanner";
import Link from "next/link";

async function getProfile(username: string) {
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
          items: { select: { id: true, isSection: true, progress: { select: { userId: true, done: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user || !user.isPublic) return null;

  const dates = user.checkIns.map((c) => c.date);
  const streaks = calcStreaks(dates);
  const heatmap = buildHeatmap(user.checkIns);
  const study = calcStudyStats(user.checkIns);

  const checklists = user.checklists.map((cl) => ({
    id: cl.id,
    name: cl.name,
    slug: cl.slug,
    visibility: cl.visibility,
    done: cl.items.filter((it) => !it.isSection && it.progress.some((p) => p.userId === user.id && p.done)).length,
    total: cl.items.filter((it) => !it.isSection).length,
  }));

  return {
    name: user.name,
    username: user.username,
    studyingFor: user.studyingFor,
    examDate: user.examDate,
    streaks,
    heatmap,
    study,
    checklists,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  try {
    const profile = await getProfile(username);
    if (!profile) return { title: "Profile not found — Streakboard" };
    return {
      title: `${profile.name} — ${profile.streaks.currentStreak} day streak | Streakboard`,
      description: `${profile.name} is studying for ${profile.studyingFor}. ${profile.streaks.currentStreak} day streak, ${profile.streaks.totalDays} days logged.`,
    };
  } catch {
    return { title: "Streakboard" };
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-400">Streakboard</Link>
        <Link
          href="/signup"
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors"
        >
          Create yours →
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl font-bold text-amber-400">
            {profile.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">{profile.name}</h1>
            <p className="text-slate-400 text-sm">@{profile.username}</p>
          </div>
        </div>

        {/* Exam countdown */}
        <ExamCountdown studyingFor={profile.studyingFor} examDate={profile.examDate} />

        {/* Stats */}
        <StreakStats
          currentStreak={profile.streaks.currentStreak}
          longestStreak={profile.streaks.longestStreak}
          totalDays={profile.streaks.totalDays}
          weekHours={profile.study.weekHours}
          allTimeHours={profile.study.allTimeHours}
        />

        {/* Heatmap */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-200 mb-4">Activity — last 20 weeks</h2>
          <Heatmap cells={profile.heatmap} />
        </section>

        {/* Projects */}
        {profile.checklists.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-slate-200 mb-4">Projects</h2>
            <div className="space-y-3">
              {profile.checklists.map((cl) => (
                <ChecklistCard key={cl.id} name={cl.name} done={cl.done} total={cl.total} slug={cl.slug} visibility={cl.visibility} />
              ))}
            </div>
          </section>
        )}

        {/* Viral footer */}
        <ShareBanner username={profile.username} />
      </main>
    </div>
  );
}
