// Skeleton for /discover — mirrors the search bar + 6 card grid so the
// layout doesn't shift when real content arrives.
export default function DiscoverLoading() {
  return (
    <div className="min-h-screen bg-slate-950 animate-pulse">
      <div className="h-14 bg-slate-900 border-b border-slate-800" />
      <main className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        <div className="space-y-3">
          <div className="h-8 w-48 bg-slate-800 rounded-xl" />
          <div className="h-4 w-80 max-w-full bg-slate-800/60 rounded-lg" />
        </div>
        <div className="h-14 w-full bg-slate-900 border border-slate-800 rounded-2xl" />
        <div className="space-y-6">
          <div className="h-3 w-40 bg-slate-800 rounded" />
          <div className="grid sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="h-5 w-3/4 bg-slate-800 rounded" />
                <div className="h-3 w-full bg-slate-800/60 rounded" />
                <div className="h-3 w-2/3 bg-slate-800/60 rounded" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-16 bg-slate-800 rounded-full" />
                  <div className="h-6 w-20 bg-slate-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
