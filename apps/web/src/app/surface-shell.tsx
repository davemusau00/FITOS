import { Outlet } from "react-router-dom";
import { BranchProvider } from "./branch-context";

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

export function SurfaceShell({ surface }: { surface: Surface }) {
  const copy = surfaceCopy[surface];
  return (
    <BranchProvider>
      <div className={`surface-shell surface-shell-${surface.replace(" ", "-")}`}>
        <header className="surface-shell-header">
          <div>
            <strong>{copy.name}</strong>
            <span>{copy.question}</span>
          </div>
        </header>
        <main className="surface-shell-content">
          <Outlet />
        </main>
      </div>
    </BranchProvider>
  );
}
