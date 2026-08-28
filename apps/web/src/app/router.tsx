import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { AppShell } from "./shell";
import { SurfaceShell } from "./surface-shell";
import { PlatformShell } from "./platform-shell";
import { MarketingShell } from "./marketing-shell";
import { api } from "../lib/api/client";
import { routeMetaForPath } from "./navigation";
import {
  AttendancePage,
  AutomationsPage,
  BookingsPage,
  BranchesSettingsPage,
  ClassRosterPage,
  InsightsPage,
  LeadsPage,
  LoginPage,
  MemberDetailPage,
  MemberPortalPage,
  MembershipsPage,
  PaymentsPage,
  MembersPage,
  NewBookingPage,
  NewLeadPage,
  NewMemberPage,
  OnboardingPage,
  OrganizationSettingsPage,
  OverviewPage,
  ReceptionPage,
  SchedulePage,
  SecuritySettingsPage,
  AuditSettingsPage,
  AccountSettingsPage,
  ServicesPage,
  SettingsPage,
  StaffPage,
  TenantPublicPage,
  TenantSignupPage,
  EquipmentPage,
  InventoryPage,
  AssessmentsPage,
  TherapyPage,
  AccountSubscriptionPage,
  NotificationInboxPage,
  PlatformPlansPage,
  FitosLandingPage,
  ConfigureFitosPage,
  ImplementationInquiriesPage,
  ImplementationInquiryDetailPage,
  PlatformLoginPage,
  PlatformTenantsPage,
  PlatformTenantDetailPage,
  PlatformOverviewPage,
  PlatformAuditPage,
  OpsDashboardPage,
  CoachDashboardPage,
  SitesPage,
  FeaturesPage,
  SolutionsPage,
  PricingPage,
  ContactPage
} from "../features";

function PlatformRoute() {
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  useEffect(() => {
    void api
      .platformMe()
      .then(() => setState("ready"))
      .catch(() => {
        window.localStorage.removeItem("fitos_platform_token");
        setState("denied");
      });
  }, []);
  if (state === "loading") return <main className="boot-screen">Loading FITOS Platform…</main>;
  if (state === "denied") return <Navigate replace to="/platform/login" />;
  return <Outlet />;
}

