// KISA 학습 자료 목록 — /kisa/study
// 69개 챕터를 설계/구현 단계별 + 카테고리별로 그룹화 표시
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';

const CATEGORY_LABEL = {
  input_validation:  '입력데이터 검증 및 표현',
  security_feature:  '보안기능',
  time_state:        '시간 및 상태',
  error_handling:    '에러처리',
  code_error:        '코드오류',
  encapsulation:     '캡슐화',
  api_abuse:         'API 오용',
  session_control:   '세션통제',
};

const CATEGORY_EMOJI = {
  input_validation: '🔍',
  security_feature: '🔐',
  time_state: '⏱️',
  error_handling: '⚠️',
  code_error: '🐛',
  encapsulation: '📦',
  api_abuse: '🔧',
  session_control: '🎫',
};

export default function Study() {
  const navigate = useNavigate();
  const [data, setData] = useState({ design: [], implementation: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('design'); // 'design' | 'implementation'

  useEffect(() => {
    (async () => {
      try {
        const result = await apiGet('/api/kisa-study?action=list');
        setData(result);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
        <p className="font-bold text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  // 카테고리별 그룹핑
  const currentChapters = activeTab === 'design' ? data.design : data.implementation;
  const byCategory = {};
  for (const ch of currentChapters) {
    if (!byCategory[ch.category]) byCategory[ch.category] = [];
    byCategory[ch.category].push(ch);
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📖</span>
          <h2 className="text-base font-bold text-primary">KISA 학습 자료</h2>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          설계·구현 단계 69개 챕터의 정의·원인·대응 원칙과 취약/안전 코드 예시를 학습하세요.
        </p>
      </div>

      {/* 단계 탭 */}
      <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <TabButton
          active={activeTab === 'design'}
          onClick={() => setActiveTab('design')}
          label={`📐 설계단계`}
          count={data.design.length}
        />
        <TabButton
          active={activeTab === 'implementation'}
          onClick={() => setActiveTab('implementation')}
          label={`🔧 구현단계`}
          count={data.implementation.length}
        />
      </div>

      {/* 카테고리 섹션들 */}
      {Object.entries(byCategory).map(([category, chapters]) => (
        <div key={category} className="rounded-xl bg-card-bg border border-border p-3">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
            <span>{CATEGORY_EMOJI[category]}</span>
            <span>{CATEGORY_LABEL[category]}</span>
            <span className="text-[10px] text-text-secondary">({chapters.length})</span>
          </h3>
          <div className="space-y-1">
            {chapters.map(ch => (
              <ChapterRow key={ch.chapter_code} chapter={ch} onClick={() => navigate(`/kisa/study/${ch.chapter_code}`)} />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={() => navigate('/kisa')}
        className="w-full py-2 rounded-lg border border-border text-sm text-text-secondary"
      >
        ← 대시보드로
      </button>
    </div>
  );
}

function TabButton({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-md text-sm font-bold transition-all ${
        active
          ? 'bg-card-bg text-primary shadow-sm'
          : 'text-text-secondary hover:text-text'
      }`}
    >
      {label} <span className="text-[10px] opacity-70">({count})</span>
    </button>
  );
}

function ChapterRow({ chapter, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-primary-light active:scale-[0.99] transition-all"
    >
      <span className="text-[10px] font-mono text-text-secondary w-20 shrink-0">
        {chapter.chapter_code}
      </span>
      <span className="flex-1 text-xs font-medium truncate">{chapter.title}</span>
      <span className="text-text-secondary text-xs shrink-0">→</span>
    </button>
  );
}
