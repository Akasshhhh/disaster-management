import { z, type ZodType } from "zod";
import { AppError } from "./errors";

export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new AppError(
      400,
      "MALFORMED_JSON",
      "Request body must contain valid JSON.",
    );
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }
  return parsed.data;
}

export function parseQuery<T>(params: URLSearchParams, schema: ZodType<T>): T {
  const input = Object.fromEntries(params.entries());
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Query validation failed.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }
  return parsed.data;
}

export function parseId(id: string): string {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success)
    throw new AppError(
      400,
      "INVALID_ID",
      "The requested ID must be a valid UUID.",
    );
  return parsed.data;
}
