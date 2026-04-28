// KISA 탭 라우팅 허브 — /kisa/* 하위 라우트 전부 여기서 처리
// 기존 App.jsx의 Routes는 건드리지 않고, /kisa/* 한 블록만 이 컴포넌트로 위임.
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// 하위 페이지 Lazy Loading (초기 번들 최소화)
const Dashboard = lazy(() => import('./Dashboard'));
const DrillSession = lazy(() => import('./DrillSession'));
const KisaExamMode = lazy(() => import('./KisaExamMode'));
const Stats = lazy(() => import('./Stats'));
const Study = lazy(() => import('./Study'));
const StudyDetail = lazy(() => import('./StudyDetail'));
const WrongNotes = lazy(() => import('./WrongNotes'));
// 진단보고서는 v2로 이연 (kisa_reports 테이블은 유지)
// const ReportBuilder = lazy(() => import('./ReportBuilder'));
// const ReportList = lazy(() => import('./ReportList'));

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function KisaTab() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="drill" element={<DrillSession />} />
        <Route path="exam" element={<KisaExamMode />} />
        <Route path="stats" element={<Stats />} />
        <Route path="study" element={<Study />} />
        <Route path="study/:chapterCode" element={<StudyDetail />} />
        <Route path="wrong-notes" element={<WrongNotes />} />
        {/* 진단보고서는 v2로 이연 */}
        {/* <Route path="report/new" element={<ReportBuilder />} /> */}
        {/* <Route path="report/list" element={<ReportList />} /> */}
        <Route path="*" element={<Navigate to="/kisa" replace />} />
      </Routes>
    </Suspense>
  );
}
