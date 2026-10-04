import { Op } from "sequelize";
import FormEntries from "../../Models/FormEntries.js";
import FormApprovers from "../../Models/FormApprovers.js";
import Forms from "../../Models/Forms.js";
import Users from "../../Models/Users.js";
import { hasRole } from "../../middleware/requireRole.js";
import {
  APPROVAL_STAGES,
  SUPER_APPROVER_ROLES,
} from "../formEntries/rules.js";

const LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const ORDINAL = { first: "1st", second: "2nd", third: "3rd" };

const fullName = (u) => (u ? `${u.user_firstname} ${u.user_lastname}` : null);
const daysSince = (date) => Math.max(0, Math.floor((Date.now() - new Date(date)) / DAY_MS));

// The dashboard's to-do lists. Both ignore the date range: they're what's
// waiting right now. `scope` is the site/area/visibility conditions (null for
// a user without a site).

// Entries waiting at a level this user may approve (approvers: their assigned
// levels; admins: every level), oldest first
export const waitingForUser = async (user, scope) => {
  if (!scope) return { total: 0, items: [] };
  const isAdmin = hasRole(user, ...SUPER_APPROVER_ROLES);

  // Approvers only see the levels they're assigned to, per form
  let levelsByForm = null;
  if (!isAdmin) {
    const assignments = await FormApprovers.findAll({
      where: { user_id: user.id, is_active: true },
      attributes: ["form_id", "approval_level"],
      raw: true,
    });
    levelsByForm = new Map();
    for (const a of assignments) {
      if (!levelsByForm.has(a.form_id)) levelsByForm.set(a.form_id, new Set());
      levelsByForm.get(a.form_id).add(a.approval_level);
    }
    if (levelsByForm.size === 0) return { total: 0, items: [] };
  }

  const entries = await FormEntries.findAll({
    where: {
      [Op.and]: [
        ...scope,
        { form_entry_status: { [Op.in]: Object.keys(APPROVAL_STAGES) } },
        ...(levelsByForm ? [{ form_id: { [Op.in]: [...levelsByForm.keys()] } }] : []),
      ],
    },
    include: [
      { model: Forms, attributes: ["id", "form_name"] },
      { model: Users, attributes: ["id", "user_firstname", "user_lastname"] },
    ],
    // An entry waiting for approval can't be edited, so its last update is
    // when it reached its current level
    order: [["updatedAt", "ASC"]],
  });

  const mine = entries.filter((e) => {
    const level = APPROVAL_STAGES[e.form_entry_status].level;
    return !levelsByForm || levelsByForm.get(e.form_id)?.has(level);
  });

  return {
    total: mine.length,
    items: mine.slice(0, LIMIT).map((e) => {
      const level = APPROVAL_STAGES[e.form_entry_status].level;
      return {
        id: e.id,
        form_name: e.Form?.form_name ?? `Form #${e.form_id}`,
        requested_by: fullName(e.User),
        area: e.form_entry_area,
        level,
        level_label: `${ORDINAL[level]} approval`,
        waiting_since: e.updatedAt,
        days_waiting: daysSince(e.updatedAt),
      };
    }),
  };
};

// Entries sent back for corrections, newest first: the user's own (`mine`),
// or every returned entry they may see, for monitoring
export const returnedEntries = async (user, scope, { mine }) => {
  if (!scope) return { total: 0, items: [] };
  const where = {
    [Op.and]: [
      ...scope,
      { form_entry_status: "returned" },
      ...(mine ? [{ user_id: user.id }] : []),
    ],
  };
  const total = await FormEntries.count({ where });
  const entries = await FormEntries.findAll({
    where,
    include: [
      { model: Forms, attributes: ["id", "form_name"] },
      { model: Users, attributes: ["id", "user_firstname", "user_lastname"] },
      { model: Users, as: "returner", attributes: ["id", "user_firstname", "user_lastname"] },
    ],
    order: [["form_entry_returner_datetime", "DESC"]],
    limit: LIMIT,
  });

  return {
    total,
    items: entries.map((e) => ({
      id: e.id,
      form_name: e.Form?.form_name ?? `Form #${e.form_id}`,
      requested_by: fullName(e.User),
      returned_by: fullName(e.returner),
      returned_at: e.form_entry_returner_datetime,
      level_label: e.form_entry_last_return_level
        ? `${ORDINAL[e.form_entry_last_return_level]} approval`
        : null,
      remarks: e.form_entry_returner_remarks,
      area: e.form_entry_area,
    })),
  };
};

// The newest entries the user may see (any status), newest first
export const recentEntries = async (scope) => {
  if (!scope) return [];
  const entries = await FormEntries.findAll({
    where: { [Op.and]: scope },
    include: [
      { model: Forms, attributes: ["id", "form_name"] },
      { model: Users, attributes: ["id", "user_firstname", "user_lastname"] },
    ],
    attributes: ["id", "form_id", "form_entry_status", "form_entry_area", "createdAt"],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: LIMIT,
  });
  return entries.map((e) => ({
    id: e.id,
    form_name: e.Form?.form_name ?? `Form #${e.form_id}`,
    status: e.form_entry_status,
    area: e.form_entry_area,
    requested_by: fullName(e.User),
    created_at: e.createdAt,
  }));
};
