"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNeedsVerification(false);

    const res = await signIn("credentials", {
      username: username.toLowerCase().trim(),
      password,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    if (res?.error) {
      // Check if user exists but is unverified (password correct but blocked)
      const checkRes = await fetch(`/api/check-verified?u=${encodeURIComponent(username.toLowerCase().trim())}`);
      const checkData = await checkRes.json().catch(() => ({}));
      if (checkData.exists && !checkData.verified) {
        setNeedsVerification(true);
        setError("Please verify your email before signing in.");
      } else {
        setError("Invalid username or password");
      }
      setLoading(false);
    } else if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 animate-fadeIn">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block group transition-all duration-300 hover:scale-105">
            <span className="text-3xl font-black text-amber-500 tracking-tighter">Streakboard</span>
          </Link>
          <p className="text-slate-500 mt-2 text-sm font-medium">Sign in to your account</p>
        </div>

        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl hover:border-slate-700 transition-all duration-300">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Username</label>
            <input
              type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-400/10 rounded-xl px-4 py-2.5 border border-red-400/20 animate-fadeIn">
              <p className="text-red-400 text-xs font-bold uppercase tracking-tighter">{error}</p>
              {needsVerification && (
                <Link
                  href={`/verify-email?u=${encodeURIComponent(username.toLowerCase().trim())}`}
                  className="text-amber-500 hover:text-amber-400 text-xs font-bold mt-1 inline-block"
                >
                  Go to verification page →
                </Link>
              )}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/10 mt-2"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-slate-500 mt-6 text-sm font-medium">
          No account?{" "}
          <Link href="/signup" className="text-amber-500 hover:text-amber-400 transition-colors font-bold">Create one free</Link>
        </p>
      </div>
    </div>
  );

}
