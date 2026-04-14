"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ChecklistImport from "./ChecklistImport";
import type { TemplateMetadata } from "@/app/api/templates/route";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Progress = { done: boolean };
type Revision = { createdAt: string };

export interface TreeItem {
  id: string;
  text: string;
  order: number;
  isSection: boolean;
  depth: number;
  progress: Progress[];
  revisions: Revision[];
  children?: TreeItem[];
  // For PRIVATE_COLLAB: list of members who have completed this item
  sharedProgress?: { userId: string; name: string; username: string }[];
}

export interface ChecklistData {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  visibility: "PRIVATE" | "PRIVATE_COLLAB" | "PUBLIC_TEMPLATE" | "PUBLIC_COLLAB" | "PUBLIC_EDIT";
  slug?: string | null;
  deadline?: string | null;
  archivedAt?: string | null;
  order?: number;
  items: TreeItem[];
  participants: { user: { id: string; name: string; username: string } }[];
  user?: { name: string; username: string };
  requests?: { id: string; type: string; status: string; requester?: { name: string; username: string } }[];
  viewerCanEdit?: boolean;
}

interface SectionProgressParticipant {
  userId: string; name: string; username: string; done: number; total: number;
}
interface SectionProgressData {
  sectionId: string; sectionText: string; participants: SectionProgressParticipant[];
}
interface CollabProgress {
  sections: SectionProgressData[];
  overall: SectionProgressParticipant[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIS_LABEL: Record<string, string> = {
  PRIVATE: "🔒 Private",
  PRIVATE_COLLAB: "🔒 Private Group",
  PUBLIC_TEMPLATE: "🔗 Template",
  PUBLIC_COLLAB: "👥 Collab",
  PUBLIC_EDIT: "🤝 Collab + Edit",
};
const VIS_DESCRIPTIONS: Record<string, string> = {
  PRIVATE: "Only you can see and edit this project.",
  PRIVATE_COLLAB: "You + invited members. Progress syncs among all members in real-time.",
  PUBLIC_TEMPLATE: "Anyone can view and copy to their own account.",
  PUBLIC_COLLAB: "Anyone can join and track their own progress. Leaderboard shown.",
  PUBLIC_EDIT: "Anyone can join, add and edit items. Leaderboard shown.",
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
    if (it.children?.length) { const s = countCheckable(it.children); done += s.done; total += s.total; }
  }
  return { done, total };
}

function findItem(items: TreeItem[], id: string): TreeItem | null {
  for (const it of items) {
    if (it.id === id) return it;
    if (it.children?.length) { const f = findItem(it.children, id); if (f) return f; }
  }
  return null;
}

function toggleItemInTree(items: TreeItem[], itemId: string, done: boolean): TreeItem[] {
  return items.map((it) => {
    if (it.id === itemId) return { ...it, progress: [{ done }] };
    if (it.children?.length) return { ...it, children: toggleItemInTree(it.children, itemId, done) };
    return it;
  });
}

function addRevisionInTree(items: TreeItem[], itemId: string): TreeItem[] {
  return items.map((it) => {
    if (it.id === itemId) return { ...it, revisions: [{ createdAt: new Date().toISOString() }, ...it.revisions] };
    if (it.children?.length) return { ...it, children: addRevisionInTree(it.children, itemId) };
    return it;
  });
}

function removeRevisionFromTree(items: TreeItem[], itemId: string): TreeItem[] {
  return items.map((it) => {
    if (it.id === itemId) {
      const newRevisions = it.revisions.slice(1); // remove most recent (stored desc)
      return {
        ...it,
        revisions: newRevisions,
        progress: newRevisions.length === 0 ? [{ done: false }] : it.progress,
      };
    }
    if (it.children?.length) return { ...it, children: removeRevisionFromTree(it.children, itemId) };
    return it;
  });
}

function removeItemFromTree(items: TreeItem[], itemId: string): TreeItem[] {
  return items
    .filter((it) => it.id !== itemId)
    .map((it) => it.children?.length ? { ...it, children: removeItemFromTree(it.children, itemId) } : it);
}

function addItemToTree(items: TreeItem[], parentId: string | null, newItem: TreeItem): TreeItem[] {
  if (parentId === null) return [...items, newItem];
  return items.map((it) => {
    if (it.id === parentId) return { ...it, children: [...(it.children ?? []), newItem] };
    if (it.children?.length) return { ...it, children: addItemToTree(it.children, parentId, newItem) };
    return it;
  });
}

function renameInTree(items: TreeItem[], itemId: string, text: string): TreeItem[] {
  return items.map((it) => {
    if (it.id === itemId) return { ...it, text };
    if (it.children?.length) return { ...it, children: renameInTree(it.children, itemId, text) };
    return it;
  });
}

function normaliseTreeItem(raw: Record<string, unknown>, depth = 0): TreeItem {
  return {
    id: raw.id as string,
    text: raw.text as string,
    order: (raw.order as number) ?? 0,
    isSection: (raw.isSection as boolean) ?? false,
    depth: (raw.depth as number) ?? depth,
    progress: (raw.progress as Progress[]) ?? [],
    revisions: (raw.revisions as Revision[]) ?? [],
    children: ((raw.children as Record<string, unknown>[]) ?? []).map((c) => normaliseTreeItem(c, depth + 1)),
  };
}

function normaliseChecklist(raw: Record<string, unknown>): ChecklistData {
  return {
    id: raw.id as string,
    userId: raw.userId as string,
    name: raw.name as string,
    description: raw.description as string | null | undefined,
    visibility: (raw.visibility as ChecklistData["visibility"]) ?? "PRIVATE",
    slug: raw.slug as string | null | undefined,
    deadline: raw.deadline as string | null | undefined,
    archivedAt: raw.archivedAt as string | null | undefined,
    order: (raw.order as number) ?? 0,
    participants: (raw.participants as ChecklistData["participants"]) ?? [],
    user: raw.user as ChecklistData["user"],
    items: ((raw.items as Record<string, unknown>[]) ?? []).map((i) => normaliseTreeItem(i)),
  };
}

// ─── Visibility Modal ─────────────────────────────────────────────────────────

function VisibilityModal({ current, name, checklistId, participants, onSave, onClose, onInvite, onRemoveMember }: {
  current: ChecklistData["visibility"]; name: string; checklistId: string;
  participants: ChecklistData["participants"];
  onSave: (v: ChecklistData["visibility"]) => Promise<void>; onClose: () => void;
  onInvite: (checklistId: string, username: string) => Promise<void>;
  onRemoveMember: (checklistId: string, memberId: string) => Promise<void>;
}) {
  const ALL: ChecklistData["visibility"][] = ["PRIVATE", "PRIVATE_COLLAB", "PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"];
  const [selected, setSelected] = useState<ChecklistData["visibility"]>(current);
  const [saving, setSaving] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);
  const changed = selected !== current;

