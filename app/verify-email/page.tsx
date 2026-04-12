"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyForm() {
  const searchParams = useSearchParams();
  const username = searchParams.get("u") || "";
  // Password stored in sessionStorage (not URL) for auto-login after verification
  const [password] = useState(() => {
    try { return sessionStorage.getItem("streakboard_verify_pw") || ""; } catch { return ""; }
  });
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    // Handle paste of full code
    if (value.length > 1) {
      const chars = value.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) next[i] = chars[i] || "";
      setDigits(next);
      const focusIdx = Math.min(chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) { setError("Enter all 6 digits"); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Verification failed");
      setLoading(false);
      return;
    }

    // Auto sign-in if password was stored from signup
    if (password) {
      try { sessionStorage.removeItem("streakboard_verify_pw"); } catch { /* noop */ }
      try { sessionStorage.removeItem("streakboard_pending_migration"); } catch { /* noop */ }
      const signInRes = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        window.location.href = "/login?verified=1";
        return;
      }
      // Migrate guest data if present
      try {
        const migrationData = sessionStorage.getItem("streakboard_pending_migration");
        if (migrationData) {
          await fetch("/api/migrate-guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: migrationData,
          });
          sessionStorage.removeItem("streakboard_pending_migration");
          try { localStorage.removeItem("streakboard_guest"); } catch { /* noop */ }
        }
      } catch { /* noop */ }
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/login?verified=1";
    }
  }

  async function resendCode() {
    setResending(true);
    setError("");
    const res = await fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, resend: true }),
    });
    setResending(false);
    if (res.ok) {
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } else {
      setError("Could not resend — please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 animate-fadeIn">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block group transition-all duration-300 hover:scale-105">
            <span className="text-3xl font-black text-amber-500 tracking-tighter">Streakboard</span>
          </Link>
          <p className="text-slate-400 mt-3 text-sm font-medium">
            Check your email for a 6-digit code
          </p>
          {username && (
            <p className="text-slate-600 text-xs mt-1">
              Verifying account <span className="text-slate-400">@{username}</span>
            </p>
          )}
        </div>

        <form onSubmit={verify} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={i === 0 ? 6 : 1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 bg-slate-800 border border-slate-700 rounded-xl text-center text-xl font-black text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
              />
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-xs font-bold uppercase tracking-tighter bg-red-400/10 rounded-xl px-4 py-2.5 border border-red-400/20 animate-fadeIn text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || digits.join("").length !== 6}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/10"
          >
            {loading ? "Verifying…" : "Verify my email"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={resendCode}
              disabled={resending || resent}
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors disabled:opacity-50"
            >
              {resending ? "Sending…" : resent ? "✓ Code sent — check your email" : "Didn't get a code? Resend"}
            </button>
          </div>
        </form>

        <p className="text-center text-slate-600 mt-6 text-xs">
          Wrong account?{" "}
          <Link href="/signup" className="text-amber-500 hover:text-amber-400 transition-colors font-bold">
            Start over
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Loading…</p></div>}>
      <VerifyForm />
    </Suspense>
  );
}
