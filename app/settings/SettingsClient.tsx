"use client";

import { useState } from "react";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  studyingFor: string;
  examDate: string | null;
  isPublic: boolean;
}

export default function SettingsClient({ user }: { user: User }) {
  // Profile state
  const [profile, setProfile] = useState({
    name: user.name,
    username: user.username,
    email: user.email,
    studyingFor: user.studyingFor,
    examDate: user.examDate || "",
    isPublic: user.isPublic,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  // Password state
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function checkUsername(username: string) {
    if (username === user.username) {
      setUsernameError("");
      return;
    }
    const res = await fetch(`/api/check-username?username=${username}`);
    const data = await res.json();
    if (!data.available) {
      setUsernameError("Username already taken");
    } else {
      setUsernameError("");
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateProfile", ...profile }),
    });

    const data = await res.json();
    setProfileSaving(false);

    if (!res.ok) {
      setProfileError(data.error || "Failed to update profile");
    } else {
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (passwords.new.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSuccess(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "changePassword",
        currentPassword: passwords.current,
        newPassword: passwords.new,
      }),
    });

    const data = await res.json();
    setPasswordSaving(false);

    if (!res.ok) {
      setPasswordError(data.error || "Failed to change password");
    } else {
      setPasswordSuccess(true);
      setPasswords({ current: "", new: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1">
          ← Dashboard
        </Link>
        <h1 className="text-sm font-semibold text-slate-200">User Settings</h1>
        <div className="w-20" /> {/* Spacer */}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-12">
        {/* Profile Section */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Profile</h2>
            <p className="text-xs text-slate-500 mt-1">Manage your public information and preferences.</p>
          </div>

          <form onSubmit={handleProfileSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Display Name</label>
                <input
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Username</label>
                <input
                  required
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase() })}
                  onBlur={(e) => checkUsername(e.target.value)}
                  className={`w-full bg-slate-800 border ${usernameError ? "border-red-500" : "border-slate-700"} rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors`}
                />
                {usernameError && <p className="text-[10px] text-red-400">{usernameError}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Email Address</label>
              <input
                required
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Studying For</label>
                <input
                  value={profile.studyingFor}
                  onChange={(e) => setProfile({ ...profile, studyingFor: e.target.value })}
                  placeholder="e.g. USMLE Step 1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Exam Date (Optional)</label>
                <input
                  type="date"
                  value={profile.examDate}
                  onChange={(e) => setProfile({ ...profile, examDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={profile.isPublic}
                onChange={(e) => setProfile({ ...profile, isPublic: e.target.checked })}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
              <label htmlFor="isPublic" className="text-sm text-slate-300 cursor-pointer">
                Public profile visible at <span className="text-amber-500/80">/u/{profile.username}</span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="h-4">
                {profileError && <p className="text-xs text-red-400">{profileError}</p>}
                {profileSuccess && <p className="text-xs text-emerald-400">✓ Profile updated successfully</p>}
              </div>
              <button
                type="submit"
                disabled={profileSaving || !!usernameError}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold rounded-lg text-sm transition-colors"
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </section>

        {/* Security Section */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Security</h2>
            <p className="text-xs text-slate-500 mt-1">Change your password to keep your account secure.</p>
          </div>

          <form onSubmit={handlePasswordSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Current Password</label>
              <input
                required
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">New Password</label>
                <input
                  required
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Confirm New Password</label>
                <input
                  required
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="h-4">
                {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                {passwordSuccess && <p className="text-xs text-emerald-400">✓ Password changed successfully</p>}
              </div>
              <button
                type="submit"
                disabled={passwordSaving}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-lg text-sm border border-slate-700 transition-colors"
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