  async function handleSave() { setSaving(true); await onSave(selected); setSaving(false); }
  async function handleInvite() {
    if (!inviteUsername.trim()) return;
    setInviting(true);
    await onInvite(checklistId, inviteUsername.trim());
    setInviteUsername("");
    setInviting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div>
          <h3 className="font-black text-white uppercase text-xs tracking-[0.2em] mb-1">Project settings</h3>
          <p className="text-slate-500 text-sm font-medium truncate">{name}</p>
        </div>
        <div className="space-y-2">
          {ALL.map((v) => (
            <label key={v} className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${selected === v ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"}`}>
              <input type="radio" name="visibility" value={v} checked={selected === v} onChange={() => setSelected(v)} className="mt-1 accent-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-100">{VIS_LABEL[v]}</p>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">{VIS_DESCRIPTIONS[v]}</p>
              </div>
            </label>
          ))}
        </div>

        {/* PRIVATE_COLLAB member management */}
        {selected === "PRIVATE_COLLAB" && (
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Members</p>
            {participants.length > 0 && (
              <div className="space-y-2">
                {participants.map(p => (
                  <div key={p.user.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">@{p.user.username}</span>
                    <button onClick={() => onRemoveMember(checklistId, p.user.id)}
                      className="text-[10px] text-red-500/70 hover:text-red-400 transition-colors">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInvite(); } }}
                placeholder="@username"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500" />
              <button onClick={handleInvite} disabled={inviting || !inviteUsername.trim()}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg">
                {inviting ? "…" : "Invite"}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!changed || saving} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-black rounded-2xl transition-all shadow-lg shadow-amber-500/10">
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
    fetch(`/templates/${filename}`).then((r) => r.text()).then((text) => {
      const items = text.split("\n").filter((l) => /^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.+)/.test(l))
        .slice(0, 8).map((l) => l.replace(/^(?:[-*]|\d+\.)\s+(?:\[[ xX\s]\]\s+)?/, "").trim());
      setLines(items); setLoading(false);
    }).catch(() => setLoading(false));
  }, [filename]);
  if (loading) return <p className="text-xs text-slate-500 mt-2">Loading preview…</p>;
  return (
    <ul className="mt-2 space-y-1 pl-1">
      {lines.map((l, i) => <li key={i} className="text-xs text-slate-400 flex items-center gap-1.5"><span className="w-3 h-3 border border-slate-600 rounded shrink-0" />{l}</li>)}
      <li className="text-xs text-slate-600 italic">…and more</li>
    </ul>
  );
}

// ─── Revision date helpers ────────────────────────────────────────────────────

function allRevisionShortDates(revisions: Revision[]): string[] {
  return revisions.map((r) => {
    const d = new Date(r.createdAt as unknown as string | Date);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  });
}

// ─── Tree Item Renderer ───────────────────────────────────────────────────────

interface ItemNodeProps {
  item: TreeItem;
  checklistId: string;
  canEdit: boolean;
  canDelete: boolean; // only owner — participants can add/rename but not delete/reorder
  canCheck: boolean;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  editingId: string | null;
  editingText: string;
  onEditStart: (id: string, text: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: (checklistId: string, itemId: string) => void;
  onEditCancel: () => void;
  onCheck: (checklistId: string, itemId: string) => void;
  onUncheck: (checklistId: string, itemId: string) => void;
  onRemoveRevision: (checklistId: string, itemId: string) => void;
  onDelete: (checklistId: string, itemId: string) => void;
  onAddChild: (parentId: string, depth: number) => void;
  addingTo: { checklistId: string; parentId: string | null; depth: number } | null;
  newItemText: string;
  onNewItemChange: (v: string) => void;
  onAddSubmit: (checklistId: string) => void;
  onAddCancel: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string, parentId: string | null) => void;
  onDragEnd: () => void;
  dragId: string | null;
  dragOverId: string | null;
  collabProgress?: CollabProgress | null;
}

function ItemNode({
  item, checklistId, canEdit, canDelete, canCheck,
  collapsedIds, onToggleCollapse,
  editingId, editingText, onEditStart, onEditChange, onEditSave, onEditCancel,
  onCheck, onUncheck, onRemoveRevision, onDelete, onAddChild,
  addingTo, newItemText, onNewItemChange, onAddSubmit, onAddCancel,
  onDragStart, onDragOver, onDrop, onDragEnd, dragId, dragOverId,
  collabProgress,
}: ItemNodeProps) {
  const [showAllDates, setShowAllDates] = useState(false);
  const checked = item.progress[0]?.done ?? false;
  const isDragging = dragId === item.id;
  const isDragOver = dragOverId === item.id && dragId !== item.id;
  const isCollapsed = collapsedIds.has(item.id);

  const commonProps = {
    draggable: canDelete,
    onDragStart: () => onDragStart(item.id),
    onDragOver: (e: React.DragEvent) => onDragOver(e, item.id),
    onDrop: () => onDrop(item.id, null),
    onDragEnd,
  };
  const hasChildren = (item.children?.length ?? 0) > 0;
  const isEditing = editingId === item.id;

  const sectionStats = item.isSection ? countCheckable(item.children ?? []) : null;

  if (item.isSection) {
    return (
      <div data-item-id={item.id} className={`mt-6 first:mt-0 transition-all ${isDragOver ? "ring-2 ring-amber-500 rounded-lg bg-amber-500/5" : ""}`}>
        <div className={`flex items-center gap-2 py-2 px-1 group transition-opacity ${isDragging ? "opacity-40" : ""}`} {...commonProps}>
          {/* Collapse toggle */}
          <button
            onClick={() => onToggleCollapse(item.id)}
            className="text-slate-500 hover:text-white transition-all w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800"
          >
            {isCollapsed ? "▸" : "▾"}
          </button>

          {canDelete && <span className="text-slate-700 hover:text-slate-400 text-base leading-none cursor-grab active:cursor-grabbing shrink-0 transition-colors hidden lg:block select-none">⠿</span>}

          {/* Section text — double-click to edit */}
          {isEditing ? (
            <input
              autoFocus
              value={editingText}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onEditSave(checklistId, item.id); }
                if (e.key === "Escape") onEditCancel();
              }}
              onBlur={() => onEditSave(checklistId, item.id)}
              className="flex-1 bg-slate-800 border border-amber-500 rounded-lg px-2 py-0.5 text-xs font-black text-amber-500 uppercase tracking-[0.15em] focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
          ) : (
            <span
              className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-default group-hover:text-slate-300 transition-colors"
              onDoubleClick={() => canEdit && onEditStart(item.id, item.text)}
              title={canEdit ? "Double-click to rename section" : undefined}
            >
              {item.text}
            </span>
          )}

          {/* Section progress */}
          {sectionStats && sectionStats.total > 0 && (
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-tighter bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-700/50">{sectionStats.done}/{sectionStats.total}</span>
          )}

          {canEdit && !isEditing && (
            <button
              onClick={() => onEditStart(item.id, item.text)}
              className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-amber-400 lg:text-slate-600 hover:text-amber-400 bg-amber-500/10 lg:bg-transparent border border-amber-500/30 lg:border-0 rounded-md text-sm lg:text-xs p-1.5 lg:p-1 min-w-[28px] min-h-[28px] lg:min-w-0 lg:min-h-0 flex items-center justify-center transition-all"
              title="Edit section"
            >✎</button>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(checklistId, item.id)}
              className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-red-400 lg:text-slate-600 hover:text-red-400 bg-red-500/10 lg:bg-transparent border border-red-500/30 lg:border-0 rounded-md text-sm lg:text-xs p-1.5 lg:p-1 min-w-[28px] min-h-[28px] lg:min-w-0 lg:min-h-0 flex items-center justify-center transition-all"
              title="Delete section"
            >✕</button>
          )}
        </div>

        {/* Section mini progress bar */}
        {sectionStats && sectionStats.total > 0 && (
          <div className="ml-7 mr-4 mb-2">
            <div className="w-full bg-slate-800 rounded-full h-1 border border-slate-800/50">
              <div
                className="bg-amber-500 h-1 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                style={{ width: `${Math.round((sectionStats.done / sectionStats.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Children */}
        {!isCollapsed && (
          <div className="ml-2 space-y-0.5 border-l-2 border-slate-800/50 pl-5 mb-4 mt-1">
            {item.children?.map((child) => (
              <ItemNode key={child.id} item={child} checklistId={checklistId} canEdit={canEdit} canDelete={canDelete} canCheck={canCheck}
                collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse}
                editingId={editingId} editingText={editingText} onEditStart={onEditStart} onEditChange={onEditChange} onEditSave={onEditSave} onEditCancel={onEditCancel}
                onCheck={onCheck} onUncheck={onUncheck} onRemoveRevision={onRemoveRevision} onDelete={onDelete} onAddChild={onAddChild}
                addingTo={addingTo} newItemText={newItemText} onNewItemChange={onNewItemChange} onAddSubmit={onAddSubmit} onAddCancel={onAddCancel}
                onDragStart={onDragStart} onDragOver={onDragOver} onDrop={(tid) => onDrop(tid, item.id)} onDragEnd={onDragEnd} dragId={dragId} dragOverId={dragOverId}
                collabProgress={collabProgress}
              />
            ))}

            {/* Inline add input — section children */}
            {addingTo?.checklistId === checklistId && addingTo.parentId === item.id ? (
              <div className="flex gap-1.5 mt-2 pr-4 animate-fadeIn">
                <input
                  autoFocus value={newItemText} onChange={(e) => onNewItemChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddSubmit(checklistId); } if (e.key === "Escape") onAddCancel(); }}
                  placeholder="New task name…"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
                />
                <button onClick={() => onAddSubmit(checklistId)} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg shadow-amber-500/10">Add</button>
                <button onClick={onAddCancel} className="text-slate-500 hover:text-white text-xs px-2 transition-colors">✕</button>
              </div>
            ) : canEdit ? (
              <button onClick={() => onAddChild(item.id, 1)} className="text-[10px] font-bold text-slate-600 hover:text-amber-500 transition-all uppercase tracking-widest py-1 px-2 hover:bg-slate-800 rounded-lg">+ add task</button>
            ) : null}
          </div>
        )}
        {isCollapsed && hasChildren && (
          <p className="ml-7 text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">{item.children!.length} items hidden</p>
        )}
      </div>
    );
  }

  // ── Task / Subtask ────────────────────────────────────────────────────────
  const indent = item.depth === 2 ? "ml-6" : "";

  return (
    <div data-item-id={item.id} className={`${indent} transition-all ${isDragOver ? "border-t-2 border-amber-500 bg-amber-500/5 rounded" : ""}`}>
      <div className={`flex items-center gap-2 group py-1.5 px-1 rounded-lg hover:bg-slate-800/40 transition-colors ${isDragging ? "opacity-40" : ""}`} {...commonProps}>
        {/* Collapse (only tasks with children) */}
        {hasChildren ? (
          <button onClick={() => onToggleCollapse(item.id)} className="text-slate-600 hover:text-white transition-all w-4 h-4 flex items-center justify-center rounded">
            {isCollapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {canDelete && <span className="text-slate-700 hover:text-slate-400 text-base leading-none cursor-grab active:cursor-grabbing shrink-0 transition-colors hidden lg:block select-none">⠿</span>}

        {/* − button: remove last revision (undo accidental check) */}
        {item.revisions.length > 0 && canCheck ? (
          <button
            onClick={() => onRemoveRevision(checklistId, item.id)}
            title={`Remove last revision (${item.revisions.length} logged)`}
            className="w-5 h-5 flex items-center justify-center rounded-full border border-slate-700 bg-slate-800 hover:border-red-500 hover:bg-red-500/10 text-slate-500 hover:text-red-400 text-lg shrink-0 transition-all leading-none shadow-sm"
          >−</button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Checkbox — click always logs revision */}
        <input
          type="checkbox"
          checked={checked}
          onChange={() => canCheck && onCheck(checklistId, item.id)}
          disabled={!canCheck}
          className="w-5 h-5 rounded-lg accent-amber-500 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-90"
        />

        {/* Text — double-click or pencil to edit */}
        {isEditing ? (
          <input
            autoFocus value={editingText} onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onEditSave(checklistId, item.id); }
              if (e.key === "Escape") onEditCancel();
            }}
            onBlur={() => onEditSave(checklistId, item.id)}
            className="flex-1 bg-slate-800 border border-amber-500 rounded-lg px-2 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          />
        ) : (
          <span
            className={`flex-1 text-sm leading-snug cursor-default select-none ${checked ? "line-through text-slate-500" : item.depth === 2 ? "text-slate-400" : "text-slate-200"}`}
            onDoubleClick={() => canEdit && onEditStart(item.id, item.text)}
          >
            {item.text}
          </span>
        )}

        {/* Shared progress badges (PRIVATE_COLLAB) — show who completed it */}
        {item.sharedProgress && item.sharedProgress.length > 0 && (
          <span
            className="shrink-0 flex items-center gap-1"
            title={`Done by: ${item.sharedProgress.map(p => p.name).join(", ")}`}
          >
            {item.sharedProgress.slice(0, 3).map((p) => (
              <span
                key={p.userId}
                className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-400"
              >{p.name[0]?.toUpperCase()}</span>
            ))}
            {item.sharedProgress.length > 3 && (
              <span className="text-[10px] text-slate-500 ml-0.5">+{item.sharedProgress.length - 3}</span>
            )}
          </span>
        )}

        {/* Revision count + dates */}
        {item.revisions.length > 0 && !isEditing && (() => {
          const dates = allRevisionShortDates(item.revisions);
          const visible = showAllDates ? dates : dates.slice(0, 3);
          const hasMore = dates.length > 3;

          return (
            <span
              className="text-[10px] text-amber-500/60 shrink-0 font-black uppercase tracking-tighter whitespace-nowrap flex items-center gap-1.5"
              title={`Reviewed ${item.revisions.length}×. Unchecking keeps your history; use − to remove the last review entry.`}
            >
              <span className="bg-amber-500/10 px-1.5 py-0.5 rounded-full">+{item.revisions.length}</span>
              <span className="hidden lg:flex items-center gap-1 overflow-hidden">
                {visible.map((d, i) => (
                  <span key={i} className="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">{d}</span>
                ))}
                {hasMore && !showAllDates && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAllDates(true); }}
                    className="hover:text-amber-400 underline decoration-dotted transition-colors"
                  >...</button>
                )}
                {showAllDates && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAllDates(false); }}
                    className="hover:text-amber-400 transition-colors"
                  >«</button>
                )}
              </span>
            </span>
          );
        })()}

        {/* Pencil edit button (always visible on hover for owners) */}
        {canEdit && !isEditing && (
          <button
            onClick={() => onEditStart(item.id, item.text)}
            className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-amber-400 lg:text-slate-600 hover:text-amber-400 bg-amber-500/10 lg:bg-transparent border border-amber-500/30 lg:border-0 rounded-md text-sm lg:text-xs p-1.5 lg:p-1 min-w-[28px] min-h-[28px] lg:min-w-0 lg:min-h-0 flex items-center justify-center transition-all"
            title="Rename"
          >✎</button>
        )}

        {canDelete && (
          <button
            onClick={() => onDelete(checklistId, item.id)}
            className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-red-400 lg:text-slate-600 hover:text-red-400 bg-red-500/10 lg:bg-transparent border border-red-500/30 lg:border-0 rounded-md text-sm lg:text-xs p-1.5 lg:p-1 min-w-[28px] min-h-[28px] lg:min-w-0 lg:min-h-0 flex items-center justify-center transition-all"
            title="Delete task"
          >✕</button>
        )}
      </div>

      {/* Subtask children */}
      {!isCollapsed && item.depth < 2 && (
        <div className="ml-9 space-y-0.5 mt-1 border-l border-slate-800 pl-4 mb-2">
          {item.children?.map((child) => (
            <ItemNode key={child.id} item={child} checklistId={checklistId} canEdit={canEdit} canDelete={canDelete} canCheck={canCheck}
              collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse}
              editingId={editingId} editingText={editingText} onEditStart={onEditStart} onEditChange={onEditChange} onEditSave={onEditSave} onEditCancel={onEditCancel}
              onCheck={onCheck} onUncheck={onUncheck} onRemoveRevision={onRemoveRevision} onDelete={onDelete} onAddChild={onAddChild}
              addingTo={addingTo} newItemText={newItemText} onNewItemChange={onNewItemChange} onAddSubmit={onAddSubmit} onAddCancel={onAddCancel}
              onDragStart={onDragStart} onDragOver={onDragOver} onDrop={(tid) => onDrop(tid, item.id)} onDragEnd={onDragEnd} dragId={dragId} dragOverId={dragOverId}
              collabProgress={collabProgress}
            />
          ))}

          {/* Inline add — task children */}
          {addingTo?.checklistId === checklistId && addingTo.parentId === item.id ? (
            <div className="flex gap-1.5 mt-2 pr-4 animate-fadeIn">
              <input
                autoFocus value={newItemText} onChange={(e) => onNewItemChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddSubmit(checklistId); } if (e.key === "Escape") onAddCancel(); }}
                placeholder="New subtask name…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
              />
              <button onClick={() => onAddSubmit(checklistId)} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg shadow-amber-500/10">Add</button>
              <button onClick={onAddCancel} className="text-slate-500 hover:text-white text-xs px-2 transition-colors">✕</button>
            </div>
          ) : canEdit ? (
            <button onClick={() => onAddChild(item.id, item.depth + 1)} className="text-[10px] font-bold text-slate-600 hover:text-amber-500 transition-all uppercase tracking-widest py-1 px-2 hover:bg-slate-800 rounded-lg">+ subtask</button>
          ) : null}
        </div>
      )}
      {isCollapsed && hasChildren && (
        <p className="ml-9 text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">{item.children!.length} subtasks hidden</p>
      )}
    </div>
  );
}

