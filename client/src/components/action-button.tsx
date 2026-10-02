import { useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EllipsisIcon } from "lucide-react";

type ActionButtonProps<T extends { id: string }> = {
  row: Row<T>;
  basePath: string;
  // Hide "Edit" where the record has no edit page (e.g. saved reports)
  showEdit?: boolean;
  // When given, the menu offers "Archive" with a confirmation step. Pages pass
  // it only to users allowed to archive, and only where archiving exists.
  archive?: {
    name: string; // shown in the confirmation, e.g. the form name
    onConfirm: () => Promise<unknown>;
  };
};

export default function ActionButton<T extends { id: string }>({
  row,
  basePath,
  showEdit = true,
  archive,
}: ActionButtonProps<T>) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
            aria-label="Row actions"
          >
            <EllipsisIcon size={16} />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" className="z-50">
            <DropdownMenuGroup>
              {showEdit && (
                <DropdownMenuItem
                  onClick={() => navigate(`${basePath}/edit/${row.original.id}`)}
                >
                  Edit <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => navigate(`${basePath}/view/${row.original.id}`)}
              >
                Details <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {archive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  // Open the confirmation after the menu has closed
                  onSelect={() => setConfirming(true)}
                >
                  Archive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>

      {archive && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent className="mx-4 max-w-md sm:mx-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Archive “{archive.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                It will be hidden from lists, reports and the dashboard. Nothing is
                deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
              <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="w-full sm:w-auto"
                onClick={() => {
                  void archive.onConfirm();
                }}
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
