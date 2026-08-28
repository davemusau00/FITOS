import type { IconName } from "@fitos/ui";
import type { SaaSCapabilityKey, WorkspaceKey } from "@fitos/contracts";

export type RouteMeta = {
  path: string;
  label: string;
  description?: string;
  group: string;
  icon: IconName;
  workspace: WorkspaceKey | "platform" | "public" | "member";
  permission?: string;
  capability?: SaaSCapabilityKey;
  branchMode?: "required" | "optional" | "none";
  mobileMode?: "cards" | "agenda" | "touch" | "consumer";
};

export const platformNavigation: RouteMeta[] = [
  {
    path: "/platform",
    label: "Overview",
    group: "Control plane",
    icon: "dashboard",
    workspace: "platform",
    branchMode: "none"
  },
  {
    path: "/platform/tenants",
    label: "Tenants",
    group: "Customers",
    icon: "building",
    workspace: "platform",
    branchMode: "none"
  },
  {
    path: "/platform/inquiries",
    label: "Implementations",
    group: "Customers",
    icon: "spark",
    workspace: "platform",
    branchMode: "none"
  },
  {
    path: "/platform/audit",
    label: "Audit",
    group: "Governance",
    icon: "shield",
    workspace: "platform",
    branchMode: "none"
  }
];

export const marketingNavigation = [
  { path: "/features", label: "Features" },
  { path: "/solutions", label: "Solutions" },
  { path: "/pricing", label: "Plans" },
  { path: "/contact", label: "Talk to FITOS" }
] as const;
