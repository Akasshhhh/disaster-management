import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, actor } = vi.hoisted(() => ({
  create: vi.fn(),
  actor: {
    id: "30000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    role: "ADMIN",
  },
}));

vi.mock("@/container", () => ({ services: { disasters: { create } } }));
vi.mock("@/modules/auth/request-user", () => ({
  getRequestUser: vi.fn(async () => actor),
}));

import { POST } from "../../app/api/disasters/route";

describe("POST /api/disasters", () => {
  beforeEach(() => create.mockReset());

  it("uses authenticated identity and ignores user-supplied created_by", async () => {
    const record = {
      id: "10000000-0000-4000-8000-000000000001",
      createdBy: actor.id,
    };
    create.mockResolvedValue(record);
    const response = await POST(
      new Request("http://localhost/api/disasters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Flood response",
          description: "Flooding around Manhattan, NYC after heavy rainfall.",
          tags: ["flood"],
          created_by: "40000000-0000-4000-8000-000000000001",
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      {
        title: "Flood response",
        description: "Flooding around Manhattan, NYC after heavy rainfall.",
        tags: ["flood"],
      },
      actor,
    );
  });

  it("returns a structured error for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/disasters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MALFORMED_JSON" },
    });
    expect(create).not.toHaveBeenCalled();
  });
});
