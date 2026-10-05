import { STATUS_LABELS, statusBadgeClass } from "@/lib/entryStatuses";
import type { RecentEntry } from "./types";

// "Today", "Yesterday", or the date
const whenCreated = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// The newest entries the user may see; a row opens the entry
export default function RecentEntries({
  entries,
  mine,
  onOpen,
}: {
  entries: RecentEntry[];
  // A requestor's own entries: no "Created by" column
  mine: boolean;
  onOpen: (id: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="flex min-h-[120px] items-center justify-center text-sm text-gray-400">
        No form entries yet.
      </p>
    );
  }
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="px-2 py-2 font-medium">Entry</th>
            <th className="px-2 py-2 font-medium">Form</th>
            <th className="hidden px-2 py-2 font-medium sm:table-cell">Area</th>
            {!mine && <th className="hidden px-2 py-2 font-medium md:table-cell">Created by</th>}
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Created</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              tabIndex={0}
              onClick={() => onOpen(entry.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(entry.id);
                }
              }}
              className="cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <td className="px-2 py-2.5 text-gray-500 tabular-nums">#{entry.id}</td>
              <td className="max-w-[10rem] truncate px-2 sm:max-w-[18rem] py-2.5 font-medium text-gray-800" title={entry.form_name}>
                {entry.form_name}
              </td>
              <td className="hidden px-2 py-2.5 text-gray-500 sm:table-cell">{entry.area || "—"}</td>
              {!mine && (
                <td className="hidden whitespace-nowrap px-2 py-2.5 text-gray-500 md:table-cell">
                  {entry.requested_by ?? "—"}
                </td>
              )}
              <td className="px-2 py-2.5">
                <span
                  className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(entry.status)}`}
                >
                  {STATUS_LABELS[entry.status] ?? entry.status}
                </span>
              </td>
              <td className="hidden whitespace-nowrap px-2 py-2.5 text-right text-gray-500 sm:table-cell">
                {whenCreated(entry.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
