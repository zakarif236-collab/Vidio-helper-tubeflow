import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StudioPage from './pages/StudioPage';
import SettingsPage from './pages/SettingsPage';
import CreatorLabPage from './pages/CreatorLabPage';
import ToolsPage from './pages/ToolsPage';
import AutoChaptersPage from './pages/AutoChaptersPage';
import AISummaryPage from './pages/AISummaryPage';
import TopicDetectorPage from './pages/TopicDetectorPage';
import HighlightFinderPage from './pages/HighlightFinderPage';
import SEOGeneratorPage from './pages/SEOGeneratorPage';
import TranscriptGenPage from './pages/TranscriptGenPage';
import SocialCaptionsPage from './pages/SocialCaptionsPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/creator-lab" element={<CreatorLabPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/tools/auto-chapters" element={<AutoChaptersPage />} />
        <Route path="/tools/ai-summary" element={<AISummaryPage />} />
        <Route path="/tools/topic-detector" element={<TopicDetectorPage />} />
        <Route path="/tools/highlight-finder" element={<HighlightFinderPage />} />
        <Route path="/tools/seo-generator" element={<SEOGeneratorPage />} />
        <Route path="/tools/transcript-gen" element={<TranscriptGenPage />} />
        <Route path="/tools/social-captions" element={<SocialCaptionsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
