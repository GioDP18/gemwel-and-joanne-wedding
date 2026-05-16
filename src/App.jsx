import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LegacyPage from './components/LegacyPage';
import CameraPage from './components/CameraPage';
import { PAGES, pageToRoute, routeToPage } from './pages';

function RouteResolver() {
  const location = useLocation();
  const page = routeToPage(location.pathname);

  if (!page) {
    return <Navigate to="/404" replace />;
  }

  return <LegacyPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/camera" element={<CameraPage />} />
        {PAGES.map((page) => (
          <Route key={page} path={pageToRoute(page)} element={<LegacyPage />} />
        ))}
        <Route path="*" element={<RouteResolver />} />
      </Routes>
    </BrowserRouter>
  );
}
