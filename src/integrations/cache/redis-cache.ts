import type { RedisClientType } from "redis";
import { createRedisClient } from "@/integrations/redis/client";
import type { Cache } from "./cache";

let client: RedisClientType | undefined;
let connecting: Promise<void> | undefined;

async function getClient(): Promise<RedisClientType> {
  client ??= createRedisClient();
  if (!client.isOpen) {
    connecting ??= client
      .connect()
      .then(() => undefined)
      .finally(() => {
        connecting = undefined;
      });
    await connecting;
  }
  return client;
}

export const redisCache: Cache = {
  async get(key) {
    return (await getClient()).get(key);
  },
  async set(key, value, ttlSeconds) {
    await (await getClient()).set(key, value, { EX: ttlSeconds });
  },
  async ping() {
    await (await getClient()).ping();
  },
};

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.quit();
  client = undefined;
  connecting = undefined;
}
