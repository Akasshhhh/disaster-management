import { withErrors } from "@/http/errors";
import { parseId } from "@/http/validation";
import { services } from "@/container";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrors(
  async (_request: Request, context: RouteContext) => {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    await services.disasters.get(id);
    const reports = await services.reports.getForDisaster(id);
    return Response.json({ reports });
  },
);
