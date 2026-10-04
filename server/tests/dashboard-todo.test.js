import { describe, it, expect, beforeEach } from "vitest";
import sequelize from "../utilities/db.js";
import FormEntries from "../Models/FormEntries.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  assignApprover,
  authHeader,
} from "./helpers.js";

let requestor, other, approver, qfd, it_admin, formA, formB;

const DAY = 24 * 60 * 60 * 1000;
// Entries are created "now"; set updatedAt directly to say how long ago they
// reached their current level
// (written in Sequelize's own SQLite date format so it reads back as a Date)
const sqliteDate = (d) => d.toISOString().replace("T", " ").replace("Z", " +00:00");
const waitingFor = (entry, days) =>
  sequelize.query("UPDATE form_entries SET updatedAt = ? WHERE id = ?", {
    replacements: [sqliteDate(new Date(Date.now() - days * DAY)), entry.id],
  });

const entry = (owner, form, status, extra = {}) =>
  FormEntries.create({
    user_id: owner.id,
    form_id: form.id,
    form_entry_status: status,
    form_entry_site: "Marilao",
    form_entry_area: "Main",
    ...extra,
  });

beforeEach(async () => {
  await resetDb();
  requestor = await createUser("requestor", { user_site: "Marilao" });
  other = await createUser("requestor", { user_site: "Marilao" });
  approver = await createUser("approver", { user_site: "Marilao" });
  qfd = await createUser("qfd_admin", { user_site: "Marilao" });
  it_admin = await createUser("all_access", { user_site: "Plaridel" });
  formA = await createForm({ form_name: "Form A" });
  formB = await createForm({ form_name: "Form B" });
  await assignApprover(formA, approver, "first"); // only 1st level, only Form A
});

const todo = async (who, query = "") => {
  const res = await api.get(`/api/dashboard/analytics?${query}`).set(authHeader(who));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
};

describe("waiting for your approval", () => {
  it("an approver sees only entries at their assigned level and forms", async () => {
    const mine = await entry(requestor, formA, "submitted_first");
    await entry(requestor, formA, "approved_first"); // 2nd level: not theirs
    await entry(requestor, formB, "submitted_first"); // not their form
    await entry(requestor, formA, "pending"); // not submitted yet

    const body = await todo(approver);
    expect(body.waiting.total).toBe(1);
    expect(body.waiting.items.map((i) => i.id)).toEqual([mine.id]);
    expect(body.waiting.items[0]).toMatchObject({
      form_name: "Form A",
      level: "first",
      level_label: "1st approval",
      days_waiting: 0,
    });
    expect(body.waiting.items[0].requested_by).toMatch(/^requestor User/);
  });

  it("an approver with no assignments has nothing waiting", async () => {
    const lonely = await createUser("approver", { user_site: "Marilao" });
    await entry(requestor, formA, "submitted_first");
    expect((await todo(lonely)).waiting).toEqual({ total: 0, items: [] });
  });

  it("admins see every level, oldest first, at most 5 with the full total", async () => {
    const statuses = ["submitted_first", "approved_first", "approved_second", "submitted_first", "approved_first", "submitted_first", "approved_second"];
    const created = [];
    for (const [i, status] of statuses.entries()) {
      const e = await entry(requestor, i % 2 ? formA : formB, status);
      await waitingFor(e, i + 1); // entry i has waited i+1 days
      created.push(e);
    }

    const body = await todo(qfd);
    expect(body.waiting.total).toBe(7);
    expect(body.waiting.items).toHaveLength(5);
    expect(body.waiting.items.map((i) => i.days_waiting)).toEqual([7, 6, 5, 4, 3]);
    expect(body.waiting.items[0].id).toBe(created[6].id);
  });

  it("follows the site and area filters", async () => {
    await entry(requestor, formA, "submitted_first");
    await entry(requestor, formA, "submitted_first", { form_entry_area: "Annex" });
    await entry(requestor, formA, "submitted_first", { form_entry_site: "Taytay" });

    expect((await todo(qfd)).waiting.total).toBe(2);
    expect((await todo(qfd, "area=Annex")).waiting.total).toBe(1);
    expect((await todo(qfd, "site=Taytay")).waiting.total).toBe(2); // qfd can't switch site
    expect((await todo(it_admin, "site=Taytay")).waiting.total).toBe(1);
  });

  it("requestors get no approval queue", async () => {
    expect((await todo(requestor)).waiting).toBeNull();
  });
});

