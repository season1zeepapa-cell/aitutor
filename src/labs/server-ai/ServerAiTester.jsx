// /lab/server-ai — 서버 추론 시범 페이지 (REBUILD21)
// LocalAiExplanation 패턴 차용 — 운전면허 문항 무작위 + 정답 토글 + 프롬프트 보기 + 해설 출력
//
// 본 기능 영향 0 — useDeviceAi 미사용. /api/server-infer/{model} 직접 호출.
import { useState, useEffect, useRef } from 'react';
import { serverInfer, estimateCost, SERVER_MODELS } from './lib/serverInfer';

const CIRCLE = ['①','②','③','④','⑤'];

// inference.py 의 build_messages 와 동일한 prompt 빌드 (사용자 표시용)
function buildPromptPreview(question) {
  const choices = (question.choices || []);
  const choicesText = choices.map((c, i) => `${CIRCLE[i]} ${c}`).join('\n');
  const answerLabel = CIRCLE[(question.answer || 1) - 1] || '①';
  return `자격증 시험 강사로서 한국어로 정답 해설.
「법령명」 인용. 보기별 한 줄 설명.

[문제]
${question.body || ''}

[보기]
${choicesText}

[정답] ${answerLabel}

각 보기가 왜 맞고 틀린지 한 줄씩 설명해주세요.`;
}

