import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { BranchProvider, useBranch } from "./branch-context";
import { useAuth } from "./auth";
import type { WorkspaceKey } from "@fitos/contracts";
import { api } from "../lib/api/client";
import { roleNavigation } from "./navigation";

type Surface = "ops" | "front desk" | "coach" | "practice";
const surfaceCopy: Record<Surface, { name: string; question: string }> = {
  ops: { name: "FITOS Ops", question: "What needs attention today?" },
  "front desk": {
    name: "FITOS Front Desk",
    question: "Who is here, who is coming, what do they need?"
  },
  coach: { name: "FITOS Coach", question: "Who am I training today?" },
  practice: { name: "FITOS Practice", question: "Which appointments and records need care?" }
};
const workspaceLinks: Partial<Record<WorkspaceKey, { label: string; path: string }>> = {
  command: { label: "Command", path: "/app/overview" },
  ops: { label: "Ops", path: "/ops" },
  front_desk: { label: "Front Desk", path: "/reception" },
  coach: { label: "Coach", path: "/coach" },
  practice: { label: "Practice", path: "/practice" }
};

function SurfaceShellInner({ surface, workspace }: { surface: Surface; workspace: WorkspaceKey }) {
  const { auth } = useAuth();
  const { activeBranchId, branches, setActiveBranch } = useBranch();
  const navigate = useNavigate();
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const copy = surfaceCopy[surface];
  if (!auth?.availableWorkspaces.includes(workspace)) {
    return (
      <main className="surface-shell-access-denied">
        <h1>You don't have access to this workspace</h1>
        <p>Ask your FITOS administrator if you think your role should include this area.</p>
      </main>
    );
  }
  return (
    <div className={`surface-shell surface-shell-${surface.replace(" ", "-")}`}>
      <header className="surface-shell-header">
        <div>
          <div className="surface-shell-header__identity">
            <strong>{copy.name}</strong>
            <span>{copy.question}</span>
          </div>
          <div className="surface-shell-header__controls">
            <label className="surface-branch-select">
              Branch
              <select
                aria-label="Active branch"
                className="fitos-control"
                onChange={(event) => setActiveBranch(event.target.value)}
                value={activeBranchId}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <nav aria-label="Available workspaces" className="surface-workspace-switcher">
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
            </nav>
          </div>
          <nav aria-label={`${copy.name} navigation`} className="surface-shell-nav">
            {roleNavigation[surface].map((item) => (
              <NavLink end={item.path === `/${workspace}`} key={item.path} to={item.path}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          {workspaceError ? (
            <p className="surface-shell-error" role="alert">
              {workspaceError}
            </p>
          ) : null}
        </div>
      </header>
      <main className="surface-shell-content">
        <Outlet />
      </main>
    </div>
  );
}

export function SurfaceShell({
  surface,
  workspace
}: {
  surface: Surface;
  workspace: WorkspaceKey;
}) {
  return (
    <BranchProvider>
      <SurfaceShellInner surface={surface} workspace={workspace} />
    </BranchProvider>
  );
}
