import { useId, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleXIcon,
  Columns3Icon,
  ListFilterIcon,
  TrashIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WithId = { id: string };

type Props<T extends WithId> = {
  data: T[];
  columns: ColumnDef<T>[];
  manualPagination?: boolean;
  totalItems?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  toolbarExtra?: ReactNode;
};

export default function PageTable<T extends WithId>({
  data: initialData,
  columns,
  manualPagination,
  totalItems,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  toolbarExtra,
}: Props<T>) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<T[]>(initialData);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: pageIndex ?? 0,
    pageSize: pageSize ?? 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    if (manualPagination) {
      setPagination({
        pageIndex: pageIndex ?? 0,
        pageSize: pageSize ?? 10,
      });
    }
  }, [pageIndex, pageSize, manualPagination]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!manualPagination,
    pageCount: manualPagination
      ? Math.ceil((totalItems ?? 0) / (pagination.pageSize ?? 10))
      : undefined,
  });

  const handleDeleteRows = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const updatedData = data.filter(
      (item) => !selectedRows.some((row) => row.original.id === item.id),
    );
    setData(updatedData);
    table.resetRowSelection();
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Left: Search + View toggle */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <div className="relative w-full sm:w-auto">
            <Input
              id={`${id}-input`}
              ref={inputRef}
              className={cn("peer w-full ps-9 sm:min-w-60")}
              placeholder="Type to filter..."
              type="text"
              aria-label="Filter table"
              onChange={(e) => {
                const firstFilterable = table
                  .getAllColumns()
                  .find((col) => col.getCanFilter());
                firstFilterable?.setFilterValue(e.target.value);
              }}
            />
            <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <ListFilterIcon size={16} aria-hidden="true" />
            </div>
            <button
              className="text-muted-foreground/80 hover:text-foreground absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md"
              aria-label="Clear filter"
              onClick={() => {
                const firstFilterable = table
                  .getAllColumns()
                  .find((col) => col.getCanFilter());
                firstFilterable?.setFilterValue("");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <CircleXIcon size={16} aria-hidden="true" />
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Columns3Icon
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden
                />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {toolbarExtra}
        </div>

        {/* Right: Delete button */}
        {table.getSelectedRowModel().rows.length > 0 && (
          <div className="flex w-full justify-end sm:w-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full sm:w-auto" variant="outline">
                  <TrashIcon className="-ms-1 opacity-60" size={16} />
                  Delete
                  <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 items-center rounded border px-1 text-[0.625rem] font-medium">
                    {table.getSelectedRowModel().rows.length}
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 max-w-md sm:mx-auto">
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                  <div className="flex size-9 items-center justify-center rounded-full border">
                    <CircleAlertIcon className="opacity-80" size={16} />
                  </div>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete{" "}
                      {table.getSelectedRowModel().rows.length} selected{" "}
                      {table.getSelectedRowModel().rows.length === 1
                        ? "row"
                        : "rows"}
                      .
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
                <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
                  <AlertDialogCancel className="w-full sm:w-auto">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteRows}
                    className="w-full sm:w-auto"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-background w-full overflow-x-auto rounded-md border">
        <Table className="min-w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-11 whitespace-nowrap px-3 text-xs"
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <div
                        className={cn(
                          "flex h-full cursor-pointer items-center justify-between gap-2 select-none",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {{
                          asc: (
                            <ChevronUpIcon className="opacity-60" size={16} />
                          ),
                          desc: (
                            <ChevronDownIcon className="opacity-60" size={16} />
                          ),
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="whitespace-nowrap px-3 last:py-0"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Rows per page */}
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="shrink-0 text-sm">
            Rows per page
          </Label>
          <Select
            value={pagination.pageSize.toString()}
            onValueChange={(value) => {
              const size = Number(value);
              if (manualPagination && onPageSizeChange) onPageSizeChange(size);
              else setPagination((prev) => ({ ...prev, pageSize: size }));
            }}
          >
            <SelectTrigger id={id} className="w-fit whitespace-nowrap">
              <SelectValue placeholder="Select number of results" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50].map((pageSizeOption) => (
                <SelectItem
                  key={pageSizeOption}
                  value={pageSizeOption.toString()}
                >
                  {pageSizeOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page info + navigation */}
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <p className="shrink-0 text-sm whitespace-nowrap">
            <span>
              {pagination.pageIndex * pagination.pageSize + 1}-
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                totalItems ?? data.length,
              )}
            </span>{" "}
            of <span>{totalItems ?? data.length}</span>
          </p>

          <Pagination className="mx-0 w-auto">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() =>
                    manualPagination && onPageChange
                      ? onPageChange(0)
                      : setPagination((prev) => ({ ...prev, pageIndex: 0 }))
                  }
                  disabled={pagination.pageIndex === 0}
                  aria-label="First page"
                >
                  <ChevronFirstIcon size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => {
                    const newPage = pagination.pageIndex - 1;
                    if (manualPagination && onPageChange) onPageChange(newPage);
                    else
                      setPagination((prev) => ({
                        ...prev,
                        pageIndex: newPage,
                      }));
                  }}
                  disabled={pagination.pageIndex === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => {
                    const newPage = pagination.pageIndex + 1;
                    const maxPage =
                      Math.ceil(
                        (totalItems ?? data.length) / pagination.pageSize,
                      ) - 1;
                    if (manualPagination && onPageChange) onPageChange(newPage);
                    else if (newPage <= maxPage)
                      setPagination((prev) => ({
                        ...prev,
                        pageIndex: newPage,
                      }));
                  }}
                  disabled={
                    pagination.pageIndex >=
                    Math.ceil(
                      (totalItems ?? data.length) / pagination.pageSize,
                    ) -
                      1
                  }
                  aria-label="Next page"
                >
                  <ChevronRightIcon size={14} />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => {
                    const lastPage =
                      Math.ceil(
                        (totalItems ?? data.length) / pagination.pageSize,
                      ) - 1;
                    if (manualPagination && onPageChange)
                      onPageChange(lastPage);
                    else
                      setPagination((prev) => ({
                        ...prev,
                        pageIndex: lastPage,
                      }));
                  }}
                  disabled={
                    pagination.pageIndex >=
                    Math.ceil(
                      (totalItems ?? data.length) / pagination.pageSize,
                    ) -
                      1
                  }
                  aria-label="Last page"
                >
                  <ChevronLastIcon size={14} />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
