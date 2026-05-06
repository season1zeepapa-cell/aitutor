// 루트 App 컴포넌트 — React Router + Lazy Loading + Toast
import { useState, useEffect, Suspense, lazy, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn as checkLoggedIn, clearAuth, getAuthUser } from './lib/api';
import useTheme from './hooks/useTheme';
import { ToastProvider } from './components/ui/Toast';
import ImageModal from './components/ui/ImageModal';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import LoginPage from './pages/LoginPage';
import OfflineBanner from './components/OfflineBanner';
import TutorialOverlay, { hasSeenTutorial } from './components/TutorialOverlay';
import { TRACK_IDS } from './tracks';
import { TrackProvider } from './tracks/TrackContext';

// 이미지 모달 전역 Context
const ImageModalContext = createContext(null);
export function useImageModal() { return useContext(ImageModalContext); }

// 카테고리 전역 Context
const CategoryContext = createContext({ categoryId: '', setCategoryId: () => {} });
export function useGlobalCategory() { return useContext(CategoryContext); }

// 튜토리얼 전역 Context — 어디서든 guide.open() 호출 가능
const TutorialContext = createContext({ openGuide: () => {} });
export function useTutorial() { return useContext(TutorialContext); }

// 탭별 Lazy Loading
const QuizTab = lazy(() => import('./tabs/QuizTab'));
const ManageTab = lazy(() => import('./tabs/ManageTab'));
const ImportTab = lazy(() => import('./tabs/ImportTab'));
const SettingsTab = lazy(() => import('./tabs/SettingsTab'));
// KISA 진단원 이수시험 드릴 모듈 (REBUILD13 이식)
const KisaTab = lazy(() => import('./tabs/KisaTab'));

// 학습 서브 페이지 Lazy Loading
const LearnHub = lazy(() => import('./pages/LearnHub'));
const RandomQuiz = lazy(() => import('./pages/RandomQuiz'));
const CardStudy = lazy(() => import('./pages/CardStudy'));
const BookmarkStudy = lazy(() => import('./pages/BookmarkStudy'));
const ExamMode = lazy(() => import('./pages/ExamMode'));

// REBUILD17 — 격리 모듈: 디바이스 AI(Gemma 4) 시범. lazy 라 메인 번들 영향 0
const LocalAiLab = lazy(() => import('./labs/local-ai'));

// REBUILD20/21 server-ai / server-ai-gguf 실험실 폐기 (REBUILD26 §7-1):
// 백엔드가 일심동체 Ollama forward 만 하던 legacy → /lab/server-infer (격리) 또는
// /lab/local-gcp (일심동체) 로 redirect. 디렉토리는 git rm.

// REBUILD22 §x — 격리 모듈: HF Inference Providers 실험실 (오픈 모델 라우팅)
const HfLab = lazy(() => import('./labs/hf-playground'));
// REBUILD22 §x Phase 4a — HF 비교 모드 (다중 모델 동시 호출)
const HfCompareLab = lazy(() => import('./labs/hf-playground/CompareIndex'));
// REBUILD23 — Cloud Run 일심동체 추론 (앱+모델 같은 컨테이너, 추론 엔진 교체 가능)
const LocalGcpLab = lazy(() => import('./labs/local-gcp'));

// REBUILD32 — Cloud Run 격리 추론 service (aitutor-server-infer, Ollama 단일 엔진, 16Gi/4CPU)
const ServerInferLab = lazy(() => import('./labs/server-infer'));

// REBUILD28 §11 — /lab 실험실 메인 (5 lab 카탈로그)
const LabsHome = lazy(() => import('./labs'));

