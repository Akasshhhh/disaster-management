import { getEnv } from "@/config/env";
import { AppError } from "@/http/errors";
import type { Cache } from "@/integrations/cache/cache";
import type { CommunityReport, CommunityReportProvider } from "./provider";
import { normalizeReports } from "./provider";

const CACHE_TTL_SECONDS = 60;
const cacheKey = (id: string) => `community-reports:v1:${id}`;

export class ReportsService {
  constructor(
    private readonly provider: CommunityReportProvider,
    private readonly cache: Cache,
    private readonly timeoutOverride?: number,
  ) {}

  async getForDisaster(disasterId: string): Promise<CommunityReport[]> {
    const key = cacheKey(disasterId);
    let cached: string | null = null;
    try {
      cached = await this.cache.get(key);
    } catch (error) {
      console.warn("Reports cache read failed; bypassing cache", {
        errorType: errorType(error),
      });
    }

    if (cached !== null) {
      try {
        const parsed: unknown = JSON.parse(cached);
        if (isReportArray(parsed)) return parsed;
      } catch {
        console.warn(
          "Reports cache entry was invalid; fetching provider response",
          { disasterId },
        );
      }
    }

    let reports: CommunityReport[];
    const abortController = new AbortController();
    const timeoutMs =
      this.timeoutOverride ?? getEnv().REPORT_PROVIDER_TIMEOUT_MS;
    const timeoutError = new Error("Provider timeout");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abortController.abort(timeoutError);
        reject(timeoutError);
      }, timeoutMs);
    });
    try {
      const external = await Promise.race([
        this.provider.fetchReports(disasterId, abortController.signal),
        timedOut,
      ]);
      reports = normalizeReports(external);
    } catch (error) {
      if (abortController.signal.aborted || error === timeoutError) {
        throw new AppError(
          502,
          "REPORT_PROVIDER_TIMEOUT",
          "Community reports are temporarily unavailable.",
        );
      }
      console.error("Community report provider failed", {
        disasterId,
        errorType: errorType(error),
      });
      throw new AppError(
        502,
        "REPORT_PROVIDER_UNAVAILABLE",
        "Community reports are temporarily unavailable.",
      );
    } finally {
      if (timer) clearTimeout(timer);
    }

    try {
      await this.cache.set(key, JSON.stringify(reports), CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn("Reports cache write failed; returning provider response", {
        errorType: errorType(error),
      });
    }
    return reports;
  }
}

function isReportArray(value: unknown): value is CommunityReport[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CommunityReport).content === "string" &&
        typeof (item as CommunityReport).user === "string" &&
        typeof (item as CommunityReport).created_at === "string",
    )
  );
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
