import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import Users from "../Models/Users.js";
import FormApprovers from "../Models/FormApprovers.js";
import FormEntries from "../Models/FormEntries.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  assignApprover,
  authHeader,
} from "./helpers.js";

const PASSWORD = "P@ssword1";

let it_admin, qfd, approverA, approverB, requestor, form;

beforeEach(async () => {
  await resetDb();
  it_admin = await createUser("all_access");
  qfd = await createUser("qfd_admin");
  approverA = await createUser("approver", { user_password: await bcrypt.hash(PASSWORD, 4) });
  approverB = await createUser("approver");
  requestor = await createUser("requestor");
  form = await createForm();
  await assignApprover(form, approverA, "first");
  await assignApprover(form, approverB, "first");
});

const archive = (who, target) =>
  api.put(`/api/users/archive/${target.id}`).set(authHeader(who));

describe("archiving users", () => {
  it("all_access archives a user; nothing is deleted", async () => {
    const res = await archive(it_admin, approverA);
    expect(res.status).toBe(200);
    expect(res.body.ErrorMessage).toBe("User has been archived.");

    const row = await Users.scope("withSecrets").findByPk(approverA.id);
    expect(row).not.toBeNull();
    expect(row.user_archivestatus).toBe(true);
  });

  it.each(["qfd_admin", "approver", "requestor"])("%s can't archive users", async (role) => {
    const who = { qfd_admin: qfd, approver: approverB, requestor }[role];
    expect((await archive(who, approverA)).status).toBe(403);
  });

  it("rule 1: nobody can archive their own account", async () => {
    const res = await archive(it_admin, it_admin);
    expect(res.status).toBe(400);
    expect(res.body.ErrorMessage).toBe("You can't archive your own account.");
    expect((await Users.findByPk(it_admin.id)).user_archivestatus).toBe(false);
  });

  it("archiving an already archived user gets 404", async () => {
    await archive(it_admin, approverA);
    expect((await archive(it_admin, approverA)).status).toBe(404);
  });

  it("the archived user is logged out and can't log in", async () => {
    const login = await api
      .post("/api/auth/login")
      .send({ user_username: approverA.user_username, user_password: PASSWORD });
    const cookie = login.headers["set-cookie"].find((c) => c.startsWith("jwt="));
    const bearer = { Authorization: `Bearer ${login.body.accessToken}` };

    await archive(it_admin, approverA);

    expect((await api.get("/api/dashboard/all").set(bearer)).status).toBe(401);
    expect((await api.post("/api/auth/refresh-token").set("Cookie", cookie)).status).toBe(403);
    const again = await api
      .post("/api/auth/login")
      .send({ user_username: approverA.user_username, user_password: PASSWORD });
    expect(again.body.message).toBe("Invalid username or password");
  });

  it("rule 2: their approver assignments are deactivated, and others can still approve", async () => {
    await archive(it_admin, approverA);

    const rows = await FormApprovers.findAll({ where: { user_id: approverA.id } });
    expect(rows.every((r) => r.is_active === false)).toBe(true);

    // The form's approver list no longer shows them
    const listed = await api
      .get(`/api/form-approvers/form/${form.id}`)
      .set(authHeader(qfd));
    expect(listed.body.approvers.first.map((a) => a.id)).toEqual([approverB.id]);

    // An entry waiting at that level can still be approved by the other approver
    const entry = await FormEntries.create({
      user_id: requestor.id,
      form_id: form.id,
      form_entry_status: "submitted_first",
    });
    const approve = await api
      .post("/api/form-entries/approve")
      .set(authHeader(approverB))
      .send({ form_entry_id: entry.id, action: "approve" });
    expect(approve.status).toBe(200);
  });

  it("archived users can't be assigned as approvers again", async () => {
    await archive(it_admin, approverA);
    const res = await api
      .put(`/api/form-approvers/form/${form.id}`)
      .set(authHeader(qfd))
      .send({ assignments: { first: [approverA.id], second: [], third: [] } });
    expect(res.status).toBe(400);
  });

  it("rule 3: archived users are hidden from User Management", async () => {
    await archive(it_admin, approverA);

    const list = await api.get("/api/users/pagination?pageSize=100").set(authHeader(it_admin));
    expect(list.body.data.map((u) => u.id)).not.toContain(approverA.id);
    expect(list.body.total).toBe(4);

    for (const res of [
      await api.get(`/api/users/get/${approverA.id}`).set(authHeader(it_admin)),
      await api.put(`/api/users/edit/${approverA.id}`).set(authHeader(it_admin)).send({ user_firstname: "X" }),
      await api.put(`/api/users/reset-password/${approverA.id}`).set(authHeader(it_admin)).send({ password: "N3w@Password" }),
    ]) {
      expect(res.status).toBe(404);
    }
  });
});
