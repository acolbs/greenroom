import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import WelcomePage from "./pages/WelcomePage";
import SelectTeamPage from "./pages/SelectTeamPage";
import FreeAgencyPage from "./pages/FreeAgencyPage";
import DraftPage from "./pages/DraftPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route element={<AppShell />}>
        <Route path="select-team" element={<SelectTeamPage />} />
        <Route path="free-agency" element={<FreeAgencyPage />} />
        <Route path="draft" element={<DraftPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
