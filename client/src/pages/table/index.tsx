import PageTable from "@/components/comp-485";
import PageHeader from "@/components/page-header";
import ActionButton from "@/components/action-button";
import { LuMapPinHouse } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";

type Item = {
  id: string;
  name: string;
  email: string;
  location: string;
  flag: string;
  status: "Active" | "Inactive" | "Pending";
};

// ✅ Data
const data: Item[] = [
  {
    id: "1",
    name: "Sample Room A",
    email: "taytay@example.com",
    location: "Annex",
    flag: "🇵🇭",
    status: "Active",
  },
  {
    id: "2",
    name: "Sample Room B",
    email: "marilao@example.com",
    location: "Main Building",
    flag: "🇵🇭",
    status: "Inactive",
  },
  {
    id: "3",
    name: "Sample Room C",
    email: "plaridel@example.com",
    location: "Dry",
    flag: "🇵🇭",
    status: "Pending",
  },
];

// ✅ Filter Functions
const multiColumnFilterFn: FilterFn<Item> = (row, _columnId, filterValue) => {
  const searchableContent =
    `${row.original.name} ${row.original.email}`.toLowerCase();
  return searchableContent.includes((filterValue ?? "").toLowerCase());
};

const statusFilterFn: FilterFn<Item> = (
  row,
  columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true;
  return filterValue.includes(row.getValue(columnId));
};

// ✅ Column Definitions
const columns: ColumnDef<Item>[] = [
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
    header: "Name",
    accessorKey: "name",
    filterFn: multiColumnFilterFn,
  },
  {
    header: "Email",
    accessorKey: "email",
  },
  {
    header: "Location",
    accessorKey: "location",
    cell: ({ row }) => (
      <div>
        <span className="text-lg">{row.original.flag}</span>{" "}
        {row.getValue("location")}
      </div>
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
    filterFn: statusFilterFn,
    cell: ({ row }) => (
      <Badge
        className={cn(
          row.getValue("status") === "Inactive" &&
            "bg-muted-foreground/60 text-primary-foreground"
        )}
      >
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <ActionButton row={row} basePath="/rooms" />,
    enableHiding: false,
  },
];

export default function Table() {
  return (
    <div className="mx-6">
      <PageHeader
        icon={<LuMapPinHouse className="text-2xl text-font-main" />}
        title="Rooms"
        buttonText="Create New"
        onButtonClick={() => {}}
        variant="default"
      />
      <div className="bg-white shadow-md p-4 rounded mt-1">
        <PageTable<Item> data={data} columns={columns} />
      </div>
    </div>
  );
}
