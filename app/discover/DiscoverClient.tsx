"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CardData {
  id: string;
  name: string;
  slug: string | null;
  visibility: string;
  ownerName: string;
  ownerUsername: string;
  itemCount: number;
  participantCount: number;
  isParticipating: boolean;
  isOwner: boolean;
}

const VIS_LABEL: Record<string, string> = {
  PUBLIC_TEMPLATE: "🔗 Template",
  PUBLIC_COLLAB: "👥 Collab",
  PUBLIC_EDIT: "✏️ Open Edit",
};

export default function DiscoverClient({ card, isLoggedIn }: { card: CardData; isLoggedIn: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [joined, setJoined] = useState(card.isParticipating);

  async function handleCopy() {
    if (!isLoggedIn) { router.push("/signup"); return; }
    setLoading(true);
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copyTemplate", checklistId: card.id }),
    });
    setLoading(false);
    if (res.ok) { setDone(true); router.push("/dashboard"); }
  }

  async function handleJoin() {
    if (!isLoggedIn) { router.push("/signup"); return; }
    setLoading(true);
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", checklistId: card.id }),
    });
    setLoading(false);
    if (res.ok) { setJoined(true); router.push("/dashboard"); }
  }

  const isTemplate = card.visibility === "PUBLIC_TEMPLATE";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {card.slug ? (
            <Link href={`/project/${card.slug}`} className="text-sm font-semibold text-slate-100 hover:text-amber-400 transition-colors line-clamp-2">
              {card.name}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-slate-100 line-clamp-2">{card.name}</span>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            by{" "}
            <Link href={`/u/${card.ownerUsername}`} className="hover:text-slate-300 transition-colors">
              @{card.ownerUsername}
            </Link>
          </p>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 shrink-0 whitespace-nowrap">
          {VIS_LABEL[card.visibility]}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>📋 {card.itemCount} items</span>
        {!isTemplate && <span>👥 {card.participantCount} participants</span>}
      </div>

      {/* Action */}
      <div className="mt-auto">
        {card.isOwner ? (
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-amber-400 transition-colors">
            Your project ↗
          </Link>
        ) : isTemplate ? (
          <button
            onClick={handleCopy}
            disabled={loading || done}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
          >
            {done ? "✓ Copied to dashboard" : loading ? "Copying…" : "Copy to my account →"}
          </button>
        ) : joined ? (
          <Link href="/dashboard" className="block w-full text-center py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg transition-colors">
            ✓ Already joined — go to dashboard
          </Link>
        ) : (
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
          >
            {loading ? "Joining…" : "Join project →"}
          </button>
        )}
      </div>
    </div>
  );
}
