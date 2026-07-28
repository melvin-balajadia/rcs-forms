import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/page-header";
import PageTable from "@/components/comp-485";
import TextField from "@/components/textfield";
import Button from "@/components/button";
import {
  LuFileChartColumnIncreasing,
  LuSearch,
  LuTrendingUp,
  LuSave,
} from "react-icons/lu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/services/api";
import type { ColumnDef } from "@tanstack/react-table";
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

type FilterOptions = {
  forms: Array<{ value: number; label: string }>;
  sites: Array<{ value: string; label: string }>;
  areas: Array<{ value: string; label: string }>;
};

type FormEntry = {
  id: string;
  entry_id: number;
  user_name: string;
  form_name: string;
  site: string;
  area: string;
  date: string;
  status: string;
};

type Section = {
  section_id: number;
  section_name: string;
  section_description: string;
  question_count: number;
};

type ChartData = {
  chart_type: string;
  condition: string;
  condition_label: string;
  total_entries: number;
  total_questions: number;
  total_answers: number;
  breakdown: {
    yes: number;
    no: number;
    na: number;
  };
  average_percentage: number;
  section_info?: {
    section_id: number;
    section_name: string;
  };
};

type ChartDataPerSection = {
  chart_type: string;
  condition: string;
  condition_label: string;
  total_entries: number;
  sections: Array<{
    section_id: number;
    section_name: string;
    total_questions: number;
    total_answers: number;
    breakdown: {
      yes: number;
      no: number;
      na: number;
    };
    average_percentage: number;
  }>;
  overall_average: number;
};

type ChartDataPerQuestion = {
  chart_type: string;
  condition: string;
  condition_label: string;
  total_entries: number;
  sections: Array<{
    section_id: number;
    section_name: string;
    questions: Array<{
      question_id: number;
      question_text: string;
      total_answers: number;
      breakdown: {
        yes: number;
        no: number;
        na: number;
      };
      average_percentage: number;
    }>;
  }>;
};

