import { Op } from "sequelize";
import FormEntries from "../../Models/FormEntries.js";
import Forms from "../../Models/Forms.js";
import Users from "../../Models/Users.js";
import FormQuestionValue from "../../Models/FormQuestionValue.js";
import FormQuestionSubValue from "../../Models/FormQuestionSubValue.js";
import SubQuestion from "../../Models/SubQuestion.js";
import {
  getFormEntryVisibility,
  findVisibleEntry,
} from "../../utilities/formEntryVisibility.js";
import { getPagination } from "../../utilities/pagination.js";
import { fail } from "../../utilities/http.js";

// Every entry (admin-only route, not used by the UI)
export const listAllEntries = () => FormEntries.findAll({ include: Users });

// The entry list, scoped to what the caller may see, with optional filters
export const listEntries = async (req) => {
  const { page, pageSize, offset } = getPagination(req.query);
  const { id, user_id, form_id, site, area, from, to, status } = req.query;

  const where = {};
  if (id) where.id = id;
  if (form_id) where.form_id = form_id;
  if (site) where.form_entry_site = { [Op.like]: `%${site}%` };
  if (area) where.form_entry_area = { [Op.like]: `%${area}%` };
  if (from && to) where.form_entry_date = { [Op.between]: [from, to] };

  // A single status or a comma-separated list (some display labels like
  // "Awaiting 2nd Approval" map to more than one underlying status)
  if (status) {
    const statuses = String(status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) where.form_entry_status = { [Op.in]: statuses };
  }

  // Requestors see their own entries, approvers also those awaiting them,
  // all_access/qfd_admin see everything
  const { currentUser, isAdmin, condition } = await getFormEntryVisibility(req);
  if (!currentUser) fail(401, "Invalid session");

  if (isAdmin) {
    // Admins may still narrow the list to a specific requestor
    if (user_id) where.user_id = user_id;
  } else {
    where[Op.and] = [condition];
  }

  const { rows: entries, count } = await FormEntries.findAndCountAll({
    where,
    include: [
      {
        model: Users,
        attributes: [
          "id",
          "user_username",
          "user_email",
          "user_firstname",
          "user_lastname",
        ],
      },
      { model: Forms, attributes: ["id", "form_name"] },
    ],
    order: [["id", "DESC"]],
    limit: pageSize,
    offset,
  });

  return {
    message: "Form entries fetched successfully",
    total: count,
    totalPages: Math.ceil(count / pageSize),
    currentPage: page,
    pageSize,
    entries,
  };
};

export const getEntry = async (req, entryId) => {
  const entry = await findVisibleEntry(req, entryId, {
    include: [
      Users,
      Forms,
      {
        model: Users,
        as: "returner",
        attributes: ["id", "user_firstname", "user_lastname"],
      },
    ],
  });
  if (!entry) fail(404, "Form entry not found");
  return entry;
};

// Answers are only readable by someone who may see the entry itself
export const getEntryAnswers = async (req, entryId) => {
  if (!(await findVisibleEntry(req, entryId))) fail(404, "Form entry not found");

  return FormQuestionValue.findAll({
    where: { form_entry_id: entryId },
    include: [
      {
        model: FormQuestionSubValue,
        foreignKey: "form_question_value_id",
        required: false,
        include: [
          {
            model: SubQuestion,
            foreignKey: "sub_question_id",
            attributes: [
              "sub_question_id",
              "question_id",
              "sub_questions",
              "question_type",
            ],
            required: false,
          },
        ],
      },
    ],
    order: [
      ["form_section_id", "ASC"],
      ["form_question_id", "ASC"],
    ],
  });
};

// Archive: hidden everywhere (lists, reports, dashboard), nothing deleted
export const archiveEntry = async (entryId) => {
  const entry = await FormEntries.findByPk(entryId);
  if (!entry) fail(404, "Form entry not found");
  await entry.update({ form_entry_archivestatus: 1 });
};
