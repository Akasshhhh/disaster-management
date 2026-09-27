import { describe, expect, it } from "vitest";
import {
  requireDeletePermission,
  requireUpdatePermission,
} from "@/modules/auth/policy";
import { DeterministicLocationResolver } from "@/modules/location/resolver";

describe("location resolver and authorization policy", () => {
  it("resolves the assignment's Manhattan example and rejects unknown places", async () => {
    const resolver = new DeterministicLocationResolver();
    await expect(
      resolver.resolve("Heavily flooded streets around Manhattan, NYC"),
    ).resolves.toMatchObject({
      name: "Manhattan, New York City",
      latitude: 40.7831,
    });
    await expect(
      resolver.resolve("A landslide at an unknown location"),
    ).resolves.toBeNull();
  });

  it("allows admin deletion but denies contributor deletion", () => {
    expect(() =>
      requireDeletePermission({
        id: "admin",
        email: "admin@example.com",
        role: "ADMIN",
      }),
    ).not.toThrow();
    expect(() =>
      requireDeletePermission({
        id: "user",
        email: "user@example.com",
        role: "CONTRIBUTOR",
      }),
    ).toThrowError("Only administrators can delete disasters.");
  });

  it("allows contributors to update only their own disasters", () => {
    expect(() =>
      requireUpdatePermission(
        { id: "user", email: "user@example.com", role: "CONTRIBUTOR" },
        "user",
      ),
    ).not.toThrow();
    expect(() =>
      requireUpdatePermission(
        { id: "user", email: "user@example.com", role: "CONTRIBUTOR" },
        "other",
      ),
    ).toThrowError("You may only update disasters you created.");
  });
});
