"use client";

interface Cell {
  date: string;
  level: 0 | 1 | 2 | 3;
  minutes: number;
}

const levelClass = ["heatmap-l0", "heatmap-l1", "heatmap-l2", "heatmap-l3"];
const levelLabel = ["No activity", "< 30 min", "30–60 min", "60+ min"];

export default function Heatmap({ cells }: { cells: Cell[] }) {
  // cells is 140 items (20 weeks × 7 days), oldest first
  // We need to pad so the first cell starts on Monday
  const firstDate = cells[0]?.date ? new Date(cells[0].date + "T00:00:00") : new Date();
  // 0=Sun,1=Mon,...,6=Sat → convert to Mon-based: (day + 6) % 7
  const offset = (firstDate.getDay() + 6) % 7;
  const padded: (Cell | null)[] = [...Array(offset).fill(null), ...cells];

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="w-full">
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col justify-around text-xs text-slate-500 pr-1" style={{ minWidth: 28 }}>
          {dayLabels.map((d) => (
            <span key={d} className="leading-none" style={{ height: 14 }}>{d}</span>
          ))}
        </div>

        {/* Grid: 20 columns (weeks) × 7 rows (days) */}
        <div
          className="flex-1 grid gap-1"
          style={{ gridTemplateColumns: "repeat(20, 1fr)", gridTemplateRows: "repeat(7, 1fr)" }}
        >
          {padded.map((cell, i) =>
            cell === null ? (
              <div key={`pad-${i}`} className="aspect-square" />
            ) : (
              <div
                key={cell.date}
                title={`${cell.date}${cell.minutes ? ` · ${cell.minutes} min` : ""}`}
                className={`aspect-square rounded-sm ${levelClass[cell.level]} transition-all duration-100 hover:ring-1 hover:ring-amber-400/60 hover:scale-110 hover:z-10`}
              />
            )
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 justify-end text-xs text-slate-500">
        <span>Less</span>
        {[0, 1, 2, 3].map((l) => (
          <div
            key={l}
            title={levelLabel[l]}
            className={`w-3 h-3 rounded-sm ${levelClass[l]}`}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
