"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ChecklistImport from "./ChecklistImport";
import type { TemplateMetadata } from "@/app/api/templates/route";

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
  user?: { name: string; username: string };
}

const VIS_ORDER: ChecklistData["visibility"][] = ["PRIVATE", "PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"];
const VIS_LABEL: Record<string, string> = {
  PRIVATE: "🔒 Private",
  PUBLIC_TEMPLATE: "🔗 Template",
  PUBLIC_COLLAB: "👥 Collab",
  PUBLIC_EDIT: "✏️ Open Edit",
};
const CATEGORY_COLOR: Record<string, string> = {
  Medicine: "bg-emerald-500/20 text-emerald-400",
  Technology: "bg-blue-500/20 text-blue-400",
  Law: "bg-purple-500/20 text-purple-400",
  Finance: "bg-amber-500/20 text-amber-400",
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
  // "none" | "blank" | "template" | "upload"
  const [newMode, setNewMode] = useState<"none" | "blank" | "template" | "upload">("none");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [usingTemplate, setUsingTemplate] = useState<string | null>(null);

  function patchOwned(id: string, updater: (cl: ChecklistData) => ChecklistData) {
    setOwned((prev) => prev.map((cl) => (cl.id === id ? updater(cl) : cl)));
  }

  function openNew(mode: "blank" | "template" | "upload") {
    setNewMode((prev) => prev === mode ? "none" : mode);
  }

  // Load templates when template tab opens
  useEffect(() => {
    if (newMode === "template" && templates.length === 0) {
      fetch("/api/templates").then((r) => r.json()).then(setTemplates).catch(() => {});
    }
  }, [newMode, templates.length]);

  async function createBlank(e: React.FormEvent) {
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
      setNewName(""); setNewDesc(""); setNewMode("none");
    }
  }

  async function useTemplate(tmpl: TemplateMetadata) {
    setUsingTemplate(tmpl.id);
    try {
      const mdRes = await fetch(`/templates/${tmpl.filename}`);
      const text = await mdRes.text();
      const file = new File([text], tmpl.filename, { type: "text/markdown" });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/checklists/import", { method: "POST", body: form });
      if (res.ok) {
        const cl = await res.json();
        setOwned((prev) => [{ ...cl, participants: [] }, ...prev]);
        setNewMode("none");
      }
    } finally {
      setUsingTemplate(null);
    }
  }

  function handleImported(cl: unknown) {
    const checklist = cl as ChecklistData;
    setOwned((prev) => [{ ...checklist, participants: [] }, ...prev]);
    setNewMode("none");
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
      items: cl.items.map((it) => it.id === itemId ? { ...it, progress: [updated] } : it),
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

  async function deleteProject(checklistId: string) {
    if (!confirm("Delete this project?")) return;
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

  const allProjects = [
    ...owned.map((cl) => ({ ...cl, isOwner: true })),
    ...participating.map((cl) => ({ ...cl, isOwner: false })),
  ];
  const isEmpty = allProjects.length === 0;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-200">Projects</h2>
        <div className="flex gap-2">
          <button onClick={() => openNew("upload")} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            ↑ Upload
          </button>
          <button onClick={() => openNew("template")} className="text-sm text-slate-400 hover:text-amber-300 transition-colors">
            {newMode === "template" ? "Cancel" : "Templates"}
          </button>
          <button onClick={() => openNew("blank")} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
            {newMode === "blank" ? "Cancel" : "+ New"}
          </button>
        </div>
      </div>

      {/* Blank project form */}
      {newMode === "blank" && (
        <form onSubmit={createBlank} className="mb-4 bg-slate-800 rounded-xl p-4 space-y-2">
          <input
            autoFocus required value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
          />
          <input
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
          />
          <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
            Create project
          </button>
        </form>
      )}

      {/* Upload .md */}
      {newMode === "upload" && (
        <div className="mb-4">
          <ChecklistImport onImported={handleImported} />
        </div>
      )}

      {/* Template gallery */}
      {newMode === "template" && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-3">
            Pick a starter template — your own copy will be created instantly. Download the .md to customise before importing.
          </p>
          <div className="space-y-3">
            {templates.length === 0 && (
              <p className="text-slate-500 text-xs py-2">Loading templates…</p>
            )}
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-200">{tmpl.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLOR[tmpl.category] ?? "bg-slate-700 text-slate-400"}`}>
                        {tmpl.category}
                      </span>
                      {tmpl.contributor && (
                        <span className="text-xs text-slate-500">by @{tmpl.contributor}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tmpl.description}</p>
                    <p className="text-xs text-slate-500 mt-1">{tmpl.itemCount} items</p>
                  </div>
                </div>

                {/* Preview toggle */}
                <button
                  onClick={() => setPreviewId(previewId === tmpl.id ? null : tmpl.id)}
                  className="text-xs text-slate-500 hover:text-slate-300 mt-2 transition-colors"
                >
                  {previewId === tmpl.id ? "Hide preview ▲" : "Preview ▾"}
                </button>

                {previewId === tmpl.id && (
                  <TemplatePreview filename={tmpl.filename} />
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => useTemplate(tmpl)}
                    disabled={usingTemplate === tmpl.id}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
                  >
                    {usingTemplate === tmpl.id ? "Importing…" : "Use this →"}
                  </button>
                  <a
                    href={`/templates/${tmpl.filename}`}
                    download
                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                  >
                    ⬇ Download .md
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && newMode === "none" && (
        <div className="text-center py-8 space-y-3">
          <p className="text-slate-500 text-sm">No projects yet.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={() => openNew("template")} className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-lg hover:bg-amber-500/20 transition-colors">
              📋 Start from template
            </button>
            <button onClick={() => openNew("blank")} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">
              + Blank project
            </button>
            <button onClick={() => openNew("upload")} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">
              ↑ Upload .md
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {allProjects.map((cl) => {
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
                  <Link href={`/project/${cl.slug}`} target="_blank" className="text-xs text-amber-400 hover:text-amber-300 shrink-0">↗</Link>
                )}

                {cl.isOwner && (
                  <button onClick={() => deleteProject(cl.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
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

function TemplatePreview({ filename }: { filename: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/templates/${filename}`)
      .then((r) => r.text())
      .then((text) => {
        const items = text
          .split("\n")
          .filter((l) => /^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.+)/.test(l))
          .slice(0, 8)
          .map((l) => l.replace(/^(?:[-*]|\d+\.)\s+(?:\[[ xX\s]\]\s+)?/, "").trim());
        setLines(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filename]);

  if (loading) return <p className="text-xs text-slate-500 mt-2">Loading preview…</p>;

  return (
    <ul className="mt-2 space-y-1 pl-1">
      {lines.map((l, i) => (
        <li key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
          <span className="w-3 h-3 border border-slate-600 rounded shrink-0" />
          {l}
        </li>
      ))}
      <li className="text-xs text-slate-600 italic">…and more</li>
    </ul>
  );
}
