import { useNavigate } from "react-router-dom";
import type { Row } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { EllipsisIcon } from "lucide-react";

type ActionButtonProps<T extends { id: string }> = {
  row: Row<T>;
  basePath: string;
};

export default function ActionButton<T extends { id: string }>({
  row,
  basePath,
}: ActionButtonProps<T>) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted">
          <EllipsisIcon size={16} />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent align="end" className="z-50">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => navigate(`${basePath}/edit/${row.original.id}`)}
            >
              Edit <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`${basePath}/view/${row.original.id}`)}
            >
              Details <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive">
            Archive <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
