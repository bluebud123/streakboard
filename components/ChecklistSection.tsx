"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
}

export interface ChecklistData {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC_TEMPLATE" | "PUBLIC_COLLAB" | "PUBLIC_EDIT";
  slug?: string | null;
  items: TreeItem[];
  participants: { user: { id: string; name: string; username: string } }[];
  user?: { name: string; username: string };
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
  PUBLIC_TEMPLATE: "🔗 Template",
  PUBLIC_COLLAB: "👥 Collab",
  PUBLIC_EDIT: "🤝 Collab + Edit",
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
    participants: (raw.participants as ChecklistData["participants"]) ?? [],
    user: raw.user as ChecklistData["user"],
    items: ((raw.items as Record<string, unknown>[]) ?? []).map((i) => normaliseTreeItem(i)),
  };
}

// ─── Visibility Modal ─────────────────────────────────────────────────────────

function VisibilityModal({ current, name, onSave, onClose }: {
  current: ChecklistData["visibility"]; name: string;
  onSave: (v: ChecklistData["visibility"]) => Promise<void>; onClose: () => void;
}) {
  const ALL: ChecklistData["visibility"][] = ["PRIVATE", "PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"];
  const [selected, setSelected] = useState<ChecklistData["visibility"]>(current);
  const [saving, setSaving] = useState(false);
  const toPrivate = selected === "PRIVATE" && current !== "PRIVATE";
  const fromPrivate = selected !== "PRIVATE" && current === "PRIVATE";
  const changed = selected !== current;

  async function handleSave() { setSaving(true); await onSave(selected); setSaving(false); }

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
            ⚠️ {toPrivate ? "Switching to Private — current participants will lose access." : "Switching to Public — this project will be visible to everyone."}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!changed || saving} className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-sm font-semibold rounded-xl transition-colors">
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

