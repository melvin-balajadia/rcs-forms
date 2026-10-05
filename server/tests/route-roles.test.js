import { describe, it, expect, beforeAll } from "vitest";
import {
  api,
  resetDb,
  createRoleUsers,
  authHeader,
  ROLES,
} from "./helpers.js";

// Exact message from requireRole — distinguishes a role block from a
// controller's own business-rule 403 (e.g. "not assigned to this form").
const ROLE_DENIED = "You don't have permission to perform this action.";

const ALL = ROLES;
const ADMINS = ["all_access", "qfd_admin"];
const APPROVERS = ["approver", ...ADMINS];
const IT_ONLY = ["all_access"];

// [method, path, roles allowed]
const MATRIX = [
  // Dashboard
  ["get", "/api/dashboard/all", ALL],
  ["get", "/api/dashboard/key-metrics", ALL],
  ["get", "/api/dashboard/system-overview", ALL],
  ["get", "/api/dashboard/recent-entries", ALL],

  // Forms: everyone reads (form-entry pages), admins build
  ["get", "/api/forms/all", ALL],
  ["get", "/api/forms/pagination", ALL],
  ["get", "/api/forms/get/1", ALL],
  ["post", "/api/forms/create", ADMINS],
  ["post", "/api/forms/builder", ADMINS],
  ["put", "/api/forms/update/1", ADMINS],
  ["delete", "/api/forms/1", ADMINS],
  ["put", "/api/forms/archive/1", ADMINS],

  // Form entries
  ["get", "/api/form-entries/all", ADMINS],
  ["get", "/api/form-entries/get/1", ALL],
  ["get", "/api/form-entries/pagination", ALL],
  ["get", "/api/form-entries/entry/1", ALL],
  ["get", "/api/form-entries/1/approval-history", ALL],
  ["post", "/api/form-entries/create-builder", ALL],
  ["post", "/api/form-entries/submit-approval", ALL],
  ["put", "/api/form-entries/update-builder/1", ALL],
  ["post", "/api/form-entries/approve", APPROVERS],
  ["post", "/api/form-entries/return", APPROVERS],
  ["delete", "/api/form-entries/1", ADMINS],
  ["put", "/api/form-entries/archive/1", ADMINS],

  // Form approvers (the /user/:id GET is tested separately: self or admin)
  ["put", "/api/form-approvers/user/999", IT_ONLY],
  ["get", "/api/form-approvers/form/1", ADMINS],
  ["put", "/api/form-approvers/form/1", ADMINS],

  // Reports and saved reports
  ["get", "/api/reports/filter-options", ADMINS],
  ["post", "/api/reports/filter-entries", ADMINS],
  ["get", "/api/reports/filter-statistics", ADMINS],
  ["get", "/api/reports/forms/1/sections-multiple", ADMINS],
  ["post", "/api/reports/generate-overall-average", ADMINS],
  ["post", "/api/reports/generate-per-section-average", ADMINS],
  ["post", "/api/reports/generate-per-question-average", ADMINS],
  ["post", "/api/reports/raw-answers", ADMINS],
  ["post", "/api/saved-reports/save", ADMINS],
  ["get", "/api/saved-reports/my-reports", ADMINS],
  ["get", "/api/saved-reports/1", ADMINS],
  ["put", "/api/saved-reports/1", ADMINS],
  ["delete", "/api/saved-reports/1", ADMINS],
  ["post", "/api/saved-reports/1/refresh", ADMINS],

  // Clients and rooms
  ["get", "/api/clients/all", ADMINS],
  ["post", "/api/clients/create", ADMINS],
  ["get", "/api/clients/get/1", ADMINS],
  ["put", "/api/clients/update/1", ADMINS],
  ["put", "/api/clients/archive/1", ADMINS],
  ["get", "/api/clients/pagination", ADMINS],
  ["post", "/api/rooms/create", ADMINS],
  ["get", "/api/rooms/all", ADMINS],
  ["get", "/api/rooms/get/1", ADMINS],
  ["put", "/api/rooms/update/1", ADMINS],
  ["put", "/api/rooms/archive/1", ADMINS],
  ["get", "/api/rooms/pagination", ADMINS],

  // Users (Phase 0)
  ["get", "/api/users/pagination", ADMINS],
  ["post", "/api/users/create", IT_ONLY],
  ["get", "/api/users/get/1", IT_ONLY],
  ["put", "/api/users/edit/1", IT_ONLY],
  ["put", "/api/users/reset-password/1", IT_ONLY],
  ["put", "/api/users/archive/999", IT_ONLY],

  // Standalone EAV endpoints (UI uses the builder endpoints instead)
  ["get", "/api/questions/all", ADMINS],
  ["get", "/api/questions/get/1", ADMINS],
  ["get", "/api/questions/get-form/1", ADMINS],
  ["post", "/api/questions/create", ADMINS],
  ["put", "/api/questions/update/1", ADMINS],
  ["delete", "/api/questions/1", ADMINS],
  ["get", "/api/questions-value/all", ADMINS],
  ["get", "/api/questions-value/entry/1", ADMINS],
  ["get", "/api/questions-value/get/1", ADMINS],
  ["post", "/api/questions-value/create", ADMINS],
  ["put", "/api/questions-value/update/1", ADMINS],
  ["delete", "/api/questions-value/1", ADMINS],
  ["get", "/api/questions-sub-value/all", ADMINS],
  ["get", "/api/questions-sub-value/get/1", ADMINS],
  ["post", "/api/questions-sub-value/create", ADMINS],
  ["put", "/api/questions-sub-value/update/1", ADMINS],
  ["delete", "/api/questions-sub-value/1", ADMINS],
  ["post", "/api/form-section/create", ADMINS],
  ["get", "/api/form-section/all", ADMINS],
  ["get", "/api/form-section/get/1", ADMINS],
];

