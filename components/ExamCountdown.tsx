interface Props {
  studyingFor: string;
  examDate?: string | null;
}

export default function ExamCountdown({ studyingFor, examDate }: Props) {
  const days = examDate ? daysUntil(examDate) : null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex items-center gap-4">
      <div className="text-3xl">🎯</div>
      <div className="flex-1 min-w-0">
        <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Studying for</div>
        <div className="font-semibold text-slate-100 truncate">{studyingFor}</div>
      </div>
      {days !== null && (
        <div className="text-right shrink-0">
          <div className={`text-3xl font-bold ${days <= 30 ? "text-red-400" : days <= 90 ? "text-amber-400" : "text-emerald-400"}`}>
            {days}
          </div>
          <div className="text-xs text-slate-400">days left</div>
        </div>
      )}
    </div>
  );
}

function daysUntil(dateStr: string): number {
  const exam = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((exam.getTime() - now.getTime()) / 864e5));
}
