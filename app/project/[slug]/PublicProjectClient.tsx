"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import type { TreeItem } from "./page";

interface LeaderboardEntry {
  id: string;
  name: string;
  username: string;
  done: number;
  total: number;
  isOwner: boolean;
}

interface Props {
  checklistId: string;
  visibility: string;
  items: TreeItem[];
  leaderboard: LeaderboardEntry[];
  isOwner: boolean;
  isParticipant: boolean;
  viewerUserId: string | null;
  isLoggedIn: boolean;
}

// ─── Helper: count checkable items in a subtree ───────────────────────────────

function countCheckable(items: TreeItem[]): number {
  let n = 0;
  for (const it of items) {
    if (!it.isSection) n++;
    n += countCheckable(it.children);
  }
  return n;
}

function countMyDone(items: TreeItem[]): number {
  let n = 0;
  for (const it of items) {
    if (!it.isSection && it.myDone) n++;
    n += countMyDone(it.children);
  }
  return n;
}

function findItem(items: TreeItem[], id: string): TreeItem | null {
  for (const it of items) {
    if (it.id === id) return it;
    if (it.children.length) { const f = findItem(it.children, id); if (f) return f; }
  }
  return null;
}

// ─── Optimistic toggle / edit helpers ────────────────────────────────────────

function toggleInTree(items: TreeItem[], itemId: string): TreeItem[] {
  return items.map((it) => {
    if (it.id === itemId) return { ...it, myDone: !it.myDone };
    if (it.children.length) return { ...it, children: toggleInTree(it.children, itemId) };
    return it;
  });
}

function deleteFromTree(items: TreeItem[], itemId: string): TreeItem[] {
  return items
    .filter((it) => it.id !== itemId)
    .map((it) => it.children.length ? { ...it, children: deleteFromTree(it.children, itemId) } : it);
}

function addToTree(items: TreeItem[], parentId: string | null, newItem: TreeItem): TreeItem[] {
  if (parentId === null) return [...items, newItem];
  return items.map((it) => {
    if (it.id === parentId) return { ...it, children: [...it.children, newItem] };
    if (it.children.length) return { ...it, children: addToTree(it.children, parentId, newItem) };
    return it;
  });
}

function reorderAtParent(items: TreeItem[], parentId: string | null, dragId: string, targetId: string): TreeItem[] {
  if (parentId === null) {
    const list = [...items];
    const from = list.findIndex(i => i.id === dragId);
    const to = list.findIndex(i => i.id === targetId);
    if (from === -1 || to === -1) return items;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    return list;
  }
  return items.map(it => {
    if (it.id === parentId) {
      const list = [...it.children];
      const from = list.findIndex(i => i.id === dragId);
      const to = list.findIndex(i => i.id === targetId);
      if (from === -1 || to === -1) return it;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...it, children: list };
    }
    if (it.children.length) return { ...it, children: reorderAtParent(it.children, parentId, dragId, targetId) };
    return it;
  });
}

// ─── ItemNode ─────────────────────────────────────────────────────────────────

interface ItemNodeProps {
  item: TreeItem;
  parentId: string | null;
  canCollab: boolean;
  canEdit: boolean;
  editMode: boolean;
  multiParticipant: boolean;
  pendingDeletions: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, depth: number) => void;
  addingTo: { parentId: string; depth: number } | null;
  newItemText: string;
  onNewItemChange: (v: string) => void;
  onAddConfirm: () => void;
  onAddCancel: () => void;
  // Drag
  onDragStart: (id: string, parentId: string | null) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string, parentId: string | null) => void;
  onDragEnd: () => void;
  dragId: string | null;
  dragOverId: string | null;
}

