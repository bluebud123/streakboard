interface Goal {
  id: string;
  text: string;
  target: number;
  current: number;
  unit: string;
}

export default function GoalCard({ goal }: { goal: Goal }) {
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex justify-between items-start mb-2 gap-2">
        <span className="text-sm text-slate-200 font-medium">{goal.text}</span>
        <span className="text-xs text-slate-400 shrink-0">
          {goal.current}/{goal.target} {goal.unit}
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className="bg-amber-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-slate-500 mt-1">{pct}%</div>
    </div>
  );
}
