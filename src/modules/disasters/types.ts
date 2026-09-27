import type { ResolvedLocation } from "@/modules/location/resolver";

export type DisasterStatus = "active" | "contained" | "resolved";

export type DisasterRecord = {
  id: string;
  title: string;
  description: string;
  location: ResolvedLocation;
  tags: string[];
  status: DisasterStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateDisasterInput = {
  title: string;
  description: string;
  tags: string[];
  status?: DisasterStatus;
};

export type UpdateDisasterInput = Partial<
  Pick<CreateDisasterInput, "title" | "description" | "tags" | "status">
>;
export type DisasterFilters = {
  tag?: string;
  status?: DisasterStatus;
  page: number;
  limit: number;
};
export type DisasterPage = {
  items: DisasterRecord[];
  page: number;
  limit: number;
  total: number;
};

export type DisasterEventName = "disaster_created" | "disaster_updated";
export interface DisasterEventPublisher {
  publish(event: DisasterEventName, disaster: DisasterRecord): Promise<void>;
}
