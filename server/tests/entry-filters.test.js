import { describe, it, expect, beforeEach } from "vitest";
import FormEntries from "../Models/FormEntries.js";
import { api, resetDb, createUser, createForm, authHeader } from "./helpers.js";

// The Form Entry page's filters (form, status, and the site/area/date filters
// that dashboard links add) map 1:1 onto these query parameters.
describe("entry list filters", () => {
  let alice, bob, admin, formA, formB;

  beforeEach(async () => {
    await resetDb();
    alice = await createUser("requestor");
    bob = await createUser("requestor");
    admin = await createUser("qfd_admin");
    formA = await createForm({ form_name: "Form A" });
    formB = await createForm({ form_name: "Form B" });

    const rows = [
      [alice, formA, "draft", "Marilao", "Main", "2026-10-01"],
      [alice, formA, "completed", "Marilao", "Annex", "2026-10-02"],
      [alice, formB, "completed", "Marilao", "Main", "2026-10-02"],
      [bob, formA, "completed", "Taytay", "Main", "2026-10-03"],
    ];
    for (const [user, form, status, site, area, date] of rows) {
      await FormEntries.create({
        user_id: user.id,
        form_id: form.id,
        form_entry_status: status,
        form_entry_site: site,
        form_entry_area: area,
        form_entry_date: date,
      });
    }
  });

  const list = async (who, query) => {
    const res = await api
      .get(`/api/form-entries/pagination?${query}`)
      .set(authHeader(who));
    expect(res.status).toBe(200);
    return res.body;
  };
  const describeRows = (body) =>
    body.entries
      .map((e) => `${e.Form.form_name}/${e.form_entry_status}/${e.form_entry_area}`)
      .sort();

  it("form_id shows only that form's entries", async () => {
    const body = await list(admin, `form_id=${formA.id}`);
    expect(body.total).toBe(3);
    expect(body.entries.every((e) => e.form_id === formA.id)).toBe(true);
  });

  it("form and status combine", async () => {
    const body = await list(admin, `form_id=${formA.id}&status=completed`);
    expect(describeRows(body)).toEqual(["Form A/completed/Annex", "Form A/completed/Main"]);
  });

  it("dashboard-style links: site, area and date range", async () => {
    const body = await list(
      admin,
      `site=Marilao&area=Main&from=2026-10-01&to=2026-10-02`,
    );
    expect(describeRows(body)).toEqual(["Form A/draft/Main", "Form B/completed/Main"]);
  });

  it("the date range includes the whole end day, at any time of day", async () => {
    await FormEntries.create({
      user_id: alice.id,
      form_id: formB.id,
      form_entry_status: "draft",
      form_entry_site: "Marilao",
      form_entry_area: "Main",
      form_entry_date: "2026-10-02T15:30:00Z",
    });
    const body = await list(admin, "from=2026-10-02&to=2026-10-02");
    expect(body.total).toBe(3); // the two midnight entries + the 15:30 one
  });

  it("a malformed date range gets a clear 400", async () => {
    const res = await api
      .get("/api/form-entries/pagination?from=yesterday&to=2026-10-02")
      .set(authHeader(admin));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid date range");
  });

  it("filters never widen visibility: a requestor still sees only their own", async () => {
    const body = await list(bob, `form_id=${formA.id}`);
    expect(body.total).toBe(1);
    expect(body.entries[0].user_id).toBe(bob.id);
  });

  it("total counts the filtered rows, not the page", async () => {
    const body = await list(admin, `form_id=${formA.id}&pageSize=1`);
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(3);
    expect(body.totalPages).toBe(3);
  });
});
