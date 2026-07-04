// 복습(SRS) 랜딩 — /kisa/review
//   복습 예정(도래) 문항을 문제유형별·약점그룹별로 나눠 보여주고, 선택적으로 복습을 시작한다.
//   전체 복습 또는 특정 유형/그룹만 골라 복습 → /kisa/drill?srs=true(&type= | &category=)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';

// 문제유형 라벨·이모지 (registry 와 동일 톤)
const TYPE_META = {
  blank:      { emoji: '✍️', label: '단답형' },
  diagnosis4: { emoji: '🧪', label: '실기 진단' },
  composite:  { emoji: '📋', label: '복합서술형' },
  codeid:     { emoji: '💻', label: '코드식별' },
  objective:  { emoji: '📝', label: '이론 객관식' },
  shortessay: { emoji: '🖊️', label: '단순서술형' },
};
// 약점 그룹 라벨·이모지 + 표준 순서
const CAT_META = {
  input_validation: { emoji: '🔍', label: '입력데이터 검증 및 표현' },
  security_feature: { emoji: '🔐', label: '보안기능' },
  time_state:       { emoji: '⏱️', label: '시간 및 상태' },
  error_handling:   { emoji: '⚠️', label: '에러처리' },
  code_error:       { emoji: '🐛', label: '코드오류' },
  encapsulation:    { emoji: '📦', label: '캡슐화' },
  api_abuse:        { emoji: '🔧', label: 'API오용' },
  session_control:  { emoji: '🎫', label: '세션통제' },
};
const CAT_ORDER = Object.keys(CAT_META);

export default function ReviewHome() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/kisa-review?action=breakdown')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // 복습 시작 — 전체 / 유형별 / 그룹별
  const startReview = ({ type, category } = {}) => {
    const p = new URLSearchParams({ srs: 'true' });
    if (type) p.set('type', type);
    if (category) p.set('category', category);
    navigate(`/kisa/drill?${p}`);
  };

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
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => navigate('/kisa')} className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs">대시보드로</button>
      </div>
    );
  }

  const total = data?.total || 0;
  const byType = (data?.byType || []).filter((t) => t.n > 0);
  const byCategory = (data?.byCategory || [])
    .filter((c) => c.n > 0)
    .sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a.category); const ib = CAT_ORDER.indexOf(b.category);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/kisa')} className="text-text-secondary hover:text-text" aria-label="뒤로">←</button>
        <h2 className="text-base font-bold">🔁 복습 (SRS)</h2>
        <span className="ml-auto text-xs font-mono text-text-secondary">복습 예정 {total}개</span>
      </div>

      {total === 0 ? (
        <div className="rounded-xl bg-card-bg border border-border p-8 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-sm font-bold mb-1">지금 복습할 문항이 없습니다</p>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            문제를 풀고 자가평가(다시·어려움·괜찮음·쉬움)를 하면, 간격 반복 알고리즘이 정한 복습일에 여기 모입니다.
          </p>
          <button
            onClick={() => navigate('/kisa/code-drill')}
            className="mt-3 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold"
          >
            새 문제 풀러 가기 →
          </button>
        </div>
      ) : (
        <>
          {/* 전체 복습 */}
          <div className="rounded-xl bg-primary-light border border-primary/20 p-3">
            <button
              onClick={() => startReview()}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              전체 복습 시작 ({total}개) →
            </button>
            <p className="text-[11px] text-text-secondary leading-snug mt-2">
              복습 예정일이 도래한 문항을 예정일 순으로 출제합니다. 아래에서 <b>유형·그룹별로 골라</b> 복습할 수도 있어요.
            </p>
          </div>

          {/* 문제유형별 복습 */}
          {byType.length > 0 && (
            <div className="rounded-xl bg-card-bg border border-border p-3">
              <p className="text-[11px] font-bold text-text-secondary mb-2">문제유형별</p>
              <div className="grid grid-cols-2 gap-1.5">
                {byType.map((t) => {
                  const m = TYPE_META[t.type] || { emoji: '📄', label: t.type };
                  return (
                    <button
                      key={t.type}
                      onClick={() => startReview({ type: t.type })}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary-light/40 active:scale-[0.99] transition-all text-left"
                    >
                      <span className="text-base">{m.emoji}</span>
                      <span className="flex-1 text-xs font-medium truncate">{m.label}</span>
                      <span className="text-[11px] font-mono text-primary font-bold">{t.n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 약점 그룹별 복습 */}
          {byCategory.length > 0 && (
            <div className="rounded-xl bg-card-bg border border-border p-3">
              <p className="text-[11px] font-bold text-text-secondary mb-2">약점 그룹별</p>
              <div className="space-y-1.5">
                {byCategory.map((c) => {
                  const m = CAT_META[c.category] || { emoji: '📂', label: c.category };
                  return (
                    <button
                      key={c.category}
                      onClick={() => startReview({ category: c.category })}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary-light/40 active:scale-[0.99] transition-all text-left"
                    >
                      <span className="text-base">{m.emoji}</span>
                      <span className="flex-1 text-xs font-medium truncate">{m.label}</span>
                      <span className="text-[11px] font-mono text-primary font-bold">{c.n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
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
