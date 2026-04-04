"use client";

import { useState } from "react";
import Link from "next/link";

interface UserRow {
  id: string;
  username: string;
  name: string;
  email: string;
  studyingFor: string;
  isAdmin: boolean;
  isPublic: boolean;
  createdAt: string;
  projectCount: number;
  checkInCount: number;
  lastCheckIn: string | null;
}

interface Props {
  users: UserRow[];
  anonymousGraphs: boolean;
  currentAdminId: string;
}

export default function AdminClient({ users: initialUsers, anonymousGraphs: initialAnonymous, currentAdminId }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [anonymousGraphs, setAnonymousGraphs] = useState(initialAnonymous);
  const [savingSettings, setSavingSettings] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function removeUser(userId: string, username: string) {
    if (!confirm(`Remove user @${username}? This will delete all their projects, check-ins, and progress. This cannot be undone.`)) return;
    setRemovingId(userId);
    const res = await fetch(`/api/admin?userId=${userId}`, { method: "DELETE" });
    setRemovingId(null);
    if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== userId));
    else alert("Failed to remove user — please try again.");
  }

  async function toggleAnonymous() {
    const next = !anonymousGraphs;
    setSavingSettings(true);
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousGraphs: next }),
    });
    setSavingSettings(false);
    if (res.ok) setAnonymousGraphs(next);
  }

  return (
    <div className="space-y-6">
      {/* Site Settings */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-200 mb-4">Site Settings</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Anonymous graphs</p>
            <p className="text-xs text-slate-400 mt-0.5">
              When enabled, usernames are hidden in public progress charts. Progress bars show without names.
            </p>
          </div>
          <button
            onClick={toggleAnonymous}
            disabled={savingSettings}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              anonymousGraphs ? "bg-amber-500" : "bg-slate-600"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                anonymousGraphs ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* User Management */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-200">Users ({users.length})</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 w-48"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Studying for</th>
                <th className="pb-2 font-medium text-center">Projects</th>
                <th className="pb-2 font-medium text-center">Check-ins</th>
                <th className="pb-2 font-medium">Last active</th>
                <th className="pb-2 font-medium">Joined</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((u) => (
                <tr key={u.id} className="group">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Link href={`/u/${u.username}`} target="_blank" className="font-medium text-slate-200 hover:text-amber-400 transition-colors">
                            @{u.username}
                          </Link>
                          {u.isAdmin && <span className="text-xs px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded">admin</span>}
                          {!u.isPublic && <span className="text-xs text-slate-600">private</span>}
                        </div>
                        <p className="text-xs text-slate-500">{u.name} · {u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-400 text-xs max-w-32 truncate">{u.studyingFor}</td>
                  <td className="py-3 pr-4 text-center text-slate-300">{u.projectCount}</td>
                  <td className="py-3 pr-4 text-center text-slate-300">{u.checkInCount}</td>
                  <td className="py-3 pr-4 text-slate-400 text-xs">{u.lastCheckIn ?? "—"}</td>
                  <td className="py-3 pr-4 text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="py-3">
                    {u.id !== currentAdminId && (
                      <button
                        onClick={() => removeUser(u.id, u.username)}
                        disabled={removingId === u.id}
                        className="opacity-0 group-hover:opacity-100 text-xs text-slate-600 hover:text-red-400 transition-all disabled:opacity-50"
                      >
                        {removingId === u.id ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-8">No users match your search.</p>
          )}
        </div>
      </section>
    </div>
  );
}
