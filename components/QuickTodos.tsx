"use client";

// Quick Todos: a local-first scratch list under the Log Today widget.
//
// Design principles:
//   • Zero-latency add/edit/delete — all mutations hit localStorage instantly
//     and render synchronously.
//   • Background server sync — a debounced POST runs 1.5s after the last
//     change (or on blur / tab hide / before unload) to persist to DB so
//     the list survives a new device.
//   • Conflict strategy: "last client write wins". We attach the device's
//     local copy on GET merge: anything present locally but newer than the
//     server copy (by updatedAt) stays; anything server-only gets added.
//
// ✕ is always visible (mobile has no hover). Text is tap-to-edit.
// Completed todos collapse under a "Done (n)" toggle so the active list
// stays short.

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

interface Todo {
  id: string;
  text: string;
  done: boolean;
  order: number;
  updatedAt: number; // ms epoch, tracked locally for merge
  /** Not sent to server; used to mark pending deletions until the next sync. */
  deleted?: boolean;
}

const STORAGE_KEY = "streakboard:quickTodos:v1";
const SYNC_DEBOUNCE_MS = 1500;
const MAX_TEXT_LEN = 500;

// Lightweight cuid-ish id — collision-safe enough for per-user scope.
function makeId(): string {
  return "qt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function loadLocal(): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.id === "string") : [];
  } catch {
    return [];
  }
}

function saveLocal(todos: Todo[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // Quota exceeded or private mode — silently ignore; server sync still works.
  }
}

