"use client";

// Promise-based replacement for window.confirm() — renders our own styled
// dialog instead of the browser's native "streakboard.com says …" popup.
// Usage:
//   import { confirm } from "@/lib/confirm";
//   if (!(await confirm({ message: "Delete this?", destructive: true }))) return;
//
// Mount <ConfirmHost /> once at the app root so it can overlay every page.
import { useEffect, useState } from "react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

let resolver: ((v: boolean) => void) | null = null;
let setter: ((o: ConfirmOptions | null) => void) | null = null;

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  // Fallback to the native dialog if the host hasn't mounted yet (e.g. very
  // early in hydration or in server-rendered contexts). This keeps call
  // sites safe even if someone forgets to mount <ConfirmHost />.
  if (!setter) {
    if (typeof window !== "undefined") return Promise.resolve(window.confirm(opts.message));
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    // If a dialog is already open, reject the previous promise first.
    if (resolver) resolver(false);
    resolver = resolve;
    setter!(opts);
  });
}

export function ConfirmHost() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  useEffect(() => {
    setter = setOpts;
    return () => {
      setter = null;
    };
  }, []);

  useEffect(() => {
    if (!opts) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  function close(v: boolean) {
    resolver?.(v);
    resolver = null;
    setOpts(null);
  }

  if (!opts) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      style={{ animation: "fadeIn 120ms ease-out" }}
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl"
        style={{ animation: "popIn 160ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      >
        {opts.title && (
          <h3 className="text-base font-bold text-slate-100 mb-2">{opts.title}</h3>
        )}
        <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
          {opts.message}
        </p>
        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={() => close(false)}
            className="px-3.5 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            {opts.cancelText ?? "Cancel"}
          </button>
          <button
            autoFocus
            onClick={() => close(true)}
            className={`px-3.5 py-1.5 text-sm rounded-lg font-semibold transition-colors ${
              opts.destructive
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-amber-500 hover:bg-amber-400 text-slate-950"
            }`}
          >
            {opts.confirmText ?? "Confirm"}
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
