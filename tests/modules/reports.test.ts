import { describe, expect, it, vi } from "vitest";
import type { Cache } from "@/integrations/cache/cache";
import {
  MockCommunityReportProvider,
  normalizeReports,
  type CommunityReportProvider,
} from "@/modules/reports/provider";
import { ReportsService } from "@/modules/reports/service";

class MemoryCache implements Cache {
  readonly values = new Map<string, string>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.values.set(key, value);
  }
  async ping() {}
}

describe("community reports", () => {
  it("normalizes provider-specific data to the public shape", () => {
    expect(
      normalizeReports([
        {
          message: "Road blocked",
          account: { display_name: "Local volunteer" },
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
    ).toEqual([
      {
        content: "Road blocked",
        user: "Local volunteer",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("serves a cache hit without calling the external provider again", async () => {
    const cache = new MemoryCache();
    const provider = new MockCommunityReportProvider();
    const fetch = vi.spyOn(provider, "fetchReports");
    const service = new ReportsService(provider, cache, 500);
    const first = await service.getForDisaster(
      "10000000-0000-4000-8000-000000000001",
    );
    const second = await service.getForDisaster(
      "10000000-0000-4000-8000-000000000001",
    );
    expect(first).toEqual(second);
    expect(fetch).toHaveBeenCalledOnce();
    expect(cache.values.keys().next().value).toBe(
      "community-reports:v1:10000000-0000-4000-8000-000000000001",
    );
  });

  it("bypasses a failed cache and returns provider data", async () => {
    const cache: Cache = {
      get: vi.fn().mockRejectedValue(new Error("redis offline")),
      set: vi.fn().mockRejectedValue(new Error("redis offline")),
      ping: vi.fn(),
    };
    const provider: CommunityReportProvider = {
      fetchReports: vi.fn().mockResolvedValue([
        {
          message: "Safe route open",
          account: { display_name: "Resident" },
          created_at: "2026-01-01T00:00:00Z",
        },
      ]),
    };
    const result = await new ReportsService(
      provider,
      cache,
      500,
    ).getForDisaster("10000000-0000-4000-8000-000000000001");
    expect(result[0]?.content).toBe("Safe route open");
    expect(provider.fetchReports).toHaveBeenCalledOnce();
  });

  it("enforces timeout even when a provider ignores AbortSignal", async () => {
    const provider: CommunityReportProvider = {
      fetchReports: () => new Promise(() => {}),
    };
    await expect(
      new ReportsService(provider, new MemoryCache(), 10).getForDisaster(
        "10000000-0000-4000-8000-000000000001",
      ),
    ).rejects.toMatchObject({ code: "REPORT_PROVIDER_TIMEOUT", status: 502 });
  });
});
