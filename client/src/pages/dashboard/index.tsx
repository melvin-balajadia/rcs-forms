import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/api";
import PageHeader from "@/components/page-header";
import { LuLayoutDashboard } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { SkeletonDashboard } from "@/components/skeleton-dashboard";

type RecentEntry = {
  id: number;
  formName: string;
  status: string;
  site: string;
  createdBy: string;
  createdAt: string;
};

type DashboardData =
  | {
      viewMode: "org";
      keyMetrics: {
        totalFormEntries: number;
        pendingApproval: number;
        completed: number;
        returned: number;
      };
      recentEntries: RecentEntry[];
    }
  | {
      viewMode: "requestor";
      keyMetrics: {
        myDrafts: number;
        myAwaitingApproval: number;
        myReturned: number;
        myCompleted: number;
      };
      recentEntries: RecentEntry[];
    };

export default function Dashboard() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => apiGet("/dashboard/all"),
  });

  const formatStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      draft: "Draft",
      pending: "Pending Submission",
      submitted_first: "Awaiting 1st Approval",
      approved_first: "Awaiting 2nd Approval",
      submitted_second: "Awaiting 2nd Approval",
      approved_second: "Awaiting 3rd Approval",
      submitted_third: "Awaiting 3rd Approval",
      completed: "Completed",
      rejected: "Rejected",
    };
    return statusMap[status] || status;
  };

  const getStatusBadgeClass = (status: string): string => {
    const baseClass = "px-2 py-1 rounded-md text-xs font-medium";
    switch (status) {
      case "pending":
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      case "submitted_first":
      case "approved_first":
      case "submitted_second":
      case "approved_second":
      case "submitted_third":
        return `${baseClass} bg-blue-100 text-blue-800`;
      case "completed":
        return `${baseClass} bg-green-100 text-green-800`;
      case "rejected":
        return `${baseClass} bg-red-100 text-red-800`;
      case "draft":
        return `${baseClass} bg-gray-100 text-gray-800`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800`;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="mx-6">
        <PageHeader
          icon={<LuLayoutDashboard className="text-2xl text-font-main" />}
          title="Dashboard"
          variant="default"
        />
        <div className="flex justify-center items-center h-64">
          <SkeletonDashboard />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-6">
        <PageHeader
          icon={<LuLayoutDashboard className="text-2xl text-font-main" />}
          title="Dashboard"
          variant="default"
        />
        <div className="flex justify-center items-center h-64">
          <p className="text-red-500">Error loading dashboard data</p>
        </div>
      </div>
    );
  }

  const entriesIcon = (
    <svg
      className="w-5 h-5 text-blue-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12" y2="16" />
    </svg>
  );

  const draftIcon = (
    <svg
      className="w-5 h-5 text-gray-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );

  const pendingIcon = (
    <svg
      className="w-5 h-5 text-amber-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );

  const completedIcon = (
    <svg
      className="w-5 h-5 text-green-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const returnedIcon = (
    <svg
      className="w-5 h-5 text-orange-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 10 4 15 9 20" />
      <path d="M4 15h11a4 4 0 0 0 0-8h-1" />
    </svg>
  );

  const metricTiles =
    data.viewMode === "org"
      ? [
          {
            label: "Total form entries",
            value: data.keyMetrics.totalFormEntries,
            bgClass: "bg-blue-50",
            icon: entriesIcon,
          },
          {
            label: "Pending approval",
            value: data.keyMetrics.pendingApproval,
            bgClass: "bg-amber-50",
            icon: pendingIcon,
          },
          {
            label: "Completed forms",
            value: data.keyMetrics.completed,
            bgClass: "bg-green-50",
            icon: completedIcon,
          },
          {
            label: "Returned forms",
            value: data.keyMetrics.returned,
            bgClass: "bg-orange-50",
            icon: returnedIcon,
          },
        ]
      : [
          {
            label: "My drafts",
            value: data.keyMetrics.myDrafts,
            bgClass: "bg-gray-100",
            icon: draftIcon,
          },
          {
            label: "My awaiting approval",
            value: data.keyMetrics.myAwaitingApproval,
            bgClass: "bg-amber-50",
            icon: pendingIcon,
          },
          {
            label: "My returned",
            value: data.keyMetrics.myReturned,
            bgClass: "bg-orange-50",
            icon: returnedIcon,
          },
          {
            label: "My completed",
            value: data.keyMetrics.myCompleted,
            bgClass: "bg-green-50",
            icon: completedIcon,
          },
        ];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuLayoutDashboard className="text-2xl text-font-main" />}
        title="Dashboard"
        variant="default"
      />

      {/* KEY METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {metricTiles.map((tile) => (
          <div
            key={tile.label}
            className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-gray-500 font-medium">
                {tile.label}
              </p>
              <p className="text-3xl font-semibold text-gray-800 mt-1">
                {tile.value}
              </p>
            </div>
            <div className={`${tile.bgClass} p-3 rounded-full`}>{tile.icon}</div>
          </div>
        ))}
      </div>

      {/* RECENT ENTRIES TABLE */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            Recent form entries
          </h2>
          <button
            onClick={() => navigate("/form-entry")}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all entries →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">
                  Entry ID
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">
                  Form name
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">
                  Site
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">
                  Created by
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">
                  Status
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {data.recentEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-sm text-gray-400"
                  >
                    No recent form entries
                  </td>
                </tr>
              ) : (
                data.recentEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/form-entry/edit/${entry.id}`)}
                  >
                    <td className="py-3 px-3 text-sm text-gray-500">
                      #{entry.id}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-800 font-medium">
                      {entry.formName}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-500">
                      {entry.site || "-"}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-500">
                      {entry.createdBy}
                    </td>
                    <td className="py-3 px-3">
                      <span className={getStatusBadgeClass(entry.status)}>
                        {formatStatus(entry.status)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-500">
                      {formatDate(entry.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
