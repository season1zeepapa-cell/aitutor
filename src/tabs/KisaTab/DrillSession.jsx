// KISA 드릴 세션 — /kisa/drill
// URL 쿼리: ?type=mcq|diagnosis4&category=&language=&difficulty=&srs=true
//
// 화면 구성 (FEATURE_SPEC §5.1):
//   상단: 진행률 + 약점 배지 + 언어/난이도 배지
//   본문: question_type에 따라 McqCard 또는 DiagnosisCard
//   제출 후: ResultOverlay (점수 + 모범답안 + 자가평가 4버튼)
//
// 세션 중 상태 관리는 useState + 내부 queue로 처리. 전역 Context 추가하지 않음.
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../lib/api';
import { getQuestionType } from '../../components/QuestionTypes/registry';
import ResultOverlay from './ResultOverlay';

const CATEGORY_LABELS = {
  input_validation: '입력검증',
  security_feature: '보안기능',
  time_state: '시간·상태',
  error_handling: '에러처리',
  code_error: '코드오류',
  encapsulation: '캡슐화',
  api_abuse: 'API오용',
};

export default function DrillSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 세션 설정 (쿼리 파라미터)
  const type = searchParams.get('type') || 'diagnosis4';
  const stage = searchParams.get('stage') || '';
  const category = searchParams.get('category') || '';
  const language = searchParams.get('language') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const chapterCode = searchParams.get('chapter_code') || '';
  const srsOnly = searchParams.get('srs') === 'true';

  // 세션 상태
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // total: 진입 시 API 호출로 실제 사용 가능한 문항 수 조회 후 설정
  // chapter_code가 있으면 해당 챕터 수, 없으면 최소(전체, 10)
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [seenIds, setSeenIds] = useState([]);                       // 중복 방지
  const [startedAt, setStartedAt] = useState(Date.now());

  // 제출 결과 (오버레이 표시용)
  const [result, setResult] = useState(null);

  const fetchNextQuestion = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setStartedAt(Date.now());
    try {
      const params = new URLSearchParams({ action: 'next' });
      if (type) params.set('type', type);
      if (stage) params.set('stage', stage);
      if (category) params.set('category', category);
      if (language) params.set('language', language);
      if (difficulty) params.set('difficulty', difficulty);
      if (chapterCode) params.set('chapter_code', chapterCode);
      if (srsOnly) params.set('srs', 'true');
      if (seenIds.length > 0) params.set('exclude_ids', seenIds.join(','));

      const data = await apiGet(`/api/kisa-drill?${params}`);
      setQuestion(data.question);
    } catch (e) {
      setError(e.message);
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [type, stage, category, language, difficulty, chapterCode, srsOnly, seenIds]);

  // 최초 진입 시 total 수 조회 + 첫 문항 로드
  useEffect(() => {
    (async () => {
      try {
        // 1) 필터에 맞는 총 문항 수 조회
        const countParams = new URLSearchParams({ action: 'count' });
        if (type) countParams.set('type', type);
        if (stage) countParams.set('stage', stage);
        if (category) countParams.set('category', category);
        if (language) countParams.set('language', language);
        if (difficulty) countParams.set('difficulty', difficulty);
        if (chapterCode) countParams.set('chapter_code', chapterCode);
        if (srsOnly) countParams.set('srs', 'true');

        const countData = await apiGet(`/api/kisa-drill?${countParams}`);
        const available = countData.total || 0;

        // 챕터 지정이 있으면 그 수 그대로, 없으면 min(전체, 10)
        const sessionTotal = chapterCode ? available : Math.min(available, 10);
        setProgress({ done: 0, total: sessionTotal });

        if (sessionTotal === 0) {
          setError('조건에 맞는 문항이 없습니다.');
          setLoading(false);
          return;
        }
      } catch (e) {
        // count 실패 시에도 기본값으로 진행
        console.warn('[Drill] count 실패:', e.message);
        setProgress({ done: 0, total: 10 });
      }

      // 2) 첫 문항 로드
      await fetchNextQuestion();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 답안 제출
  const handleSubmit = async (answer) => {
    if (!question) return;
    try {
      const timeSpent = Math.round((Date.now() - startedAt) / 1000);
      const payload = {
        question_id: question.id,
        mode: 'drill',
        time_spent_sec: timeSpent,
        ...answer, // mcq_selected / verdict_yn / cited_lines / rationale_text / fix_text / fix_code
      };
      const data = await apiPost('/api/kisa-attempt', payload);
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
  };

  // 자가평가 후 다음 문항으로
  const handleSelfGrade = async (selfGrade) => {
    if (!question || !result) return;
    try {
      // self_grade만 추가로 전송 (attempt UPSERT 아닌 새 호출 — FEATURE_SPEC에서는 단일 호출이지만
      // UX상 "결과 확인 후 평가" 흐름이므로 2단계로 분리)
      await apiPost('/api/kisa-attempt', {
        question_id: question.id,
        mode: 'drill',
        self_grade: selfGrade,
        // 이미 저장된 답안을 그대로 다시 전송 (attempt row는 2개 생기지만 마지막이 의미 있음)
        ...(question.question_type === 'mcq' ? {} : {
          verdict_yn: result.user_verdict_yn,
          cited_lines: result.user_cited_lines,
        }),
      });
    } catch (e) {
      // SRS 갱신 실패는 치명적이지 않음 - 로그만 남기고 진행
      console.warn('[Drill] SRS 갱신 실패:', e.message);
    }

    // 세션 상태 업데이트 후 다음 문항
    setSeenIds(prev => [...prev, question.id]);
    setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    if (progress.done + 1 >= progress.total) {
      // 세션 완료 → 대시보드로
      alert(`세션 완료! ${progress.total}문항 학습하셨습니다.`);
      navigate('/kisa');
    } else {
      fetchNextQuestion();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    // 조건에 맞는 문항이 없다 = 해당 범위 문제 완주 OR 미등록
    const isNoMore = error.includes('없습니다');

    if (isNoMore && chapterCode) {
      // 챕터 지정 세션이 문제 소진 → 완주 화면
      return (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="font-bold text-green-700 dark:text-green-300 mb-1 text-base">
            이 챕터의 모든 문제를 풀었습니다!
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mb-3">
            챕터 <span className="font-mono">{chapterCode}</span> 학습 자료로 돌아가 다음 단계로 진행하세요.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigate(`/kisa/study/${chapterCode}`)}
              className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold"
            >
              학습 자료로 돌아가기
            </button>
            <button
              onClick={() => navigate('/kisa')}
              className="px-3 py-2 rounded-lg border border-border text-xs"
            >
              대시보드로
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
        <div className="font-bold text-red-700 dark:text-red-300 mb-1">⚠️ 오류</div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => navigate(chapterCode ? `/kisa/study/${chapterCode}` : '/kisa')}
          className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs"
        >
          {chapterCode ? '학습 자료로' : '대시보드로'}
        </button>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="space-y-3">
      {/* 상단 진행률 + 배지 */}
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold">
            {progress.done + 1} / {progress.total}
          </span>
          <div className="flex-1 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <button
            onClick={() => navigate('/kisa')}
            className="text-text-secondary hover:text-text"
            aria-label="세션 종료"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge>{CATEGORY_LABELS[question.weakness_category] || question.weakness_category}</Badge>
          <Badge variant="blue">{question.language}</Badge>
          <Badge variant="amber">{question.difficulty}</Badge>
          {question.weakness_code && <Badge variant="neutral">{question.weakness_code}</Badge>}
        </div>
      </div>

      {/* 문항 본문 — registry 기반 분기 (REBUILD16 R3) */}
      {(() => {
        const meta = getQuestionType(question.question_type);
        if (!meta?.Card) {
          return <div className="text-xs text-text-secondary p-3">지원하지 않는 문제 유형: {question.question_type}</div>;
        }
        const Card = meta.Card;
        return <Card question={question} onSubmit={handleSubmit} disabled={!!result} />;
      })()}

      {/* 결과 오버레이 */}
      {result && (
        <ResultOverlay
          result={result}
          question={question}
          onSelfGrade={handleSelfGrade}
        />
      )}
    </div>
  );
}

function Badge({ children, variant = 'primary' }) {
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
