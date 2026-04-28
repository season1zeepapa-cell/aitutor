// KISA 실전 모의고사 UI — FEATURE_SPEC §5.2
//
// 화면 흐름:
//   1. /kisa/exam 진입 → 모드 선택 (theory60 / practical100 / full3h)
//   2. 세션 시작 → POST /api/kisa-exam?action=start
//   3. 시험 진행:
//      - 타이머 (10분 미만 빨간색)
//      - 문항 네비 패널 (1✅ 2✅ 3⬜ ...)
//      - 30초마다 자동저장 (autosave)
//      - localStorage draft 백업 (네트워크 끊김 대비)
//   4. 제출 → POST /api/kisa-exam?action=submit → 성적표
//
// 기존 ExamMode.jsx는 건드리지 않음. 완전 독립 컴포넌트.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../lib/api';
import CodeBlock from '../../components/CodeBlock';
import { getQuestionType } from '../../components/QuestionTypes/registry';

const MODES = [
  {
    key: 'theory60',
    title: '이론 60분',
    desc: 'MCQ 30문항',
    emoji: '📚',
    timeMin: 60,
    count: 30,
  },
  {
    key: 'practical100',
    title: '실기 100분',
    desc: '진단형 15문항',
    emoji: '🔍',
    timeMin: 100,
    count: 15,
  },
  {
    key: 'full3h',
    title: '전체 3시간',
    desc: '이론 30 + 실기 15',
    emoji: '🎯',
    timeMin: 180,
    count: 45,
  },
];

export default function KisaExamMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('id');

  // 모드 선택 화면 (sessionId 없으면)
  if (!sessionId) return <ModeSelect onStart={(newId) => setSearchParams({ id: newId })} />;

  return <ExamSession sessionId={sessionId} onExit={() => navigate('/kisa')} />;
}

// ============================================================================
// 모드 선택 화면
// ============================================================================
function ModeSelect({ onStart }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startExam = async (mode) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/kisa-exam?action=start', { mode });
      onStart(data.session.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <h2 className="text-base font-bold text-primary mb-1">⏱️ 실전 모의고사</h2>
        <p className="text-xs text-text-secondary">
          실제 KISA 이수시험 환경과 동일한 타이머·제출 방식으로 훈련합니다. 합격선은 70점.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => startExam(m.key)}
            disabled={loading}
            className="rounded-xl border border-border bg-card-bg p-4 text-left hover:bg-primary-light hover:border-primary/40 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">{m.emoji}</div>
              <div className="flex-1">
                <div className="text-sm font-bold">{m.title}</div>
                <div className="text-xs text-text-secondary">{m.desc}</div>
              </div>
              <div className="text-primary text-sm font-bold">시작 →</div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-text-secondary text-center">
        💡 30초마다 자동저장됩니다. 네트워크가 끊겨도 브라우저에 임시 저장돼요.
      </p>
    </div>
  );
}

// ============================================================================
// 시험 진행 화면
// ============================================================================
function ExamSession({ sessionId, onExit }) {
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const lastSaveAt = useRef(0);
  const draftKey = `kisa-exam-draft-${sessionId}`;

  // 1) 세션 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet(`/api/kisa-exam?action=session&id=${sessionId}`);
        setSession(data.session);
        setQuestions(data.questions);
        setRemainingSec(data.session.remaining_sec);
        // localStorage draft가 있으면 병합 (서버보다 최신일 수도 있음)
        const draft = localStorage.getItem(draftKey);
        const parsed = draft ? JSON.parse(draft) : {};
        setAnswers({ ...(data.session.answers || {}), ...parsed });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, draftKey]);

  // 2) 타이머
  useEffect(() => {
    if (!session || session.state !== 'in_progress') return;
    const t = setInterval(() => {
      setRemainingSec(s => {
        if (s <= 1) {
          clearInterval(t);
          handleSubmit(true); // 자동 제출
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // 3) 자동저장 (30초 간격)
  useEffect(() => {
    if (!session || session.state !== 'in_progress') return;

    // localStorage는 매번 저장
    localStorage.setItem(draftKey, JSON.stringify(answers));

    // 서버 자동저장은 마지막 저장 후 30초 경과 시에만
    const t = setTimeout(async () => {
      const now = Date.now();
      if (now - lastSaveAt.current >= 30 * 1000) {
        try {
          await apiPost(`/api/kisa-exam?action=autosave&id=${sessionId}`, { answers });
          lastSaveAt.current = now;
        } catch (e) {
          console.warn('[Exam] 자동저장 실패:', e.message);
        }
      }
    }, 500);
    return () => clearTimeout(t);
  }, [answers, session, sessionId, draftKey]);

  // 4) 답안 업데이트 헬퍼
  const updateAnswer = (questionId, patch) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), ...patch },
    }));
  };

  // 5) 제출
  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting) return;
    if (!autoSubmit && !window.confirm('시험을 제출하시겠습니까? 제출 후에는 답안을 수정할 수 없습니다.')) {
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiPost(`/api/kisa-exam?action=submit&id=${sessionId}`, { answers });
      setResult(data);
      localStorage.removeItem(draftKey);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }, [answers, sessionId, submitting, draftKey]);

  // 6) 렌더
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
        <p className="font-bold text-red-700 dark:text-red-300 mb-1">⚠️ 오류</p>
        <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button onClick={onExit} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs">
          대시보드로
        </button>
      </div>
    );
  }

  // 제출 결과 화면
  if (result || session.state === 'submitted') {
    return <ResultView result={result} session={session} onExit={onExit} />;
  }

  if (!questions.length) return <div>문항이 없습니다.</div>;

  const current = questions[currentIdx];
  const currentAnswer = answers[current.id] || {};
  const isLowTime = remainingSec < 10 * 60;

  return (
    <div className="space-y-3">
      {/* 상단 고정 헤더 — 타이머 + 진행률 */}
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold font-mono ${isLowTime ? 'text-red-600 animate-pulse' : 'text-primary'}`}>
            ⏰ {formatTime(remainingSec)}
          </span>
          <span className="text-xs text-text-secondary ml-2">
            {currentIdx + 1} / {questions.length}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"
          >
            {submitting ? '제출 중...' : '제출'}
          </button>
        </div>

        {/* 문항 네비 — 답안 상태 표시 */}
        <div className="flex flex-wrap gap-1 mt-2 max-h-16 overflow-y-auto">
          {questions.map((q, idx) => {
            const ans = answers[q.id] || {};
            // REBUILD16 R3 — registry 의 hasAnswer 헬퍼로 분기 통합
            const meta = getQuestionType(q.question_type);
            const hasAnswer = meta?.hasAnswer ? meta.hasAnswer(ans) : false;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                className={`w-7 h-7 rounded-md text-[11px] font-bold transition-colors ${
                  idx === currentIdx
                    ? 'bg-primary text-white ring-2 ring-primary/40'
                    : hasAnswer
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-text-secondary'
                }`}
                aria-label={`문항 ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* 현재 문항 */}
      <QuestionBody
        question={current}
        answer={currentAnswer}
        onChange={(patch) => updateAnswer(current.id, patch)}
      />

      {/* 이전/다음 네비 */}
      <div className="flex gap-2">
        <button
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex-1 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-50"
        >
          ← 이전
        </button>
        <button
          onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
          disabled={currentIdx === questions.length - 1}
          className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