function ItemNode({
  item, parentId, canCollab, canEdit, editMode, multiParticipant, pendingDeletions,
  onToggle, onDelete, onAddChild,
  addingTo, newItemText, onNewItemChange, onAddConfirm, onAddCancel,
  onDragStart, onDragOver, onDrop, onDragEnd, dragId, dragOverId,
}: ItemNodeProps) {
  const isPendingDeletion = pendingDeletions.has(item.id);
  const isDragging = dragId === item.id;
  const isDragOver = dragOverId === item.id && dragId !== item.id;

  const dragProps = editMode && canEdit ? {
    draggable: true,
    onDragStart: () => onDragStart(item.id, parentId),
    onDragOver: (e: React.DragEvent) => onDragOver(e, item.id),
    onDrop: () => onDrop(item.id, parentId),
    onDragEnd,
  } : {};

  if (item.isSection) {
    return (
      <div className={`mt-4 first:mt-0 transition-all ${isDragOver ? "ring-2 ring-amber-500 rounded-lg bg-amber-500/5" : ""}`} {...dragProps}>
        <div className={`flex items-center gap-2 mb-1 ${isDragging ? "opacity-40" : ""}`}>
          {editMode && canEdit && (
            <span className="text-slate-600 cursor-grab active:cursor-grabbing text-base select-none">⠿</span>
          )}
          <div className="w-1 h-5 rounded-full bg-amber-500/60 shrink-0" />
          <span className="text-sm font-semibold text-amber-300 uppercase tracking-wide">{item.text}</span>
        </div>
        <div className="ml-3 space-y-1 border-l border-slate-800 pl-3">
          {item.children.map((child) => (
            <ItemNode key={child.id} item={child} parentId={item.id}
              canCollab={canCollab} canEdit={canEdit} editMode={editMode} multiParticipant={multiParticipant} pendingDeletions={pendingDeletions}
              onToggle={onToggle} onDelete={onDelete} onAddChild={onAddChild}
              addingTo={addingTo} newItemText={newItemText} onNewItemChange={onNewItemChange} onAddConfirm={onAddConfirm} onAddCancel={onAddCancel}
              onDragStart={onDragStart} onDragOver={onDragOver} onDrop={(tid) => onDrop(tid, item.id)} onDragEnd={onDragEnd}
              dragId={dragId} dragOverId={dragOverId}
            />
          ))}
          {editMode && canEdit && addingTo?.parentId === item.id ? (
            <div className="flex gap-2 mt-1">
              <input autoFocus value={newItemText} onChange={(e) => onNewItemChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddConfirm(); } if (e.key === "Escape") onAddCancel(); }}
                placeholder="New task…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500" />
              <button onClick={onAddConfirm} className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">Add</button>
              <button onClick={onAddCancel} className="text-slate-500 text-xs">✕</button>
            </div>
          ) : editMode && canEdit ? (
            <button onClick={() => onAddChild(item.id, 1)} className="text-xs text-slate-600 hover:text-amber-400 transition-colors mt-1">+ task</button>
          ) : null}
        </div>
      </div>
    );
  }

  const isSubtask = item.depth >= 2;

  return (
    <div className={`${isSubtask ? "ml-4" : ""} transition-all ${isDragOver ? "border-t-2 border-amber-500" : ""}`}>
      <div className={`flex items-center gap-3 group py-0.5 ${isDragging ? "opacity-40" : ""}`} {...dragProps}>
        {editMode && canEdit && (
          <span className="text-slate-600 cursor-grab active:cursor-grabbing text-base select-none shrink-0">⠿</span>
        )}
        {canCollab ? (
          <input type="checkbox" checked={item.myDone} onChange={() => onToggle(item.id)}
            className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0" />
        ) : (
          <div className={`w-4 h-4 rounded border-2 shrink-0 ${item.myDone ? "border-amber-500 bg-amber-500/20" : "border-slate-600"}`} />
        )}
        <span className={`flex-1 text-sm ${isSubtask ? "text-slate-400" : "text-slate-300"} ${item.myDone ? "line-through text-slate-500" : ""}`}>
          {item.text}
        </span>
        {multiParticipant && !item.isSection && (
          <span className="text-xs text-slate-600 shrink-0">{item.doneCount}/{item.totalParticipants}</span>
        )}
        {editMode && canEdit && (
          isPendingDeletion ? (
            <span className="text-[10px] text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">⏳ pending</span>
          ) : (
            <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all">✕</button>
          )
        )}
      </div>

      {item.children.length > 0 && (
        <div className="ml-7 space-y-0.5 mt-0.5">
          {item.children.map((sub) => (
            <ItemNode key={sub.id} item={sub} parentId={item.id}
              canCollab={canCollab} canEdit={canEdit} editMode={editMode} multiParticipant={multiParticipant} pendingDeletions={pendingDeletions}
              onToggle={onToggle} onDelete={onDelete} onAddChild={onAddChild}
              addingTo={addingTo} newItemText={newItemText} onNewItemChange={onNewItemChange} onAddConfirm={onAddConfirm} onAddCancel={onAddCancel}
              onDragStart={onDragStart} onDragOver={onDragOver} onDrop={(tid) => onDrop(tid, item.id)} onDragEnd={onDragEnd}
              dragId={dragId} dragOverId={dragOverId}
            />
          ))}
          {editMode && canEdit && addingTo?.parentId === item.id && (
            <div className="flex gap-2 mt-1">
              <input autoFocus value={newItemText} onChange={(e) => onNewItemChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddConfirm(); } if (e.key === "Escape") onAddCancel(); }}
                placeholder="New subtask…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500" />
              <button onClick={onAddConfirm} className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">Add</button>
              <button onClick={onAddCancel} className="text-slate-500 text-xs">✕</button>
            </div>
          )}
        </div>
      )}

      {editMode && canEdit && !isSubtask && addingTo?.parentId !== item.id && (
        <button onClick={() => onAddChild(item.id, 2)} className="ml-7 text-xs text-slate-700 hover:text-amber-400 transition-colors">+ subtask</button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicProjectClient({
  checklistId, visibility, items: initialItems, leaderboard: initialLeaderboard,
  isOwner, isParticipant, isLoggedIn,
}: Props) {
  const [items, setItems] = useState<TreeItem[]>(initialItems);
  const [leaderboard] = useState(initialLeaderboard);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(isParticipant);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());

  // Add-item state
  const [addingTo, setAddingTo] = useState<{ parentId: string | null; depth: number } | null>(null);
  const [newItemText, setNewItemText] = useState("");

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const dragParentRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const canEdit = isOwner || (visibility === "PUBLIC_EDIT" && joined);
  const canCollab = joined && (visibility === "PUBLIC_COLLAB" || visibility === "PUBLIC_EDIT");
  const multiParticipant = leaderboard.length > 1;

  const totalCheckable = countCheckable(items);
  const myDone = countMyDone(items);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((id: string, parentId: string | null) => {
    dragIdRef.current = id;
    dragParentRef.current = parentId;
    setDragId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    dragParentRef.current = null;
    setDragId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((targetId: string, parentId: string | null) => {
    const fromId = dragIdRef.current;
    const fromParent = dragParentRef.current;
    handleDragEnd();
    if (!fromId || fromId === targetId) return;

    setItems((prev) => reorderAtParent(prev, fromParent, fromId, targetId));

    // Find the parent's children to get ordered IDs
    let list: TreeItem[];
    if (fromParent === null) {
      list = items;
    } else {
      const parent = findItem(items, fromParent);
      list = parent?.children ?? [];
    }
    const from = list.findIndex(i => i.id === fromId);
    const to = list.findIndex(i => i.id === targetId);
    const reordered = [...list];
    if (from === -1 || to === -1) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const orderedIds = reordered.map(i => i.id);

    fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorderItems", checklistId, orderedIds }),
    }).catch(() => {});
  }, [checklistId, handleDragEnd, items]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function join() {
    setJoining(true);
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", checklistId }),
    });
    setJoining(false);
    if (res.ok) setJoined(true);
  }

  async function copyTemplate() {
    setCopying(true);
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copyTemplate", checklistId }),
    });
    setCopying(false);
    if (res.ok) setCopied(true);
  }

  async function toggleItem(itemId: string) {
    setItems((prev) => toggleInTree(prev, itemId));
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleProgress", itemId }),
    });
    if (!res.ok) setItems((prev) => toggleInTree(prev, itemId));
  }

  async function deleteItem(itemId: string) {
    if (!confirm(isOwner ? "Delete this item? Its subtasks will also be removed." : "Request deletion of this item? The project owner will approve or reject.")) return;
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteItem", itemId }),
    });
    if (!res.ok) { window.location.reload(); return; }
    const data = await res.json();
    if (data.deleted) {
      // Owner deleted directly — remove from tree
      setItems((prev) => deleteFromTree(prev, itemId));
    } else if (data.requested) {
      // Non-owner — mark as pending, keep item visible
      setPendingDeletions((prev) => new Set(prev).add(itemId));
    }
  }

  function startAdd(parentId: string | null, depth: number) {
    setAddingTo({ parentId, depth });
    setNewItemText("");
  }

  async function confirmAdd() {
    if (!newItemText.trim() || !addingTo) return;
    const { parentId, depth } = addingTo;
    const res = await fetch("/api/checklists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addItem", checklistId, text: newItemText.trim(), parentId, depth }),
    });
    if (res.ok) {
      const item = await res.json();
      const newNode: TreeItem = {
        id: item.id, text: item.text, order: item.order,
        isSection: item.isSection ?? false, depth: item.depth ?? depth,
        doneCount: 0, totalParticipants: leaderboard.length,
        myDone: false, children: [],
      };
      setItems((prev) => addToTree(prev, parentId, newNode));
      setNewItemText(""); setAddingTo(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* My progress */}
      {joined && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-400">Your progress</span>
            <span className="text-sm text-amber-400">{myDone}/{totalCheckable}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-amber-500 h-2 rounded-full transition-all"
              style={{ width: `${totalCheckable ? Math.round((myDone / totalCheckable) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {visibility === "PUBLIC_TEMPLATE" && !isOwner && (
          isLoggedIn ? (
            <button onClick={copyTemplate} disabled={copying || copied}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-sm transition-colors">
              {copied ? "✓ Copied to your account!" : copying ? "Copying…" : "Use as template →"}
            </button>
          ) : (
            <Link href="/signup" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition-colors">
              Sign up to use this template →
            </Link>
          )
        )}

        {(visibility === "PUBLIC_COLLAB" || visibility === "PUBLIC_EDIT") && !isOwner && !joined && (
          isLoggedIn ? (
            <button onClick={join} disabled={joining}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-sm transition-colors">
              {joining ? "Joining…" : "Join this project →"}
            </button>
          ) : (
            <Link href="/signup" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition-colors">
              Sign up to join →
            </Link>
          )
        )}

        {/* Edit mode toggle — only for editors */}
        {canEdit && (
          <button
            onClick={() => setEditMode((e) => !e)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
              editMode
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
            }`}
          >
            {editMode ? "✓ Done editing" : "✎ Edit"}
          </button>
        )}
      </div>

      {/* Items tree */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-200 mb-4">Tasks</h2>
        <div className="space-y-1">
          {items.map((item) => (
            <ItemNode key={item.id} item={item} parentId={null}
              canCollab={canCollab} canEdit={canEdit} editMode={editMode} multiParticipant={multiParticipant} pendingDeletions={pendingDeletions}
              onToggle={toggleItem} onDelete={deleteItem}
              onAddChild={(parentId, depth) => startAdd(parentId, depth)}
              addingTo={addingTo?.parentId !== null && addingTo?.parentId !== undefined ? { parentId: addingTo.parentId!, depth: addingTo.depth } : null}
              newItemText={newItemText} onNewItemChange={setNewItemText}
              onAddConfirm={confirmAdd} onAddCancel={() => setAddingTo(null)}
              onDragStart={handleDragStart} onDragOver={handleDragOver}
              onDrop={(tid, pid) => handleDrop(tid, pid)} onDragEnd={handleDragEnd}
              dragId={dragId} dragOverId={dragOverId}
            />
          ))}

          {editMode && canEdit && addingTo?.parentId === null ? (
            <div className="flex gap-2 mt-3">
              <input autoFocus value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAdd(); } if (e.key === "Escape") setAddingTo(null); }}
                placeholder="New item…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500" />
              <button onClick={confirmAdd} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg">Add</button>
              <button onClick={() => setAddingTo(null)} className="text-slate-500 text-xs">✕</button>
            </div>
          ) : editMode && canEdit ? (
            <button onClick={() => startAdd(null, 1)} className="text-xs text-slate-500 hover:text-amber-400 mt-2 transition-colors">+ add item</button>
          ) : null}
        </div>
      </section>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (visibility === "PUBLIC_COLLAB" || visibility === "PUBLIC_EDIT") && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-200 mb-4">Participants</h2>
          <div className="space-y-2">
            {leaderboard.map((p, i) => {
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs w-5 text-right">{i + 1}</span>
                  <Link href={`/u/${p.username}`} className="text-sm text-slate-300 hover:text-amber-400 transition-colors w-28 truncate shrink-0">
                    {p.name}{p.isOwner && <span className="ml-1 text-xs text-slate-500">(owner)</span>}
                  </Link>
                  <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 w-16 text-right">{p.done}/{p.total} · {pct}%</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="text-center pt-2 border-t border-slate-800">
        <p className="text-slate-500 text-sm">Built with <Link href="/" className="text-amber-400 hover:text-amber-300">Streakboard</Link></p>
        <Link href="/signup" className="inline-block mt-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
          Create your own Streakboard →
        </Link>
      </div>
    </div>
  );
}
