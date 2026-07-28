import {
  LuChevronsLeft,
  LuChevronsRight,
  LuChevronLeft,
  LuChevronRight,
} from "react-icons/lu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface DataTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (value: number) => void;
  totalItems: number;
  variant?: "default" | "compact";
}

const rowsPerPageOptions = [5, 10, 25, 50, 100];

export default function DataTable({
  headers,
  rows,
  currentPage,
  totalPages,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  totalItems,
  variant = "default",
}: DataTableProps) {
  const rowPadding = variant === "compact" ? "px-4 py-2" : "px-5 py-3";

  const startItem = (currentPage - 1) * rowsPerPage + 1;
  const endItem = Math.min(currentPage * rowsPerPage, totalItems);

  return (
    <div className="mt-2 max-w-6xl w-full mx-auto overflow-hidden rounded-xl shadow-sm border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 border-b border-gray-200">
            {headers.map((header, i) => (
              <TableHead
                key={i}
                className={`text-font-main font-medium text-sm ${rowPadding} ${
                  i === headers.length - 1 ? "text-right" : ""
                }`}
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((cells, idx) => (
            <TableRow
              key={idx}
              className={`transition duration-150 ${
                idx % 2 === 0 ? "bg-white" : "bg-gray-100"
              } hover:bg-gray-50`}
            >
              {cells.map((cell, i) => (
                <TableCell
                  key={i}
                  className={`${rowPadding} text-sm text-gray-800 ${
                    i === cells.length - 1 ? "text-right" : ""
                  }`}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Footer Pagination Block (Right Aligned) */}
      <div className="w-full flex justify-end border-t border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center space-x-4">
          {/* Rows per page label and dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-s text-gray-600 whitespace-nowrap">
              Rows per page
            </span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => onRowsPerPageChange(Number(value))}
            >
              <SelectTrigger className="w-[70px] h-8 border-gray-300 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rowsPerPageOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Showing X-Y of Z items */}
          <div className="text-s text-gray-600 whitespace-nowrap">
            {`${startItem}-${endItem} of ${totalItems} items`}
          </div>

          {/* Pagination Controls */}
          <Pagination>
            <PaginationContent className="space-x-1">
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => currentPage > 1 && onPageChange(1)}
                  disabled={currentPage === 1}
                  className="rounded-md hover:bg-gray-100"
                >
                  <LuChevronsLeft className="w-4 h-4" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    currentPage > 1 && onPageChange(currentPage - 1)
                  }
                  disabled={currentPage === 1}
                  className="rounded-md hover:bg-gray-100"
                >
                  <LuChevronLeft className="w-4 h-4" />
                </Button>
              </PaginationItem>

              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === i + 1}
                    onClick={() => onPageChange(i + 1)}
                    className="rounded-md hover:bg-gray-100"
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    currentPage < totalPages && onPageChange(currentPage + 1)
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-md hover:bg-gray-100"
                >
                  <LuChevronRight className="w-4 h-4" />
                </Button>
              </PaginationItem>

              <PaginationItem>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    currentPage < totalPages && onPageChange(totalPages)
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-md hover:bg-gray-100"
                >
                  <LuChevronsRight className="w-4 h-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
