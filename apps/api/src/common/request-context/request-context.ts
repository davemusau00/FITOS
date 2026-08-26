import type { Request } from "express";
import type { RequestActor } from "@fitos/contracts";
import type { ResolvedSession } from "../../ports/fitos-repository.js";

export interface FitosRequest extends Request {
  requestId?: string;
  actor?: RequestActor;
  sessionToken?: string;
  session?: ResolvedSession;
  platformActor?: { userId: string; displayName?: string; email?: string | null };
}
