import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./shell";
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
  MembersPage,
  NewBookingPage,
  NewLeadPage,
  NewMemberPage,
  OnboardingPage,
  OrganizationSettingsPage,
  OverviewPage,
  PaymentsPage,
  ReceptionPage,
  SchedulePage,
  SecuritySettingsPage,
  ServicesPage,
  SettingsPage,
  StaffPage,
  TenantPublicPage,
  UnmatchedPaymentsPage,
  TenantSignupPage,
  EquipmentPage,
  InventoryPage,
  AssessmentsPage,
  TherapyPage,
  AccountSubscriptionPage
  ,FitosLandingPage
  ,ConfigureFitosPage
  ,ImplementationInquiriesPage
  ,ImplementationInquiryDetailPage
} from "../features";

function ProtectedRoute() {
  const { auth, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <main className="boot-screen">Loading FITOS…</main>;
  if (!auth) return <Navigate replace state={{ from: location }} to="/login" />;
  return <Outlet />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<FitosLandingPage />} path="/" />
      <Route element={<ConfigureFitosPage />} path="/configure" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<TenantSignupPage />} path="/signup" />
      <Route element={<ProtectedRoute />}>
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
          <Route element={<UnmatchedPaymentsPage />} path="payments/unmatched" />

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
          <Route element={<AccountSubscriptionPage />} path="settings/subscription" />
          <Route element={<ImplementationInquiriesPage />} path="platform/inquiries" />
          <Route element={<ImplementationInquiryDetailPage />} path="platform/inquiries/:inquiryId" />
        </Route>
        <Route element={<OnboardingPage />} path="/onboarding" />
        <Route element={<MemberPortalPage />} path="/member/*" />
      </Route>

      {/* Public Tenant Website */}
      <Route element={<TenantPublicPage />} path="/:tenantSlug" />
      <Route element={<Navigate replace to="/app/overview" />} path="*" />
    </Routes>
  );
}
