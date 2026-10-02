import { z } from "zod";

// Request body schemas, used with middleware/validate.js.
//
// They check types and sizes only and let extra fields through (passthrough),
// so the client can keep sending fields the server ignores. Missing required
// fields are reported by the controllers, which word those messages for the UI.

export const MAX_REPORT_ENTRIES = 10_000;

// Ids arrive as numbers, or as numeric strings from <select> values
const id = z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]);
const text = (max) => z.string().max(max).nullish();
const SHORT = 255;
const LONG = 5000;
const answer = z.union([z.string().max(LONG), z.number(), z.boolean()]).nullish();
const flag = z.union([z.boolean(), z.number()]).nullish();
const obj = (shape) => z.object(shape).passthrough();

// ---------- Auth and users ----------

export const loginSchema = obj({
  user_username: text(100),
  user_password: text(200),
});

export const resetPasswordSchema = obj({
  resetToken: text(2000),
  newPassword: text(200),
  confirmPassword: text(200),
});

export const userSchema = obj({
  user_firstname: text(SHORT),
  user_middlename: text(SHORT),
  user_lastname: text(SHORT),
  user_email: text(SHORT),
  user_contact: text(SHORT),
  user_address: text(SHORT),
  user_groups: z.array(z.string().max(30)).max(4).nullish(),
  user_department: text(SHORT),
  user_site: text(SHORT),
  user_username: text(100),
  user_password: text(200),
});

export const adminResetPasswordSchema = obj({ password: text(200) });

// ---------- Form entries ----------

const subValue = obj({
  sub_question_id: id.nullish(),
  form_sub_value: answer,
  remarks: text(LONG),
  action_item: text(LONG),
});

const response = obj({
  form_question_id: id,
  form_value: answer,
  remarks: text(LONG),
  action_item: text(LONG),
  sub_values: z.array(subValue).max(500).nullish(),
});

export const formEntryBuilderSchema = obj({
  form_id: id.nullish(),
  form_entry_site: text(SHORT),
  form_entry_area: text(SHORT),
  form_entry_date: text(30),
  form_entry_status: text(30),
  responses: z.array(response).max(2000).nullish(),
});

export const entryActionSchema = obj({
  form_entry_id: id.nullish(),
  action: text(20),
  remarks: text(LONG),
});

// ---------- Approver assignments ----------

export const userApprovalsSchema = obj({
  assignments: z
    .array(obj({ form_id: id, levels: z.array(z.string().max(10)).max(3) }))
    .max(1000)
    .nullish(),
});

const approverIds = z.array(id).max(500);
export const formApproversSchema = obj({
  assignments: obj({
    first: approverIds.nullish(),
    second: approverIds.nullish(),
    third: approverIds.nullish(),
  }).nullish(),
});

// ---------- Forms ----------

const subQuestion = obj({
  sub_question_id: id.nullish(),
  sub_questions: text(LONG),
  question_type: text(50),
  required: flag,
  choices: z.array(z.string().max(1000)).max(500).nullish(),
  delete: z.boolean().nullish(),
});

const question = obj({
  form_question_id: id.nullish(),
  form_questions: text(LONG),
  question_type: text(50),
  required: flag,
  choices: z.array(z.string().max(1000)).max(500).nullish(),
  delete: z.boolean().nullish(),
  subQuestions: z.array(subQuestion).max(200).nullish(),
});

const section = obj({
  form_section_id: id.nullish(),
  form_section_name: text(SHORT),
  form_section_description: text(LONG),
  delete: z.boolean().nullish(),
  questions: z.array(question).max(500).nullish(),
});

export const formBuilderSchema = obj({
  form_id: id.nullish(),
  form_name: text(SHORT),
  form_description: text(LONG),
  form_effective_date: text(30),
  form_revision_number: z.union([z.string().max(50), z.number()]).nullish(),
  sections: z.array(section).max(200).nullish(),
});

export const formSchema = obj({
  form_name: text(SHORT),
  form_description: text(LONG),
});

// ---------- Reports ----------

const reportEntryIds = z
  .array(id)
  .max(MAX_REPORT_ENTRIES, {
    message: `this report covers too many entries (max ${MAX_REPORT_ENTRIES.toLocaleString("en-US")}). Narrow the date range or filters.`,
  })
  .nullish();

export const reportFilterSchema = obj({
  form_id: id.nullish(),
  site: text(SHORT),
  area: text(SHORT),
  date_from: text(30),
  date_to: text(30),
});

export const reportEntriesSchema = obj({
  entry_ids: reportEntryIds,
  condition: text(10),
  section_id: id.nullish(),
});

const snapshotNumber = z.union([z.number(), z.string().max(30)]).nullish();
export const saveReportSchema = obj({
  report_name: text(SHORT),
  report_description: text(LONG),
  form_id: id.nullish(),
  filter_site: text(SHORT),
  filter_area: text(SHORT),
  filter_date_from: text(30),
  filter_date_to: text(30),
  entries_count: z.number().int().nonnegative().nullish(),
  entry_ids: reportEntryIds,
  chart_type: text(50),
  chart_condition: text(10),
  chart_section_id: id.nullish(),
  snapshot_overall_average: snapshotNumber,
  snapshot_yes_total: snapshotNumber,
  snapshot_no_total: snapshotNumber,
  snapshot_na_total: snapshotNumber,
  snapshot_total_answers: snapshotNumber,
  detailed_snapshot: z.array(obj({})).max(20_000).nullish(),
});

export const updateSavedReportSchema = obj({
  report_name: text(SHORT),
  report_description: text(LONG),
});

// ---------- Clients and rooms ----------

export const clientSchema = obj({
  clients_name: text(SHORT),
  clients_description: text(LONG),
  clients_site: text(SHORT),
});

export const roomSchema = obj({
  room_name: text(SHORT),
  room_description: text(LONG),
  room_site: text(SHORT),
  room_location: text(SHORT),
});
