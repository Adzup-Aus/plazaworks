import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const SAFE_URL = "postgresql://plazaworks:postgres@localhost:5432/plazaworks";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.resolve(__dirname, "..", "pre-commit-env-check");

function runHook(cwd: string): { status: number | null; stderr: string; stdout: string } {
  const r = spawnSync("sh", [HOOK_PATH], { cwd, encoding: "utf-8" });
  return { status: r.status, stderr: r.stderr ?? "", stdout: r.stdout ?? "" };
}

describe("pre-commit-env-check", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function withEnv(envContent: string | null, gitFiles?: { "MERGE_HEAD"?: string; "CHERRY_PICK_HEAD"?: string; "REVERT_HEAD"?: string }) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pre-commit-env-check-"));
    if (envContent !== null) {
      fs.writeFileSync(path.join(tmpDir, ".env"), envContent, "utf-8");
    }
    if (gitFiles) {
      const gitDir = path.join(tmpDir, ".git");
      fs.mkdirSync(gitDir, { recursive: true });
      if (gitFiles.MERGE_HEAD !== undefined) {
        fs.writeFileSync(path.join(gitDir, "MERGE_HEAD"), gitFiles.MERGE_HEAD, "utf-8");
      }
      if (gitFiles.CHERRY_PICK_HEAD !== undefined) {
        fs.writeFileSync(path.join(gitDir, "CHERRY_PICK_HEAD"), gitFiles.CHERRY_PICK_HEAD, "utf-8");
      }
      if (gitFiles.REVERT_HEAD !== undefined) {
        fs.writeFileSync(path.join(gitDir, "REVERT_HEAD"), gitFiles.REVERT_HEAD, "utf-8");
      }
    }
    return runHook(tmpDir);
  }

  it("allows commit when DATABASE_URL equals safe value", () => {
    const result = withEnv(`DATABASE_URL=${SAFE_URL}\n`);
    expect(result.status).toBe(0);
  });

  it("blocks commit when DATABASE_URL is different", () => {
    const result = withEnv("DATABASE_URL=postgresql://postgres:postgres@localhost:5436/plazaworks\n");
    expect(result.status).toBe(1);
    const out = result.stdout + result.stderr;
    expect(out).toContain("Commit blocked");
    expect(out).toContain(SAFE_URL);
  });

  it("skips check when .env does not exist", () => {
    const result = withEnv(null);
    expect(result.status).toBe(0);
    const out = result.stdout + result.stderr;
    expect(out).toContain("not found");
  });

  it("blocks commit when DATABASE_URL is not set in .env", () => {
    const result = withEnv("# only comments\nSESSION_SECRET=abc\n");
    expect(result.status).toBe(1);
    const out = result.stdout + result.stderr;
    expect(out).toMatch(/DATABASE_URL not set|Commit blocked/);
  });

  it("skips check when MERGE_HEAD exists (merge commit)", () => {
    const result = withEnv(`DATABASE_URL=postgresql://other:user@prod:5432/db\n`, { MERGE_HEAD: "abc" });
    expect(result.status).toBe(0);
  });

  it("skips check when CHERRY_PICK_HEAD exists", () => {
    const result = withEnv(`DATABASE_URL=postgresql://other:user@prod:5432/db\n`, { CHERRY_PICK_HEAD: "abc" });
    expect(result.status).toBe(0);
  });

  it("skips check when REVERT_HEAD exists", () => {
    const result = withEnv(`DATABASE_URL=postgresql://other:user@prod:5432/db\n`, { REVERT_HEAD: "abc" });
    expect(result.status).toBe(0);
  });

  it("uses last DATABASE_URL when multiple are present", () => {
    const result = withEnv(
      `DATABASE_URL=postgresql://wrong:user@localhost/db\nOTHER=1\nDATABASE_URL=${SAFE_URL}\n`
    );
    expect(result.status).toBe(0);
  });
});
