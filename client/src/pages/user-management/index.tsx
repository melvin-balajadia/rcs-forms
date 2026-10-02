import { useState } from "react";
import PageHeader from "@/components/page-header";
import PageTable from "@/components/comp-485";
import { LuUsers } from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";
import ActionButton from "@/components/action-button";
import { useArchive } from "@/services/useArchive";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useFetch } from "@/services/useCrud";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  fullname: string;
  site: string;
  group: string;
};

type APIUser = {
  id: number;
  user_firstname: string;
  user_middlename?: string;
  user_lastname: string;
  user_groups: string; // Approver role: "first_approver", "second_approver", "third_approver"
  user_site: string;
};

type APIResponse = {
  message: string;
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  data: APIUser[];
};

export default function UserManagement() {
  const navigate = useNavigate();
  // Archiving users is all_access only, and never your own account
  const { user: me } = useAuth();
  const canArchiveUsers = (me?.user_groups ?? []).includes("all_access");
  const myId = String(me?.id ?? "");
  const archive = useArchive("user");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, isError } = useFetch<APIResponse>(
    ["user-management", String(pageIndex), String(pageSize)],
    `/users/pagination?page=${pageIndex + 1}&pageSize=${pageSize}`,
  );

  const columns: ColumnDef<User>[] = [
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
    { header: "User ID", accessorKey: "id" },
    { header: "Full Name", accessorKey: "fullname" },
    { header: "Site", accessorKey: "site" },
    { header: "Group", accessorKey: "group" },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ActionButton
          row={row as any}
          basePath="/user-management"
          archive={
            canArchiveUsers && row.original.id !== myId
              ? {
                  name: row.original.fullname,
                  onConfirm: () => archive([row.original.id]),
                }
              : undefined
          }
        />
      ),
      enableHiding: false,
    },
  ];

  const mappedUsers: User[] =
    data?.data.map((user) => {
      // Format the approver role for display
      let groupDisplay = "N/A";

      if (user.user_groups) {
        switch (user.user_groups) {
          case "first_approver":
            groupDisplay = "First Approver";
            break;
          case "second_approver":
            groupDisplay = "Second Approver";
            break;
          case "third_approver":
            groupDisplay = "Third Approver";
            break;
          default:
            groupDisplay = user.user_groups;
        }
      }

      return {
        id: String(user.id),
        fullname: `${user.user_firstname} ${user.user_middlename ?? ""} ${
          user.user_lastname
        }`.trim(),
        site: user.user_site,
        group: groupDisplay,
      };
    }) ?? [];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuUsers className="text-2xl text-font-main" />}
        title="User Management"
        buttonText="Create New"
        onButtonClick={() => navigate("/user-management/create")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <p className="text-center text-red-500 py-12">
            Error fetching users!
          </p>
        ) : (
          <PageTable<User>
            onArchiveSelected={
              canArchiveUsers
                ? async (rows) => {
                    const others = rows.filter((r) => r.id !== myId);
                    if (others.length < rows.length) {
                      toast.info("Your own account was skipped", {
                        description: "You can't archive your own account.",
                      });
                    }
                    if (others.length > 0) await archive(others.map((r) => r.id));
                  }
                : undefined
            }
            itemNoun={{ one: "user", many: "users" }}
            data={mappedUsers}
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
        )}
      </div>
    </div>
  );
}
