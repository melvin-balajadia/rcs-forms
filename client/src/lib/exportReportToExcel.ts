import * as XLSX from "xlsx";

export type ReportEntryRow = {
  entry_id: number;
  form_name: string;
  user_name: string;
  site: string;
  area: string;
  date: string;
  status: string;
};

export type ReportRawAnswerRow = {
  entry_id: number;
  date: string | null;
  site: string | null;
  area: string | null;
  section_name: string | null;
  question_text: string | null;
  answer: string;
  remarks: string;
  action_item: string;
};

type ExportReportParams = {
  formLabel: string;
  site: string | null;
  area: string | null;
  dateFrom: string;
  dateTo: string;
  entries: ReportEntryRow[];
  rawAnswers: ReportRawAnswerRow[];
};

// ✅ Shared by both "Export to Excel" entry points (create-report and
// view-report) so the exported file's structure stays identical no matter
// where the export was triggered from.
export function exportReportToExcel({
  formLabel,
  site,
  area,
  dateFrom,
  dateTo,
  entries,
  rawAnswers,
}: ExportReportParams) {
  const entriesSheetData = entries.map((e) => ({
    "Entry ID": e.entry_id,
    Form: e.form_name,
    "Submitted By": e.user_name,
    Site: e.site,
    Area: e.area,
    Date: e.date ? new Date(e.date).toLocaleDateString() : "",
    Status: (e.status || "").replace(/_/g, " ").toUpperCase(),
  }));

  const rawAnswersSheetData = rawAnswers.map((r) => ({
    "Entry ID": r.entry_id,
    Date: r.date ? new Date(r.date).toLocaleDateString() : "",
    Site: r.site,
    Area: r.area,
    Section: r.section_name,
    Question: r.question_text,
    Answer: r.answer,
    Remarks: r.remarks,
    "Action Item": r.action_item,
  }));

  const yesCount = rawAnswers.filter((r) => r.answer === "Yes").length;
  const noCount = rawAnswers.filter((r) => r.answer === "No").length;
  const naCount = rawAnswers.filter((r) => r.answer === "N/A").length;
  const totalAnswers = rawAnswers.length;
  const overallAveragePct =
    yesCount + noCount > 0
      ? ((yesCount / (yesCount + noCount)) * 100).toFixed(1) + "%"
      : "N/A";

  const summarySheetData = [
    { Field: "Form", Value: formLabel },
    { Field: "Site", Value: site || "All Sites" },
    { Field: "Area", Value: area || "All Areas" },
    { Field: "Date From", Value: dateFrom },
    { Field: "Date To", Value: dateTo },
    { Field: "", Value: "" },
    { Field: "Total Entries", Value: entries.length },
    { Field: "Total Answers", Value: totalAnswers },
    { Field: "Yes", Value: yesCount },
    { Field: "No", Value: noCount },
    { Field: "N/A", Value: naCount },
    { Field: "Overall Average (Yes %)", Value: overallAveragePct },
  ];

  const wb = XLSX.utils.book_new();

  const wsEntries = XLSX.utils.json_to_sheet(entriesSheetData);
  wsEntries["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
  ];
  // ✅ Adds clickable dropdown filter arrows on the header row, so a large
  // export (e.g. a full month) can be filtered down in Excel itself.
  wsEntries["!autofilter"] = { ref: wsEntries["!ref"] ?? "A1" };
  XLSX.utils.book_append_sheet(wb, wsEntries, "Entries");

  const wsRaw = XLSX.utils.json_to_sheet(rawAnswersSheetData);
  wsRaw["!cols"] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 46 },
    { wch: 8 },
    { wch: 34 },
    { wch: 30 },
  ];
  wsRaw["!autofilter"] = { ref: wsRaw["!ref"] ?? "A1" };
  XLSX.utils.book_append_sheet(wb, wsRaw, "Raw Answers");

  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData, {
    skipHeader: true,
  });
  wsSummary["!cols"] = [{ wch: 26 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  const fileName = `${formLabel.replace(/[^a-z0-9]+/gi, "_")}_report_${dateFrom}_to_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
