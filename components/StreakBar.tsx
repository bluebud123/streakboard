"use client";

import { localDateKey } from "@/lib/streak";

// Alex-Johnson-style horizontal strip: last N days of check-in activity.
// Each bar's height reflects that day's total minutes; empty days are dim.
// Hover reveals the date + minute count. Today is subtly highlighted.
export default function StreakBar({
  checkIns,
  days = 30,
  className = "",
}: {
  checkIns: { date: string; minutes: number }[];
  days?: number;
  className?: string;
}) {
  const todayKey = localDateKey(new Date());
  const minutesByDate = new Map<string, number>();
  for (const c of checkIns) {
    minutesByDate.set(c.date, (minutesByDate.get(c.date) ?? 0) + c.minutes);
  }

  // Build date window [days-1 ago ... today]
  const bars: { date: string; minutes: number; isToday: boolean }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    bars.push({ date: key, minutes: minutesByDate.get(key) ?? 0, isToday: key === todayKey });
  }

  // Scale height by minutes; cap at 120 min so outliers don't dwarf others.
  const max = Math.max(60, ...bars.map((b) => Math.min(b.minutes, 120)));
  const activeDays = bars.filter((b) => b.minutes > 0).length;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Last {days} days</h3>
        <span className="text-xs text-slate-500">{activeDays}/{days} active</span>
      </div>
      <div className="flex items-end gap-[2px] h-12" role="img" aria-label={`Study activity over last ${days} days`}>
        {bars.map((b) => {
          const h = b.minutes > 0 ? Math.max(12, Math.round((Math.min(b.minutes, 120) / max) * 100)) : 8;
          const color = b.minutes === 0
            ? "bg-slate-800"
            : b.minutes < 15
            ? "bg-amber-900/60"
            : b.minutes < 45
            ? "bg-amber-500/70"
            : "bg-amber-400";
          return (
            <div
              key={b.date}
              className={`flex-1 rounded-sm transition-all ${color} ${b.isToday ? "ring-1 ring-amber-300/80" : ""}`}
              style={{ height: `${h}%` }}
              title={`${b.date} · ${b.minutes} min${b.isToday ? " (today)" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-600">
        <span>{days}d ago</span>
        <span>today</span>
      </div>
    </div>
  );
}