export default function ServerAiTester() {
  const [modelKey, setModelKey] = useState('e2b');
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [stream, setStream] = useState('');
  const [meta, setMeta] = useState(null);
  const [done, setDone] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [history, setHistory] = useState([]);
  const t0Ref = useRef(0);
  const firstTokenAtRef = useRef(0);

  // 운전면허 문항 무작위 1건 로드 (LocalAi 와 동일)
  const fetchRandomQuestion = async () => {
    setLoadingQ(true);
    setError('');
    setStream('');
    setMeta(null);
    setDone(null);
    setShowAnswer(false);
    try {
      const r = await fetch('/api/questions?action=public&exam_id=161');
      const data = await r.json();
      const list = data.questions || [];
      if (list.length === 0) throw new Error('문항이 없습니다.');
      const random = list[Math.floor(Math.random() * list.length)];
      // choices 파싱 (string 또는 array)
      const choices = Array.isArray(random.choices)
        ? random.choices
        : JSON.parse(random.choices || '[]');
      setQuestion({ ...random, choices });
    } catch (e) {
      setError(`문항 로드 실패: ${e.message}`);
    } finally {
      setLoadingQ(false);
    }
  };

  useEffect(() => { fetchRandomQuestion(); }, []);

  const handleRun = async () => {
    if (!question) return;
    setStream('');
    setMeta(null);
    setDone(null);
    setError('');
    setRunning(true);
    t0Ref.current = Date.now();
    firstTokenAtRef.current = 0;

    try {
      const result = await serverInfer({
        modelKey,
        question: {
          id: question.id,
          body: question.body,
          choices: question.choices,
          answer: question.answer,
        },
        maxTokens: 512,
        temperature: 0.3,
        onMeta: (m) => setMeta(m),
        onToken: (t) => {
          if (!firstTokenAtRef.current) {
            firstTokenAtRef.current = Date.now() - t0Ref.current;
          }
          setStream(prev => prev + t);
        },
        onDone: (d) => {
          setDone({ ...d, first_token_ms: firstTokenAtRef.current });
          setHistory(h => [{
            time: new Date().toLocaleTimeString(),
            modelKey,
            ...d,
            first_token_ms: firstTokenAtRef.current,
            cost: estimateCost(modelKey, d.latency_ms || d.total_ms),
          }, ...h].slice(0, 10));
        },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">☁️ 서버 추론 시범</h1>
        <a href="/" className="text-xs text-primary hover:underline">← 홈</a>
      </header>

      {/* 안내 배너 */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
        ☁️ <b>Lambda Container CPU + ONNX Runtime 추론</b> — 디바이스 한계 무관 동작.
        외부 회사 X, 우리 AWS 안에서만 처리.
      </div>

      {/* 모델 선택 — 현재 E4B 단독 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">📦 모델 선택</p>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(SERVER_MODELS).map(([k, m]) => (
            <button
              key={k}
              onClick={() => setModelKey(k)}
              disabled={running}
              className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                modelKey === k
                  ? 'border-primary bg-primary-light'
                  : 'border-border hover:border-primary/40'
              } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="text-sm font-bold text-text">{m.label}</div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                디스크 {m.diskGB} GB · 응답 ~{m.expectedSec}초
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 문항 카드 (LocalAi 와 동일 패턴) */}
      {loadingQ ? (
        <p className="text-center text-sm text-text-secondary py-8">문항 로드 중…</p>
      ) : question ? (
        <div className="rounded-xl border border-border bg-card-bg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">운전면허 #{question.question_number}</span>
            <button
              onClick={fetchRandomQuestion}
              disabled={running}
              className="text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              다음 문항 ↻
            </button>
          </div>
          <p className="text-sm font-medium leading-relaxed text-text">{question.body}</p>
          <ul className="space-y-1.5">
            {question.choices.map((c, i) => (
              <li key={i} className={`flex gap-2 text-sm ${
                showAnswer && (i + 1 === question.answer || i + 1 === question.answer_extra)
                  ? 'text-success font-bold' : 'text-text'}`}>
                <span>{CIRCLE[i]}</span>
                <span className="flex-1">{c}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setShowAnswer(s => !s)}
            className="text-xs text-primary hover:underline"
          >
            {showAnswer ? '정답 숨기기' : '정답 보기'}
          </button>
        </div>
      ) : null}

      {/* 추론 시작 버튼 */}
      {question && (
        <button
          onClick={handleRun}
          disabled={running}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold"
        >
          {running ? '☁️ 서버 추론 중…' : `✨ ${SERVER_MODELS[modelKey]?.label || modelKey} 로 해설 생성`}
        </button>
      )}

      {/* 최종 입력 프롬프트 보기 — 접힘 (LocalAi 와 동일) */}
      {question && (
        <div className="rounded-xl border border-border bg-card-bg">
          <button
            type="button"
            onClick={() => setShowPrompt(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-text"
          >
            <span>🔍 최종 입력 프롬프트 보기</span>
            <span className="text-text-secondary">{showPrompt ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>
          {showPrompt && (() => {
            const promptText = buildPromptPreview(question);
            return (
              <div className="px-4 pb-3 border-t border-border">
                <div className="flex items-center justify-between mt-2 mb-1">
                  <span className="text-[10px] text-text-secondary">
                    {promptText.length}자 — 서버 inference.py 가 동일 형식으로 생성
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(promptText)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    📋 복사
                  </button>
                </div>
                <pre className="text-[11px] bg-bg p-2 rounded whitespace-pre-wrap break-words leading-relaxed text-text max-h-72 overflow-y-auto border border-border">
{promptText}
                </pre>
              </div>
            );
          })()}
        </div>
      )}

      {/* 메트릭 카드 */}
      {(meta || done) && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-1.5 text-xs">
          <p className="font-bold text-emerald-900 dark:text-emerald-200">📊 메트릭</p>
          {meta && (
            <>
              <div>모델: <b>{meta.model}</b></div>
              {meta.load_time_ms != null && (
                <div>모델 로드: {meta.load_time_ms} ms (cold 첫 호출만)</div>
              )}
              {meta.rate_limit && (
                <div className="text-text-secondary">
                  L1 사용자 한도: {meta.rate_limit.user_used}/{meta.rate_limit.user_limit} ·
                  L2 모델 한도: {meta.rate_limit.model_used}/{meta.rate_limit.model_limit}
                </div>
              )}
            </>
          )}
          {done && (
            <>
              <div>첫 토큰: <b>{done.first_token_ms} ms</b></div>
              <div>전체 응답: <b>{done.latency_ms} ms</b></div>
              <div>출력: {done.output_chars}자 · {done.output_tokens} 토큰</div>
              <div>추정 비용: ${estimateCost(modelKey, done.latency_ms).toFixed(5)}</div>
            </>
          )}
        </div>
      )}

      {/* 해설 출력 (LocalAi 와 동일 스타일) */}
      {(stream || running) && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4">
          <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-2">
            ☁️ {SERVER_MODELS[modelKey]?.label || modelKey} 해설
            {running && <span className="ml-1 pulse-soft">생성 중...</span>}
          </p>
          <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap leading-relaxed">
            {stream || '대기 중…'}
          </p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-xs text-red-900 dark:text-red-200">
          ⚠ {error}
        </div>
      )}

      {/* 호출 이력 */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card-bg p-3">
          <p className="text-xs font-bold text-text mb-2">🕒 최근 호출 ({history.length})</p>
          <div className="space-y-1 text-[11px]">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
                <span className="text-text-secondary">{h.time}</span>
                <span className="font-bold text-text">{SERVER_MODELS[h.modelKey]?.label}</span>
                <span className="text-text-secondary">
                  첫토큰 {h.first_token_ms}ms · 전체 {h.latency_ms}ms · ${h.cost.toFixed(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 안내 */}
      <p className="text-[11px] text-text-secondary text-center pt-4">
        REBUILD21 — Python Lambda Container + ONNX + LWA SSE 스트리밍
      </p>
    </div>
  );
}
