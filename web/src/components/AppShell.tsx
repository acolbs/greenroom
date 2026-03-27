import React from "react";
import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/select-team", label: "Team" },
  { to: "/free-agency", label: "Free agency" },
  { to: "/draft", label: "Draft" }
] as const;

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/" className="brand" title="Greenroom home">
            <span className="brand-mark" aria-hidden />
            Greenroom
          </NavLink>
          <nav className="site-nav" aria-label="Simulation steps">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `site-nav-link${isActive ? " active" : ""}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </div>
  );
}