// REBUILD28 §11 — 외부 Ollama bridge (사용자 PC localhost:11434 직접 호출)
const OllamaBridgeLab = lazy(() => import('./labs/ollama-bridge'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed right-4 bottom-20 z-50 w-10 h-10 rounded-full bg-primary text-white shadow-lg
        flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
      aria-label="최상단으로 이동"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    </button>
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
            <Route path="/quiz" element={<LearnHub />} />
            <Route path="/quiz/category" element={<QuizTab />} />
            <Route path="/quiz/random" element={<RandomQuiz />} />
            <Route path="/quiz/card" element={<CardStudy />} />
            <Route path="/quiz/bookmark" element={<BookmarkStudy />} />
            <Route path="/quiz/exam" element={<ExamMode />} />
            <Route path="/manage" element={getAuthUser()?.admin ? <ManageTab /> : <Navigate to="/quiz" replace />} />
            <Route path="/import" element={getAuthUser()?.admin ? <ImportTab /> : <Navigate to="/quiz" replace />} />
            <Route path="/settings" element={<SettingsTab />} />
            {/* REBUILD16 R5 — 트랙 라우팅 추상화: TRACK_IDS 가 늘어나면 자동 등록.
                현재 KISA 단독이지만, src/tracks/index.js 의 TRACKS 에 신규 트랙 추가만으로 라우트 생성됨.
                TrackProvider 가 컴포넌트에게 현재 트랙 메타를 주입 → useTrack() 으로 어디서나 접근. */}
            {TRACK_IDS.map(id => (
              <Route key={id} path={`/${id}/*`} element={
                <TrackProvider trackId={id}>
                  <KisaTab />
                </TrackProvider>
              } />
            ))}
            {/* REBUILD28 §11 — /lab 실험실 메인 (5 lab 카탈로그) */}
            <Route path="/lab" element={<LabsHome />} />
            {/* REBUILD17 — 디바이스 AI 시범 (격리 모듈, DB 플래그로 ON/OFF) */}
            <Route path="/lab/local-ai/*" element={<LocalAiLab />} />
            {/* REBUILD26 §7-1 — server-ai/server-ai-gguf 폐기. 라우트 entry 제거됨,
                옛 URL 진입 시 catch-all `*` 가 /quiz 로 보냄. */}
            <Route path="/lab/hf/compare" element={<HfCompareLab />} />
            <Route path="/lab/hf/*" element={<HfLab />} />
            <Route path="/lab/local-gcp" element={<LocalGcpLab />} />
            {/* REBUILD32 — 격리 추론 service (메인과 별도 Cloud Run, Ollama 단일 엔진) */}
            <Route path="/lab/server-infer" element={<ServerInferLab />} />
            {/* REBUILD28 §11 — 외부 Ollama bridge (사용자 PC localhost:11434 직접) */}
            <Route path="/lab/ollama-bridge" element={<OllamaBridgeLab />} />
            {/* REBUILD23 — 구 라우트 호환: 기존 즐겨찾기/북마크 유저를 위해 redirect */}
            <Route path="/lab/local-lambda" element={<Navigate to="/lab/local-gcp" replace />} />
            <Route path="*" element={<Navigate to="/quiz" replace />} />
          </Routes>
        </Suspense>
      </main>
      <ScrollToTop />
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(checkLoggedIn());
  const [modalImage, setModalImage] = useState(null);
  const [categoryId, setCategoryId] = useState(() => localStorage.getItem('globalCategoryId') || '');
  const { theme, toggleTheme } = useTheme();

  // 튜토리얼: 로그인 상태에서 첫 진입 시 자동 표시
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialTrack, setTutorialTrack] = useState(null);  // 'general' | 'kisa' | null(선택화면)
  useEffect(() => {
    if (isLoggedIn && !hasSeenTutorial()) {
      // 앱 첫 렌더 후 약간 지연해서 자동 표시 (SPA 초기 로딩 후)
      const t = setTimeout(() => {
        setTutorialTrack(null);  // 자동 표시는 트랙 선택부터
        setTutorialOpen(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [isLoggedIn]);

  // openGuide(track?) — track 생략 시 선택 화면부터, 'general'/'kisa' 지정 시 해당 트랙 바로
  const tutorialApi = {
    openGuide: (track = null) => {
      setTutorialTrack(track);
      setTutorialOpen(true);
    },
  };

  const handleCategoryChange = (val) => {
    setCategoryId(val);
    localStorage.setItem('globalCategoryId', val);
  };

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => { clearAuth(); setIsLoggedIn(false); };

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <ToastProvider>
        <ImageModalContext.Provider value={setModalImage}>
          <CategoryContext.Provider value={{ categoryId, setCategoryId: handleCategoryChange }}>
            <TutorialContext.Provider value={tutorialApi}>
              {!isLoggedIn ? (
                <LoginPage onLogin={handleLogin} />
              ) : (
                <AppLayout onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} categoryId={categoryId} onCategoryChange={handleCategoryChange} />
              )}
              {/* 튜토리얼 오버레이 (로그인 상태에서만 작동) */}
              {isLoggedIn && (
                <TutorialOverlay
                  open={tutorialOpen}
                  initialTrack={tutorialTrack}
                  onClose={() => setTutorialOpen(false)}
                />
              )}
            </TutorialContext.Provider>
          </CategoryContext.Provider>
          <ImageModal src={modalImage} onClose={() => setModalImage(null)} />
        </ImageModalContext.Provider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
