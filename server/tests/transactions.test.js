import { describe, it, expect, beforeAll } from "vitest";
import FormEntries from "../Models/FormEntries.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  authHeader,
} from "./helpers.js";

// Handlers that open a transaction and then return early (403/400/404) used to
// leave it open. On MySQL that leaks a pooled connection — 5 such requests
// and the whole API hangs. On SQLite the next transaction fails immediately.
describe("early returns never leave a transaction open", () => {
  let owner, other, form, entry;

  beforeAll(async () => {
    await resetDb();
    owner = await createUser("requestor");
    other = await createUser("requestor");
    form = await createForm();
    entry = await FormEntries.create({
      user_id: owner.id,
      form_id: form.id,
      form_entry_status: "draft",
    });
  });

  it("keeps working after more early returns than MySQL's pool size", async () => {
    for (let i = 0; i < 8; i++) {
      const forbidden = await api
        .put(`/api/form-entries/update-builder/${entry.id}`)
        .set(authHeader(other))
        .send({ form_entry_id: entry.id, form_id: form.id });
      expect(forbidden.status).toBe(403);

      const notFound = await api
        .post("/api/form-entries/approve")
        .set(authHeader(await createUser("approver")))
        .send({ form_entry_id: 99999, action: "approve" });
      expect(notFound.status).toBe(404);
    }

    const ok = await api
      .post("/api/form-entries/create-builder")
      .set(authHeader(owner))
      .send({ form_id: form.id, form_entry_status: "draft" });
    expect(ok.status).toBe(201);
  });
});
