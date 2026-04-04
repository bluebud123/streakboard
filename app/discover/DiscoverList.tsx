"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import DiscoverClient from "./DiscoverClient";

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

interface Props {
  cards: CardData[];
  isLoggedIn: boolean;
}

export default function DiscoverList({ cards, isLoggedIn }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return cards;
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.ownerUsername.toLowerCase().includes(s) ||
        (c.description?.toLowerCase().includes(s) ?? false)
    );
  }, [cards, search]);

  const templates = filtered.filter((c) => c.visibility === "PUBLIC_TEMPLATE");
  const open = filtered.filter((c) => c.visibility === "PUBLIC_COLLAB" || c.visibility === "PUBLIC_EDIT");

  return (
    <div className="space-y-10">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects by name, owner, or description..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Community Templates */}
      <section>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">
          📋 Community Templates
          <span className="ml-2 text-sm font-normal text-slate-500">({templates.length})</span>
        </h2>

        {templates.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">{search ? "No templates match your search." : "No public templates yet."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {templates.map((c) => (
              <DiscoverClient key={c.id} card={c} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        )}
      </section>

      {/* Open Projects */}
      <section>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">
          👥 Open Projects
          <span className="ml-2 text-sm font-normal text-slate-500">({open.length})</span>
        </h2>

        {open.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">{search ? "No projects match your search." : "No open projects yet."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {open.map((c) => (
              <DiscoverClient key={c.id} card={c} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
