import { compare } from "bcryptjs";
import { withErrors } from "@/http/errors";
import { readJson } from "@/http/validation";
import { loginSchema } from "@/http/schemas";
import { userRepository } from "@/modules/auth/repository";
import { issueToken } from "@/modules/auth/jwt";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const input = await readJson(request, loginSchema);
  const user = await userRepository.findByEmail(input.email);
  if (!user || !(await compare(input.password, user.passwordHash))) {
    return Response.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
      },
      { status: 401 },
    );
  }
  const token = await issueToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  return Response.json({
    token,
    token_type: "Bearer",
    expires_in: 7200,
    user: { id: user.id, email: user.email, role: user.role },
  });
});
