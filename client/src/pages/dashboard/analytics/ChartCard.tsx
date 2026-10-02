import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  summary?: ReactNode;
  // Dims the card while new data loads (the previous chart stays visible)
  refreshing?: boolean;
  className?: string;
  // Rendered when the reader switches to the table view
  table?: ReactNode;
  children: ReactNode;
};

// A chart card with a "View as table" toggle, so every value is reachable
// without hovering
export default function ChartCard({
  title,
  summary,
  refreshing,
  className = "",
  table,
  children,
}: Props) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      className={`rounded-lg border border-gray-100 bg-white p-5 shadow-sm ${className}`}
      aria-busy={refreshing}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          {summary && <p className="mt-0.5 text-sm text-gray-500">{summary}</p>}
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
      <div className={`transition-opacity ${refreshing ? "opacity-60" : ""}`}>
        {showTable && table ? table : children}
      </div>
    </section>
  );
}
