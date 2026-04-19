export default function LogsLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 space-y-4 animate-pulse">
      {/* Top header skeleton (Streakboard brand + nav) */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-slate-800 rounded-xl" />
        <div className="h-6 w-20 bg-slate-800/60 rounded-lg" />
      </div>

      {/* Title skeleton */}
      <div className="space-y-2 pt-2">
        <div className="h-7 w-32 bg-slate-800 rounded-xl" />
        <div className="h-4 w-56 bg-slate-800/60 rounded-lg" />
      </div>

      {/* Log list skeleton */}
      <div className="space-y-3 pt-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-4 w-16 bg-slate-800/60 rounded" />
            </div>
            <div className="h-3 w-3/4 bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
