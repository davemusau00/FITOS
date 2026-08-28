import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button, Icon } from "@fitos/ui";
import { api } from "../lib/api/client";
import { FitosLogo } from "./logo";
import { platformNavigation } from "./navigation";

export function PlatformShell() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="platform-shell">
      <aside className={`platform-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="platform-sidebar__brand">
          <FitosLogo height={25} />
          <span>Platform</span>
        </div>
        <p className="platform-sidebar__context">FITOS control plane</p>
        <nav aria-label="Platform navigation" className="platform-nav">
          {platformNavigation.map((item) => (
            <NavLink
              className={({ isActive }) => `platform-nav__link ${isActive ? "is-active" : ""}`}
              end={item.path === "/platform"}
              key={item.path}
              onClick={() => setMenuOpen(false)}
              to={item.path}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="platform-sidebar__footer">
          <Button
            fullWidth
            icon="logout"
            onClick={() => {
              void api.platformLogout().catch(() => undefined).finally(() => {
                window.localStorage.removeItem("fitos_platform_token");
                navigate("/platform/login", { replace: true });
              });
            }}
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </aside>
      <div className="platform-shell__main">
        <header className="platform-topbar">
          <button aria-expanded={menuOpen} aria-label="Toggle platform navigation" className="platform-menu-button" onClick={() => setMenuOpen((value) => !value)} type="button">
            <Icon name={menuOpen ? "close" : "menu"} size={20} />
          </button>
          <div>
            <strong>FITOS Platform</strong>
            <span>Customer lifecycle and implementation operations</span>
          </div>
        </header>
        <main className="platform-shell__content">
          <Outlet />
        </main>
      </div>
      {menuOpen ? <button aria-label="Close navigation" className="platform-shell__backdrop" onClick={() => setMenuOpen(false)} type="button" /> : null}
    </div>
  );
}
