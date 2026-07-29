import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Button from "@/components/button";
import {
  LuFileChartColumnIncreasing,
  LuTrendingUp,
  LuFileDown,
} from "react-icons/lu";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/services/api";
import { toast } from "sonner";
import {
  exportReportToExcel,
  type ReportRawAnswerRow,
} from "@/lib/exportReportToExcel";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

type SavedReport = {
  id: number;
  report_name: string;
  report_description: string | null;
  form_id: number;
  filter_site: string | null;
  filter_area: string | null;
  filter_date_from: string;
  filter_date_to: string;
  entries_count: number;
  entry_ids: number[];
  chart_type: string;
  chart_condition: string;
  chart_section_id: number | null;
  snapshot_overall_average: number | null;
  snapshot_yes_total: number | null;
  snapshot_no_total: number | null;
  snapshot_na_total: number | null;
  snapshot_total_answers: number | null;
  createdAt: string;
  form?: { id: number; form_name: string };
  chart_section?: { form_section_id: number; form_section_name: string } | null;
  report_data?: Array<{
    id: number;
    data_type: string;
    section_id: number | null;
    question_id: number | null;
    section_name: string | null;
    question_text: string | null;
    total_questions: number | null;
    total_answers: number;
    yes_count: number;
    no_count: number;
    na_count: number;
    average_percentage: number;
  }>;
};

const chartTypeLabel: Record<string, string> = {
  overall: "Overall Summary",
  per_section: "Average Per Section",
  per_question: "Average Per Question",
};

const conditionLabel: Record<string, string> = {
  Y: "Yes",
  N: "No",
  NA: "N/A",
};

