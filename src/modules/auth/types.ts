export type UserRole = "ADMIN" | "CONTRIBUTOR";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};
