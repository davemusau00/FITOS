import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { BranchProvider } from "./branch-context";
import { useAuth } from "./auth";
import type { WorkspaceKey } from "@fitos/contracts";
import { api } from "../lib/api/client";

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

export function SurfaceShell({
  surface,
  workspace
}: {
  surface: Surface;
  workspace: WorkspaceKey;
}) {
  const { auth } = useAuth();
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
    <BranchProvider>
      <div className={`surface-shell surface-shell-${surface.replace(" ", "-")}`}>
        <header className="surface-shell-header">
          <div>
            <strong>{copy.name}</strong>
            <span>{copy.question}</span>
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
                        .catch((error: unknown) => {
                          setWorkspaceError(
                            error instanceof Error ? error.message : "Unable to switch workspace."
                          );
                        });
                    }}
                  >
                    {link.label}
                  </NavLink>
                ) : null;
              })}
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
    </BranchProvider>
  );
}
