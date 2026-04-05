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

  const community = filtered; // All cards — templates + collab + collab+edit merged

  const visLabel = (v: string) => {
    if (v === "PUBLIC_TEMPLATE") return { badge: "Template", color: "text-sky-400 bg-sky-500/10" };
    if (v === "PUBLIC_EDIT") return { badge: "Collab + Edit", color: "text-amber-400 bg-amber-500/10" };
    return { badge: "Collab", color: "text-emerald-400 bg-emerald-500/10" };
  };

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

      {/* Community Projects — all public types in one section */}
      <section className="animate-fadeIn">
        <div className="mb-6 px-1">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
            🌐 Community Projects
            <span className="text-slate-700 font-mono">/ {community.length}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1.5 max-w-md">
            Browse templates to copy, join collab projects to track your own progress, or contribute edits in open projects.
          </p>
        </div>

        {community.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/60 border-dashed rounded-3xl p-12 text-center">
            <p className="text-slate-600 text-sm font-medium">{search ? "No projects match your search." : "No public projects yet."}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {community.map((c) => {
              const vis = visLabel(c.visibility);
              return (
                <div key={c.id} className="relative">
                  <span className={`absolute top-3 right-3 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full ${vis.color}`}>
                    {vis.badge}
                  </span>
                  <DiscoverClient card={c} isLoggedIn={isLoggedIn} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
