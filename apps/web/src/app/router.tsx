import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./shell";
import {
  BookingsPage,
  BranchesSettingsPage,
  LeadsPage,
  LoginPage,
  MemberDetailPage,
  MembersPage,
  NewBookingPage,
  NewLeadPage,
  NewMemberPage,
  OnboardingPage,
  OrganizationSettingsPage,
  OverviewPage,
  SchedulePage,
  SecuritySettingsPage,
  ServicesPage,
  SettingsPage,
  StaffPage
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
      <Route element={<LoginPage />} path="/login" />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />} path="/app">
          <Route element={<Navigate replace to="overview" />} index />
          <Route element={<OverviewPage />} path="overview" />
          <Route element={<SchedulePage />} path="schedule" />
          <Route element={<BookingsPage />} path="bookings" />
          <Route element={<NewBookingPage />} path="bookings/new" />
          <Route element={<ServicesPage />} path="services" />
          <Route element={<MembersPage />} path="members" />
          <Route element={<NewMemberPage />} path="members/new" />
          <Route element={<MemberDetailPage />} path="members/:memberId" />
          <Route element={<LeadsPage />} path="leads" />
          <Route element={<NewLeadPage />} path="leads/new" />
          <Route element={<StaffPage />} path="staff" />
          <Route element={<SettingsPage />} path="settings" />
          <Route element={<OrganizationSettingsPage />} path="settings/organization" />
          <Route element={<BranchesSettingsPage />} path="settings/branches" />
          <Route element={<BranchesSettingsPage />} path="settings/branches/new" />
          <Route element={<StaffPage />} path="settings/team" />
          <Route element={<SecuritySettingsPage />} path="settings/security" />
        </Route>
        <Route element={<OnboardingPage />} path="/onboarding" />
      </Route>
      <Route element={<Navigate replace to="/app/overview" />} path="*" />
    </Routes>
  );
}
