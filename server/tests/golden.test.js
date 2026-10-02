// Golden tests for the Phase 6 refactor.
//
// They record the exact responses (status + body) of the main flows as the
// code behaved BEFORE the service-layer refactor. The refactor must not change
// any of them: same fields, same messages, same status codes. Timestamps are
// normalized; ids are deterministic because each test starts from an empty DB.
//
// If a snapshot changes, that's a behavior change for the client — either a
// bug in the refactor or a deliberate change that needs its own review.

import { describe, it, expect, beforeEach } from "vitest";
import FormSection from "../Models/FormSection.js";
import Questions from "../Models/Questions.js";
import SubQuestion from "../Models/SubQuestion.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  assignApprover,
  authHeader,
} from "./helpers.js";

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalize(v)]),
    );
  if (typeof value === "string" && ISO.test(value) && value.length > 10)
    return "<timestamp>";
  return value;
};
const snap = (res) => ({ status: res.status, body: normalize(res.body) });

let requestor, otherRequestor, approver, qfd, it_admin, form, q1, q2, sub1;

beforeEach(async () => {
  await resetDb();
  requestor = await createUser("requestor");
  otherRequestor = await createUser("requestor");
  approver = await createUser("approver");
  qfd = await createUser("qfd_admin");
  it_admin = await createUser("all_access");
  form = await createForm({ form_name: "Golden Form" });
  const section = await FormSection.create({
    form_id: form.id,
    form_section_name: "Section A",
  });
  q1 = await Questions.create({
    form_id: form.id,
    form_section_id: section.form_section_id,
    form_questions: "Is it clean?",
    question_type: "multiple",
    required: true,
  });
  q2 = await Questions.create({
    form_id: form.id,
    form_section_id: section.form_section_id,
    form_questions: "Notes",
    question_type: "text",
  });
  sub1 = await SubQuestion.create({
    question_id: q1.id,
    sub_questions: "Which area?",
    question_type: "text",
  });
  for (const level of ["first", "second", "third"])
    await assignApprover(form, approver, level);
});

const as = (who) => ({
  post: (path, body) => api.post(path).set(authHeader(who)).send(body),
  put: (path, body) => api.put(path).set(authHeader(who)).send(body),
  get: (path) => api.get(path).set(authHeader(who)),
});

const DETAILS = {
  form_entry_site: "Taytay",
  form_entry_area: "Main",
  form_entry_date: "2026-10-01",
};
const responses = (value = "Y") => [
  {
    form_question_id: q1.id,
    form_value: value,
    remarks: "ok",
    action_item: "",
    sub_values: [
      { sub_question_id: sub1.sub_question_id, form_sub_value: "Room 1", remarks: "" },
    ],
  },
  { form_question_id: q2.id, form_value: "All good", remarks: "", action_item: "" },
];

