import Link from "next/link";

interface Props {
  name: string;
  done: number;
  total: number;
  slug?: string | null;
  visibility?: string;
}

export default function ChecklistCard({ name, done, total, slug, visibility }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const visLabel: Record<string, string> = {
    PUBLIC_TEMPLATE: "Template",
    PUBLIC_COLLAB: "Collab",
    PUBLIC_EDIT: "Open Edit",
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1 min-w-0">
          {slug ? (
            <Link href={`/checklist/${slug}`} className="text-sm font-medium text-slate-200 hover:text-amber-400 transition-colors truncate block">
              {name}
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-200 truncate block">{name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {visibility && visLabel[visibility] && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
              {visLabel[visibility]}
            </span>
          )}
          <span className="text-xs text-slate-400">{done}/{total}</span>
        </div>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-xs text-slate-500 mt-1">{pct}%</div>
    </div>
  );
}
