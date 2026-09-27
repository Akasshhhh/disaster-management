import { afterAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { ResourceRepository } from "@/modules/resources/repository";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("PostGIS nearby resource query", () => {
  afterAll(async () => closeDb());

  it("filters through ST_DWithin and sorts by distance", async () => {
    const resources = await new ResourceRepository().nearby({
      latitude: 40.7831,
      longitude: -73.9712,
      radiusKm: 10,
    });
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.every((resource) => resource.distanceKm <= 10)).toBe(true);
    expect(resources.map((resource) => resource.distanceKm)).toEqual(
      [...resources]
        .map((resource) => resource.distanceKm)
        .sort((left, right) => left - right),
    );
  });
});
