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

const RANGE = "from=2026-10-01&to=2026-10-03";

let alice, bob, approver, qfd, it_admin, formA, formB;

// A completed entry, approved for the last time at `approvedAt` (UTC instant)
const completed = (owner, form, { site = "Marilao", area = "Main", approvedAt, date = "2026-10-02" }) =>
  FormEntries.create({
    user_id: owner.id,
    form_id: form.id,
    form_entry_status: "completed",
    form_entry_site: site,
    form_entry_area: area,
    form_entry_date: date,
    form_entry_thirdapprover_datetime: approvedAt,
  });

beforeEach(async () => {
  await resetDb();
  alice = await createUser("requestor", { user_site: "Marilao" });
  bob = await createUser("requestor", { user_site: "Marilao" });
  approver = await createUser("approver", { user_site: "Marilao" });
  qfd = await createUser("qfd_admin", { user_site: "Marilao" });
  it_admin = await createUser("all_access", { user_site: "Plaridel" });
  formA = await createForm({ form_name: "Form A" });
  formB = await createForm({ form_name: "Form B" });
  await assignApprover(formA, approver, "first");

  // 23:30 UTC on Oct 1 is 07:30 on Oct 2 in Manila
  await completed(alice, formA, { approvedAt: "2026-10-01T23:30:00Z" });
  await completed(alice, formA, { area: "Annex", approvedAt: "2026-10-02T02:00:00Z" });
  await completed(bob, formB, { approvedAt: "2026-10-03T03:00:00Z", date: "2026-10-03" });
  await completed(bob, formA, { site: "Taytay", approvedAt: "2026-10-02T03:00:00Z" });
  // Not completed: counts only in the per-form chart
  await FormEntries.create({
    user_id: alice.id,
    form_id: formB.id,
    form_entry_status: "submitted_first",
    form_entry_site: "Marilao",
    form_entry_area: "Main",
    form_entry_date: "2026-10-01",
  });
});

const charts = async (who, query = RANGE) => {
  const res = await api.get(`/api/dashboard/charts?${query}`).set(authHeader(who));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
};
const dayCounts = (body) =>
  Object.fromEntries(body.accomplished.days.map((d) => [d.date, d.total]));

describe("dashboard charts", () => {
  it("returns every day in the range, zero-filled", async () => {
    const body = await charts(qfd);
    expect(body.accomplished.days.map((d) => d.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("buckets completions by Philippine day, not UTC", async () => {
    const body = await charts(qfd);
    expect(dayCounts(body)).toEqual({ "2026-10-01": 0, "2026-10-02": 2, "2026-10-03": 1 });
  });

  it("splits by area, and the area filter narrows everything", async () => {
    const all = await charts(qfd);
    expect(all.accomplished.byArea).toEqual({ Main: 2, Annex: 1, Other: 0 });
    const oct2 = all.accomplished.days.find((d) => d.date === "2026-10-02");
    expect([oct2.Main, oct2.Annex]).toEqual([1, 1]);

    const annex = await charts(qfd, `${RANGE}&area=Annex`);
    expect(annex.area).toBe("Annex");
    expect(annex.accomplished.total).toBe(1);
    expect(annex.byForm.total).toBe(1);
  });

  it("only counts the user's own site", async () => {
    const body = await charts(qfd);
    expect(body.site).toBe("Marilao");
    expect(body.accomplished.total).toBe(3); // the Taytay entry is excluded
  });

  it("qfd_admin can't switch site; all_access can", async () => {
    const qfdTaytay = await charts(qfd, `${RANGE}&site=Taytay`);
    expect(qfdTaytay.site).toBe("Marilao");
    expect(qfdTaytay.canChooseSite).toBe(false);

    const itDefault = await charts(it_admin);
    expect(itDefault.site).toBe("Plaridel");
    expect(itDefault.canChooseSite).toBe(true);
    expect(itDefault.sites).toContain("Taytay");

    const itTaytay = await charts(it_admin, `${RANGE}&site=Taytay`);
    expect(itTaytay.site).toBe("Taytay");
    expect(itTaytay.accomplished.total).toBe(1);
  });

  it("requestors see only their own entries", async () => {
    const body = await charts(alice);
    expect(body.scope).toBe("mine");
    expect(body.accomplished.total).toBe(2);
    expect(body.byForm.forms.map((f) => [f.form_name, f.count])).toEqual([
      ["Form A", 2],
      ["Form B", 1],
    ]);
  });

  it("approvers see their assigned forms, once submitted", async () => {
    const body = await charts(approver);
    expect(body.scope).toBe("site");
    expect(body.byForm.forms.map((f) => f.form_name)).toEqual(["Form A"]);
  });

  it("entries per form: by entry date, sorted most to least", async () => {
    const body = await charts(qfd);
    expect(body.byForm.forms.map((f) => [f.form_name, f.count])).toEqual([
      ["Form A", 2],
      ["Form B", 2],
    ]);
    const oct3 = await charts(qfd, "from=2026-10-03&to=2026-10-03");
    expect(oct3.byForm.forms.map((f) => [f.form_name, f.count])).toEqual([["Form B", 1]]);
  });

  it.each([
    ["from=2026-10-05&to=2026-10-01", "Invalid date range"],
    ["from=yesterday&to=2026-10-01", "Invalid date range"],
    ["from=2025-01-01&to=2026-10-01", "Date range is too long (max 366 days)"],
    [`${RANGE}&area=Basement`, "Invalid area"],
  ])("refuses %s", async (query, message) => {
    const res = await api.get(`/api/dashboard/charts?${query}`).set(authHeader(qfd));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
  });

  it("all_access picking an unknown site gets 400", async () => {
    const res = await api
      .get(`/api/dashboard/charts?${RANGE}&site=Narnia`)
      .set(authHeader(it_admin));
    expect(res.status).toBe(400);
  });
});

describe("drill-down links match the bars", () => {
  const listTotal = async (who, query) => {
    const res = await api
      .get(`/api/form-entries/pagination?pageSize=100&${query}`)
      .set(authHeader(who));
    expect(res.status).toBe(200);
    return res.body.total;
  };

  it.each([
    ["qfd_admin", null],
    ["qfd_admin", "Main"],
    ["requestor", null],
    ["approver", null],
  ])("a day's bar = the completed-on list (%s, area %s)", async (role, area) => {
    const who = { qfd_admin: qfd, requestor: alice, approver }[role];
    const body = await charts(who, `${RANGE}${area ? `&area=${area}` : ""}`);
    for (const day of body.accomplished.days) {
      const query = [
        "status=completed",
        `site=${body.site}`,
        area ? `area=${area}` : "",
        `completed_from=${day.date}`,
        `completed_to=${day.date}`,
      ]
        .filter(Boolean)
        .join("&");
      expect(await listTotal(who, query), day.date).toBe(day.total);
    }
  });

  it.each(["qfd_admin", "requestor", "approver"])(
    "a form's bar = the list filtered by that form (%s)",
    async (role) => {
      const who = { qfd_admin: qfd, requestor: alice, approver }[role];
      const body = await charts(who);
      for (const form of body.byForm.forms) {
        const query = `form_id=${form.form_id}&site=${body.site}&from=${body.from}&to=${body.to}`;
        expect(await listTotal(who, query), form.form_name).toBe(form.count);
      }
    },
  );
});
