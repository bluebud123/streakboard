"use client";

import { useRef, useState } from "react";

interface Props {
  onImported: (checklist: unknown) => void;
}

const TEMPLATE = `# My Study Checklist

## Topic 1
- [ ] First item to complete
- [ ] Second item

## Topic 2
- [ ] Another item
- [ ] And one more
`;

export default function ChecklistImport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);

  async function upload(file: File) {
    setLoading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/checklists/import", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Import failed"); return; }
    onImported(data);
  }

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragging ? "border-amber-500 bg-amber-500/5" : "border-slate-700 hover:border-slate-500"}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
      >
        <input ref={inputRef} type="file" accept=".md,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        {loading ? (
          <p className="text-slate-400 text-sm">Importing…</p>
        ) : (
          <>
            <p className="text-slate-300 text-sm font-medium">Drop a .md or .txt file here</p>
            <p className="text-slate-500 text-xs mt-1">or click to browse</p>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="button"
        onClick={() => setShowTemplate((v) => !v)}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {showTemplate ? "Hide template" : "Show file template ↓"}
      </button>

      {showTemplate && (
        <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 overflow-auto whitespace-pre">
          {TEMPLATE}
        </pre>
      )}
    </div>
  );
}
