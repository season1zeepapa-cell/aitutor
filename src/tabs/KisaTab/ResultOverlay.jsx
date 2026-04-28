// 채점 결과 오버레이 — FEATURE_SPEC §8 UX
// 구성:
//   상단: 자가채점 점수 / LLM 점수 / 종합 점수
//   ▌취약 여부   ✅ 정확
//   ▌라인 지목   ⚠ 부분 정답 (맞춘 라인 2/3)
//   ▌근거        ✅ 필수 키워드 3/3 포함
//   ▌수정 방안   ⚠ 필수 키워드 2/3 포함 (누락: ...)
//   [모범답안 보기] [안전한 코드 보기] [DIFF]
//   [다시] [어려움] [괜찮음] [쉬움]
import { useState, useRef, useEffect } from 'react';
import { getQuestionType } from '../../components/QuestionTypes/registry';
import CodeBlock from '../../components/CodeBlock';
import { apiPost, apiGet } from '../../lib/api';

const GRADES = [
  { value: 'again', label: '다시', color: 'bg-red-500' },
  { value: 'hard',  label: '어려움', color: 'bg-amber-500' },
  { value: 'good',  label: '괜찮음', color: 'bg-green-500' },
  { value: 'easy',  label: '쉬움', color: 'bg-blue-500' },
];

