import { describe, it, expect, beforeEach } from "vitest";
import FormEntries from "../Models/FormEntries.js";
import Forms from "../Models/Forms.js";
import FormSection from "../Models/FormSection.js";
import Questions from "../Models/Questions.js";
import SubQuestion from "../Models/SubQuestion.js";
import FormQuestionValue from "../Models/FormQuestionValue.js";
import FormApprovers from "../Models/FormApprovers.js";
import Clients from "../Models/Clients.js";
import SavedReport from "../Models/Reports.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  assignApprover,
  authHeader,
} from "./helpers.js";

let alice, bob, approver, qfd, it_admin, form;

beforeEach(async () => {
  await resetDb();
  alice = await createUser("requestor");
  bob = await createUser("requestor");
  approver = await createUser("approver");
  qfd = await createUser("qfd_admin");
  it_admin = await createUser("all_access");
  form = await createForm();
});

const entryFor = (owner, status = "draft", f = form) =>
  FormEntries.create({
    user_id: owner.id,
    form_id: f.id,
    form_entry_status: status,
  });

const get = (path, who) => api.get(path).set(authHeader(who));
const listIds = async (who, path = "/api/form-entries/pagination") =>
  (await get(path, who)).body.entries.map((e) => e.id);

const addQuestion = async (f) => {
  const section = await FormSection.create({
    form_id: f.id,
    form_section_name: "Section",
  });
  const question = await Questions.create({
    form_id: f.id,
    form_section_id: section.form_section_id,
    form_questions: "Original question",
    question_type: "multiple",
  });
  const sub = await SubQuestion.create({
    question_id: question.id,
    sub_questions: "Original sub-question",
  });
  return { section, question, sub };
};

describe("single-entry reads follow the same visibility as the list", () => {
  const SINGLE_ENTRY_PATHS = (id) => [
    `/api/form-entries/get/${id}`,
    `/api/form-entries/entry/${id}`,
    `/api/form-entries/${id}/approval-history`,
  ];

  it("a requestor can open their own entry but not someone else's", async () => {
    const mine = await entryFor(alice);
    const theirs = await entryFor(bob);

    for (const path of SINGLE_ENTRY_PATHS(mine.id))
      expect((await get(path, alice)).status, path).toBe(200);
    for (const path of SINGLE_ENTRY_PATHS(theirs.id))
      expect((await get(path, alice)).status, path).toBe(404);
  });

  it("an approver sees submitted entries on assigned forms only", async () => {
    await assignApprover(form, approver, "first");
    const otherForm = await createForm({ form_name: "Unassigned" });

    const submitted = await entryFor(alice, "submitted_first");
    const stillPending = await entryFor(alice, "pending");
    const unassigned = await entryFor(alice, "submitted_first", otherForm);

    for (const path of SINGLE_ENTRY_PATHS(submitted.id))
      expect((await get(path, approver)).status, path).toBe(200);
    for (const entry of [stillPending, unassigned])
      for (const path of SINGLE_ENTRY_PATHS(entry.id))
        expect((await get(path, approver)).status, path).toBe(404);
  });

  it.each(["qfd_admin", "all_access"])("%s can open any entry", async (role) => {
    const who = role === "qfd_admin" ? qfd : it_admin;
    const entry = await entryFor(alice);
    for (const path of SINGLE_ENTRY_PATHS(entry.id))
      expect((await get(path, who)).status, path).toBe(200);
  });
});

