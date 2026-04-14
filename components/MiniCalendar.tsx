"use client";

import { useState, useEffect } from "react";

interface CheckInRecord {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
  createdAt: string;
}

interface Props {
  checkIns: CheckInRecord[];
  reviewsByDate?: Record<string, string[]>;
  defaultDate?: string; // YYYY-MM-DD — pre-selected date on mount
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default function MiniCalendar({ checkIns, reviewsByDate = {}, defaultDate }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const today = now ?? new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  // Auto-select today (or provided defaultDate) on mount
  const [selected, setSelected] = useState<string | null>(defaultDate ?? null);

  // Re-initialize with client-side time after mount to fix SSR timezone mismatch
  useEffect(() => {
    const clientNow = new Date();
    setNow(clientNow);
    setYear(clientNow.getFullYear());
    setMonth(clientNow.getMonth());
    if (!defaultDate) {
      const pad = (n: number) => String(n).padStart(2, "0");
      setSelected(`${clientNow.getFullYear()}-${pad(clientNow.getMonth() + 1)}-${pad(clientNow.getDate())}`);
    }
  }, [defaultDate]);

  // Group check-ins by date
  const checkInsByDate: Record<string, CheckInRecord[]> = {};
  for (const c of checkIns) {
    if (!checkInsByDate[c.date]) checkInsByDate[c.date] = [];
    checkInsByDate[c.date].push(c);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function pad(n: number) { return String(n).padStart(2, "0"); }
  function dateKey(d: number) { return `${year}-${pad(month + 1)}-${pad(d)}`; }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const selectedLogs = selected ? (checkInsByDate[selected] ?? []) : [];
  const selectedReviews = selected ? (reviewsByDate[selected] ?? []) : [];
  const hasSelectedData = selectedLogs.length > 0 || selectedReviews.length > 0;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function formatTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700/50 transition-all duration-300 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all active:scale-90">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-bold text-slate-100 tracking-tight">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all active:scale-90">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const key = dateKey(day);
          const logsForDay = checkInsByDate[key] ?? [];
          const hasCheckIn = logsForDay.length > 0;
          const isToday = key === todayKey;
          const isSelected = key === selected;

          return (
            <button
              key={key}
              onClick={() => setSelected(isSelected ? null : key)}
              className={`relative flex items-center justify-center h-8 w-full rounded-lg text-xs font-bold transition-all duration-200 active:scale-95
                ${isSelected 
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105 z-10" 
                  : isToday 
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20" 
                    : hasCheckIn 
                      ? "text-slate-200 hover:bg-slate-800 hover:text-white bg-slate-800/30" 
                      : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                }`}
            >
              {day}
              {hasCheckIn && !isSelected && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday ? "bg-amber-500" : "bg-amber-500/60"}`} />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {new Date(selected + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </p>
            {hasSelectedData && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 uppercase">Activity</span>
            )}
          </div>

          {!hasSelectedData && (
            <p className="text-xs text-slate-600 italic">No activity on this day.</p>
          )}

          {selectedLogs.length > 0 && (
            <details open={selected === todayKey}>
              <summary className="text-xs font-semibold text-slate-400 cursor-pointer list-none flex items-center gap-1 select-none">
                <span className="text-amber-400 text-[10px]">▶</span> Sessions ({selectedLogs.length})
                <span className="text-slate-600 ml-1">{selectedLogs.reduce((s, l) => s + l.minutes, 0)} min total</span>
              </summary>
              <div className="mt-2 space-y-1.5 pl-3">
                {selectedLogs.map((log) => (
                  <div key={log.id} className="text-xs">
                    <span className="text-amber-400 font-semibold">{log.minutes > 0 ? `${log.minutes} min` : "—"}</span>
                    <span className="text-slate-600 ml-1">{formatTime(log.createdAt)}</span>
                    {log.note && <p className="text-slate-400 italic mt-0.5">"{log.note}"</p>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {selectedReviews.length > 0 && (
            <details open={selected === todayKey}>
              <summary className="text-xs font-semibold text-slate-400 cursor-pointer list-none flex items-center gap-1 select-none">
                <span className="text-emerald-400 text-[10px]">▶</span> Reviewed ({selectedReviews.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-3">
                {selectedReviews.map((text, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                    <span className="text-emerald-500/60 shrink-0">✓</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
          <span className="text-xs text-slate-600">Session logged</span>
        </div>
      </div>
    </div>
  );
}
