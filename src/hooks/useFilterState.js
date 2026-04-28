// useFilterState.js — 카테고리/시험 선택 상태를 localStorage에 저장·복원
// 페이지별 key를 분리하여 각 페이지마다 독립적으로 유지
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'aitutor_filters';

function loadFilters(pageKey) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[pageKey] || null;
  } catch { return null; }
}

function saveFilters(pageKey, filters) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[pageKey] = filters;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* 무시 */ }
}

// pageKey: 'quiz' | 'random' | 'card' | 'exam' | 'manage'
export default function useFilterState(pageKey) {
  const saved = loadFilters(pageKey);

  const [categoryIds, _setCategoryIds] = useState(saved?.categoryIds || []);
  const [examIds, _setExamIds] = useState(saved?.examIds || []);

  const setCategoryIds = useCallback((ids) => {
    _setCategoryIds(ids);
    _setExamIds([]);
    saveFilters(pageKey, { categoryIds: ids, examIds: [] });
  }, [pageKey]);

  const setExamIds = useCallback((ids) => {
    _setExamIds(ids);
    saveFilters(pageKey, { categoryIds, examIds: ids });
  }, [pageKey, categoryIds]);

  return { categoryIds, setCategoryIds, examIds, setExamIds };
}
