import { beforeEach, describe, expect, it, vi } from "vitest";

const { compare, findByEmail, issueToken } = vi.hoisted(() => ({
  compare: vi.fn(),
  findByEmail: vi.fn(),
  issueToken: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare }));
vi.mock("@/modules/auth/repository", () => ({
  userRepository: { findByEmail },
}));
vi.mock("@/modules/auth/jwt", () => ({ issueToken }));

import { POST } from "../../app/api/auth/login/route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    compare.mockReset();
    findByEmail.mockReset();
    issueToken.mockReset();
  });

  it("verifies the stored hash and returns a bearer token", async () => {
    findByEmail.mockResolvedValue({
      id: "30000000-0000-4000-8000-000000000001",
      email: "admin@example.com",
      passwordHash: "bcrypt-hash",
      role: "ADMIN",
    });
    compare.mockResolvedValue(true);
    issueToken.mockResolvedValue("signed-token");
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "ADMIN@example.com",
          password: "Admin123!",
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      token: "signed-token",
      token_type: "Bearer",
      user: { role: "ADMIN" },
    });
    expect(findByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(compare).toHaveBeenCalledWith("Admin123!", "bcrypt-hash");
  });

  it("does not distinguish an absent account from a wrong password", async () => {
    findByEmail.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "missing@example.com",
          password: "wrong",
        }),
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(compare).not.toHaveBeenCalled();
  });
});
