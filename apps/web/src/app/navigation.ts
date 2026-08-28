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

export const commandNavigation: RouteMeta[] = [
  {
    path: "/app/overview",
    label: "Dashboard",
    group: "Today",
    icon: "dashboard",
    workspace: "command",
    permission: "tenant:read"
  },
  {
    path: "/app/schedule",
    label: "Schedule",
    group: "Operations",
    icon: "calendar",
    workspace: "command",
    permission: "schedule:read",
    branchMode: "optional",
    mobileMode: "agenda"
  },
  {
    path: "/app/bookings",
    label: "Bookings",
    group: "Operations",
    icon: "calendar",
    workspace: "command",
    permission: "booking:read",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/attendance",
    label: "Attendance",
    group: "Operations",
    icon: "check",
    workspace: "command",
    permission: "attendance:read",
    branchMode: "optional",
    mobileMode: "touch"
  },
  {
    path: "/app/reception",
    label: "Front Desk",
    group: "Operations",
    icon: "check",
    workspace: "command",
    permission: "attendance:read",
    branchMode: "optional",
    mobileMode: "touch"
  },
  {
    path: "/app/members",
    label: "Members",
    group: "People",
    icon: "users",
    workspace: "command",
    permission: "member:read",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/assessments",
    label: "FITOS Assess",
    group: "People",
    icon: "spark",
    workspace: "command",
    permission: "assessment:read",
    capability: "feature.assessments",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/therapy",
    label: "FITOS Therapy",
    group: "People",
    icon: "spark",
    workspace: "command",
    permission: "service:read",
    capability: "feature.therapy",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/memberships",
    label: "Memberships",
    group: "People",
    icon: "shield",
    workspace: "command",
    permission: "membership:read",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/leads",
    label: "Leads & CRM",
    group: "Growth",
    icon: "user",
    workspace: "command",
    permission: "lead:read",
    capability: "feature.crm",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/insights",
    label: "Insights & Analytics",
    group: "Growth",
    icon: "dashboard",
    workspace: "command",
    permission: "tenant:read",
    capability: "feature.insights",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/automations",
    label: "Automations",
    group: "Growth",
    icon: "spark",
    workspace: "command",
    permission: "tenant:read",
    capability: "feature.automations",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/services",
    label: "Services & Classes",
    group: "Business",
    icon: "spark",
    workspace: "command",
    permission: "service:read",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/equipment",
    label: "Equipment & Assets",
    group: "Business",
    icon: "check",
    workspace: "command",
    permission: "schedule:read",
    capability: "feature.equipment",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/inventory",
    label: "Inventory & Stock",
    group: "Business",
    icon: "check",
    workspace: "command",
    permission: "tenant:read",
    capability: "feature.inventory",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/staff",
    label: "Team & Staff",
    group: "Business",
    icon: "team",
    workspace: "command",
    permission: "staff:read",
    branchMode: "optional",
    mobileMode: "cards"
  },
  {
    path: "/app/settings",
    label: "Settings",
    group: "Settings",
    icon: "settings",
    workspace: "command",
    permission: "tenant:read",
    branchMode: "none"
  }
];

export const marketingNavigation = [
  { path: "/features", label: "Features" },
  { path: "/solutions", label: "Solutions" },
  { path: "/pricing", label: "Plans" },
  { path: "/contact", label: "Talk to FITOS" }
] as const;
