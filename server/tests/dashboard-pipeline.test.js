import { describe, it, expect, beforeEach } from "vitest";
import FormEntries from "../Models/FormEntries.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  assignApprover,
  authHeader,
} from "./helpers.js";

const RANGE = "from=2026-10-01&to=2026-10-10";

let requestor, other, approver, qfd, it_admin, formA, formB;

const entry = (owner, form, status, extra = {}) =>
  FormEntries.create({
    user_id: owner.id,
    form_id: form.id,
    form_entry_status: status,
    form_entry_site: "Marilao",
    form_entry_area: "Main",
    ...extra,
  });

const returnedAt = (owner, form, when, status = "returned", extra = {}) =>
  entry(owner, form, status, { form_entry_returner_datetime: when, ...extra });

beforeEach(async () => {
  await resetDb();
  requestor = await createUser("requestor", { user_site: "Marilao" });
  other = await createUser("requestor", { user_site: "Marilao" });
  approver = await createUser("approver", { user_site: "Marilao" });
  qfd = await createUser("qfd_admin", { user_site: "Marilao" });
  it_admin = await createUser("all_access", { user_site: "Plaridel" });
  formA = await createForm({ form_name: "Form A" });
  formB = await createForm({ form_name: "Form B" });
  await assignApprover(formA, approver, "first");
});

const analytics = async (who, query = RANGE) => {
  const res = await api.get(`/api/dashboard/analytics?${query}`).set(authHeader(who));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
};
const listTotal = async (who, query) => {
  const res = await api.get(`/api/form-entries/pagination?${query}&pageSize=100`).set(authHeader(who));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.total;
};
const stageCounts = (body) => Object.fromEntries(body.pipeline.map((s) => [s.key, s.count]));

describe("approval pipeline", () => {
  it("counts open entries per stage, ignoring the date range", async () => {
    await entry(requestor, formA, "pending");
    await entry(requestor, formA, "submitted_first");
    await entry(requestor, formB, "submitted_first");
    await entry(requestor, formA, "approved_first");
    await entry(requestor, formA, "submitted_second");
    await entry(requestor, formA, "submitted_third");
    await entry(requestor, formA, "returned");
    await entry(requestor, formA, "draft"); // not in the pipeline
    await entry(requestor, formA, "completed"); // nor this
    await entry(requestor, formA, "rejected"); // nor this
    await entry(requestor, formA, "submitted_first", { form_entry_area: "Annex" });

    const body = await analytics(qfd, "from=2020-01-01&to=2020-01-02");
    expect(stageCounts(body)).toEqual({ pending: 1, first: 3, second: 2, third: 1, returned: 1 });

    const annex = await analytics(qfd, "area=Annex");
    expect(stageCounts(annex).first).toBe(1);
  });

  it("requestors see their own entries, including pending ones", async () => {
    await entry(requestor, formA, "pending");
    await entry(requestor, formB, "submitted_first");
    await entry(other, formA, "submitted_first"); // someone else's

    expect(stageCounts(await analytics(requestor))).toEqual({
      pending: 1, first: 1, second: 0, third: 0, returned: 0,
    });
  });

  it("approvers get no pending stage, and see only their assigned forms", async () => {
    await entry(requestor, formA, "pending"); // they can't see this
    await entry(requestor, formA, "submitted_first");
    await entry(requestor, formB, "submitted_first"); // not their form

    expect(stageCounts(await analytics(approver))).toEqual({
      first: 1, second: 0, third: 0, returned: 0,
    });
  });

  it.each(["qfd_admin", "approver", "requestor"])(
    "each stage opens exactly its entries in the list (%s)",
    async (role) => {
      const who = { qfd_admin: qfd, approver, requestor }[role];
      await entry(requestor, formA, "pending");
      await entry(requestor, formA, "approved_first");
      await entry(requestor, formA, "submitted_second");
      await entry(requestor, formA, "approved_second");
      await entry(other, formB, "submitted_first");
      await entry(requestor, formA, "returned", { form_entry_site: "Taytay" });

      const body = await analytics(who);
      for (const stage of body.pipeline) {
        const total = await listTotal(who, `status=${stage.statuses.join(",")}&site=${body.site}`);
        expect(total, stage.key).toBe(stage.count);
      }
    },
  );
});

describe("most-returned forms", () => {
  it("ranks forms by returns in the period, whatever their status now", async () => {
    await returnedAt(requestor, formB, "2026-10-02T03:00:00Z");
    await returnedAt(requestor, formB, "2026-10-04T03:00:00Z", "completed");
    await returnedAt(requestor, formA, "2026-10-03T03:00:00Z", "submitted_first");
    await returnedAt(requestor, formA, "2026-09-20T03:00:00Z"); // before the period
    await returnedAt(requestor, formA, "2026-10-03T03:00:00Z", "returned", {
      form_entry_site: "Taytay",
    });

    const body = await analytics(qfd);
    expect(body.mostReturned).toEqual({
      total: 3,
      forms: [
        { form_id: formB.id, form_name: "Form B", count: 2 },
        { form_id: formA.id, form_name: "Form A", count: 1 },
      ],
    });
  });

  it("each form's drill-down lists exactly what it counts", async () => {
    await returnedAt(requestor, formB, "2026-10-01T00:30:00+08:00");
    await returnedAt(requestor, formB, "2026-10-10T23:30:00+08:00", "completed");
    await returnedAt(requestor, formB, "2026-10-11T00:30:00+08:00"); // the day after

    const body = await analytics(qfd);
    const [form] = body.mostReturned.forms;
    expect(form.count).toBe(2);
    const total = await listTotal(
      qfd,
      `form_id=${form.form_id}&site=${body.site}&returned_from=${body.from}&returned_to=${body.to}`,
    );
    expect(total).toBe(2);
  });

  it("approvers see their assigned forms only", async () => {
    await returnedAt(requestor, formA, "2026-10-02T03:00:00Z");
    await returnedAt(requestor, formB, "2026-10-02T03:00:00Z"); // not their form
    expect((await analytics(approver)).mostReturned.forms.map((f) => f.form_name)).toEqual([
      "Form A",
    ]);
  });

  it("all_access can look at another site", async () => {
    await returnedAt(requestor, formA, "2026-10-02T03:00:00Z", "returned", {
      form_entry_site: "Taytay",
    });
    expect((await analytics(it_admin)).mostReturned.total).toBe(0);
    expect((await analytics(it_admin, `${RANGE}&site=Taytay`)).mostReturned.total).toBe(1);
    expect((await analytics(qfd, `${RANGE}&site=Taytay`)).mostReturned.total).toBe(0);
  });

  it("is not shown to requestors", async () => {
    expect((await analytics(requestor)).mostReturned).toBeNull();
  });
});

describe("filters", () => {
  it("the entry list rejects a bad returned range", async () => {
    const res = await api
      .get("/api/form-entries/pagination?returned_from=yesterday&returned_to=2026-10-01")
      .set(authHeader(qfd));
    expect(res.status).toBe(400);
  });

  it("a user without a site gets empty widgets", async () => {
    const nowhere = await createUser("qfd_admin", { user_site: null });
    const body = await analytics(nowhere);
    expect(body.site).toBeNull();
    expect(body.accomplished.total).toBe(0);
    expect(body.pipeline.every((s) => s.count === 0)).toBe(true);
    expect(body.waiting).toEqual({ total: 0, items: [] });
    expect(body.returned).toEqual({ total: 0, items: [] });
    expect(body.mostReturned).toEqual({ total: 0, forms: [] });
  });
});
