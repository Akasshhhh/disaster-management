import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { ResolvedLocation } from "@/modules/location/resolver";
import type { ResourceType } from "@/modules/resources/types";

export type NearbyResource = {
  id: string;
  name: string;
  type: ResourceType;
  location: ResolvedLocation;
  distanceKm: number;
};

type ResourceRow = {
  id: string;
  name: string;
  type: ResourceType;
  latitude: number | string;
  longitude: number | string;
  distance_meters: number | string;
};

export class ResourceRepository {
  async nearby(input: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    type?: ResourceType;
  }): Promise<NearbyResource[]> {
    const result = await getDb().execute(sql`
      SELECT r.id, r.name, r.type,
        ST_Y(r.location::geometry) AS latitude,
        ST_X(r.location::geometry) AS longitude,
        ST_Distance(
          r.location,
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
        ) AS distance_meters
      FROM resources r
      WHERE ST_DWithin(
        r.location,
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
        ${input.radiusKm * 1000}
      )
      ${input.type ? sql`AND r.type = ${input.type}::resource_type` : sql``}
      ORDER BY distance_meters ASC, r.id ASC
    `);
    return (result as unknown as { rows: ResourceRow[] }).rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      location: {
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      },
      distanceKm: Number(row.distance_meters) / 1000,
    }));
  }
}
