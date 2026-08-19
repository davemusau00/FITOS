import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./shell";
import {
  BranchesSettingsPage,
  LoginPage,
  MemberDetailPage,
  MembersPage,
  NewMemberPage,
  OnboardingPage,
  OrganizationSettingsPage,
  OverviewPage,
  SecuritySettingsPage,
  SettingsPage,
  StaffPage
} from "../features/pages";

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
          <Route element={<MembersPage />} path="members" />
          <Route element={<NewMemberPage />} path="members/new" />
          <Route element={<MemberDetailPage />} path="members/:memberId" />
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
