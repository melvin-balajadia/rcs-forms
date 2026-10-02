import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Users from "../Models/Users.js";
import { api, resetDb, createUser, authHeader } from "./helpers.js";

const PASSWORD = "P@ssword1";
const STRONG = "N3w@Password";

const login = (username, password = PASSWORD) =>
  api
    .post("/api/auth/login")
    .send({ user_username: username, user_password: password });

const cookieOf = (res) =>
  res.headers["set-cookie"]?.find((c) => c.startsWith("jwt="));

describe("auth hardening", () => {
  let user, admin;

  beforeEach(async () => {
    await resetDb();
    user = await createUser("requestor", {
      user_password: await bcrypt.hash(PASSWORD, 4),
    });
    admin = await createUser("all_access");
  });

  afterEach(() => vi.useRealTimers());

  describe("login errors don't reveal which usernames exist", () => {
    it("unknown user and wrong password get the same message", async () => {
      const unknown = await login("nobody-here");
      const wrong = await login(user.user_username, "Wrong@123");
      expect(unknown.body.message).toBe("Invalid username or password");
      expect(wrong.body.message).toBe("Invalid username or password");
      expect(unknown.status).toBe(wrong.status);
    });
  });

  describe("login lockout (5 failures → 15 minutes)", () => {
    const failTimes = async (n, username = user.user_username) => {
      for (let i = 0; i < n; i++) await login(username, "Wrong@123");
    };

    it("locks the username after 5 failures, even for the right password", async () => {
      await failTimes(5);
      const res = await login(user.user_username);
      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/Too many failed attempts/);
      expect(res.body.accessToken).toBeUndefined();
    });

    it("4 failures don't lock", async () => {
      await failTimes(4);
      expect((await login(user.user_username)).body.accessToken).toBeTruthy();
    });

    it("a successful login resets the count", async () => {
      await failTimes(4);
      await login(user.user_username);
      await failTimes(4);
      expect((await login(user.user_username)).body.accessToken).toBeTruthy();
    });

    it("only that username is locked", async () => {
      const other = await createUser("requestor", {
        user_password: await bcrypt.hash(PASSWORD, 4),
      });
      await failTimes(5);
      expect((await login(other.user_username)).body.accessToken).toBeTruthy();
    });

    it("unknown usernames are locked the same way (no enumeration)", async () => {
      await failTimes(5, "nobody-here");
      expect((await login("nobody-here")).status).toBe(429);
    });

    it("the lock lifts after 15 minutes", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-02T08:00:00Z"));
      await failTimes(5);
      expect((await login(user.user_username)).status).toBe(429);

      vi.setSystemTime(new Date("2026-10-02T08:14:00Z"));
      expect((await login(user.user_username)).status).toBe(429);

      vi.setSystemTime(new Date("2026-10-02T08:15:01Z"));
      expect((await login(user.user_username)).body.accessToken).toBeTruthy();
    });

    it("usernames are matched case-insensitively", async () => {
      await failTimes(5, user.user_username.toUpperCase());
      expect((await login(user.user_username)).status).toBe(429);
    });
  });

  describe("refresh tokens are stored hashed", () => {
    it("the database holds a hash, and refresh and logout still work", async () => {
      const res = await login(user.user_username);
      const cookie = cookieOf(res);
      const token = decodeURIComponent(cookie.split(";")[0].slice(4));

      const stored = (await Users.scope("withSecrets").findByPk(user.id))
        .user_refreshtoken;
      expect(stored).not.toBe(token);
      expect(stored).toBe(crypto.createHash("sha256").update(token).digest("hex"));

      const refreshed = await api
        .post("/api/auth/refresh-token")
        .set("Cookie", cookie);
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.accessToken).toBeTruthy();

      const out = await api.post("/api/auth/logout").set("Cookie", cookie);
      expect(out.status).toBe(204);
      expect(
        (await Users.scope("withSecrets").findByPk(user.id)).user_refreshtoken,
      ).toBeNull();
    });

    it("the stored hash itself can't be used as a cookie", async () => {
      await login(user.user_username);
      const stored = (await Users.scope("withSecrets").findByPk(user.id))
        .user_refreshtoken;
      const res = await api
        .post("/api/auth/refresh-token")
        .set("Cookie", `jwt=${stored}`);
      expect(res.status).toBe(403);
    });
  });

  describe("access tokens", () => {
    it("last 15 minutes, from login and from refresh", async () => {
      const res = await login(user.user_username);
      const fromLogin = jwt.decode(res.body.accessToken);
      expect(fromLogin.exp - fromLogin.iat).toBe(15 * 60);

      const refreshed = await api
        .post("/api/auth/refresh-token")
        .set("Cookie", cookieOf(res));
      const fromRefresh = jwt.decode(refreshed.body.accessToken);
      expect(fromRefresh.exp - fromRefresh.iat).toBe(15 * 60);
    });

    it("an expired token gets 401 so the browser refreshes it", async () => {
      const expired = jwt.sign(
        { user_name: user.user_username, exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.ACCESS_TOKEN_SECRET,
      );
      const res = await api
        .get("/api/dashboard/all")
        .set("Authorization", `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });

    it("a forged token still gets 403", async () => {
      const forged = jwt.sign({ user_name: user.user_username }, "wrong-secret");
      const res = await api
        .get("/api/dashboard/all")
        .set("Authorization", `Bearer ${forged}`);
      expect(res.status).toBe(403);
    });
  });

  describe("security headers", () => {
    it("sets helmet headers and hides the framework", async () => {
      const res = await api.get("/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("password policy when admins set passwords", () => {
    const newUser = (password) => ({
      user_firstname: "New",
      user_lastname: "User",
      user_email: `new${Math.random()}@test.local`,
      user_username: `new${Math.random()}`,
      user_password: password,
      user_groups: ["requestor"],
    });

    it.each(["short1!", "alllowercase1!", "NoNumber!!", "NoSpecial123"])(
      "create user refuses weak password %s",
      async (password) => {
        const res = await api
          .post("/api/users/create")
          .set(authHeader(admin))
          .send(newUser(password));
        expect(res.status).toBe(400);
      },
    );

    it("create user accepts a strong password", async () => {
      const res = await api
        .post("/api/users/create")
        .set(authHeader(admin))
        .send(newUser(STRONG));
      expect(res.status).toBe(201);
    });

    it("edit user refuses a weak password", async () => {
      const res = await api
        .put(`/api/users/edit/${user.id}`)
        .set(authHeader(admin))
        .send({ user_password: "weak" });
      expect(res.status).toBe(400);
    });
  });
});
