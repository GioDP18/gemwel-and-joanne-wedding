import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LegacyPage from './components/LegacyPage';
import { PAGES, pageToRoute, routeToPage } from './pages';

function RouteResolver() {
  const location = useLocation();
  const page = routeToPage(location.pathname);

  if (!page) {
    return <Navigate to="/404" replace />;
  }

  return <LegacyPage page={page} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {PAGES.map((page) => (
          <Route key={page} path={pageToRoute(page)} element={<LegacyPage page={page} />} />
        ))}
        <Route path="*" element={<RouteResolver />} />
      </Routes>
    </BrowserRouter>
  );
}