function latestRevisionShortDate(revisions: Revision[]): string | null {
  if (!revisions.length) return null;
  const d = new Date(revisions[0].createdAt as unknown as string | Date);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

// ─── Tree Item Renderer ───────────────────────────────────────────────────────

interface ItemNodeProps {
  item: TreeItem;
  checklistId: string;
  canEdit: boolean;
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
  item, checklistId, canEdit, canCheck,
  collapsedIds, onToggleCollapse,
  editingId, editingText, onEditStart, onEditChange, onEditSave, onEditCancel,
  onCheck, onUncheck, onRemoveRevision, onDelete, onAddChild,
  addingTo, newItemText, onNewItemChange, onAddSubmit, onAddCancel,
  onDragStart, onDragOver, onDrop, onDragEnd, dragId, dragOverId,
  collabProgress,
}: ItemNodeProps) {
  const checked = item.progress[0]?.done ?? false;
  const isDragging = dragId === item.id;
  const isDragOver = dragOverId === item.id && dragId !== item.id;
  const isCollapsed = collapsedIds.has(item.id);

  const commonProps = {
    draggable: canEdit,
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
      <div data-item-id={item.id} className={`mt-3 first:mt-0 ${isDragOver ? "border-t-2 border-amber-500 rounded" : ""}`}>
        <div className={`flex items-center gap-1.5 py-1.5 px-1 group ${isDragging ? "opacity-40" : ""}`} {...commonProps}>
          {/* Collapse toggle */}
          <button
            onClick={() => onToggleCollapse(item.id)}
            className="text-slate-600 hover:text-slate-400 text-xs w-4 shrink-0 transition-colors"
          >
            {isCollapsed ? "▶" : "▼"}
          </button>

          {canEdit && <span className="text-slate-600 text-xs opacity-0 group-hover:opacity-100 cursor-grab shrink-0">⠿</span>}

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
              className="flex-1 bg-slate-700 border border-amber-500 rounded px-2 py-0.5 text-xs font-bold text-amber-400 uppercase tracking-wider focus:outline-none"
            />
          ) : (
            <span
              className="flex-1 text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-slate-700 pb-0.5 cursor-text"
              onDoubleClick={() => canEdit && onEditStart(item.id, item.text)}
              title={canEdit ? "Double-click to edit" : undefined}
            >
              {item.text}
            </span>
          )}

          {/* Section progress */}
          {sectionStats && sectionStats.total > 0 && (
            <span className="text-xs text-slate-500 shrink-0 font-mono">{sectionStats.done}/{sectionStats.total}</span>
          )}

          {canEdit && !isEditing && (
            <button
              onClick={() => onEditStart(item.id, item.text)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 text-xs transition-all shrink-0"
              title="Edit section name"
            >✎</button>
          )}

          {canEdit && (
            <button
              onClick={() => onDelete(checklistId, item.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all shrink-0"
            >✕</button>
          )}
        </div>

        {/* Section mini progress bar */}
        {sectionStats && sectionStats.total > 0 && (
          <div className="ml-6 mb-1">
            <div className="w-full bg-slate-700/50 rounded-full h-0.5">
              <div
                className="bg-amber-500/60 h-0.5 rounded-full transition-all"
                style={{ width: `${Math.round((sectionStats.done / sectionStats.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Children */}
        {!isCollapsed && (
          <div className="ml-4 space-y-0.5 border-l border-slate-700/50 pl-3">
            {item.children?.map((child) => (
              <ItemNode key={child.id} item={child} checklistId={checklistId} canEdit={canEdit} canCheck={canCheck}
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
              <div className="flex gap-1.5 mt-1.5">
                <input
                  autoFocus value={newItemText} onChange={(e) => onNewItemChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddSubmit(checklistId); } if (e.key === "Escape") onAddCancel(); }}
                  placeholder="New task…"
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
                <button onClick={() => onAddSubmit(checklistId)} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">Add</button>
                <button onClick={onAddCancel} className="text-slate-500 text-xs px-1">✕</button>
              </div>
            ) : canEdit ? (
              <button onClick={() => onAddChild(item.id, 1)} className="text-xs text-slate-600 hover:text-amber-400 transition-colors py-0.5">+ add task</button>
            ) : null}
          </div>
        )}
        {isCollapsed && hasChildren && (
          <p className="ml-6 text-xs text-slate-600 italic">{item.children!.length} task{item.children!.length !== 1 ? "s" : ""} hidden</p>
        )}
      </div>
    );
  }

  // ── Task / Subtask ────────────────────────────────────────────────────────
  const indent = item.depth === 2 ? "ml-4" : "";

  return (
    <div data-item-id={item.id} className={`${indent} ${isDragOver ? "border-t-2 border-amber-500 rounded" : ""}`}>
      <div className={`flex items-center gap-1.5 group py-0.5 ${isDragging ? "opacity-40" : ""}`} {...commonProps}>
        {/* Collapse (only tasks with children) */}
        {hasChildren ? (
          <button onClick={() => onToggleCollapse(item.id)} className="text-slate-600 hover:text-slate-400 text-xs w-4 shrink-0">
            {isCollapsed ? "▶" : "▼"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {canEdit && <span className="text-slate-600 text-xs opacity-0 group-hover:opacity-100 cursor-grab shrink-0">⠿</span>}

        {/* − button: remove last revision (undo accidental check) */}
        {item.revisions.length > 0 && canCheck ? (
          <button
            onClick={() => onRemoveRevision(checklistId, item.id)}
            title={`Remove last revision (${item.revisions.length} logged)`}
            className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-400 text-sm shrink-0 transition-colors leading-none"
          >−</button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Checkbox — click always logs revision */}
        <input
          type="checkbox"
          checked={checked}
          onChange={() => canCheck && onCheck(checklistId, item.id)}
          disabled={!canCheck}
          className="w-5 h-5 rounded accent-amber-500 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="flex-1 bg-slate-700 border border-amber-500 rounded px-2 py-0.5 text-sm text-slate-100 focus:outline-none"
          />
        ) : (
          <span
            className={`flex-1 text-sm leading-snug ${checked ? "line-through text-slate-500" : item.depth === 2 ? "text-slate-400" : "text-slate-300"}`}
            onDoubleClick={() => canEdit && onEditStart(item.id, item.text)}
          >
            {item.text}
          </span>
        )}

        {/* Revision count + latest date */}
        {item.revisions.length > 0 && !isEditing && (() => {
          const dateStr = latestRevisionShortDate(item.revisions);
          return (
            <span
              className="text-xs text-amber-500/60 shrink-0 font-mono whitespace-nowrap"
              title={`Reviewed ${item.revisions.length}×. Unchecking keeps your history; use − to remove the last review entry.`}
            >
              +{item.revisions.length}{dateStr ? ` · ${dateStr}` : ""}
            </span>
          );
        })()}

        {/* Pencil edit button (always visible on hover for owners) */}
        {canEdit && !isEditing && (
          <button
            onClick={() => onEditStart(item.id, item.text)}
            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 text-xs transition-all shrink-0"
            title="Edit"
          >✎</button>
        )}

        {canEdit && (
          <button
            onClick={() => onDelete(checklistId, item.id)}
            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all shrink-0"
          >✕</button>
        )}
      </div>

      {/* Subtask children */}
      {!isCollapsed && item.depth < 2 && (
        <div className="ml-9 space-y-0.5">
          {item.children?.map((child) => (
            <ItemNode key={child.id} item={child} checklistId={checklistId} canEdit={canEdit} canCheck={canCheck}
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
            <div className="flex gap-1.5 mt-1">
              <input
                autoFocus value={newItemText} onChange={(e) => onNewItemChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddSubmit(checklistId); } if (e.key === "Escape") onAddCancel(); }}
                placeholder="New subtask…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
              <button onClick={() => onAddSubmit(checklistId)} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">Add</button>
              <button onClick={onAddCancel} className="text-slate-500 text-xs px-1">✕</button>
            </div>
          ) : canEdit ? (
            <button onClick={() => onAddChild(item.id, item.depth + 1)} className="text-xs text-slate-600 hover:text-amber-400 transition-colors">+ subtask</button>
          ) : null}
        </div>
      )}
      {isCollapsed && hasChildren && (
        <p className="ml-9 text-xs text-slate-600 italic">{item.children!.length} subtask{item.children!.length !== 1 ? "s" : ""} hidden</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  owned: ChecklistData[];
  participating: ChecklistData[];
  userId: string;
  onExpandChange?: (id: string | null) => void;
  onOwnedChange?: (list: ChecklistData[]) => void;
  onParticipatingChange?: (list: ChecklistData[]) => void;
  onCollabProgressChange?: (progress: Record<string, CollabProgress>) => void;
}

export default function ChecklistSection({
  owned: initialOwned, participating: initialParticipating, userId,
  onExpandChange, onOwnedChange, onParticipatingChange, onCollabProgressChange
}: Props) {
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

  // Collab progress (lazy loaded per checklist)
  const [collabProgress, setCollabProgress] = useState<Record<string, CollabProgress>>({});
  const [loadingProgress, setLoadingProgress] = useState<string | null>(null);

  useEffect(() => {
    if (newMode === "template" && templates.length === 0) {
      fetch("/api/templates").then((r) => r.json()).then(setTemplates).catch(() => {});
    }
  }, [newMode, templates.length]);

  // Load collab progress when a collab checklist is expanded
  useEffect(() => {
    if (!expanded) return;
    const cl = [...owned, ...participating].find((c) => c.id === expanded);
    if (!cl) return;
    if (cl.visibility !== "PUBLIC_COLLAB" && cl.visibility !== "PUBLIC_EDIT") return;
    if (collabProgress[expanded] || loadingProgress === expanded) return;

    setLoadingProgress(expanded);
    fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getSectionProgress", checklistId: expanded }),
    })
      .then((r) => r.json())
      .then((data) => {
        const next = { ...collabProgress, [expanded]: data };
        setCollabProgress(next);
        onCollabProgressChange?.(next);
      })
      .catch(() => {})
      .finally(() => setLoadingProgress(null));
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  function patchOwned(id: string, updater: (cl: ChecklistData) => ChecklistData) {
    setOwned((prev) => {
      const next = prev.map((cl) => (cl.id === id ? updater(cl) : cl));
      onOwnedChange?.(next);
      return next;
    });
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
    if (res.ok) {
      patchOwned(checklistId, (c) => ({ ...c, items: removeItemFromTree(c.items, itemId) }));
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
      setOwned((prev) => { const next = [normaliseChecklist(data), ...prev]; onOwnedChange?.(next); return next; });
      setNewMode("none");
      toast.success("Template imported!");
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
    ...owned.map((cl) => ({ ...cl, isOwner: true, canEdit: true, canCheck: true })),
    ...participating.map((cl) => ({
      ...cl,
      isOwner: false,
      canEdit: cl.visibility === "PUBLIC_EDIT",
      canCheck: true,
    })),
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
          <input autoFocus required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500" />
          <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">Create project</button>
        </form>
      )}

      {/* Upload */}
      {newMode === "upload" && <div className="mb-4"><ChecklistImport onImported={handleImported} /></div>}

      {/* Template gallery */}
      {newMode === "template" && (
        <div className="mb-4 space-y-3">
          <p className="text-xs text-slate-500">Pick a starter template — creates an instant copy in your account.</p>
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
              <button onClick={() => setPreviewId(previewId === tmpl.id ? null : tmpl.id)} className="text-xs text-slate-500 hover:text-slate-300 mt-2 transition-colors">
                {previewId === tmpl.id ? "Hide preview ▲" : "Preview ▾"}
              </button>
              {previewId === tmpl.id && <TemplatePreview filename={tmpl.filename} />}
              <div className="flex gap-2 mt-3">
                <button onClick={() => useTemplate(tmpl)} disabled={usingTemplate === tmpl.id}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors">
                  {usingTemplate === tmpl.id ? "Importing…" : "Use this →"}
                </button>
                <a href={`/templates/${tmpl.filename}`} download className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors">⬇ Download .md</a>
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

          return (
            <div key={cl.id} className="bg-slate-800 rounded-xl overflow-hidden">
              {/* Card header */}
              <div className="px-4 py-3 flex items-center gap-2">
                <button onClick={() => { const next = isOpen ? null : cl.id; setExpanded(next); onExpandChange?.(next); }} className="shrink-0 text-slate-400 hover:text-slate-200 text-sm">
                  {isOpen ? "▾" : "▸"}
                </button>

                {/* Project title — double-click to rename */}
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
                    className="flex-1 bg-slate-700 border border-amber-500 rounded px-2 py-0.5 text-sm text-slate-100 focus:outline-none"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm font-medium text-slate-200 truncate cursor-default"
                    onDoubleClick={() => { if (cl.isOwner) { setEditingTitleId(cl.id); setEditingTitleText(cl.name); } }}
                    title={cl.isOwner ? "Double-click to rename" : cl.name}
                  >
                    {cl.name}
                  </span>
                )}

                {!cl.isOwner && cl.user && <span className="text-xs text-slate-500 shrink-0">by @{cl.user.username}</span>}
                <span className="text-xs text-slate-400 shrink-0">{done}/{total}</span>

                {cl.isOwner && (
                  <button onClick={() => setVisModal(cl)} title="Project settings"
                    className="text-xs px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors shrink-0">
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

              {/* Overall progress bar */}
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{pct}%</span>
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

      {/* Visibility modal */}
      {visModal && (
        <VisibilityModal current={visModal.visibility} name={visModal.name} onSave={(v) => saveVisibility(visModal, v)} onClose={() => setVisModal(null)} />
      )}
    </section>
  );
}
