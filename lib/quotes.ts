// Rotating motivational quotes for the dashboard greeting.
// Deterministic per-day so the quote doesn't flicker across re-renders
// but still changes every day for variety.
export const QUOTES: string[] = [
  "Small steps, every day — that's how streaks are built.",
  "Consistency beats intensity. Show up today.",
  "One check-in at a time. You've got this.",
  "Progress, not perfection.",
  "The streak rewards who shows up, not who rushes.",
  "Tiny gains compound. Keep going.",
  "Don't break the chain.",
  "Future you will thank present you.",
  "Start where you are. Use what you have. Do what you can.",
  "The best time to study was yesterday. The second best is now.",
  "Discipline is choosing what you want most over what you want now.",
  "Every expert was once a beginner.",
  "Motivation gets you started. Habit keeps you going.",
  "You don't need to be fast. You need to be steady.",
  "One page today beats a whole chapter next week.",
  "Hard work in silence. Let the streak make the noise.",
  "Focus on the process. The results will follow.",
  "Showing up is half the battle.",
  "A little progress each day adds up to big results.",
  "The only bad study session is the one you skipped.",
  "Be stubborn about your goals, flexible about your methods.",
  "You're closer than you were yesterday.",
  "Done is better than perfect.",
  "Trust the grind.",
  "Keep the streak alive — your future self is watching.",
  "Small effort, done daily, changes everything.",
  "The secret to getting ahead is getting started.",
  "You didn't come this far to only come this far.",
  "One log at a time. One day at a time.",
  "Discipline today, freedom tomorrow.",
];

// Pick a quote based on the local date — same quote for the whole day.
export function quoteForToday(seed?: string): string {
  const today = new Date();
  const key = seed ?? `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return QUOTES[Math.abs(hash) % QUOTES.length];
}