describe("returned entries", () => {
  it("requestors see their own returned entries with who returned them and why", async () => {
    await entry(requestor, formA, "returned", {
      form_entry_returner_id: approver.id,
      form_entry_returner_datetime: new Date(Date.now() - 2 * DAY),
      form_entry_returner_remarks: "Please attach the temperature log",
      form_entry_last_return_level: "first",
    });
    await entry(other, formA, "returned"); // someone else's
    await entry(requestor, formA, "draft"); // not returned

    const body = await todo(requestor);
    expect(body.returned.total).toBe(1);
    expect(body.returned.items[0]).toMatchObject({
      form_name: "Form A",
      remarks: "Please attach the temperature log",
      level_label: "1st approval",
    });
    expect(body.returned.items[0].returned_by).toMatch(/^approver User/);
  });

  it("newest returns first, at most 5", async () => {
    for (let i = 0; i < 6; i++) {
      await entry(requestor, formA, "returned", {
        form_entry_returner_datetime: new Date(Date.now() - i * DAY),
        form_entry_returner_remarks: `return ${i}`,
      });
    }
    const body = await todo(requestor);
    expect(body.returned.total).toBe(6);
    expect(body.returned.items.map((i) => i.remarks)).toEqual([
      "return 0", "return 1", "return 2", "return 3", "return 4",
    ]);
  });

  it("admins see every returned entry at the site, with who requested it", async () => {
    await entry(requestor, formA, "returned");
    await entry(other, formB, "returned");
    await entry(other, formB, "returned", { form_entry_site: "Taytay" });

    const body = await todo(qfd);
    expect(body.returned.total).toBe(2);
    expect(body.returned.items.map((i) => i.requested_by).sort()).toEqual(
      [expect.stringMatching(/^requestor User/), expect.stringMatching(/^requestor User/)],
    );
  });

  it("approvers see returned entries on their assigned forms", async () => {
    const theirs = await entry(requestor, formA, "returned");
    await entry(requestor, formB, "returned"); // not their form

    const body = await todo(approver);
    expect(body.returned.items.map((i) => i.id)).toEqual([theirs.id]);
  });

  it("the list is the same as the returned filter on the entry list", async () => {
    await entry(requestor, formA, "returned");
    await entry(other, formA, "returned");
    await entry(requestor, formB, "returned");
    for (const who of [requestor, approver, qfd]) {
      const body = await todo(who);
      const res = await api
        .get(`/api/form-entries/pagination?status=returned&site=${body.site}`)
        .set(authHeader(who));
      expect(res.body.total).toBe(body.returned.total);
    }
  });

  it("returns empty lists for a user without a site", async () => {
    const nowhere = await createUser("requestor", { user_site: null });
    const body = await todo(nowhere);
    expect(body).toMatchObject({
      site: null,
      waiting: null,
      returned: { total: 0, items: [] },
    });
  });
});

describe("recent entries", () => {
  const createdDaysAgo = (e, days) =>
    sequelize.query("UPDATE form_entries SET createdAt = ? WHERE id = ?", {
      replacements: [sqliteDate(new Date(Date.now() - days * DAY)), e.id],
    });

  it("lists the 5 newest entries at the site, newest first, any status", async () => {
    const statuses = ["draft", "pending", "submitted_first", "completed", "returned", "rejected"];
    const created = [];
    for (const [i, status] of statuses.entries()) {
      const e = await entry(requestor, i % 2 ? formA : formB, status);
      await createdDaysAgo(e, i); // entry i was created i days ago
      created.push(e);
    }
    await entry(requestor, formA, "pending", { form_entry_site: "Taytay" });

    const body = await todo(qfd);
    expect(body.recent.map((r) => r.id)).toEqual(created.slice(0, 5).map((e) => e.id));
    expect(body.recent[0]).toMatchObject({ form_name: "Form B", status: "draft", area: "Main" });
    expect(body.recent[0].requested_by).toMatch(/^requestor User/);
  });

  it("follows the entry visibility rules", async () => {
    const own = await entry(requestor, formA, "pending");
    const submitted = await entry(other, formA, "submitted_first");
    await entry(other, formA, "pending"); // approvers can't see others' pending
    await entry(other, formB, "submitted_first"); // not the approver's form

    expect((await todo(requestor)).recent.map((r) => r.id)).toEqual([own.id]);
    expect((await todo(approver)).recent.map((r) => r.id)).toEqual([submitted.id]);
  });
});