// 문항 본문 — REBUILD16 R3: registry 의 ExamBody 컴포넌트로 분기
function QuestionBody({ question, answer, onChange }) {
  const meta = getQuestionType(question.question_type) || {};
  const ExamBody = meta.ExamBody;
  return (
    <div className="rounded-xl bg-card-bg border border-border p-3 space-y-3">
      <div className="flex flex-wrap gap-1">
        <Tag>{question.weakness_name_ko}</Tag>
        <Tag variant="blue">{question.language}</Tag>
        <Tag variant="amber">{question.difficulty}</Tag>
        <Tag variant="neutral">{meta.label || question.question_type}</Tag>
      </div>

      <div className="text-sm leading-relaxed whitespace-pre-wrap">{question.body}</div>

      {question.vulnerable_code && (
        <CodeBlock
          code={question.vulnerable_code}
          language={question.code_language || question.language}
          citedLines={meta.needsCodeBlockInteraction ? (answer.cited_lines || []) : []}
          onLineClick={meta.needsCodeBlockInteraction ? (lines) => onChange({ cited_lines: lines }) : null}
        />
      )}

      {ExamBody ? (
        <ExamBody question={question} answer={answer} onChange={onChange} />
      ) : (
        <div className="text-xs text-text-secondary">지원하지 않는 문제 유형: {question.question_type}</div>
      )}
    </div>
  );
}

// 제출 결과 화면
function ResultView({ result, session, onExit }) {
  const total = result?.total_score ?? session?.total_score ?? 0;
  const theory = result?.theory_score ?? session?.theory_score;
  const practical = result?.practical_score ?? session?.practical_score;
  const passed = total >= 70;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-6 text-center text-white ${passed ? 'bg-green-500' : 'bg-red-500'}`}>
        <div className="text-2xl mb-1">{passed ? '🎉' : '📝'}</div>
        <div className="text-sm opacity-90">종합 점수</div>
        <div className="text-5xl font-bold my-2">{total}점</div>
        <div className="text-sm font-bold">
          {passed ? '합격선(70점) 달성!' : `합격까지 ${70 - total}점 부족`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {theory !== null && theory !== undefined && (
          <div className="rounded-xl bg-card-bg border border-border p-3 text-center">
            <div className="text-xs text-text-secondary">이론</div>
            <div className="text-2xl font-bold">{theory}</div>
          </div>
        )}
        {practical !== null && practical !== undefined && (
          <div className="rounded-xl bg-card-bg border border-border p-3 text-center">
            <div className="text-xs text-text-secondary">실기</div>
            <div className="text-2xl font-bold">{practical}</div>
          </div>
        )}
      </div>

      <button
        onClick={onExit}
        className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm"
      >
        대시보드로 돌아가기
      </button>
    </div>
  );
}

// REBUILD16 R3 — BlankTemplate, ExamPill 등 유형별 본문 렌더링 함수는
// components/QuestionTypes/exam/* 로 이전됨.

// ============================================================================
// 유틸
// ============================================================================
function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Tag({ children, variant = 'primary' }) {
  const styles = {
    primary: 'bg-primary-light text-primary',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    neutral: 'bg-neutral-100 dark:bg-neutral-800 text-text-secondary',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}

// ExamPill 은 components/QuestionTypes/exam/DiagnosisExamBody.jsx 로 이전됨
