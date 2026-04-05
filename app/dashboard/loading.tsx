export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-slate-800 rounded-xl" />
        <div className="flex gap-3">
          <div className="h-7 w-16 bg-slate-800 rounded-lg" />
          <div className="h-7 w-16 bg-slate-800 rounded-lg" />
          <div className="h-7 w-20 bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Greeting skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-56 bg-slate-800 rounded-xl" />
        <div className="h-4 w-40 bg-slate-800/60 rounded-lg" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="h-8 w-12 bg-slate-800 rounded-lg" />
            <div className="h-3 w-20 bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Log session + heatmap skeletons */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="h-5 w-32 bg-slate-800 rounded-lg" />
          <div className="h-24 w-full bg-slate-800/60 rounded-xl" />
          <div className="h-10 w-full bg-slate-800 rounded-xl" />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="h-5 w-24 bg-slate-800 rounded-lg" />
          <div className="h-24 w-full bg-slate-800/60 rounded-xl" />
        </div>
      </div>

      {/* Projects skeleton */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 bg-slate-800 rounded-lg" />
          <div className="h-5 w-24 bg-slate-800 rounded-lg" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 bg-slate-700 rounded" />
              <div className="h-4 w-48 bg-slate-700 rounded" />
              <div className="ml-auto h-4 w-12 bg-slate-700 rounded" />
            </div>
            <div className="h-1.5 w-full bg-slate-700 rounded-full">
              <div className="h-1.5 w-1/3 bg-slate-600 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
