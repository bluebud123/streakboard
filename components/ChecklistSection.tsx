"use client";

import { useState } from "react";
import Link from "next/link";
import ChecklistImport from "./ChecklistImport";

type ProgressEntry = { done: boolean };
type Item = { id: string; text: string; order: number; progress: ProgressEntry[] };
type Participant = { user: { id: string; name: string; username: string } };

export interface ChecklistData {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC_TEMPLATE" | "PUBLIC_COLLAB" | "PUBLIC_EDIT";
  slug?: string | null;
  items: Item[];
  participants: Participant[];
  // for participated checklists
  user?: { name: string; username: string };
}

const VIS_ORDER: ChecklistData["visibility"][] = ["PRIVATE", "PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"];
const VIS_LABEL: Record<string, string> = {
  PRIVATE: "🔒 Private",
  PUBLIC_TEMPLATE: "🔗 Template",
  PUBLIC_COLLAB: "👥 Collab",
  PUBLIC_EDIT: "✏️ Open Edit",
};

interface Props {
  owned: ChecklistData[];
  participating: ChecklistData[];
  userId: string;
}

export default function ChecklistSection({ owned: initialOwned, participating: initialParticipating, userId }: Props) {
  const [owned, setOwned] = useState(initialOwned);
  const [participating] = useState(initialParticipating);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  function patchOwned(id: string, updater: (cl: ChecklistData) => ChecklistData) {
    setOwned((prev) => prev.map((cl) => (cl.id === id ? updater(cl) : cl)));
  }

  async function createChecklist(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    if (res.ok) {
      const cl = await res.json();
      setOwned((prev) => [{ ...cl, participants: [] }, ...prev]);
      setNewName(""); setNewDesc(""); setShowNewForm(false);
    }
  }

  function handleImported(cl: unknown) {
    const checklist = cl as ChecklistData;
    setOwned((prev) => [{ ...checklist, participants: [] }, ...prev]);
    setShowImport(false);
  }

  async function toggleItem(checklistId: string, itemId: string) {
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleProgress", itemId }),
    });
    if (!res.ok) return;
    const updated: ProgressEntry = await res.json();
    patchOwned(checklistId, (cl) => ({
      ...cl,
      items: cl.items.map((it) =>
        it.id === itemId ? { ...it, progress: [updated] } : it
      ),
    }));
  }

  async function addItem(checklistId: string) {
    if (!newItemText.trim()) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addItem", checklistId, text: newItemText }),
    });
    if (res.ok) {
      const item: Item = await res.json();
      patchOwned(checklistId, (cl) => ({ ...cl, items: [...cl.items, { ...item, progress: [] }] }));
      setNewItemText(""); setAddingItemTo(null);
    }
  }

  async function deleteItem(checklistId: string, itemId: string) {
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteItem", itemId }),
    });
    if (res.ok) {
      patchOwned(checklistId, (cl) => ({ ...cl, items: cl.items.filter((it) => it.id !== itemId) }));
    }
  }

  async function deleteChecklist(checklistId: string) {
    if (!confirm("Delete this checklist?")) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", checklistId }),
    });
    if (res.ok) setOwned((prev) => prev.filter((cl) => cl.id !== checklistId));
  }

  async function cycleVisibility(cl: ChecklistData) {
    const next = VIS_ORDER[(VIS_ORDER.indexOf(cl.visibility) + 1) % VIS_ORDER.length];
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "changeVisibility", checklistId: cl.id, visibility: next }),
    });
    if (res.ok) {
      const updated = await res.json();
      patchOwned(cl.id, () => ({ ...cl, visibility: updated.visibility, slug: updated.slug }));
    }
  }

  const allChecklists = [
    ...owned.map((cl) => ({ ...cl, isOwner: true })),
    ...participating.map((cl) => ({ ...cl, isOwner: false })),
  ];

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-200">Checklists</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport((v) => !v); setShowNewForm(false); }} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            ↑ Import
          </button>
          <button onClick={() => { setShowNewForm((v) => !v); setShowImport(false); }} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
            {showNewForm ? "Cancel" : "+ New"}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="mb-4">
          <ChecklistImport onImported={handleImported} />
        </div>
      )}

      {showNewForm && (
        <form onSubmit={createChecklist} className="mb-4 bg-slate-800 rounded-xl p-4 space-y-2">
          <input
            autoFocus required value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Checklist name"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
          />
          <input
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
          />
          <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
            Create checklist
          </button>
        </form>
      )}

      {allChecklists.length === 0 && !showNewForm && !showImport && (
        <p className="text-slate-500 text-sm text-center py-4">No checklists yet. Create one or import a .md file.</p>
      )}

      <div className="space-y-3">
        {allChecklists.map((cl) => {
          const done = cl.items.filter((it) => it.progress[0]?.done).length;
          const total = cl.items.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isOpen = expanded === cl.id;

          return (
            <div key={cl.id} className="bg-slate-800 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 flex items-center gap-2">
                <button onClick={() => setExpanded(isOpen ? null : cl.id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                  <span className="text-sm">{isOpen ? "▾" : "▸"}</span>
                  <span className="text-sm font-medium text-slate-200 truncate">{cl.name}</span>
                  {!cl.isOwner && cl.user && (
                    <span className="text-xs text-slate-500 shrink-0">by @{cl.user.username}</span>
                  )}
                </button>
                <span className="text-xs text-slate-400 shrink-0">{done}/{total}</span>

                {cl.isOwner && (
                  <button
                    onClick={() => cycleVisibility(cl)}
                    title="Click to change visibility"
                    className="text-xs px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                  >
                    {VIS_LABEL[cl.visibility]}
                  </button>
                )}

                {cl.slug && cl.visibility !== "PRIVATE" && (
                  <Link href={`/checklist/${cl.slug}`} target="_blank" className="text-xs text-amber-400 hover:text-amber-300 shrink-0">↗</Link>
                )}

                {cl.isOwner && (
                  <button onClick={() => deleteChecklist(cl.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                )}
              </div>

              {/* Progress bar */}
              <div className="px-4 pb-2">
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Expanded items */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-1 border-t border-slate-700 pt-3">
                  {cl.items.length === 0 && (
                    <p className="text-slate-500 text-xs py-2">No items yet. Add one below.</p>
                  )}
                  {cl.items.map((item) => {
                    const checked = item.progress[0]?.done ?? false;
                    return (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(cl.id, item.id)}
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                        />
                        <span className={`flex-1 text-sm ${checked ? "line-through text-slate-500" : "text-slate-300"}`}>
                          {item.text}
                        </span>
                        {cl.isOwner && (
                          <button
                            onClick={() => deleteItem(cl.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {cl.isOwner && (
                    addingItemTo === cl.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          autoFocus value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(cl.id); } if (e.key === "Escape") setAddingItemTo(null); }}
                          placeholder="Item text…"
                          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                        />
                        <button onClick={() => addItem(cl.id)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors">Add</button>
                        <button onClick={() => setAddingItemTo(null)} className="text-slate-500 text-xs">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingItemTo(cl.id); setNewItemText(""); }} className="text-xs text-slate-500 hover:text-amber-400 mt-1 transition-colors">
                        + add item
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
