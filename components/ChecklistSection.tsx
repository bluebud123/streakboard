"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ChecklistImport from "./ChecklistImport";
import type { TemplateMetadata } from "@/app/api/templates/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type Progress = { done: boolean };

export interface TreeItem {
  id: string;
  text: string;
  order: number;
  isSection: boolean;
  depth: number;
  progress: Progress[];
  children?: TreeItem[];
}

export interface ChecklistData {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC_TEMPLATE" | "PUBLIC_COLLAB" | "PUBLIC_EDIT";
  slug?: string | null;
  items: TreeItem[];       // root items only (parentId=null)
  participants: { user: { id: string; name: string; username: string } }[];
  user?: { name: string; username: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIS_LABEL: Record<string, string> = {
  PRIVATE: "🔒 Private",
  PUBLIC_TEMPLATE: "🔗 Template",
  PUBLIC_COLLAB: "👥 Collab",
  PUBLIC_EDIT: "✏️ Open Edit",
};

const VIS_DESCRIPTIONS: Record<string, string> = {
  PRIVATE: "Only you can see and edit this project.",
  PUBLIC_TEMPLATE: "Anyone can view and copy to their own account.",
  PUBLIC_COLLAB: "Anyone can join and track their own progress.",
  PUBLIC_EDIT: "Anyone can join, add and edit items.",
};

const CATEGORY_COLOR: Record<string, string> = {
  Medicine: "bg-emerald-500/20 text-emerald-400",
  Technology: "bg-blue-500/20 text-blue-400",
  Law: "bg-purple-500/20 text-purple-400",
  Finance: "bg-amber-500/20 text-amber-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countCheckable(items: TreeItem[]): { done: number; total: number } {
  let done = 0, total = 0;
  for (const it of items) {
    if (!it.isSection) { total++; if (it.progress[0]?.done) done++; }
    if (it.children?.length) {
      const sub = countCheckable(it.children);
      done += sub.done; total += sub.total;
    }
  }
  return { done, total };
}

function flattenSiblings(items: TreeItem[]): TreeItem[] {
  return items;
}

// ─── Visibility Modal ─────────────────────────────────────────────────────────

function VisibilityModal({
  current, name, onSave, onClose,
}: {
  current: ChecklistData["visibility"];
  name: string;
  onSave: (v: ChecklistData["visibility"]) => Promise<void>;
  onClose: () => void;
}) {
  const ALL: ChecklistData["visibility"][] = ["PRIVATE", "PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"];
  const [selected, setSelected] = useState<ChecklistData["visibility"]>(current);
  const [saving, setSaving] = useState(false);

  const toPrivate = selected === "PRIVATE" && current !== "PRIVATE";
  const fromPrivate = selected !== "PRIVATE" && current === "PRIVATE";
  const changed = selected !== current;

  async function handleSave() {
    setSaving(true);
    await onSave(selected);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div>
          <h3 className="font-semibold text-slate-100 text-sm">Project settings</h3>
          <p className="text-slate-500 text-xs mt-0.5 truncate">{name}</p>
        </div>

        <div className="space-y-2">
          {ALL.map((v) => (
            <label key={v} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected === v ? "border-amber-500 bg-amber-500/10" : "border-slate-700 hover:border-slate-600"}`}>
              <input type="radio" name="visibility" value={v} checked={selected === v} onChange={() => setSelected(v)} className="mt-0.5 accent-amber-500" />
              <div>
                <p className="text-sm font-medium text-slate-200">{VIS_LABEL[v]}</p>
                <p className="text-xs text-slate-400 mt-0.5">{VIS_DESCRIPTIONS[v]}</p>
              </div>
            </label>
          ))}
        </div>

        {(toPrivate || fromPrivate) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
            ⚠️ {toPrivate
              ? "Switching to Private — current participants will lose access to this project."
              : "Switching to Public — this project will be visible to everyone."}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!changed || saving}
            className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Preview ─────────────────────────────────────────────────────────

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
          <span className="w-3 h-3 border border-slate-600 rounded shrink-0" />{l}
        </li>
      ))}
      <li className="text-xs text-slate-600 italic">…and more</li>
    </ul>
  );
}

// ─── Tree Item Renderer ───────────────────────────────────────────────────────

function ItemNode({
  item, checklistId, isOwner,
  onToggle, onDelete, onAddChild,
  dragState, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  item: TreeItem;
  checklistId: string;
  isOwner: boolean;
  onToggle: (itemId: string) => void;
  onDelete: (checklistId: string, itemId: string) => void;
  onAddChild: (parentId: string, depth: number) => void;
  dragState: { dragId: string | null; overId: string | null };
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string, parentId: string | null) => void;
  onDragEnd: () => void;
}) {
  const checked = item.progress[0]?.done ?? false;
  const isDragging = dragState.dragId === item.id;
  const isOver = dragState.overId === item.id;

  const indent = item.depth === 0 ? "" : item.depth === 1 ? "ml-0" : "ml-4";

  if (item.isSection) {
    return (
      <div className={`${indent} ${isOver ? "border-t-2 border-amber-500" : ""}`}>
        <div
          className={`flex items-center gap-2 py-2 px-1 group cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
          draggable={isOwner}
          onDragStart={() => onDragStart(item.id)}
          onDragOver={(e) => onDragOver(e, item.id)}
          onDrop={() => onDrop(item.id, null)}
          onDragEnd={onDragEnd}
        >
          {isOwner && <span className="text-slate-600 text-xs opacity-0 group-hover:opacity-100 cursor-grab">⠿</span>}
          <span className="flex-1 text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-slate-700 pb-1">
            {item.text}
          </span>
          {isOwner && (
            <button
              onClick={() => onDelete(checklistId, item.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all shrink-0"
            >✕</button>
          )}
        </div>
        {item.children?.map((child) => (
          <ItemNode key={child.id} item={child} checklistId={checklistId} isOwner={isOwner}
            onToggle={onToggle} onDelete={onDelete} onAddChild={onAddChild}
            dragState={dragState} onDragStart={onDragStart} onDragOver={onDragOver}
            onDrop={(tid) => onDrop(tid, item.id)} onDragEnd={onDragEnd} />
        ))}
        {isOwner && (
          <button
            onClick={() => onAddChild(item.id, 1)}
            className="ml-4 text-xs text-slate-600 hover:text-amber-400 transition-colors py-1"
          >+ add task</button>
        )}
      </div>
    );
  }

  return (
    <div className={`${indent} ${isOver ? "border-t-2 border-amber-500" : ""}`}>
      <div
        className={`flex items-center gap-2 group py-1 ${isDragging ? "opacity-40" : ""}`}
        draggable={isOwner}
        onDragStart={() => onDragStart(item.id)}
        onDragOver={(e) => onDragOver(e, item.id)}
        onDrop={() => onDrop(item.id, null)}
        onDragEnd={onDragEnd}
      >
        {isOwner && <span className="text-slate-600 text-xs opacity-0 group-hover:opacity-100 cursor-grab shrink-0">⠿</span>}
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item.id)}
          className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
        />
        <span className={`flex-1 text-sm leading-snug ${checked ? "line-through text-slate-500" : item.depth === 2 ? "text-slate-400" : "text-slate-300"}`}>
          {item.text}
        </span>
        {isOwner && (
          <button
            onClick={() => onDelete(checklistId, item.id)}
            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all shrink-0"
          >✕</button>
        )}
      </div>
      {/* Subtasks */}
      {item.depth < 2 && item.children?.map((child) => (
        <ItemNode key={child.id} item={child} checklistId={checklistId} isOwner={isOwner}
          onToggle={onToggle} onDelete={onDelete} onAddChild={onAddChild}
          dragState={dragState} onDragStart={onDragStart} onDragOver={onDragOver}
          onDrop={(tid) => onDrop(tid, item.id)} onDragEnd={onDragEnd} />
      ))}
      {isOwner && item.depth < 2 && (
        <button
          onClick={() => onAddChild(item.id, item.depth + 1)}
          className="ml-8 text-xs text-slate-600 hover:text-amber-400 transition-colors"
        >+ subtask</button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  owned: ChecklistData[];
  participating: ChecklistData[];
  userId: string;
}

export default function ChecklistSection({ owned: initialOwned, participating: initialParticipating, userId }: Props) {
  const [owned, setOwned] = useState(initialOwned);
  const [participating] = useState(initialParticipating);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newMode, setNewMode] = useState<"none" | "blank" | "template" | "upload">("none");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [usingTemplate, setUsingTemplate] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState("");
  const [addingTo, setAddingTo] = useState<{ checklistId: string; parentId: string | null; depth: number } | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [visModal, setVisModal] = useState<ChecklistData | null>(null);
  const [dragState, setDragState] = useState<{ dragId: string | null; overId: string | null }>({ dragId: null, overId: null });
  const dragChecklistId = useRef<string | null>(null);

  // Load templates on demand
  useEffect(() => {
    if (newMode === "template" && templates.length === 0) {
      fetch("/api/templates").then((r) => r.json()).then(setTemplates).catch(() => {});
    }
  }, [newMode, templates.length]);

  function patchOwned(id: string, updater: (cl: ChecklistData) => ChecklistData) {
    setOwned((prev) => prev.map((cl) => (cl.id === id ? updater(cl) : cl)));
  }

  function openNew(mode: "blank" | "template" | "upload") {
    setNewMode((prev) => prev === mode ? "none" : mode);
  }

  // ── Toggle progress ──────────────────────────────────────────────────────
  function toggleItemInTree(items: TreeItem[], itemId: string, done: boolean): TreeItem[] {
    return items.map((it) => {
      if (it.id === itemId) return { ...it, progress: [{ done }] };
      if (it.children?.length) return { ...it, children: toggleItemInTree(it.children, itemId, done) };
      return it;
    });
  }

  async function toggleItem(checklistId: string, itemId: string) {
    // Optimistic update
    const cl = [...owned, ...participating].find((c) => c.id === checklistId);
    const currentDone = findItem(cl?.items ?? [], itemId)?.progress[0]?.done ?? false;
    patchOwned(checklistId, (c) => ({ ...c, items: toggleItemInTree(c.items, itemId, !currentDone) }));

    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleProgress", itemId }),
    });
    if (!res.ok) patchOwned(checklistId, (c) => ({ ...c, items: toggleItemInTree(c.items, itemId, currentDone) }));
  }

  function findItem(items: TreeItem[], id: string): TreeItem | null {
    for (const it of items) {
      if (it.id === id) return it;
      if (it.children?.length) { const f = findItem(it.children, id); if (f) return f; }
    }
    return null;
  }

  // ── Delete item ──────────────────────────────────────────────────────────
  function removeItemFromTree(items: TreeItem[], itemId: string): TreeItem[] {
    return items
      .filter((it) => it.id !== itemId)
      .map((it) => it.children?.length ? { ...it, children: removeItemFromTree(it.children, itemId) } : it);
  }

  async function deleteItem(checklistId: string, itemId: string) {
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteItem", itemId }),
    });
    if (res.ok) patchOwned(checklistId, (c) => ({ ...c, items: removeItemFromTree(c.items, itemId) }));
  }

  // ── Delete project ───────────────────────────────────────────────────────
  async function deleteProject(checklistId: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", checklistId }),
    });
    if (res.ok) setOwned((prev) => prev.filter((cl) => cl.id !== checklistId));
  }

  // ── Add item ─────────────────────────────────────────────────────────────
  function addItemToTree(items: TreeItem[], parentId: string | null, newItem: TreeItem): TreeItem[] {
    if (parentId === null) return [...items, newItem];
    return items.map((it) => {
      if (it.id === parentId) return { ...it, children: [...(it.children ?? []), newItem] };
      if (it.children?.length) return { ...it, children: addItemToTree(it.children, parentId, newItem) };
      return it;
    });
  }

  async function submitAddItem(checklistId: string) {
    if (!newItemText.trim() || !addingTo) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addItem", checklistId, text: newItemText, parentId: addingTo.parentId, depth: addingTo.depth }),
    });
    if (res.ok) {
      const item: TreeItem = await res.json();
      patchOwned(checklistId, (c) => ({ ...c, items: addItemToTree(c.items, addingTo.parentId, { ...item, children: [], progress: [] }) }));
      setNewItemText(""); setAddingTo(null);
    }
  }

  // ── Create blank project ─────────────────────────────────────────────────
  async function createBlank(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/checklists", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    if (res.ok) {
      const cl = await res.json();
      setOwned((prev) => [{ ...cl, participants: [] }, ...prev]);
      setNewName(""); setNewDesc(""); setNewMode("none");
    }
  }

  // ── Use template ─────────────────────────────────────────────────────────
  async function useTemplate(tmpl: TemplateMetadata) {
    setUsingTemplate(tmpl.id);
    setTemplateError("");
    try {
      const mdRes = await fetch(`/templates/${tmpl.filename}`);
      if (!mdRes.ok) throw new Error("Template file not found");
      const text = await mdRes.text();
      const file = new File([text], tmpl.filename, { type: "text/markdown" });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/checklists/import", { method: "POST", body: form });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : { error: "Server error" };
      if (!res.ok) { setTemplateError(data.error || "Import failed"); return; }
      setOwned((prev) => [{ ...data, participants: [] }, ...prev]);
      setNewMode("none");
    } catch {
      setTemplateError("Failed to import template — please try again");
    } finally {
      setUsingTemplate(null);
    }
  }

  // ── Imported via upload ──────────────────────────────────────────────────
  function handleImported(cl: unknown) {
    setOwned((prev) => [{ ...(cl as ChecklistData), participants: [] }, ...prev]);
    setNewMode("none");
  }

  // ── Visibility change ────────────────────────────────────────────────────
  async function saveVisibility(cl: ChecklistData, visibility: ChecklistData["visibility"]) {
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "changeVisibility", checklistId: cl.id, visibility }),
    });
    if (res.ok) {
      const updated = await res.json();
      patchOwned(cl.id, () => ({ ...cl, visibility: updated.visibility, slug: updated.slug }));
    }
    setVisModal(null);
  }

  // ── Drag and drop ────────────────────────────────────────────────────────
  function handleDragStart(checklistId: string, itemId: string) {
    dragChecklistId.current = checklistId;
    setDragState({ dragId: itemId, overId: null });
  }

  function handleDragOver(e: React.DragEvent, itemId: string) {
    e.preventDefault();
    setDragState((s) => ({ ...s, overId: itemId }));
  }

  function handleDrop(checklistId: string, targetId: string, parentId: string | null) {
    if (dragState.dragId === null || dragState.dragId === targetId) {
      setDragState({ dragId: null, overId: null });
      return;
    }
    const cl = owned.find((c) => c.id === checklistId);
    if (!cl) return;

    // Reorder siblings at the same parent level
    const siblings = parentId
      ? findItem(cl.items, parentId)?.children ?? []
      : cl.items.filter((it) => !parentId ? true : false);

    const list = parentId ? (findItem(cl.items, parentId)?.children ?? []) : cl.items;
    const dragIdx = list.findIndex((it) => it.id === dragState.dragId);
    const dropIdx = list.findIndex((it) => it.id === targetId);
    if (dragIdx === -1 || dropIdx === -1) { setDragState({ dragId: null, overId: null }); return; }

    const reordered = [...list];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    const orderedIds = reordered.map((it) => it.id);

    // Optimistic UI
    function applyReorder(items: TreeItem[]): TreeItem[] {
      if (!parentId) return reordered;
      return items.map((it) => it.id === parentId ? { ...it, children: reordered } : it.children?.length ? { ...it, children: applyReorder(it.children) } : it);
    }
    patchOwned(checklistId, (c) => ({ ...c, items: applyReorder(c.items) }));
    setDragState({ dragId: null, overId: null });

    // Persist
    fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorderItems", checklistId, orderedIds }),
    }).catch(() => {});

    void siblings; // suppress unused warning
  }

  // ─────────────────────────────────────────────────────────────────────────

  const allProjects = [
    ...owned.map((cl) => ({ ...cl, isOwner: true })),
    ...participating.map((cl) => ({ ...cl, isOwner: false })),
  ];
  const isEmpty = allProjects.length === 0;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-200">Projects</h2>
        <div className="flex gap-2">
          <button onClick={() => openNew("upload")} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">↑ Upload</button>
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
          <input autoFocus required value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
          <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
            Create project
          </button>
        </form>
      )}

      {/* Upload */}
      {newMode === "upload" && <div className="mb-4"><ChecklistImport onImported={handleImported} /></div>}

      {/* Template gallery */}
      {newMode === "template" && (
        <div className="mb-4 space-y-3">
          <p className="text-xs text-slate-500">Pick a starter template — creates an instant copy in your account. Download .md to customise first.</p>
          {templateError && <p className="text-red-400 text-xs">{templateError}</p>}
          {templates.length === 0 && <p className="text-slate-500 text-xs py-2">Loading templates…</p>}
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">{tmpl.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLOR[tmpl.category] ?? "bg-slate-700 text-slate-400"}`}>{tmpl.category}</span>
                    {tmpl.contributor && <span className="text-xs text-slate-500">by @{tmpl.contributor}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tmpl.description}</p>
                  <p className="text-xs text-slate-500 mt-1">{tmpl.itemCount} items</p>
                </div>
              </div>
              <button onClick={() => setPreviewId(previewId === tmpl.id ? null : tmpl.id)}
                className="text-xs text-slate-500 hover:text-slate-300 mt-2 transition-colors">
                {previewId === tmpl.id ? "Hide preview ▲" : "Preview ▾"}
              </button>
              {previewId === tmpl.id && <TemplatePreview filename={tmpl.filename} />}
              <div className="flex gap-2 mt-3">
                <button onClick={() => useTemplate(tmpl)} disabled={usingTemplate === tmpl.id}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors">
                  {usingTemplate === tmpl.id ? "Importing…" : "Use this →"}
                </button>
                <a href={`/templates/${tmpl.filename}`} download
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                  ⬇ Download .md
                </a>
              </div>
            </div>
          ))}
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

      {/* Project cards */}
      <div className="space-y-3">
        {allProjects.map((cl) => {
          const { done, total } = countCheckable(cl.items);
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isOpen = expanded === cl.id;

          return (
            <div key={cl.id} className="bg-slate-800 rounded-xl overflow-hidden">
              {/* Card header */}
              <div className="px-4 py-3 flex items-center gap-2">
                <button onClick={() => setExpanded(isOpen ? null : cl.id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                  <span className="text-sm">{isOpen ? "▾" : "▸"}</span>
                  <span className="text-sm font-medium text-slate-200 truncate">{cl.name}</span>
                  {!cl.isOwner && cl.user && <span className="text-xs text-slate-500 shrink-0">by @{cl.user.username}</span>}
                </button>
                <span className="text-xs text-slate-400 shrink-0">{done}/{total}</span>

                {/* Visibility — gear icon opens modal */}
                {cl.isOwner && (
                  <button
                    onClick={() => setVisModal(cl)}
                    title="Project settings"
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

              {/* Expanded tree */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-700 pt-3 space-y-0.5">
                  {cl.items.length === 0 && (
                    <p className="text-slate-500 text-xs py-2">No items yet.</p>
                  )}
                  {cl.items.map((item) => (
                    <ItemNode
                      key={item.id}
                      item={item}
                      checklistId={cl.id}
                      isOwner={cl.isOwner}
                      onToggle={(itemId) => toggleItem(cl.id, itemId)}
                      onDelete={deleteItem}
                      onAddChild={(parentId, depth) => { setAddingTo({ checklistId: cl.id, parentId, depth }); setNewItemText(""); }}
                      dragState={dragState}
                      onDragStart={(id) => handleDragStart(cl.id, id)}
                      onDragOver={(e, id) => handleDragOver(e, id)}
                      onDrop={(targetId, parentId) => handleDrop(cl.id, targetId, parentId)}
                      onDragEnd={() => setDragState({ dragId: null, overId: null })}
                    />
                  ))}

                  {/* Add item at root level */}
                  {cl.isOwner && (
                    addingTo?.checklistId === cl.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          autoFocus value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitAddItem(cl.id); } if (e.key === "Escape") setAddingTo(null); }}
                          placeholder="Item text…"
                          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                        />
                        <button onClick={() => submitAddItem(cl.id)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors">Add</button>
                        <button onClick={() => setAddingTo(null)} className="text-slate-500 text-xs">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo({ checklistId: cl.id, parentId: null, depth: 1 }); setNewItemText(""); }}
                        className="text-xs text-slate-500 hover:text-amber-400 mt-1 transition-colors block"
                      >
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

      {/* Visibility modal */}
      {visModal && (
        <VisibilityModal
          current={visModal.visibility}
          name={visModal.name}
          onSave={(v) => saveVisibility(visModal, v)}
          onClose={() => setVisModal(null)}
        />
      )}
    </section>
  );
}
