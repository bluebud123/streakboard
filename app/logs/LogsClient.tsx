"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface CheckIn {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
  studyTime: string | null;
  createdAt: string;
  checklistId?: string | null;
  checklistName?: string | null;
}

interface Props {
  initialLogs: CheckIn[];
}

export default function LogsClient({ initialLogs }: Props) {
  const [logs, setLogs] = useState<CheckIn[]>(initialLogs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>("");
  const [editStudyTime, setEditStudyTime] = useState<string>("");

  // Search + filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("__all__");

  // Distinct project names from logs
  const projectNames = useMemo(() => {
    const names = new Set<string>();
    for (const l of logs) {
      if (l.checklistName) names.add(l.checklistName);
    }
    return Array.from(names).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = logs;
    if (projectFilter !== "__all__") {
      result = result.filter((l) => l.checklistName === projectFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((l) =>
        (l.note ?? "").toLowerCase().includes(q) ||
        (l.checklistName ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, searchQuery, projectFilter]);

  // Group filtered logs by date descending
  const grouped = filteredLogs.reduce<Record<string, CheckIn[]>>((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Stats (based on filtered)
  const totalSessions = filteredLogs.length;
  const totalMinutes = filteredLogs.reduce((sum, l) => sum + l.minutes, 0);
  const totalDays = sortedDates.length;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;

  function startEdit(log: CheckIn) {
    setEditingId(log.id);
    setEditMinutes(log.minutes);
    setEditNote(log.note ?? "");
    setEditStudyTime(log.studyTime ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    const res = await fetch("/api/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, minutes: editMinutes, note: editNote, studyTime: editStudyTime }),
    });
    if (res.ok) {
      setLogs((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, minutes: editMinutes, note: editNote || null, studyTime: editStudyTime || null } : l
        )
      );
      setEditingId(null);
    }
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete this log entry?")) return;
    const res = await fetch(`/api/checkin?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setLogs((prev) => prev.filter((l) => l.id !== id));
    }
  }

  const hasFilters = searchQuery.trim() !== "" || projectFilter !== "__all__";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-12 animate-fadeIn">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/dashboard"
            className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-4">All Study Logs</h1>

        {/* Search + Filter bar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {/* Search input */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-amber-500 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Project filter dropdown */}
          {projectNames.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all sm:w-48 shrink-0"
            >
              <option value="__all__">All projects</option>
              {projectNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={() => { setSearchQuery(""); setProjectFilter("__all__"); }}
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors px-2 py-2 whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="bg-slate-800/60 rounded-xl px-4 py-3 mb-6 text-sm text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-medium text-slate-100">{totalSessions} sessions</span>
          <span className="text-slate-500">·</span>
          <span>
            {totalHours > 0 ? `${totalHours}h ` : ""}
            {remainingMins}min
          </span>
          <span className="text-slate-500">·</span>
          <span>{totalDays} study days</span>
          {hasFilters && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-amber-400/70 text-xs">filtered</span>
            </>
          )}
        </div>

        {/* Log groups */}
        {sortedDates.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-12">
            {hasFilters ? "No logs match your filters." : "No study sessions logged yet."}
          </p>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((date) => (
              <div key={date}>
                {/* Date header */}
                <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider py-2 border-b border-slate-800 mb-2">
                  {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>

                {/* Log entries for this date */}
                <div className="space-y-1.5">
                  {grouped[date].map((log) => (
                    <div key={log.id}>
                      {editingId === log.id ? (
                        /* Inline edit form */
                        <div className="bg-slate-800 rounded-xl px-3 py-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="text-slate-400 text-sm w-16 shrink-0">Minutes</label>
                            <input
                              type="number"
                              min={1}
                              value={editMinutes}
                              onChange={(e) => setEditMinutes(Number(e.target.value))}
                              className="bg-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-start gap-2">
                            <label className="text-slate-400 text-sm w-16 shrink-0 pt-1.5">Note</label>
                            <textarea
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              rows={2}
                              placeholder="Optional note…"
                              className="bg-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm flex-1 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-slate-400 text-sm w-16 shrink-0">Time</label>
                            <input
                              type="time"
                              value={editStudyTime}
                              onChange={(e) => setEditStudyTime(e.target.value)}
                              className="bg-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-slate-500 text-xs">optional</span>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={cancelEdit}
                              className="text-sm px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(log.id)}
                              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Log entry row */
                        <div className="flex items-start justify-between py-2.5 px-3 rounded-xl bg-slate-800/60 group/row hover:bg-slate-800 transition-colors">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="text-slate-500 text-xs mt-0.5 shrink-0 w-12">
                              {log.studyTime ?? new Date(log.createdAt).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-200 text-sm font-medium">
                                  {log.minutes} min
                                </span>
                                {log.checklistName && (
                                  <span className="text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded-full font-medium">
                                    📁 {log.checklistName}
                                  </span>
                                )}
                              </div>
                              {log.note && (
                                <p className="text-slate-400 text-sm italic mt-0.5 break-words">
                                  {log.note}
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Action buttons — visible on hover */}
                          <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(log)}
                              title="Edit"
                              className="text-slate-400 hover:text-slate-200 text-sm px-1.5 py-0.5 rounded hover:bg-slate-700 transition-colors"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => deleteLog(log.id)}
                              title="Delete"
                              className="text-slate-400 hover:text-red-400 text-sm px-1.5 py-0.5 rounded hover:bg-slate-700 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
