import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/page-header";
import PageTable from "@/components/comp-485";
import { LuNotepadText } from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";
import ActionButton from "@/components/action-button";
import { useFetch } from "@/services/useCrud";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";

type Form = {
  id: string;
  form_name: string;
  form_description: string | null;
};

type APIForm = {
  id: number;
  form_name: string;
  form_description: string | null;
};

type APIResponse = {
  message: string;
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  forms: APIForm[];
};

// ✅ Multi-column filter for table
const multiColumnFilterFn: FilterFn<Form> = (row, _columnId, filterValue) => {
  const searchableContent = `${row.original.form_name} ${
    row.original.form_description || ""
  }`.toLowerCase();
  return searchableContent.includes((filterValue ?? "").toLowerCase());
};

export default function Forms() {
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // ✅ Fetch forms with useFetch
  const { data, isLoading, isError } = useFetch<APIResponse>(
    ["forms", String(pageIndex), String(pageSize)],
    `/forms/pagination?page=${pageIndex + 1}&pageSize=${pageSize}`,
  );

  const columns: ColumnDef<Form>[] = [
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
      header: "Form Name",
      accessorKey: "form_name",
      filterFn: multiColumnFilterFn,
    },
    {
      header: "Description",
      accessorKey: "form_description",
      cell: ({ row }) => row.original.form_description || "-",
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionButton row={row} basePath="/forms" />,
      enableHiding: false,
    },
  ];

  if (isLoading) return <p>Loading forms...</p>;
  if (isError) return <p>Error fetching forms!</p>;

  // ✅ Map API forms -> table rows
  const mappedForms: Form[] =
    data?.forms.map((form) => ({
      id: String(form.id),
      form_name: form.form_name,
      form_description: form.form_description,
    })) ?? [];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuNotepadText className="text-2xl text-font-main" />}
        title="Forms"
        buttonText="Create New"
        onButtonClick={() => navigate("/forms/create")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        <PageTable<Form>
          data={mappedForms}
          columns={columns}
          manualPagination
          totalItems={data?.total ?? 0}
          pageIndex={pageIndex}
          pageSize={pageSize}
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
