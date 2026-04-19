// Skeleton for public profile page.
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-slate-950 animate-pulse">
      <div className="h-14 bg-slate-900 border-b border-slate-800" />
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-slate-800" />
          <div className="space-y-2">
            <div className="h-6 w-40 bg-slate-800 rounded" />
            <div className="h-4 w-24 bg-slate-800/60 rounded" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-24" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-24" />
          ))}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-48" />
      </main>
    </div>
  );
}
