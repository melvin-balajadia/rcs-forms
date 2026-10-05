import Question from "../../Models/Questions.js";
import SubQuestion from "../../Models/SubQuestion.js";
import { fail } from "../../utilities/http.js";

export const VALID_SITES = ["Taytay", "Cabuyao", "Plaridel", "Marilao", "Villasis"];

// Roles that may create, edit and submit entries
export const ENTRY_AUTHOR_ROLES = ["requestor", "all_access", "qfd_admin"];
// Roles that may approve, reject and return entries
export const APPROVER_ROLES = ["approver", "all_access", "qfd_admin"];
// Approve or return at any level without a FormApprovers assignment
export const SUPER_APPROVER_ROLES = ["all_access", "qfd_admin"];

export const rolesOf = (user) =>
  Array.isArray(user?.user_groups) ? user.user_groups : [];

export const hasAnyRole = (user, roles) =>
  rolesOf(user).some((role) => roles.includes(role));

// Approval stages, keyed by the entry's current status: which approver level
// acts next, the status an approval moves it to, and the columns recording
// that approval. An entry can be returned from exactly these statuses.
const stage = (level, approvedStatus) => ({
  level,
  approvedStatus,
  idField: `form_entry_${level}approver_id`,
  datetimeField: `form_entry_${level}approver_datetime`,
  remarksField: `form_entry_${level}approver_remarks`,
});
export const APPROVAL_STAGES = {
  submitted_first: stage("first", "approved_first"),
  approved_first: stage("second", "approved_second"),
  submitted_second: stage("second", "approved_second"),
  approved_second: stage("third", "completed"),
  submitted_third: stage("third", "completed"),
};

const invalidSite = (site) =>
  fail(
    400,
    `Invalid site value '${site}'. Must be one of: ${VALID_SITES.join(", ")}.`,
  );

// Cross-checks a form's required questions/sub-questions against the
// submitted responses, returning the text of any that are missing/blank.
export const findMissingRequiredAnswers = async (form_id, responses) => {
  const requiredQuestions = await Question.findAll({
    where: { form_id, form_questions_archivestatus: 0, required: true },
    attributes: ["id", "form_questions"],
  });

  const requiredSubQuestions = await SubQuestion.findAll({
    where: { required: true, sub_question_archivestatus: 0 },
    include: [
      {
        model: Question,
        as: "question",
        where: { form_id, form_questions_archivestatus: 0 },
        attributes: [],
      },
    ],
    attributes: ["sub_question_id", "sub_questions"],
  });

  const responseByQuestion = new Map(
    (responses || []).map((r) => [Number(r.form_question_id), r]),
  );
  const subValueBySubQuestion = new Map();
  for (const r of responses || []) {
    for (const sv of r.sub_values || []) {
      subValueBySubQuestion.set(Number(sv.sub_question_id), sv);
    }
  }

  const missing = [];
  for (const q of requiredQuestions) {
    const r = responseByQuestion.get(q.id);
    if (!r || !String(r.form_value ?? "").trim()) missing.push(q.form_questions);
  }
  for (const sq of requiredSubQuestions) {
    const sv = subValueBySubQuestion.get(sq.sub_question_id);
    if (!sv || !String(sv.form_sub_value ?? "").trim()) {
      missing.push(sq.sub_questions);
    }
  }
  return missing;
};

// Entry details required before an entry can be "pending" (ready to submit):
// site, area, date, at least one response, and every required question
// answered. Other statuses only check the site's format when one is given.
export const checkEntryDetails = async (
  status,
  { form_id, form_entry_site, form_entry_area, form_entry_date, responses },
  relaxedStatuses,
) => {
  if (status === "pending") {
    if (!form_entry_site) fail(400, "Site is required for submitted forms");
    if (!VALID_SITES.includes(form_entry_site)) invalidSite(form_entry_site);
    if (!form_entry_area) fail(400, "Area is required for submitted forms");
    if (!form_entry_date) fail(400, "Date is required for submitted forms");
    if (!responses || responses.length === 0) {
      fail(400, "At least one response is required for submitted forms");
    }

    const missing = await findMissingRequiredAnswers(form_id, responses);
    if (missing.length > 0) {
      fail(
        400,
        `Please answer all required questions before submitting: ${missing.join(", ")}`,
      );
    }
  } else if (relaxedStatuses.includes(status)) {
    if (form_entry_site && !VALID_SITES.includes(form_entry_site)) {
      invalidSite(form_entry_site);
    }
  }
};
