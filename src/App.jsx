// 루트 App 컴포넌트 — React Router + Lazy Loading + Toast
import { useState, Suspense, lazy, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getAuthToken, clearAuthToken } from './lib/api';
import useTheme from './hooks/useTheme';
import { ToastProvider } from './components/ui/Toast';
import ImageModal from './components/ui/ImageModal';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import LoginPage from './pages/LoginPage';

// 이미지 모달 전역 Context
const ImageModalContext = createContext(null);
export function useImageModal() { return useContext(ImageModalContext); }

// 카테고리 전역 Context
const CategoryContext = createContext({ categoryId: '', setCategoryId: () => {} });
export function useGlobalCategory() { return useContext(CategoryContext); }

// 탭별 Lazy Loading
const QuizTab = lazy(() => import('./tabs/QuizTab'));
const ManageTab = lazy(() => import('./tabs/ManageTab'));
const ImportTab = lazy(() => import('./tabs/ImportTab'));
const SettingsTab = lazy(() => import('./tabs/SettingsTab'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppLayout({ onLogout, theme, onToggleTheme, categoryId, onCategoryChange }) {
  return (
    <div className="min-h-screen pb-20 safe-pb">
      <Header onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} categoryId={categoryId} onCategoryChange={onCategoryChange} />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/quiz" replace />} />
            <Route path="/quiz" element={<QuizTab />} />
            <Route path="/manage" element={<ManageTab />} />
            <Route path="/import" element={<ImportTab />} />
            <Route path="/settings" element={<SettingsTab />} />
            <Route path="*" element={<Navigate to="/quiz" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!getAuthToken());
  const [modalImage, setModalImage] = useState(null);
  const [categoryId, setCategoryId] = useState(() => localStorage.getItem('globalCategoryId') || '');
  const { theme, toggleTheme } = useTheme();

  const handleCategoryChange = (val) => {
    setCategoryId(val);
    localStorage.setItem('globalCategoryId', val);
  };

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => { clearAuthToken(); setIsLoggedIn(false); };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ImageModalContext.Provider value={setModalImage}>
          <CategoryContext.Provider value={{ categoryId, setCategoryId: handleCategoryChange }}>
            {!isLoggedIn ? (
              <LoginPage onLogin={handleLogin} />
            ) : (
              <AppLayout onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} categoryId={categoryId} onCategoryChange={handleCategoryChange} />
            )}
          </CategoryContext.Provider>
          <ImageModal src={modalImage} onClose={() => setModalImage(null)} />
        </ImageModalContext.Provider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
