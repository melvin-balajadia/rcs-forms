// Every status in which an entry is waiting for an approver (any level).
// Used for links into the Form Entry list, e.g. from the dashboard.
export const AWAITING_ANY_LEVEL =
  "submitted_first,approved_first,submitted_second,approved_second,submitted_third";

// How each status is shown to users
export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending Submission",
  returned: "Returned for Correction",
  submitted_first: "Awaiting 1st Approval",
  approved_first: "Awaiting 2nd Approval",
  submitted_second: "Awaiting 2nd Approval",
  approved_second: "Awaiting 3rd Approval",
  submitted_third: "Awaiting 3rd Approval",
  completed: "Completed",
  rejected: "Rejected",
};

// Badge colors per status group
export const statusBadgeClass = (status: string) => {
  if (status === "completed") return "bg-green-50 text-green-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  if (status === "returned") return "bg-orange-50 text-orange-700";
  if (status === "pending") return "bg-yellow-50 text-yellow-800";
  if (AWAITING_ANY_LEVEL.split(",").includes(status)) return "bg-blue-50 text-blue-700";
  return "bg-gray-100 text-gray-700";
};
