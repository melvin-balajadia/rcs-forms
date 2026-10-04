import { useState, type ReactNode } from "react";
import type { IconType } from "react-icons";

// Icon badge colors, one per card, so cards are easy to tell apart at a glance
const ACCENTS = {
  green: "bg-green-50 text-green-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  indigo: "bg-indigo-50 text-indigo-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
} as const;

type Props = {
  icon: IconType;
  accent: keyof typeof ACCENTS;
  title: string;
  // Whether the card follows the date filter ("period"), shows what's open
  // right now ("now"), or the newest records ("latest")
  timeframe: "period" | "now" | "latest";
  // The card's headline number, and what it counts
  metric?: number;
  metricLabel?: string;
  // A second, smaller fact next to the headline (e.g. "Oldest: 12 days")
  aside?: ReactNode;
  // Dims the card while new data loads (the previous data stays visible)
  refreshing?: boolean;
  className?: string;
  // Rendered when the reader switches to the table view
  table?: ReactNode;
  // Pinned to the bottom of the card (links such as "View all")
  footer?: ReactNode;
  children: ReactNode;
};

const TIMEFRAME = {
  period: { label: "Selected period", className: "bg-gray-100 text-gray-600" },
  now: { label: "Right now", className: "bg-emerald-50 text-emerald-700" },
  latest: { label: "Most recent", className: "bg-gray-100 text-gray-600" },
};

// Every dashboard card: icon badge, title, timeframe pill, headline number,
// then the visual. Cards stretch to the height of their row, with the footer
// at the bottom.
export default function ChartCard({
  icon: Icon,
  accent,
  title,
  timeframe,
  metric,
  metricLabel,
  aside,
  refreshing,
  className = "",
  table,
  footer,
  children,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const tf = TIMEFRAME[timeframe];

  return (
    <section
      className={`flex min-w-0 flex-col rounded-xl border border-gray-200/70 bg-white p-5 shadow-sm ${className}`}
      aria-busy={refreshing}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ACCENTS[accent]}`}>
            <Icon aria-hidden className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-800">{title}</h3>
            <span
              className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium ${tf.className}`}
            >
              {timeframe === "now" && (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
              {tf.label}
            </span>
          </div>
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {showTable ? "View as chart" : "View as table"}
          </button>
        )}
      </div>

      {metric !== undefined && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
            {metric.toLocaleString()}
          </span>
          {metricLabel && <span className="text-sm text-gray-500">{metricLabel}</span>}
          {aside && <span className="ml-auto text-sm">{aside}</span>}
        </div>
      )}

      <div className={`mt-4 flex-1 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
        {showTable && table ? table : children}
      </div>

      {footer && <div className="mt-4 border-t border-gray-100 pt-3">{footer}</div>}
    </section>
  );
}

// A footer link such as "View all 12 →"
export function CardLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-blue-600 hover:text-blue-800"
    >
      {children} →
    </button>
  );
}
