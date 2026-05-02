import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StudioPage from './pages/StudioPage';
import SettingsPage from './pages/SettingsPage';
import CreatorLabPage from './pages/CreatorLabPage';
import './index.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [pathname]);

  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<StudioPage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/studio" element={<Navigate to="/" replace />} />
          <Route path="/idea-to-video" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/creator-lab" element={<PrivateRoute><CreatorLabPage /></PrivateRoute>} />
          <Route path="/tools" element={<Navigate to="/" replace />} />
          <Route path="/tools/auto-chapters" element={<Navigate to="/" replace />} />
          <Route path="/tools/ai-summary" element={<Navigate to="/" replace />} />
          <Route path="/tools/topic-detector" element={<Navigate to="/" replace />} />
          <Route path="/tools/highlight-finder" element={<Navigate to="/" replace />} />
          <Route path="/tools/seo-generator" element={<Navigate to="/" replace />} />
          <Route path="/tools/transcript-gen" element={<Navigate to="/" replace />} />
          <Route path="/tools/social-captions" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
