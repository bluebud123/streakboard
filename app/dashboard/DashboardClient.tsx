"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import ChecklistSection, { type ChecklistData, type TreeItem } from "@/components/ChecklistSection";
import MiniCalendar from "@/components/MiniCalendar";
import ProjectProgress from "@/components/ProjectProgress";
import { calcStreaks } from "@/lib/streak";
import { toast } from "sonner";

interface CheckIn {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
  studyTime: string | null;
  createdAt: string;
}

interface Props {
  user: { name: string; username: string; studyingFor: string; examDate: string | null; isAdmin: boolean };
  streaks: { currentStreak: number; longestStreak: number; totalDays: number };
  todayLogs: CheckIn[];
  allCheckIns: CheckIn[];
  username: string;
  ownedChecklists: ChecklistData[];
  participatingChecklists: ChecklistData[];
  recentRequests: any[];
  userId: string;
}

function daysUntil(dateStr: string): number {
  const d = dateStr.length > 10 ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((d.getTime() - now.getTime()) / 864e5));
}

function toDateStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function collectReviewsByDate(items: TreeItem[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const it of items) {
    if (!it.isSection && it.revisions?.length) {
      for (const rev of it.revisions) {
        const ds = toDateStr(rev.createdAt).slice(0, 10);
        if (!result[ds]) result[ds] = [];
        if (!result[ds].includes(it.text)) result[ds].push(it.text);
      }
    }
    if (it.children?.length) {
      const sub = collectReviewsByDate(it.children);
      for (const [d, texts] of Object.entries(sub)) {
        if (!result[d]) result[d] = [];
        for (const t of texts) if (!result[d].includes(t)) result[d].push(t);
      }
    }
  }
  return result;
}

function formatLogTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function LogEntry({ log, onEdit, onDelete }: {
  log: CheckIn;
  onEdit: (id: string, minutes: number, note: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(log.minutes || ""));
  const [note, setNote] = useState(log.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onEdit(log.id, minutes ? parseInt(minutes) : 0, note);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="bg-slate-800 rounded-xl p-3 space-y-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notes..."
          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none" />
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)}
            placeholder="0"
            className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-amber-500 placeholder-slate-600" />
          <span className="text-slate-500 text-xs">min <span className="text-slate-600">(optional)</span></span>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-300 text-xs">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between bg-slate-800/60 rounded-xl px-3 py-2.5 group">
      <div className="min-w-0">
        <p className="text-sm text-slate-200 font-medium">
          {log.minutes > 0 ? `${log.minutes} min` : "—"}
          <span className="text-xs text-slate-500 font-normal ml-2">{formatLogTime(log.createdAt)}</span>
        </p>
        {log.note && <p className="text-xs text-slate-400 italic mt-0.5">"{log.note}"</p>}
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
        <button onClick={() => setEditing(true)} className="text-slate-500 hover:text-slate-300 text-xs">✎</button>
        <button onClick={() => onDelete(log.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
      </div>
    </div>
  );
}

interface CollabProgress {
  overall: { userId: string; username: string; done: number; total: number }[];
}

function Leaderboard({ progress, currentUserId }: { progress: CollabProgress; currentUserId: string }) {
  const sorted = [...progress.overall].sort((a, b) => {
    const aPct = a.total > 0 ? a.done / a.total : 0;
    const bPct = b.total > 0 ? b.done / b.total : 0;
    return bPct - aPct;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Leaderboard</h3>
      <div className="space-y-3">
        {sorted.map((p, i) => {
          const isMe = p.userId === currentUserId;
          const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
          return (
            <div key={p.userId} className={`flex items-center gap-3 ${isMe ? "opacity-100" : "opacity-60"}`}>
              <span className="text-xs font-mono text-slate-500 w-4">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium truncate ${isMe ? "text-amber-400" : "text-slate-300"}`}>
                    {isMe ? `@${p.username}` : `Learner ${i + 1}`}
                  </span>
                  <span className="text-[10px] text-slate-500">{pct}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1">
                  <div className={`h-1 rounded-full ${isMe ? "bg-amber-500" : "bg-slate-600"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectRequests({ ownedProjects, recentRequests, onAction }: { 
  ownedProjects: (ChecklistData & { requests?: any[] })[]; 
  recentRequests: any[];
  onAction: () => void;
}) {
  const pending = ownedProjects.flatMap(p => (p.requests || []).map(r => ({ ...r, project: p.name })));

  async function handleRequest(requestId: string, status: "APPROVED" | "REJECTED") {
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "handleProjectRequest", requestId, status }),
    });
    if (res.ok) {
      toast.success(status === "APPROVED" ? "Request approved" : "Request rejected");
      onAction();
    }
  }

  if (pending.length === 0 && recentRequests.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Project Requests</h3>
          <div className="space-y-3">
            {pending.map(r => (
              <div key={r.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                <p className="text-xs text-slate-300">
                  <span className="text-amber-400 font-medium">@{r.requester.username}</span> requested to delete an item from <span className="text-slate-100 font-medium">{r.project}</span>
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleRequest(r.id, "APPROVED")} className="flex-1 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold rounded-lg transition-colors">APPROVE</button>
                  <button onClick={() => handleRequest(r.id, "REJECTED")} className="flex-1 py-1 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 text-[10px] font-bold rounded-lg transition-colors border border-slate-600 hover:border-red-500/50">REJECT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentRequests.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Notifications</h3>
          <div className="space-y-2">
            {recentRequests.map(r => (
              <div key={r.id} className="text-[11px] text-slate-400 py-1 border-b border-slate-800/50 last:border-0">
                {r.status === "REJECTED" ? (
                  <span className="text-red-400/80">✕ Your request for "{r.checklist.name}" was denied.</span>
                ) : (
                  <span className="text-emerald-400/80">✓ Your request for "{r.checklist.name}" was approved.</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardClient({
  user, streaks, todayLogs: initTodayLogs, allCheckIns: initAllCheckIns,
  username, ownedChecklists: initOwned, participatingChecklists: initParticipating, 
  recentRequests: initRecentRequests, userId,
}: Props) {
  const [allCheckIns, setAllCheckIns] = useState(initAllCheckIns);
  const [todayLogs, setTodayLogs] = useState(initTodayLogs);
  const [currentStreak, setCurrentStreak] = useState(streaks.currentStreak);
  // Log form
  const [newNote, setNewNote] = useState("");
  const [newMinutes, setNewMinutes] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0); // seconds
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startTimer() {
    setTimerRunning(true);
    timerRef.current = setInterval(() => setTimerElapsed((s) => s + 1), 1000);
  }

  function stopTimer() {
    setTimerRunning(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (timerElapsed > 0) setNewMinutes(String(Math.max(1, Math.round(timerElapsed / 60))));
  }

  function resetTimer() {
    setTimerRunning(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimerElapsed(0);
  }

  function fmtElapsed(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const [mobileTab, setMobileTab] = useState<"projects" | "log" | "calendar">("projects");
  const [copied, setCopied] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Lifted state — updated by ChecklistSection callbacks for instant optimistic UI
  const [ownedState, setOwnedState] = useState<ChecklistData[]>(initOwned);
  const [participatingState, setParticipatingState] = useState<ChecklistData[]>(initParticipating);
  const [collabProgress, setCollabProgress] = useState<Record<string, CollabProgress>>({});
  const [recentRequestsState, setRecentRequestsState] = useState(initRecentRequests);

  async function refreshData() {
    const res = await fetch("/api/checklists");
    if (res.ok) {
      const data = await res.json();
      setOwnedState(data.owned);
      setParticipatingState(data.participating);
      setRecentRequestsState(data.recentRequests);
    }
  }

  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/u/${username}` : `/u/${username}`;
  const examDays = user.examDate ? daysUntil(user.examDate) : null;
  const todayPrefix = new Date().toISOString().slice(0, 10);

  // Recomputed from STATE (not props) — updates instantly on checkbox
  const reviewsByDate: Record<string, string[]> = {};
  for (const cl of [...ownedState, ...participatingState]) {
    const sub = collectReviewsByDate(cl.items);
    for (const [d, texts] of Object.entries(sub)) {
      if (!reviewsByDate[d]) reviewsByDate[d] = [];
      for (const t of texts) if (!reviewsByDate[d].includes(t)) reviewsByDate[d].push(t);
    }
  }

  const todayReviewed = reviewsByDate[todayPrefix] ?? [];
  const hasLoggedToday = todayLogs.length > 0;

  // allProjects from state — ProjectProgress updates instantly too
  const allProjects: (ChecklistData & { isOwner: boolean })[] = [
    ...ownedState.map((cl) => ({ ...cl, isOwner: true })),
    ...participatingState.map((cl) => ({ ...cl, isOwner: false })),
  ];

  const selectedProject = allProjects.find((p) => p.id === expandedProjectId);
  const selectedProgress = expandedProjectId ? collabProgress[expandedProjectId] : null;
  const isProjectShareable = !!(selectedProject?.slug && selectedProject.visibility !== "PRIVATE");
  const shareUrl = isProjectShareable
    ? (typeof window !== "undefined" ? window.location.origin : "") + `/project/${selectedProject!.slug}`
    : profileUrl;
  const shareLabel = isProjectShareable ? selectedProject!.name : `@${username}`;
  const shareHref = isProjectShareable ? `/project/${selectedProject!.slug}` : `/u/${username}`;

  const leaderboardBlock = selectedProgress && selectedProgress.overall.length > 1 ? (
    <Leaderboard progress={selectedProgress} currentUserId={userId} />
  ) : null;

  const projectRequestsBlock = (
    <ProjectRequests ownedProjects={ownedState} recentRequests={recentRequestsState} onAction={refreshData} />
  );

  function recalcStreak(logs: CheckIn[]) {
    const { currentStreak: s } = calcStreaks(logs.map((c) => c.date));
    setCurrentStreak(s);
  }

  async function handleAddLog() {
    if (timerRunning) stopTimer();
    setLogLoading(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: newMinutes ? parseInt(newMinutes) : 0, note: newNote }),
    });
    if (res.ok) {
      const newLog: CheckIn = await res.json();
      const updated = [newLog, ...allCheckIns];
      setAllCheckIns(updated);
      setTodayLogs((prev) => [newLog, ...prev]);
      recalcStreak(updated);
      setNewMinutes("");
      setNewNote("");
      resetTimer();
      toast.success("Session logged!");
    } else {
      toast.error("Failed to log session — please try again.");
    }
    setLogLoading(false);
  }

  async function handleDeleteLog(id: string) {
    if (!confirm("Delete this log entry?")) return;
    const res = await fetch(`/api/checkin?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      const updated = allCheckIns.filter((c) => c.id !== id);
      setAllCheckIns(updated);
      setTodayLogs((prev) => prev.filter((l) => l.id !== id));
      recalcStreak(updated);
      toast.success("Log entry deleted.");
    } else {
      toast.error("Failed to delete log entry — please try again.");
    }
  }

  async function handleEditLog(id: string, minutes: number, note: string) {
    const res = await fetch("/api/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, minutes, note }),
    });
    if (res.ok) {
      const updated: CheckIn = await res.json();
      setAllCheckIns((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setTodayLogs((prev) => prev.map((l) => (l.id === id ? updated : l)));
      toast.success("Log entry updated.");
    } else {
      toast.error("Failed to update log entry — please try again.");
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSectionClick(id: string) {
    const el = document.querySelector(`[data-item-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add a brief highlight effect
      el.classList.add("ring-2", "ring-amber-500", "ring-offset-2", "ring-offset-slate-900", "rounded");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-amber-500", "ring-offset-2", "ring-offset-slate-900", "rounded");
      }, 2000);
    }
  }

  // Shared blocks
  const streakBadge = (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🔥</span>
        <div>
          <p className="text-2xl font-bold text-amber-400">{currentStreak}<span className="text-sm font-normal text-slate-400 ml-1">day streak</span></p>
          <p className="text-xs text-slate-500">{streaks.longestStreak}d longest · {streaks.totalDays} days total</p>
        </div>
      </div>
      {hasLoggedToday && <div className="mt-2 text-xs text-emerald-400 font-medium">✓ Logged today</div>}
    </div>
  );

  // Always-visible log form (no "+ Add session" toggle)
  const logSection = (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="font-semibold text-slate-200 text-sm mb-3">Sessions today</h2>

      {/* Always-visible add form */}
      <div className="bg-slate-800 rounded-xl p-4 mb-3 space-y-3">
        {/* Notes first */}
        <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2}
          placeholder="What did you study? (optional)"
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 resize-none" />

        {/* Timer row */}
        <div className="flex items-center gap-2">
          {timerRunning ? (
            <button onClick={stopTimer} className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/30 transition-colors">
              ⏹ Stop
            </button>
          ) : (
            <button onClick={startTimer} className="px-3 py-1.5 bg-slate-700 border border-slate-600 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-600 transition-colors">
              ▶ Timer
            </button>
          )}
          {timerElapsed > 0 && (
            <>
              <span className={`text-sm font-mono font-bold ${timerRunning ? "text-amber-400" : "text-slate-300"}`}>{fmtElapsed(timerElapsed)}</span>
              {!timerRunning && <button onClick={resetTimer} className="text-xs text-slate-600 hover:text-slate-400">✕</button>}
            </>
          )}
        </div>

        {/* Optional minutes (below notes) */}
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={600} value={newMinutes} onChange={(e) => setNewMinutes(e.target.value)}
            placeholder="0"
            className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600" />
          <span className="text-slate-500 text-xs">min <span className="text-slate-600">(optional)</span></span>
        </div>

        <button onClick={handleAddLog} disabled={logLoading}
          className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm">
          {logLoading ? "Saving..." : "Log session"}
        </button>
      </div>

      {todayLogs.length === 0 ? (
        <p className="text-slate-500 text-sm italic">No sessions yet today.</p>
      ) : (
        <div className="space-y-2">
          {todayLogs.map((log) => (
            <LogEntry key={log.id} log={log} onEdit={handleEditLog} onDelete={handleDeleteLog} />
          ))}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-slate-800 text-center">
        <Link href="/logs" className="text-xs text-slate-500 hover:text-amber-400 transition-colors">See all logs →</Link>
      </div>
    </section>
  );

  const reviewedTodayBlock = todayReviewed.length > 0 ? (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Reviewed today</h3>
      <ul className="space-y-1">
        {todayReviewed.map((text, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
            <span className="text-amber-500/70 shrink-0 mt-0.5">✓</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const shareCard = (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Share</h3>
      <p className="text-slate-500 text-xs mb-2 truncate">{shareLabel}</p>
      <div className="flex gap-2">
        <code className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-400 truncate">
          {isProjectShareable ? `/project/${selectedProject!.slug}` : `/u/${username}`}
        </code>
        <button onClick={copyLink} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs shrink-0">
          {copied ? "✓" : "Copy"}
        </button>
      </div>
      <Link href={shareHref} target="_blank" className="block mt-2 text-xs text-amber-400/70 hover:text-amber-400 text-center">
        {isProjectShareable ? "View project →" : "View profile →"}
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40 bg-slate-950/95 backdrop-blur">
        <Link href="/" className="text-xl font-bold text-amber-400">Streakboard</Link>
        <div className="flex items-center gap-3">
          {user.isAdmin && <Link href="/admin" className="text-sm text-amber-500 hover:text-amber-400 font-medium">Admin</Link>}
          <Link href="/discover" className="text-sm text-slate-400 hover:text-slate-200">Explore</Link>
          <Link href="/settings" className="text-sm text-slate-400 hover:text-slate-200">Settings</Link>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm text-slate-500 hover:text-slate-300">Sign out</button>
        </div>
      </header>

      <div className="lg:hidden flex border-b border-slate-800 sticky top-[57px] z-30 bg-slate-950">
        {(["projects", "log", "calendar"] as const).map((tab) => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mobileTab === tab ? "text-amber-400 border-amber-400" : "text-slate-500 border-transparent"}`}>
            {tab === "projects" ? "Projects" : tab === "log" ? "Log" : "Calendar"}
          </button>
        ))}
      </div>

      <div className="lg:hidden px-4 py-4 space-y-4">
        {mobileTab === "projects" && (
          <>
            <ChecklistSection
              owned={ownedState}
              participating={participatingState}
              userId={userId}
              onExpandChange={(id) => setExpandedProjectId(id)}
              onOwnedChange={setOwnedState}
              onParticipatingChange={setParticipatingState}
              onCollabProgressChange={setCollabProgress}
            />
            <ProjectProgress projects={allProjects} expandedId={expandedProjectId}
              onSelect={(id) => setExpandedProjectId(expandedProjectId === id ? null : id)}
              onSectionClick={handleSectionClick} />
            {leaderboardBlock}
            {projectRequestsBlock}
            {shareCard}
          </>
        )}
        {mobileTab === "log" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Hey, {user.name.split(" ")[0]}</h1>
              <p className="text-slate-400 text-sm mt-0.5">Studying for <span className="text-amber-400">{user.studyingFor}</span>
                {examDays !== null && <> · <span className={examDays <= 30 ? "text-red-400" : "text-emerald-400"}>{examDays}d left</span></>}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Streak" value={`${currentStreak}d`} icon="🔥" highlight />
              <StatCard label="Longest" value={`${streaks.longestStreak}d`} icon="🏆" />
              <StatCard label="Total" value={`${streaks.totalDays}`} icon="📅" />
            </div>
            {logSection}
            {reviewedTodayBlock}
          </>
        )}
        {mobileTab === "calendar" && (
          <>
            {streakBadge}
            <MiniCalendar checkIns={allCheckIns} reviewsByDate={reviewsByDate} />
          </>
        )}
      </div>

      <div className="hidden lg:grid max-w-[1400px] mx-auto px-4 py-6 grid-cols-[280px_1fr_280px] gap-6 items-start min-h-[calc(100vh-73px)]">
        <aside className="space-y-4 sticky top-[73px] max-h-[calc(100vh-90px)] overflow-y-auto pb-4 pr-1 scrollbar-hide">
          {streakBadge}
          <MiniCalendar checkIns={allCheckIns} reviewsByDate={reviewsByDate} />
          {reviewedTodayBlock}
          {todayLogs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logged today</h3>
                <span className="text-xs text-slate-500">{todayLogs.reduce((s, l) => s + l.minutes, 0)} min total</span>
              </div>
              <div className="space-y-1.5">
                {todayLogs.map((log) => (
                  <div key={log.id} className="text-xs">
                    <span className="text-slate-300 font-medium">{log.minutes > 0 ? `${log.minutes}min` : "—"}</span>
                    <span className="text-slate-600 ml-1">{formatLogTime(log.createdAt)}</span>
                    {log.note && <p className="italic text-slate-500 mt-0.5">"{log.note}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="space-y-6 min-w-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Hey, {user.name.split(" ")[0]}</h1>
            <p className="text-slate-400 text-sm mt-1">Studying for <span className="text-amber-400">{user.studyingFor}</span>
              {examDays !== null && <> · <span className={examDays <= 30 ? "text-red-400" : "text-emerald-400"}>{examDays} days left</span></>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Current streak" value={`${currentStreak}d`} icon="🔥" highlight />
            <StatCard label="Longest streak" value={`${streaks.longestStreak}d`} icon="🏆" />
            <StatCard label="Days logged" value={`${streaks.totalDays}`} icon="📅" />
          </div>
          {logSection}
          <ChecklistSection
            owned={ownedState}
            participating={participatingState}
            userId={userId}
            onExpandChange={(id) => setExpandedProjectId(id)}
            onOwnedChange={setOwnedState}
            onParticipatingChange={setParticipatingState}
            onCollabProgressChange={setCollabProgress}
          />
        </main>

        <aside className="space-y-4 sticky top-[73px] max-h-[calc(100vh-90px)] overflow-y-auto pb-4 pr-1 scrollbar-hide">
          <ProjectProgress projects={allProjects} expandedId={expandedProjectId}
            onSelect={(id) => setExpandedProjectId(expandedProjectId === id ? null : id)}
            onSectionClick={handleSectionClick} />
          {leaderboardBlock}
          {projectRequestsBlock}
          {shareCard}
        </aside>
      </div>
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
