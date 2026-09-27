import { withErrors } from "@/http/errors";
import { parseId, parseQuery } from "@/http/validation";
import { nearbyQuerySchema } from "@/http/schemas";
import { services } from "@/container";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrors(
  async (request: Request, context: RouteContext) => {
    const { id } = await context.params;
    await services.disasters.get(parseId(id));
    const query = parseQuery(
      new URL(request.url).searchParams,
      nearbyQuerySchema,
    );
    const resources = await services.resources.nearby({
      latitude: query.lat,
      longitude: query.lng,
      radiusKm: query.radius,
      type: query.type,
    });
    return Response.json({ resources, count: resources.length });
  },
);
