// Skeleton for public project page.
export default function ProjectLoading() {
  return (
    <div className="min-h-screen bg-slate-950 animate-pulse">
      <div className="h-14 bg-slate-900 border-b border-slate-800" />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-2/3 bg-slate-800 rounded" />
          <div className="h-4 w-1/2 bg-slate-800/60 rounded" />
          <div className="h-3 w-40 bg-slate-800/60 rounded" />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-slate-800 rounded" />
              <div className="h-4 flex-1 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
