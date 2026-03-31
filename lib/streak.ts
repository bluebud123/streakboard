/** Calculate current and longest streak from an array of YYYY-MM-DD date strings */
export function calcStreaks(dates: string[]): {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
} {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0, totalDays: 0 };

  const unique = [...new Set(dates)].sort().reverse();
  const today = localDateKey(new Date());
  const yesterday = localDateKey(new Date(Date.now() - 864e5));

  let currentStreak = 0;
  if (unique[0] === today || unique[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < unique.length; i++) {
      const a = new Date(unique[i - 1]);
      const b = new Date(unique[i]);
      const diff = Math.round((a.getTime() - b.getTime()) / 864e5);
      if (diff === 1) currentStreak++;
      else break;
    }
  }

  let longestStreak = 0;
  let temp = 1;
  for (let i = 1; i < unique.length; i++) {
    const a = new Date(unique[i - 1]);
    const b = new Date(unique[i]);
    const diff = Math.round((a.getTime() - b.getTime()) / 864e5);
    if (diff === 1) {
      temp++;
      longestStreak = Math.max(longestStreak, temp);
    } else {
      temp = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak, unique.length > 0 ? 1 : 0);

  return { currentStreak, longestStreak, totalDays: unique.length };
}

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Build a 20-week heatmap grid (140 cells, oldest→newest) */
export function buildHeatmap(
  checkIns: { date: string; minutes: number }[]
): { date: string; level: 0 | 1 | 2 | 3; minutes: number }[] {
  const minuteMap: Record<string, number> = {};
  for (const c of checkIns) {
    minuteMap[c.date] = (minuteMap[c.date] || 0) + c.minutes;
  }

  const cells: { date: string; level: 0 | 1 | 2 | 3; minutes: number }[] = [];
  const today = new Date();

  // Start from 139 days ago
  for (let i = 139; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const mins = minuteMap[key] || 0;
    let level: 0 | 1 | 2 | 3 = 0;
    if (mins >= 60) level = 3;
    else if (mins >= 30) level = 2;
    else if (mins > 0) level = 1;
    cells.push({ date: key, level, minutes: mins });
  }

  return cells;
}

/** Calc study time stats */
export function calcStudyStats(checkIns: { date: string; minutes: number }[]) {
  const today = new Date();
  const weekStart = localDateKey(new Date(today.getTime() - 6 * 864e5));

  let weekMins = 0;
  let allTimeMins = 0;
  for (const c of checkIns) {
    allTimeMins += c.minutes;
    if (c.date >= weekStart) weekMins += c.minutes;
  }

  return {
    weekHours: +(weekMins / 60).toFixed(1),
    allTimeHours: +(allTimeMins / 60).toFixed(1),
  };
}
