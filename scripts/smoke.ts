import "dotenv/config";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { createClient } from "redis";

const baseUrl =
  process.env.SMOKE_BASE_URL ??
  `http://localhost:${process.env.PORT ?? "3000"}`;
const sampleDisasterId = "10000000-0000-4000-8000-000000000001";

type AuthResult = { token: string; user: { id: string; role: string } };
type Disaster = {
  id: string;
  title: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  location: { name: string; latitude: number; longitude: number };
};

async function request<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: T }> {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body =
    response.status === 204 ? undefined : ((await response.json()) as T);
  return { response, body: body as T };
}

async function login(email: string, password: string): Promise<AuthResult> {
  const { response, body } = await request<AuthResult>(
    "/api/auth/login",
    undefined,
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
  assert.equal(response.status, 200, `login for ${email} should succeed`);
  return body;
}

function waitForEvent<T>(socket: Socket, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${name}`)),
      5000,
    );
    socket.once(name, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
let socket: Socket | undefined;
let adminToken: string | undefined;
let createdId: string | undefined;

try {
  const health = await request<{
    status: string;
    dependencies: { database: string; redis: string };
  }>("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.dependencies.database, "ok");
  assert.equal(health.body.dependencies.redis, "ok");

  const admin = await login("admin@example.com", "Admin123!");
  adminToken = admin.token;
  const contributor = await login("volunteer@example.com", "Volunteer123!");
  assert.equal(admin.user.role, "ADMIN");
  assert.equal(contributor.user.role, "CONTRIBUTOR");

  const collection = await request<{
    items: Disaster[];
    total: number;
    page: number;
    limit: number;
  }>("/disasters?tag=flood");
  assert.equal(collection.response.status, 200);
  assert.ok(collection.body.total > 0);

  const page = await request<{
    items: Disaster[];
    total: number;
    page: number;
    limit: number;
  }>("/disasters?status=active&page=1&limit=1");
  assert.equal(page.response.status, 200);
  assert.equal(page.body.page, 1);
  assert.equal(page.body.limit, 1);
  assert.equal(page.body.items.length, 1);
  assert.ok(page.body.items.every((item) => item.status === "active"));

  const missingId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const missing = await request<{ error: { code: string } }>(
    `/disasters/${missingId}`,
  );
  assert.equal(missing.response.status, 404);
  assert.equal(missing.body.error.code, "DISASTER_NOT_FOUND");

  socket = io(baseUrl, { path: "/socket.io", transports: ["websocket"] });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Socket.IO connection timed out")),
      5000,
    );
    socket?.once("connect", () => resolve());
    socket?.once("connect_error", reject);
    socket?.once("connect", () => clearTimeout(timer));
  });

  const createdEvent = waitForEvent<Disaster>(socket, "disaster_created");
  const create = await request<Disaster>("/disasters", contributor.token, {
    method: "POST",
    body: JSON.stringify({
      title: "Live smoke test response",
      description: "Flooding around Manhattan, NYC following heavy rainfall.",
      tags: ["smoke", "flood"],
    }),
  });
  assert.equal(create.response.status, 201);
  createdId = create.body.id;
  assert.equal(create.body.created_by, contributor.user.id);
  assert.ok(create.body.created_at);
  assert.ok(create.body.updated_at);
  assert.equal(create.body.location.name, "Manhattan, New York City");
  assert.equal((await createdEvent).id, createdId);

  const detail = await request<Disaster>(`/disasters/${createdId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.id, createdId);

  const deniedUpdate = await request<{ error: { code: string } }>(
    `/disasters/${sampleDisasterId}`,
    contributor.token,
    {
      method: "PATCH",
      body: JSON.stringify({ title: "Unauthorized update" }),
    },
  );
  assert.equal(deniedUpdate.response.status, 403);

  const unresolved = await request<{ error: { code: string } }>(
    "/disasters",
    contributor.token,
    {
      method: "POST",
      body: JSON.stringify({
        title: "Unknown location",
        description: "An emergency somewhere unlisted",
        tags: [],
      }),
    },
  );
  assert.equal(unresolved.response.status, 422);
  assert.equal(unresolved.body.error.code, "LOCATION_UNRESOLVED");

  const updatedEvent = waitForEvent<Disaster>(socket, "disaster_updated");
  const contributorUpdate = await request<Disaster>(
    `/disasters/${createdId}`,
    contributor.token,
    {
      method: "PATCH",
      body: JSON.stringify({ title: "Live smoke test updated" }),
    },
  );
  assert.equal(contributorUpdate.response.status, 200);
  assert.equal((await updatedEvent).id, createdId);

  const deniedDelete = await request<{ error: { code: string } }>(
    `/disasters/${createdId}`,
    contributor.token,
    { method: "DELETE" },
  );
  assert.equal(deniedDelete.response.status, 403);
  const adminUpdate = await request<Disaster>(
    `/disasters/${createdId}`,
    adminToken,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "contained" }),
    },
  );
  assert.equal(adminUpdate.response.status, 200);

  const nearby = await request<{
    resources: Array<{ distanceKm: number }>;
    count: number;
  }>(
    `/disasters/${sampleDisasterId}/resources?lat=40.7831&lng=-73.9712&radius=10`,
  );
  assert.equal(nearby.response.status, 200);
  assert.ok(nearby.body.count > 0);
  assert.ok(
    nearby.body.resources.every(
      (resource, index, all) =>
        resource.distanceKm <= 10 &&
        (index === 0 || all[index - 1]!.distanceKm <= resource.distanceKm),
    ),
  );

  for (const query of [
    "lat=&lng=-73.9712&radius=10",
    "lat=40.7831&lng=&radius=10",
    "lat=91&lng=-73.9712&radius=10",
    "lat=40.7831&lng=-181&radius=10",
    "lat=40.7831&lng=-73.9712&radius=0",
    "lat=40.7831&lng=-73.9712&radius=101",
  ]) {
    const invalidNearby = await request(
      `/disasters/${sampleDisasterId}/resources?${query}`,
    );
    assert.equal(invalidNearby.response.status, 400, query);
  }

  const firstReports = await request<{
    reports: Array<{ content: string; user: string; created_at: string }>;
  }>(`/disasters/${createdId}/reports`);
  await redis.connect();
  const cacheKey = `community-reports:v1:${createdId}`;
  assert.ok((await redis.ttl(cacheKey)) > 0);
  const cachedReports = [
    {
      content: "Smoke cache marker",
      user: "smoke-test",
      created_at: new Date().toISOString(),
    },
  ];
  await redis.set(cacheKey, JSON.stringify(cachedReports), { EX: 60 });
  const secondReports = await request<{
    reports: Array<{ content: string; user: string; created_at: string }>;
  }>(`/disasters/${createdId}/reports`);
  assert.equal(firstReports.response.status, 200);
  assert.equal(secondReports.response.status, 200);
  assert.deepEqual(secondReports.body.reports, cachedReports);
  assert.ok(firstReports.body.reports[0]?.content);
  assert.ok(firstReports.body.reports[0]?.user);
  assert.ok(firstReports.body.reports[0]?.created_at);

  console.info(
    "Smoke checks passed: auth, detail/filter/pagination, location, CRUD permissions, PostGIS bounds, reports/cache, realtime.",
  );
} catch (error) {
  console.error(
    "Smoke checks failed.",
    error instanceof Error ? { name: error.name, message: error.message } : {},
  );
  process.exitCode = 1;
} finally {
  if (socket) socket.disconnect();
  if (adminToken && createdId) {
    try {
      const cleanup = await request(`/disasters/${createdId}`, adminToken, {
        method: "DELETE",
      });
      assert.equal(cleanup.response.status, 204);
    } catch (error) {
      console.error("Smoke cleanup failed", error);
      process.exitCode = 1;
    }
  }
  if (redis.isOpen) await redis.quit();
}
