"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import ChecklistSection, { type ChecklistData } from "@/components/ChecklistSection";

interface Goal {
  id: string;
  text: string;
  target: number;
  current: number;
  unit: string;
  achieved: boolean;
  achievedDate: string | null;
}

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
  goals: Goal[];
  username: string;
  ownedChecklists: ChecklistData[];
  participatingChecklists: ChecklistData[];
  userId: string;
}

export default function DashboardClient({ user, streaks, todayCheckIn, goals: initialGoals, username, ownedChecklists, participatingChecklists, userId }: Props) {
  const [checkedIn, setCheckedIn] = useState(!!todayCheckIn);
  const [minutes, setMinutes] = useState(todayCheckIn?.minutes ?? 60);
  const [note, setNote] = useState(todayCheckIn?.note ?? "");
  const [currentStreak, setCurrentStreak] = useState(streaks.currentStreak);
  const [goals, setGoals] = useState(initialGoals);
  const [newGoal, setNewGoal] = useState({ text: "", target: "", unit: "times" });
  const [showGoalForm, setShowGoalForm] = useState(false);
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

  async function increment(id: string) {
    const res = await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "increment" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setGoals((gs) => gs.map((g) => (g.id === id ? updated : g)));
    }
  }

  async function decrement(id: string) {
    const res = await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "decrement" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setGoals((gs) => gs.map((g) => (g.id === id ? updated : g)));
    }
  }

  async function deleteGoal(id: string) {
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "delete" }),
    });
    setGoals((gs) => gs.filter((g) => g.id !== id));
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!newGoal.text || !newGoal.target) return;
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newGoal),
    });
    if (res.ok) {
      const g = await res.json();
      setGoals((gs) => [...gs, g]);
      setNewGoal({ text: "", target: "", unit: "times" });
      setShowGoalForm(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const examDays = user.examDate ? daysUntil(user.examDate) : null;
  const activeGoals = goals.filter((g) => !g.achieved);
  const achievedGoals = goals.filter((g) => g.achieved);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-400">Streakboard</Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/u/${username}`}
            target="_blank"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            View public profile ↗
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

        {/* Goals */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Goals</h2>
            <button
              onClick={() => setShowGoalForm((v) => !v)}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              {showGoalForm ? "Cancel" : "+ Add goal"}
            </button>
          </div>

          {showGoalForm && (
            <form onSubmit={addGoal} className="mb-4 bg-slate-800 rounded-xl p-4 space-y-3">
              <input
                type="text" required value={newGoal.text} placeholder="Goal description"
                onChange={(e) => setNewGoal((g) => ({ ...g, text: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
              />
              <div className="flex gap-2">
                <input
                  type="number" required min={1} value={newGoal.target} placeholder="Target"
                  onChange={(e) => setNewGoal((g) => ({ ...g, target: e.target.value }))}
                  className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text" value={newGoal.unit} placeholder="unit (times, days…)"
                  onChange={(e) => setNewGoal((g) => ({ ...g, unit: e.target.value }))}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
                Add goal
              </button>
            </form>
          )}

          <div className="space-y-3">
            {activeGoals.length === 0 && !showGoalForm && (
              <p className="text-slate-500 text-sm text-center py-4">No active goals. Add one above!</p>
            )}
            {activeGoals.map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <div key={g.id} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex-1 text-sm text-slate-200">{g.text}</span>
                    <span className="text-xs text-slate-400">{g.current}/{g.target} {g.unit}</span>
                    <div className="flex gap-1">
                      <button onClick={() => decrement(g.id)} className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">-</button>
                      <button onClick={() => increment(g.id)} className="w-7 h-7 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm transition-colors">+</button>
                      <button onClick={() => deleteGoal(g.id)} className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-red-500/20 text-slate-500 hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {achievedGoals.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 select-none">
                {achievedGoals.length} achieved goal{achievedGoals.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {achievedGoals.map((g) => (
                  <div key={g.id} className="bg-slate-800/50 rounded-xl px-4 py-2 flex items-center gap-2">
                    <span className="text-emerald-400 text-sm">✓</span>
                    <span className="text-sm text-slate-400 line-through">{g.text}</span>
                    <button onClick={() => deleteGoal(g.id)} className="ml-auto text-slate-600 hover:text-red-400 text-xs transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Checklists */}
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
