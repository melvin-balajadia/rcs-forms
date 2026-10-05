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

// Every test sends someone else's id in the body. The server must ignore it
// and act as the logged-in user.
describe("identity comes from the token, not the request body", () => {
  let alice, bob, approver, admin, form;

  beforeEach(async () => {
    await resetDb();
    alice = await createUser("requestor");
    bob = await createUser("requestor");
    approver = await createUser("approver");
    admin = await createUser("all_access");
    form = await createForm();
  });

  const entryFor = (owner, status) =>
    FormEntries.create({
      user_id: owner.id,
      form_id: form.id,
      form_entry_status: status,
    });

  it("create-builder: entry belongs to the caller, not body user_id", async () => {
    const res = await api
      .post("/api/form-entries/create-builder")
      .set(authHeader(alice))
      .send({ user_id: bob.id, form_id: form.id, form_entry_status: "draft" });

    expect(res.status).toBe(201);
    const entries = await FormEntries.findAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].user_id).toBe(alice.id);
  });

  it("update-builder: can't edit another user's entry by sending their user_id", async () => {
    const entry = await entryFor(alice, "draft");
    const res = await api
      .put(`/api/form-entries/update-builder/${entry.id}`)
      .set(authHeader(bob))
      .send({ form_entry_id: entry.id, user_id: alice.id, form_id: form.id });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Unauthorized to update this entry");
  });

  it("submit-approval: a requestor can't submit another user's entry", async () => {
    const entry = await entryFor(alice, "pending");
    const res = await api
      .post("/api/form-entries/submit-approval")
      .set(authHeader(bob))
      .send({ form_entry_id: entry.id, user_id: alice.id });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You can only submit your own form");
  });

  it("approve: an unassigned approver can't approve by posing as an admin", async () => {
    const entry = await entryFor(alice, "submitted_first");
    const res = await api
      .post("/api/form-entries/approve")
      .set(authHeader(approver))
      .send({ form_entry_id: entry.id, approver_id: admin.id, action: "approve" });

    expect(res.status).toBe(403);
    await entry.reload();
    expect(entry.form_entry_status).toBe("submitted_first");
  });

  it("approve: records the logged-in approver, not the body approver_id", async () => {
    await assignApprover(form, approver, "first");
    const entry = await entryFor(alice, "submitted_first");
    const res = await api
      .post("/api/form-entries/approve")
      .set(authHeader(approver))
      .send({ form_entry_id: entry.id, approver_id: admin.id, action: "approve" });

    expect(res.status).toBe(200);
    await entry.reload();
    expect(entry.form_entry_status).toBe("approved_first");
    expect(entry.form_entry_firstapprover_id).toBe(approver.id);
  });

  it("approve: assigned to every level, one approver can still approve all (as today)", async () => {
    for (const level of ["first", "second", "third"])
      await assignApprover(form, approver, level);
    const entry = await entryFor(alice, "submitted_first");

    for (let i = 0; i < 3; i++) {
      const res = await api
        .post("/api/form-entries/approve")
        .set(authHeader(approver))
        .send({ form_entry_id: entry.id, action: "approve" });
      expect(res.status).toBe(200);
    }
    await entry.reload();
    expect(entry.form_entry_status).toBe("completed");
  });

  it("return: an unassigned approver can't return by posing as an admin", async () => {
    const entry = await entryFor(alice, "submitted_first");
    const res = await api
      .post("/api/form-entries/return")
      .set(authHeader(approver))
      .send({ form_entry_id: entry.id, returner_id: admin.id, remarks: "x" });

    expect(res.status).toBe(403);
    await entry.reload();
    expect(entry.form_entry_status).toBe("submitted_first");
  });

  it("return: records the logged-in returner", async () => {
    await assignApprover(form, approver, "first");
    const entry = await entryFor(alice, "submitted_first");
    const res = await api
      .post("/api/form-entries/return")
      .set(authHeader(approver))
      .send({ form_entry_id: entry.id, returner_id: admin.id, remarks: "fix" });

    expect(res.status).toBe(200);
    await entry.reload();
    expect(entry.form_entry_status).toBe("returned");
    expect(entry.form_entry_returner_id).toBe(approver.id);
  });

  it("admins can still approve without an assignment (as today)", async () => {
    const entry = await entryFor(alice, "submitted_first");
    const res = await api
      .post("/api/form-entries/approve")
      .set(authHeader(admin))
      .send({ form_entry_id: entry.id, action: "approve" });

    expect(res.status).toBe(200);
    await entry.reload();
    expect(entry.form_entry_firstapprover_id).toBe(admin.id);
  });
});
