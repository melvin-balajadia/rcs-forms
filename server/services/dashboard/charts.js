import { Op } from "sequelize";
import FormEntries from "../../Models/FormEntries.js";
import Forms from "../../Models/Forms.js";
import { getFormEntryVisibility } from "../../utilities/formEntryVisibility.js";
import { hasRole } from "../../middleware/requireRole.js";
import { fail } from "../../utilities/http.js";
import {
  isDay,
  manilaDay,
  manilaToday,
  manilaDayStart,
  addDays,
  eachDay,
  daysBetween,
} from "../../utilities/manilaTime.js";
import { VALID_SITES } from "../formEntries/rules.js";

export const AREAS = ["Main", "Annex"];
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

// The dashboard's filters, resolved for this user:
//   site  — always the user's own site; only all_access may pick another
//   area  — "Main", "Annex", or null for both
//   from/to — Manila calendar days, inclusive (default: the last 30 days)
export const resolveDashboardFilters = (user, query) => {
  const to = query.to ?? manilaToday();
  const from = query.from ?? addDays(to, -(DEFAULT_DAYS - 1));
  if (!isDay(from) || !isDay(to) || from > to) fail(400, "Invalid date range");
  if (daysBetween(from, to) >= MAX_DAYS) {
    fail(400, `Date range is too long (max ${MAX_DAYS} days)`);
  }

  const canChooseSite = hasRole(user, "all_access");
  let site = user.user_site || null;
  if (canChooseSite && query.site) {
    if (!VALID_SITES.includes(query.site)) fail(400, "Invalid site");
    site = query.site;
  }

  const area = query.area && query.area !== "All" ? query.area : null;
  if (area && !AREAS.includes(area)) fail(400, "Invalid area");

  return { from, to, site, area, canChooseSite };
};

// Entries this user may see, at the dashboard's site and area
export const scopeConditions = async (req, { site, area }) => {
  const { condition } = await getFormEntryVisibility(req);
  return [
    { form_entry_site: site },
    ...(area ? [{ form_entry_area: area }] : []),
    ...(condition ? [condition] : []),
  ];
};

const emptyDay = (date) => ({ date, Main: 0, Annex: 0, Other: 0, total: 0 });

// Forms accomplished per day: completed entries, dated by their final (third)
// approval, grouped by Manila day and area. Every day in the range is listed.
export const accomplishedPerDay = async (scope, { from, to }) => {
  const days = eachDay(from, to).map(emptyDay);
  const byArea = { Main: 0, Annex: 0, Other: 0 };
  if (!scope) return { total: 0, byArea, days };

  const completed = await FormEntries.findAll({
    where: {
      [Op.and]: [
        ...scope,
        { form_entry_status: "completed" },
        {
          form_entry_thirdapprover_datetime: {
            [Op.gte]: manilaDayStart(from),
            [Op.lt]: manilaDayStart(addDays(to, 1)),
          },
        },
      ],
    },
    attributes: ["form_entry_area", "form_entry_thirdapprover_datetime"],
    raw: true,
  });

  const byDay = new Map(days.map((d) => [d.date, d]));
  for (const row of completed) {
    const day = byDay.get(manilaDay(row.form_entry_thirdapprover_datetime));
    if (!day) continue;
    const key = AREAS.includes(row.form_entry_area) ? row.form_entry_area : "Other";
    day[key] += 1;
    day.total += 1;
    byArea[key] += 1;
  }
  return { total: completed.length, byArea, days };
};

// Entries per form, by entry date (the date chosen on the form), counted in
// the database, most first
export const entriesPerForm = async (scope, { from, to }) => {
  if (!scope) return { total: 0, forms: [] };
  const forms = await countByForm([
    ...scope,
    { form_entry_date: { [Op.gte]: from, [Op.lt]: addDays(to, 1) } },
  ]);
  return { total: forms.reduce((sum, f) => sum + f.count, 0), forms };
};

// Entries matching `conditions`, counted per form, with each form's name
export const countByForm = async (conditions) => {
  const counts = await FormEntries.count({
    where: { [Op.and]: conditions },
    group: ["form_id"],
  });
  const forms = await Forms.findAll({
    where: { id: counts.map((c) => c.form_id) },
    attributes: ["id", "form_name"],
  });
  const nameOf = new Map(forms.map((f) => [f.id, f.form_name]));
  return counts
    .map((c) => ({
      form_id: c.form_id,
      form_name: nameOf.get(c.form_id) ?? `Form #${c.form_id}`,
      count: Number(c.count),
    }))
    .sort((a, b) => b.count - a.count || a.form_name.localeCompare(b.form_name));
};
