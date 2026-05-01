// 문항 입력 공통 컴포넌트 (REBUILD29 §19 / §25 — 사용자 요청 2026-04-30)
//
// 모든 lab 페이지의 문항 입력을 통합. 두 가지 방식 지원:
//   1) 📚 DB 등록 문항 — 카테고리 → 시험 → 문제 카드 리스트 (특정 문제까지 선택)
//   2) 📋 직접 붙여넣기 — 자유 텍스트 + 자동 파싱
//
// 사용:
//   <QuestionPicker question={question} onChange={setQuestion} />
//
// 부모는 question 상태만 관리 (구조: { body, choices, answer, ... }).

import { useEffect, useState, useMemo } from 'react';
import QuestionPreview from './QuestionPreview';
import { parseQuestionText, isValidQuestion } from '../../lib/lab/parseQuestion';

const TABS = [
  { id: 'db',    label: '📚 DB 등록 문항', desc: '카테고리 → 시험 → 문제 선택' },
  { id: 'paste', label: '📋 직접 붙여넣기', desc: '외부에서 복사한 텍스트 자동 파싱' },
];

const PAGE_SIZE = 10;

export default function QuestionPicker({ question, onChange, defaultTab = 'db', defaultExamId = 161 }) {
  const [tab, setTab] = useState(defaultTab);
  const [open, setOpen] = useState(!isValidQuestion(question));

  // ─── DB 모드 상태 (REBUILD29 §25 — 계층 선택) ──────
  const [categories, setCategories] = useState([]);
  const [exams, setExams] = useState([]);
  const [categoryId, setCategoryId] = useState(null);  // null = 전체
  const [examId, setExamId] = useState(defaultExamId);
  const [questions, setQuestions] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [page, setPage] = useState(1);
  const [dbError, setDbError] = useState('');

  // ─── 붙여넣기 모드 상태 ────────────────────
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [pasteParsed, setPasteParsed] = useState(null);

  // ─── DB 모드 — categories + exams 메타 로드 (한 번) ──────
  useEffect(() => {
    if (tab !== 'db' || (exams.length && categories.length)) return;
    fetch('/api/questions?action=public', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        if (Array.isArray(d.exams)) setExams(d.exams);
        if (Array.isArray(d.categories)) setCategories(d.categories);
      })
      .catch(() => {});
  }, [tab, exams.length, categories.length]);

  // 카테고리 선택 시 첫 시험 자동
  const filteredExams = useMemo(() => {
    if (!categoryId) return exams;
    return exams.filter(e => e.category_id === categoryId);
  }, [exams, categoryId]);

  // REBUILD30 §17 — 카테고리별 시험 갯수 (dropdown label 에 표시).
  const examCountByCategory = useMemo(() => {
    const map = {};
    for (const e of exams) {
      const cid = e.category_id;
      if (cid != null) map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [exams]);

  // REBUILD30 §17 — 카테고리 변경 시 시험이 0개면 examId 해제 (잘못된 fallback 방지).
  useEffect(() => {
    if (!categoryId) return;
    if (filteredExams.length === 0) {
      setExamId(null);  // null 이면 시험 dropdown 비활성, 문항 목록 안 부름
      setQuestions([]);
      return;
    }
    // 카테고리 변경 시 첫 시험으로
    if (!filteredExams.find(e => e.id === examId)) {
      setExamId(filteredExams[0].id);
    }
  }, [categoryId, filteredExams, examId]);

  // ─── DB 모드 — exam_id 변경 시 문항 목록 로드 ──
  useEffect(() => {
    if (tab !== 'db' || !examId) return;
    setLoadingDb(true);
    setDbError('');
    setPage(1);  // 시험 변경 시 첫 페이지
    fetch(`/api/questions?action=public&exam_id=${examId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        // REBUILD30 §17 — DB 의 choices 가 [{num, text}, ...] 객체 배열이라 React error #31 발생.
        // 모든 lab 의 통일 형식 = string[] 으로 정규화 (paste 모드와 일치).
        const list = (d.questions || []).map(q => {
          let arr = q.choices;
          if (!Array.isArray(arr)) {
            try { arr = JSON.parse(arr || '[]'); } catch { arr = []; }
          }
          const choices = arr.map(c =>
            (c && typeof c === 'object') ? String(c.text ?? c.num ?? '') : String(c ?? '')
          );
          return { ...q, choices };
        });
        setQuestions(list);
      })
      .catch(e => setDbError(`문항 로드 실패: ${e.message}`))
      .finally(() => setLoadingDb(false));
  }, [tab, examId]);

  const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const pagedQuestions = questions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pickRandom = () => {
    if (!questions.length) return;
    const r = questions[Math.floor(Math.random() * questions.length)];
    onChange?.({ ...r, _source: 'db' });
    setOpen(false);
  };

  const pickQuestion = (q) => {
    onChange?.({ ...q, _source: 'db' });
    setOpen(false);
  };

  // 본문 첫 30자만 미리보기
  const truncate = (s, n = 50) => {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
  };

  // ─── 붙여넣기 모드 — 파싱 ──────────────────
  const handleParse = () => {
    setPasteError('');
    const parsed = parseQuestionText(pasteText);
    setPasteParsed(parsed);
    if (parsed.parseError && parsed.parseError !== '정답 표시 미발견 (선택 사항)') {
      setPasteError(parsed.parseError);
    }
  };

  const applyPaste = () => {
    if (!pasteParsed || !isValidQuestion(pasteParsed)) {
      setPasteError('파싱 결과 부적합 — 본문 + 보기 2개 이상 필요');
      return;
    }
    onChange?.({
      body: pasteParsed.body,
      choices: pasteParsed.choices,
      answer: pasteParsed.answer || 1,
      answer_extra: pasteParsed.answer_extra || null,
      _source: 'paste',
    });
    setOpen(false);
  };

  const clearQuestion = () => onChange?.(null);

  return (
    <div className="rounded-xl border border-border bg-card-bg">
      {/* 헤더 — 펼침 토글 */}
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-text"
      >
        <span>📝 문항 입력 {isValidQuestion(question) && <span className="text-[10px] text-text-secondary font-normal">— 선택됨</span>}</span>
        <span className="text-text-secondary">{open ? '접기 ▲' : '바꾸기 ▼'}</span>
      </button>

      {/* 펼친 상태: 탭 + 입력 영역 */}
      {open && (
        <div className="px-3 pb-3 border-t border-border space-y-3">
          {/* 탭 */}
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`text-left rounded-lg border-2 px-2.5 py-1.5 transition-all ${
                  tab === t.id
                    ? 'border-primary bg-primary/10 text-text'
                    : 'border-border bg-card-bg text-text-secondary hover:border-primary/40'
                }`}
              >
                <p className="text-xs font-bold">{t.label}</p>
                <p className="text-[10px] opacity-70">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* DB 모드 — REBUILD29 §25 계층 선택 */}
          {tab === 'db' && (
            <div className="space-y-2">
              {/* 1) 카테고리 선택 — REBUILD30 §17 시험 갯수 (N) 표시 */}
              {categories.length > 0 && (
                <label className="flex flex-col gap-1 text-[11px]">
                  <span className="text-text-secondary">카테고리 (필터, 선택)</span>
                  <select
                    value={categoryId || ''}
                    onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                    className="rounded px-2 py-1.5 border border-border bg-bg text-text text-sm"
                  >
                    <option value="">전체 ({exams.length})</option>
                    {categories.map(c => {
                      const n = examCountByCategory[c.id] || 0;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({n}){n === 0 ? ' — 시험 없음' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              {/* 2) 시험 선택 — REBUILD30 §17 빈 카테고리 시 안내 + 비활성화 */}
              <label className="flex flex-col gap-1 text-[11px]">
                <span className="text-text-secondary">
                  시험 선택 ({filteredExams.length}개)
                </span>
                {filteredExams.length === 0 ? (
                  <div className="rounded px-2 py-1.5 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 text-[11px]">
                    ⚠ 이 카테고리에 등록된 시험이 없습니다. 다른 카테고리를 선택해 주세요.
                  </div>
                ) : (
                  <select
                    value={examId || ''}
                    onChange={e => setExamId(Number(e.target.value))}
                    className="rounded px-2 py-1.5 border border-border bg-bg text-text text-sm"
                  >
                    {filteredExams.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.title}{e.category_name ? ` · ${e.category_name}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              {/* 3) 무작위 또는 직접 선택 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={pickRandom}
                  disabled={loadingDb || !questions.length}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold"
                >
                  {loadingDb ? '로드 중…' : `↻ 무작위 (전체 ${questions.length})`}
                </button>
                <span className="text-[10px] text-text-secondary">또는 아래 목록에서 직접</span>
              </div>

              {/* 4) 문제 카드 리스트 + 페이지네이션 */}
              {questions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="rounded-lg border border-border bg-card-bg max-h-[280px] overflow-y-auto divide-y divide-border">
                    {pagedQuestions.map(q => {
                      const isSelected = question?.id === q.id || question?.question_number === q.question_number;
                      return (
                        <button
                          key={q.id || q.question_number}
                          type="button"
                          onClick={() => pickQuestion(q)}
                          className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-primary/5 transition-colors ${
                            isSelected ? 'bg-primary/10' : ''
                          }`}
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-mono text-text-secondary flex-shrink-0">
                              #{q.question_number}
                            </span>
                            <span className="text-text leading-snug">{truncate(q.body, 60)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between text-[10px] text-text-secondary px-1">
                      <button
                        type="button"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-2 py-0.5 rounded border border-border disabled:opacity-30"
                      >
                        ← 이전
                      </button>
                      <span>{page} / {totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-2 py-0.5 rounded border border-border disabled:opacity-30"
                      >
                        다음 →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {dbError && (
                <p className="text-[11px] text-danger">⚠ {dbError}</p>
              )}
            </div>
          )}

          {/* 붙여넣기 모드 */}
          {tab === 'paste' && (
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-[11px]">
                <span className="text-text-secondary">
                  외부에서 복사한 문항 텍스트 — 보기 ① ② ③ ④ + 정답 표시 자동 인식
                </span>
                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={`예시:
다음 중 전기자동차 충전 방법으로 적절하지 않은 것은?

① 충전할 때는 규격에 맞는 충전기와 어댑터를 사용한다.
② 충전 중에는 충전 커넥터를 임의로 분리하지 않고 종료 버튼으로 종료한다.
③ 젖은 손으로 충전기 사용을 하지 않고 충전장치에 물이 들어가지 않도록 주의한다.
④ 빠른 충전을 위해 비표준 변압기를 사용한다.

정답: ④`}
                  className="rounded px-2 py-1.5 border border-border bg-bg text-text text-xs font-mono leading-relaxed"
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={!pasteText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold"
                >
                  ✨ 파싱 시도
                </button>
                {pasteParsed && isValidQuestion(pasteParsed) && (
                  <button
                    type="button"
                    onClick={applyPaste}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    ✓ 이 문항 사용
                  </button>
                )}
              </div>

              {pasteError && (
                <p className="text-[11px] text-danger">⚠ {pasteError}</p>
              )}

              {/* 파싱 미리보기 (선택 전) */}
              {pasteParsed && isValidQuestion(pasteParsed) && (
                <div>
                  <p className="text-[10px] text-text-secondary mb-1">파싱 결과 미리보기:</p>
                  <QuestionPreview question={pasteParsed} compact />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 선택된 문항 미리보기 (항상 표시) */}
      {isValidQuestion(question) && (
        <div className="px-3 pb-3 pt-2 border-t border-border">
          <QuestionPreview question={question} onClear={clearQuestion} />
        </div>
      )}
    </div>
  );
}
