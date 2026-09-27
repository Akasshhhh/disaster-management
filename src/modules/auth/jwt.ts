import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/config/env";
import type { AuthUser, UserRole } from "./types";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function issueToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    (payload.role !== "ADMIN" && payload.role !== "CONTRIBUTOR")
  ) {
    throw new Error("Invalid token claims");
  }
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role as UserRole,
  };
}
