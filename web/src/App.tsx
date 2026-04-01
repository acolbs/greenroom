import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import SelectTeamPage from "./pages/SelectTeamPage";
import FreeAgencyPage from "./pages/FreeAgencyPage";
import DraftPage from "./pages/DraftPage";
import RosterSummaryPage from "./pages/RosterSummaryPage";
import RequireTeam from "./components/RequireTeam";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/select-team" element={<SelectTeamPage />} />
      <Route
        path="/free-agency"
        element={
          <RequireTeam>
            <FreeAgencyPage />
          </RequireTeam>
        }
      />
      <Route
        path="/draft"
        element={
          <RequireTeam>
            <DraftPage />
          </RequireTeam>
        }
      />
      <Route
        path="/roster-summary"
        element={
          <RequireTeam>
            <RosterSummaryPage />
          </RequireTeam>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
