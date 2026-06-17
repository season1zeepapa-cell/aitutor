// 현재 사용자가 보고 있는 KISA 챕터(chapter_code)를 전역 공유하는 경량 store
// - 풀이 화면(DrillSession)·이론학습(StudyDetail)이 setCurrentChapter 로 현재 주제를 등록
// - 전역 플로팅 '자료 라이브러리'(LibraryFab)가 useCurrentChapter 로 읽어 현재 주제 키워드로 조회
// - Context/Provider 없이 useSyncExternalStore 로 필요한 컴포넌트만 구독 (불필요한 리렌더 방지)
import { useSyncExternalStore } from 'react';

let currentChapter = null;        // 현재 주제 chapter_code (예: 'IMP-IV-01'), 없으면 null
const listeners = new Set();

// 현재 주제 등록/해제 — 화면이 마운트/언마운트될 때 호출
export function setCurrentChapter(chapterCode) {
  const next = chapterCode || null;
  if (next === currentChapter) return; // 동일하면 알림 생략
  currentChapter = next;
  listeners.forEach((l) => l());
}

// 현재 주제 구독 (string chapter_code | null)
export function useCurrentChapter() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentChapter,
    () => currentChapter
  );
}
