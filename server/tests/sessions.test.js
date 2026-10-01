import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { api, resetDb, createUser, authHeader } from "./helpers.js";

const PASSWORD = "P@ssword1";

// Logs in like the browser does and returns its access token and refresh cookie
const loginAs = async (user) => {
  const res = await api
    .post("/api/auth/login")
    .send({ user_username: user.user_username, user_password: PASSWORD });
  expect(res.body.accessToken).toBeTruthy();
  return {
    bearer: { Authorization: `Bearer ${res.body.accessToken}` },
    cookie: res.headers["set-cookie"].find((c) => c.startsWith("jwt=")),
  };
};

const apiCall = (session) => api.get("/api/dashboard/all").set(session.bearer);
const reopen = (session) =>
  api.post("/api/auth/refresh-token").set("Cookie", session.cookie);

describe("sessions end when an admin changes the account", () => {
  let admin, user, session;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser("all_access");
    user = await createUser("qfd_admin", {
      user_password: await bcrypt.hash(PASSWORD, 4),
    });
    session = await loginAs(user);
    expect((await apiCall(session)).status).toBe(200);
  });

  it("admin password reset: open tab and reopened link are both logged out", async () => {
    await api
      .put(`/api/users/reset-password/${user.id}`)
      .set(authHeader(admin))
      .send({ password: "N3w@Password" });

    expect((await apiCall(session)).status).toBe(401);
    expect((await reopen(session)).status).toBe(403);

    // Logging in again leads to the reset page
    const relog = await api
      .post("/api/auth/login")
      .send({ user_username: user.user_username, user_password: "N3w@Password" });
    expect(relog.body.requiresReset).toBe(true);
  });

  it("password set through edit user also ends sessions", async () => {
    await api
      .put(`/api/users/edit/${user.id}`)
      .set(authHeader(admin))
      .send({ user_password: "N3w@Password" });

    expect((await apiCall(session)).status).toBe(401);
    expect((await reopen(session)).status).toBe(403);
  });

  it("role change: open tab and reopened link are both logged out", async () => {
    await api
      .put(`/api/users/edit/${user.id}`)
      .set(authHeader(admin))
      .send({ user_groups: ["approver"] });

    expect((await apiCall(session)).status).toBe(401);
    expect((await reopen(session)).status).toBe(403);

    // A fresh login works and carries the new role
    const fresh = await loginAs(user);
    expect((await apiCall(fresh)).status).toBe(200);
    const refreshed = await reopen(fresh);
    expect(refreshed.body.user.user_groups).toEqual(["approver"]);
  });

  it("editing other details (same roles) keeps the user logged in", async () => {
    await api
      .put(`/api/users/edit/${user.id}`)
      .set(authHeader(admin))
      .send({ user_firstname: "Renamed", user_groups: ["qfd_admin"] });

    expect((await apiCall(session)).status).toBe(200);
    expect((await reopen(session)).status).toBe(200);
  });

  it("tokens issued before this change (no roles claim) keep working", async () => {
    // authHeader() signs a token without the grp claim, like pre-deploy tokens
    expect((await apiCall({ bearer: authHeader(user) })).status).toBe(200);
  });
});