export default function CreateReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  // Phase 1 State
  const [formData, setFormData] = useState({
    formType: "",
    area: "",
    site: "",
    dateFrom: today,
    dateTo: today,
  });

  const [filteredEntries, setFilteredEntries] = useState<FormEntry[]>([]);
  const [filterApplied, setFilterApplied] = useState(false);

  // Phase 2 State
  const [chartFilters, setChartFilters] = useState({
    condition: "",
    section: "",
    chartType: "",
  });

  const [chartData, setChartData] = useState<
    ChartData | ChartDataPerSection | ChartDataPerQuestion | null
  >(null);

  // ✅ NEW: Save Report Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveReportData, setSaveReportData] = useState({
    reportName: "",
    reportDescription: "",
  });

  // Fetch filter options
  const { data: filterOptions, isLoading: isLoadingOptions } =
    useQuery<FilterOptions>({
      queryKey: ["report-filter-options"],
      queryFn: async () => {
        const res = await apiGet<any>("/reports/filter-options");
        return res.data;
      },
    });

  // Fetch sections with "multiple" question type
  const { data: sections, isLoading: isLoadingSections } = useQuery<Section[]>({
    queryKey: ["form-sections-multiple", formData.formType],
    queryFn: async () => {
      const res = await apiGet<any>(
        `/reports/forms/${formData.formType}/sections-multiple`,
      );
      return res.data;
    },
    enabled: !!formData.formType && filterApplied && filteredEntries.length > 0,
  });

  // Filter entries mutation
  const { mutate: filterEntries, isPending: isFiltering } = useMutation({
    mutationFn: (payload: any) =>
      apiPost<any>("/reports/filter-entries", payload),
    onSuccess: (response) => {
      const mappedEntries = response.data.map((entry: any) => ({
        ...entry,
        id: String(entry.entry_id),
      }));
      setFilteredEntries(mappedEntries);
      setFilterApplied(true);
      setChartData(null);
      setChartFilters({ condition: "", section: "", chartType: "" });
      toast.success(`Found ${response.count} entries`, {
        description: "Entries filtered successfully",
      });
    },
    onError: (err: any) => {
      console.error("Filter error:", err);
      toast.error("Failed to filter entries", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  // Generate chart mutation
  const { mutate: generateChart, isPending: isGeneratingChart } = useMutation({
    mutationFn: (payload: any) => {
      let endpoint = "";

      if (payload.chart_type === "per_section") {
        endpoint = "/reports/generate-per-section-average";
      } else if (payload.chart_type === "per_question") {
        endpoint = "/reports/generate-per-question-average";
      } else {
        endpoint = "/reports/generate-overall-average";
      }

      return apiPost<any>(endpoint, payload);
    },
    onSuccess: (response) => {
      setChartData(response.data);
      toast.success("Chart generated successfully");
    },
    onError: (err: any) => {
      console.error("Chart generation error:", err);
      toast.error("Failed to generate chart", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  // ✅ NEW: Save Report Mutation
  const { mutate: saveReport, isPending: isSavingReport } = useMutation({
    mutationFn: (payload: any) => apiPost("/saved-reports/save", payload),
    onSuccess: () => {
      toast.success("Report saved successfully", {
        description: "You can view it in Saved Reports",
      });
      setIsSaveModalOpen(false);
      setSaveReportData({ reportName: "", reportDescription: "" });
    },
    onError: (err: any) => {
      console.error("Save report error:", err);
      toast.error("Failed to save report", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleChartFilterChange = (
    field: keyof typeof chartFilters,
    value: string,
  ) => {
    setChartFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    if (!formData.formType) {
      toast.warning("Form Type is required", {
        description: "Please select a form type to filter",
      });
      return;
    }

    if (!formData.dateFrom || !formData.dateTo) {
      toast.warning("Date range is required", {
        description: "Please select both From and To dates",
      });
      return;
    }

    if (new Date(formData.dateFrom) > new Date(formData.dateTo)) {
      toast.error("Invalid date range", {
        description: "Date From cannot be later than Date To",
      });
      return;
    }

    const payload = {
      form_id: Number(formData.formType),
      site: formData.site || null,
      area: formData.area || null,
      date_from: formData.dateFrom,
      date_to: formData.dateTo,
    };

    filterEntries(payload);
  };

  const handleGenerateChart = () => {
    if (!chartFilters.condition) {
      toast.warning("Condition is required", {
        description: "Please select a condition (Y/N/NA)",
      });
      return;
    }

    if (!chartFilters.chartType) {
      toast.warning("Chart type is required", {
        description: "Please select a chart type",
      });
      return;
    }

    const entryIds = filteredEntries.map((entry) => entry.entry_id);

    if (chartFilters.chartType === "per_section") {
      const payload = {
        entry_ids: entryIds,
        condition: chartFilters.condition,
        chart_type: "per_section",
      };
      generateChart(payload);
    } else if (chartFilters.chartType === "per_question") {
      const payload = {
        entry_ids: entryIds,
        condition: chartFilters.condition,
        section_id: chartFilters.section ? Number(chartFilters.section) : null,
        chart_type: "per_question",
      };
      generateChart(payload);
    } else {
      const payload = {
        entry_ids: entryIds,
        condition: chartFilters.condition,
        section_id: chartFilters.section ? Number(chartFilters.section) : null,
        chart_type: "overall",
      };
      generateChart(payload);
    }
  };

  // ✅ NEW: Handle Save Report
  const handleOpenSaveModal = () => {
    if (!chartData) {
      toast.warning("Generate a chart first", {
        description: "You need to generate a chart before saving the report",
      });
      return;
    }

    // Auto-generate a default name
    const formName =
      filterOptions?.forms.find((f) => f.value === Number(formData.formType))
        ?.label || "Report";
    const dateRange = `${formData.dateFrom} to ${formData.dateTo}`;
    const defaultName = `${formName} - ${dateRange}`;

    setSaveReportData({
      reportName: defaultName,
      reportDescription: "",
    });
    setIsSaveModalOpen(true);
  };

  const handleSaveReport = () => {
    if (!saveReportData.reportName.trim()) {
      toast.warning("Report name is required");
      return;
    }

    if (!chartData) {
      toast.error("No chart data to save");
      return;
    }

    // Calculate snapshot summary
    let snapshotData: any = {
      snapshot_overall_average: null,
      snapshot_yes_total: null,
      snapshot_no_total: null,
      snapshot_na_total: null,
      snapshot_total_answers: null,
    };

    if (chartData.chart_type === "overall") {
      const data = chartData as ChartData;
      snapshotData = {
        snapshot_overall_average: data.average_percentage,
        snapshot_yes_total: data.breakdown.yes,
        snapshot_no_total: data.breakdown.no,
        snapshot_na_total: data.breakdown.na,
        snapshot_total_answers: data.total_answers,
      };
    } else if (chartData.chart_type === "per_section") {
      const data = chartData as ChartDataPerSection;
      const totalYes = data.sections.reduce(
        (sum, s) => sum + s.breakdown.yes,
        0,
      );
      const totalNo = data.sections.reduce((sum, s) => sum + s.breakdown.no, 0);
      const totalNA = data.sections.reduce((sum, s) => sum + s.breakdown.na, 0);
      const totalAnswers = data.sections.reduce(
        (sum, s) => sum + s.total_answers,
        0,
      );

      snapshotData = {
        snapshot_overall_average: data.overall_average,
        snapshot_yes_total: totalYes,
        snapshot_no_total: totalNo,
        snapshot_na_total: totalNA,
        snapshot_total_answers: totalAnswers,
      };
    } else if (chartData.chart_type === "per_question") {
      const data = chartData as ChartDataPerQuestion;
      let totalYes = 0,
        totalNo = 0,
        totalNA = 0,
        totalAnswers = 0,
        totalPercentage = 0,
        questionCount = 0;

      data.sections.forEach((section) => {
        section.questions.forEach((q) => {
          totalYes += q.breakdown.yes;
          totalNo += q.breakdown.no;
          totalNA += q.breakdown.na;
          totalAnswers += q.total_answers;
          totalPercentage += q.average_percentage;
          questionCount++;
        });
      });

      snapshotData = {
        snapshot_overall_average:
          questionCount > 0 ? totalPercentage / questionCount : 0,
        snapshot_yes_total: totalYes,
        snapshot_no_total: totalNo,
        snapshot_na_total: totalNA,
        snapshot_total_answers: totalAnswers,
      };
    }

    const payload = {
      user_id: user?.id,
      report_name: saveReportData.reportName,
      report_description: saveReportData.reportDescription || null,
      form_id: Number(formData.formType),
      filter_site: formData.site || null,
      filter_area: formData.area || null,
      filter_date_from: formData.dateFrom,
      filter_date_to: formData.dateTo,
      entries_count: filteredEntries.length,
      entry_ids: filteredEntries.map((e) => e.entry_id),
      chart_type: chartFilters.chartType,
      chart_condition: chartFilters.condition,
      chart_section_id: chartFilters.section
        ? Number(chartFilters.section)
        : null,
      ...snapshotData,
      // Add this block:
      detailed_snapshot: (() => {
        if (chartData?.chart_type === "per_section") {
          return (chartData as ChartDataPerSection).sections.map((s) => ({
            data_type: "section",
            section_id: s.section_id,
            section_name: s.section_name,
            question_id: null,
            question_text: null,
            total_questions: s.total_questions,
            total_answers: s.total_answers,
            yes_count: s.breakdown.yes,
            no_count: s.breakdown.no,
            na_count: s.breakdown.na,
            average_percentage: s.average_percentage,
          }));
        }

        if (chartData?.chart_type === "per_question") {
          const records: any[] = [];
          (chartData as ChartDataPerQuestion).sections.forEach((section) => {
            section.questions.forEach((q) => {
              records.push({
                data_type: "question",
                section_id: section.section_id,
                section_name: section.section_name,
                question_id: q.question_id,
                question_text: q.question_text,
                total_questions: null,
                total_answers: q.total_answers,
                yes_count: q.breakdown.yes,
                no_count: q.breakdown.no,
                na_count: q.breakdown.na,
                average_percentage: q.average_percentage,
              });
            });
          });
          return records;
        }

        return null;
      })(),
    };

    saveReport(payload);
  };

  const columns: ColumnDef<FormEntry>[] = [
    { header: "Entry ID", accessorKey: "entry_id" },
    { header: "User", accessorKey: "user_name" },
    { header: "Form Name", accessorKey: "form_name" },
    { header: "Site", accessorKey: "site" },
    { header: "Area", accessorKey: "area" },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ row }) => {
        const date = new Date(row.original.date);
        return date.toLocaleDateString();
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusColors: Record<string, string> = {
          completed: "bg-green-100 text-green-800",
          pending: "bg-yellow-100 text-yellow-800",
          submitted_first: "bg-blue-100 text-blue-800",
          submitted_second: "bg-blue-100 text-blue-800",
          submitted_third: "bg-blue-100 text-blue-800",
          rejected: "bg-red-100 text-red-800",
        };
        return (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status] || "bg-gray-100 text-gray-800"}`}
          >
            {status.replace(/_/g, " ").toUpperCase()}
          </span>
        );
      },
    },
  ];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={
          <LuFileChartColumnIncreasing className="text-2xl text-font-main" />
        }
        title="Create Report"
        buttonText="View Saved Reports"
        onButtonClick={() => navigate("/reports")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        {/* Phase 1: Report Filters */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Report Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
            <div className="flex flex-col space-y-2">
              <Label>
                Form Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.formType}
                onValueChange={(val) => handleChange("formType", val)}
                disabled={isLoadingOptions}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingOptions
                        ? "Loading forms..."
                        : "Select a Form Type"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions?.forms.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Site</Label>
              <Select
                value={formData.site}
                onValueChange={(val) => handleChange("site", val)}
                disabled={isLoadingOptions}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions?.sites.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-2">
              <Label>Area</Label>
              <Select
                value={formData.area}
                onValueChange={(val) => handleChange("area", val)}
                disabled={isLoadingOptions}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions?.areas.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TextField
              variant="textFieldMain"
              label="Date From *"
              type="date"
              value={formData.dateFrom}
              onChange={(e) => handleChange("dateFrom", e.target.value)}
            />

            <TextField
              variant="textFieldMain"
              label="Date To *"
              type="date"
              value={formData.dateTo}
              onChange={(e) => handleChange("dateTo", e.target.value)}
            />

            <div className="flex items-end">
              <Button
                variant="buttonMain"
                onClick={handleSearch}
                disabled={isFiltering || isLoadingOptions}
                className="w-12 h-10 p-0 flex items-center justify-center"
              >
                <LuSearch className="text-lg" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filtered Results Table */}
        {filterApplied && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Filtered Results ({filteredEntries.length} entries)
            </h2>
            {filteredEntries.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="text-center text-gray-500">
                  <LuFileChartColumnIncreasing className="mx-auto text-4xl mb-3 text-gray-400" />
                  <p className="text-lg">No entries found</p>
                  <p className="text-sm mt-2">
                    Try adjusting your filter criteria
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow-md rounded">
                <PageTable<FormEntry>
                  data={filteredEntries}
                  columns={columns}
                  manualPagination={false}
                />
              </div>
            )}
          </div>
        )}

        {/* Phase 2: Chart Generation Filters */}
        {filterApplied && filteredEntries.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Chart Generation
            </h2>

            {sections && sections.length === 0 && !isLoadingSections && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ This form doesn't have any sections with Y/N/NA
                  (multiple-choice) questions. Chart generation is only
                  available for forms with multiple-choice questions.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-6">
              {/* Condition Dropdown */}
              <div className="flex flex-col space-y-2">
                <Label>
                  Condition <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={chartFilters.condition}
                  onValueChange={(val) =>
                    handleChartFilterChange("condition", val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Y">Yes (Y)</SelectItem>
                    <SelectItem value="N">No (N)</SelectItem>
                    <SelectItem value="NA">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chart Type Dropdown */}
              <div className="flex flex-col space-y-2">
                <Label>
                  Chart Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={chartFilters.chartType}
                  onValueChange={(val) => {
                    handleChartFilterChange("chartType", val);
                    if (val === "per_section") {
                      setChartFilters((prev) => ({ ...prev, section: "" }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Chart Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall Summary</SelectItem>
                    <SelectItem value="per_section">
                      Average Per Section
                    </SelectItem>
                    <SelectItem value="per_question">
                      Average Per Question (Bar Chart)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Section Dropdown - Show for "overall" and "per_question" */}
              {(chartFilters.chartType === "overall" ||
                chartFilters.chartType === "per_question") && (
                <div className="flex flex-col space-y-2">
                  <Label>
                    Form Section{" "}
                    {chartFilters.chartType === "per_question" && "(Optional)"}
                  </Label>
                  <Select
                    value={chartFilters.section}
                    onValueChange={(val) =>
                      handleChartFilterChange("section", val)
                    }
                    disabled={
                      isLoadingSections || !sections || sections.length === 0
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingSections
                            ? "Loading sections..."
                            : sections && sections.length === 0
                              ? "No sections with Y/N/NA questions"
                              : "All Sections"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sections && sections.length > 0 ? (
                        sections.map((section) => (
                          <SelectItem
                            key={section.section_id}
                            value={String(section.section_id)}
                          >
                            {section.section_name} ({section.question_count}{" "}
                            questions)
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="placeholder" disabled>
                          No sections available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Generate Button */}
              <div className="flex items-end">
                <Button
                  variant="buttonMain"
                  onClick={handleGenerateChart}
                  disabled={isGeneratingChart}
                >
                  <div className="flex flex-row items-center gap-2 whitespace-nowrap">
                    <LuTrendingUp className="text-base" />
                    {isGeneratingChart ? "Generating..." : "Generate Chart"}
                  </div>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Chart Display Area */}
        {chartData && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Chart Results
              </h2>
              {/* ✅ NEW: Save Report Button */}
              <Button
                variant="buttonMain"
                onClick={handleOpenSaveModal}
                disabled={isSavingReport}
              >
                <div className="flex items-center gap-2">
                  <LuSave className="text-base" />
                  Save Report
                </div>
              </Button>
            </div>

            {/* Per Question Chart with Bar Chart */}
            {chartData.chart_type === "per_question" ? (
              <div className="bg-white shadow-md rounded p-6">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="border-b pb-4">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Average Per Question -{" "}
                      {(chartData as ChartDataPerQuestion).condition_label}{" "}
                      Answers
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Based on{" "}
                      {(chartData as ChartDataPerQuestion).total_entries} form
                      entries
                    </p>
                  </div>

                  {/* Sections with Bar Charts */}
                  {(chartData as ChartDataPerQuestion).sections.map(
                    (section) => {
                      const chartDataForSection = section.questions.map(
                        (q, idx) => ({
                          name: `Q${idx + 1}`,
                          fullName: q.question_text,
                          percentage: q.average_percentage,
                          yes: q.breakdown.yes,
                          no: q.breakdown.no,
                          na: q.breakdown.na,
                        }),
                      );

                      return (
                        <div key={section.section_id} className="space-y-4">
                          <h4 className="font-semibold text-lg text-gray-700">
                            {section.section_name}
                          </h4>

                          {/* Bar Chart */}
                          <div className="flex items-center justify-center">
                            <ResponsiveContainer width="100%" height={450}>
                              <BarChart
                                data={chartDataForSection}
                                margin={{
                                  top: 40,
                                  right: 30,
                                  left: 20,
                                  bottom: 80,
                                }}
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
                                  name={`${(chartData as ChartDataPerQuestion).condition_label} %`}
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

                          {/* Question Details Table */}
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
                                  <tr key={q.question_id}>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-700">
                                      Q{idx + 1}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {q.question_text}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-semibold text-blue-600">
                                      {q.average_percentage}%
                                    </td>
                                    <td className="px-4 py-2 text-sm text-green-600">
                                      {q.breakdown.yes}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-red-600">
                                      {q.breakdown.no}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-600">
                                      {q.breakdown.na}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ) : chartData.chart_type === "per_section" ? (
              /* Per Section Chart */
              <div className="bg-white shadow-md rounded p-6">
                <div className="space-y-6">
                  <div className="border-b pb-4">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Average Per Section -{" "}
                      {(chartData as ChartDataPerSection).condition_label}{" "}
                      Answers
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Based on{" "}
                      {(chartData as ChartDataPerSection).total_entries} form
                      entries
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Overall Average Across All Sections
                    </p>
                    <p className="text-5xl font-bold text-blue-600">
                      {(chartData as ChartDataPerSection).overall_average}%
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700">
                      Section Breakdown:
                    </h4>
                    {(chartData as ChartDataPerSection).sections.map(
                      (section) => (
                        <div
                          key={section.section_id}
                          className="border rounded-lg p-4"
                        >
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
                            <div className="text-right">
                              <p className="text-3xl font-bold text-blue-600">
                                {section.average_percentage}%
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                              <p className="text-xs text-gray-600">Yes</p>
                              <p className="text-lg font-bold text-green-600">
                                {section.breakdown.yes}
                              </p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                              <p className="text-xs text-gray-600">No</p>
                              <p className="text-lg font-bold text-red-600">
                                {section.breakdown.no}
                              </p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
                              <p className="text-xs text-gray-600">N/A</p>
                              <p className="text-lg font-bold text-gray-600">
                                {section.breakdown.na}
                              </p>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Overall Chart */
              <div className="bg-white shadow-md rounded p-6">
                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {(chartData as ChartData).section_info
                        ? `${(chartData as ChartData).section_info!.section_name} - ${(chartData as ChartData).condition_label} Answers`
                        : `Overall - ${(chartData as ChartData).condition_label} Answers`}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Based on {(chartData as ChartData).total_entries} form
                      entries
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Average Percentage
                    </p>
                    <p className="text-5xl font-bold text-blue-600">
                      {(chartData as ChartData).average_percentage}%
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {(chartData as ChartData).condition_label} answers across{" "}
                      {(chartData as ChartData).total_questions} questions
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">Yes</p>
                      <p className="text-2xl font-bold text-green-600">
                        {(chartData as ChartData).breakdown.yes}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(
                          ((chartData as ChartData).breakdown.yes /
                            (chartData as ChartData).total_answers) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">No</p>
                      <p className="text-2xl font-bold text-red-600">
                        {(chartData as ChartData).breakdown.no}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(
                          ((chartData as ChartData).breakdown.no /
                            (chartData as ChartData).total_answers) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">N/A</p>
                      <p className="text-2xl font-bold text-gray-600">
                        {(chartData as ChartData).breakdown.na}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(
                          ((chartData as ChartData).breakdown.na /
                            (chartData as ChartData).total_answers) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded">
                    <p className="font-medium mb-2">Summary:</p>
                    <p>
                      Out of {(chartData as ChartData).total_answers} total
                      answers across {(chartData as ChartData).total_questions}{" "}
                      questions, {(chartData as ChartData).average_percentage}%
                      were "{(chartData as ChartData).condition_label}"
                      responses.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Placeholder when no filter applied */}
        {!filterApplied && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Filtered Results
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <div className="text-center text-gray-500">
                <LuFileChartColumnIncreasing className="mx-auto text-4xl mb-3 text-gray-400" />
                <p className="text-lg">Select filters above and click Search</p>
                <p className="text-sm mt-2">
                  Results will be displayed here once you apply filters
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ✅ NEW: Save Report Modal */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
            <DialogDescription>
              Save this report configuration and data for future reference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">
                Report Name <span className="text-red-500">*</span>
              </Label>
              <TextField
                variant="textFieldMain"
                value={saveReportData.reportName}
                onChange={(e) =>
                  setSaveReportData((prev) => ({
                    ...prev,
                    reportName: e.target.value,
                  }))
                }
                placeholder="e.g., Q1 2024 Product Receiving Report"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-description">Description (Optional)</Label>
              <Textarea
                id="report-description"
                value={saveReportData.reportDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setSaveReportData((prev) => ({
                    ...prev,
                    reportDescription: e.target.value,
                  }))
                }
                placeholder="Add notes or context about this report..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 p-3 rounded text-sm">
              <p className="font-medium mb-2">Report Summary:</p>
              <ul className="space-y-1 text-gray-600">
                <li>
                  • Form:{" "}
                  {
                    filterOptions?.forms.find(
                      (f) => f.value === Number(formData.formType),
                    )?.label
                  }
                </li>
                <li>
                  • Date Range: {formData.dateFrom} to {formData.dateTo}
                </li>
                <li>• Entries: {filteredEntries.length}</li>
                <li>
                  • Chart Type:{" "}
                  {chartFilters.chartType === "per_section"
                    ? "Average Per Section"
                    : chartFilters.chartType === "per_question"
                      ? "Average Per Question"
                      : "Overall Summary"}
                </li>
                <li>
                  • Condition:{" "}
                  {chartFilters.condition === "Y"
                    ? "Yes"
                    : chartFilters.condition === "N"
                      ? "No"
                      : "N/A"}
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="buttonMain"
              onClick={() => setIsSaveModalOpen(false)}
              disabled={isSavingReport}
            >
              Cancel
            </Button>
            <Button
              variant="buttonMain"
              onClick={handleSaveReport}
              disabled={isSavingReport}
            >
              {isSavingReport ? "Saving..." : "Save Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