describe("archiving entries", () => {
  const archive = (entry, who) =>
    api.put(`/api/form-entries/archive/${entry.id}`).set(authHeader(who));

  it.each(["requestor", "approver"])("%s can't archive", async (role) => {
    const entry = await entryFor(alice);
    const who = role === "requestor" ? alice : approver;
    expect((await archive(entry, who)).status).toBe(403);
  });

  it("hides the entry everywhere but keeps it in the database", async () => {
    await assignApprover(form, approver, "first");
    const { question, section } = await addQuestion(form);
    const entry = await entryFor(alice, "submitted_first");
    await FormQuestionValue.create({
      form_entry_id: entry.id,
      form_id: form.id,
      form_section_id: section.form_section_id,
      form_question_id: question.id,
      form_value: "Y",
    });

    expect((await archive(entry, qfd)).status).toBe(200);

    // Still in the database, flagged archived
    const row = await FormEntries.unscoped().findByPk(entry.id);
    expect(row.form_entry_archivestatus).toBe(1);

    // Lists
    for (const who of [alice, approver, it_admin])
      expect(await listIds(who)).not.toContain(entry.id);
    // Single-entry reads
    expect((await get(`/api/form-entries/get/${entry.id}`, it_admin)).status).toBe(404);
    // Dashboard
    const dash = await get("/api/dashboard/all", it_admin);
    expect(JSON.stringify(dash.body)).not.toContain(`"id":${entry.id},`);
    // Reports
    const filtered = await api
      .post("/api/reports/filter-entries")
      .set(authHeader(qfd))
      .send({ form_id: form.id });
    expect(JSON.stringify(filtered.body)).not.toContain(`"id":${entry.id},`);
    const raw = await api
      .post("/api/reports/raw-answers")
      .set(authHeader(qfd))
      .send({ entry_ids: [entry.id] });
    expect(JSON.stringify(raw.body)).not.toContain('"form_value":"Y"');
    // Approval actions
    const approve = await api
      .post("/api/form-entries/approve")
      .set(authHeader(approver))
      .send({ form_entry_id: entry.id, action: "approve" });
    expect(approve.status).toBe(404);
  });

  it("DELETE archives instead of deleting", async () => {
    const entry = await entryFor(alice);
    const res = await api
      .delete(`/api/form-entries/${entry.id}`)
      .set(authHeader(it_admin));
    expect(res.status).toBe(200);
    expect(await FormEntries.unscoped().findByPk(entry.id)).not.toBeNull();
  });

  it("a requestor can't archive their own entry through create or update", async () => {
    const created = await api
      .post("/api/form-entries/create-builder")
      .set(authHeader(alice))
      .send({ form_id: form.id, form_entry_status: "draft", form_entry_archivestatus: 1 });
    expect(created.status).toBe(201);

    const id = created.body.entry.id;
    await api
      .put(`/api/form-entries/update-builder/${id}`)
      .set(authHeader(alice))
      .send({ form_entry_status: "draft", form_entry_archivestatus: 1 });

    const row = await FormEntries.unscoped().findByPk(id);
    expect(row.form_entry_archivestatus).toBe(0);
  });
});

describe("archiving forms", () => {
  const archive = (who, f = form) =>
    api.put(`/api/forms/archive/${f.id}`).set(authHeader(who));

  it.each(["requestor", "approver"])("%s can't archive", async (role) => {
    expect((await archive(role === "requestor" ? alice : approver)).status).toBe(403);
  });

  it("hides the form from lists but keeps its entries viewable", async () => {
    const entry = await entryFor(alice, "draft");
    expect((await archive(qfd)).status).toBe(200);

    const row = await Forms.findByPk(form.id);
    expect(row.form_archivestatus).toBe(1);

    const ids = (body) => JSON.stringify(body);
    expect(ids((await get("/api/forms/all", alice)).body)).not.toContain('"Test Form"');
    expect(ids((await get("/api/forms/pagination", qfd)).body)).not.toContain('"Test Form"');
    expect(ids((await get("/api/reports/filter-options", qfd)).body)).not.toContain('"Test Form"');
    expect(
      ids((await get(`/api/form-approvers/user/${approver.id}`, it_admin)).body),
    ).not.toContain('"Test Form"');

    // Existing entries and the form structure they need stay readable
    expect(await listIds(alice)).toContain(entry.id);
    expect((await get(`/api/forms/get/${form.id}`, alice)).status).toBe(200);
  });

  it("an archived form can't receive new entries", async () => {
    await archive(qfd);
    const res = await api
      .post("/api/form-entries/create-builder")
      .set(authHeader(alice))
      .send({ form_id: form.id, form_entry_status: "draft" });
    expect(res.status).toBe(400);
  });

  it("DELETE archives instead of deleting, and keeps the entries", async () => {
    const entry = await entryFor(alice);
    const res = await api.delete(`/api/forms/${form.id}`).set(authHeader(it_admin));
    expect(res.status).toBe(200);
    expect(await Forms.findByPk(form.id)).not.toBeNull();
    expect(await FormEntries.findByPk(entry.id)).not.toBeNull();
  });

  it("saving an archived form in the builder doesn't un-archive it", async () => {
    await archive(qfd);
    const res = await api
      .put(`/api/forms/update/${form.id}`)
      .set(authHeader(qfd))
      .send({ form_id: form.id, form_name: "Renamed", sections: [] });
    expect(res.status).toBe(200);
    const row = await Forms.findByPk(form.id);
    expect(row.form_name).toBe("Renamed");
    expect(row.form_archivestatus).toBe(1);
  });
});

