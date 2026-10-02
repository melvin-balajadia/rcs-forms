import { useState } from "react";
import { SINGLE_SERIES } from "./theme";
import type { FormCount } from "./types";

const TOP_N = 8;

type Props = {
  forms: FormCount[];
  // Opens the entries of one form
  onDrill: (formId: number) => void;
};

// Entries per form as a ranked list: the full form name and its count on one
// line, a thin bar beneath. No axis or gridlines — the only number on screen
// is each form's count, and the longest bar is always the top form.
export default function EntriesByFormChart({ forms, onDrill }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (forms.length === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-gray-600">No entries in this period</p>
        <p className="mt-1 text-sm text-gray-400">
          Try a longer date range or another area.
        </p>
      </div>
    );
  }

  const max = forms[0].count; // sorted most first
  const rows = showAll ? forms : forms.slice(0, TOP_N);
  const hiddenCount = forms.length - rows.length;

  return (
    <div>
      <ol className="space-y-1">
        {rows.map((form, i) => (
          <li key={form.form_id}>
            <button
              type="button"
              onClick={() => onDrill(form.form_id)}
              title={`View the ${form.count} ${form.count === 1 ? "entry" : "entries"} for ${form.form_name}`}
              className="group w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm text-gray-700 group-hover:text-gray-900">
                  <span className="mr-1.5 text-gray-400 tabular-nums">{i + 1}.</span>
                  {form.form_name}
                </span>
                <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
                  {form.count}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-100" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (form.count / max) * 100)}%`,
                    background: SINGLE_SERIES,
                  }}
                />
              </div>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-2 flex items-center justify-between px-2 text-xs text-gray-400">
        <span>Click a form to open its entries.</span>
        {forms.length > TOP_N && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            {showAll ? `Show top ${TOP_N}` : `Show ${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
}
