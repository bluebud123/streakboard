import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-slate-800/60 bg-slate-950/60 px-6 py-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Streakboard</span>
          <span className="text-slate-700">·</span>
          <span>© {year}</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/discover" className="hover:text-amber-400 transition-colors">
            Explore
          </Link>
          <Link href="/support" className="hover:text-amber-400 transition-colors">
            💛 Support / Feedback
          </Link>
          <a
            href="mailto:yohsh9@gmail.com"
            className="hover:text-amber-400 transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
