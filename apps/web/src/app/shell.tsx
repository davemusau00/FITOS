import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Icon, IconButton } from "@fitos/ui";
import { can, useAuth } from "./auth";
import { FitosLogo } from "./logo";
import { CommandPalette } from "./command-palette";
import { BranchProvider, useBranch } from "./branch-context";
import { api } from "../lib/api/client";
import type { WorkspaceKey } from "@fitos/contracts";
import { commandNavigation } from "./navigation";

const workspaceLinks: Partial<Record<WorkspaceKey, { label: string; path: string }>> = {
  command: { label: "Command", path: "/app/overview" },
  ops: { label: "Ops", path: "/ops" },
  front_desk: { label: "Front Desk", path: "/reception" },
  coach: { label: "Coach", path: "/coach" },
  practice: { label: "Practice", path: "/practice" }
};

function AppShellInner() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);

  const {
    activeBranchId,
    activeBranch: ctxBranch,
    setActiveBranch,
    branches: ctxBranches
  } = useBranch();

  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const branchRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setBranchMenuOpen(false);
    setQuickCreateOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Global listener for Cmd+K event
  useEffect(() => {
    const handleOpenCmd = () => setCmdOpen(true);
    window.addEventListener("open-command-palette", handleOpenCmd);
    return () => window.removeEventListener("open-command-palette", handleOpenCmd);
  }, []);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setBranchMenuOpen(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setQuickCreateOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!auth) return null;

  const navGroups = commandNavigation.reduce<Record<string, typeof commandNavigation>>(
    (groups, item) => {
      (groups[item.group] ??= []).push(item);
      return groups;
    },
    {}
  );

  if (!auth.availableWorkspaces.includes("command")) {
    return (
      <main className="surface-shell-access-denied">
        <h1>You don't have access to FITOS Command</h1>
        <p>Use your assigned workspace or ask a FITOS administrator for access.</p>
      </main>
    );
  }

  const currentBranch = ctxBranch ?? auth.branches[0];

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const userInitials = auth.user.displayName
    ? auth.user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AD";

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside
        aria-label="Primary navigation"
        className={`app-sidebar ${menuOpen ? "app-sidebar--open" : ""}`}
      >
        {/* Brandmark / Logo Header */}
        <div className="app-sidebar__header">
          <NavLink className="fitos-logo" onClick={() => setMenuOpen(false)} to="/app/overview">
            <FitosLogo height={24} />
          </NavLink>
        </div>

        <div className="app-sidebar__body">
          <div className="surface-workspace-switcher" aria-label="Available workspaces">
            <span className="surface-workspace-switcher__label">Workspace</span>
            {auth.availableWorkspaces.map((key) => {
              const link = workspaceLinks[key];
              return link ? (
                <NavLink
                  key={key}
                  to={link.path}
                  onClick={(event) => {
                    event.preventDefault();
                    setWorkspaceError(null);
                    void api
                      .setWorkspace(key)
                      .then(() => navigate(link.path))
                      .catch((error: unknown) =>
                        setWorkspaceError(
                          error instanceof Error ? error.message : "Unable to switch workspace."
                        )
                      );
                  }}
                >
                  {link.label}
                </NavLink>
              ) : null;
            })}
          </div>
          {workspaceError ? (
            <p className="surface-shell-error" role="alert">
              {workspaceError}
            </p>
          ) : null}
          {/* Branch Switcher */}
          <div ref={branchRef} style={{ position: "relative" }}>
            <button
              aria-expanded={branchMenuOpen}
              className="branch-switcher"
              onClick={() => setBranchMenuOpen((prev) => !prev)}
              type="button"
            >
              <div className="branch-switcher__info">
                <span className="branch-switcher__label">{auth.tenant.name}</span>
                <strong className="branch-switcher__name">
                  {currentBranch?.name ?? "All Locations"}
                </strong>
              </div>
              <Icon className="branch-switcher__chevron" name="chevron-down" size={14} />
            </button>

            {branchMenuOpen && (ctxBranches.length > 0 || auth.branches.length > 0) ? (
              <ul className="branch-dropdown">
                {(ctxBranches.length > 0 ? ctxBranches : auth.branches).map((b) => (
                  <li key={b.id}>
                    <button
                      className={b.id === (activeBranchId || currentBranch?.id) ? "is-active" : ""}
                      onClick={() => {
                        setActiveBranch(b.id);
                        setBranchMenuOpen(false);
                      }}
                      type="button"
                    >
                      <Icon name="building" size={14} />
                      {b.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Quick Create Button */}
          <div ref={quickCreateRef} style={{ position: "relative" }}>
            <button
              className="quick-create-btn"
              onClick={() => setQuickCreateOpen((prev) => !prev)}
              type="button"
            >
              <Icon name="plus" size={16} />
              Quick Create
            </button>

            {quickCreateOpen ? (
              <ul className="quick-create-menu">
                {can(auth, "member:create") ? (
                  <li>
                    <NavLink onClick={() => setQuickCreateOpen(false)} to="/app/members/new">
                      <Icon name="users" size={14} />
                      Add New Member
                    </NavLink>
                  </li>
                ) : null}
                {can(auth, "booking:create") ? (
                  <li>
                    <NavLink onClick={() => setQuickCreateOpen(false)} to="/app/bookings/new">
                      <Icon name="calendar" size={14} />
                      Book a Class / Session
                    </NavLink>
                  </li>
                ) : null}
                {can(auth, "lead:create") ? (
                  <li>
                    <NavLink onClick={() => setQuickCreateOpen(false)} to="/app/leads/new">
                      <Icon name="user" size={14} />
                      Create New Lead
                    </NavLink>
                  </li>
                ) : null}
                {can(auth, "attendance:checkin") ? (
                  <li>
                    <NavLink onClick={() => setQuickCreateOpen(false)} to="/app/attendance">
                      <Icon name="check" size={14} />
                      Check-in / Attendance
                    </NavLink>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {/* Grouped Navigation */}
          <nav className="app-nav">
            {Object.entries(navGroups).map(([group, items]) => {
              const accessibleItems = items.filter(
                (item) => !item.permission || can(auth, item.permission)
              );
              if (accessibleItems.length === 0) return null;
              return (
                <div className="nav-group" key={group}>
                  <div className="nav-group__label">{group}</div>
                  {accessibleItems.map((item) => (
                    <NavLink
                      className={({ isActive }) =>
                        `app-nav__link ${isActive ? "app-nav__link--active" : ""}`
                      }
                      key={item.path}
                      onClick={() => setMenuOpen(false)}
                      to={item.path}
                    >
                      <Icon name={item.icon} size={17} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="app-sidebar__footer" ref={userMenuRef}>
          {userMenuOpen ? (
            <ul className="user-dropdown">
              <li>
                <NavLink onClick={() => setUserMenuOpen(false)} to="/account/profile">
                  <Icon name="user" size={14} />
                  Account Profile
                </NavLink>
              </li>
              <li>
                <NavLink onClick={() => setUserMenuOpen(false)} to="/account/organization">
                  <Icon name="building" size={14} />
                  Organization Profile
                </NavLink>
              </li>
              <li>
                <NavLink onClick={() => setUserMenuOpen(false)} to="/account/plan">
                  <Icon name="spark" size={14} />
                  Plan & Capabilities
                </NavLink>
              </li>
              <li>
                <NavLink onClick={() => setUserMenuOpen(false)} to="/app/settings/security">
                  <Icon name="shield" size={14} />
                  Security & Access
                </NavLink>
              </li>
              <li className="user-dropdown__divider" />
              <li className="user-dropdown__danger">
                <button onClick={() => void logout()} type="button">
                  <Icon name="logout" size={14} />
                  Sign out
                </button>
              </li>
            </ul>
          ) : null}

          <button
            aria-expanded={userMenuOpen}
            className="user-profile-btn"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            type="button"
          >
            <div className="user-avatar">{userInitials}</div>
            <div className="user-info">
              <span className="user-name">{auth.user.displayName || "Admin"}</span>
              <span className="user-role">
                {can(auth, "tenant:settings") ? "Administrator" : "Staff"}
              </span>
            </div>
            <Icon
              name="more"
              size={16}
              style={{ color: "var(--text-muted)", marginLeft: "auto" }}
            />
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile */}
      {menuOpen ? (
        <button
          aria-label="Close navigation"
          className="app-backdrop"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}

      {/* ── Main Area ── */}
      <main className="app-main">
        {/* Topbar */}
        <header className="app-topbar">
          <IconButton
            className="app-topbar__menu-btn"
            icon="menu"
            label="Open navigation"
            onClick={() => setMenuOpen(true)}
            variant="ghost"
          />

          {/* Commands and navigation trigger */}
          <div
            aria-label="Search or type a command"
            className="topbar-search"
            onClick={() => setCmdOpen(true)}
            role="button"
            tabIndex={0}
          >
            <Icon name="search" size={16} />
            <span>Search members, classes, actions...</span>
            <span className="topbar-search__kbd">
              <kbd>⌘K</kbd>
            </span>
          </div>

          <div className="topbar-actions">
            {/* Branch Context Tag */}
            <div className="topbar-branch">
              <span className="topbar-branch__org">{auth.tenant.timezone}</span>
              <span className="topbar-sep">•</span>
              <strong className="topbar-branch__name">{currentBranch?.name ?? "HQ"}</strong>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <div className="app-content">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav aria-label="Mobile Navigation" className="mobile-bottom-nav">
        <NavLink
          className={({ isActive }) =>
            `mobile-nav-item ${isActive ? "mobile-nav-item--active" : ""}`
          }
          to="/app/overview"
        >
          <Icon name="dashboard" size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `mobile-nav-item ${isActive ? "mobile-nav-item--active" : ""}`
          }
          to="/app/schedule"
        >
          <Icon name="calendar" size={20} />
          <span>Schedule</span>
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `mobile-nav-item ${isActive ? "mobile-nav-item--active" : ""}`
          }
          to="/app/bookings"
        >
          <Icon name="calendar" size={20} />
          <span>Bookings</span>
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `mobile-nav-item ${isActive ? "mobile-nav-item--active" : ""}`
          }
          to="/app/members"
        >
          <Icon name="users" size={20} />
          <span>Members</span>
        </NavLink>
        <button
          className="mobile-nav-item"
          onClick={() => setMenuOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer" }}
          type="button"
        >
          <Icon name="menu" size={20} />
          <span>Menu</span>
        </button>
      </nav>

      {/* Command Palette Modal */}
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

export function AppShell() {
  return (
    <BranchProvider>
      <AppShellInner />
    </BranchProvider>
  );
}