export default function ResultOverlay({ result: initialResult, question, onSelfGrade }) {
  const [result, setResult] = useState(initialResult);
  const [showModel, setShowModel] = useState(false);
  const [showSafe, setShowSafe] = useState(false);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState('');

  // AI 추가 해설 (SSE 스트리밍 + 저장/재사용)
  const [llmExpl, setLlmExpl] = useState('');
  const [llmExplLoading, setLlmExplLoading] = useState(false);
  const [llmExplProvider, setLlmExplProvider] = useState(null);
  const [llmExplError, setLlmExplError] = useState('');
  const [llmExplFromCache, setLlmExplFromCache] = useState(false);
  const [llmExplId, setLlmExplId] = useState(null);   // 저장된 해설 ID (삭제용)
  const [savedProviders, setSavedProviders] = useState({});  // { gemini: {id, preview, created_at}, ... }
  const abortRef = useRef(null);

  // 마운트 시 저장된 해설 목록 조회 (영상정보관리사와 동일 패턴)
  useEffect(() => {
    if (!question?.id) return;
    apiGet(`/api/kisa-attempt?action=list-explanations&question_id=${question.id}`)
      .then(data => {
        const map = {};
        (data.explanations || []).forEach(e => { map[e.provider] = e; });
        setSavedProviders(map);
      })
      .catch(() => {});
  }, [question?.id]);

  // LLM 해설 요청 (저장된 게 있으면 재사용, 없으면 새로 생성)
  const requestLlmExplain = async (provider, { forceNew = false } = {}) => {
    if (!question?.id) return;
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLlmExpl('');
    setLlmExplLoading(true);
    setLlmExplError('');
    setLlmExplProvider(provider);
    setLlmExplFromCache(false);
    setLlmExplId(null);

    try {
      const resp = await fetch('/api/kisa-attempt?action=llm-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question_id: question.id, provider, force_new: forceNew }),
        signal: ac.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'cached') {
                setLlmExplFromCache(true);
                setLlmExplId(data.id);
              } else if (currentEvent === 'chunk' && data.content) {
                setLlmExpl(prev => prev + data.content);
              } else if (currentEvent === 'done' && !data.from_cache) {
                // 새로 생성된 경우, 저장 목록 새로고침
                apiGet(`/api/kisa-attempt?action=list-explanations&question_id=${question.id}`)
                  .then(d => {
                    const map = {};
                    (d.explanations || []).forEach(e => { map[e.provider] = e; });
                    setSavedProviders(map);
                  })
                  .catch(() => {});
              } else if (currentEvent === 'error') {
                setLlmExplError(data.message);
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setLlmExplError(e.message);
    } finally {
      setLlmExplLoading(false);
    }
  };

  // 저장된 해설 삭제
  const deleteSavedExplanation = async (id) => {
    if (!confirm('저장된 해설을 삭제할까요?')) return;
    try {
      await apiPost('/api/kisa-attempt?action=delete-explanation', { id });
      // 로컬 상태 정리
      setSavedProviders(prev => {
        const newMap = { ...prev };
        Object.keys(newMap).forEach(p => {
          if (newMap[p].id === id) delete newMap[p];
        });
        return newMap;
      });
      if (llmExplId === id) {
        setLlmExpl('');
        setLlmExplProvider(null);
        setLlmExplId(null);
        setLlmExplFromCache(false);
      }
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    }
  };

  // REBUILD16 R3 — registry 기반 유형별 컴포넌트 분기 (isMcq/isBlank/isDiag 변수 제거)
  const typeMeta = getQuestionType(question.question_type) || {};
  const TypeResult = typeMeta.Result;
  const TypeHeaderExtra = typeMeta.HeaderExtra;
  const showLlm = typeMeta.showLlmGrade;
  const autoScore = result.auto_score ?? 0;
  const finalScore = result.final_score ?? autoScore;
  const llmScore = result.llm_score;
  const llmFeedback = result.llm_feedback;

  const b = result.breakdown || {};
  const hits = result.keyword_hits || {};

  // LLM 보조 채점 호출
  const requestLlmGrade = async (provider = 'gemini') => {
    if (!result.attempt_id) return;
    setLlmLoading(true);
    setLlmError('');
    try {
      const data = await apiPost('/api/kisa-attempt?action=llm-grade', {
        attempt_id: result.attempt_id,
        provider,
      });
      // 기존 result에 llm_* 필드 병합
      setResult(prev => ({
        ...prev,
        llm_score: data.llm_score,
        llm_feedback: data.llm_feedback,
        final_score: data.final_score,
      }));
    } catch (e) {
      setLlmError(e.message);
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-card-bg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* 점수 헤더 — 유형별 라벨 */}
        <div className={`p-4 text-white ${scoreColor(finalScore)}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] opacity-90 flex items-center gap-1.5">
                {/* REBUILD16 R3 — 유형별 라벨은 registry 가 단일 진실 공급원 */}
                <span>{getQuestionType(question.question_type)?.resultLabel || question.question_type}</span>
              </div>
              <div className="text-3xl font-bold">{finalScore}점</div>
              {TypeHeaderExtra && <TypeHeaderExtra result={result} question={question} />}
            </div>
            <div className="text-right text-xs opacity-90">
              {showLlm && <div>자가채점 {autoScore}</div>}
              {typeof llmScore === 'number' && <div>LLM {llmScore}</div>}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* REBUILD16 R3 — 유형별 결과 영역 (registry 가 분기 단일 진실 공급원) */}
          {TypeResult && (
            <TypeResult
              result={result}
              question={question}
              llm={showLlm ? {
                score: llmScore,
                feedback: llmFeedback,
                loading: llmLoading,
                error: llmError,
                onRequest: requestLlmGrade,
              } : undefined}
            />
          )}

          {/* 📖 기본 정답 해설 — 모든 문항 필수 노출
              우선순위: 1) DB explanation (MCQ 전용 사전작성)
                       2) model_answer.rationale + fix_description (diagnosis4 폴백) */}
          {(result.explanation || result.model_answer?.rationale) && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">📖</span>
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200">정답 해설</h3>
                {result.question?.chapter_code && (
                  <span className="ml-auto text-[10px] font-mono text-text-secondary">
                    {result.question.chapter_code}
                  </span>
                )}
              </div>
              <div
                className="text-xs leading-relaxed text-text space-y-2 whitespace-pre-wrap"
                style={{ wordBreak: 'keep-all' }}
              >
                {result.explanation || (
                  <>
                    <p><span className="font-bold text-blue-700 dark:text-blue-300">📌 판정:</span> {result.model_answer?.verdict ? '취약 (Y)' : '안전 (N)'}</p>
                    {result.model_answer?.rationale && (
                      <p><span className="font-bold text-blue-700 dark:text-blue-300">📌 취약 근거:</span> {result.model_answer.rationale}</p>
                    )}
                    {result.model_answer?.fix_description && (
                      <p><span className="font-bold text-blue-700 dark:text-blue-300">📌 수정 방안:</span> {result.model_answer.fix_description}</p>
                    )}
                    {result.vulnerable_lines?.length > 0 && (
                      <p><span className="font-bold text-blue-700 dark:text-blue-300">📌 취약 라인:</span> {result.vulnerable_lines.join(', ')}</p>
                    )}
                  </>
                )}
              </div>
              {result.question?.reference && (
                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800 text-[10px] text-text-secondary">
                  📚 {result.question.reference}
                </div>
              )}
            </div>
          )}

          {/* 🤖 AI 추가 해설 (저장된 것 재사용 + SSE 스트리밍 생성) */}
          <div className="rounded-xl bg-primary-light/40 border border-primary/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">🤖</span>
              <h3 className="text-sm font-bold">AI 추가 해설</h3>
              {llmExplProvider && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px]">
                  {llmExplFromCache && (
                    <span className="px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      💾 저장됨
                    </span>
                  )}
                  <span className="text-primary font-mono">{llmExplProvider}</span>
                </span>
              )}
            </div>

            {/* 프로바이더 선택 버튼 (저장된 해설 있으면 뱃지) */}
            {!llmExplLoading && (
              <div className="grid grid-cols-3 gap-1 mb-2">
                {[
                  { key: 'gemini', label: 'Gemini', color: 'bg-[#4285f4]' },
                  { key: 'claude', label: 'Claude', color: 'bg-amber-600' },
                  { key: 'openai', label: 'OpenAI', color: 'bg-[#10a37f]' },
                ].map(p => {
                  const saved = savedProviders[p.key];
                  const isActive = llmExplProvider === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => requestLlmExplain(p.key)}
                      className={`relative py-1.5 rounded-lg ${p.color} text-white text-[11px] font-semibold ${
                        isActive ? 'ring-2 ring-offset-1 ring-primary' : ''
                      } hover:opacity-90 active:scale-95 transition-all`}
                    >
                      {p.label}
                      {saved && (
                        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[8px] font-bold shadow-md">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!llmExpl && !llmExplLoading && Object.keys(savedProviders).length === 0 && (
              <p className="text-[11px] text-text-secondary">
                {/* REBUILD16 R3 — 유형별 안내 문구는 registry 의 question_type 으로 결정 */}
                {{
                  mcq: 'AI가 각 선택지별 상세 해설 · 실무 사례 · 관련 용어를 생성합니다',
                  blank: 'AI가 빈칸 정답 개념 · 관련 용어 · 실무 활용 예를 심화 설명합니다',
                  diagnosis4: 'AI가 취약 부분의 원리 · 공격 시나리오 · 수정 방안 심화를 설명합니다',
                }[question.question_type] || 'AI가 추가 해설을 생성합니다'}
              </p>
            )}

            {!llmExpl && !llmExplLoading && Object.keys(savedProviders).length > 0 && (
              <p className="text-[11px] text-text-secondary">
                💾 저장된 AI 해설 있음. 버튼 클릭 시 즉시 표시됩니다 (신규 생성은 아래 재생성 버튼)
              </p>
            )}

            {/* 해설 내용 + 커서 */}
            {(llmExpl || llmExplLoading) && (
              <div>
                <div
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {llmExpl}
                  {llmExplLoading && <span className="inline-block w-2 h-3 bg-primary animate-pulse ml-0.5" />}
                </div>

                {/* 완료 후 액션: 새로생성 / 삭제 */}
                {!llmExplLoading && llmExpl && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-primary/20">
                    <button
                      onClick={() => requestLlmExplain(llmExplProvider, { forceNew: true })}
                      className="text-[10px] text-primary hover:underline"
                    >
                      🔄 같은 AI로 새로 생성
                    </button>
                    {llmExplFromCache && llmExplId && (
                      <button
                        onClick={() => deleteSavedExplanation(llmExplId)}
                        className="text-[10px] text-red-600 dark:text-red-400 hover:underline ml-auto"
                      >
                        🗑️ 저장된 해설 삭제
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {llmExplError && (
              <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
                ⚠️ {llmExplError}
              </p>
            )}
          </div>

          {/* REBUILD16 R3 — diagnosis4 4단계 + LLM 보조 채점 영역은 components/QuestionTypes/results/DiagnosisResult.jsx 에서 렌더링됨 */}

          {/* 모범답안 토글 */}
          {result.model_answer && (
            <Collapse
              title="💡 모범답안 보기"
              open={showModel}
              onToggle={() => setShowModel(v => !v)}
            >
              <div className="text-xs leading-relaxed space-y-2 text-text-secondary">
                {result.model_answer.rationale && (
                  <div>
                    <div className="font-bold text-text mb-0.5">근거</div>
                    <p>{result.model_answer.rationale}</p>
                  </div>
                )}
                {result.model_answer.fix_description && (
                  <div>
                    <div className="font-bold text-text mb-0.5">수정 방안</div>
                    <p>{result.model_answer.fix_description}</p>
                  </div>
                )}
                {result.vulnerable_lines && (
                  <div>
                    <div className="font-bold text-text mb-0.5">정답 취약 라인</div>
                    <p>{result.vulnerable_lines.join(', ')}</p>
                  </div>
                )}
              </div>
            </Collapse>
          )}

          {/* 안전 코드 토글 */}
          {result.safe_code && (
            <Collapse
              title="✅ 안전한 코드 보기"
              open={showSafe}
              onToggle={() => setShowSafe(v => !v)}
            >
              <CodeBlock
                code={result.safe_code}
                language={question.code_language || question.language}
              />
            </Collapse>
          )}

          {/* 자가평가 4버튼 (SM-2) */}
          <div>
            <div className="text-xs font-bold text-text-secondary mb-1.5">
              자가평가 — 이 문항의 체감 난이도는?
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {GRADES.map(g => (
                <button
                  key={g.value}
                  onClick={() => onSelfGrade(g.value)}
                  className={`${g.color} text-white font-bold text-sm py-2.5 rounded-lg hover:opacity-90 active:scale-95 transition-all`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, status, detail, points }) {
  const icon = status === 'ok' ? '✅' : status === 'partial' ? '⚠️' : '❌';
  return (
    <div className="flex items-center gap-2 border-l-2 pl-2 py-0.5" style={{ borderColor: statusColor(status) }}>
      <span>{icon}</span>
      <span className="font-bold w-20">{label}</span>
      <span className="flex-1 text-text-secondary text-xs">{detail}</span>
      <span className="text-xs font-mono text-text-secondary">{points}</span>
    </div>
  );
}

function Collapse({ title, open, onToggle, children }) {
  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-2 text-sm font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between"
      >
        <span>{title}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-3 border-t border-border">{children}</div>}
    </div>
  );
}

function scoreColor(score) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function statusColor(status) {
  return status === 'ok' ? '#22c55e' : status === 'partial' ? '#f59e0b' : '#ef4444';
}

function keywordStatus(hits) {
  if (!hits || hits.total === 0) return 'ok';
  if (hits.hits === hits.total) return 'ok';
  if (hits.hits > 0) return 'partial';
  return 'fail';
}

function formatHits(hits) {
  if (!hits || hits.total === 0) return '해당 없음';
  const { hits: h, total, matched = [] } = hits;
  if (h === total) return `필수 키워드 ${h}/${total} 전부 포함`;
  return `필수 키워드 ${h}/${total} 포함${matched.length > 0 ? ` — 매칭: ${matched.slice(0, 3).join(', ')}${matched.length > 3 ? '...' : ''}` : ''}`;
}
