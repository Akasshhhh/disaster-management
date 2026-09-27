import type { Server as SocketServer } from "socket.io";
import { z } from "zod";
import { createRedisClient } from "@/integrations/redis/client";
import type {
  DisasterEventName,
  DisasterEventPublisher,
  DisasterRecord,
} from "@/modules/disasters/types";

export const DISASTER_EVENT_CHANNEL = "disaster-events:v1";

type PublisherClient = {
  readonly isOpen: boolean;
  connect(): Promise<unknown>;
  publish(channel: string, message: string): Promise<unknown>;
  quit(): Promise<unknown>;
};

export function createDisasterEventPublisher(
  createClient: () => PublisherClient = createRedisClient,
): DisasterEventPublisher & { close(): Promise<void> } {
  let client: PublisherClient | undefined;
  let connecting: Promise<void> | undefined;

  async function getClient(): Promise<PublisherClient> {
    client ??= createClient();
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

  return {
    async publish(event: DisasterEventName, disaster: DisasterRecord) {
      await (
        await getClient()
      ).publish(DISASTER_EVENT_CHANNEL, JSON.stringify({ event, disaster }));
    },
    async close() {
      if (client?.isOpen) await client.quit();
      client = undefined;
      connecting = undefined;
    },
  };
}

const eventSchema = z.object({
  event: z.enum(["disaster_created", "disaster_updated"]),
  disaster: z.object({ id: z.string().uuid() }).passthrough(),
});

export async function startRealtimeSubscriber(
  socketServer: SocketServer,
): Promise<() => Promise<void>> {
  const subscriber = createRedisClient();
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const connectAndSubscribe = async (): Promise<void> => {
    try {
      if (!subscriber.isOpen) await subscriber.connect();
      await subscriber.subscribe(DISASTER_EVENT_CHANNEL, (rawMessage) => {
        try {
          const parsed = eventSchema.safeParse(JSON.parse(rawMessage));
          if (!parsed.success) {
            console.warn(
              "Ignoring malformed realtime event from Redis Pub/Sub.",
            );
            return;
          }
          socketServer.emit(parsed.data.event, parsed.data.disaster);
        } catch {
          console.warn("Ignoring malformed realtime event from Redis Pub/Sub.");
        }
      });
      console.info("Realtime Redis subscriber connected.");
    } catch (error) {
      console.warn(
        "Realtime Redis subscriber unavailable; HTTP state remains available.",
        { errorType: error instanceof Error ? error.name : "UnknownError" },
      );
      if (!closed) {
        retryTimer = setTimeout(() => void connectAndSubscribe(), 1500);
        retryTimer.unref();
      }
    }
  };

  await connectAndSubscribe();
  return async () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (subscriber.isOpen) {
      await subscriber.unsubscribe(DISASTER_EVENT_CHANNEL);
      await subscriber.quit();
    }
  };
}

export const disasterEventPublisher = createDisasterEventPublisher();