describe("golden: form entry flows", () => {
  it("full lifecycle responses", async () => {
    const out = {};
    const r = as(requestor);

    out.createDraft = snap(
      await r.post("/api/form-entries/create-builder", {
        form_id: form.id,
        form_entry_status: "draft",
        responses: responses(),
      }),
    );
    const id = out.createDraft.body.entry.id;

    out.updateToPending = snap(
      await r.put(`/api/form-entries/update-builder/${id}`, {
        form_entry_id: id,
        form_entry_status: "pending",
        ...DETAILS,
        responses: responses("N"),
      }),
    );
    out.answers = snap(await r.get(`/api/form-entries/entry/${id}`));
    out.submit = snap(
      await r.post("/api/form-entries/submit-approval", { form_entry_id: id }),
    );

    const a = as(approver);
    out.approve1 = snap(
      await a.post("/api/form-entries/approve", { form_entry_id: id, action: "approve", remarks: "fine" }),
    );
    out.return2 = snap(
      await a.post("/api/form-entries/return", { form_entry_id: id, remarks: "fix q2" }),
    );
    out.editReturned = snap(
      await r.put(`/api/form-entries/update-builder/${id}`, {
        form_entry_status: "returned",
        ...DETAILS,
        responses: responses("Y"),
      }),
    );
    out.resubmitPending = snap(
      await r.put(`/api/form-entries/update-builder/${id}`, {
        form_entry_status: "pending",
        ...DETAILS,
        responses: responses("Y"),
      }),
    );
    out.resubmit = snap(
      await r.post("/api/form-entries/submit-approval", { form_entry_id: id }),
    );
    for (const n of [1, 2, 3])
      out[`approveAgain${n}`] = snap(
        await a.post("/api/form-entries/approve", { form_entry_id: id, action: "approve" }),
      );

    out.history = snap(await r.get(`/api/form-entries/${id}/approval-history`));
    out.entry = snap(await r.get(`/api/form-entries/get/${id}`));
    out.list = snap(await as(it_admin).get("/api/form-entries/pagination"));

    expect(out).toMatchSnapshot();
  });

  it("create as pending, then reject", async () => {
    const created = await as(requestor).post("/api/form-entries/create-builder", {
      form_id: form.id,
      form_entry_status: "pending",
      ...DETAILS,
      responses: responses(),
    });
    const id = created.body.entry.id;
    await as(requestor).post("/api/form-entries/submit-approval", { form_entry_id: id });
    const rejected = await as(approver).post("/api/form-entries/approve", {
      form_entry_id: id,
      action: "reject",
      remarks: "no",
    });
    const history = await as(requestor).get(`/api/form-entries/${id}/approval-history`);
    expect({
      created: snap(created),
      rejected: snap(rejected),
      history: snap(history),
    }).toMatchSnapshot();
  });

  it("error responses", async () => {
    const r = as(requestor);
    const draft = (
      await r.post("/api/form-entries/create-builder", {
        form_id: form.id,
        form_entry_status: "draft",
      })
    ).body.entry.id;
    const unassigned = await createUser("approver");

    const cases = {
      createInvalidForm: await r.post("/api/form-entries/create-builder", { form_id: 9999, form_entry_status: "draft" }),
      createBadStatus: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "completed" }),
      createPendingNoSite: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "pending" }),
      createPendingBadSite: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "pending", ...DETAILS, form_entry_site: "Nowhere" }),
      createPendingNoArea: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "pending", form_entry_site: "Taytay" }),
      createPendingNoDate: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "pending", form_entry_site: "Taytay", form_entry_area: "Main" }),
      createPendingNoResponses: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "pending", ...DETAILS }),
      createPendingMissingRequired: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "pending", ...DETAILS, responses: [{ form_question_id: q2.id, form_value: "x" }] }),
      createForeignQuestion: await r.post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "draft", responses: [{ form_question_id: 9999, form_value: "x" }] }),
      createAsApprover: await as(approver).post("/api/form-entries/create-builder", { form_id: form.id, form_entry_status: "draft" }),
      updateNotFound: await r.put("/api/form-entries/update-builder/9999", { form_entry_status: "draft" }),
      updateNotOwner: await as(otherRequestor).put(`/api/form-entries/update-builder/${draft}`, { form_entry_status: "draft" }),
      updateBadTransition: await r.put(`/api/form-entries/update-builder/${draft}`, { form_entry_status: "completed" }),
      updateForeignQuestion: await r.put(`/api/form-entries/update-builder/${draft}`, { form_entry_status: "draft", responses: [{ form_question_id: 9999, form_value: "x" }] }),
      submitMissingId: await r.post("/api/form-entries/submit-approval", {}),
      submitNotFound: await r.post("/api/form-entries/submit-approval", { form_entry_id: 9999 }),
      submitNotPending: await r.post("/api/form-entries/submit-approval", { form_entry_id: draft }),
      submitNotOwner: await as(otherRequestor).post("/api/form-entries/submit-approval", { form_entry_id: draft }),
      approveBadAction: await as(approver).post("/api/form-entries/approve", { form_entry_id: draft, action: "maybe" }),
      approveNotFound: await as(approver).post("/api/form-entries/approve", { form_entry_id: 9999, action: "approve" }),
      approveNotAwaiting: await as(qfd).post("/api/form-entries/approve", { form_entry_id: draft, action: "approve" }),
      returnMissingId: await as(approver).post("/api/form-entries/return", {}),
      returnNotFound: await as(approver).post("/api/form-entries/return", { form_entry_id: 9999 }),
      returnNotReturnable: await as(qfd).post("/api/form-entries/return", { form_entry_id: draft }),
      historyNotFound: await r.get("/api/form-entries/9999/approval-history"),
      getNotFound: await r.get("/api/form-entries/get/9999"),
      answersNotFound: await r.get("/api/form-entries/entry/9999"),
    };

    // Approve/return by an unassigned approver on a submitted entry
    const pending = (
      await r.post("/api/form-entries/create-builder", {
        form_id: form.id,
        form_entry_status: "pending",
        ...DETAILS,
        responses: responses(),
      })
    ).body.entry.id;
    await r.post("/api/form-entries/submit-approval", { form_entry_id: pending });
    cases.approveUnassigned = await as(unassigned).post("/api/form-entries/approve", { form_entry_id: pending, action: "approve" });
    cases.returnUnassigned = await as(unassigned).post("/api/form-entries/return", { form_entry_id: pending });

    expect(
      Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, snap(v)])),
    ).toMatchSnapshot();
  });
});

