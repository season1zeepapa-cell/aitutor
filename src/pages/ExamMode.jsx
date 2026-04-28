// 시험 모드 — 제한시간 타이머 + 자동 채점 + 결과 화면
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import ErrorCard from '../components/ui/ErrorCard';
import MultiSelect from '../components/ui/MultiSelect';
import useFilterState from '../hooks/useFilterState';
import LawLinkedText from '../components/LawLink';
import { useImageModal } from '../App';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import shuffle from '../lib/shuffle';

const CIRCLE = ['①', '②', '③', '④', '⑤'];
const TIME_OPTIONS = [
  { label: '30분', value: 30 },
  { label: '60분', value: 60 },
  { label: '90분', value: 90 },
  { label: '무제한', value: 0 },
];

export default function ExamMode() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('setup'); // setup | exam | result
  const openImage = useImageModal();

  // setup
  const [meta, setMeta] = useState({ categories: [], exams: [] });
  const { categoryIds, setCategoryIds, examIds, setExamIds } = useFilterState('exam');
  const [timeLimit, setTimeLimit] = useState(60);
  const [questionCount, setQuestionCount] = useState(50);
  const [metaLoading, setMetaLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // exam
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { questionId: selectedNum }
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showImage, setShowImage] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // 초
  const [startTime, setStartTime] = useState(null);
  const timerRef = useRef(null);

  // result
  const [result, setResult] = useState(null);

  // 메타 로드
  const loadMeta = useCallback(() => {
    setMetaLoading(true); setError(null);
    apiPost('/api/questions', { action: 'meta' })
      .then(data => setMeta(data))
      .catch(() => setError('데이터 로드 실패'))
      .finally(() => setMetaLoading(false));
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const filteredExams = categoryIds.length > 0
    ? (meta.exams || []).filter(e => categoryIds.includes(String(e.category_id)))
    : (meta.exams || []);

  // 시험 시작
  const handleStart = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let url = '/api/questions?page=1&limit=500';
      if (categoryIds.length > 0) url += `&category_id=${categoryIds.join(',')}`;
      if (examIds.length > 0) url += `&exam_id=${examIds.join(',')}`;
      const data = await apiGet(url);
      const items = data.questions || [];
      if (items.length === 0) { setError('문제가 없습니다.'); return; }
      const shuffled = shuffle(items).slice(0, questionCount || items.length);
      setQuestions(shuffled);
      setAnswers({});
      setCurrentIdx(0);
      setTimeLeft(timeLimit * 60);
      setStartTime(Date.now());
      setPhase('exam');
    } catch { setError('문제 로드 실패'); }
    finally { setLoading(false); }
  }, [categoryIds, examIds, timeLimit, questionCount]);

  // 타이머
  useEffect(() => {
    if (phase !== 'exam' || timeLimit === 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); submitExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, timeLimit]);

  // 문제 이동 시 이미지 숨김
  useEffect(() => { setShowImage(false); }, [currentIdx]);

  // 답안 선택
  const selectAnswer = (qId, num) => {
    setAnswers(prev => ({ ...prev, [qId]: num }));
  };

  // 시험 제출 (자동채점)
  const submitExam = useCallback(() => {
    clearInterval(timerRef.current);
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    let correct = 0;
    let wrong = 0;
    const answerDetails = questions.map(q => {
      const selected = answers[q.id] || 0;
      const correctAnswer = parseInt(q.answer) || 0;
      const isCorrect = selected === correctAnswer && selected > 0;
      if (isCorrect) correct++; else wrong++;
      return { question_id: q.id, selected, correct_answer: correctAnswer, is_correct: isCorrect };
    });
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100 * 10) / 10 : 0;
    const r = {
      exam_id: examIds.length === 1 ? Number(examIds[0]) : null,
      category_id: categoryIds.length === 1 ? Number(categoryIds[0]) : null,
      total_questions: questions.length,
      correct_count: correct,
      wrong_count: wrong,
      score, time_spent: timeSpent, time_limit: timeLimit * 60,
      answers: answerDetails,
    };
    setResult(r);
    setPhase('result');
    // DB 저장
    apiPost('/api/exam-results', { action: 'save', ...r }).catch(() => {});
    // 오답 문제 자동 북마크 ('wrong' 태그 = 틀린 문제)
    answerDetails.filter(a => !a.is_correct).forEach(a => {
      apiPost('/api/bookmarks', { action: 'toggle', question_id: a.question_id, tag: 'wrong' }).catch(() => {});
    });
  }, [questions, answers, startTime, examIds, categoryIds, timeLimit]);

  // 시간 포맷
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── setup ──
  if (phase === 'setup') {
    return (
      <div className="space-y-5 fade-in">
        <button onClick={() => navigate('/quiz')} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          학습 허브
        </button>
        <h2 className="text-lg font-bold text-text">모의고사</h2>
        {error && <ErrorCard message={error} onRetry={loadMeta} />}
        <Card className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">카테고리</label>
            {metaLoading ? <Skeleton className="h-10 w-full rounded-xl" /> : (
              <MultiSelect
                options={meta.categories || []}
                selected={categoryIds}
                onChange={setCategoryIds}
                placeholder="전체"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">시험</label>
            {metaLoading ? <Skeleton className="h-10 w-full rounded-xl" /> : (
              <MultiSelect
                options={filteredExams}
                selected={examIds}
                onChange={setExamIds}
                placeholder="전체"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">제한 시간</label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setTimeLimit(o.value)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    timeLimit === o.value ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-primary/40'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">문제 수</label>
            <div className="grid grid-cols-4 gap-2">
              {[20, 30, 50, 0].map(n => (
                <button key={n} onClick={() => setQuestionCount(n)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    questionCount === n ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-primary/40'
                  }`}>{n === 0 ? '전체' : `${n}문제`}</button>
              ))}
            </div>
          </div>
        </Card>
        <button onClick={handleStart} disabled={metaLoading}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary-dark transition-all disabled:opacity-50 active:scale-[0.98]">
          시험 시작
        </button>
        <LoadingOverlay isOpen={!!loading} message="시험 문제를 준비하고 있어요" />
      </div>
    );
  }

  // ── exam ──
  if (phase === 'exam') {
    const q = questions[currentIdx];
    const rawChoices = typeof q.choices === 'string' ? JSON.parse(q.choices) : (q.choices || []);
    const choices = rawChoices.map(c => typeof c === 'object' ? (c.text || c.label || '') : c);
    const selectedNum = answers[q.id] || 0;
    const answeredCount = Object.keys(answers).length;
    const isUrgent = timeLimit > 0 && timeLeft < 60;

    return (
      <div className="fade-in">
        {/* 상단 바: 타이머 + 진행률 */}
        <div className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md pb-3 -mx-3 px-3 pt-1 sm:-mx-4 sm:px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text-secondary">{currentIdx + 1} / {questions.length}</span>
            {timeLimit > 0 && (
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                isUrgent ? 'bg-danger/10 text-danger animate-pulse' : 'bg-badge-bg text-text-secondary'
              }`}>
                {formatTime(timeLeft)}
              </span>
            )}
            <span className="text-xs text-text-secondary">{answeredCount}/{questions.length} 답변</span>
          </div>
          {/* 진행률 바 */}
          <div className="w-full h-1 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
          </div>
          {/* 문제 번호 네비게이션 */}
          <div className="flex gap-1 mt-2 overflow-x-auto pb-1 scrollbar-hide">
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setCurrentIdx(i)}
                className={`flex-shrink-0 w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                  i === currentIdx ? 'bg-primary text-white'
                    : answers[qq.id] ? 'bg-success/15 text-success'
                    : 'bg-badge-bg text-text-secondary'
                }`}>{i + 1}</button>
            ))}
          </div>
        </div>

        {/* 문제 카드 */}
        <Card className="p-4 mt-3">
          <p className="text-xs font-bold text-primary mb-2">Q.{currentIdx + 1}</p>

          {/* 문제 이미지 토글 */}
          {(() => {
            const imgUrl = q.image_url || null;
            if (!imgUrl) return null;
            return (
              <div className="mb-3">
                <button onClick={() => setShowImage(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-badge-bg text-text-secondary hover:text-primary hover:bg-primary-light">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {showImage ? '이미지 숨기기' : '원본 이미지 보기'}
                </button>
                {showImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-border cursor-pointer fade-in" onClick={() => openImage(imgUrl)}>
                    <img src={imgUrl} alt={`문제 ${currentIdx + 1}`}
                      className="w-full max-h-80 object-contain bg-badge-bg hover:opacity-90 transition-opacity" loading="lazy" />
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap mb-4"><LawLinkedText text={q.body} /></p>
          <div className="space-y-2">
            {choices.map((choice, i) => {
              const num = i + 1;
              const isSelected = selectedNum === num;
              return (
                <button key={i} onClick={() => selectAnswer(q.id, num)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all duration-200 ${
                    isSelected ? 'bg-primary/10 border-primary/40 text-primary font-semibold' : 'bg-badge-bg border-transparent hover:border-primary/20'
                  }`}>
                  <span className="flex-shrink-0 font-bold mt-0.5">{CIRCLE[i]}</span>
                  <span className="flex-1">{choice}</span>
                  {isSelected && (
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* 이동 + 제출 */}
        <div className="flex gap-2 mt-4">
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
            className="flex-1 py-3 rounded-xl border border-border text-text text-sm font-semibold hover:bg-card-bg-hover transition-all disabled:opacity-30">
            이전
          </button>
          {currentIdx < questions.length - 1 ? (
            <button onClick={() => setCurrentIdx(i => i + 1)}
              className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-all">
              다음
            </button>
          ) : (
            <button onClick={submitExam}
              className="flex-1 py-3 rounded-xl bg-success text-white text-sm font-bold hover:opacity-90 transition-all">
              제출하기
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── result ──
  if (phase === 'result' && result) {
    const passed = result.score >= 60;
    const wrongList = (result.answers || []).filter(a => !a.is_correct);
    const timeSpentMin = Math.floor(result.time_spent / 60);
    const timeSpentSec = result.time_spent % 60;

    return (
      <div className="space-y-5 fade-in">
        {/* 점수 카드 */}
        <Card className="text-center py-8">
          <div className={`text-6xl font-black mb-2 ${passed ? 'text-success' : 'text-danger'}`}>
            {result.score}<span className="text-2xl">점</span>
          </div>
          <p className={`text-lg font-bold ${passed ? 'text-success' : 'text-danger'}`}>
            {passed ? '합격' : '불합격'}
          </p>
          <p className="text-sm text-text-secondary mt-1">
            {result.correct_count}개 정답 / {result.total_questions}개 중
          </p>
          {result.time_spent > 0 && (
            <p className="text-xs text-text-secondary mt-1">
              소요 시간: {timeSpentMin}분 {timeSpentSec}초
            </p>
          )}
        </Card>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-3">
            <p className="text-xl font-bold text-success">{result.correct_count}</p>
            <p className="text-xs text-text-secondary">정답</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-xl font-bold text-danger">{result.wrong_count}</p>
            <p className="text-xs text-text-secondary">오답</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-xl font-bold text-primary">{result.score}%</p>
            <p className="text-xs text-text-secondary">정답률</p>
          </Card>
        </div>

        {/* 오답 목록 */}
        {wrongList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text">오답 목록 ({wrongList.length}문제)</h3>
              <span className="text-[10px] text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full font-semibold">틀린 문제로 자동 저장됨</span>
            </div>
            <div className="space-y-2">
              {wrongList.map((a, i) => {
                const q = questions.find(qq => qq.id === a.question_id);
                if (!q) return null;
                return (
                  <Card key={a.question_id} className="p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded flex-shrink-0">
                        Q.{questions.indexOf(q) + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text truncate">{q.body}</p>
                        <p className="text-[10px] text-text-secondary mt-1">
                          내 답: {a.selected > 0 ? CIRCLE[a.selected - 1] : '미응답'} → 정답: {CIRCLE[a.correct_answer - 1]}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          <button onClick={() => { setPhase('setup'); setResult(null); }}
            className="flex-1 py-3 rounded-xl border border-border text-text text-sm font-semibold hover:bg-card-bg-hover transition-all">
            다시 설정
          </button>
          <button onClick={() => navigate('/quiz')}
            className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-all">
            학습 허브
          </button>
        </div>
      </div>
    );
  }

  return null;
}
