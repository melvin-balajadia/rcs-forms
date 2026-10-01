import { describe, it, expect, beforeAll } from "vitest";
import { api, resetDb, createUser, authHeader } from "./helpers.js";

describe("test harness", () => {
  let user;

  beforeAll(async () => {
    await resetDb();
    user = await createUser("all_access");
  });

  it("serves the health check", async () => {
    const res = await api.get("/health");
    expect(res.status).toBe(200);
  });

  it("accepts a valid token", async () => {
    const res = await api.get("/api/dashboard/all").set(authHeader(user));
    expect(res.status).toBe(200);
  });

  it("rejects a missing token", async () => {
    const res = await api.get("/api/dashboard/all");
    expect(res.status).toBe(401);
  });
});
