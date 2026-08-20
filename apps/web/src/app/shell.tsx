import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button, Icon, IconButton } from "@fitos/ui";
import { can, useAuth } from "./auth";

type NavItem = {
  to: string;
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  permission: string;
};
const nav: NavItem[] = [
  { to: "/app/overview", label: "Overview", icon: "dashboard", permission: "tenant:read" },
  { to: "/app/members", label: "Members", icon: "users", permission: "member:read" },
  { to: "/app/leads", label: "Leads", icon: "users", permission: "lead:read" },
  { to: "/app/staff", label: "Staff", icon: "team", permission: "staff:read" },
  { to: "/app/settings", label: "Settings", icon: "settings", permission: "tenant:read" }
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { auth, signOut } = useAuth();
  const navigate = useNavigate();
  if (!auth) return null;
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
  return (
    <div className="app-shell">
      <aside
        className={`app-sidebar ${menuOpen ? "app-sidebar--open" : ""}`}
        aria-label="Primary navigation"
      >
        <NavLink className="fitos-logo" to="/app/overview" onClick={() => setMenuOpen(false)}>
          <span>F</span>
          <strong>FITOS</strong>
        </NavLink>
        <div className="branch-context">
          <span className="branch-context__label">Organization</span>
          <strong>{auth.tenant.name}</strong>
          <span>
            {auth.branches.length === 1
              ? auth.branches[0]?.name
              : `${auth.branches.length} branches`}
          </span>
        </div>
        <nav className="app-nav">
          {nav
            .filter((item) => can(auth, item.permission))
            .map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `app-nav__link ${isActive ? "app-nav__link--active" : ""}`
                }
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="app-sidebar__footer">
          <span className="user-name">{auth.user.displayName}</span>
          <Button icon="logout" onClick={() => void logout()} size="small" variant="ghost">
            Sign out
          </Button>
        </div>
      </aside>
      {menuOpen ? (
        <button
          aria-label="Close navigation"
          className="app-backdrop"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}
      <main className="app-main">
        <header className="app-topbar">
          <IconButton
            icon="menu"
            label="Open navigation"
            onClick={() => setMenuOpen(true)}
            variant="ghost"
          />
          <div>
            <span className="app-topbar__eyebrow">{auth.tenant.timezone}</span>
            <strong>{auth.branches[0]?.name ?? "No branch access"}</strong>
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
