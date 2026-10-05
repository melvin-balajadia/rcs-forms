import { Op } from "sequelize";
import FormEntries from "../../Models/FormEntries.js";
import { addDays, manilaDayStart } from "../../utilities/manilaTime.js";
import { countByForm } from "./charts.js";

const TOP_N = 5;

// Open work, in workflow order. Drafts are personal work in progress, and
// completed/rejected are all-time totals (completions have their own chart).
export const PIPELINE_STAGES = [
  { key: "pending", label: "Pending submission", statuses: ["pending"] },
  { key: "first", label: "Awaiting 1st approval", statuses: ["submitted_first"] },
  { key: "second", label: "Awaiting 2nd approval", statuses: ["approved_first", "submitted_second"] },
  { key: "third", label: "Awaiting 3rd approval", statuses: ["approved_second", "submitted_third"] },
  { key: "returned", label: "Returned for correction", statuses: ["returned"] },
];

// Open entries per stage right now (the date range doesn't apply). Approvers
// can't see other people's entries before they're submitted, so they get the
// stages without "pending".
export const pipeline = async (scope, { includePending }) => {
  const stages = PIPELINE_STAGES.filter((s) => includePending || s.key !== "pending");
  if (!scope) return stages.map((s) => ({ ...s, count: 0 }));

  const counts = await FormEntries.count({
    where: {
      [Op.and]: [
        ...scope,
        { form_entry_status: { [Op.in]: stages.flatMap((s) => s.statuses) } },
      ],
    },
    group: ["form_entry_status"],
  });
  const byStatus = new Map(counts.map((c) => [c.form_entry_status, Number(c.count)]));
  return stages.map((stage) => ({
    ...stage,
    count: stage.statuses.reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0),
  }));
};

// Forms whose entries were returned during the period (by the date of each
// entry's latest return, whatever the entry's status now), most first
export const mostReturned = async (scope, { from, to }) => {
  if (!scope) return { total: 0, forms: [] };
  const forms = await countByForm([
    ...scope,
    {
      form_entry_returner_datetime: {
        [Op.gte]: manilaDayStart(from),
        [Op.lt]: manilaDayStart(addDays(to, 1)),
      },
    },
  ]);
  return {
    total: forms.reduce((sum, f) => sum + f.count, 0),
    forms: forms.slice(0, TOP_N),
  };
};
