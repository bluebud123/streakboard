import { notFound } from "next/navigation";
import Heatmap from "@/components/Heatmap";
import StreakStats from "@/components/StreakStats";
import ExamCountdown from "@/components/ExamCountdown";
import GoalCard from "@/components/GoalCard";
import ShareBanner from "@/components/ShareBanner";
import Link from "next/link";

interface ProfileData {
  name: string;
  username: string;
  studyingFor: string;
  examDate: string | null;
  streaks: { currentStreak: number; longestStreak: number; totalDays: number };
  heatmap: { date: string; level: 0 | 1 | 2 | 3; minutes: number }[];
  study: { weekHours: number; allTimeHours: number };
  goals: { id: string; text: string; target: number; current: number; unit: string }[];
}

async function getProfile(username: string): Promise<ProfileData | null> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/profile/${username}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Profile not found — Streakboard" };
  return {
    title: `${profile.name} — ${profile.streaks.currentStreak} day streak | Streakboard`,
    description: `${profile.name} is studying for ${profile.studyingFor}. ${profile.streaks.currentStreak} day streak, ${profile.streaks.totalDays} days logged.`,
  };
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

        {/* Goals */}
        {profile.goals.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-semibold text-slate-200 mb-4">Active Goals</h2>
            <div className="space-y-3">
              {profile.goals.map((g) => (
                <GoalCard key={g.id} goal={g} />
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
