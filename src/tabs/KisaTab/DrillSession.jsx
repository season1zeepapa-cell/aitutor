// KISA 드릴 세션 — /kisa/drill
// URL 쿼리: ?type=objective|diagnosis4&category=&language=&difficulty=&srs=true
//
// 화면 구성 (FEATURE_SPEC §5.1):
//   상단: 진행률 + 약점 배지 + 언어/난이도 배지
//   본문: question_type에 따라 McqCard 또는 DiagnosisCard
//   제출 후: ResultOverlay (점수 + 모범답안 + 자가평가 4버튼)
//
// 세션 중 상태 관리는 useState + 내부 queue로 처리. 전역 Context 추가하지 않음.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../lib/api';
import { getQuestionType } from '../../components/QuestionTypes/registry';
import ResultOverlay from './ResultOverlay';
import QuestionLibraryModal from '../../components/QuestionLibraryModal';
import { setCurrentChapter } from '../../lib/currentChapter';

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
  // SRS 복습 모드는 유형을 강제하지 않는다 — 복습 큐에는 codeid 등 모든 유형이 섞여 있어
  // 기본값 diagnosis4 를 적용하면 "조건에 맞는 문항이 없습니다"가 된다 (복습 배지 진입 버그).
  const type = searchParams.get('type') || (searchParams.get('srs') === 'true' ? '' : 'diagnosis4');
  const stage = searchParams.get('stage') || '';
  const category = searchParams.get('category') || '';
  const categories = searchParams.get('categories') || ''; // 카테고리 다중선택 (이론·단답형 설정)
  const language = searchParams.get('language') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const chapterCode = searchParams.get('chapter_code') || '';
  const sources = searchParams.get('sources') || ''; // 출처 다중선택 (쉼표 구분, 랜딩에서 전달)
  const dedup = searchParams.get('dedup') === 'true'; // 출처 간 동일코드 중복제거
  const srsOnly = searchParams.get('srs') === 'true';
  // full=1: 전수 풀이 모드 — 10개 제한 해제 + 이미 푼 문항수를 baseline 으로(이어하기)
  const fullMode = searchParams.get('full') === '1';

  // 세션 상태
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // total: 진입 시 API 호출로 실제 사용 가능한 문항 수 조회 후 설정
  // chapter_code가 있으면 해당 챕터 수, 없으면 최소(전체, 10)
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [seenIds, setSeenIds] = useState([]);                       // 중복 방지
  const [startedAt, setStartedAt] = useState(Date.now());
  const [guideOrder, setGuideOrder] = useState(searchParams.get('order') === 'guide'); // 가이드순(순서대로) 출제 — DrillConfig 에서 전달
  const didOrderMount = useRef(false);

  // 제출 결과 (오버레이 표시용)
  const [result, setResult] = useState(null);

  // 관련 지식 라이브러리 모달 표시 여부
  const [showLibrary, setShowLibrary] = useState(false);

  // 현재 풀이 중 문제의 챕터를 전역 공유 → 우측 하단 플로팅 '자료 라이브러리'가 이 주제 키워드로 조회
  useEffect(() => {
    setCurrentChapter(question?.chapter_code || null);
    return () => setCurrentChapter(null);
  }, [question?.chapter_code]);

  const fetchNextQuestion = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setStartedAt(Date.now());
    try {
      const params = new URLSearchParams({ action: 'next' });
      if (type) params.set('type', type);
      if (stage) params.set('stage', stage);
      if (categories) params.set('categories', categories);
      else if (category) params.set('category', category);
      if (language) params.set('language', language);
      if (difficulty) params.set('difficulty', difficulty);
      if (chapterCode) params.set('chapter_code', chapterCode);
      if (sources) params.set('sources', sources);
      if (dedup) params.set('dedup', 'true');
      if (srsOnly) params.set('srs', 'true');
      if (guideOrder) params.set('order', 'guide');
      if (seenIds.length > 0) params.set('exclude_ids', seenIds.join(','));

      const data = await apiGet(`/api/kisa-drill?${params}`);
      setQuestion(data.question);
    } catch (e) {
      setError(e.message);
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [type, stage, category, categories, language, difficulty, chapterCode, sources, dedup, srsOnly, guideOrder, seenIds]);

  // 최초 진입 시 total 수 조회 + 첫 문항 로드
  useEffect(() => {
    (async () => {
      try {
        // 1) 필터에 맞는 총 문항 수 조회
        const countParams = new URLSearchParams({ action: 'count' });
        if (type) countParams.set('type', type);
        if (stage) countParams.set('stage', stage);
        if (categories) countParams.set('categories', categories);
        else if (category) countParams.set('category', category);
        if (language) countParams.set('language', language);
        if (difficulty) countParams.set('difficulty', difficulty);
        if (chapterCode) countParams.set('chapter_code', chapterCode);
        if (sources) countParams.set('sources', sources);
        if (dedup) countParams.set('dedup', 'true');
        if (srsOnly) countParams.set('srs', 'true');

        const countData = await apiGet(`/api/kisa-drill?${countParams}`);
        const available = countData.total || 0;
        const attempted = countData.attempted || 0;

        // full/챕터: 범위 전체를 total 로(전수). 아니면 min(전체, 10).
        const sessionTotal = (fullMode || chapterCode) ? available : Math.min(available, 10);
        // full 모드는 이미 푼 문항수를 진행도 baseline 으로 → 중단 지점부터 이어하기.
        // 단, 이미 완주(attempted>=total)했다면 새 복습 패스이므로 0부터.
        const baselineDone = fullMode
          ? (attempted >= sessionTotal ? 0 : attempted)
          : 0;
        setProgress({ done: baselineDone, total: sessionTotal });

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

  // 출제 순서 토글 시 세션 리셋 후 재출제 (초기 마운트는 위 useEffect가 처리)
  useEffect(() => {
    if (!didOrderMount.current) { didOrderMount.current = true; return; }
    setSeenIds([]);
    setProgress((p) => ({ ...p, done: 0 }));
    fetchNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideOrder]);

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
        ...(question.question_type === 'objective' ? {}
          : question.question_type === 'codeid' ? {
            // codeid: 약점·안전여부 둘 다 재전송해야 재채점 점수 보존
            mcq_selected: result.user_selected,
            verdict_yn: result.user_verdict_yn,
          }
          : {
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
      // 세션 완료
      if (fullMode) {
        alert(`🎉 전수 완료! 이 범위 ${progress.total}문항을 모두 풀었습니다.`);
        navigate('/kisa/code-drill');   // 진도 랜딩으로 복귀
      } else {
        alert(`세션 완료! ${progress.total}문항 학습하셨습니다.`);
        navigate('/kisa');
      }
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
          {/* 관련 지식 라이브러리 조회 — 이 문제의 chapter_code에 해당하는 자료를 모달로 표시 */}
          {question.chapter_code && (
            <button
              onClick={() => setShowLibrary(true)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
              title="이 문제와 관련된 지식 자료 보기"
            >
              📚 관련 지식
            </button>
          )}
          {!srsOnly && (
            <button
              onClick={() => setGuideOrder((v) => !v)}
              className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                guideOrder ? 'border-primary text-primary bg-primary/10' : 'border-border text-text-secondary'
              }`}
              title="출제 순서 전환 (가이드순 ↔ 랜덤)"
            >
              {guideOrder ? '📑 가이드순' : '🎲 랜덤'}
            </button>
          )}
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

      {/* 관련 지식 라이브러리 모달 */}
      {showLibrary && (
        <QuestionLibraryModal
          chapterCode={question.chapter_code}
          onClose={() => setShowLibrary(false)}
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
