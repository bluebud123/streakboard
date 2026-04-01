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
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-amber-400">Streakboard</Link>
          <p className="text-slate-400 mt-2 text-sm">
            {pendingMigration ? "Save your progress by creating a free account" : "Create your free account"}
          </p>
        </div>

        {pendingMigration && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-300">
            Your guest data will be saved to your new account automatically.
          </div>
        )}

        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
          <Field label="Full name" type="text" value={form.name} onChange={set("name")} required placeholder="Alex Johnson" />
          <div>
            <label className="block text-sm text-slate-300 mb-1">Username</label>
            <input
              type="text" required value={form.username} onChange={set("username")}
              placeholder="alexj"
              className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none transition-colors text-sm ${
                usernameStatus === "taken" ? "border-red-500 focus:border-red-500" :
                usernameStatus === "available" ? "border-emerald-500 focus:border-emerald-500" :
                "border-slate-700 focus:border-amber-500"
              }`}
            />
            <p className="text-xs mt-1">{usernameHint()}</p>
          </div>
          <Field label="Email" type="email" value={form.email} onChange={set("email")} required placeholder="you@example.com" />
          <Field label="Password" type="password" value={form.password} onChange={set("password")} required placeholder="Min 8 characters" />
          <Field label="Studying for" type="text" value={form.studyingFor} onChange={set("studyingFor")} required placeholder="e.g. USMLE Step 1, AWS SAA, Bar Exam" />
          <Field label="Exam date (optional)" type="date" value={form.examDate} onChange={set("examDate")} />

          {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-colors"
          >
            {loading ? "Creating account…" : "Create my Streakboard →"}
          </button>
        </form>

        <p className="text-center text-slate-500 mt-4 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-400 hover:text-amber-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Loading…</p></div>}>
      <SignupForm />
    </Suspense>
  );
}

function Field({
  label, ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
      />
    </div>
  );
}
