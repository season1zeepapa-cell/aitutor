// 오답 노트 — REBUILD16 §12.2-D
// 자가채점 < 70 인 최근 시도들을 question 단위로 묶어 보여줌.
// 각 카드: 챕터·약점·내 답·정답·해설 + "다시 풀기" 버튼.
//
// 데이터 출처: GET /api/kisa-review?action=wrong_notes&days=30
// 백엔드가 latest-wrong-only(중복 제거) + 카테고리 집계 동시 반환.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import kisaTrack from '../../tracks/kisa';
import { getQuestionType } from '../../components/QuestionTypes/registry';

const DAYS_OPTIONS = [
  { value: 7,   label: '최근 7일' },
  { value: 30,  label: '최근 30일' },
  { value: 90,  label: '최근 90일' },
];

export default function WrongNotes() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openItems, setOpenItems] = useState(new Set());

  useEffect(() => {
    setLoading(true);
    setError('');
    apiGet(`/api/kisa-review?action=wrong_notes&days=${days}&limit=100`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  const toggleOpen = (id) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderUserAnswer = (item) => {
    const meta = getQuestionType(item.question_type);
    if (item.question_type === 'mcq') {
      return typeof item.mcq_selected === 'number'
        ? `선택: ${item.mcq_selected + 1}번`
        : '미응답';
    }
    if (item.question_type === 'blank') {
      const arr = item.blank_answers_user || [];
      if (arr.length === 0) return '미응답';
      return arr.map(b => `#${b.idx}=${b.text || '∅'}`).join(', ');
    }
    if (item.question_type === 'diagnosis4') {
      const parts = [];
      if (typeof item.verdict_yn === 'boolean') parts.push(`판정 ${item.verdict_yn ? 'Y' : 'N'}`);
      if (Array.isArray(item.cited_lines) && item.cited_lines.length) parts.push(`라인 ${item.cited_lines.join(',')}`);
      if (item.rationale_text) parts.push(`근거 ${item.rationale_text.slice(0, 30)}…`);
      return parts.join(' · ') || '미응답';
    }
    return meta?.label || item.question_type;
  };

  const correctAnswerText = (item) => {
    if (item.question_type === 'mcq') {
      return typeof item.answer_index === 'number' ? `${item.answer_index + 1}번` : '-';
    }
    if (item.question_type === 'blank') {
      const arr = item.blank_answers || [];
      return arr.map(b => `#${b.idx}=${(b.answers || []).join('/')}`).join(', ');
    }
    if (item.question_type === 'diagnosis4') {
      return Array.isArray(item.vulnerable_lines)
        ? `취약 라인 ${item.vulnerable_lines.join(', ')}`
        : '서술형 — 모범답안 참고';
    }
    return '-';
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
        <p className="font-bold text-red-700 dark:text-red-300">불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  const items = data?.items || [];
  const byCategory = data?.by_category || [];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-amber-800 dark:text-amber-200">📝 오답 노트</h2>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded-md border border-amber-300 bg-card-bg"
          >
            {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          자가채점 70점 미만 문항 모음 — 같은 문항은 가장 최근 오답 1건만 표시
        </p>
      </div>

      {/* 카테고리별 집계 */}
      {byCategory.length > 0 && (
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <div className="text-xs font-bold text-text-secondary mb-2">약점 분류별 오답</div>
          <div className="flex flex-wrap gap-1.5">
            {byCategory.map(c => {
              const meta = kisaTrack.weaknessCategories[c.weakness_category];
              const label = meta?.label || c.weakness_category;
              const emoji = meta?.emoji || '·';
              return (
                <span key={c.weakness_category}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                  <span>{emoji}</span>
                  <span>{label}</span>
                  <span className="font-bold">{c.cnt}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 문항 카드 */}
      {items.length === 0 ? (
        <div className="rounded-xl bg-card-bg border border-border p-8 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-sm font-bold">선택한 기간에 오답이 없습니다!</p>
          <p className="text-xs text-text-secondary mt-1">계속 학습하면서 약점을 채워가세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const meta = getQuestionType(item.question_type) || {};
            const isOpen = openItems.has(item.attempt_id);
            const dateStr = new Date(item.submitted_at).toLocaleDateString('ko-KR', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            return (
              <div key={item.attempt_id} className="rounded-xl bg-card-bg border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 flex-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-light text-primary">
                      {meta.icon} {meta.label}
                    </span>
                    {item.chapter_code && (
                      <span className="text-[10px] font-mono text-text-secondary">{item.chapter_code}</span>
                    )}
                    <span className="text-[11px] text-text font-semibold truncate">
                      {item.weakness_name_ko}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-[10px] text-text-secondary">
                    <span className="text-red-600 dark:text-red-400 font-bold">{item.auto_score}점</span>
                    <span>{dateStr}</span>
                  </div>
                </div>

                <div className="text-xs text-text leading-relaxed line-clamp-2">
                  {(item.body || '').slice(0, 200)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md p-2 bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-900/40">
                    <div className="text-[10px] font-bold text-red-700 dark:text-red-400 mb-0.5">내 답</div>
                    <div className="text-text-secondary line-clamp-2">{renderUserAnswer(item)}</div>
                  </div>
                  <div className="rounded-md p-2 bg-green-50 dark:bg-green-900/15 border border-green-100 dark:border-green-900/40">
                    <div className="text-[10px] font-bold text-green-700 dark:text-green-400 mb-0.5">정답</div>
                    <div className="text-text-secondary line-clamp-2">{correctAnswerText(item)}</div>
                  </div>
                </div>

                {/* 해설 토글 */}
                {item.explanation && (
                  <>
                    <button
                      onClick={() => toggleOpen(item.attempt_id)}
                      className="text-[11px] text-primary hover:underline w-full text-left"
                    >
                      {isOpen ? '▾ 해설 숨기기' : '▸ 해설 보기'}
                    </button>
                    {isOpen && (
                      <div className="rounded-md bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/40 p-2 text-xs leading-relaxed whitespace-pre-wrap"
                           style={{ wordBreak: 'keep-all' }}>
                        {item.explanation}
                      </div>
                    )}
                  </>
                )}

                {/* 액션 — 다시 풀기 */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => navigate(`/kisa/drill?type=${item.question_type}&chapter_code=${item.chapter_code || ''}`)}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 active:scale-[0.98]"
                  >
                    🔄 이 챕터 다시 풀기
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
