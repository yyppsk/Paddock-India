import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api.js';
import { AdminPanel } from './components/AdminPanel.jsx';
import { AuthPage } from './components/AuthPage.jsx';
import { EnvironmentControls } from './components/EnvironmentControls.jsx';
import { LoadingScreen } from './components/LoadingScreen.jsx';
import { RaceHud } from './components/RaceHud.jsx';
import { RouteNavigation } from './components/RouteNavigation.jsx';
import { StoryPanels } from './components/StoryPanels.jsx';
import { DEFAULT_CONTENT_SECTIONS, normalizeSections } from './contentDefaults.js';
import { initRaceExperience, syncRaceExperienceContent } from './raceExperience.js';

export function App() {
  const route = useBrowserRoute();
  const [sections, setSections] = useState(() => normalizeSections(DEFAULT_CONTENT_SECTIONS));

  useEffect(() => {
    let alive = true;

    apiRequest('/api/content/public')
      .then((result) => {
        if (alive) setSections(normalizeSections(result.sections));
      })
      .catch(() => {
        if (alive) setSections(normalizeSections(DEFAULT_CONTENT_SECTIONS));
      });

    return () => {
      alive = false;
    };
  }, []);

  const authMode = getAuthMode(route.pathname);

  if (authMode) {
    return <AuthPage mode={authMode} />;
  }

  if (route.pathname.startsWith('/admin')) {
    return <AdminPanel />;
  }

  return (
    <RaceExperience sections={sections} />
  );
}

function RaceExperience({ sections }) {
  useEffect(() => initRaceExperience(), []);
  useEffect(() => {
    syncRaceExperienceContent();
  }, [sections]);

  return (
    <div id="app" className="relative min-h-screen text-paper">
      <canvas id="race-canvas" aria-label="Scroll-driven Spa-Francorchamps race scene"></canvas>
      <RouteNavigation sections={sections} />
      <EnvironmentControls />
      <StoryPanels sections={sections} />
      <RaceHud />
      <LoadingScreen />
    </div>
  );
}

function useBrowserRoute() {
  const [path, setPath] = useState(() => `${window.location.pathname}${window.location.search}`);

  useEffect(() => {
    const update = () => setPath(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  return useMemo(() => ({ pathname: window.location.pathname, search: window.location.search, path }), [path]);
}

function getAuthMode(pathname) {
  if (pathname === '/login') return 'login';
  if (pathname === '/admin/login') return 'admin-login';
  if (pathname === '/signup') return 'signup';
  if (pathname === '/forgot-password') return 'forgot';
  if (pathname === '/reset-password') return 'reset';
  if (pathname === '/verify-email') return 'verify';
  return '';
}
