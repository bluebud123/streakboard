import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { calcStreaks, buildHeatmap, calcStudyStats } from "@/lib/streak";
import Heatmap from "@/components/Heatmap";
import StreakStats from "@/components/StreakStats";
import ExamCountdown from "@/components/ExamCountdown";
import ChecklistCard from "@/components/ChecklistCard";
import ShareBanner from "@/components/ShareBanner";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";

// Cache per-username profile for 60s — same data for every viewer, so safe
// to share across requests. Tag with `profile:<username>` so we could
// revalidate on mutations later if desired.
const getProfile = (username: string) =>
  unstable_cache(
    () => _getProfileUncached(username),
    ["profile", username],
    { revalidate: 60, tags: [`profile:${username}`] }
  )();

async function _getProfileUncached(username: string) {
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
  const [{ username }, session] = await Promise.all([params, auth()]);
  const profile = await getProfile(username);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 animate-fadeIn">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Profile header */}
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center text-3xl font-black text-amber-500 shadow-inner">
            {profile.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{profile.name}</h1>
            <p className="text-slate-500 font-medium">@{profile.username}</p>
          </div>
        </div>

        {/* Exam countdown */}
        <div className="hover:scale-[1.01] transition-transform duration-200">
          <ExamCountdown studyingFor={profile.studyingFor} examDate={profile.examDate} />
        </div>

        {/* Stats */}
        <StreakStats
          currentStreak={profile.streaks.currentStreak}
          longestStreak={profile.streaks.longestStreak}
          totalDays={profile.streaks.totalDays}
          weekHours={profile.study.weekHours}
          allTimeHours={profile.study.allTimeHours}
        />

        {/* Heatmap */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-all duration-300">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Activity — last 20 weeks</h2>
          <Heatmap cells={profile.heatmap} />
        </section>

        {/* Projects */}
        {profile.checklists.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-all duration-300">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Projects</h2>
            <div className="space-y-3">
              {profile.checklists.map((cl) => (
                <ChecklistCard key={cl.id} name={cl.name} done={cl.done} total={cl.total} slug={cl.slug} visibility={cl.visibility} />
              ))}
            </div>
          </section>
        )}

        {/* Badges placeholder */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all duration-300">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Badges</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center opacity-40 grayscale">🏆</div>
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center opacity-40 grayscale">🔥</div>
            <p className="text-slate-600 text-sm font-medium italic">Keep building your streak to unlock badges!</p>
          </div>
        </div>

        {/* Viral footer */}
        <ShareBanner username={profile.username} />
      </main>
    </div>
  );
}