// ─── Template Panel ───────────────────────────────────────────────────────────

interface TemplatePanelProps {
  templates: TemplateMetadata[];
  templateError: string;
  previewId: string | null;
  usingTemplate: string | null;
  alreadyHaveIds: Set<string>; // template ids already in owned/participating
  onClose: () => void;
  onPreview: (id: string | null) => void;
  onUse: (tmpl: TemplateMetadata) => void;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function TemplatePanel({ templates, templateError, previewId, usingTemplate, alreadyHaveIds, onClose, onPreview, onUse }: TemplatePanelProps) {
  const [tab, setTab] = useState<"presets" | "community">("presets");
  const importing = templates.find((t) => t.id === usingTemplate);

  return (
    <div className="mb-4 bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden animate-fadeIn relative">
      {/* Import overlay */}
      {importing && (
        <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-2xl">
          <Spinner className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-semibold text-slate-200">Importing {importing.title}…</p>
          <p className="text-xs text-slate-400">This may take a few seconds.</p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab("presets")}
            className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${tab === "presets" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
          >
            📋 Presets
          </button>
          <button
            onClick={() => setTab("community")}
            className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${tab === "community" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
          >
            🌐 Community
          </button>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-lg leading-none rotate-45">+</button>
      </div>

      {/* Preset templates */}
      {tab === "presets" && (
        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
          <p className="text-xs text-slate-500">Pick a starter template — creates an instant copy in your account.</p>
          {templateError && <p className="text-red-400 text-xs">{templateError}</p>}
          {templates.length === 0 && <p className="text-slate-500 text-xs py-2">Loading templates…</p>}
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="bg-slate-700/60 border border-slate-600/40 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">{tmpl.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLOR[tmpl.category] ?? "bg-slate-700 text-slate-400"}`}>{tmpl.category}</span>
                    {tmpl.contributor && <span className="text-xs text-slate-500">by @{tmpl.contributor}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tmpl.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{tmpl.itemCount} items</p>
                </div>
              </div>
              <button onClick={() => onPreview(previewId === tmpl.id ? null : tmpl.id)} className="text-xs text-slate-500 hover:text-slate-300 mt-2 transition-colors">
                {previewId === tmpl.id ? "Hide preview ▲" : "Preview ▾"}
              </button>
              {previewId === tmpl.id && <TemplatePreview filename={tmpl.filename} />}
              <div className="flex gap-2 mt-2">
                {alreadyHaveIds.has(tmpl.id) ? (
                  <button disabled className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg cursor-default flex items-center gap-1.5">
                    ✓ Already in your dashboard
                  </button>
                ) : (
                  <button onClick={() => onUse(tmpl)} disabled={usingTemplate !== null}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                    {usingTemplate === tmpl.id ? (<><Spinner className="w-3.5 h-3.5" /> Importing…</>) : "Use this →"}
                  </button>
                )}
                <a href={`/templates/${tmpl.filename}`} download className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-semibold rounded-lg transition-colors">⬇ .md</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Community projects tab */}
      {tab === "community" && (
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500">Browse community projects on the Explore page — copy templates or join collab projects.</p>
          <Link
            href="/discover"
            className="flex items-center justify-between w-full px-4 py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold text-sm rounded-xl hover:bg-amber-500/20 transition-all"
          >
            <span>🌐 Open Explore page</span>
            <span className="text-xs opacity-70">→</span>
          </Link>
          <p className="text-xs text-slate-600 italic">After copying a project from Explore, it will appear here automatically.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  owned: ChecklistData[];
  participating: ChecklistData[];
  archived?: ChecklistData[];
  userId: string;
  forcedExpandId?: string | null;
  scrollTarget?: string | null;  // format: "sectionId:timestamp"
  onExpandChange?: (id: string | null) => void;
  onOwnedChange?: (list: ChecklistData[]) => void;
  onParticipatingChange?: (list: ChecklistData[]) => void;
  onCollabProgressChange?: (progress: Record<string, CollabProgress>) => void;
}

export default function ChecklistSection({
  owned: initialOwned, participating: initialParticipating, archived = [], userId,
  forcedExpandId, scrollTarget, onExpandChange, onOwnedChange, onParticipatingChange, onCollabProgressChange
}: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const [owned, setOwned] = useState(initialOwned);
  const [participating, setParticipating] = useState(initialParticipating);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newMode, setNewMode] = useState<"none" | "blank" | "template" | "upload">("none");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [usingTemplate, setUsingTemplate] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState("");

  // Template ids the user already has in their dashboard (so we can dim the preset button).
  // Right now only Ortho is shared (added as participant); the other presets are user-owned copies
  // which currently don't carry a template marker, so we match by canonical name + contributor.
  const alreadyHaveTemplateIds = React.useMemo(() => {
    const have = new Set<string>();
    const all = [...owned, ...participating];
    for (const tmpl of templates) {
      const matchName = tmpl.title; // import sets checklist.name to the parsed H1
      if (all.some((cl) => cl.name === matchName || cl.name === `${matchName} (copy)`)) {
        have.add(tmpl.id);
      }
    }
    return have;
  }, [owned, participating, templates]);
  const [addingTo, setAddingTo] = useState<{ checklistId: string; parentId: string | null; depth: number } | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [visModal, setVisModal] = useState<ChecklistData | null>(null);

  // Collapse / Edit
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Editing project title
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState("");

  // Drag state — dragIdRef avoids stale closure; ownedRef ensures drop handler sees latest state
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragChecklistId = useRef<string | null>(null);
  const ownedRef = useRef(owned);
  useEffect(() => { ownedRef.current = owned; }, [owned]);

  // Card-level drag (separate from item drag)
  const cardDragIdRef = useRef<string | null>(null);
  const [cardDragOverId, setCardDragOverId] = useState<string | null>(null);

  // Edit mode per project (set of ids currently in edit mode)
  const [editModeIds, setEditModeIds] = useState<Set<string>>(new Set());

  // Inline deadline editing
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);

  // Add-project popup
  const [addPopupOpen, setAddPopupOpen] = useState(false);
  const addPopupRef = useRef<HTMLDivElement>(null);

  // Ref to hold the pending scrollTarget so forcedExpandId effect can access it
  const pendingScrollTargetRef = useRef<string | null>(null);
  useEffect(() => { pendingScrollTargetRef.current = scrollTarget ?? null; }, [scrollTarget]);

  // Sync forced expand from parent (right panel project click)
  useEffect(() => {
    if (!forcedExpandId) return;
    const alreadyExpanded = forcedExpandId === expanded;
    if (!alreadyExpanded) {
      setExpanded(forcedExpandId);
      onExpandChange?.(forcedExpandId);
    }
    // Scroll to project card first (fast), then to the section item after React re-renders tree
    setTimeout(() => {
      const el = containerRef.current?.querySelector(`[data-checklist-id="${forcedExpandId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    // Scroll to the specific section — use 600ms to guarantee React has committed the expanded tree
    setTimeout(() => {
      const target = pendingScrollTargetRef.current;
      if (!target) return;
      const sectionId = target.split(":")[0];
      const root = containerRef.current;
      if (!root) return;
      const sectionEl = root.querySelector(`[data-item-id="${sectionId}"]`) as HTMLElement | null;
      if (sectionEl) {
        sectionEl.style.scrollMarginTop = "90px";
        sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
        sectionEl.style.outline = "2px solid #f59e0b";
        sectionEl.style.outlineOffset = "3px";
        sectionEl.style.borderRadius = "6px";
        setTimeout(() => {
          sectionEl.style.outline = "";
          sectionEl.style.outlineOffset = "";
          sectionEl.style.borderRadius = "";
        }, 2500);
      }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedExpandId]);

  // Scroll to a specific section/item when right panel section is clicked
  // (handles the case where the project is already expanded — no forcedExpandId re-trigger).
  // Uses a retry ladder so we don't lose the scroll if the layout is still
  // being committed when the first attempt fires.
  useEffect(() => {
    if (!scrollTarget) return;
    const sectionId = scrollTarget.split(":")[0];

    // If the target is hidden under a collapsed parent, uncollapse it first.
    setCollapsedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      // Walk all owned/participating items, find the target and any ancestor sections,
      // and uncollapse anything that contains it.
      const allLists = [ownedRef.current, participating];
      for (const list of allLists) {
        for (const cl of list) {
          const path: string[] = [];
          const findPath = (items: TreeItem[] | undefined): boolean => {
            if (!items) return false;
            for (const it of items) {
              if (it.id === sectionId) return true;
              path.push(it.id);
              if (findPath(it.children)) return true;
              path.pop();
            }
            return false;
          };
          if (findPath(cl.items)) {
            for (const ancestorId of path) {
              if (next.has(ancestorId)) { next.delete(ancestorId); changed = true; }
            }
            return changed ? next : prev;
          }
        }
      }
      return prev;
    });

    let cancelled = false;
    const attempts = [0, 120, 300, 700, 1200];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const tryScroll = () => {
      if (cancelled) return false;
      const root = containerRef.current;
      if (!root) return false;
      const el = root.querySelector(`[data-item-id="${sectionId}"]`) as HTMLElement | null;
      if (!el || el.offsetHeight === 0) return false;
      el.style.scrollMarginTop = "90px";
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.style.outline = "2px solid #f59e0b";
      el.style.outlineOffset = "3px";
      el.style.borderRadius = "6px";
      const clearTimer = setTimeout(() => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.borderRadius = "";
      }, 2500);
      timers.push(clearTimer);
      return true;
    };

    for (const delay of attempts) {
      const t = setTimeout(() => {
        if (cancelled) return;
        if (tryScroll()) {
          // success — cancel any later retries
          for (const tt of timers) clearTimeout(tt);
        }
      }, delay);
      timers.push(t);
    }

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget]);

  // Close popup on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addPopupRef.current && !addPopupRef.current.contains(e.target as Node)) {
        setAddPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Collab progress (lazy loaded per checklist)
  const [collabProgress, setCollabProgress] = useState<Record<string, CollabProgress>>({});
  const [loadingProgress, setLoadingProgress] = useState<string | null>(null);

  useEffect(() => {
    if (newMode === "template" && templates.length === 0) {
      fetch("/api/templates").then((r) => r.json()).then(setTemplates).catch(() => {});
    }
  }, [newMode, templates.length]);

  // Load collab progress when a collab/private-collab checklist is expanded
  async function fetchProgress(checklistId: string) {
    const r = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getSectionProgress", checklistId }),
    });
    if (!r.ok) return;
    const data = await r.json();
    setCollabProgress((prev) => {
      const next = { ...prev, [checklistId]: data };
      onCollabProgressChange?.(next);
      return next;
    });
  }

  useEffect(() => {
    if (!expanded) return;
    const cl = [...owned, ...participating].find((c) => c.id === expanded);
    if (!cl) return;
    const isCollab = cl.visibility === "PUBLIC_COLLAB" || cl.visibility === "PUBLIC_EDIT" || cl.visibility === "PRIVATE_COLLAB";
    if (!isCollab) return;

    if (!collabProgress[expanded] && loadingProgress !== expanded) {
      setLoadingProgress(expanded);
      fetchProgress(expanded).finally(() => setLoadingProgress(null));
    }

    // Polling for real-time updates (every 8s) for private collab
    if (cl.visibility === "PRIVATE_COLLAB" || cl.visibility === "PUBLIC_COLLAB" || cl.visibility === "PUBLIC_EDIT") {
      const interval = setInterval(() => fetchProgress(expanded), 8000);
      return () => clearInterval(interval);
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  function patchOwned(id: string, updater: (cl: ChecklistData) => ChecklistData) {
    // Patches checklist in either owned or participating, so dashboard updates
    // optimistically work for both project owners and participants.
    let foundInOwned = false;
    setOwned((prev) => {
      const next = prev.map((cl) => {
        if (cl.id === id) { foundInOwned = true; return updater(cl); }
        return cl;
      });
      if (foundInOwned) onOwnedChange?.(next);
      return next;
    });
    setParticipating((prev) => prev.map((cl) => (cl.id === id ? updater(cl) : cl)));
  }

  function openNew(mode: "blank" | "template" | "upload") {
    setNewMode((prev) => prev === mode ? "none" : mode);
  }

  // ── Toggle collapse ──────────────────────────────────────────────────────
  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Inline edit (item text) ──────────────────────────────────────────────
  function startEdit(id: string, text: string) { setEditingId(id); setEditingText(text); }
  function cancelEdit() { setEditingId(null); setEditingText(""); }

  async function saveEdit(checklistId: string, itemId: string) {
    const text = editingText.trim();
    setEditingId(null);
    if (!text) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "renameItem", itemId, text }),
    });
    if (res.ok) {
      patchOwned(checklistId, (c) => ({ ...c, items: renameInTree(c.items, itemId, text) }));
    } else {
      toast.error("Change not saved — please try again.");
    }
  }

  // ── Check item (logs revision) ───────────────────────────────────────────
  async function checkItem(checklistId: string, itemId: string) {
    // Optimistic: mark done + add revision
    patchOwned(checklistId, (c) => ({
      ...c,
      items: addRevisionInTree(toggleItemInTree(c.items, itemId, true), itemId),
    }));
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkItem", itemId }),
    });
    if (!res.ok) {
      // Revert
      patchOwned(checklistId, (c) => ({
        ...c,
        items: toggleItemInTree(c.items, itemId, false),
      }));
      toast.error("Change not saved — please try again.");
    }
  }

