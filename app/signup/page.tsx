"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "", username: "", email: "", password: "",
    studyingFor: "", examDate: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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

    await signIn("credentials", {
      email: form.email,
      password: form.password,
      callbackUrl: "/dashboard",
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-amber-400">Streakboard</Link>
          <p className="text-slate-400 mt-2 text-sm">Create your free account</p>
        </div>

        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
          <Field label="Full name" type="text" value={form.name} onChange={set("name")} required placeholder="Alex Johnson" />
          <Field label="Username" type="text" value={form.username} onChange={set("username")} required placeholder="alexj" hint="Your profile: streakboard.app/u/alexj" />
          <Field label="Email" type="email" value={form.email} onChange={set("email")} required placeholder="you@example.com" />
          <Field label="Password" type="password" value={form.password} onChange={set("password")} required placeholder="Min 8 characters" />
          <Field label="Studying for" type="text" value={form.studyingFor} onChange={set("studyingFor")} required placeholder="e.g. USMLE Step 1, AWS SAA, Bar Exam" />
          <Field label="Exam date (optional)" type="date" value={form.examDate} onChange={set("examDate")} />

          {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
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

function Field({
  label, hint, ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
      />
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  );
}
