import "dotenv/config";
import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "../src/db/client";
import { textArray } from "../src/db/sql-values";
import { users } from "../src/db/schema";

const demoUsers = [
  { email: "admin@example.com", password: "Admin123!", role: "ADMIN" as const },
  {
    email: "volunteer@example.com",
    password: "Volunteer123!",
    role: "CONTRIBUTOR" as const,
  },
];

const demoDisasters = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Manhattan flash flooding",
    description:
      "Flooded streets reported around Manhattan, NYC after intense rainfall.",
    location: "Manhattan, New York City",
    lat: 40.7831,
    lng: -73.9712,
    tags: ["flood", "storm"],
    status: "active",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    title: "San Francisco hillside fire",
    description:
      "Smoke and fire response needed near San Francisco neighborhoods.",
    location: "San Francisco, California",
    lat: 37.7749,
    lng: -122.4194,
    tags: ["fire"],
    status: "active",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    title: "Houston storm response",
    description: "Storm damage response and supplies needed in Houston, Texas.",
    location: "Houston, Texas",
    lat: 29.7604,
    lng: -95.3698,
    tags: ["storm", "rescue"],
    status: "contained",
  },
];

const demoResources = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Lower Manhattan Community Shelter",
    type: "shelter",
    lat: 40.7132,
    lng: -74.0061,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Bellevue Hospital",
    type: "hospital",
    lat: 40.7392,
    lng: -73.9764,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    name: "Downtown Food Distribution",
    type: "food",
    lat: 40.7215,
    lng: -73.9952,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    name: "Water Supply Point A",
    type: "water",
    lat: 40.7527,
    lng: -73.9772,
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    name: "Manhattan Rescue Unit",
    type: "rescue",
    lat: 40.7681,
    lng: -73.9819,
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    name: "Brooklyn Relief Shelter",
    type: "shelter",
    lat: 40.6782,
    lng: -73.9442,
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    name: "SF General Hospital",
    type: "hospital",
    lat: 37.7557,
    lng: -122.4053,
  },
  {
    id: "20000000-0000-4000-8000-000000000008",
    name: "Civic Center Meal Point",
    type: "food",
    lat: 37.7793,
    lng: -122.4193,
  },
  {
    id: "20000000-0000-4000-8000-000000000009",
    name: "Houston Water Depot",
    type: "water",
    lat: 29.751,
    lng: -95.362,
  },
  {
    id: "20000000-0000-4000-8000-000000000010",
    name: "Houston Rescue Station",
    type: "rescue",
    lat: 29.773,
    lng: -95.386,
  },
];

try {
  const db = getDb();
  const seeded = new Map<string, string>();
  for (const user of demoUsers) {
    const passwordHash = await hash(user.password, 12);
    const [stored] = await db
      .insert(users)
      .values({ email: user.email, passwordHash, role: user.role })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash, role: user.role, updatedAt: new Date() },
      })
      .returning({ id: users.id });
    seeded.set(user.role, stored.id);
  }

  const adminId = seeded.get("ADMIN");
  if (!adminId) throw new Error("Seed administrator was not created");

  await db.transaction(async (tx) => {
    for (const disaster of demoDisasters) {
      await tx.execute(sql`
        INSERT INTO disasters (id, title, description, location_name, location, tags, status, created_by)
        VALUES (
          ${disaster.id}::uuid, ${disaster.title}, ${disaster.description}, ${disaster.location},
          ST_SetSRID(ST_MakePoint(${disaster.lng}, ${disaster.lat}), 4326)::geography,
          ${textArray(disaster.tags)}, ${disaster.status}::disaster_status, ${adminId}::uuid
        ) ON CONFLICT (id) DO NOTHING
      `);
    }
    for (const resource of demoResources) {
      await tx.execute(sql`
        INSERT INTO resources (id, name, type, location)
        VALUES (
          ${resource.id}::uuid, ${resource.name}, ${resource.type}::resource_type,
          ST_SetSRID(ST_MakePoint(${resource.lng}, ${resource.lat}), 4326)::geography
        ) ON CONFLICT (id) DO NOTHING
      `);
    }
  });
  console.info("Seed data is ready.");
} catch (error) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  const message =
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database-url]")
      : "Unknown error";
  console.error("Database seeding failed.", {
    errorType: error instanceof Error ? error.name : "UnknownError",
    code,
    message,
  });
  process.exitCode = 1;
} finally {
  await closeDb();
}
