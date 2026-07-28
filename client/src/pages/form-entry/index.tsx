import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { apiGet } from "@/services/api";
import { useNavigate } from "react-router-dom";

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
  { label: "Awaiting 1st Approval", value: "submitted_first" },
  { label: "Awaiting 2nd Approval", value: "approved_first,submitted_second" },
  { label: "Awaiting 3rd Approval", value: "approved_second,submitted_third" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
];

export default function FormEntries() {
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, isError } = useQuery<APIResponse>({
    queryKey: ["formEntries", pageIndex, pageSize, statusFilter],
    queryFn: async () => {
      const statusParam =
        statusFilter !== "all" ? `&status=${encodeURIComponent(statusFilter)}` : "";
      const res = await apiGet<APIResponse>(
        `/form-entries/pagination?page=${pageIndex + 1}&pageSize=${pageSize}${statusParam}`,
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
      cell: ({ row }) => <ActionButton row={row} basePath="/form-entry" />,
      enableHiding: false,
    },
  ];

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Error fetching form entries!</p>;

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
        <PageTable<FormEntry>
          data={data?.entries ?? []}
          columns={columns}
          manualPagination
          totalItems={data?.total ?? 0}
          pageIndex={pageIndex}
          pageSize={pageSize}
          toolbarExtra={
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPageIndex(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
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
          }
          onPageChange={(newPage) => setPageIndex(newPage)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPageIndex(0);
          }}
        />
      </div>
    </div>
  );
}