describe("archived clients are hidden", () => {
  it("from /clients/all and /clients/get/:id", async () => {
    const client = await Clients.create({ clients_name: "Acme", clients_site: "Taytay" });
    await api.put(`/api/clients/archive/${client.clients_id}`).set(authHeader(qfd));

    expect(JSON.stringify((await get("/api/clients/all", qfd)).body)).not.toContain("Acme");
    expect((await get(`/api/clients/get/${client.clients_id}`, qfd)).status).toBe(404);
  });
});

describe("form builder only edits rows of the form being edited", () => {
  let victim, target;

  beforeEach(async () => {
    const otherForm = await createForm({ form_name: "Victim form" });
    victim = await addQuestion(otherForm);
    target = form;
  });

  const expectUntouched = async () => {
    await victim.section.reload();
    await victim.question.reload();
    await victim.sub.reload();
    expect(victim.section.form_section_name).toBe("Section");
    expect(victim.section.form_section_archivestatus).toBe(0);
    expect(victim.question.form_questions).toBe("Original question");
    expect(victim.question.form_questions_archivestatus).toBe(0);
    expect(victim.sub.sub_questions).toBe("Original sub-question");
    expect(victim.sub.sub_question_archivestatus).toBe(0);
  };

  it("update: another form's section, question and sub-question ids are ignored", async () => {
    const res = await api
      .put(`/api/forms/update/${target.id}`)
      .set(authHeader(qfd))
      .send({
        form_name: "Mine",
        sections: [
          {
            form_section_id: victim.section.form_section_id,
            form_section_name: "HIJACKED",
            form_section_archivestatus: 1,
            questions: [
              {
                form_question_id: victim.question.id,
                form_questions: "HIJACKED",
                question_type: "multiple",
                required: false,
                form_questions_archivestatus: 1,
                subQuestions: [
                  {
                    sub_question_id: victim.sub.sub_question_id,
                    sub_questions: "HIJACKED",
                    sub_question_archivestatus: 1,
                  },
                ],
              },
            ],
          },
        ],
      });
    expect(res.status).toBe(200);
    await expectUntouched();
  });

  it("builder: another form's ids can't be archived with delete flags", async () => {
    const res = await api
      .post("/api/forms/builder")
      .set(authHeader(qfd))
      .send({
        form_id: target.id,
        form_name: "Mine",
        sections: [
          { form_section_id: victim.section.form_section_id, delete: true },
          {
            form_section_name: "New",
            questions: [
              { form_question_id: victim.question.id, delete: true },
            ],
          },
        ],
      });
    expect(res.status).toBe(200);
    await expectUntouched();
  });

  it("normal editing of the form's own rows still works", async () => {
    // Build a new form the way the Forms page does
    const built = await api
      .post("/api/forms/builder")
      .set(authHeader(qfd))
      .send({
        form_name: "Built",
        sections: [
          {
            form_section_name: "S1",
            questions: [
              {
                form_questions: "Q1",
                question_type: "multiple",
                required: true,
                subQuestions: [{ sub_questions: "SQ1", question_type: "text" }],
              },
            ],
          },
        ],
      });
    expect(built.status).toBe(200);
    const formId = built.body.form_id;
    const [section] = await FormSection.findAll({ where: { form_id: formId } });
    const [question] = await Questions.findAll({ where: { form_id: formId } });
    const [sub] = await SubQuestion.findAll({ where: { question_id: question.id } });

    // Edit everything and add a new question
    const res = await api
      .put(`/api/forms/update/${formId}`)
      .set(authHeader(qfd))
      .send({
        form_name: "Built v2",
        sections: [
          {
            form_section_id: section.form_section_id,
            form_section_name: "S1 edited",
            questions: [
              {
                form_question_id: question.id,
                form_questions: "Q1 edited",
                question_type: "multiple",
                required: true,
                subQuestions: [
                  {
                    sub_question_id: sub.sub_question_id,
                    sub_questions: "SQ1 edited",
                    question_type: "text",
                  },
                ],
              },
              { form_questions: "Q2 new", question_type: "text", required: false },
            ],
          },
        ],
      });
    expect(res.status).toBe(200);

    await section.reload();
    await question.reload();
    await sub.reload();
    expect(section.form_section_name).toBe("S1 edited");
    expect(question.form_questions).toBe("Q1 edited");
    expect(sub.sub_questions).toBe("SQ1 edited");
    const all = await Questions.findAll({ where: { form_id: formId } });
    expect(all.map((q) => q.form_questions).sort()).toEqual(["Q1 edited", "Q2 new"]);
  });

  it("the URL form id wins over the body form_id", async () => {
    const victimForm = await Forms.findByPk(victim.section.form_id);
    await api
      .put(`/api/forms/update/${target.id}`)
      .set(authHeader(qfd))
      .send({ form_id: victimForm.id, form_name: "HIJACKED", sections: [] });
    await victimForm.reload();
    expect(victimForm.form_name).toBe("Victim form");
  });
});

