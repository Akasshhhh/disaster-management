import { describe, expect, it } from "vitest";
import { nearbyQuerySchema } from "@/http/schemas";

describe("nearby resource query validation", () => {
  it("rejects empty coordinates instead of treating them as zero", () => {
    for (const key of ["lat", "lng"] as const) {
      const query = { lat: "40.7831", lng: "-73.9712", radius: "10" };
      query[key] = " ";
      expect(nearbyQuerySchema.safeParse(query).success).toBe(false);
    }
  });

  it("accepts real zero coordinates", () => {
    expect(
      nearbyQuerySchema.safeParse({ lat: "0", lng: "0", radius: "10" }).success,
    ).toBe(true);
  });
});
