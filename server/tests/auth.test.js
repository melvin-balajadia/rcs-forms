import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import Users from "../Models/Users.js";
import FormEntries from "../Models/FormEntries.js";
import {
  api,
  resetDb,
  createUser,
  createForm,
  authHeader,
} from "./helpers.js";

const PASSWORD = "P@ssword1";

const login = (user, password = PASSWORD) =>
  api
    .post("/api/auth/login")
    .send({ user_username: user.user_username, user_password: password });

const refreshCookie = (res) =>
  res.headers["set-cookie"].find((c) => c.startsWith("jwt="));

describe("auth", () => {
  let user;

  beforeEach(async () => {
    await resetDb();
    user = await createUser("requestor", {
      user_password: await bcrypt.hash(PASSWORD, 4),
    });
  });

  describe("login and refresh", () => {
    it("logs in and refreshes", async () => {
      const res = await login(user);
      expect(res.body.errorStatus).toBe(false);
      expect(res.body.accessToken).toBeTruthy();

      const refreshed = await api
        .post("/api/auth/refresh-token")
        .set("Cookie", refreshCookie(res));
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.accessToken).toBeTruthy();
    });

    it("never returns secrets in the login response", async () => {
      const res = await login(user);
      expect(JSON.stringify(res.body)).not.toMatch(
        /user_password|user_refreshtoken/,
      );
    });

    it("rejects login for an archived account", async () => {
      await user.update({ user_archivestatus: true });
      const res = await login(user);
      expect(res.body.errorStatus).toBe(true);
      expect(res.body.accessToken).toBeUndefined();
    });

    it("rejects refresh for an account archived after login", async () => {
      const res = await login(user);
      await user.update({ user_archivestatus: true });
      const refreshed = await api
        .post("/api/auth/refresh-token")
        .set("Cookie", refreshCookie(res));
      expect(refreshed.status).toBe(403);
    });
  });

  describe("first-login password reset (Phase 0)", () => {
    beforeEach(() => user.update({ user_reset_token: false }));

    it("returns a reset token, not the user id", async () => {
      const res = await login(user);
      expect(res.body.requiresReset).toBe(true);
      expect(res.body.resetToken).toBeTruthy();
      expect(res.body.userId).toBeUndefined();
    });

    it("resets with the token, then the token can't be reused", async () => {
      const { resetToken } = (await login(user)).body;
      const body = {
        resetToken,
        newPassword: "N3w@Password",
        confirmPassword: "N3w@Password",
      };

      const first = await api.post("/api/auth/reset-password").send(body);
      expect(first.body.errorStatus).toBe(false);
      expect((await login(user, "N3w@Password")).body.accessToken).toBeTruthy();

      const reuse = await api.post("/api/auth/reset-password").send(body);
      expect(reuse.body.errorStatus).toBe(true);
    });

    it("ignores a user id in place of a token", async () => {
      const res = await api.post("/api/auth/reset-password").send({
        userId: user.id,
        newPassword: "N3w@Password",
        confirmPassword: "N3w@Password",
      });
      expect(res.body.errorStatus).toBe(true);
      const stored = await Users.scope("withSecrets").findByPk(user.id);
      expect(await bcrypt.compare(PASSWORD, stored.user_password)).toBe(true);
    });

    it("a reset token can't be used as an API token", async () => {
      const { resetToken } = (await login(user)).body;
      const res = await api
        .get("/api/dashboard/all")
        .set("Authorization", `Bearer ${resetToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("no secrets in API responses (Phase 0)", () => {
    it("form entries and user lookups hide password and refresh token", async () => {
      const admin = await createUser("all_access");
      await login(user); // stores a refresh token for this user
      const form = await createForm();
      await FormEntries.create({
        user_id: user.id,
        form_id: form.id,
        form_entry_status: "draft",
      });

      for (const path of [
        "/api/form-entries/all",
        `/api/users/get/${user.id}`,
        "/api/users/pagination",
      ]) {
        const res = await api.get(path).set(authHeader(admin));
        expect(res.status).toBe(200);
        // The user's data must actually be present for the check to mean anything
        expect(JSON.stringify(res.body)).toContain(user.user_username);
        expect(JSON.stringify(res.body)).not.toMatch(
          /user_password|user_refreshtoken/,
        );
      }
    });
  });
});
