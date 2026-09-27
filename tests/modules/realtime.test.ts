import { describe, expect, it, vi } from "vitest";
import {
  createDisasterEventPublisher,
  DISASTER_EVENT_CHANNEL,
} from "@/realtime/publisher";
import type { DisasterRecord } from "@/modules/disasters/types";

describe("Redis disaster event publisher", () => {
  it("publishes event data only through the injected Redis adapter", async () => {
    let open = false;
    const client = {
      get isOpen() {
        return open;
      },
      connect: vi.fn(async () => {
        open = true;
      }),
      publish: vi.fn(async () => 1),
      quit: vi.fn(async () => "OK"),
    };
    const publisher = createDisasterEventPublisher(() => client);
    const disaster: DisasterRecord = {
      id: "10000000-0000-4000-8000-000000000001",
      title: "Flood response",
      description: "Flooding around Manhattan, NYC.",
      location: {
        name: "Manhattan, New York City",
        latitude: 40.7831,
        longitude: -73.9712,
      },
      tags: ["flood"],
      status: "active",
      created_by: "30000000-0000-4000-8000-000000000001",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    await publisher.publish("disaster_created", disaster);

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.publish).toHaveBeenCalledWith(
      DISASTER_EVENT_CHANNEL,
      JSON.stringify({ event: "disaster_created", disaster }),
    );
    await publisher.close();
    expect(client.quit).toHaveBeenCalledOnce();
  });
});
