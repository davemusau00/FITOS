import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Icon } from "@fitos/ui";
import { FitosLogo } from "./logo";
import { marketingNavigation } from "./navigation";

export function MarketingShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="marketing-shell saas-public-page">
      <header className="marketing-header">
        <div className="marketing-header__inner">
          <Link aria-label="FITOS home" className="marketing-brand" to="/">
            <FitosLogo height={27} />
          </Link>
          <button
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="marketing-menu"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <Icon name={open ? "close" : "menu"} size={20} />
          </button>
          <nav aria-label="FITOS" className={`marketing-nav ${open ? "is-open" : ""}`}>
            {marketingNavigation.map((item) => (
              <NavLink key={item.path} onClick={() => setOpen(false)} to={item.path}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="marketing-actions">
            <Link className="fitos-button fitos-button--ghost fitos-button--small" to="/login">
              Sign in
            </Link>
            <Link
              className="fitos-button fitos-button--secondary fitos-button--small"
              to="/configure"
            >
              Configure FITOS
            </Link>
            <Link className="fitos-button fitos-button--primary fitos-button--small" to="/signup">
              Start FITOS
            </Link>
          </div>
        </div>
      </header>
      <main className="marketing-main">
        <Outlet />
      </main>
      <footer className="marketing-footer">
        <div>
          <FitosLogo height={22} />
          <p>One operating system for fitness, performance, therapy, and member experience.</p>
        </div>
        <nav aria-label="Footer navigation">
          {marketingNavigation.map((item) => (
            <Link key={item.path} to={item.path}>
              {item.label}
            </Link>
          ))}
          <Link to="/configure">Configure FITOS</Link>
          <Link to="/login">Staff sign in</Link>
        </nav>
        <small>© 2026 FITOS Operating System.</small>
      </footer>
    </div>
  );
}
