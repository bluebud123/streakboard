"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { localDateKey } from "@/lib/streak";

interface GuestGoal {
  localId: string;
  text: string;
  target: number;
  current: number;
  unit: string;
  achieved: boolean;
  achievedDate: string | null;
}

interface GuestCheckIn {
  date: string;
  minutes: number;
  note: string | null;
}

interface GuestStore {
  version: 1;
  studyingFor: string;
  examDate: string | null;
  checkIns: GuestCheckIn[];
  goals: GuestGoal[];
}

const EMPTY: GuestStore = { version: 1, studyingFor: "", examDate: null, checkIns: [], goals: [] };

function readStore(): GuestStore {
  try {
    const raw = localStorage.getItem("streakboard_guest");
    return raw ? JSON.parse(raw) : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function writeStore(s: GuestStore) {
  try { localStorage.setItem("streakboard_guest", JSON.stringify(s)); } catch { /* noop */ }
}

function calcStreak(checkIns: GuestCheckIn[]): number {
  if (checkIns.length === 0) return 0;
  const today = localDateKey(new Date());
  const yesterday = localDateKey(new Date(Date.now() - 864e5));
  const dates = [...new Set(checkIns.map((c) => c.date))].sort().reverse();
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const a = new Date(dates[i - 1]);
    const b = new Date(dates[i]);
    if (Math.round((a.getTime() - b.getTime()) / 864e5) === 1) streak++;
    else break;
  }
  return streak;
}

export default function GuestPage() {
  const [store, setStore] = useState<GuestStore>(EMPTY);
  const [mounted, setMounted] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ text: "", target: "", unit: "times" });

  const today = typeof window !== "undefined" ? localDateKey(new Date()) : "";

  useEffect(() => {
    const s = readStore();
    setStore(s);
    setMounted(true);

    // beforeunload warning
    const handler = (e: BeforeUnloadEvent) => {
      const cur = readStore();
      if (cur.checkIns.length > 0 || cur.goals.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function update(fn: (s: GuestStore) => GuestStore) {
    setStore((prev) => {
      const next = fn(prev);
      writeStore(next);
      return next;
    });
  }

  function buildSaveUrl(): string {
    const params = new URLSearchParams({
      studyingFor: store.studyingFor,
      examDate: store.examDate ?? "",
      guestData: JSON.stringify({ checkIns: store.checkIns, goals: store.goals }),
    });
    return `/signup?${params.toString()}`;
  }

  const todayCheckIn = store.checkIns.find((c) => c.date === today);
  const checkedIn = !!todayCheckIn;
  const streak = calcStreak(store.checkIns);
  const activeGoals = store.goals.filter((g) => !g.achieved);
  const achievedGoals = store.goals.filter((g) => g.achieved);
  const hasData = store.checkIns.length > 0 || store.goals.length > 0;

  function handleCheckIn() {
    update((s) => {
      const existing = s.checkIns.findIndex((c) => c.date === today);
      const updated = [...s.checkIns];
      if (existing >= 0) updated[existing] = { date: today, minutes, note: note || null };
      else updated.push({ date: today, minutes, note: note || null });
      return { ...s, checkIns: updated };
    });
  }

  function handleUndo() {
    update((s) => ({ ...s, checkIns: s.checkIns.filter((c) => c.date !== today) }));
  }

  function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!newGoal.text || !newGoal.target) return;
    update((s) => ({
      ...s,
      goals: [...s.goals, {
        localId: crypto.randomUUID(),
        text: newGoal.text,
        target: Number(newGoal.target),
        current: 0,
        unit: newGoal.unit || "times",
        achieved: false,
        achievedDate: null,
      }],
    }));
    setNewGoal({ text: "", target: "", unit: "times" });
    setShowGoalForm(false);
  }

  function incrementGoal(localId: string) {
    update((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.localId !== localId) return g;
        const next = g.current + 1;
        return { ...g, current: next, achieved: next >= g.target, achievedDate: next >= g.target ? today : null };
      }),
    }));
  }

  function decrementGoal(localId: string) {
    update((s) => ({
      ...s,
      goals: s.goals.map((g) => g.localId === localId ? { ...g, current: Math.max(0, g.current - 1), achieved: false, achievedDate: null } : g),
    }));
  }

  function deleteGoal(localId: string) {
    update((s) => ({ ...s, goals: s.goals.filter((g) => g.localId !== localId) }));
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-400">Streakboard</Link>
        <Link href="/signup" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Create account</Link>
      </header>

      {/* Guest banner */}
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-3 flex items-center justify-between gap-4">
        <p className="text-yellow-300 text-sm">
          ⚠️ <strong>Guest mode</strong> — your data lives in this browser only. Closing or clearing storage will erase it.
        </p>
        {hasData && (
          <Link
            href={buildSaveUrl()}
            className="shrink-0 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors"
          >
            Save my progress →
          </Link>
        )}
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Studying for (editable) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-slate-400 text-sm shrink-0">Studying for:</span>
          <input
            type="text"
            value={store.studyingFor}
            onChange={(e) => update((s) => ({ ...s, studyingFor: e.target.value }))}
            placeholder="e.g. USMLE Step 1"
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none border-b border-slate-700 focus:border-amber-500 transition-colors pb-0.5"
          />
        </div>

        {/* Streak bar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 text-center bg-amber-500/10 border border-amber-500/30">
            <div className="text-xl mb-1">🔥</div>
            <div className="text-xl font-bold text-amber-400">{streak}d</div>
            <div className="text-xs text-slate-500 mt-0.5">Current streak</div>
          </div>
          <div className="rounded-xl p-4 text-center bg-slate-900 border border-slate-800">
            <div className="text-xl mb-1">📅</div>
            <div className="text-xl font-bold text-slate-100">{store.checkIns.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Days logged</div>
          </div>
        </div>

        {/* Check-in */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-200 mb-4">
            {checkedIn ? "✅ Logged today!" : "📝 Log today's session"}
          </h2>
          {!checkedIn ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-28 shrink-0">Study time</label>
                <input type="number" min={0} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-amber-500" />
                <span className="text-slate-400 text-sm">minutes</span>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-sm text-slate-400 w-28 shrink-0 pt-2">Note (optional)</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you cover today?"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <button onClick={handleCheckIn} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors">
                Log today ✓
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">{todayCheckIn?.minutes} min logged 🎉</p>
                {todayCheckIn?.note && <p className="text-slate-500 text-sm mt-1 italic">"{todayCheckIn.note}"</p>}
              </div>
              <button onClick={handleUndo} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Undo</button>
            </div>
          )}
        </section>

        {/* Goals */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Goals</h2>
            <button onClick={() => setShowGoalForm((v) => !v)} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
              {showGoalForm ? "Cancel" : "+ Add goal"}
            </button>
          </div>
          {showGoalForm && (
            <form onSubmit={addGoal} className="mb-4 bg-slate-800 rounded-xl p-4 space-y-3">
              <input type="text" required value={newGoal.text} placeholder="Goal description"
                onChange={(e) => setNewGoal((g) => ({ ...g, text: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
              <div className="flex gap-2">
                <input type="number" required min={1} value={newGoal.target} placeholder="Target"
                  onChange={(e) => setNewGoal((g) => ({ ...g, target: e.target.value }))}
                  className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
                <input type="text" value={newGoal.unit} placeholder="unit"
                  onChange={(e) => setNewGoal((g) => ({ ...g, unit: e.target.value }))}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">Add goal</button>
            </form>
          )}
          <div className="space-y-3">
            {activeGoals.length === 0 && !showGoalForm && (
              <p className="text-slate-500 text-sm text-center py-4">No goals yet.</p>
            )}
            {activeGoals.map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <div key={g.localId} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex-1 text-sm text-slate-200">{g.text}</span>
                    <span className="text-xs text-slate-400">{g.current}/{g.target} {g.unit}</span>
                    <div className="flex gap-1">
                      <button onClick={() => decrementGoal(g.localId)} className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">-</button>
                      <button onClick={() => incrementGoal(g.localId)} className="w-7 h-7 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm transition-colors">+</button>
                      <button onClick={() => deleteGoal(g.localId)} className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-red-500/20 text-slate-500 hover:text-red-400 text-xs transition-colors">✕</button>
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
              <summary className="text-xs text-slate-500 cursor-pointer">{achievedGoals.length} achieved</summary>
              <div className="mt-2 space-y-2">
                {achievedGoals.map((g) => (
                  <div key={g.localId} className="bg-slate-800/50 rounded-xl px-4 py-2 flex items-center gap-2">
                    <span className="text-emerald-400 text-sm">✓</span>
                    <span className="text-sm text-slate-400 line-through">{g.text}</span>
                    <button onClick={() => deleteGoal(g.localId)} className="ml-auto text-slate-600 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* CTA to sign up */}
        <section className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 text-center">
          <h2 className="font-semibold text-amber-400 mb-2">Want to share your streak?</h2>
          <p className="text-slate-400 text-sm mb-4">Sign up to get your public profile link and keep your data safe.</p>
          {hasData ? (
            <Link href={buildSaveUrl()} className="inline-block px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-colors">
              Save progress & create account →
            </Link>
          ) : (
            <Link href="/signup" className="inline-block px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-colors">
              Create free account →
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
