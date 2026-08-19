import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_ROUTE = "fitos:is-public";
export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);
