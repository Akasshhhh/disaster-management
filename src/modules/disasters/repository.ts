import { and, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { disasters } from "@/db/schema";
import { textArray } from "@/db/sql-values";
import type { ResolvedLocation } from "@/modules/location/resolver";
import type {
  CreateDisasterInput,
  DisasterFilters,
  DisasterPage,
  DisasterRecord,
  DisasterStatus,
  UpdateDisasterInput,
} from "./types";

type DisasterRow = {
  id: string;
  title: string;
  description: string;
  location_name: string;
  latitude: number | string;
  longitude: number | string;
  tags: string[];
  status: DisasterStatus;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function resultRows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

function mapDisaster(row: DisasterRow): DisasterRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: {
      name: row.location_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    },
    tags: row.tags,
    status: row.status,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const returningDisaster = sql`
  id, title, description, location_name,
  ST_Y(location::geometry) AS latitude,
  ST_X(location::geometry) AS longitude,
  tags, status, created_by, created_at, updated_at
`;

export class DisasterRepository {
  async findById(id: string): Promise<DisasterRecord | null> {
    const result = await getDb().execute(sql`
      SELECT ${returningDisaster} FROM disasters WHERE id = ${id}::uuid LIMIT 1
    `);
    const row = resultRows<DisasterRow>(result)[0];
    return row ? mapDisaster(row) : null;
  }

  async list(filters: DisasterFilters): Promise<DisasterPage> {
    const conditions: SQL[] = [];
    if (filters.tag)
      conditions.push(sql`tags @> ARRAY[${filters.tag}]::text[]`);
    if (filters.status) conditions.push(eq(disasters.status, filters.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const db = getDb();
    const [itemsResult, countResult] = await Promise.all([
      db.execute(sql`
        SELECT ${returningDisaster} FROM disasters
        ${where ? sql`WHERE ${where}` : sql``}
        ORDER BY created_at DESC, id
        LIMIT ${filters.limit} OFFSET ${(filters.page - 1) * filters.limit}
      `),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(disasters)
        .where(where),
    ]);
    return {
      items: resultRows<DisasterRow>(itemsResult).map(mapDisaster),
      page: filters.page,
      limit: filters.limit,
      total: countResult[0]?.count ?? 0,
    };
  }

  async create(
    input: CreateDisasterInput,
    actorId: string,
    location: ResolvedLocation,
  ): Promise<DisasterRecord> {
    const result = await getDb().transaction(async (tx) =>
      tx.execute(sql`
        INSERT INTO disasters (title, description, location_name, location, tags, status, created_by)
        VALUES (
          ${input.title}, ${input.description}, ${location.name},
          ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography,
          ${textArray(input.tags)}, ${input.status ?? "active"}::disaster_status, ${actorId}::uuid
        ) RETURNING ${returningDisaster}
      `),
    );
    return mapDisaster(resultRows<DisasterRow>(result)[0]);
  }

  async update(
    id: string,
    input: UpdateDisasterInput,
    resolved?: ResolvedLocation,
  ): Promise<DisasterRecord | null> {
    const assignments: SQL[] = [sql`updated_at = now()`];
    if (input.title !== undefined)
      assignments.push(sql`title = ${input.title}`);
    if (input.description !== undefined)
      assignments.push(sql`description = ${input.description}`);
    if (input.tags !== undefined)
      assignments.push(sql`tags = ${textArray(input.tags)}`);
    if (input.status !== undefined)
      assignments.push(sql`status = ${input.status}::disaster_status`);
    if (resolved) {
      assignments.push(sql`location_name = ${resolved.name}`);
      assignments.push(
        sql`location = ST_SetSRID(ST_MakePoint(${resolved.longitude}, ${resolved.latitude}), 4326)::geography`,
      );
    }
    const result = await getDb().transaction((tx) =>
      tx.execute(sql`
        UPDATE disasters SET ${sql.join(assignments, sql`, `)}
        WHERE id = ${id}::uuid RETURNING ${returningDisaster}
      `),
    );
    const row = resultRows<DisasterRow>(result)[0];
    return row ? mapDisaster(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await getDb().execute(
      sql`DELETE FROM disasters WHERE id = ${id}::uuid RETURNING id`,
    );
    return resultRows<{ id: string }>(result).length > 0;
  }
}
