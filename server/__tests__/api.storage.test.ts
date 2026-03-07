import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

const hasDb = !!process.env.DATABASE_URL;
let app: Express;

describe.runIf(hasDb)("API storage (S3 approach)", () => {
  beforeAll(async () => {
    const { createApp } = await import("../index");
    const out = await createApp();
    app = out.app;
  });

  describe("POST /api/uploads/request-url", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/uploads/request-url")
        .send({
          filename: "test.jpg",
          contentType: "image/jpeg",
          size: 1024,
        });
      expect(res.status).toBe(401);
    });

    it("with valid session returns 200 or 503", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "cliffcoelho@gmail.com", password: "secret1234" });
      if (loginRes.status !== 200) return;

      const cookies = loginRes.headers["set-cookie"];
      const res = await request(app)
        .post("/api/uploads/request-url")
        .set("Cookie", cookies || [])
        .send({
          filename: "job-site.jpg",
          contentType: "image/jpeg",
          size: 2048,
        });
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty("uploadURL");
        expect(res.body).toHaveProperty("objectPath");
        expect(res.body.objectPath).toMatch(/^uploads\/[a-f0-9-]+\.(jpg|jpeg|png|gif|webp|heic|heif|pdf|bin)$/i);
      }
    });

    it("returns 400 when file size exceeds 10MB", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "cliffcoelho@gmail.com", password: "secret1234" });
      if (loginRes.status !== 200) return;

      const cookies = loginRes.headers["set-cookie"];
      const res = await request(app)
        .post("/api/uploads/request-url")
        .set("Cookie", cookies || [])
        .send({
          filename: "large.jpg",
          contentType: "image/jpeg",
          size: 11 * 1024 * 1024,
        });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("POST /api/storage/signed-url", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/storage/signed-url")
        .send({ objectKey: "uploads/abc-123.jpg" });
      expect(res.status).toBe(401);
    });

    it("with valid session returns 200 with signedUrl when R2 configured", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "cliffcoelho@gmail.com", password: "secret1234" });
      if (loginRes.status !== 200) return;

      const cookies = loginRes.headers["set-cookie"];
      const res = await request(app)
        .post("/api/storage/signed-url")
        .set("Cookie", cookies || [])
        .send({ objectKey: "uploads/test-uuid.jpg" });
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty("signedUrl");
        expect(res.body).toHaveProperty("expiresAt");
        expect(res.body.signedUrl).toMatch(/^https:\/\//);
      }
    });
  });
});