describe("route role rules", () => {
  let users;

  beforeAll(async () => {
    await resetDb();
    users = await createRoleUsers();
  });

  describe.each(MATRIX)("%s %s", (method, path, allowed) => {
    it("requires a token", async () => {
      const res = await api[method](path);
      expect(res.status).toBe(401);
    });

    it.each(ROLES)(`role %s`, async (role) => {
      const res = await api[method](path).set(authHeader(users[role])).send({});
      const blocked = res.body?.ErrorMessage === ROLE_DENIED;

      if (allowed.includes(role)) {
        expect(blocked, `${role} should be allowed`).toBe(false);
        expect(res.status).not.toBe(401);
      } else {
        expect(res.status, `${role} should be blocked`).toBe(403);
        expect(blocked).toBe(true);
      }
    });
  });

  describe("GET /api/form-approvers/user/:userId (self or admin)", () => {
    it.each(ROLES)("role %s can read their own assignments", async (role) => {
      const res = await api
        .get(`/api/form-approvers/user/${users[role].id}`)
        .set(authHeader(users[role]));
      expect(res.body?.ErrorMessage).not.toBe(ROLE_DENIED);
    });

    it.each(["requestor", "approver"])(
      "role %s cannot read someone else's",
      async (role) => {
        const res = await api
          .get(`/api/form-approvers/user/${users.all_access.id}`)
          .set(authHeader(users[role]));
        expect(res.status).toBe(403);
      },
    );

    it.each(ADMINS)("role %s can read anyone's", async (role) => {
      const res = await api
        .get(`/api/form-approvers/user/${users.requestor.id}`)
        .set(authHeader(users[role]));
      expect(res.body?.ErrorMessage).not.toBe(ROLE_DENIED);
    });
  });

  describe("accounts", () => {
    it("rejects a token for an archived user", async () => {
      await users.approver.update({ user_archivestatus: true });
      const res = await api
        .get("/api/dashboard/all")
        .set(authHeader(users.approver));
      expect(res.status).toBe(401);
      await users.approver.update({ user_archivestatus: false });
    });
  });
});
