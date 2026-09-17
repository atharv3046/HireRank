import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Existing pages
import LoginPage       from './pages/LoginPage'
import SignupPage      from './pages/SignupPage'
import DashboardPage   from './pages/DashboardPage'
import JobDetailPage   from './pages/JobDetailPage'
import UploadPage      from './pages/UploadPage'
import JobPostingsPage from './pages/JobPostingsPage'
import CandidatesPage  from './pages/CandidatesPage'
import ResumeScreeningsPage from './pages/ResumeScreeningsPage'
import CandidatePipelinePage from './pages/CandidatePipelinePage'
import SettingsPage from './pages/SettingsPage'
import AssessmentsPage from './pages/AssessmentsPage'
import AcceptInvitePage from './pages/AcceptInvitePage'

// New guest flow (Screens 1-4)
import LandingPage          from './pages/LandingPage'
import GuestTriagePage      from './pages/GuestTriagePage'
import ProcessingPage       from './pages/ProcessingPage'
import ResultsPreviewPage   from './pages/ResultsPreviewPage'
import MarketingPage        from './pages/MarketingPage'

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '') as string;

export default function App() {
  const routes = (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public / Guest ─────────────────────────────────────── */}
          <Route path="/"                      element={<MarketingPage />} />
          <Route path="/marketing"             element={<MarketingPage />} />
          <Route path="/screen"                element={<GuestTriagePage />} />
          <Route path="/processing/:sessionId" element={<ProcessingPage />} />
          <Route path="/results/:sessionId"    element={<ResultsPreviewPage />} />
          <Route path="/accept-invite"         element={<AcceptInvitePage />} />

          {/* ── Auth ───────────────────────────────────────────────── */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* ── Protected (logged-in recruiter) ────────────────────── */}
          <Route path="/dashboard"          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/resume-screenings"  element={<ProtectedRoute><ResumeScreeningsPage /></ProtectedRoute>} />
          <Route path="/assessments"        element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
          <Route path="/candidate-pipeline" element={<ProtectedRoute><CandidatePipelinePage /></ProtectedRoute>} />
          <Route path="/settings"           element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/jobs"               element={<ProtectedRoute><JobPostingsPage /></ProtectedRoute>} />
          <Route path="/jobs/:jobId"        element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
          <Route path="/jobs/:jobId/upload"  element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/candidates"         element={<ProtectedRoute><CandidatesPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'placeholder-id'}>
      {routes}
    </GoogleOAuthProvider>
  );
}