  // ── Remove last revision (undo accidental check) ─────────────────────────
  async function removeRevision(checklistId: string, itemId: string) {
    // Optimistic: remove most recent revision from tree
    patchOwned(checklistId, (c) => ({ ...c, items: removeRevisionFromTree(c.items, itemId) }));
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "removeLastRevision", itemId }),
    });
    if (!res.ok) {
      // Revert: add revision back
      patchOwned(checklistId, (c) => ({ ...c, items: addRevisionInTree(c.items, itemId) }));
      toast.error("Change not saved — please try again.");
    }
  }

  // ── Uncheck item ─────────────────────────────────────────────────────────
  async function uncheckItem(checklistId: string, itemId: string) {
    patchOwned(checklistId, (c) => ({ ...c, items: toggleItemInTree(c.items, itemId, false) }));
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "uncheckItem", itemId }),
    });
    if (!res.ok) {
      patchOwned(checklistId, (c) => ({ ...c, items: toggleItemInTree(c.items, itemId, true) }));
      toast.error("Change not saved — please try again.");
    }
  }

  // ── Delete item ──────────────────────────────────────────────────────────
  async function deleteItem(checklistId: string, itemId: string) {
    if (!confirm("Delete this item? Its subtasks will also be removed.")) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteItem", itemId }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.requested) {
        toast.success("Deletion request sent to project owner.");
      } else {
        patchOwned(checklistId, (c) => ({ ...c, items: removeItemFromTree(c.items, itemId) }));
        toast.success("Item deleted.");
      }
    } else {
      toast.error("Failed to delete item — please try again.");
    }
  }

  // ── Delete project ───────────────────────────────────────────────────────
  async function deleteProject(checklistId: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", checklistId }),
    });
    if (res.ok) {
      setOwned((prev) => { const next = prev.filter((cl) => cl.id !== checklistId); onOwnedChange?.(next); return next; });
    } else {
      toast.error("Failed to delete project — please try again.");
    }
  }

  // ── Reset progress ────────────────────────────────────────────────────────

  async function resetProgress(checklistId: string, name: string) {
    if (!confirm(`Reset ALL your progress on "${name}"?\n\nThis will uncheck every item and clear all review dates for your account. This cannot be undone.`)) return;

    // Recursively clear progress + revisions on every item of the matching checklist.
    const clearItems = (items: TreeItem[]): TreeItem[] =>
      items.map((it) => ({
        ...it,
        progress: [],
        revisions: [],
        children: it.children ? clearItems(it.children) : it.children,
      }));
    const clearList = (list: ChecklistData[]) =>
      list.map((cl) => (cl.id === checklistId ? { ...cl, items: clearItems(cl.items) } : cl));

    // Snapshot for rollback
    const ownedSnapshot = owned;
    const participatingSnapshot = participating;

    // Optimistic update — compute next state outside the updater so parent
    // setters aren't invoked during the child render phase.
    const nextOwned = clearList(owned);
    const nextParticipating = clearList(participating);
    setOwned(nextOwned);
    setParticipating(nextParticipating);
    onOwnedChange?.(nextOwned);
    onParticipatingChange?.(nextParticipating);

    const res = await fetch(`/api/checklists/${checklistId}/progress`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Progress reset");
    } else {
      // Rollback
      setOwned(ownedSnapshot);
      setParticipating(participatingSnapshot);
      onOwnedChange?.(ownedSnapshot);
      onParticipatingChange?.(participatingSnapshot);
      toast.error("Failed to reset progress");
    }
  }

  // ── Leave project (participant self-remove) ─────────────────────────────
  async function leaveProject(checklistId: string, name: string) {
    if (!confirm(`Leave "${name}"?\n\nYour progress, checkboxes and review dates on this project will be removed. You can re-join later.`)) return;

    const snapshot = participating;
    const next = participating.filter((c) => c.id !== checklistId);
    setParticipating(next);
    onParticipatingChange?.(next);
    if (expanded === checklistId) {
      setExpanded(null);
      onExpandChange?.(null);
    }

    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leaveProject", checklistId }),
    });
    if (res.ok) {
      toast.success(`Left "${name}"`);
    } else {
      // Rollback
      setParticipating(snapshot);
      onParticipatingChange?.(snapshot);
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to leave project");
    }
  }

  // ── Archive project ──────────────────────────────────────────────────────
  async function archiveProject(checklistId: string, name: string) {
    if (!confirm(`Archive "${name}"? You can restore it from the Archived section.`)) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archiveProject", checklistId }),
    });
    if (res.ok) { window.location.reload(); }
    else { toast.error("Failed to archive project — please try again."); }
  }

  // ── Unarchive project ────────────────────────────────────────────────────
  async function unarchiveProject(checklistId: string) {
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unarchiveProject", checklistId }),
    });
    if (res.ok) { window.location.reload(); }
    else { toast.error("Failed to restore project — please try again."); }
  }

  // ── Set deadline ─────────────────────────────────────────────────────────
  async function saveDeadline(checklistId: string, deadline: string | null) {
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setDeadline", checklistId, deadline }),
    });
    if (res.ok) {
      patchOwned(checklistId, (c) => ({ ...c, deadline: deadline }));
      setEditingDeadlineId(null);
    } else { toast.error("Failed to set deadline — please try again."); }
  }

  // ── Reorder projects (card drag) ─────────────────────────────────────────
  async function reorderProjects(ids: string[]) {
    await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorderProjects", ids }),
    });
  }

  // ── Invite member (PRIVATE_COLLAB) ───────────────────────────────────────
  async function inviteMember(checklistId: string, username: string) {
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inviteMember", checklistId, username }),
    });
    if (res.ok) { toast.success(`@${username} invited!`); }
    else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed to invite member.");
    }
  }

  // ── Remove member (PRIVATE_COLLAB) ───────────────────────────────────────
  async function removeMember(checklistId: string, memberId: string) {
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "removeMember", checklistId, memberId }),
    });
    if (res.ok) {
      patchOwned(checklistId, (c) => ({
        ...c,
        participants: c.participants.filter(p => p.user.id !== memberId),
      }));
      toast.success("Member removed.");
    } else { toast.error("Failed to remove member — please try again."); }
  }

  // ── Toggle edit mode ─────────────────────────────────────────────────────
  function toggleEditMode(id: string) {
    setEditModeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Card drag (reorder projects) ─────────────────────────────────────────
  function handleCardDragStart(id: string) { cardDragIdRef.current = id; }
  function handleCardDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setCardDragOverId(id); }
  function handleCardDragLeave() { setCardDragOverId(null); }
  function handleCardDragEnd() { cardDragIdRef.current = null; setCardDragOverId(null); }
  function handleCardDrop(targetId: string) {
    const dragId = cardDragIdRef.current;
    handleCardDragEnd();
    if (!dragId || dragId === targetId) return;
    const list = owned;
    const fromIdx = list.findIndex(c => c.id === dragId);
    const toIdx = list.findIndex(c => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...list];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setOwned(reordered);
    onOwnedChange?.(reordered);
    reorderProjects(reordered.map(c => c.id));
  }

  // ── Add item ─────────────────────────────────────────────────────────────
  async function submitAddItem(checklistId: string) {
    if (!newItemText.trim() || !addingTo) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addItem", checklistId, text: newItemText.trim(), parentId: addingTo.parentId, depth: addingTo.depth }),
    });
    if (res.ok) {
      const raw = await res.json();
      const newItem: TreeItem = { ...raw, progress: [], revisions: [], children: [] };
      patchOwned(checklistId, (c) => ({ ...c, items: addItemToTree(c.items, addingTo.parentId, newItem) }));
      setNewItemText(""); setAddingTo(null);
    } else {
      toast.error("Failed to add item — please try again.");
    }
  }

  // ── Rename project title ─────────────────────────────────────────────────
  async function saveTitleEdit(checklistId: string) {
    const name = editingTitleText.trim();
    setEditingTitleId(null);
    if (!name) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "renameChecklist", checklistId, name }),
    });
    if (res.ok) {
      patchOwned(checklistId, (c) => ({ ...c, name }));
    } else {
      toast.error("Failed to rename project — please try again.");
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
      const raw = await res.json();
      setOwned((prev) => { const next = [normaliseChecklist(raw), ...prev]; onOwnedChange?.(next); return next; });
      setNewName(""); setNewDesc(""); setNewMode("none");
      toast.success("Project created!");
    } else {
      toast.error("Failed to create project — please try again.");
    }
  }

  // ── Use template ─────────────────────────────────────────────────────────
  async function useTemplate(tmpl: TemplateMetadata) {
    // Client-side short-circuit: if the template is already in the dashboard,
    // just expand and scroll to it instead of re-importing.
    const existing = [...owned, ...participating].find(
      (cl) => cl.name === tmpl.title || cl.name === `${tmpl.title} (copy)`
    );
    if (existing) {
      toast("Already in your dashboard — opening it.");
      setNewMode("none");
      setExpanded(existing.id);
      onExpandChange?.(existing.id);
      return;
    }

    setUsingTemplate(tmpl.id); setTemplateError("");
    try {
      const mdRes = await fetch(`/templates/${tmpl.filename}`);
      if (!mdRes.ok) throw new Error("Template file not found");
      const text = await mdRes.text();
      const file = new File([text], tmpl.filename, { type: "text/markdown" });
      const form = new FormData(); form.append("file", file);
      const res = await fetch("/api/checklists/import", { method: "POST", body: form });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : { error: "Server error" };
      if (!res.ok) {
        setTemplateError(data.error || "Import failed");
        toast.error(data.error || "Import failed");
        return;
      }

      const imported = normaliseChecklist(data);
      const isParticipant = imported.userId !== userId;
      const alreadyJoined = Boolean((data as { alreadyJoined?: boolean }).alreadyJoined);

      if (alreadyJoined) {
        // Server says caller already had it — make sure local state reflects that
        // (could be stale). Merge if missing.
        const inOwned = owned.some((c) => c.id === imported.id);
        const inPart = participating.some((c) => c.id === imported.id);
        if (!inOwned && !inPart) {
          if (isParticipant) {
            const nextP = [imported, ...participating];
            setParticipating(nextP);
            onParticipatingChange?.(nextP);
          } else {
            const nextO = [imported, ...owned];
            setOwned(nextO);
            onOwnedChange?.(nextO);
          }
        }
        toast("Already in your dashboard — opening it.");
      } else if (isParticipant) {
        const nextP = [imported, ...participating];
        setParticipating(nextP);
        onParticipatingChange?.(nextP);
        toast.success("Joined shared template!");
      } else {
        const nextO = [imported, ...owned];
        setOwned(nextO);
        onOwnedChange?.(nextO);
        toast.success("Template imported!");
      }

      setNewMode("none");
      setExpanded(imported.id);
      onExpandChange?.(imported.id);
    } catch {
      setTemplateError("Failed to import template — please try again");
      toast.error("Failed to import template — please try again");
    }
    finally { setUsingTemplate(null); }
  }

  // ── Imported via upload ──────────────────────────────────────────────────
  function handleImported(raw: unknown) {
    setOwned((prev) => { const next = [normaliseChecklist(raw as Record<string, unknown>), ...prev]; onOwnedChange?.(next); return next; });
    setNewMode("none");
    toast.success("Project imported!");
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
      toast.success("Visibility updated!");
    } else {
      toast.error("Failed to update visibility — please try again.");
    }
    setVisModal(null);
  }

  // ── HTML5 drag handlers (ownedRef avoids stale closure in handleDrop) ──────
  const handleDragStart = useCallback((checklistId: string, itemId: string) => {
    dragChecklistId.current = checklistId;
    dragIdRef.current = itemId;
    setDragId(itemId);
    dragOverRef.current = null;
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    dragOverRef.current = itemId;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setDragOverId(dragOverRef.current);
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDragId(null);
    setDragOverId(null);
    dragOverRef.current = null;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const handleDrop = useCallback((checklistId: string, targetId: string, parentId: string | null) => {
    const dragItemId = dragIdRef.current;
    handleDragEnd();
    if (!dragItemId || dragItemId === targetId) return;

    const cl = ownedRef.current.find((c) => c.id === checklistId); // use ref — always current
    if (!cl) return;

    const list = parentId ? (findItem(cl.items, parentId)?.children ?? []) : cl.items;
    const dragIdx = list.findIndex((it) => it.id === dragItemId);
    const dropIdx = list.findIndex((it) => it.id === targetId);
    if (dragIdx === -1 || dropIdx === -1) return;

    const reordered = [...list];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    const orderedIds = reordered.map((it) => it.id);

    function applyReorder(items: TreeItem[]): TreeItem[] {
      if (!parentId) return reordered;
      return items.map((it) =>
        it.id === parentId
          ? { ...it, children: reordered }
          : it.children?.length
          ? { ...it, children: applyReorder(it.children) }
          : it
      );
    }
    patchOwned(checklistId, (c) => ({ ...c, items: applyReorder(c.items) }));

    fetch("/api/checklists", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorderItems", checklistId, orderedIds }),
    }).catch(() => {});
  }, [handleDragEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────

  const allProjects = [
    ...owned.map((cl) => ({
      ...cl,
      isOwner: true,
      canEdit: editModeIds.has(cl.id), // edit mode controlled by toggle
      canDelete: editModeIds.has(cl.id), // owner can delete when in edit mode
      canCheck: true,
    })),
    ...participating.map((cl) => {
      const hasEditAccess = !!cl.viewerCanEdit;
      return {
        ...cl,
        isOwner: false,
        canEdit: hasEditAccess && editModeIds.has(cl.id),
        canDelete: hasEditAccess && editModeIds.has(cl.id),
        canCheck: true,
      };
    }),
  ];
  const isEmpty = allProjects.length === 0;

  return (
    <section ref={containerRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700/50 transition-all duration-300">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-200">Projects</h2>
        <div className="relative" ref={addPopupRef}>
          <button
            onClick={() => setAddPopupOpen((p) => !p)}
            className={`w-8 h-8 flex items-center justify-center font-bold rounded-xl text-lg transition-all shadow-md active:scale-95 ${addPopupOpen ? "bg-slate-700 hover:bg-slate-600 text-slate-300 rotate-45" : "bg-amber-500 hover:bg-amber-400 text-slate-950 hover:shadow-amber-500/20"}`}
            title={addPopupOpen ? "Close" : "Add project"}
          >+</button>
          {addPopupOpen && (
            <div className="absolute right-0 top-10 z-20 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl p-2 min-w-[160px] animate-fadeIn">
              <button onClick={() => { openNew("blank"); setAddPopupOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
                ✦ New project
              </button>
              <button onClick={() => { openNew("template"); setAddPopupOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
                📋 From template
              </button>
              <button onClick={() => { openNew("upload"); setAddPopupOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
                ↑ Upload .md
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Blank project form */}
      {newMode === "blank" && (
        <div className="mb-4 bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">✦ New Project</span>
            <button onClick={() => openNew("blank")} className="text-slate-500 hover:text-white transition-colors text-lg leading-none rotate-45">+</button>
          </div>
          <form onSubmit={createBlank} className="p-4 space-y-2">
            <input autoFocus required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
            <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">Create project</button>
          </form>
        </div>
      )}

      {/* Upload */}
      {newMode === "upload" && (
        <div className="mb-4 bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">↑ Upload .md</span>
            <button onClick={() => openNew("upload")} className="text-slate-500 hover:text-white transition-colors text-lg leading-none rotate-45">+</button>
          </div>
          <div className="p-4"><ChecklistImport onImported={handleImported} /></div>
        </div>
      )}

      {/* Template gallery */}
      {newMode === "template" && (
        <TemplatePanel
          templates={templates}
          templateError={templateError}
          previewId={previewId}
          usingTemplate={usingTemplate}
          alreadyHaveIds={alreadyHaveTemplateIds}
          onClose={() => openNew("template")}
          onPreview={(id) => setPreviewId(id)}
          onUse={useTemplate}
        />
      )}

      {/* Empty state */}
      {isEmpty && newMode === "none" && (
        <div className="text-center py-8 space-y-3">
          <p className="text-slate-500 text-sm">No projects yet.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={() => openNew("template")} className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-lg hover:bg-amber-500/20 transition-colors">📋 Start from template</button>
            <button onClick={() => openNew("blank")} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">+ Blank project</button>
            <button onClick={() => openNew("upload")} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">↑ Upload .md</button>
          </div>
        </div>
      )}

      {/* Project cards */}
      <div className="space-y-3">
        {allProjects.map((cl) => {
          const { done, total } = countCheckable(cl.items);
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isOpen = expanded === cl.id;
          const progress = collabProgress[cl.id] ?? null;

          const isEditMode = editModeIds.has(cl.id);
          const isCardDragOver = cardDragOverId === cl.id && cardDragIdRef.current !== cl.id;
          const deadlineDaysLeft = cl.deadline
            ? Math.ceil((new Date(cl.deadline).getTime() - Date.now()) / 86400000)
            : null;

          return (
            <div
              key={cl.id}
              data-checklist-id={cl.id}
              draggable={cl.isOwner}
              onDragStart={() => cl.isOwner && handleCardDragStart(cl.id)}
              onDragOver={(e) => handleCardDragOver(e, cl.id)}
              onDragLeave={handleCardDragLeave}
              onDragEnd={handleCardDragEnd}
              onDrop={() => handleCardDrop(cl.id)}
              className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md ${isCardDragOver ? "border-amber-500 bg-amber-500/5" : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/80"}`}
            >
              {/* Card header — Row 1: expand + title + drag handle + progress count */}
              <div className="px-4 pt-3.5 pb-1">
                <div className="flex items-center gap-2">
                  {/* Expand toggle (clicking left area collapses/expands) */}
                  <button
                    onClick={() => { const next = isOpen ? null : cl.id; setExpanded(next); onExpandChange?.(next); }}
                    className="shrink-0 text-slate-500 hover:text-white text-sm transition-colors p-1 -ml-1"
                  >
                    {isOpen ? "▾" : "▸"}
                  </button>

                  {/* Title — click to expand, double-click to rename */}
                  {cl.isOwner && editingTitleId === cl.id ? (
                    <input
                      autoFocus
                      value={editingTitleText}
                      onChange={(e) => setEditingTitleText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); saveTitleEdit(cl.id); }
                        if (e.key === "Escape") setEditingTitleId(null);
                      }}
                      onBlur={() => saveTitleEdit(cl.id)}
                      className="flex-1 bg-slate-800 border border-amber-500 rounded-lg px-2 py-0.5 text-sm font-bold text-slate-100 focus:outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 text-base font-bold text-slate-100 truncate cursor-default hover:text-white transition-colors"
                      onClick={() => { const next = isOpen ? null : cl.id; setExpanded(next); onExpandChange?.(next); }}
                      onDoubleClick={() => { if (cl.isOwner) { setEditingTitleId(cl.id); setEditingTitleText(cl.name); } }}
                      title={cl.isOwner ? "Click to expand · Double-click to rename" : cl.name}
                    >
                      {cl.name}
                    </span>
                  )}

                  <span className="text-xs font-mono text-slate-500 shrink-0">{done}/{total}</span>

                  {/* Drag handle for card reorder */}
                  {cl.isOwner && (
                    <span className="text-slate-600 hover:text-slate-400 text-base cursor-grab active:cursor-grabbing shrink-0 select-none hidden lg:block" title="Drag to reorder">⠿</span>
                  )}
                </div>

                {/* Row 2: deadline + visibility badge + link */}
                <div className="flex items-center gap-2 flex-wrap mt-1 ml-6">
                  {/* Deadline */}
                  {cl.isOwner && editingDeadlineId === cl.id ? (
                    <input
                      type="date"
                      autoFocus
                      defaultValue={cl.deadline ? cl.deadline.slice(0, 10) : ""}
                      onChange={(e) => saveDeadline(cl.id, e.target.value || null)}
                      onBlur={(e) => { if (!e.target.value) saveDeadline(cl.id, null); else setEditingDeadlineId(null); }}
                      className="bg-slate-800 border border-amber-500 rounded-lg px-2 py-0.5 text-xs text-slate-100 focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => cl.isOwner && setEditingDeadlineId(cl.id)}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors ${
                        deadlineDaysLeft === null
                          ? "text-slate-600 hover:text-slate-400"
                          : deadlineDaysLeft < 0
                          ? "bg-red-500/10 text-red-400 border border-red-500/30"
                          : deadlineDaysLeft <= 7
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                      title={cl.isOwner ? "Click to set deadline" : undefined}
                    >
                      {deadlineDaysLeft === null
                        ? (cl.isOwner ? "+ deadline" : "")
                        : deadlineDaysLeft < 0
                        ? `🔥 ${Math.abs(deadlineDaysLeft)}d overdue`
                        : `🗓 ${deadlineDaysLeft}d left`}
                    </button>
                  )}

                  {/* Visibility badge */}
                  {cl.isOwner && (
                    <button onClick={() => setVisModal(cl)} title="Project settings"
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-all shrink-0 active:scale-95">
                      {VIS_LABEL[cl.visibility]}
                    </button>
                  )}
                  {!cl.isOwner && cl.user && (
                    <span className="text-[10px] text-slate-500">by @{cl.user.username}</span>
                  )}
                  {cl.slug && cl.visibility !== "PRIVATE" && cl.visibility !== "PRIVATE_COLLAB" && (
                    <>
                      <Link href={`/project/${cl.slug}`} className="text-[10px] text-amber-500 hover:text-amber-400 transition-colors">↗ view</Link>
                      <button
                        onClick={async () => {
                          const url = `${window.location.origin}/project/${cl.slug}`;
                          try {
                            await navigator.clipboard.writeText(url);
                            toast.success("Project link copied — share it with friends!");
                          } catch {
                            toast.info(url);
                          }
                        }}
                        className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors"
                        title="Copy shareable project link"
                      >🔗 copy link</button>
                    </>
                  )}
                </div>

                {/* Row 3: edit toggle + archive + delete + reset */}
                {cl.isOwner && (
                  <div className="flex items-center gap-2 mt-1.5 ml-6 flex-wrap">
                    <button
                      onClick={() => toggleEditMode(cl.id)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                        isEditMode
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {isEditMode ? "✓ Done editing" : "✎ Edit"}
                    </button>
                    <button
                      onClick={() => resetProgress(cl.id, cl.name)}
                      className="text-[10px] text-slate-600 hover:text-sky-400 transition-colors px-1"
                      title="Reset all my progress on this project"
                    >↺ Reset</button>
                    <button
                      onClick={() => archiveProject(cl.id, cl.name)}
                      className="text-[10px] text-slate-600 hover:text-amber-400 transition-colors px-1"
                      title="Archive project"
                    >📦 Archive</button>
                    <button
                      onClick={() => deleteProject(cl.id)}
                      className="text-[10px] text-slate-600 hover:text-red-400 transition-colors px-1"
                      title="Delete project"
                    >✕ Delete</button>
                  </div>
                )}
                {/* Edit toggle + Reset / Leave for participating (non-owner) projects */}
                {!cl.isOwner && (
                  <div className="flex items-center gap-2 mt-1.5 ml-6 flex-wrap">
                    {/* Edit toggle — only if viewer has been granted edit access */}
                    {cl.viewerCanEdit && (
                      <button
                        onClick={() => toggleEditMode(cl.id)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                          isEditMode
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {isEditMode ? "✓ Done editing" : "✎ Edit"}
                      </button>
                    )}
                    {/* Request edit access — for joined participants on PUBLIC_COLLAB/EDIT without edit yet */}
                    {!cl.viewerCanEdit && (cl.visibility === "PUBLIC_COLLAB" || cl.visibility === "PUBLIC_EDIT") && (
                      (cl.requests || []).some(r => r.type === "EDIT" && r.status === "PENDING") ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-amber-500/30 text-amber-400">⏳ Edit request pending</span>
                      ) : (
                        <button
                          onClick={async () => {
                            const res = await fetch("/api/checklists", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "requestEdit", checklistId: cl.id }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (res.ok) toast.success(data.alreadyApproved ? "You already have edit access" : "Edit request sent!");
                            else toast.error(data.error || "Could not send request");
                          }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20"
                        >✎ Request edit access</button>
                      )
                    )}
                    <button
                      onClick={() => resetProgress(cl.id, cl.name)}
                      className="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-sky-400 hover:border-sky-500/30 transition-colors"
                      title="Reset all my progress on this project"
                    >↺ Reset progress</button>
                    <button
                      onClick={() => leaveProject(cl.id, cl.name)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                      title="Leave this shared project"
                    >🚪 Leave project</button>
                  </div>
                )}
              </div>

              {/* Pending edit/join requests — owner only */}
              {cl.isOwner && cl.requests && cl.requests.filter((r: { type: string; status: string }) => (r.type === "JOIN" || r.type === "EDIT") && r.status === "PENDING").length > 0 && (
                <div className="px-4 pb-2">
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Edit-access requests</p>
                    {cl.requests.filter((r: { type: string; status: string }) => (r.type === "JOIN" || r.type === "EDIT") && r.status === "PENDING").map((r: { id: string; type: string; requester?: { name: string; username: string } }) => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-300">{r.requester?.name ?? "Member"} <span className="text-slate-500">@{r.requester?.username}</span> <span className="text-[9px] text-slate-600">({r.type === "EDIT" ? "edit access" : "join"})</span></span>
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              const res = await fetch("/api/checklists", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "handleProjectRequest", requestId: r.id, status: "APPROVED" }),
                              });
                              if (res.ok) { toast.success(`Approved @${r.requester?.username ?? "member"}`); window.location.reload(); }
                            }}
                            className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-semibold hover:bg-emerald-500/30"
                          >Approve</button>
                          <button
                            onClick={async () => {
                              const res = await fetch("/api/checklists", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "handleProjectRequest", requestId: r.id, status: "REJECTED" }),
                              });
                              if (res.ok) { toast.success("Request rejected"); window.location.reload(); }
                            }}
                            className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] font-semibold hover:bg-red-500/20"
                          >Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall progress bar */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 border border-slate-800/50">
                    <div className="bg-amber-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 shrink-0 min-w-[28px]">{pct}%</span>
                </div>
              </div>

              {/* Expanded tree */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-700 pt-3 space-y-0.5">
                  {loadingProgress === cl.id && (
                    <p className="text-xs text-slate-600 italic mb-2">Loading participant progress…</p>
                  )}

                  {cl.items.length === 0 && <p className="text-slate-500 text-xs py-2">No items yet.</p>}

                  {cl.items.map((item) => (
                    <ItemNode
                      key={item.id}
                      item={item}
                      checklistId={cl.id}
                      canDelete={cl.canDelete}
                      canEdit={cl.canEdit}
                      canCheck={cl.canCheck}
                      collapsedIds={collapsedIds}
                      onToggleCollapse={toggleCollapse}
                      editingId={editingId}
                      editingText={editingText}
                      onEditStart={startEdit}
                      onEditChange={setEditingText}
                      onEditSave={saveEdit}
                      onEditCancel={cancelEdit}
                      onCheck={checkItem}
                      onUncheck={uncheckItem}
                      onRemoveRevision={removeRevision}
                      onDelete={deleteItem}
                      onAddChild={(parentId, depth) => { setAddingTo({ checklistId: cl.id, parentId, depth }); setNewItemText(""); }}
                      addingTo={addingTo}
                      newItemText={newItemText}
                      onNewItemChange={setNewItemText}
                      onAddSubmit={submitAddItem}
                      onAddCancel={() => setAddingTo(null)}
                      onDragStart={(id) => handleDragStart(cl.id, id)}
                      onDragOver={handleDragOver}
                      onDrop={(targetId, parentId) => handleDrop(cl.id, targetId, parentId)}
                      onDragEnd={handleDragEnd}
                      dragId={dragId}
                      dragOverId={dragOverId}
                      collabProgress={progress}
                    />
                  ))}

                  {/* Add root-level item */}
                  {cl.canEdit && (
                    addingTo?.checklistId === cl.id && addingTo.parentId === null ? (
                      <div className="flex gap-1.5 mt-2">
                        <input
                          autoFocus value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitAddItem(cl.id); } if (e.key === "Escape") setAddingTo(null); }}
                          placeholder="Item text…"
                          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                        />
                        <button onClick={() => submitAddItem(cl.id)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">Add</button>
                        <button onClick={() => setAddingTo(null)} className="text-slate-500 text-xs px-1">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo({ checklistId: cl.id, parentId: null, depth: 1 }); setNewItemText(""); }}
                        className="text-xs text-slate-600 hover:text-amber-400 mt-1 transition-colors block"
                      >+ add item</button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Archived projects */}
      {archived.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden mt-3">
          <div className="px-4 py-3 border-b border-slate-800/50 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">📦 Archived</span>
            <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">{archived.length}</span>
          </div>
          <div className="divide-y divide-slate-800/40">
            {archived.map((cl) => (
              <div key={cl.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors group/arc">
                <div className="min-w-0">
                  <p className="text-sm text-slate-400 font-medium truncate">{cl.name}</p>
                  {cl.archivedAt && (
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Archived {new Date(cl.archivedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => unarchiveProject(cl.id)}
                  className="text-[11px] text-slate-500 hover:text-amber-400 px-2 py-1 rounded-lg border border-slate-700 hover:border-amber-500/40 transition-all shrink-0 ml-3 opacity-0 group-hover/arc:opacity-100"
                >Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visibility modal */}
      {visModal && (
        <VisibilityModal
          current={visModal.visibility}
          name={visModal.name}
          checklistId={visModal.id}
          participants={visModal.participants}
          onSave={(v) => saveVisibility(visModal, v)}
          onClose={() => setVisModal(null)}
          onInvite={inviteMember}
          onRemoveMember={removeMember}
        />
      )}
    </section>
  );
}