describe("form approver assignments", () => {
  const put = (assignments) =>
    api
      .put(`/api/form-approvers/form/${form.id}`)
      .set(authHeader(qfd))
      .send({ assignments });

  beforeEach(() => assignApprover(form, approver, "first"));

  it.each([[{}], [{ first: [] }]])(
    "a missing level is refused instead of wiping approvers (%j)",
    async (payload) => {
      expect((await put(payload)).status).toBe(400);
      expect(await FormApprovers.count({ where: { form_id: form.id } })).toBe(1);
    },
  );

  it("sending all three levels still works, including clearing them", async () => {
    expect((await put({ first: [], second: [], third: [] })).status).toBe(200);
    expect(await FormApprovers.count({ where: { form_id: form.id } })).toBe(0);
  });
});

describe("saved reports (shared between admins)", () => {
  const REPORT = {
    report_name: "Monthly",
    filter_date_from: "2026-01-01",
    filter_date_to: "2026-01-31",
    chart_type: "overall",
    chart_condition: "Y",
  };
  let entry;

  beforeEach(async () => {
    entry = await entryFor(alice, "completed");
  });

  const save = (who, extra = {}) =>
    api
      .post("/api/saved-reports/save")
      .set(authHeader(who))
      .send({ ...REPORT, form_id: form.id, entry_ids: [entry.id], ...extra });

  it("the creator is the logged-in user, not a body user_id", async () => {
    const res = await save(qfd, { user_id: it_admin.id });
    expect(res.status).toBe(201);
    const report = await SavedReport.findByPk(res.body.data.id);
    expect(report.created_by).toBe(qfd.id);
  });

  it("every admin sees every saved report", async () => {
    await save(qfd);
    const list = await get("/api/saved-reports/my-reports", it_admin);
    expect(list.body.data.map((r) => r.report_name)).toContain("Monthly");
  });

  it("only the creator can edit or refresh", async () => {
    const id = (await save(qfd)).body.data.id;

    const byOther = await api
      .put(`/api/saved-reports/${id}`)
      .set(authHeader(it_admin))
      .send({ report_name: "Renamed" });
    expect(byOther.status).toBe(404);
    const refreshOther = await api
      .post(`/api/saved-reports/${id}/refresh`)
      .set(authHeader(it_admin));
    expect(refreshOther.status).toBe(404);

    const byCreator = await api
      .put(`/api/saved-reports/${id}`)
      .set(authHeader(qfd))
      .send({ report_name: "Renamed" });
    expect(byCreator.status).toBe(200);
    expect((await SavedReport.findByPk(id)).report_name).toBe("Renamed");
  });

  it("any admin can archive one; it disappears from the list but stays in the database", async () => {
    const id = (await save(qfd)).body.data.id;
    const res = await api
      .delete(`/api/saved-reports/${id}`)
      .set(authHeader(it_admin));
    expect(res.status).toBe(200);

    const list = await get("/api/saved-reports/my-reports", qfd);
    expect(list.body.data.map((r) => r.id)).not.toContain(id);
    expect((await SavedReport.findByPk(id)).is_archived).toBe(true);
  });
});
