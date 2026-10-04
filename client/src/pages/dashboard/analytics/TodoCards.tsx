import { LuCircleAlert, LuClock3 } from "react-icons/lu";
import type { ReturnedItem, WaitingItem } from "./types";

// How long an entry has waited: gray, then amber from 3 days, red from 7.
// The day count is always written out, so color is never the only cue.
const AGE_BADGES = [
  { from: 7, className: "bg-red-50 text-red-700", Icon: LuCircleAlert, note: "waiting a long time" },
  { from: 3, className: "bg-amber-50 text-amber-700", Icon: LuClock3, note: "overdue" },
  { from: 0, className: "bg-gray-100 text-gray-600", Icon: null, note: null },
];

const daysLabel = (days: number) =>
  days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;

const ago = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

const initials = (name: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function Avatar({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700"
    >
      {initials(name)}
    </span>
  );
}

function AgeBadge({ days, since }: { days: number; since: string }) {
  const { className, Icon, note } = AGE_BADGES.find((b) => days >= b.from)!;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${className}`}
      title={`Waiting since ${new Date(since).toLocaleString()}`}
    >
      {Icon && <Icon aria-hidden className="h-3.5 w-3.5" />}
      {daysLabel(days)}
      {note && <span className="sr-only">({note})</span>}
    </span>
  );
}

// "Oldest: 12 days", in the color of its age
export function OldestWaiting({ days }: { days: number }) {
  const { className } = AGE_BADGES.find((b) => days >= b.from)!;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      Oldest: {daysLabel(days).toLowerCase()}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-full min-h-[120px] items-center justify-center text-center text-sm text-gray-400">
      {children}
    </p>
  );
}

// Approvers and admins: what's waiting at a level they may approve, oldest first
export function WaitingList({
  items,
  onOpen,
}: {
  items: WaitingItem[];
  onOpen: (id: number) => void;
}) {
  if (items.length === 0) return <Empty>You're all caught up. Nothing is waiting for you.</Empty>;
  return (
    <ul className="-mx-2 divide-y divide-gray-100">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Avatar name={item.requested_by} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-800" title={item.form_name}>
                {item.form_name}
              </span>
              <span className="block truncate text-xs text-gray-500">
                #{item.id}
                {item.requested_by && ` · ${item.requested_by}`} · {item.level_label}
                {item.area && ` · ${item.area}`}
              </span>
            </span>
            <AgeBadge days={item.days_waiting} since={item.waiting_since} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// Returned for corrections: the requestor's own entries ("Fix"), or for
// approvers and admins, every returned entry they may see ("Open")
export function ReturnedList({
  items,
  mine,
  onOpen,
}: {
  items: ReturnedItem[];
  mine: boolean;
  onOpen: (id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <Empty>
        {mine ? "Nothing has been returned to you." : "No entries are waiting for corrections."}
      </Empty>
    );
  }
  return (
    <ul className="-mx-2 divide-y divide-gray-100">
      {items.map((item) => {
        const when = ago(item.returned_at);
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="w-full rounded-md px-2 py-2.5 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-gray-800" title={item.form_name}>
                  {item.form_name}
                </span>
                <span className="shrink-0 text-xs font-medium text-blue-600">
                  {mine ? "Fix →" : "Open →"}
                </span>
              </span>
              <span className="block truncate text-xs text-gray-500">
                #{item.id}
                {!mine && item.requested_by && ` · ${item.requested_by}`}
                {item.level_label && ` · returned at ${item.level_label}`}
                {item.returned_by && ` by ${item.returned_by}`}
                {when && ` · ${when}`}
              </span>
              {item.remarks && (
                <span className="mt-1.5 line-clamp-2 block border-l-2 border-orange-300 bg-orange-50/60 py-1 pr-2 pl-2 text-xs text-gray-700">
                  {item.remarks}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
