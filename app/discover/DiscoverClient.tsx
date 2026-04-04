"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CardData {
  id: string;
  name: string;
  description: string | null;
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
  PUBLIC_EDIT: "🤝 Collab + Edit",
};

export default function DiscoverClient({ card, isLoggedIn }: { card: CardData; isLoggedIn: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [joined, setJoined] = useState(card.isParticipating);
  const [showConfirm, setShowConfirm] = useState(false);

  const isTemplate = card.visibility === "PUBLIC_TEMPLATE";
  const actionLabel = isTemplate ? "Copy to my account" : "Join project";

  async function confirmAction() {
    setShowConfirm(false);
    setLoading(true);
    if (isTemplate) {
      const res = await fetch("/api/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copyTemplate", checklistId: card.id }),
      });
      setLoading(false);
      if (res.ok) setDone(true);
    } else {
      const res = await fetch("/api/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", checklistId: card.id }),
      });
      setLoading(false);
      if (res.ok) setJoined(true);
    }
  }

  function handleActionClick() {
    if (!isLoggedIn) { router.push("/signup"); return; }
    setShowConfirm(true);
  }

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
          {card.description && (
            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 italic">
              {card.description}
            </p>
          )}
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
      <div className="mt-auto space-y-2">
        {card.isOwner ? (
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-amber-400 transition-colors">
            Your project ↗
          </Link>
        ) : (done || (!isTemplate && joined)) ? (
          <div className="space-y-1.5">
            <div className="w-full py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg text-center">
              ✓ {isTemplate ? "Copied to dashboard" : "Joined"}
            </div>
            <Link href="/dashboard" className="block text-center text-xs text-amber-400 hover:text-amber-300 transition-colors">
              Open in dashboard →
            </Link>
          </div>
        ) : showConfirm ? (
          /* Confirmation UI */
          <div className="bg-slate-800 rounded-xl p-3 space-y-2">
            <p className="text-xs text-slate-300 font-medium">
              {isTemplate ? "Copy" : "Join"} <span className="text-amber-400">&ldquo;{card.name}&rdquo;</span> to your dashboard?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
              >
                Yes, {isTemplate ? "copy it" : "join"} →
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleActionClick}
            disabled={loading}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
          >
            {loading ? (isTemplate ? "Copying…" : "Joining…") : `${actionLabel} →`}
          </button>
        )}
      </div>
    </div>
  );
}
