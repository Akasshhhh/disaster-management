import { AppError } from "@/http/errors";
import { verifyToken } from "./jwt";
import type { AuthUser } from "./types";

export async function getRequestUser(
  request: Request,
): Promise<AuthUser | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match)
    throw new AppError(
      401,
      "INVALID_TOKEN",
      "The authorization header is invalid.",
    );
  try {
    return await verifyToken(match[1]);
  } catch {
    throw new AppError(
      401,
      "INVALID_TOKEN",
      "The access token is invalid or expired.",
    );
  }
}