function ProtectedRoute() {
  const { auth, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <main className="boot-screen">Loading FITOS…</main>;
  if (!auth) return <Navigate replace state={{ from: location }} to="/login" />;
  return <Outlet />;
}

export function AppRouter() {
  const location = useLocation();
  useEffect(() => {
    const meta = routeMetaForPath(location.pathname);
    document.title = meta?.title ? `${meta.title} · FITOS` : "FITOS";
  }, [location.pathname]);

  return (
    <Routes>
      <Route element={<MarketingShell />} path="/">
        <Route element={<FitosLandingPage showChrome={false} />} index />
        <Route element={<FeaturesPage />} path="features" />
        <Route element={<SolutionsPage />} path="solutions" />
        <Route element={<SolutionsPage />} path="solutions/:solution" />
        <Route element={<PricingPage />} path="pricing" />
        <Route element={<ContactPage />} path="contact" />
      </Route>
      <Route element={<ConfigureFitosPage />} path="/configure" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<PlatformLoginPage />} path="/platform/login" />
      <Route element={<TenantSignupPage />} path="/signup" />
      <Route element={<MemberPortalPage />} path="/member/*" />
      <Route element={<ProtectedRoute />}>
        <Route element={<SurfaceShell surface="ops" workspace="ops" />} path="/ops">
          <Route element={<OpsDashboardPage />} index />
          <Route element={<SchedulePage />} path="schedule" />
          <Route element={<BookingsPage />} path="bookings" />
          <Route element={<AttendancePage />} path="attendance" />
        </Route>
        <Route
          element={<SurfaceShell surface="front desk" workspace="front_desk" />}
          path="/reception"
        >
          <Route element={<ReceptionPage />} index />
        </Route>
        <Route element={<SurfaceShell surface="coach" workspace="coach" />} path="/coach">
          <Route element={<CoachDashboardPage />} index />
          <Route element={<ClassRosterPage />} path="roster/:occurrenceId" />
        </Route>
        <Route element={<SurfaceShell surface="practice" workspace="practice" />} path="/practice">
          <Route element={<TherapyPage />} index />
          <Route element={<AssessmentsPage />} path="assessments" />
        </Route>
        <Route element={<AppShell />} path="/app">
          <Route element={<Navigate replace to="overview" />} index />
          <Route element={<OverviewPage />} path="overview" />

          {/* Operations */}
          <Route element={<SchedulePage />} path="schedule" />
          <Route element={<AttendancePage />} path="attendance" />
          <Route element={<ClassRosterPage />} path="attendance/roster/:occurrenceId" />
          <Route element={<ReceptionPage />} path="reception" />
          <Route element={<BookingsPage />} path="bookings" />
          <Route element={<NewBookingPage />} path="bookings/new" />

          {/* People */}
          <Route element={<MembersPage />} path="members" />
          <Route element={<NewMemberPage />} path="members/new" />
          <Route element={<MemberDetailPage />} path="members/:memberId" />
          <Route element={<LeadsPage />} path="leads" />
          <Route element={<NewLeadPage />} path="leads/new" />
          <Route element={<StaffPage />} path="staff" />

          {/* Business */}
          <Route element={<ServicesPage />} path="services" />
          <Route element={<MembershipsPage />} path="memberships" />
          <Route element={<PaymentsPage />} path="payments" />

          {/* Growth */}
          <Route element={<InsightsPage />} path="insights" />
          <Route element={<AutomationsPage />} path="automations" />

          {/* Equipment & Resources */}
          <Route element={<EquipmentPage />} path="equipment" />
          <Route element={<InventoryPage />} path="inventory" />
          <Route element={<AssessmentsPage />} path="assessments" />
          <Route element={<TherapyPage />} path="therapy" />

          {/* Settings */}
          <Route element={<SettingsPage />} path="settings" />
          <Route element={<OrganizationSettingsPage />} path="settings/organization" />
          <Route element={<BranchesSettingsPage />} path="settings/branches" />
          <Route element={<BranchesSettingsPage />} path="settings/branches/new" />
          <Route element={<StaffPage />} path="settings/team" />
          <Route element={<SecuritySettingsPage />} path="settings/security" />
          <Route element={<AuditSettingsPage />} path="settings/audit" />
          <Route element={<Navigate replace to="/account/profile" />} path="settings/account" />
          <Route element={<Navigate replace to="/account/plan" />} path="settings/subscription" />
          <Route element={<SitesPage />} path="sites" />
        </Route>
        <Route element={<AppShell />} path="/account">
          <Route element={<Navigate replace to="profile" />} index />
          <Route element={<AccountSettingsPage />} path="profile" />
          <Route element={<OrganizationSettingsPage />} path="organization" />
          <Route element={<AccountSubscriptionPage />} path="plan" />
          <Route element={<NotificationInboxPage />} path="notifications" />
        </Route>
        <Route element={<OnboardingPage />} path="/onboarding" />
      </Route>
      <Route element={<PlatformRoute />} path="/platform">
        <Route element={<PlatformShell />}>
          <Route element={<PlatformOverviewPage />} index />
          <Route element={<PlatformTenantsPage />} path="tenants" />
          <Route element={<PlatformTenantDetailPage />} path="tenants/:tenantId" />
          <Route element={<ImplementationInquiriesPage />} path="inquiries" />
          <Route element={<PlatformAuditPage />} path="audit" />
          <Route element={<PlatformPlansPage />} path="plans" />
          <Route element={<ImplementationInquiryDetailPage />} path="inquiries/:inquiryId" />
        </Route>
      </Route>

      {/* Public Tenant Website */}
      <Route element={<TenantPublicPage />} path="/:tenantSlug" />
      <Route element={<Navigate replace to="/app/overview" />} path="*" />
    </Routes>
  );
}
