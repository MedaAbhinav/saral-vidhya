import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import ClassSubjectSelection from './pages/ClassSubjectSelection';
import PersonaSelection from './pages/PersonaSelection';
import ChapterList from './pages/ChapterList';
import StudyTable from './pages/StudyTable';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import GlobalLeaderboard from './pages/GlobalLeaderboard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Subjects from './pages/Subjects';
import ResourceTabs from './pages/ResourceTabs';
// Expert dashboard kept in codebase — disabled from public routing for MVP
// import ExpertDashboard from './pages/ExpertDashboard';
import branding from './config/branding.json';

/** Returns true if the user has passed the login screen */
function isAuthenticated() {
  return localStorage.getItem('app_authenticated') === 'true';
}

/** Redirect to /login if not authenticated */
function AuthGuard({ children }: { children: JSX.Element }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return children;
}

/** Redirect to / if already authenticated (for login page) */
function GuestOnly({ children }: { children: JSX.Element }) {
  if (isAuthenticated()) return <Navigate to="/" replace />;
  return children;
}

/** Enforce onboarding after authentication */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const username = localStorage.getItem('username');
  const location = useLocation();

  if (!username && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  if (username && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    document.title = `${branding.appName} – Student Learning`;
    const savedTheme = localStorage.getItem('user_theme') || 'light-blue';
    const savedFont  = localStorage.getItem('user_font')  || 'sans-serif';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-font', savedFont);
    setInitDone(true);
  }, []);

  if (!initDone) return null;

  return (
    <Routes>
      {/* ── Public: Login ── */}
      <Route path="/login" element={
        <GuestOnly>
          <Login />
        </GuestOnly>
      } />

      {/* /expert route disabled for MVP — re-enable by uncommenting ExpertDashboard import above */}

      {/* ── Onboarding (authenticated but no profile yet) ── */}
      <Route path="/onboarding" element={
        <AuthGuard>
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        </AuthGuard>
      } />

      {/* ── Main app (authenticated + onboarded) ── */}
      <Route element={<Layout />}>
        <Route path="/" element={
          <AuthGuard>
            <ProtectedRoute>
              <ClassSubjectSelection />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/dashboard" element={
          <AuthGuard>
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/subjects" element={
          <AuthGuard>
            <ProtectedRoute>
              <Subjects />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/subjects/:subjectId" element={
          <AuthGuard>
            <ProtectedRoute>
              <ChapterList />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/subjects/:subjectId/chapter/:chapterNumber" element={
          <AuthGuard>
            <ProtectedRoute>
              <ResourceTabs />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/profile" element={
          <AuthGuard>
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/leaderboard" element={
          <AuthGuard>
            <ProtectedRoute>
              <GlobalLeaderboard />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/persona" element={
          <AuthGuard>
            <ProtectedRoute>
              <PersonaSelection />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/chapters" element={
          <AuthGuard>
            <ProtectedRoute>
              <ChapterList />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="/study-table" element={
          <AuthGuard>
            <ProtectedRoute>
              <StudyTable />
            </ProtectedRoute>
          </AuthGuard>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