export default function ViewReport() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery<SavedReport>({
    queryKey: ["saved-report", reportId],
    queryFn: async () => {
      const res = await apiGet<any>(`/saved-reports/${reportId}`);
      return res.data;
    },
    enabled: !!reportId,
  });

  const { data: entryDetails = [] } = useQuery({
    queryKey: ["report-entries", reportId],
    queryFn: async () => {
      const res = await apiPost<any>("/reports/filter-entries", {
        form_id: report!.form_id,
        site: report!.filter_site || null,
        area: report!.filter_area || null,
        date_from: report!.filter_date_from,
        date_to: report!.filter_date_to,
      });
      return res.data;
    },
    enabled: !!report,
  });

  // ✅ Export to Excel — reuses the same shared export logic as create-report
  const { mutate: exportToExcel, isPending: isExporting } = useMutation({
    mutationFn: async () => {
      const res = await apiPost<any>("/reports/raw-answers", {
        entry_ids: report!.entry_ids,
      });
      return res.data as ReportRawAnswerRow[];
    },
    onSuccess: (rawAnswers) => {
      exportReportToExcel({
        formLabel: report!.form?.form_name || "Unknown Form",
        site: report!.filter_site,
        area: report!.filter_area,
        dateFrom: report!.filter_date_from,
        dateTo: report!.filter_date_to,
        entries: entryDetails,
        rawAnswers,
      });
      toast.success("Report exported successfully");
    },
    onError: (err: any) => {
      console.error("Export error:", err);
      toast.error("Failed to export report", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-6">
        <PageHeader
          icon={
            <LuFileChartColumnIncreasing className="text-2xl text-font-main" />
          }
          title="View Report"
          buttonText="Back to Reports"
          onButtonClick={() => navigate("/reports")}
          variant="default"
        />
        <div className="bg-white shadow-md p-4 rounded mt-1">
          <div className="flex justify-center items-center h-48">
            <p className="text-gray-500">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-6">
        <PageHeader
          icon={
            <LuFileChartColumnIncreasing className="text-2xl text-font-main" />
          }
          title="View Report"
          buttonText="Back to Reports"
          onButtonClick={() => navigate("/reports")}
          variant="default"
        />
        <div className="bg-white shadow-md p-4 rounded mt-1">
          <p className="text-center text-red-500">Report not found.</p>
        </div>
      </div>
    );
  }

  const fmt = (val: number | null | undefined) => Number(val ?? 0).toFixed(2);

  const pct = (part: number | null, total: number | null) =>
    total ? ((Number(part ?? 0) / Number(total)) * 100).toFixed(1) : "0.0";

  const sectionMap: Record<
    string,
    {
      section_name: string;
      questions: NonNullable<SavedReport["report_data"]>;
    }
  > = {};

  if (report.chart_type === "per_question" && report.report_data) {
    report.report_data.forEach((item) => {
      if (item.data_type === "question" && item.section_name) {
        if (!sectionMap[item.section_name]) {
          sectionMap[item.section_name] = {
            section_name: item.section_name,
            questions: [],
          };
        }
        sectionMap[item.section_name].questions.push(item);
      }
    });
  }

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={
          <LuFileChartColumnIncreasing className="text-2xl text-font-main" />
        }
        title="View Report"
        buttonText="Back to Reports"
        onButtonClick={() => navigate("/reports")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1 space-y-8">
        {/* Phase 1: Report Filters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Report Filters
            </h2>
            <Button
              variant="buttonMainNegative"
              icon={<LuFileDown />}
              onClick={() => exportToExcel()}
              disabled={isExporting || entryDetails.length === 0}
            >
              {isExporting ? "Exporting..." : "Export to Excel"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <div className="flex flex-col space-y-2">
              <Label>Report Name</Label>
              <TextField
                variant="textFieldMain"
                value={report.report_name}
                disabled
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Form Type</Label>
              <TextField
                variant="textFieldMain"
                value={report.form?.form_name || "N/A"}
                disabled
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Site</Label>
              <TextField
                variant="textFieldMain"
                value={report.filter_site || "All Sites"}
                disabled
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Area</Label>
              <TextField
                variant="textFieldMain"
                value={report.filter_area || "All Areas"}
                disabled
              />
            </div>

            <TextField
              variant="textFieldMain"
              label="Date From"
              type="date"
              value={report.filter_date_from}
              disabled
            />

            <TextField
              variant="textFieldMain"
              label="Date To"
              type="date"
              value={report.filter_date_to}
              disabled
            />
          </div>
        </div>

        {/* Filtered Entries Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Filtered Results
            </h2>
          </div>

          <div className="bg-white shadow-md rounded overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Entry ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Form Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Site
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Area
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entryDetails.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-gray-500 text-sm"
                    >
                      No entries found
                    </td>
                  </tr>
                ) : (
                  entryDetails.map((entry: any) => (
                    <tr key={entry.entry_id}>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {entry.entry_id}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {entry.user_name}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {entry.form_name}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {entry.site}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {entry.area}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            entry.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : entry.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : entry.status.startsWith("submitted")
                                  ? "bg-blue-100 text-blue-800"
                                  : entry.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {entry.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phase 2: Chart Config */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Chart Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <div className="flex flex-col space-y-2">
              <Label>Condition</Label>
              <TextField
                variant="textFieldMain"
                value={
                  conditionLabel[report.chart_condition] ||
                  report.chart_condition
                }
                disabled
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Chart Type</Label>
              <TextField
                variant="textFieldMain"
                value={chartTypeLabel[report.chart_type] || report.chart_type}
                disabled
              />
            </div>

            {report.chart_section && (
              <div className="flex flex-col space-y-2">
                <Label>Section</Label>
                <TextField
                  variant="textFieldMain"
                  value={report.chart_section.form_section_name}
                  disabled
                />
              </div>
            )}

            <div className="flex flex-col space-y-2">
              <Label>Total Entries</Label>
              <TextField
                variant="textFieldMain"
                value={String(report.entries_count)}
                disabled
              />
            </div>
          </div>
        </div>

        {/* Phase 3: Chart Results */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <LuTrendingUp className="text-xl text-font-main" />
            <h2 className="text-lg font-semibold text-gray-700">
              Chart Results
            </h2>
          </div>

          {/* Overall Chart */}
          {report.chart_type === "overall" && (
            <div className="bg-white shadow-md rounded p-6 space-y-4">
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  Overall — {conditionLabel[report.chart_condition]} Answers
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Based on {report.entries_count} form entries
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-600 mb-2">Average Percentage</p>
                <p className="text-5xl font-bold text-blue-600">
                  {fmt(report.snapshot_overall_average)}%
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">Yes</p>
                  <p className="text-2xl font-bold text-green-600">
                    {report.snapshot_yes_total}
                  </p>
                  <p className="text-xs text-gray-500">
                    {pct(
                      report.snapshot_yes_total,
                      report.snapshot_total_answers,
                    )}
                    %
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">No</p>
                  <p className="text-2xl font-bold text-red-600">
                    {report.snapshot_no_total}
                  </p>
                  <p className="text-xs text-gray-500">
                    {pct(
                      report.snapshot_no_total,
                      report.snapshot_total_answers,
                    )}
                    %
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">N/A</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {report.snapshot_na_total}
                  </p>
                  <p className="text-xs text-gray-500">
                    {pct(
                      report.snapshot_na_total,
                      report.snapshot_total_answers,
                    )}
                    %
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded">
                <p className="font-medium mb-2">Summary:</p>
                <p>
                  Out of {report.snapshot_total_answers} total answers,{" "}
                  {fmt(report.snapshot_overall_average)}% were "
                  {conditionLabel[report.chart_condition]}" responses.
                </p>
              </div>
            </div>
          )}

          {/* Per Section Chart */}
          {report.chart_type === "per_section" && (
            <div className="bg-white shadow-md rounded p-6 space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  Average Per Section — {conditionLabel[report.chart_condition]}{" "}
                  Answers
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Based on {report.entries_count} form entries
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Overall Average Across All Sections
                </p>
                <p className="text-5xl font-bold text-blue-600">
                  {fmt(report.snapshot_overall_average)}%
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">
                  Section Breakdown:
                </h4>
                {report.report_data?.map((section) => (
                  <div key={section.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-medium text-gray-800">
                          {section.section_name}
                        </h5>
                        <p className="text-sm text-gray-500">
                          {section.total_questions} questions,{" "}
                          {section.total_answers} total answers
                        </p>
                      </div>
                      <p className="text-3xl font-bold text-blue-600">
                        {Number(section.average_percentage).toFixed(2)}%
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                        <p className="text-xs text-gray-600">Yes</p>
                        <p className="text-lg font-bold text-green-600">
                          {section.yes_count}
                        </p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                        <p className="text-xs text-gray-600">No</p>
                        <p className="text-lg font-bold text-red-600">
                          {section.no_count}
                        </p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
                        <p className="text-xs text-gray-600">N/A</p>
                        <p className="text-lg font-bold text-gray-600">
                          {section.na_count}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per Question Chart */}
          {report.chart_type === "per_question" && (
            <div className="bg-white shadow-md rounded p-6 space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  Average Per Question —{" "}
                  {conditionLabel[report.chart_condition]} Answers
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Based on {report.entries_count} form entries
                </p>
              </div>

              {Object.values(sectionMap).map((section) => {
                const chartDataForSection = section.questions.map((q, idx) => ({
                  name: `Q${idx + 1}`,
                  fullName: q.question_text,
                  percentage: Number(q.average_percentage),
                  yes: q.yes_count,
                  no: q.no_count,
                  na: q.na_count,
                }));

                return (
                  <div key={section.section_name} className="space-y-4">
                    <h4 className="font-semibold text-lg text-gray-700">
                      {section.section_name}
                    </h4>

                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={450}>
                        <BarChart
                          data={chartDataForSection}
                          margin={{ top: 40, right: 30, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={0}
                            textAnchor="middle"
                            height={60}
                            interval={0}
                            tick={{ fontSize: 13 }}
                          />
                          <YAxis
                            label={{
                              value: "Percentage (%)",
                              angle: -90,
                              position: "insideLeft",
                            }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-4 border border-gray-300 rounded shadow-lg max-w-md">
                                    <p className="font-semibold mb-2 text-sm">
                                      {data.name}: {data.fullName}
                                    </p>
                                    <p className="text-sm">
                                      <span className="font-medium">
                                        Percentage:
                                      </span>{" "}
                                      {data.percentage}%
                                    </p>
                                    <p className="text-sm text-green-600">
                                      Yes: {data.yes}
                                    </p>
                                    <p className="text-sm text-red-600">
                                      No: {data.no}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      N/A: {data.na}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend wrapperStyle={{ paddingTop: "20px" }} />
                          <Bar
                            dataKey="percentage"
                            fill="#3b82f6"
                            name={`${conditionLabel[report.chart_condition]} %`}
                            radius={[8, 8, 0, 0]}
                          >
                            {chartDataForSection.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.percentage >= 80
                                    ? "#10b981"
                                    : entry.percentage >= 50
                                      ? "#3b82f6"
                                      : "#ef4444"
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto mt-6">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              #
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Question
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Percentage
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Yes
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              No
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              N/A
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {section.questions.map((q, idx) => (
                            <tr key={q.id}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-700">
                                Q{idx + 1}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {q.question_text}
                              </td>
                              <td className="px-4 py-2 text-sm font-semibold text-blue-600">
                                {Number(q.average_percentage).toFixed(2)}%
                              </td>
                              <td className="px-4 py-2 text-sm text-green-600">
                                {q.yes_count}
                              </td>
                              <td className="px-4 py-2 text-sm text-red-600">
                                {q.no_count}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {q.na_count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="buttonMain" onClick={() => navigate("/reports")}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
