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
