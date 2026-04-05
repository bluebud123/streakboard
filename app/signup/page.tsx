"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignupForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    studyingFor: searchParams.get("studyingFor") ?? "",
    examDate: searchParams.get("examDate") ?? "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse guest data from query params
  const guestDataParam = searchParams.get("guestData");
  const pendingMigration = guestDataParam ? (() => { try { return JSON.parse(guestDataParam); } catch { return null; } })() : null;

  const checkUsername = useCallback((value: string) => {
    const slug = value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (slug.length < 2) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/check-username?u=${encodeURIComponent(slug)}`);
      const data = await res.json();
      setUsernameStatus(data.available ? "available" : "taken");
    }, 400);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (k === "username") checkUsername(value);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (usernameStatus === "taken") { setError("Username is already taken"); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Signup failed");
      setLoading(false);
      return;
    }

    // Sign in with username
    const signInRes = await signIn("credentials", {
      username: form.username.toLowerCase(),
      password: form.password,
      redirect: false,
    });

    if (signInRes?.error) {
      setError("Account created but sign-in failed. Please log in.");
      setLoading(false);
      return;
    }

    // Migrate guest data if present
    if (pendingMigration) {
      await fetch("/api/migrate-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingMigration),
      });
      try { localStorage.removeItem("streakboard_guest"); } catch { /* noop */ }
    }

    window.location.href = "/dashboard";
  }

  const usernameHint = () => {
    if (usernameStatus === "checking") return <span className="text-slate-400">Checking…</span>;
    if (usernameStatus === "available") return <span className="text-emerald-400">✓ Available</span>;
    if (usernameStatus === "taken") return <span className="text-red-400">✗ Already taken — try another</span>;
    return <span className="text-slate-500">Your profile: streakboard.app/u/{form.username || "you"}</span>;
  };

  const canSubmit = !loading && usernameStatus !== "taken" && usernameStatus !== "checking";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 animate-fadeIn">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block group transition-all duration-300 hover:scale-105">
            <span className="text-3xl font-black text-amber-500 tracking-tighter">Streakboard</span>
          </Link>
          <p className="text-slate-500 mt-2 text-sm font-medium">
            {pendingMigration ? "Save your progress by creating a free account" : "Create your free account"}
          </p>
        </div>

        {pendingMigration && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-3 text-sm text-amber-300 shadow-lg shadow-amber-500/5 animate-fadeIn">
            Your guest data will be saved to your new account automatically.
          </div>
        )}

        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl hover:border-slate-700 transition-all duration-300">
          <Field label="Full name" type="text" value={form.name} onChange={set("name")} required placeholder="Alex Johnson" />
          
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Username</label>
            <input
              type="text" required value={form.username} onChange={set("username")}
              placeholder="alexj"
              className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all text-sm ${
                usernameStatus === "taken" ? "border-red-500/50 focus:border-red-500" :
                usernameStatus === "available" ? "border-emerald-500/50 focus:border-emerald-500" :
                "border-slate-700 focus:border-amber-500"
              }`}
            />
            <p className="text-[10px] font-bold uppercase tracking-tighter ml-1">{usernameHint()}</p>
          </div>

          <Field label="Email address" type="email" value={form.email} onChange={set("email")} required placeholder="you@example.com" />
          <Field label="Password" type="password" value={form.password} onChange={set("password")} required placeholder="Min 8 characters" />
          
          <div className="grid grid-cols-2 gap-4">
            <Field label="Studying for" type="text" value={form.studyingFor} onChange={set("studyingFor")} required placeholder="e.g. Bar Exam" />
            <Field label="Exam date" type="date" value={form.examDate} onChange={set("examDate")} className="[color-scheme:dark]" />
          </div>

          {error && <p className="text-red-400 text-xs font-bold uppercase tracking-tighter bg-red-400/10 rounded-xl px-4 py-2.5 border border-red-400/20 animate-fadeIn">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/10 mt-2"
          >
            {loading ? "Creating account…" : "Create my Streakboard →"}
          </button>
        </form>

        <p className="text-center text-slate-500 mt-8 text-sm font-medium">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-500 hover:text-amber-400 transition-colors font-bold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Loading…</p></div>}>
      <SignupForm />
    </Suspense>
  );
}

function Field({
  label, className = "", ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input
        {...props}
        className={`w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all text-sm ${className}`}
      />
    </div>
  );
}
