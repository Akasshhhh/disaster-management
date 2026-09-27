import { withErrors } from "@/http/errors";
import { readJson, parseId } from "@/http/validation";
import { updateDisasterSchema } from "@/http/schemas";
import { getRequestUser } from "@/modules/auth/request-user";
import { requireUser } from "@/modules/auth/policy";
import { services } from "@/container";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrors(
  async (_request: Request, context: RouteContext) => {
    const { id } = await context.params;
    return Response.json(await services.disasters.get(parseId(id)));
  },
);

export const PATCH = withErrors(
  async (request: Request, context: RouteContext) => {
    const user = requireUser(await getRequestUser(request));
    const { id } = await context.params;
    const input = await readJson(request, updateDisasterSchema);
    return Response.json(
      await services.disasters.update(parseId(id), input, user),
    );
  },
);

export const DELETE = withErrors(
  async (request: Request, context: RouteContext) => {
    const user = requireUser(await getRequestUser(request));
    const { id } = await context.params;
    await services.disasters.delete(parseId(id), user);
    return new Response(null, { status: 204 });
  },
);
