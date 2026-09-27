import { afterAll, describe, expect, it } from "vitest";
import { issueToken, verifyToken } from "@/modules/auth/jwt";

const oldDatabaseUrl = process.env.DATABASE_URL;
const oldJwtSecret = process.env.JWT_SECRET;
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-only-secret-that-is-at-least-32-characters";

afterAll(() => {
  if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = oldDatabaseUrl;
  if (oldJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = oldJwtSecret;
});

describe("JWT authentication", () => {
  it("round-trips the verified identity and role", async () => {
    const expected = {
      id: "30000000-0000-4000-8000-000000000001",
      email: "admin@example.com",
      role: "ADMIN" as const,
    };
    const token = await issueToken(expected);
    await expect(verifyToken(token)).resolves.toEqual(expected);
  });

  it("rejects a tampered token", async () => {
    const token = await issueToken({
      id: "30000000-0000-4000-8000-000000000001",
      email: "admin@example.com",
      role: "ADMIN",
    });
    await expect(verifyToken(`${token}tampered`)).rejects.toThrow();
  });
});
