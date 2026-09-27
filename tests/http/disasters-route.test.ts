import { beforeEach, describe, expect, it, vi } from "vitest";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/container", () => ({
  services: { disasters: { list } },
}));

import { GET } from "../../app/api/disasters/route";

describe("GET /api/disasters", () => {
  beforeEach(() => list.mockReset());

  it("returns the paginated disaster collection", async () => {
    const expected = { items: [], page: 1, limit: 20, total: 0 };
    list.mockResolvedValue(expected);
    const response = await GET(new Request("http://localhost/api/disasters"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expected);
  });

  it("rejects invalid pagination before calling the service", async () => {
    const response = await GET(
      new Request("http://localhost/api/disasters?page=0"),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(list).not.toHaveBeenCalled();
  });
});
