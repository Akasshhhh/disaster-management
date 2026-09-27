import {
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
});

export const userRole = pgEnum("user_role", ["ADMIN", "CONTRIBUTOR"]);
export const disasterStatus = pgEnum("disaster_status", [
  "active",
  "contained",
  "resolved",
]);
export const resourceType = pgEnum("resource_type", [
  "shelter",
  "hospital",
  "food",
  "water",
  "rescue",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const disasters = pgTable(
  "disasters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    locationName: varchar("location_name", { length: 180 }).notNull(),
    location: geographyPoint("location").notNull(),
    tags: text("tags").array().notNull().default([]),
    status: disasterStatus("status").notNull().default("active"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("disasters_status_idx").on(table.status),
    index("disasters_created_by_idx").on(table.createdBy),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    type: resourceType("type").notNull(),
    location: geographyPoint("location").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("resources_type_idx").on(table.type)],
);

export type User = typeof users.$inferSelect;
export type Disaster = typeof disasters.$inferSelect;
export type Resource = typeof resources.$inferSelect;