export default function QuickTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [showDone, setShowDone] = useState(false);
  const dirtyRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  // Hydrate from localStorage, then merge in anything server has that we don't.
  useEffect(() => {
    const local = loadLocal();
    setTodos(local);
    (async () => {
      try {
        const res = await fetch("/api/quick-todos", { cache: "no-store" });
        if (!res.ok) return;
        const { todos: server } = (await res.json()) as {
          todos: Array<{ id: string; text: string; done: boolean; order: number; updatedAt: string }>;
        };
        setTodos((current) => {
          // Merge by id: server rows missing locally get added; server rows
          // that differ from local keep the newer-by-updatedAt copy.
          const byId = new Map<string, Todo>();
          for (const t of current) byId.set(t.id, t);
          for (const s of server) {
            const sTime = new Date(s.updatedAt).getTime();
            const local = byId.get(s.id);
            if (!local) {
              byId.set(s.id, {
                id: s.id,
                text: s.text,
                done: s.done,
                order: s.order,
                updatedAt: sTime,
              });
            } else if (!local.deleted && sTime > local.updatedAt) {
              byId.set(s.id, { ...local, text: s.text, done: s.done, order: s.order, updatedAt: sTime });
            }
          }
          const merged = Array.from(byId.values()).filter((t) => !t.deleted);
          saveLocal(merged);
          return merged;
        });
      } catch {
        // Offline → stay on local copy
      }
    })();
  }, []);

  // Debounced background sync — POSTs the current dirty state to the server.
  const scheduleSync = useCallback(() => {
    dirtyRef.current = true;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void flushSync();
    }, SYNC_DEBOUNCE_MS);
  }, []);

  const flushSync = useCallback(async () => {
    if (inFlightRef.current || !dirtyRef.current) return;
    inFlightRef.current = true;
    // Clear the dirty flag BEFORE the network call. Any mutation that lands
    // during the in-flight window will re-set it, and we'll re-flush in the
    // `finally` block. Without this, rapid adds during a sync get overwritten
    // when we saveLocal(kept) below.
    dirtyRef.current = false;
    setSyncStatus("syncing");
    const payload = loadLocal(); // snapshot at send time (includes tombstones)
    const sentTombstoneIds = new Set(payload.filter((t) => t.deleted).map((t) => t.id));
    try {
      const res = await fetch("/api/quick-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todos: payload.map((t) => ({
            id: t.id,
            text: t.text,
            done: t.done,
            order: t.order,
            deleted: t.deleted ?? false,
          })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // Re-read localStorage — the user may have added/edited/deleted during
      // the fetch. Only strip the tombstones that WE just acked with the
      // server; everything else (new adds, fresh edits) stays intact.
      const latest = loadLocal();
      const kept = latest.filter((t) => !(t.deleted && sentTombstoneIds.has(t.id)));
      saveLocal(kept);
      setTodos(kept.filter((t) => !t.deleted));
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus((s) => (s === "synced" ? "idle" : s)), 1500);
    } catch {
      // Network hiccup — re-mark dirty so the next scheduled flush retries.
      dirtyRef.current = true;
      setSyncStatus("error");
    } finally {
      inFlightRef.current = false;
      // If mutations happened while we were in flight, chain another flush
      // quickly so the new items reach the server.
      if (dirtyRef.current) {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => void flushSync(), 300);
      }
    }
  }, []);

  // Flush on tab hide / before unload so nothing goes to /dev/null.
  useEffect(() => {
    function onHide() {
      if (dirtyRef.current) void flushSync();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flushSync]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  function mutate(next: Todo[]) {
    saveLocal(next);
    setTodos(next.filter((t) => !t.deleted));
    scheduleSync();
  }

  function addTodo() {
    const text = input.trim();
    if (!text) return;
    if (text.length > MAX_TEXT_LEN) {
      toast.error("Todo text is too long");
      return;
    }
    const now = Date.now();
    const maxOrder = todos.reduce((m, t) => Math.max(m, t.order), 0);
    const next: Todo = { id: makeId(), text, done: false, order: maxOrder + 1, updatedAt: now };
    mutate([...loadLocal(), next]);
    setInput("");
  }

  function toggleDone(id: string) {
    const list = loadLocal();
    mutate(list.map((t) => (t.id === id ? { ...t, done: !t.done, updatedAt: Date.now() } : t)));
  }

  function deleteTodo(id: string) {
    const list = loadLocal();
    // Tombstone so the sync can tell the server, then real-remove after sync.
    mutate(list.map((t) => (t.id === id ? { ...t, deleted: true, updatedAt: Date.now() } : t)));
  }

  function startEdit(t: Todo) {
    setEditingId(t.id);
    setEditingText(t.text);
  }

  function saveEdit() {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      deleteTodo(editingId);
      setEditingId(null);
      return;
    }
    const list = loadLocal();
    mutate(list.map((t) => (t.id === editingId ? { ...t, text: text.slice(0, MAX_TEXT_LEN), updatedAt: Date.now() } : t)));
    setEditingId(null);
    setEditingText("");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const active = todos.filter((t) => !t.done).sort((a, b) => a.order - b.order);
  const done = todos.filter((t) => t.done).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Quick Todos
        </h3>
        <span
          className={`text-[10px] font-semibold transition-colors ${
            syncStatus === "syncing" ? "text-slate-500" :
            syncStatus === "error" ? "text-red-400" :
            syncStatus === "synced" ? "text-emerald-400" :
            "text-slate-600"
          }`}
          title={syncStatus === "error" ? "Offline — saved locally" : "Synced across your devices"}
        >
          {syncStatus === "syncing" && "saving…"}
          {syncStatus === "synced" && "✓ saved"}
          {syncStatus === "error" && "offline"}
          {syncStatus === "idle" && ""}
        </span>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); addTodo(); }}
        className="flex gap-2 mb-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Quick todo… (Enter to add)"
          maxLength={MAX_TEXT_LEN}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 text-xs font-black rounded-lg transition-all min-w-[44px] min-h-[40px]"
          aria-label="Add todo"
        >+</button>
      </form>

      {active.length === 0 && done.length === 0 ? (
        <p className="text-xs text-slate-600 italic text-center py-2">
          Drop a miscellaneous task here — it stays on your device and syncs quietly.
        </p>
      ) : (
        <ul className="space-y-1">
          {active.map((t) => (
            <QuickTodoRow
              key={t.id}
              todo={t}
              editing={editingId === t.id}
              editingText={editingText}
              onToggle={() => toggleDone(t.id)}
              onStartEdit={() => startEdit(t)}
              onChangeEdit={setEditingText}
              onSaveEdit={saveEdit}
              onCancelEdit={() => { setEditingId(null); setEditingText(""); }}
              onDelete={() => deleteTodo(t.id)}
            />
          ))}
          {done.length > 0 && (
            <li className="pt-1">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="w-full flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest pt-2 pb-1 transition-colors"
                aria-expanded={showDone}
              >
                <span className={`inline-block transition-transform ${showDone ? "rotate-90" : ""}`}>▸</span>
                <span>Done ({done.length})</span>
              </button>
            </li>
          )}
          {showDone && done.map((t) => (
            <QuickTodoRow
              key={t.id}
              todo={t}
              editing={false}
              editingText=""
              onToggle={() => toggleDone(t.id)}
              onStartEdit={() => {}}
              onChangeEdit={() => {}}
              onSaveEdit={() => {}}
              onCancelEdit={() => {}}
              onDelete={() => deleteTodo(t.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickTodoRow({
  todo, editing, editingText, onToggle, onStartEdit, onChangeEdit,
  onSaveEdit, onCancelEdit, onDelete,
}: {
  todo: Todo;
  editing: boolean;
  editingText: string;
  onToggle: () => void;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2 group py-1 px-1 rounded-lg hover:bg-slate-800/40 transition-colors">
      <label className="relative flex items-center justify-center w-11 h-11 sm:w-5 sm:h-5 shrink-0 cursor-pointer -my-2 sm:my-0 -mx-1.5 sm:mx-0">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={onToggle}
          className="w-5 h-5 rounded-lg accent-amber-500 cursor-pointer"
        />
      </label>
      {editing ? (
        <input
          autoFocus
          value={editingText}
          onChange={(e) => onChangeEdit(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onSaveEdit(); }
            if (e.key === "Escape") onCancelEdit();
          }}
          maxLength={MAX_TEXT_LEN}
          className="flex-1 bg-slate-800 border border-amber-500 rounded-lg px-2 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/30"
        />
      ) : (
        <span
          onClick={onStartEdit}
          className={`flex-1 text-sm cursor-text select-none ${todo.done ? "line-through text-slate-500" : "text-slate-200"}`}
        >
          {todo.text}
        </span>
      )}
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="text-slate-500 hover:text-red-400 active:text-red-400 text-sm px-2 py-2 transition-colors min-w-[36px] min-h-[36px] shrink-0"
      >✕</button>
    </li>
  );
}
