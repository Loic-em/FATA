import { SetMetadata } from "@nestjs/common";
import type { AuthenticatedUser } from "./jwt.strategy";

export const ROLES_KEY = "roles";
export type UserRole = AuthenticatedUser["role"];
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
