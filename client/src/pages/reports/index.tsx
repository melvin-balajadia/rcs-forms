import { useState } from "react";
import PageHeader from "@/components/page-header";
import PageTable from "@/components/comp-485";
import { LuFileChartColumnIncreasing } from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";
import ActionButton from "@/components/action-button";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/api";

type Report = {
  id: string;
  report_name: string;
  report_description: string | null;
  form_id: number;
  filter_site: string | null;
  filter_area: string | null;
  filter_date_from: string;
  filter_date_to: string;
  entries_count: number;
  chart_type: string;
  chart_condition: string;
  snapshot_overall_average: number | null;
  createdAt: string;
  last_viewed_at: string | null;
  form?: { id: number; form_name: string };
  chart_section?: { form_section_id: number; form_section_name: string } | null;
};

const chartTypeLabel: Record<string, string> = {
  overall: "Overall Summary",
  per_section: "Per Section",
  per_question: "Per Question",
};

export default function Reports() {
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["saved-reports"],
    queryFn: async () => {
      const res = await apiGet<any>(`/saved-reports/my-reports`);
      return res.data;
    },
  });

  const columns: ColumnDef<Report>[] = [
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
    { header: "Report ID", accessorKey: "id" },
    { header: "Report Name", accessorKey: "report_name" },
    {
      header: "Form Type",
      id: "form_name",
      cell: ({ row }) => row.original.form?.form_name || "N/A",
    },
    {
      header: "Site",
      accessorKey: "filter_site",
      cell: ({ row }) => row.original.filter_site || "All",
    },
    {
      header: "Area",
      accessorKey: "filter_area",
      cell: ({ row }) => row.original.filter_area || "All",
    },
    {
      header: "Chart Type",
      accessorKey: "chart_type",
      cell: ({ row }) =>
        chartTypeLabel[row.original.chart_type] || row.original.chart_type,
    },
    {
      header: "Created",
      accessorKey: "createdAt",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionButton row={row as any} basePath="/reports" />,
      enableHiding: false,
    },
  ];

  const paginatedData = reports.slice(
    pageIndex * pageSize,
    (pageIndex + 1) * pageSize,
  );

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={
          <LuFileChartColumnIncreasing className="text-2xl text-font-main" />
        }
        title="Reports"
        buttonText="Create New"
        onButtonClick={() => navigate("/reports/create")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <p className="text-gray-500">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <div className="text-center text-gray-500">
              <LuFileChartColumnIncreasing className="mx-auto text-4xl mb-3 text-gray-400" />
              <p className="text-lg">No saved reports yet</p>
              <p className="text-sm mt-2">
                Create a report and save it to see it here
              </p>
            </div>
          </div>
        ) : (
          <PageTable<Report>
            data={paginatedData}
            columns={columns}
            manualPagination
            totalItems={reports.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={(newPage) => setPageIndex(newPage)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPageIndex(0);
            }}
          />
        )}
      </div>
    </div>
  );
}
