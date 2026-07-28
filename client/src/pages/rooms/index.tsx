import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LuMapPinHouse } from "react-icons/lu";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import PageHeader from "@/components/page-header";
import PageTable from "@/components/comp-485";
import { Checkbox } from "@/components/ui/checkbox";
import ActionButton from "@/components/action-button";
import { apiGet } from "@/services/api"; // ✅ use apiGet (with interceptors)

type Room = {
  id: string;
  room_id: string;
  room_name: string;
  room_description: string;
  room_site: string;
  room_location: string;
};

type APIResponse = {
  message: string;
  total: number;
  rooms: Room[];
};

const multiColumnFilterFn: FilterFn<Room> = (row, _columnId, filterValue) => {
  const searchableContent =
    `${row.original.room_name} ${row.original.room_description} ${row.original.room_site} ${row.original.room_location}`.toLowerCase();
  return searchableContent.includes((filterValue ?? "").toLowerCase());
};

export default function Rooms() {
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // ✅ use apiGet instead of axios directly
  const { data, isLoading, isError } = useQuery<APIResponse>({
    queryKey: ["rooms", pageIndex, pageSize],
    queryFn: async () => {
      const res = await apiGet<APIResponse>("/rooms/pagination", {
        params: { page: pageIndex + 1, pageSize },
      });

      return {
        ...res,
        rooms: res.rooms.map((room) => ({
          ...room,
          id: room.room_id, // Ensure table row IDs are consistent
        })),
      };
    },
  });

  const columns: ColumnDef<Room>[] = [
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
      header: "Room ID",
      accessorKey: "room_id",
      filterFn: multiColumnFilterFn,
    },
    {
      header: "Room Name",
      accessorKey: "room_name",
      filterFn: multiColumnFilterFn,
    },
    {
      header: "Site",
      accessorKey: "room_site",
    },
    {
      header: "Description",
      accessorKey: "room_description",
      cell: ({ row }) => row.original.room_description || "-",
    },
    {
      header: "Location",
      accessorKey: "room_location",
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionButton row={row} basePath="/rooms" />,
      enableHiding: false,
    },
  ];

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Error fetching rooms!</p>;

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuMapPinHouse className="text-2xl text-font-main" />}
        title="Rooms"
        buttonText="Create New"
        onButtonClick={() => navigate("/rooms/create")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        <PageTable<Room>
          data={data?.rooms ?? []}
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
