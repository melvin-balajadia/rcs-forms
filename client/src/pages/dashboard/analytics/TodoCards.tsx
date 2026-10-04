import { useNavigate } from "react-router-dom";
import { LuClock3 } from "react-icons/lu";
import { AWAITING_ANY_LEVEL } from "@/lib/entryStatuses";
import type { DashboardTodo, ReturnedItem, WaitingItem } from "./types";

// Entries waiting this long get the "overdue" treatment (amber + clock icon)
const OVERDUE_DAYS = 3;

const daysLabel = (days: number) =>
  days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;

const ago = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

type Scope = { site: string | null; area: DashboardTodo["area"] };

const listLink = (params: Record<string, string | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  return `/form-entry?${search}`;
};

function Card({
  title,
  summary,
  footer,
  children,
}: {
  title: string;
  summary: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      <p className="mt-0.5 text-sm text-gray-500">{summary}</p>
      <div className="mt-3">{children}</div>
      {footer && <div className="mt-3 border-t border-gray-100 pt-3">{footer}</div>}
    </section>
  );
}

// Approvers and admins: what's waiting at a level they may approve, oldest first
export function WaitingCard({
  data,
  scope,
}: {
  data: NonNullable<DashboardTodo["waiting"]>;
  scope: Scope;
}) {
  const navigate = useNavigate();
  const viewAll = listLink({
    status: AWAITING_ANY_LEVEL,
    site: scope.site,
    area: scope.area === "All" ? null : scope.area,
  });

  return (
    <Card
      title="Waiting for your approval"
      summary={
        data.total === 0
          ? "You're all caught up."
          : `${data.total} ${data.total === 1 ? "entry is" : "entries are"} waiting, oldest first`
      }
      footer={
        data.total > 0 && (
          <button
            type="button"
            onClick={() => navigate(viewAll)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {data.total > data.items.length ? `View all ${data.total}` : "Open in Form Entries"} →
          </button>
        )
      }
    >
      {data.total === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          Nothing is waiting for your approval.
        </p>
      ) : (
        <ul className="space-y-1">
          {data.items.map((item) => (
            <WaitingRow
              key={item.id}
              item={item}
              onOpen={() => navigate(`/form-entry/edit/${item.id}`)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function WaitingRow({ item, onOpen }: { item: WaitingItem; onOpen: () => void }) {
  const overdue = item.days_waiting >= OVERDUE_DAYS;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-800" title={item.form_name}>
            {item.form_name}
          </span>
          <span className="block truncate text-xs text-gray-500">
            #{item.id}
            {item.requested_by && ` · ${item.requested_by}`} · {item.level_label}
            {item.area && ` · ${item.area}`}
          </span>
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
            overdue ? "text-amber-700" : "text-gray-500"
          }`}
          title={`Waiting since ${new Date(item.waiting_since).toLocaleString()}`}
        >
          {overdue && <LuClock3 aria-hidden className="h-3.5 w-3.5" />}
          {daysLabel(item.days_waiting)}
          {overdue && <span className="sr-only">(waiting a long time)</span>}
        </span>
      </button>
    </li>
  );
}

// Requestors (and anyone with returned entries): what needs their corrections
export function ReturnedCard({
  data,
  scope,
}: {
  data: NonNullable<DashboardTodo["returned"]>;
  scope: Scope;
}) {
  const navigate = useNavigate();
  const viewAll = listLink({
    status: "returned",
    site: scope.site,
    area: scope.area === "All" ? null : scope.area,
  });

  return (
    <Card
      title="My returned entries"
      summary={
        data.total === 0
          ? "Nothing has been returned to you."
          : `${data.total} ${data.total === 1 ? "entry needs" : "entries need"} your corrections`
      }
      footer={
        data.total > 0 && (
          <button
            type="button"
            onClick={() => navigate(viewAll)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {data.total > data.items.length ? `View all ${data.total}` : "Open in Form Entries"} →
          </button>
        )
      }
    >
      {data.total === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          No entries are waiting for your corrections.
        </p>
      ) : (
        <ul className="space-y-1">
          {data.items.map((item) => (
            <ReturnedRow
              key={item.id}
              item={item}
              onOpen={() => navigate(`/form-entry/edit/${item.id}`)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReturnedRow({ item, onOpen }: { item: ReturnedItem; onOpen: () => void }) {
  const when = ago(item.returned_at);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-md px-2 py-2 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-gray-800" title={item.form_name}>
            {item.form_name}
          </span>
          <span className="shrink-0 text-xs font-medium text-blue-600">Fix →</span>
        </span>
        <span className="block truncate text-xs text-gray-500">
          #{item.id}
          {item.level_label && ` · returned at ${item.level_label}`}
          {item.returned_by && ` by ${item.returned_by}`}
          {when && ` · ${when}`}
        </span>
        {item.remarks && (
          <span className="mt-1 line-clamp-2 block text-xs text-gray-700">
            “{item.remarks}”
          </span>
        )}
      </button>
    </li>
  );
}
