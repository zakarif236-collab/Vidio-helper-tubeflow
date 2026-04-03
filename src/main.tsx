import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StudioPage from './pages/StudioPage';
import SettingsPage from './pages/SettingsPage';
import CreatorLabPage from './pages/CreatorLabPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/idea-to-video" element={<Navigate to="/studio" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/creator-lab" element={<CreatorLabPage />} />
        <Route path="/tools" element={<Navigate to="/studio" replace />} />
        <Route path="/tools/auto-chapters" element={<Navigate to="/studio" replace />} />
        <Route path="/tools/ai-summary" element={<Navigate to="/studio" replace />} />
        <Route path="/tools/topic-detector" element={<Navigate to="/studio" replace />} />
        <Route path="/tools/highlight-finder" element={<Navigate to="/studio" replace />} />
        <Route path="/tools/seo-generator" element={<Navigate to="/studio" replace />} />
        <Route path="/tools/transcript-gen" element={<Navigate to="/studio" replace />} />
        <Route path="/tools/social-captions" element={<Navigate to="/studio" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
