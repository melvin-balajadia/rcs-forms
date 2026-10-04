import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { LuNotebookPen } from "react-icons/lu";
import PageHeader from "@/components/page-header";
import PageTable from "@/components/comp-485";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ActionButton from "@/components/action-button";
import { useArchive, useCanArchive } from "@/services/useArchive";
import { apiGet } from "@/services/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AWAITING_ANY_LEVEL } from "@/lib/entryStatuses";

type FormEntry = {
  id: string;
  user_id: string;
  form_id: string;
  form_entry_site: string;
  form_entry_area: string;
  form_entry_date: string | null;
  form_entry_status: string; // ✅ Changed from status to form_entry_status
  User?: {
    id: string;
    user_username: string;
    user_email: string;
    user_firstname: string;
    user_lastname: string;
  };
  Form?: {
    id: string;
    form_name: string;
  };
};

type APIResponse = {
  message: string;
  total: number;
  entries: FormEntry[];
};

// ✅ Filter by username + form name
const multiColumnFilterFn: FilterFn<FormEntry> = (
  row,
  _columnId,
  filterValue,
) => {
  const searchableContent = `
    ${row.original.User?.user_username ?? ""}
    ${row.original.Form?.form_name ?? ""}
  `.toLowerCase();

  return searchableContent.includes((filterValue ?? "").toLowerCase());
};

// ✅ Helper function to get status badge styling
// ✅ Helper function to get status badge styling
const getStatusBadgeClass = (status: string): string => {
  const baseClass = "px-2 py-1 rounded-md text-xs font-medium";

  switch (status) {
    case "draft":
      return `${baseClass} bg-gray-100 text-gray-800`;
    case "pending":
      return `${baseClass} bg-yellow-100 text-yellow-800`;
    case "returned":
      return `${baseClass} bg-orange-100 text-orange-800`;
    case "submitted_first":
    case "approved_first":
    case "submitted_second":
    case "approved_second":
    case "submitted_third":
      return `${baseClass} bg-blue-100 text-blue-800`;
    case "completed":
      return `${baseClass} bg-green-100 text-green-800`;
    case "rejected":
      return `${baseClass} bg-red-100 text-red-800`;
    default:
      return `${baseClass} bg-gray-100 text-gray-800`;
  }
};

// ✅ Helper function to format status for display
const formatStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: "Draft",
    pending: "Pending Submission",
    returned: "Returned for Correction",
    submitted_first: "Awaiting 1st Approval",
    approved_first: "Awaiting 2nd Approval",
    submitted_second: "Awaiting 2nd Approval",
    approved_second: "Awaiting 3rd Approval",
    submitted_third: "Awaiting 3rd Approval",
    completed: "Completed",
    rejected: "Rejected",
  };
  return statusMap[status] || status;
};

