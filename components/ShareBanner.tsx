export default function ShareBanner({ username }: { username: string }) {
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/u/${username}`
    : `/u/${username}`;

  return (
    <div className="mt-8 border-t border-slate-800 pt-6 text-center">
      <p className="text-slate-500 text-sm">
        Built with{" "}
        <a href="/" className="text-amber-400 hover:text-amber-300 font-medium">
          Streakboard
        </a>{" "}
        · Track your learning. Share your streak.
      </p>
      <a
        href="/"
        className="inline-block mt-3 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors"
      >
        Create your free Streakboard →
      </a>
    </div>
  );
}
