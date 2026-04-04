"use client";

import { useState } from "react";
import Link from "next/link";

interface Item {
  id: string;
  text: string;
  order: number;
  doneCount: number;
  totalParticipants: number;
  myDone: boolean;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  username: string;
  done: number;
  total: number;
  isOwner: boolean;
}

interface Props {
  checklistId: string;
  visibility: string;
  items: Item[];
  leaderboard: LeaderboardEntry[];
  isOwner: boolean;
  isParticipant: boolean;
  viewerUserId: string | null;
  isLoggedIn: boolean;
}

export default function PublicProjectClient({
  checklistId, visibility, items: initialItems, leaderboard: initialLeaderboard,
  isOwner, isParticipant, isLoggedIn,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [leaderboard] = useState(initialLeaderboard);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(isParticipant);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState("");

  const canEdit = isOwner || (visibility === "PUBLIC_EDIT" && joined);
  const canCollab = joined && (visibility === "PUBLIC_COLLAB" || visibility === "PUBLIC_EDIT");

  async function join() {
    setJoining(true);
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", checklistId }),
    });
    setJoining(false);
    if (res.ok) setJoined(true);
  }

  async function copyTemplate() {
    setCopying(true);
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copyTemplate", checklistId }),
    });
    setCopying(false);
    if (res.ok) setCopied(true);
  }

  async function toggleItem(itemId: string) {
    setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, myDone: !it.myDone } : it));
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleProgress", itemId }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, myDone: !it.myDone } : it));
    }
  }

  async function addItem() {
    if (!newItemText.trim()) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addItem", checklistId, text: newItemText }),
    });
    if (res.ok) {
      const item = await res.json();
      setItems((prev) => [...prev, { ...item, doneCount: 0, totalParticipants: leaderboard.length, myDone: false }]);
      setNewItemText(""); setAddingItem(false);
    }
  }

  async function deleteItem(itemId: string) {
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteItem", itemId }),
    });
    if (res.ok) setItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  const myDone = items.filter((it) => it.myDone).length;

  return (
    <div className="space-y-6">
      {/* My progress (if participant) */}
      {joined && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-400">Your progress</span>
            <span className="text-sm text-amber-400">{myDone}/{items.length}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${items.length ? Math.round((myDone / items.length) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {visibility === "PUBLIC_TEMPLATE" && !isOwner && (
          isLoggedIn ? (
            <button
              onClick={copyTemplate} disabled={copying || copied}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-sm transition-colors"
            >
              {copied ? "✓ Copied to your account!" : copying ? "Copying…" : "Use as template →"}
            </button>
          ) : (
            <Link href="/signup" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition-colors">
              Sign up to use this template →
            </Link>
          )
        )}

        {(visibility === "PUBLIC_COLLAB" || visibility === "PUBLIC_EDIT") && !isOwner && !joined && (
          isLoggedIn ? (
            <button
              onClick={join} disabled={joining}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-sm transition-colors"
            >
              {joining ? "Joining…" : "Join this project →"}
            </button>
          ) : (
            <Link href="/signup" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition-colors">
              Sign up to join →
            </Link>
          )
        )}
      </div>

      {/* Items */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-200 mb-4">Items</h2>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 group">
              {canCollab ? (
                <input
                  type="checkbox" checked={item.myDone} onChange={() => toggleItem(item.id)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                />
              ) : (
                <div className={`w-4 h-4 rounded border-2 shrink-0 ${item.myDone ? "border-amber-500 bg-amber-500/20" : "border-slate-600"}`} />
              )}
              <span className={`flex-1 text-sm ${item.myDone ? "line-through text-slate-500" : "text-slate-300"}`}>
                {item.text}
              </span>
              {leaderboard.length > 1 && (
                <span className="text-xs text-slate-500 shrink-0">{item.doneCount}/{item.totalParticipants}</span>
              )}
              {canEdit && (
                <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all">✕</button>
              )}
            </div>
          ))}

          {canEdit && (
            addingItem ? (
              <div className="flex gap-2 mt-3">
                <input
                  autoFocus value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } if (e.key === "Escape") setAddingItem(false); }}
                  placeholder="New item…"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
                <button onClick={addItem} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">Add</button>
                <button onClick={() => setAddingItem(false)} className="text-slate-500 text-xs">✕</button>
              </div>
            ) : (
              <button onClick={() => setAddingItem(true)} className="text-xs text-slate-500 hover:text-amber-400 mt-2 transition-colors">
                + add item
              </button>
            )
          )}
        </div>
      </section>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (visibility === "PUBLIC_COLLAB" || visibility === "PUBLIC_EDIT") && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-200 mb-4">Participants</h2>
          <div className="space-y-2">
            {leaderboard.map((p, i) => {
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs w-5 text-right">{i + 1}</span>
                  <Link href={`/u/${p.username}`} className="text-sm text-slate-300 hover:text-amber-400 transition-colors w-28 truncate shrink-0">
                    {p.name}{p.isOwner && <span className="ml-1 text-xs text-slate-500">(owner)</span>}
                  </Link>
                  <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 w-16 text-right">{p.done}/{p.total} · {pct}%</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Viral footer */}
      <div className="text-center pt-2 border-t border-slate-800">
        <p className="text-slate-500 text-sm">
          Built with <Link href="/" className="text-amber-400 hover:text-amber-300">Streakboard</Link>
        </p>
        <Link href="/signup" className="inline-block mt-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
          Create your own Streakboard →
        </Link>
      </div>
    </div>
  );
}
