import Users from "../../Models/Users.js";
import Forms from "../../Models/Forms.js";
import { findVisibleEntry } from "../../utilities/formEntryVisibility.js";
import { fail } from "../../utilities/http.js";

const person = ["id", "user_firstname", "user_lastname", "user_email"];
const HISTORY_INCLUDE = [
  { model: Users, as: "User", attributes: person },
  { model: Users, as: "firstApprover", attributes: person },
  { model: Users, as: "secondApprover", attributes: person },
  { model: Users, as: "thirdApprover", attributes: person },
  { model: Users, as: "rejector", attributes: person },
  { model: Users, as: "returner", attributes: person },
  { model: Forms, attributes: ["id", "form_name"] },
];

const summary = (user) =>
  user
    ? {
        id: user.id,
        name: `${user.user_firstname} ${user.user_lastname}`,
        email: user.user_email,
      }
    : null;

const ORDINAL = { first: "1st", second: "2nd", third: "3rd" };

// Timeline of an entry's approval workflow, oldest first
export const getApprovalHistory = async (req, entryId) => {
  const entry = await findVisibleEntry(req, entryId, { include: HISTORY_INCLUDE });
  if (!entry) fail(404, "Form entry not found");

  const event = (action, actionLabel, user, datetime, remarks = null) => ({
    action,
    actionLabel,
    user: summary(user),
    datetime,
    remarks,
  });

  const timeline = [event("submitted", "Form Submitted", entry.User, entry.createdAt)];

  for (const level of ["first", "second", "third"]) {
    if (entry[`form_entry_${level}approver_id`]) {
      timeline.push(
        event(
          `approved_${level}`,
          `${ORDINAL[level]} Approval - Approved`,
          entry[`${level}Approver`],
          entry[`form_entry_${level}approver_datetime`],
          entry[`form_entry_${level}approver_remarks`],
        ),
      );
    }
  }

  if (entry.form_entry_returner_id) {
    const level = ORDINAL[entry.form_entry_last_return_level] ?? "3rd";
    timeline.push(
      event(
        "returned",
        `Form Returned from ${level} Approval`,
        entry.returner,
        entry.form_entry_returner_datetime,
        entry.form_entry_returner_remarks,
      ),
    );
  }

  if (entry.form_entry_resubmitted_datetime) {
    timeline.push(
      event("resubmitted", "Form Resubmitted", entry.User, entry.form_entry_resubmitted_datetime),
    );
  }

  if (entry.form_entry_rejector_id) {
    timeline.push(
      event(
        "rejected",
        "Form Rejected",
        entry.rejector,
        entry.form_entry_rejector_datetime,
        entry.form_entry_rejector_remarks,
      ),
    );
  }

  if (entry.form_entry_status === "completed") {
    timeline.push(event("completed", "Form Completed", null, entry.updatedAt));
  }

  timeline.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  return {
    formEntry: {
      id: entry.id,
      form_name: entry.Form?.form_name,
      status: entry.form_entry_status,
      site: entry.form_entry_site,
      area: entry.form_entry_area,
      date: entry.form_entry_date,
      returnCount: entry.form_entry_return_count,
    },
    timeline,
  };
};
