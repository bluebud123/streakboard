import Link from "next/link";

const DEMO_CELLS = Array.from({ length: 140 }, (_, i) => {
  const rand = Math.random();
  const level = i < 100 && rand > 0.55
    ? rand > 0.85 ? 3 : rand > 0.7 ? 2 : 1
    : 0;
  return { level };
});

const FEATURES = [
  { icon: "🔥", title: "Daily streak tracking", desc: "Log your study sessions and build an unbreakable daily habit." },
  { icon: "📊", title: "GitHub-style heatmap", desc: "See your consistency at a glance — a full 20 weeks of activity." },
  { icon: "🎯", title: "Goal progress bars", desc: "Set targets, track progress, celebrate wins on your public page." },
  { icon: "⏳", title: "Exam countdown", desc: "See exactly how many days you have left — so does everyone you share with." },
  { icon: "📣", title: "One-link sharing", desc: "streakboard.app/u/you — share anywhere. No login needed to view." },
  { icon: "🆓", title: "Completely free", desc: "No subscriptions, no paywalls. Open source and always free." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <span className="text-xl font-bold text-amber-400">Streakboard</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors"
          >
            Get started free
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium mb-6">
            For exam students &amp; self-improvers
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 leading-tight mb-6">
            Track your learning.<br />
            <span className="text-amber-400">Share your streak.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Build daily study habits and share your progress publicly — like GitHub contributions,
            for your goals. One link. No account needed to view.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-base transition-colors"
            >
              Create your Streakboard →
            </Link>
            <Link
              href="/u/demo"
              className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-base transition-colors border border-slate-700"
            >
              See example profile
            </Link>
          </div>
        </section>

        {/* Demo heatmap */}
        <section className="max-w-2xl mx-auto px-6 pb-16">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-lg font-bold text-amber-400">A</div>
              <div>
                <div className="font-semibold text-slate-200">Alex Johnson</div>
                <div className="text-xs text-slate-500">Studying for USMLE Step 1 · 47 days left</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
                <span className="text-lg">🔥</span>
                <span className="text-amber-400 font-bold text-sm">34 day streak</span>
              </div>
            </div>
            {/* Static demo heatmap */}
            <div
              className="grid gap-1 w-full"
              style={{ gridTemplateColumns: "repeat(20, 1fr)", gridTemplateRows: "repeat(7, 1fr)" }}
            >
              {DEMO_CELLS.map((cell, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-sm ${
                    cell.level === 3 ? "heatmap-l3" :
                    cell.level === 2 ? "heatmap-l2" :
                    cell.level === 1 ? "heatmap-l1" : "heatmap-l0"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-end items-center gap-2 mt-2 text-xs text-slate-500">
              <span>Less</span>
              {[0,1,2,3].map(l => (
                <div key={l} className={`w-3 h-3 rounded-sm ${["heatmap-l0","heatmap-l1","heatmap-l2","heatmap-l3"][l]}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <h2 className="text-2xl font-bold text-slate-100 text-center mb-10">Everything you need to stay consistent</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-slate-200 mb-1">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-800 py-16 text-center px-6">
          <h2 className="text-2xl font-bold text-slate-100 mb-4">Start your streak today</h2>
          <p className="text-slate-400 mb-8">Free forever. No credit card. Takes 30 seconds.</p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-base transition-colors"
          >
            Create your Streakboard →
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-slate-600 text-sm">
        Streakboard · Open source · Built for learners
      </footer>
    </div>
  );
}
