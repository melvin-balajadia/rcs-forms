import { describe, it, expect, beforeEach } from "vitest";
import FormEntries from "../Models/FormEntries.js";
import FormSection from "../Models/FormSection.js";
import Questions from "../Models/Questions.js";
import FormQuestionValue from "../Models/FormQuestionValue.js";
import { EDIT_TRANSITIONS } from "../utilities/entryStatus.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  assignApprover,
  authHeader,
} from "./helpers.js";

const ALL_STATUSES = [
  "draft",
  "pending",
  "returned",
  "submitted_first",
  "approved_first",
  "submitted_second",
  "approved_second",
  "submitted_third",
  "completed",
  "rejected",
];

// A complete, valid set of entry details for "pending" saves
const DETAILS = {
  form_entry_site: "Taytay",
  form_entry_area: "Main",
  form_entry_date: "2026-10-01",
};

const addQuestion = async (form, text = "Is the room clean?") => {
  const section = await FormSection.create({
    form_id: form.id,
    form_section_name: "Section",
  });
  return Questions.create({
    form_id: form.id,
    form_section_id: section.form_section_id,
    form_questions: text,
    question_type: "multiple",
  });
};

describe("entry status rules", () => {
  let owner, approver, admin, form, question;

  beforeEach(async () => {
    await resetDb();
    owner = await createUser("requestor");
    approver = await createUser("approver");
    admin = await createUser("all_access");
    form = await createForm();
    question = await addQuestion(form);
  });

  const answer = (q = question) => [
    { form_question_id: q.id, form_value: "Y", sub_values: [] },
  ];

  const create = (status, who = owner) =>
    api
      .post("/api/form-entries/create-builder")
      .set(authHeader(who))
      .send({
        form_id: form.id,
        form_entry_status: status,
        ...DETAILS,
        responses: answer(),
      });

  const update = (entry, status, extra = {}, who = owner) =>
    api
      .put(`/api/form-entries/update-builder/${entry.id}`)
      .set(authHeader(who))
      .send({
        form_entry_id: entry.id,
        form_id: form.id,
        form_entry_status: status,
        ...DETAILS,
        responses: answer(),
        ...extra,
      });

  const entryIn = (status) =>
    FormEntries.create({
      user_id: owner.id,
      form_id: form.id,
      form_entry_status: status,
    });

  describe("create-builder", () => {
    it.each(["draft", "pending"])("allows starting as %s", async (status) => {
      const res = await create(status);
      expect(res.status).toBe(201);
    });

    it.each(ALL_STATUSES.filter((s) => !["draft", "pending"].includes(s)))(
      "refuses starting as %s",
      async (status) => {
        const res = await create(status);
        expect(res.status).toBe(400);
        expect(await FormEntries.count()).toBe(0);
      },
    );

    it("an admin can't create an entry already completed either", async () => {
      const res = await create("completed", admin);
      expect(res.status).toBe(400);
    });
  });

  describe("update-builder", () => {
    // Every (current, next) pair: allowed exactly when EDIT_TRANSITIONS says so
    const pairs = ALL_STATUSES.flatMap((from) =>
      ALL_STATUSES.map((to) => [from, to]),
    );

    it.each(pairs)("%s → %s", async (from, to) => {
      const entry = await entryIn(from);
      const res = await update(entry, to);
      const allowed = (EDIT_TRANSITIONS[from] || []).includes(to);

      await entry.reload();
      if (allowed) {
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(entry.form_entry_status).toBe(to);
      } else {
        expect(res.status).toBe(400);
        expect(entry.form_entry_status).toBe(from);
      }
    });

    it("answers on a completed entry can't be rewritten", async () => {
      const entry = await entryIn("completed");
      await FormQuestionValue.create({
        form_entry_id: entry.id,
        form_id: form.id,
        form_section_id: question.form_section_id,
        form_question_id: question.id,
        form_value: "N",
      });

      await update(entry, "completed", {
        responses: [{ form_question_id: question.id, form_value: "Y" }],
      });

      const value = await FormQuestionValue.findOne({
        where: { form_entry_id: entry.id },
      });
      expect(value.form_value).toBe("N");
    });

    it("uses the entry id from the URL, not the body", async () => {
      const mine = await entryIn("draft");
      const other = await FormEntries.create({
        user_id: (await createUser("requestor")).id,
        form_id: form.id,
        form_entry_status: "draft",
      });

      // URL says my entry; body points at someone else's
      const res = await update(mine, "draft", { form_entry_id: other.id });
      expect(res.status).toBe(200);
      await other.reload();
      expect(other.form_entry_site).toBeNull();
      await mine.reload();
      expect(mine.form_entry_site).toBe("Taytay");
    });

    it("checks questions against the entry's own form, not the body form_id", async () => {
      const otherForm = await createForm({ form_name: "Other form" });
      const foreignQuestion = await addQuestion(otherForm, "Other question");
      const entry = await entryIn("draft");

      // Claims to be the other form so its question would pass validation
      const res = await update(entry, "draft", {
        form_id: otherForm.id,
        responses: answer(foreignQuestion),
      });
      expect(res.status).toBe(400);
      expect(
        await FormQuestionValue.count({ where: { form_entry_id: entry.id } }),
      ).toBe(0);
    });
  });

  describe("full workflow still works", () => {
    const approve = () =>
      api
        .post("/api/form-entries/approve")
        .set(authHeader(approver))
        .send({ form_entry_id: entryId, action: "approve" });
    let entryId;

    beforeEach(async () => {
      for (const level of ["first", "second", "third"])
        await assignApprover(form, approver, level);
    });

    const submit = () =>
      api
        .post("/api/form-entries/submit-approval")
        .set(authHeader(owner))
        .send({ form_entry_id: entryId });

    it("create → submit → approve ×3 → completed", async () => {
      const created = await create("pending");
      expect(created.status).toBe(201);
      entryId = created.body.entry.id;

      expect((await submit()).status).toBe(200);
      for (const expected of ["approved_first", "approved_second", "completed"]) {
        expect((await approve()).status).toBe(200);
        const entry = await FormEntries.findByPk(entryId);
        expect(entry.form_entry_status).toBe(expected);
      }
    });

    it("return → edit → resubmit → approve", async () => {
      entryId = (await create("pending")).body.entry.id;
      await submit();

      const returned = await api
        .post("/api/form-entries/return")
        .set(authHeader(approver))
        .send({ form_entry_id: entryId, remarks: "fix it" });
      expect(returned.status).toBe(200);

      const entry = await FormEntries.findByPk(entryId);
      expect((await update(entry, "returned")).status).toBe(200);
      expect((await update(entry, "pending")).status).toBe(200);
      expect((await submit()).status).toBe(200);
      expect((await approve()).status).toBe(200);
    });
  });
});