// ✅ Status filter options — some display labels map to more than one
// underlying status value (e.g. "Awaiting 2nd Approval" covers both
// approved_first and submitted_second), so values can be comma-separated.
const STATUS_FILTER_OPTIONS = [
  { label: "All Statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending Submission", value: "pending" },
  { label: "Returned for Correction", value: "returned" },
  // Used by the dashboard's "Waiting for your approval" link
  { label: "Awaiting Approval (any level)", value: AWAITING_ANY_LEVEL },
  { label: "Awaiting 1st Approval", value: "submitted_first" },
  { label: "Awaiting 2nd Approval", value: "approved_first,submitted_second" },
  { label: "Awaiting 3rd Approval", value: "approved_second,submitted_third" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
];

// Filters live in the URL (e.g. /form-entry?form_id=3&status=completed), so a
// filtered list survives a refresh, can be shared, and can be opened from
// other pages such as the dashboard. These are the ones the API accepts.
const URL_FILTERS = [
  "form_id",
  "status",
  "site",
  "area",
  "from",
  "to",
  "completed_from",
  "completed_to",
] as const;
// Set only by links from other pages; shown as chips with a "Clear" action
const LINKED_FILTER_LABELS: Record<string, string> = {
  site: "Site",
  area: "Area",
};

type FormOption = { id: number; form_name: string };

export default function FormEntries() {
  const navigate = useNavigate();
  // Archive (qfd_admin / all_access only): row menu and bulk "Archive selected"
  const canArchive = useCanArchive();
  const archive = useArchive("formEntry");
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const statusFilter = searchParams.get("status") || "all";
  const formFilter = searchParams.get("form_id") || "all";
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  // Set by the dashboard's "accomplished per day" chart
  const completedFrom = searchParams.get("completed_from");
  const completedTo = searchParams.get("completed_to");
  const linkedFilters = Object.keys(LINKED_FILTER_LABELS)
    .map((key) => ({ key, value: searchParams.get(key) }))
    .filter((f): f is { key: string; value: string } => Boolean(f.value));

  // One filter changed: update the URL (no new history entry) and go to page 1
  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
    setPageIndex(0);
  };

  const clearLinkedFilters = () => {
    const next = new URLSearchParams(searchParams);
    for (const key of [
      ...Object.keys(LINKED_FILTER_LABELS),
      "from",
      "to",
      "completed_from",
      "completed_to",
    ])
      next.delete(key);
    setSearchParams(next, { replace: true });
    setPageIndex(0);
  };

  // Active forms for the "Filter by form" dropdown
  const { data: forms = [] } = useQuery<FormOption[]>({
    queryKey: ["forms", "active"],
    queryFn: async () => {
      const res = await apiGet<FormOption[]>("/forms/all");
      return [...res].sort((a, b) => a.form_name.localeCompare(b.form_name));
    },
  });
  // A form opened from a link may be archived (not in the active list)
  const formOptions =
    formFilter !== "all" && !forms.some((f) => String(f.id) === formFilter)
      ? [...forms, { id: Number(formFilter), form_name: `Form #${formFilter}` }]
      : forms;

  const selectedFormName =
    formOptions.find((f) => String(f.id) === formFilter)?.form_name ??
    "All Forms";

  const filterQuery = URL_FILTERS.map((key) => [key, searchParams.get(key)])
    .filter(([, value]) => value)
    .map(([key, value]) => `&${key}=${encodeURIComponent(value as string)}`)
    .join("");

  const { data, isLoading, isError, isFetching } = useQuery<APIResponse>({
    queryKey: ["formEntries", pageIndex, pageSize, filterQuery],
    // Keep showing the current rows while the next filter's rows load
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await apiGet<APIResponse>(
        `/form-entries/pagination?page=${pageIndex + 1}&pageSize=${pageSize}${filterQuery}`,
      );
      return {
        ...res,
        entries: res.entries.map((entry) => ({
          ...entry,
          id: entry.id.toString(), // normalize IDs
        })),
      };
    },
  });

  const columns: ColumnDef<FormEntry>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      header: "Entry ID",
      accessorKey: "id",
    },
    {
      header: "User",
      accessorFn: (row) =>
        `${row.User?.user_firstname ?? ""} ${
          row.User?.user_lastname ?? ""
        }`.trim() ||
        row.User?.user_username ||
        "-",
      filterFn: multiColumnFilterFn,
    },
    {
      header: "Form",
      accessorFn: (row) => row.Form?.form_name || "-",
      filterFn: multiColumnFilterFn,
    },
    {
      header: "Site",
      accessorKey: "form_entry_site",
    },
    {
      header: "Area",
      accessorKey: "form_entry_area",
    },
    {
      header: "Date",
      accessorFn: (row) =>
        row.form_entry_date
          ? new Date(row.form_entry_date).toLocaleDateString()
          : "-",
    },
    {
      header: "Status",
      accessorKey: "form_entry_status", // ✅ Changed from "status"
      cell: ({ row }) => {
        const status = row.original.form_entry_status;
        if (!status) return "-";

        return (
          <span className={getStatusBadgeClass(status)}>
            {formatStatus(status)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions", // ✅ Changed from sr-only to visible header
      cell: ({ row }) => (
        <ActionButton
          row={row}
          basePath="/form-entry"
          archive={
            canArchive
              ? { name: `Entry #${row.original.id}`, onConfirm: () => archive([row.original.id]) }
              : undefined
          }
        />
      ),
      enableHiding: false,
    },
  ];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuNotebookPen className="text-2xl text-font-main" />}
        title="Form Entries"
        buttonText="Create New"
        onButtonClick={() => navigate("/form-entry/create")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        {(linkedFilters.length > 0 ||
          dateFrom ||
          dateTo ||
          completedFrom ||
          completedTo) && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Also filtered by:</span>
            {linkedFilters.map((f) => (
              <span
                key={f.key}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-gray-700"
              >
                {LINKED_FILTER_LABELS[f.key]}: {f.value}
              </span>
            ))}
            {(dateFrom || dateTo) && (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-gray-700">
                Date: {dateFrom ?? "…"} – {dateTo ?? "…"}
              </span>
            )}
            {(completedFrom || completedTo) && (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-gray-700">
                Completed on:{" "}
                {completedFrom === completedTo
                  ? completedFrom
                  : `${completedFrom ?? "…"} – ${completedTo ?? "…"}`}
              </span>
            )}
            <button
              type="button"
              onClick={clearLinkedFilters}
              className="text-blue-600 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <p className="text-center text-red-500 py-12">
            Error fetching form entries!
          </p>
        ) : (
          <div
            className={`transition-opacity ${isFetching ? "opacity-60" : ""}`}
            aria-busy={isFetching}
          >
            <PageTable<FormEntry>
              onArchiveSelected={
                canArchive ? (rows) => archive(rows.map((r) => r.id)) : undefined
              }
              itemNoun={{ one: "entry", many: "entries" }}
              data={data?.entries ?? []}
              columns={columns}
              manualPagination
              totalItems={data?.total ?? 0}
              pageIndex={pageIndex}
              pageSize={pageSize}
              toolbarExtra={
                <>
                  <Select
                    value={formFilter}
                    onValueChange={(value) => setFilter("form_id", value)}
                  >
                    <SelectTrigger
                      // Long form names stay on one line with "…"; the full
                      // name shows on hover. (The shared trigger lays the
                      // value out as flex, where line-clamp has no effect.)
                      className="w-full sm:w-[260px] *:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate *:data-[slot=select-value]:text-left"
                      title={selectedFormName}
                      aria-label="Filter by form"
                    >
                      <SelectValue placeholder="Filter by form" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(28rem,90vw)]">
                      <SelectItem value="all">All Forms</SelectItem>
                      {formOptions.map((form) => (
                        <SelectItem
                          key={form.id}
                          value={String(form.id)}
                          className="whitespace-normal"
                        >
                          {form.form_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setFilter("status", value)}
                  >
                    <SelectTrigger
                      className="w-full sm:w-[200px]"
                      aria-label="Filter by status"
                    >
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
              onPageChange={(newPage) => setPageIndex(newPage)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPageIndex(0);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
