import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;

describe.runIf(hasDb)("API auth", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
  });

  it("GET /api/auth/session when unauthenticated returns isAuthenticated false", async () => {
    const res = await request(app).get("/api/auth/session");
    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(false);
  });

  it("POST /api/auth/register returns 410 when invite-only (prod) or 201 in test", async () => {
    const email = process.env.NODE_ENV === "test"
      ? `register-${Date.now()}@example.com`
      : "someone@example.com";
    const res = await request(app).post("/api/auth/register").send({
      email,
      password: "password123",
    });
    if (process.env.NODE_ENV === "test") {
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("userId");
    } else {
      expect(res.status).toBe(410);
      expect(res.body.message).toMatch(/invite only/i);
    }
  });

  it("POST /api/auth/login with seeded admin credentials returns 200 and session", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("userId");
    expect(res.body.message).toMatch(/success/i);
  });

  it("POST /api/invites unauthenticated returns 401", async () => {
    const res = await request(app).post("/api/invites").send({
      email: "new@example.com",
      firstName: "New",
      lastName: "User",
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/invites unauthenticated returns 401", async () => {
    const res = await request(app).get("/api/invites");
    expect(res.status).toBe(401);
  });

  it("POST /api/invites as admin with valid email and name returns 201", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    expect(loginRes.status).toBe(200);
    const email = `invite-${Date.now()}@example.com`;
    const res = await request(app).post("/api/invites").set("Cookie", cookie).send({
      email,
      firstName: "Invited",
      lastName: "User",
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("inviteId");
    expect(res.body.email).toBe(email);
    expect(res.body.firstName).toBe("Invited");
    expect(res.body.lastName).toBe("User");
    expect(res.body).toHaveProperty("expiresAt");
  });

  it("POST /api/invites without firstName or lastName returns 400", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    const email = `invite-missing-name-${Date.now()}@example.com`;
    const res = await request(app).post("/api/invites").set("Cookie", cookie).send({ email });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/first name|last name/i);
  });

  it("POST /api/invites with already registered email returns 400", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    const res = await request(app).post("/api/invites").set("Cookie", cookie).send({
      email: "cliffcoelho@gmail.com",
      firstName: "Cliff",
      lastName: "Coelho",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it("POST /api/invites with staffConfig stores and returns staffConfig", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    const email = `invite-staffconfig-${Date.now()}@example.com`;
    const { storage } = await import("../storage");
    const roles = await storage.getRoles();
    const adminRole = roles.find((r) => r.name === "admin");
    const roleIds = adminRole ? [adminRole.id] : [];
    const res = await request(app)
      .post("/api/invites")
      .set("Cookie", cookie)
      .send({
        email,
        firstName: "StaffConfig",
        lastName: "User",
        roleIds,
        employmentType: "contractor",
        salaryType: "hourly",
        salaryAmount: "50",
        overtimeRateMultiplier: "1.5",
        overtimeThresholdHours: "38",
        timezone: "Australia/Brisbane",
        lunchBreakMinutes: 30,
        lunchBreakPaid: true,
        workingHours: [
          { dayOfWeek: 1, isWorkingDay: true, startTime: "08:00", endTime: "17:00" },
          { dayOfWeek: 2, isWorkingDay: true, startTime: "08:00", endTime: "17:00" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body.staffConfig).toBeDefined();
    expect(res.body.staffConfig.employmentType).toBe("contractor");
    expect(res.body.staffConfig.timezone).toBe("Australia/Brisbane");
    expect(res.body.staffConfig.workingHours).toHaveLength(2);
  });

  it("POST /api/invites/accept with staffConfig creates staff with employmentType and working hours", async () => {
    const { storage } = await import("../storage");
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    expect(loginRes.status).toBe(200);
    const roles = await storage.getRoles();
    const adminRole = roles.find((r) => r.name === "admin");
    const email = `accept-staffconfig-${Date.now()}@example.com`;
    const token = "test-staffconfig-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    await storage.createUserInvite({
      email,
      token,
      invitedBy: loginRes.body.userId,
      roleId: adminRole?.id ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      firstName: "Accept",
      lastName: "StaffConfig",
      staffConfig: {
        roles: adminRole ? [adminRole.name] : [],
        employmentType: "contractor",
        salaryType: "hourly",
        salaryAmount: "55",
        timezone: "Australia/Perth",
        lunchBreakMinutes: 45,
        lunchBreakPaid: false,
        workingHours: [
          { dayOfWeek: 0, isWorkingDay: false, startTime: "07:00", endTime: "15:30" },
          { dayOfWeek: 1, isWorkingDay: true, startTime: "09:00", endTime: "18:00" },
        ],
      } as any,
    });
    const postRes = await request(app).post("/api/invites/accept").send({
      token,
      password: "staffpass123",
    });
    expect(postRes.status).toBe(201);
    const userId = postRes.body.userId;
    expect(userId).toBeDefined();
    const staffProfiles = await storage.getStaffProfiles();
    const profile = staffProfiles.find((p) => p.userId === userId);
    expect(profile).toBeDefined();
    expect(profile?.employmentType).toBe("contractor");
    expect(profile?.timezone).toBe("Australia/Perth");
    expect(profile?.lunchBreakMinutes).toBe(45);
    expect(profile?.lunchBreakPaid).toBe(false);
    const workingHours = await storage.getStaffWorkingHours(profile!.id);
    expect(workingHours.length).toBeGreaterThanOrEqual(1);
    const monday = workingHours.find((h) => h.dayOfWeek === 1);
    expect(monday?.isWorkingDay).toBe(true);
    expect(monday?.startTime).toBe("09:00");
    expect(monday?.endTime).toBe("18:00");
  });

  it("GET /api/invites as admin returns 200 with array including firstName, lastName", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    const res = await request(app).get("/api/invites").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invites)).toBe(true);
    res.body.invites.forEach((inv: { firstName?: string; lastName?: string }) => {
      expect(inv).toHaveProperty("firstName");
      expect(inv).toHaveProperty("lastName");
    });
  });

  it("GET /api/invites/accept without token returns 400", async () => {
    const res = await request(app).get("/api/invites/accept");
    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
  });

  it("GET /api/invites/accept with bad token returns 400", async () => {
    const res = await request(app).get("/api/invites/accept?token=bad-token");
    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
  });

  it("POST /api/invites/accept with valid token and password creates user and returns 201", async () => {
    const { storage } = await import("../storage");
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    expect(loginRes.status).toBe(200);
    const adminUserId = loginRes.body.userId;
    const email = `accept-${Date.now()}@example.com`;
    const token = "test-token-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    await storage.createUserInvite({
      email,
      token,
      invitedBy: adminUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      firstName: "Accept",
      lastName: "Tester",
    });
    const getRes = await request(app).get(`/api/invites/accept?token=${encodeURIComponent(token)}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.valid).toBe(true);
    expect(getRes.body.email).toBe(email);
    expect(getRes.body.firstName).toBe("Accept");
    expect(getRes.body.lastName).toBe("Tester");
    const postRes = await request(app).post("/api/invites/accept").send({
      token,
      password: "newpassword123",
    });
    expect(postRes.status).toBe(201);
    expect(postRes.body).toHaveProperty("userId");
    expect(postRes.body.message).toMatch(/sign in/i);
  });

  it("POST /api/invites/accept creates user with firstName and lastName from invite (password only)", async () => {
    const { storage } = await import("../storage");
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    expect(loginRes.status).toBe(200);
    const email = `accept-name-${Date.now()}@example.com`;
    const token = "test-name-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    await storage.createUserInvite({
      email,
      token,
      invitedBy: loginRes.body.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      firstName: "From",
      lastName: "Invite",
    });
    const postRes = await request(app).post("/api/invites/accept").send({
      token,
      password: "pass12345",
    });
    expect(postRes.status).toBe(201);
    const signInRes = await request(app).post("/api/auth/login").send({
      email,
      password: "pass12345",
    });
    expect(signInRes.status).toBe(200);
    const cookie = signInRes.headers["set-cookie"];
    const userRes = await request(app).get("/api/auth/user").set("Cookie", cookie);
    expect(userRes.status).toBe(200);
    expect(userRes.body.firstName).toBe("From");
    expect(userRes.body.lastName).toBe("Invite");
  });

  it("after accept invite, login with new email and password succeeds", async () => {
    const { storage } = await import("../storage");
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    expect(loginRes.status).toBe(200);
    const email = `login-after-accept-${Date.now()}@example.com`;
    const token = "test-login-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    await storage.createUserInvite({
      email,
      token,
      invitedBy: loginRes.body.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await request(app).post("/api/invites/accept").send({ token, password: "acceptpass123" });
    const signInRes = await request(app).post("/api/auth/login").send({
      email,
      password: "acceptpass123",
    });
    expect(signInRes.status).toBe(200);
    expect(signInRes.body).toHaveProperty("userId");
  });

  it("PATCH /api/auth/user unauthenticated returns 401", async () => {
    const res = await request(app)
      .patch("/api/auth/user")
      .send({ firstName: "Test", lastName: "User" });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/auth/user with valid auth and firstName, lastName returns 200", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    expect(loginRes.status).toBe(200);
    const res = await request(app)
      .patch("/api/auth/user")
      .set("Cookie", cookie)
      .send({ firstName: "Cliff", lastName: "Coelho" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
    const userRes = await request(app).get("/api/auth/user").set("Cookie", cookie);
    expect(userRes.status).toBe(200);
    expect(userRes.body.firstName).toBe("Cliff");
    expect(userRes.body.lastName).toBe("Coelho");
  });

  it("PATCH /api/auth/user with missing firstName returns 400", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    const res = await request(app)
      .patch("/api/auth/user")
      .set("Cookie", cookie)
      .send({ lastName: "Only" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/first name/i);
  });

  it("POST /api/auth/user/request-upload unauthenticated returns 401", async () => {
    const res = await request(app).post("/api/auth/user/request-upload").send({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/user/request-upload with valid auth returns 200 or 503", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "cliffcoelho@gmail.com",
      password: "secret1234",
    });
    const cookie = loginRes.headers["set-cookie"];
    expect(loginRes.status).toBe(200);
    const res = await request(app)
      .post("/api/auth/user/request-upload")
      .set("Cookie", cookie)
      .send({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 1024,
      });
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("uploadURL");
      expect(res.body).toHaveProperty("objectPath");
    }
  });
});
