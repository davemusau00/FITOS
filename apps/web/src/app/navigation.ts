import type { IconName } from "@fitos/ui";
import type { SaaSCapabilityKey, WorkspaceKey } from "@fitos/contracts";

export type RouteMeta = {
  path: string;
  label: string;
  title?: string;
  breadcrumb?: string[];
  primaryAction?: { label: string; path: string };
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
    title: "Platform overview",
    breadcrumb: ["Platform", "Overview"],
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
  },
  {
    path: "/platform/notices",
    label: "Notices",
    group: "Governance",
    icon: "warning",
    workspace: "platform",
    branchMode: "none"
  }
];

export const commandNavigation: RouteMeta[] = [
  {
    path: "/app/overview",
    label: "Dashboard",
    title: "Command dashboard",
    breadcrumb: ["Command", "Dashboard"],
    primaryAction: { label: "Open Front Desk", path: "/reception" },
    group: "Today",
    icon: "dashboard",
    workspace: "command",
    permission: "tenant:read"
  },
  {
    path: "/platform/plans",
    label: "Plans",
    group: "Control plane",
    icon: "settings",
    workspace: "platform",
    branchMode: "none"
  },
  {
    path: "/platform/feature-flags",
    label: "Feature Flags",
    group: "Control plane",
    icon: "settings",
    workspace: "platform",
    branchMode: "none"
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

export const memberNavigation: RouteMeta[] = [
  {
    path: "/member",
    label: "Home",
    group: "Member",
    icon: "dashboard",
    workspace: "member",
    branchMode: "none",
    mobileMode: "consumer"
  },
  {
    path: "/member?tab=schedule",
    label: "Book",
    group: "Member",
    icon: "calendar",
    workspace: "member",
    branchMode: "none",
    mobileMode: "consumer"
  },
  {
    path: "/member?tab=membership",
    label: "Membership",
    group: "Member",
    icon: "shield",
    workspace: "member",
    branchMode: "none",
    mobileMode: "consumer"
  },
  {
    path: "/member?tab=attendance",
    label: "Visits",
    group: "Member",
    icon: "check",
    workspace: "member",
    branchMode: "none",
    mobileMode: "consumer"
  },
  {
    path: "/member?tab=profile",
    label: "Profile",
    group: "Member",
    icon: "users",
    workspace: "member",
    branchMode: "none",
    mobileMode: "consumer"
  }
];

export const roleNavigation: Record<"ops" | "front desk" | "coach" | "practice", RouteMeta[]> = {
  ops: [
    {
      path: "/ops",
      label: "Today",
      group: "Today",
      icon: "dashboard",
      workspace: "ops",
      branchMode: "required",
      mobileMode: "touch"
    },
    {
      path: "/ops/schedule",
      label: "Schedule",
      group: "Operations",
      icon: "calendar",
      workspace: "ops",
      branchMode: "required",
      mobileMode: "agenda"
    },
    {
      path: "/ops/bookings",
      label: "Bookings",
      group: "Operations",
      icon: "calendar",
      workspace: "ops",
      branchMode: "required",
      mobileMode: "cards"
    },
    {
      path: "/ops/attendance",
      label: "Attendance",
      group: "Operations",
      icon: "check",
      workspace: "ops",
      branchMode: "required",
      mobileMode: "touch"
    }
  ],
  "front desk": [
    {
      path: "/reception",
      label: "Front Desk",
      group: "Today",
      icon: "check",
      workspace: "front_desk",
      branchMode: "required",
      mobileMode: "touch"
    }
  ],
  coach: [
    {
      path: "/coach",
      label: "My Day",
      group: "Today",
      icon: "dashboard",
      workspace: "coach",
      branchMode: "required",
      mobileMode: "touch"
    }
  ],
  practice: [
    {
      path: "/practice",
      label: "Practice today",
      group: "Today",
      icon: "dashboard",
      workspace: "practice",
      branchMode: "required",
      mobileMode: "cards"
    },
    {
      path: "/practice/assessments",
      label: "Assessments",
      group: "Records",
      icon: "spark",
      workspace: "practice",
      branchMode: "required",
      mobileMode: "cards"
    }
  ]
};

/** The single route manifest used by shells, breadcrumbs, and contextual actions. */
export const routeManifest: RouteMeta[] = [
  ...platformNavigation,
  ...commandNavigation,
  ...memberNavigation,
  ...Object.values(roleNavigation).flat()
];

export function routeMetaForPath(pathname: string): RouteMeta | undefined {
  const normalized = pathname.split("?")[0]?.replace(/\/$/, "") || "/";
  return routeManifest.find((route) => route.path.split("?")[0]?.replace(/\/$/, "") === normalized);
}
