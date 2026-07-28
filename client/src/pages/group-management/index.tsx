import PageHeader from "@/components/page-header";
import DataTable from "@/components/table";
import { useState, useMemo } from "react";
// import { useNavigate } from "react-router-dom";
import { LuUsers, LuEllipsis } from "react-icons/lu";

const groupInfo = [
  {
    id: 1,
    groupCode: "MAR001",
    groupName: "All Access",
    description: "All Access",
  },
  {
    id: 2,
    groupCode: "MAR002",
    groupName: "QA Analyst",
    description: "All Access",
  },
  {
    id: 3,
    groupCode: "MAR003",
    groupName: "Marilao",
    description: "All Access",
  },
  {
    id: 4,
    groupCode: "MAR004",
    groupName: "Marilao",
    description: "All Access",
  },
  {
    id: 5,
    groupCode: "MAR005",
    groupName: "Marilao",
    description: "All Access",
  },
  {
    id: 6,
    groupCode: "MAR006",
    groupName: "Marilao",
    description: "All Access",
  },
  {
    id: 7,
    groupCode: "MAR007",
    groupName: "Marilao",
    description: "All Access",
  },
  {
    id: 8,
    groupCode: "MAR008",
    groupName: "Marilao",
    description: "All Access",
  },
];

export default function GroupManagement() {
  // const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const totalPages = useMemo(() => {
    return Math.ceil(groupInfo.length / rowsPerPage);
  }, [groupInfo.length, rowsPerPage]);

  const paginatedForms = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    return groupInfo.slice(startIdx, endIdx);
  }, [currentPage, rowsPerPage]);

  const headers = [
    "Group ID",
    "Group Code",
    "Group Name",
    "Description",
    "Action",
  ];

  const rows = paginatedForms.map((groupInfo) => [
    groupInfo.id,
    groupInfo.groupCode,
    groupInfo.groupName,
    groupInfo.description,

    <button
      className="text-gray-500 hover:text-gray-700 transition"
      key={`action-${groupInfo.id}`}
    >
      <LuEllipsis className="w-5 h-5 mr-3 hover:text-gray-700 transition cursor-pointer" />
    </button>,
  ]);

  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing rows per page
  };

  return (
    <div>
      <PageHeader
        icon={<LuUsers className="text-2xl text-font-main" />}
        title="Group Management"
        buttonText="Create New"
        onButtonClick={() => {}}
        variant="default"
      />

      {/* ✅ DataTable with Pagination */}
      <DataTable
        headers={headers}
        rows={rows}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        totalItems={groupInfo.length}
        onPageChange={(page) => {
          if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
          }
        }}
        variant="default"
      />
    </div>
  );
}
