import { getDb } from "@/db/client";
import { sql } from "drizzle-orm";
import { redisCache } from "@/integrations/cache/redis-cache";
import { DeterministicLocationResolver } from "@/modules/location/resolver";
import { DisasterRepository } from "@/modules/disasters/repository";
import { DisasterService } from "@/modules/disasters/service";
import { disasterEventPublisher } from "@/realtime/publisher";
import { ResourceRepository } from "@/modules/resources/repository";
import { MockCommunityReportProvider } from "@/modules/reports/provider";
import { ReportsService } from "@/modules/reports/service";

const disasterRepository = new DisasterRepository();
const locationResolver = new DeterministicLocationResolver();
const disasterService = new DisasterService(
  disasterRepository,
  locationResolver,
  disasterEventPublisher,
);
const resourceRepository = new ResourceRepository();
const reportsService = new ReportsService(
  new MockCommunityReportProvider(),
  redisCache,
);

export const services = {
  disasters: disasterService,
  disasterRepository,
  resources: resourceRepository,
  reports: reportsService,
};

export async function checkDatabase(): Promise<void> {
  await getDb().execute(sql`SELECT 1`);
}
