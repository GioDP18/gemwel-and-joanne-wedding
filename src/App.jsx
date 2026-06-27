import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LegacyPage from './components/LegacyPage';
import CameraPage from './components/CameraPage';
import { PAGES, pageToRoute } from './pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/camera" element={<CameraPage />} />
        <Route path="*" element={<Navigate to="/camera" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
