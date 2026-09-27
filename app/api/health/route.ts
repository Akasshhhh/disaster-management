import { withErrors } from "@/http/errors";
import { checkDatabase } from "@/container";
import { redisCache } from "@/integrations/cache/redis-cache";

export const runtime = "nodejs";

export const GET = withErrors(async () => {
  const [database, redis] = await Promise.allSettled([
    checkDatabase(),
    redisCache.ping(),
  ]);
  const dbStatus = database.status === "fulfilled" ? "ok" : "unavailable";
  const redisStatus = redis.status === "fulfilled" ? "ok" : "degraded";
  if (database.status === "rejected")
    console.error("Health check: database unavailable");
  if (redis.status === "rejected")
    console.warn("Health check: Redis unavailable; cache will be bypassed");
  const status = dbStatus === "ok" ? 200 : 503;
  return Response.json(
    {
      status: redisStatus === "ok" && dbStatus === "ok" ? "ok" : "degraded",
      dependencies: { database: dbStatus, redis: redisStatus },
    },
    { status },
  );
});
