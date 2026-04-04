"use client";

import { useState } from "react";

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
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default function MiniCalendar({ checkIns, reviewsByDate = {} }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-slate-500 hover:text-slate-300 text-sm px-1">‹</button>
        <span className="text-sm font-semibold text-slate-200">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="text-slate-500 hover:text-slate-300 text-sm px-1">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs text-slate-600 font-medium py-0.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} />;
          const key = dateKey(day);
          const logsForDay = checkInsByDate[key] ?? [];
          const hasCheckIn = logsForDay.length > 0;
          const isToday = key === todayKey;
          const isSelected = key === selected;

          return (
            <button key={key} onClick={() => setSelected(isSelected ? null : key)}
              className={`relative flex flex-col items-center justify-center h-8 w-full rounded-lg text-xs font-medium transition-colors
                ${isSelected ? "bg-amber-500 text-slate-950" :
                  isToday ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" :
                  hasCheckIn ? "text-slate-300 hover:bg-slate-800" :
                  "text-slate-600 hover:bg-slate-800"}`}
            >
              {day}
              {hasCheckIn && !isSelected && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday ? "bg-amber-400" : "bg-amber-500/70"}`} />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
          <p className="text-xs text-slate-500">
            {new Date(selected + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </p>

          {!hasSelectedData && (
            <p className="text-xs text-slate-600 italic">No activity on this day.</p>
          )}

          {selectedLogs.length > 0 && (
            <details>
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
            <details>
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
