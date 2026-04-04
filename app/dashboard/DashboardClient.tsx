"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import ChecklistSection, { type ChecklistData } from "@/components/ChecklistSection";

interface CheckIn {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
}

interface Props {
  user: { name: string; username: string; studyingFor: string; examDate: string | null };
  streaks: { currentStreak: number; longestStreak: number; totalDays: number };
  todayCheckIn: CheckIn | null;
  username: string;
  ownedChecklists: ChecklistData[];
  participatingChecklists: ChecklistData[];
  userId: string;
}

export default function DashboardClient({ user, streaks, todayCheckIn, username, ownedChecklists, participatingChecklists, userId }: Props) {
  const [checkedIn, setCheckedIn] = useState(!!todayCheckIn);
  const [minutes, setMinutes] = useState(todayCheckIn?.minutes ?? 60);
  const [note, setNote] = useState(todayCheckIn?.note ?? "");
  const [currentStreak, setCurrentStreak] = useState(streaks.currentStreak);
  const [copied, setCopied] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  const profileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/u/${username}`
    : `/u/${username}`;

  async function handleCheckIn() {
    setCheckInLoading(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes, note }),
    });
    if (res.ok) {
      setCheckedIn(true);
      setCurrentStreak((s) => s + (checkedIn ? 0 : 1));
    }
    setCheckInLoading(false);
  }

  async function handleUndo() {
    await fetch("/api/checkin", { method: "DELETE" });
    setCheckedIn(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const examDays = user.examDate ? daysUntil(user.examDate) : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-400">Streakboard</Link>
        <div className="flex items-center gap-3">
          <Link
            href="/discover"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            🔍 Explore
          </Link>
          <Link
            href={`/u/${username}`}
            target="_blank"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Public profile ↗
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Hey, {user.name.split(" ")[0]} 👋</h1>
          <p className="text-slate-400 text-sm mt-1">Studying for <span className="text-amber-400">{user.studyingFor}</span>
            {examDays !== null && <> · <span className={examDays <= 30 ? "text-red-400" : "text-emerald-400"}>{examDays} days left</span></>}
          </p>
        </div>

        {/* Streak bar */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Current streak" value={`${currentStreak}d`} icon="🔥" highlight />
          <StatCard label="Longest streak" value={`${streaks.longestStreak}d`} icon="🏆" />
          <StatCard label="Days logged" value={`${streaks.totalDays}`} icon="📅" />
        </div>

        {/* Today check-in */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-200 mb-4">
            {checkedIn ? "✅ Logged today!" : "📝 Log today's session"}
          </h2>

          {!checkedIn ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-28 shrink-0">Study time</label>
                <input
                  type="number" min={0} max={600} value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-400 text-sm">minutes</span>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-sm text-slate-400 w-28 shrink-0 pt-2">Note (optional)</label>
                <input
                  type="text" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you cover today?"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={handleCheckIn}
                disabled={checkInLoading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-colors"
              >
                {checkInLoading ? "Saving…" : "Log today ✓"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">{minutes} min logged today 🎉</p>
                {note && <p className="text-slate-500 text-sm mt-1 italic">"{note}"</p>}
              </div>
              <button onClick={handleUndo} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                Undo
              </button>
            </div>
          )}
        </section>

        {/* Projects */}
        <ChecklistSection owned={ownedChecklists} participating={participatingChecklists} userId={userId} />

        {/* Share your profile */}
        <section className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
          <h2 className="font-semibold text-amber-400 mb-2">📣 Share your streak</h2>
          <p className="text-slate-400 text-sm mb-4">
            Your public profile is live. Share it on Twitter, Reddit, or anywhere to inspire others.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 truncate">
              {profileUrl}
            </code>
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 text-center ${highlight ? "bg-amber-500/10 border border-amber-500/30" : "bg-slate-900 border border-slate-800"}`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className={`text-xl font-bold ${highlight ? "text-amber-400" : "text-slate-100"}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function daysUntil(dateStr: string): number {
  const exam = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((exam.getTime() - now.getTime()) / 864e5));
}
