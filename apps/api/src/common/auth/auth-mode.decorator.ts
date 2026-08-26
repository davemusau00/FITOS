import { SetMetadata } from "@nestjs/common";

export type AuthMode = "public" | "tenant" | "member" | "platform";
export const AUTH_MODE = "fitos:auth-mode";
export const AuthMode = (mode: AuthMode) => SetMetadata(AUTH_MODE, mode);
