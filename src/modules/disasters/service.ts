import { AppError } from "@/http/errors";
import {
  requireCreatePermission,
  requireDeletePermission,
  requireUpdatePermission,
} from "@/modules/auth/policy";
import type { AuthUser } from "@/modules/auth/types";
import type { LocationResolver } from "@/modules/location/resolver";
import type {
  DisasterEventPublisher,
  DisasterFilters,
  DisasterRecord,
  CreateDisasterInput,
  UpdateDisasterInput,
} from "./types";
import { DisasterRepository } from "./repository";

export class DisasterService {
  constructor(
    private readonly repository: Pick<
      DisasterRepository,
      "findById" | "list" | "create" | "update" | "delete"
    >,
    private readonly resolver: LocationResolver,
    private readonly events: DisasterEventPublisher,
  ) {}

  list(filters: DisasterFilters) {
    return this.repository.list(filters);
  }

  async get(id: string): Promise<DisasterRecord> {
    const disaster = await this.repository.findById(id);
    if (!disaster)
      throw new AppError(404, "DISASTER_NOT_FOUND", "Disaster was not found.");
    return disaster;
  }

  async create(
    input: CreateDisasterInput,
    actor: AuthUser,
  ): Promise<DisasterRecord> {
    requireCreatePermission(actor);
    const location = await this.resolver.resolve(input.description);
    if (!location)
      throw new AppError(
        422,
        "LOCATION_UNRESOLVED",
        "No supported location could be resolved from the description.",
      );
    const disaster = await this.repository.create(input, actor.id, location);
    await this.publishSafely("disaster_created", disaster);
    return disaster;
  }

  async update(
    id: string,
    input: UpdateDisasterInput,
    actor: AuthUser,
  ): Promise<DisasterRecord> {
    const current = await this.get(id);
    requireUpdatePermission(actor, current.createdBy);
    let location;
    if (input.description) {
      location = await this.resolver.resolve(input.description);
      if (!location) {
        throw new AppError(
          422,
          "LOCATION_UNRESOLVED",
          "No supported location could be resolved from the updated description.",
        );
      }
    }
    const disaster = await this.repository.update(id, input, location);
    if (!disaster)
      throw new AppError(404, "DISASTER_NOT_FOUND", "Disaster was not found.");
    await this.publishSafely("disaster_updated", disaster);
    return disaster;
  }

  async delete(id: string, actor: AuthUser): Promise<void> {
    requireDeletePermission(actor);
    const deleted = await this.repository.delete(id);
    if (!deleted)
      throw new AppError(404, "DISASTER_NOT_FOUND", "Disaster was not found.");
  }

  private async publishSafely(
    event: "disaster_created" | "disaster_updated",
    disaster: DisasterRecord,
  ) {
    try {
      await this.events.publish(event, disaster);
    } catch (error) {
      console.error("Realtime event publish failed", {
        event,
        disasterId: disaster.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
