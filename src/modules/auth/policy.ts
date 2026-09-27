import { AppError } from "@/http/errors";
import type { AuthUser } from "./types";

export function requireUser(user: AuthUser | null): AuthUser {
  if (!user)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return user;
}

export function requireCreatePermission(user: AuthUser): void {
  if (user.role !== "ADMIN" && user.role !== "CONTRIBUTOR") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have permission to create disasters.",
    );
  }
}

export function requireUpdatePermission(
  user: AuthUser,
  createdBy: string,
): void {
  if (user.role === "ADMIN" || user.id === createdBy) return;
  throw new AppError(
    403,
    "FORBIDDEN",
    "You may only update disasters you created.",
  );
}

export function requireDeletePermission(user: AuthUser): void {
  if (user.role !== "ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only administrators can delete disasters.",
    );
  }
}
