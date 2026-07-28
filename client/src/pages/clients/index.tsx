import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LuUsers } from "react-icons/lu";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import PageHeader from "@/components/page-header";
import PageTable from "@/components/comp-485";
import { Checkbox } from "@/components/ui/checkbox";
import ActionButton from "@/components/action-button";
import { apiGet } from "@/services/api";

type Client = {
  id: string;
  clients_id: string;
  clients_name: string;
  clients_site: string;
  clients_description: string;
};

type APIResponse = {
  message: string;
  total: number;
  clients: Client[];
};

const multiColumnFilterFn: FilterFn<Client> = (row, _columnId, filterValue) => {
  const searchableContent =
    `${row.original.clients_name} ${row.original.clients_description} ${row.original.clients_site}`.toLowerCase();
  return searchableContent.includes((filterValue ?? "").toLowerCase());
};

export default function Clients() {
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError } = useQuery<APIResponse>({
    queryKey: ["clients", pageIndex, pageSize],
    queryFn: async () => {
      const res = await apiGet<APIResponse>(
        `/clients/pagination?page=${pageIndex + 1}&pageSize=${pageSize}`,
      );
      return {
        ...res,
        clients: res.clients.map((client) => ({
          ...client,
          id: client.clients_id, // normalize for DataTable
        })),
      };
    },
  });

  const columns: ColumnDef<Client>[] = [
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
      header: "Client ID",
      accessorKey: "clients_id",
      filterFn: multiColumnFilterFn,
    },
    {
      header: "Client Name",
      accessorKey: "clients_name",
      filterFn: multiColumnFilterFn,
    },
    {
      header: "Site",
      accessorKey: "clients_site",
    },
    {
      header: "Description",
      accessorKey: "clients_description",
      cell: ({ row }) => row.original.clients_description || "-",
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionButton row={row} basePath="/clients" />,
      enableHiding: false,
    },
  ];

  if (isLoading) return <p>Loading clients...</p>;
  if (isError) return <p>Error fetching clients!</p>;

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuUsers className="text-2xl text-font-main" />}
        title="Clients"
        buttonText="Create New"
        onButtonClick={() => navigate("/clients/create")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        <PageTable<Client>
          data={data?.clients ?? []}
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
