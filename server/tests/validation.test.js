import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Forms from "../Models/Forms.js";
import Users from "../Models/Users.js";
import FormEntries from "../Models/FormEntries.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  authHeader,
} from "./helpers.js";

let requestor, qfd, it_admin, form;

beforeEach(async () => {
  await resetDb();
  requestor = await createUser("requestor");
  qfd = await createUser("qfd_admin");
  it_admin = await createUser("all_access");
  form = await createForm();
});

afterEach(() => vi.restoreAllMocks());

const post = (path, body, who) =>
  api.post(path).set(authHeader(who)).send(body);

describe("request bodies are type-checked", () => {
  it.each([
    ["login with an object as username", "/api/auth/login", { user_username: { $gt: "" }, user_password: "x" }, null],
    ["entry responses that aren't a list", "/api/form-entries/create-builder", { form_id: 1, responses: "nope" }, "requestor"],
    ["a non-numeric question id", "/api/form-entries/create-builder", { form_id: 1, responses: [{ form_question_id: "abc" }] }, "requestor"],
    ["an object as entry id", "/api/form-entries/submit-approval", { form_entry_id: { id: 1 } }, "requestor"],
    ["user roles that aren't a list", "/api/users/create", { user_username: "x", user_password: "P@ssword1", user_groups: "all_access" }, "all_access"],
    ["approver ids that aren't numbers", "/api/form-approvers/form/1", { assignments: { first: ["x"], second: [], third: [] } }, "qfd_admin"],
    ["a 300-character form name", "/api/forms/create", { form_name: "x".repeat(300) }, "qfd_admin"],
  ])("refuses %s with a readable 400", async (_, path, body, role) => {
    const who = { requestor, qfd_admin: qfd, all_access: it_admin }[role];
    const req = path.includes("approvers") ? api.put(path) : api.post(path);
    const res = await (who ? req.set(authHeader(who)) : req).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^Invalid /);
  });

  it("still accepts what the client actually sends (ids as strings, extra fields)", async () => {
    const res = await post(
      "/api/form-entries/create-builder",
      {
        form_id: String(form.id), // <select> values are strings
        user_id: 999, // still sent by the client, ignored by the server
        form_entry_status: "draft",
        form_entry_archivestatus: 0,
        responses: [],
      },
      requestor,
    );
    expect(res.status).toBe(201);
  });

  it("missing required fields still get the controller's own message", async () => {
    const res = await api.post("/api/auth/login").send({});
    expect(res.body.message).toBe("Enter your username and password");
  });
});

describe("report size cap (10,000 entries per request)", () => {
  const ids = (n) => Array.from({ length: n }, (_, i) => i + 1);

  it.each([
    "/api/reports/raw-answers",
    "/api/reports/generate-overall-average",
    "/api/reports/generate-per-section-average",
    "/api/reports/generate-per-question-average",
  ])("%s refuses 10,001 entries with a clear message", async (path) => {
    const res = await post(path, { entry_ids: ids(10_001), condition: "Y" }, qfd);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too many entries .*max 10,000.*Narrow the date range/);
  });

  it("accepts exactly 10,000 entries", async () => {
    const res = await post("/api/reports/raw-answers", { entry_ids: ids(10_000) }, qfd);
    expect(res.status).toBe(200);
  });

  it("saving a report has the same cap", async () => {
    const res = await post("/api/saved-reports/save", { entry_ids: ids(10_001) }, qfd);
    expect(res.status).toBe(400);
  });
});

describe("list sizes are capped", () => {
  it("form lists return at most 100 rows per page", async () => {
    await Forms.bulkCreate(
      Array.from({ length: 120 }, (_, i) => ({ form_name: `F${i}` })),
    );
    const res = await api
      .get("/api/forms/pagination?pageSize=100000")
      .set(authHeader(qfd));
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
    expect(res.body.forms).toHaveLength(100);
  });

  it("the user list allows up to 1,000 (approver picker)", async () => {
    await Users.bulkCreate(
      Array.from({ length: 150 }, (_, i) => ({
        user_firstname: "U",
        user_lastname: `${i}`,
        user_email: `bulk${i}@test.local`,
        user_username: `bulk${i}`,
        user_password: "x",
        user_groups: ["approver"],
      })),
    );
    const res = await api
      .get("/api/users/pagination?page=1&pageSize=1000")
      .set(authHeader(qfd));
    expect(res.body.pageSize).toBe(1000);
    expect(res.body.data.length).toBeGreaterThan(100);

    const huge = await api
      .get("/api/users/pagination?pageSize=50000")
      .set(authHeader(qfd));
    expect(huge.body.pageSize).toBe(1000);
  });

  it("page and pageSize garbage falls back to defaults", async () => {
    const res = await api
      .get("/api/forms/pagination?page=-5&pageSize=abc")
      .set(authHeader(qfd));
    expect(res.status).toBe(200);
    expect(res.body.currentPage).toBe(1);
    expect(res.body.pageSize).toBe(10);
  });

  it("the dashboard's recent entries return at most 50", async () => {
    await FormEntries.bulkCreate(
      Array.from({ length: 60 }, () => ({
        user_id: requestor.id,
        form_id: form.id,
        form_entry_status: "draft",
      })),
    );
    const res = await api
      .get("/api/dashboard/recent-entries?limit=100000")
      .set(authHeader(it_admin));
    expect(res.status).toBe(200);
    const rows = Array.isArray(res.body) ? res.body : res.body.data || res.body.entries;
    expect(rows.length).toBeLessThanOrEqual(50);
  });
});

describe("query strings must be plain values", () => {
  it("refuses ?site[gt]=x style nested parameters", async () => {
    const res = await api
      .get("/api/form-entries/pagination?site[gt]=x")
      .set(authHeader(qfd));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid query parameter: site");
  });
});

describe("errors never send internals to the browser", () => {
  it("a database error inside a handler: message kept, SQL and error object dropped", async () => {
    const dbError = new Error("SELECT * FROM `forms` — secret SQL");
    dbError.sql = "SELECT * FROM `forms`";
    vi.spyOn(Forms, "findAll").mockRejectedValue(dbError);

    const res = await api.get("/api/forms/all").set(authHeader(requestor));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: "Error fetching forms",
      ErrorMessage: "Error fetching forms",
      ErrorState: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SELECT|secret/);
  });

  it("an error thrown outside any try/catch gets a generic 500", async () => {
    vi.spyOn(FormEntries, "findOne").mockRejectedValue(new Error("boom: internal detail"));
    const res = await api
      .get("/api/form-entries/get/1")
      .set(authHeader(qfd));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/boom|internal detail/);
  });

  it("invalid JSON gets a 400 without parser details", async () => {
    const res = await api
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"user_username": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Request body is not valid JSON" });
  });

  it("a body over 1 MB gets 413", async () => {
    const res = await api
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ user_username: "x".repeat(1_100_000) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Request is too large" });
  });
});

describe("rooms search", () => {
  it("filtering by name no longer crashes", async () => {
    const res = await api
      .get("/api/rooms/pagination?name=freezer&site=Taytay&location=A")
      .set(authHeader(qfd));
    expect(res.status).toBe(200);
  });
});
