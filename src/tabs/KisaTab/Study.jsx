// KISA 학습 자료 목록 — /kisa/study
// 69개 챕터를 설계/구현 단계별 + 카테고리별로 그룹화 표시
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import practiceData from '../../data/kisa-practice.json';

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

// 원본 가이드(붙임3) 분류 순서 — 카테고리/항목 정렬에 사용
const CATEGORY_ORDER = {
  input_validation: 1, security_feature: 2, time_state: 3, error_handling: 4,
  code_error: 5, encapsulation: 6, api_abuse: 7, session_control: 8,
};
const chapterNum = (code) => { const m = String(code).match(/(\d+)\s*$/); return m ? +m[1] : 0; };

export default function Study() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ design: [], implementation: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 'design' | 'practice' | 'implementation' (실습 상세에서 돌아올 때 ?tab=practice 로 탭 복원)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'practice' ? 'practice' : 'design');

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

  // 카테고리별 그룹핑 + 가이드 순서 정렬 (카테고리 순서 + 항목 번호순)
  const currentChapters = activeTab === 'implementation' ? data.implementation
    : activeTab === 'design' ? data.design
    : []; // practice 탭은 별도 렌더
  const byCategory = {};
  for (const ch of currentChapters) {
    if (!byCategory[ch.category]) byCategory[ch.category] = [];
    byCategory[ch.category].push(ch);
  }
  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => (CATEGORY_ORDER[a[0]] || 99) - (CATEGORY_ORDER[b[0]] || 99))
    .map(([cat, chs]) => [cat, [...chs].sort((x, y) => chapterNum(x.chapter_code) - chapterNum(y.chapter_code))]);

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📖</span>
          <h2 className="text-base font-bold text-primary">KISA 학습 자료</h2>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          설계·구현 단계 69개 챕터의 정의·원인·대응 원칙과 취약/안전 코드 예시, 그리고 2026 교재 설계기준 실습을 학습하세요.
        </p>
        {/* 퀴즈 진입 — 그림/코드 */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/kisa/diagram-quiz')}
            className="py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
          >
            🖼️ 그림 약점퀴즈
          </button>
          <button
            onClick={() => navigate('/kisa/code-quiz')}
            className="py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
          >
            💻 코드 약점퀴즈
          </button>
        </div>
      </div>

      {/* 단계 탭 (설계단계 · 설계기준 실습 · 구현단계) */}
      <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <TabButton
          active={activeTab === 'design'}
          onClick={() => setActiveTab('design')}
          label={`📐 설계단계`}
          count={data.design.length}
        />
        <TabButton
          active={activeTab === 'practice'}
          onClick={() => setActiveTab('practice')}
          label={`📋 설계기준 실습`}
          count={practiceData.count}
        />
        <TabButton
          active={activeTab === 'implementation'}
          onClick={() => setActiveTab('implementation')}
          label={`🔧 구현단계`}
          count={data.implementation.length}
        />
      </div>

      {/* 본문: 실습 탭이면 실습 리스트, 아니면 챕터 카테고리 섹션 */}
      {activeTab === 'practice' ? (
        ['표준형', '변형형'].map((type) => {
          const list = practiceData.items.filter((it) => it.type === type);
          return (
            <div key={type} className="rounded-xl bg-card-bg border border-border p-3">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-1">
                <span>{type === '표준형' ? '📐' : '🔧'}</span>
                <span>{type === '표준형' ? '표준형 — 화면 기능별 보안설계기준' : '변형형 — 개발가이드·설정 진단'}</span>
                <span className="text-[10px] text-text-secondary">({list.length})</span>
              </h3>
              <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">
                {type === '표준형'
                  ? '회원가입·파일 업/다운로드 등 화면을 보고 적용할 보안설계기준과 중점점검항목을 학습'
                  : '개발가이드·솔트·인증서·SSRF·패스워드 등 제출물의 보안기준 부합 여부를 진단'}
              </p>
              <div className="space-y-1">
                {list.map((it) => (
                  <PracticeRow key={it.id} item={it} onClick={() => navigate(`/kisa/practice/${it.id}`)} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        sortedCategories.map(([category, chapters]) => (
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
        ))
      )}

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

function PracticeRow({ item, onClick }) {
  // "실습 01 — 제목" 에서 앞머리 제거하고 본문 제목만 표시
  const title = item.title.replace(/^실습\s*\d+\s*[—-]\s*/, '');
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-primary-light active:scale-[0.99] transition-all"
    >
      <span className="text-[10px] font-mono text-text-secondary w-12 shrink-0">
        실습{String(item.num).padStart(2, '0')}
      </span>
      <span className="flex-1 text-xs font-medium truncate">{title}</span>
      <span className="text-text-secondary text-xs shrink-0">→</span>
    </button>
  );
}