describe("golden: form builder", () => {
  const BUILD = {
    form_name: "Built",
    form_description: "desc",
    form_effective_date: "2026-01-01",
    form_revision_number: "R1",
    sections: [
      {
        form_section_name: "S1",
        form_section_description: "first",
        questions: [
          {
            form_questions: "Q1",
            question_type: "dropdown",
            required: true,
            choices: ["a", "b"],
            subQuestions: [{ sub_questions: "SQ1", question_type: "text", required: false }],
          },
          { form_questions: "Q2", question_type: "multiple", required: false, choices: ["ignored"] },
        ],
      },
      { form_section_name: "S2", questions: [] },
    ],
  };

  it("create, read, update, read", async () => {
    const q = as(qfd);
    const out = {};
    out.build = snap(await q.post("/api/forms/builder", BUILD));
    const formId = out.build.body.form_id;
    out.read = snap(await q.get(`/api/forms/get/${formId}`));

    const read = out.read.body;
    const s1 = read.sections?.find((s) => s.form_section_name === "S1") ?? read.FormSections?.[0];
    const sections = (read.sections || read.form_sections || []);
    const first = sections[0];
    out.update = snap(
      await q.put(`/api/forms/update/${formId}`, {
        form_name: "Built v2",
        form_description: "desc2",
        sections: [
          {
            form_section_id: first?.form_section_id,
            form_section_name: "S1 edited",
            questions: (first?.questions || []).slice(0, 1).map((qq) => ({
              form_question_id: qq.id,
              form_questions: "Q1 edited",
              question_type: "dropdown",
              required: true,
              choices: ["a"],
              subQuestions: (qq.subQuestions || []).map((sq) => ({
                sub_question_id: sq.sub_question_id,
                sub_questions: "SQ1 edited",
                question_type: "text",
              })),
            })),
          },
        ],
      }),
    );
    out.readAfter = snap(await q.get(`/api/forms/get/${formId}`));
    out.updateMissingId = snap(await q.put(`/api/forms/update/abc`, { form_name: "x" }));
    expect({ ...out, _s1Found: Boolean(s1) }).toMatchSnapshot();
  });
});

describe("golden: approvers and users", () => {
  it("approver assignment responses", async () => {
    const out = {};
    const q = as(qfd);
    const i = as(it_admin);
    out.formGet = snap(await q.get(`/api/form-approvers/form/${form.id}`));
    out.formPut = snap(
      await q.put(`/api/form-approvers/form/${form.id}`, {
        assignments: { first: [approver.id], second: [], third: [approver.id] },
      }),
    );
    out.formPutIneligible = snap(
      await q.put(`/api/form-approvers/form/${form.id}`, {
        assignments: { first: [requestor.id], second: [], third: [] },
      }),
    );
    out.formPutNotFound = snap(
      await q.put(`/api/form-approvers/form/9999`, {
        assignments: { first: [], second: [], third: [] },
      }),
    );
    out.userGet = snap(await i.get(`/api/form-approvers/user/${approver.id}`));
    out.userPut = snap(
      await i.put(`/api/form-approvers/user/${approver.id}`, {
        assignments: [{ form_id: form.id, levels: ["second"] }],
      }),
    );
    out.userPutRequestor = snap(
      await i.put(`/api/form-approvers/user/${requestor.id}`, {
        assignments: [{ form_id: form.id, levels: ["first"] }],
      }),
    );
    out.userPutBadLevel = snap(
      await i.put(`/api/form-approvers/user/${approver.id}`, {
        assignments: [{ form_id: form.id, levels: ["fourth"] }],
      }),
    );
    out.userPutBadForm = snap(
      await i.put(`/api/form-approvers/user/${approver.id}`, {
        assignments: [{ form_id: 9999, levels: ["first"] }],
      }),
    );
    out.userGetAfter = snap(await i.get(`/api/form-approvers/user/${approver.id}`));
    expect(out).toMatchSnapshot();
  });

  it("user role-combination messages", async () => {
    const base = (groups, n) => ({
      user_firstname: "N",
      user_lastname: "U",
      user_email: `role${n}@test.local`,
      user_username: `role${n}`,
      user_password: "P@ssword1",
      user_groups: groups,
    });
    const combos = [
      [],
      ["superuser"],
      ["all_access", "approver"],
      ["qfd_admin", "approver"],
      ["requestor", "approver"],
      ["requestor", "requestor"],
      ["approver"],
    ];
    const i = as(it_admin);
    const out = {};
    for (const [n, groups] of combos.entries()) {
      out[`create:${groups.join("+") || "none"}`] = snap(
        await i.post("/api/users/create", base(groups, n)),
      );
      out[`edit:${groups.join("+") || "none"}`] = snap(
        await i.put(`/api/users/edit/${approver.id}`, { user_groups: groups }),
      );
    }
    out.createDuplicate = snap(await i.post("/api/users/create", base(["approver"], 6)));
    expect(out).toMatchSnapshot();
  });
});
