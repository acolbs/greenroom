import { Navigate } from "react-router-dom";
import { useSimulatorStore } from "../store/simulatorStore";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/** Redirects to /select-team if no team has been selected yet. */
export default function RequireTeam({ children }: Props) {
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);

  if (!selectedTeamId) {
    return <Navigate to="/select-team" replace />;
  }

  return <>{children}</>;
}
