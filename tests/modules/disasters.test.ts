import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/http/errors";
import { DisasterService } from "@/modules/disasters/service";
import type { DisasterRecord } from "@/modules/disasters/types";
import { DeterministicLocationResolver } from "@/modules/location/resolver";

const sampleDisaster: DisasterRecord = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "Flood response",
  description: "Flooding reported around Manhattan, NYC streets.",
  location: {
    name: "Manhattan, New York City",
    latitude: 40.7831,
    longitude: -73.9712,
  },
  tags: ["flood"],
  status: "active",
  created_by: "30000000-0000-4000-8000-000000000001",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("DisasterService", () => {
  it("does not persist a disaster when the location cannot be resolved", async () => {
    const repository = {
      findById: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const events = { publish: vi.fn() };
    const service = new DisasterService(
      repository,
      new DeterministicLocationResolver(),
      events,
    );
    await expect(
      service.create(
        {
          title: "Unknown event",
          description: "A severe incident in an unknown place",
          tags: [],
        },
        {
          id: sampleDisaster.created_by,
          email: "volunteer@example.com",
          role: "CONTRIBUTOR",
        },
      ),
    ).rejects.toMatchObject({ code: "LOCATION_UNRESOLVED", status: 422 });
    expect(repository.create).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("enforces contributor ownership before update", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(sampleDisaster),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const service = new DisasterService(
      repository,
      new DeterministicLocationResolver(),
      { publish: vi.fn() },
    );
    await expect(
      service.update(
        sampleDisaster.id,
        { title: "Changed" },
        {
          id: "30000000-0000-4000-8000-000000000002",
          email: "other@example.com",
          role: "CONTRIBUTOR",
        },
      ),
    ).rejects.toBeInstanceOf(AppError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("keeps a persisted creation successful if realtime publishing fails", async () => {
    const repository = {
      findById: vi.fn(),
      list: vi.fn(),
      create: vi.fn().mockResolvedValue(sampleDisaster),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const events = {
      publish: vi.fn().mockRejectedValue(new Error("socket unavailable")),
    };
    const service = new DisasterService(
      repository,
      new DeterministicLocationResolver(),
      events,
    );
    const result = await service.create(
      {
        title: "Flood response",
        description: sampleDisaster.description,
        tags: ["flood"],
      },
      {
        id: sampleDisaster.created_by,
        email: "volunteer@example.com",
        role: "CONTRIBUTOR",
      },
    );
    expect(result).toEqual(sampleDisaster);
    expect(repository.create).toHaveBeenCalledOnce();
    expect(events.publish).toHaveBeenCalledWith(
      "disaster_created",
      sampleDisaster,
    );
  });
});
