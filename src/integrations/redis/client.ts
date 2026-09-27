import { createClient } from "redis";
import { getEnv } from "@/config/env";

export function createRedisClient() {
  return createClient({
    url: getEnv().REDIS_URL,
    socket: {
      connectTimeout: 750,
      reconnectStrategy(retries) {
        if (retries > 1) return false;
        return Math.min(100 * retries, 250);
      },
    },
  }).on("error", () => {
    // Keep dependency errors from becoming unhandled process-level events.
  });
}
