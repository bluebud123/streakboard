interface Props {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  weekHours: number;
  allTimeHours: number;
}

export default function StreakStats({ currentStreak, longestStreak, totalDays, weekHours, allTimeHours }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <Stat icon="🔥" label="Current streak" value={`${currentStreak}d`} highlight />
      <Stat icon="🏆" label="Longest streak" value={`${longestStreak}d`} />
      <Stat icon="📅" label="Days logged" value={`${totalDays}`} />
      <Stat icon="⏱️" label="This week" value={`${weekHours}h`} />
      <Stat icon="📚" label="All time" value={`${allTimeHours}h`} />
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 text-center transition-all duration-200 hover:scale-[1.05] hover:shadow-lg ${highlight ? "bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50 hover:shadow-amber-500/5" : "bg-slate-800/50 border border-slate-700 hover:border-slate-600 hover:shadow-slate-950/50"}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-amber-400" : "text-slate-100"}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">{label}</div>
    </div>
  );
}
