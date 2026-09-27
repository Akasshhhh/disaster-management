import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { getEnv } from "./src/config/env";
import {
  disasterEventPublisher,
  startRealtimeSubscriber,
} from "./src/realtime/publisher";

const env = getEnv();
const dev = env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port: env.PORT });
const handle = app.getRequestHandler();

await app.prepare();
const httpServer = createServer((request, response) =>
  handle(request, response),
);
const socketServer = new SocketServer(httpServer, { path: "/socket.io" });
const stopRealtimeSubscriber = await startRealtimeSubscriber(socketServer);

socketServer.on("connection", (socket) => {
  console.info("Realtime client connected", { socketId: socket.id });
});

httpServer.listen(env.PORT, "0.0.0.0", () => {
  console.info(`Disaster response app listening on port ${env.PORT}`);
});

async function shutdown() {
  socketServer.close();
  httpServer.close();
  await stopRealtimeSubscriber();
  await disasterEventPublisher.close();
  const { closeDb } = await import("./src/db/client");
  const { closeRedis } = await import("./src/integrations/cache/redis-cache");
  await Promise.allSettled([closeDb(), closeRedis()]);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
