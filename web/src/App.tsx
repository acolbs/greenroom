import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import SelectTeamPage from "./pages/SelectTeamPage";
import AnalysisPage from "./pages/AnalysisPage";
import FreeAgencyPage from "./pages/FreeAgencyPage";
import DraftPage from "./pages/DraftPage";
import ResultsPage from "./pages/ResultsPage";
import RequireTeam from "./components/RequireTeam";
import PageShell from "./components/PageShell";

export default function App() {
  return (
    <div className="app-layout">
      <main className="app-main">
        <Routes>
          <Route element={<PageShell />}>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/select-team" element={<SelectTeamPage />} />
            <Route path="/analysis" element={<RequireTeam><AnalysisPage /></RequireTeam>} />
            <Route path="/free-agency" element={<RequireTeam><FreeAgencyPage /></RequireTeam>} />
            <Route path="/draft" element={<RequireTeam><DraftPage /></RequireTeam>} />
            <Route path="/results" element={<RequireTeam><ResultsPage /></RequireTeam>} />
            <Route path="/roster-summary" element={<Navigate to="/results" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
