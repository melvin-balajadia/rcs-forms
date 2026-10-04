import { SINGLE_SERIES } from "./theme";

export type BarListItem = {
  key: string | number;
  label: string;
  count: number;
  // Hover text describing what a click opens
  title: string;
  onClick: () => void;
};

type Props = {
  items: BarListItem[];
  // Prefix each row with its rank (1., 2., …) — for lists sorted most first
  ranked?: boolean;
  // The count that fills a whole bar (default: the largest count)
  max?: number;
  color?: string;
  // In a wide card, flow the list into two columns (1–4 left, 5–8 right)
  twoColumns?: boolean;
};

// The dashboard's list visual: a label and its count on one line, a thin bar
// beneath. No axis or gridlines — the only number on screen is each count.
export default function BarList({
  items,
  ranked = false,
  max,
  color = SINGLE_SERIES,
  twoColumns = false,
}: Props) {
  const full = max ?? Math.max(1, ...items.map((i) => i.count));
  return (
    <ol className={twoColumns ? "md:columns-2 md:gap-x-8" : ""}>
      {items.map((item, i) => (
        <li key={item.key} className="mb-1 break-inside-avoid">
          <button
            type="button"
            onClick={item.onClick}
            title={item.title}
            className="group w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm text-gray-700 group-hover:text-gray-900">
                {ranked && (
                  <span className="mr-1.5 inline-block min-w-[1.25rem] text-gray-400 tabular-nums">
                    {i + 1}.
                  </span>
                )}
                {item.label}
              </span>
              <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
                {item.count}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-100" aria-hidden>
              {item.count > 0 && (
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (item.count / full) * 100)}%`,
                    background: color,
                  }}
                />
              )}
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

// Shown in place of a list with nothing in it
export function EmptyList({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-1 text-sm text-gray-400">{hint}</p>
    </div>
  );
}
