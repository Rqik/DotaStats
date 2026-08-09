import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewAnalysis = lazy(() => import('./pages/NewAnalysis'));
const AnalysisResult = lazy(() => import('./pages/AnalysisResult'));
const MatchAnalysisResult = lazy(() => import('./pages/MatchAnalysisResult'));
const DraftAnalysisResult = lazy(() => import('./pages/DraftAnalysisResult'));
const SavedAnalysisPage = lazy(() => import('./pages/SavedAnalysisPage'));
const BetsJournal = lazy(() => import('./pages/BetsJournal'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function RouteFallback() {
  return <div className="app-shell__route-fallback" role="status">Загрузка экрана…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="analysis" element={<NewAnalysis />} />
          <Route path="analysis/result" element={<AnalysisResult />} />
          <Route path="analysis/match/result" element={<MatchAnalysisResult />} />
          <Route path="analysis/draft/result" element={<DraftAnalysisResult />} />
          <Route path="analysis/saved/:analysisId" element={<SavedAnalysisPage />} />
          <Route path="bets" element={<BetsJournal />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
