import { withErrors } from "@/http/errors";
import { parseQuery, readJson } from "@/http/validation";
import { createDisasterSchema, disasterListSchema } from "@/http/schemas";
import { getRequestUser } from "@/modules/auth/request-user";
import { requireUser } from "@/modules/auth/policy";
import { services } from "@/container";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request) => {
  const query = parseQuery(
    new URL(request.url).searchParams,
    disasterListSchema,
  );
  const result = await services.disasters.list(query);
  return Response.json(result);
});

export const POST = withErrors(async (request: Request) => {
  const user = requireUser(await getRequestUser(request));
  const input = await readJson(request, createDisasterSchema);
  const disaster = await services.disasters.create(input, user);
  return Response.json(disaster, { status: 201 });
});
