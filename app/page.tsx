import Link from "next/link";

const DEMO_CELLS = Array.from({ length: 140 }, (_, i) => {
  const rand = Math.random();
  const level = i < 100 && rand > 0.55
    ? rand > 0.85 ? 3 : rand > 0.7 ? 2 : 1
    : 0;
  return { level };
});

// Three-step product explanation. Replaces the old 6-card feature grid,
// which read as generic habit-tracker territory ("Completely free",
// "Daily streak tracking" as standalone cards). Each step here answers a
// different user question: what is this, what do I do, what do I get.
const STEPS = [
  {
    icon: "📚",
    title: "Pick a roadmap or build your own",
    desc: "Start from a community checklist — USMLE, MBBS, CFA, AWS, marathon training, \u201Cwrite a novel in a year\u201D — or paste your own markdown. Nested topics, sections, sub-items.",
  },
  {
    icon: "✅",
    title: "Check in daily",
    desc: "Log minutes or notes. Mark items done as you finish them. Your streak and heatmap update automatically.",
  },
  {
    icon: "🔗",
    title: "Share one link",
    desc: "Your profile at streakboard.com/u/you shows your goal countdown, list progress, and streak. Friends and accountability partners follow along — no login needed to view.",
  },
];

// Hardcoded marketplace teaser. NOT a DB fetch — Session 1 ships positioning,
// not plumbing. Real featured cards pull from Discover once the tiered UI
// (Verified / Community tabs, upvote sort) lands in later sessions.
// MBBS carries a "Verified" pill as a visual preview of the future badge.
const FEATURED = [
  { title: "USMLE Step 1", category: "Medicine" },
  { title: "MBBS (Universiti Malaya)", category: "Medicine", verified: true },
  { title: "AWS Solutions Architect Associate", category: "Tech" },
  { title: "CFA Level 1", category: "Finance" },
  { title: "Marathon training (16 weeks)", category: "Fitness" },
  { title: "Write a novel — NaNoWriMo plan", category: "Creative" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 animate-fadeIn">
      {/* Nav */}
      <header className="border-b border-slate-800/60 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md transition-all duration-200">
        <span className="text-xl font-black text-amber-500 tracking-tighter hover:scale-105 transition-transform cursor-default">Streakboard</span>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-bold text-slate-400 hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-amber-400 after:transition-all after:duration-200 uppercase tracking-widest">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/10"
          >
            Get started free
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium mb-6">
            Shared roadmaps for anything you&rsquo;re working toward
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 leading-tight mb-6">
            Pick a roadmap.<br />
            <span className="text-amber-400">Check in daily.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Browse community-built checklists for exams, skills, certifications, fitness, side projects — or publish your own.
            Track topics as you finish them, keep a streak, and share one link with anyone on the same path.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-base transition-colors"
            >
              Start your board →
            </Link>
            <Link
              href="/discover"
              className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-base transition-colors border border-slate-700"
            >
              Browse roadmaps
            </Link>
          </div>
        </section>

        {/* Demo heatmap — illustrative example, labelled as such.
            Non-academic goal (Ironman) deliberately chosen to reinforce
            that this isn't exam-prep-only. */}
        <section className="max-w-2xl mx-auto px-6 pb-16">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-lg font-bold text-amber-400">E</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">Example profile</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">illustrative</span>
                </div>
                <div className="text-xs text-slate-500">Training for Ironman · 94 days left</div>
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

        {/* How it works — 3 steps. Replaces the old 6-card grid. */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <h2 className="text-2xl font-bold text-slate-100 text-center mb-10">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative">
                <div className="absolute top-3 right-4 text-xs font-mono text-slate-600">{String(i + 1).padStart(2, "0")}</div>
                <div className="text-2xl mb-3">{s.icon}</div>
                <h3 className="font-semibold text-slate-200 mb-1">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Community marketplace teaser. */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Built by the community</h2>
            <p className="text-slate-400 text-sm">Anyone can publish a roadmap. The best ones rise to the top.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURED.map((f) => (
              <div
                key={f.title}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-slate-200 text-sm leading-snug">{f.title}</h3>
                  {f.verified && (
                    <span
                      className="shrink-0 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 uppercase tracking-wider"
                      title="Reviewed and endorsed by a Streakboard curator"
                    >
                      ✓ Verified
                    </span>
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{f.category}</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              href="/discover"
              className="inline-block text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              Browse all roadmaps →
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-800 py-16 text-center px-6">
          <h2 className="text-2xl font-bold text-slate-100 mb-4">Start your board</h2>
          <p className="text-slate-400 mb-8">Free to use. Donations welcome. Takes 30 seconds.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-block px-10 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-base transition-colors"
            >
              Start your board →
            </Link>
            <Link
              href="/discover"
              className="inline-block px-10 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-base transition-colors border border-slate-700"
            >
              Browse roadmaps
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-slate-600 text-sm">
        Streakboard · Open-market roadmaps · Built by @blue + contributors · Free to use · Donations welcome
      </footer>
    </div>
  );
}
