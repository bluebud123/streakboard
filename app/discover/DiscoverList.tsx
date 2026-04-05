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
    <div className="space-y-12">
      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-amber-500 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, owner, or description..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-12 py-4 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all shadow-sm hover:border-slate-700"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest p-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Community Templates */}
      <section className="animate-fadeIn">
        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 px-1 flex items-center gap-2">
          📋 Community Templates
          <span className="text-slate-700 font-mono">/ {templates.length}</span>
        </h2>

        {templates.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/60 border-dashed rounded-3xl p-12 text-center">
            <p className="text-slate-600 text-sm font-medium">{search ? "No templates match your search." : "No public templates yet."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {templates.map((c) => (
              <DiscoverClient key={c.id} card={c} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        )}
      </section>

      {/* Collab Projects */}
      <section className="animate-fadeIn" style={{ animationDelay: '100ms' }}>
        <div className="mb-6 px-1">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
            👥 Collab
            <span className="text-slate-700 font-mono">/ {open.length}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1.5 max-w-md">
            Join an open project and track your progress alongside the community. Your completions sync in real-time for everyone to see.
          </p>
        </div>

        {open.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/60 border-dashed rounded-3xl p-12 text-center">
            <p className="text-slate-600 text-sm font-medium">{search ? "No projects match your search." : "No collab projects yet."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {open.map((c) => (
              <DiscoverClient key={c.id} card={c} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
