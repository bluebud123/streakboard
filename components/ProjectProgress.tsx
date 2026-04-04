"use client";

import type { ChecklistData, TreeItem } from "./ChecklistSection";

interface Props {
  projects: (ChecklistData & { isOwner: boolean })[];
  expandedId: string | null;
  onSelect: (id: string) => void;
}

function countSection(items: TreeItem[]): { done: number; total: number } {
  let done = 0, total = 0;
  for (const it of items) {
    if (!it.isSection) { total++; if (it.progress[0]?.done) done++; }
    if (it.children?.length) {
      const s = countSection(it.children);
      done += s.done; total += s.total;
    }
  }
  return { done, total };
}

function countAll(items: TreeItem[]): { done: number; total: number } {
  return countSection(items);
}

export default function ProjectProgress({ projects, expandedId, onSelect }: Props) {
  const selected = projects.find((p) => p.id === expandedId) ?? null;
  const sections = selected?.items.filter((it) => it.isSection) ?? [];
  const hasUngrouped = selected?.items.some((it) => !it.isSection) ?? false;

  return (
    <div className="space-y-4">
      {/* All projects overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Project Progress</h3>
        {projects.length === 0 ? (
          <p className="text-xs text-slate-600 italic">No projects yet</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const { done, total } = countAll(p.items);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isActive = expandedId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`w-full text-left group transition-colors ${isActive ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium truncate max-w-[140px] ${isActive ? "text-amber-400" : "text-slate-300 group-hover:text-slate-100"}`}>
                      {p.name}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0 ml-2">
                      {total > 0 ? `${pct}%` : "—"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isActive ? "bg-amber-500" : "bg-amber-500/50 group-hover:bg-amber-500/70"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {total > 0 && (
                    <p className="text-xs text-slate-600 mt-0.5">{done}/{total} tasks</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected project breakdown */}
      {selected && (sections.length > 0 || hasUngrouped) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 truncate">{selected.name}</h3>
          <div className="space-y-3">
            {/* Ungrouped tasks (depth-1, not under a section) */}
            {hasUngrouped && (() => {
              const ungrouped = selected.items.filter((it) => !it.isSection);
              const { done, total } = countSection(ungrouped);
              if (total === 0) return null;
              const pct = Math.round((done / total) * 100);
              return (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 italic">General</span>
                    <span className="text-xs text-slate-500">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1">
                    <div className="bg-amber-500/60 h-1 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{done}/{total}</p>
                </div>
              );
            })()}

            {/* Per-section breakdown */}
            {sections.map((section) => {
              const { done, total } = countSection(section.children ?? []);
              if (total === 0) return null;
              const pct = Math.round((done / total) * 100);
              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-300 font-medium truncate max-w-[140px]" title={section.text}>{section.text}</span>
                    <span className="text-xs text-slate-500 shrink-0 ml-1">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{done}/{total} tasks</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
