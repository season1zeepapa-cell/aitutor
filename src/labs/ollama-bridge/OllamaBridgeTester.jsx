// 외부 Ollama bridge 테스터 (REBUILD28 §11)
//
// 사용자 PC 에 설치된 Ollama (기본 localhost:11434) 직접 호출.
// 데스크톱 한정 — 70B 모델까지 가능. CORS / mixed content 이슈 안내 포함.
//
// 사용자 설정 저장: /api/user-settings (DB 연계 — REBUILD28 §11)
//   key=ollama_bridge_url   (예: http://localhost:11434)
//   key=ollama_bridge_model (예: qwen3:4b)

import { useState, useEffect, useRef } from 'react';
import { applyQwenStrict, isQwenModel } from '../../lib/qwen';
import QuestionPicker from '../../components/lab/QuestionPicker';
import PromptEditor from '../../components/lab/PromptEditor';
import { buildLabMessages } from '../../lib/lab/promptBuilder';

const DEFAULT_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen3:4b';

// REBUILD29 §13 — 도움말 코드 블록 (복사 버튼 포함)
function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 API 실패 시 무시
    }
  };
  return (
    <div className="relative group">
      <pre className="bg-bg p-2 pr-12 rounded text-[10.5px] text-text overflow-x-auto whitespace-pre-wrap break-all">{code}</pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-colors bg-card-bg border border-border text-text-secondary hover:bg-primary hover:text-white hover:border-primary"
        title="클립보드 복사"
      >
        {copied ? '✓ 복사됨' : '📋 복사'}
      </button>
    </div>
  );
}

export default function OllamaBridgeTester() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [savedAt, setSavedAt] = useState(null);
  const [models, setModels] = useState([]);             // /api/tags 응답
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);   // {ok, version, error}
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [answer, setAnswer] = useState('');
  const [meta, setMeta] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [maxTokens, setMaxTokens] = useState(2048);  // REBUILD29 — Qwen 한국어 해설 default (2026-04-30)
  const [temperature, setTemperature] = useState(0.3);
  const [showHelp, setShowHelp] = useState(false);
  const t0Ref = useRef(0);

  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(url);
  const mixedContentRisk = isHttpsPage && url.startsWith('http://');

  // ─── 저장된 설정 로드 ────────────────────────────────
  useEffect(() => {
    fetch('/api/user-settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then(s => {
        if (s.ollama_bridge_url) setUrl(s.ollama_bridge_url);
        if (s.ollama_bridge_model) setModel(s.ollama_bridge_model);
      })
      .catch(() => {});
  }, []);

  const saveSetting = async (key, value) => {
    setSavedAt(null);
    try {
      const r = await fetch('/api/user-settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSavedAt(new Date());
    } catch (err) {
      setError(`설정 저장 실패: ${err.message}`);
    }
  };

  const handleUrlBlur = () => saveSetting('ollama_bridge_url', url.trim());
  const handleModelBlur = () => saveSetting('ollama_bridge_model', model.trim());

  // ─── Ollama 연결 테스트 ─────────────────────────────
  const ping = async () => {
    setPinging(true);
    setPingResult(null);
    setError('');
    try {
      // 1) /api/version
      const vr = await fetch(`${url.replace(/\/+$/, '')}/api/version`);
      if (!vr.ok) throw new Error(`HTTP ${vr.status} from ${url}/api/version`);
      const vd = await vr.json();
      // 2) /api/tags
      const tr = await fetch(`${url.replace(/\/+$/, '')}/api/tags`);
      const td = tr.ok ? await tr.json() : { models: [] };
      setModels(td.models || []);
      setPingResult({ ok: true, version: vd.version || 'unknown', tagCount: (td.models || []).length });
    } catch (err) {
      setPingResult({ ok: false, error: err.message });
    } finally {
      setPinging(false);
    }
  };

  // REBUILD29 §19 — QuestionPicker 가 문항 로딩 담당
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setError(''); setAnswer(''); setMeta(null); setShowAnswer(false);
  };

  // ─── 추론 호출 (Ollama /api/chat) ──────────────────
  const runInfer = async (customMessages = null) => {
    if (!question) return;
    setRunning(true);
    setAnswer(''); setMeta(null); setError('');
    t0Ref.current = Date.now();
    try {
      // REBUILD29 §22 / §26 — PromptEditor customMessages 우선
      const baseMessages = customMessages || buildLabMessages(question);
      // REBUILD29 §13 / §16 — Qwen 한국어 강제 + thinking 비활성
      const messages = applyQwenStrict(baseMessages, model);
      const ollamaBody = {
        model,
        messages,
        stream: false,
        options: { num_predict: maxTokens, temperature },
      };
      // Ollama 자체 think 옵션 (이중 안전망)
      if (isQwenModel(model)) ollamaBody.think = false;
      const r = await fetch(`${url.replace(/\/+$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaBody),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const d = await r.json();
      setAnswer(d.message?.content || '(빈 응답)');
      setMeta({
        total_ms: Date.now() - t0Ref.current,
        eval_count: d.eval_count,
        eval_duration_ms: d.eval_duration ? Math.round(d.eval_duration / 1e6) : null,
      });
    } catch (err) {
      const hint = err.message.includes('Failed to fetch')
        ? ' — CORS 또는 mixed content 차단 가능 (아래 도움말 참고)'
        : '';
      setError(err.message + hint);
    } finally {
      setRunning(false);
    }
  };

  const choices = question
    ? (Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices || '[]'))
    : [];

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">🖥️ 사용자 PC 추론 (Ollama)</h1>
        <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
      </header>

      <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 px-3 py-2 text-[11px] text-violet-900 dark:text-violet-200 leading-relaxed">
        🖥️ <b>사용자 PC 에 설치된 Ollama 직접 호출</b> — 70B 까지 가능. 브라우저에서 <code>localhost:11434</code> 로 fetch.
        데스크톱 전용 (모바일 X). 첫 호출 전 아래 ❓ 도움말로 환경 설정 확인 필수.
      </div>

      {/* 도움말 카드 (펼침 토글) — REBUILD29 §13 사용자 요청, OS별 재시작/검증 포함 */}
      <div className="rounded-xl border border-border bg-card-bg">
        <button
          type="button"
          onClick={() => setShowHelp(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-text"
        >
          <span>❓ 데스크톱 셋업 가이드 — 6 단계 (설치 → 모델 → CORS → 재시작 → 검증)</span>
          <span className="text-text-secondary">{showHelp ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {showHelp && (
          <div className="px-3 pb-3 border-t border-border space-y-3 text-[11px] text-text-secondary leading-relaxed">

            {/* Step 1 — 설치 */}
            <div>
              <p className="font-bold text-text mt-1">1️⃣ Ollama 설치</p>
              <p>공식 사이트에서 OS 별 데스크톱 앱 다운로드: <a href="https://ollama.com" target="_blank" rel="noopener" className="text-primary hover:underline">ollama.com</a></p>
              <p>설치 후 자동 실행 → <code className="bg-bg px-1 rounded">localhost:11434</code> 에서 listen.</p>
            </div>

            {/* Step 2 — 모델 다운 */}
            <div>
              <p className="font-bold text-text">2️⃣ 모델 다운 (터미널)</p>
              <CodeBlock code={`ollama pull qwen3:4b      # 추천 (~2.7GB, 한국어 강세)
ollama pull qwen3:1.7b    # 가벼움 (~1.4GB)
ollama list               # 다운된 모델 목록`} />
            </div>

            {/* Step 3 — CORS 허용 (OS 별) */}
            <div>
              <p className="font-bold text-text">3️⃣ CORS 허용 (브라우저 호출 위해 필수)</p>
              <p className="text-[10px] text-text-secondary mb-1">이 페이지가 Ollama 를 호출하려면 모든 origin 허용 환경변수 설정 필요:</p>

              <p className="text-[10.5px] font-semibold mt-1.5">🍎 macOS</p>
              <CodeBlock code={`launchctl setenv OLLAMA_ORIGINS "*"`} />

              <p className="text-[10.5px] font-semibold mt-1.5">🐧 Linux (systemd)</p>
              <CodeBlock code={`sudo systemctl edit ollama
# 에디터에 다음 추가:
# [Service]
# Environment="OLLAMA_ORIGINS=*"

sudo systemctl daemon-reload`} />

              <p className="text-[10.5px] font-semibold mt-1.5">🪟 Windows (PowerShell)</p>
              <CodeBlock code={`[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS","*","User")`} />
            </div>

            {/* Step 4 — Ollama 재시작 (OS 별) ⭐ */}
            <div>
              <p className="font-bold text-text">4️⃣ Ollama 재시작 ⭐ (CORS 적용 필수)</p>
              <p className="text-[10px] text-text-secondary mb-1">환경변수 변경 후 반드시 재시작해야 적용됩니다:</p>

              <p className="text-[10.5px] font-semibold mt-1.5">🍎 macOS — 둘 중 하나 선택</p>
              <CodeBlock code={`# 방법 A — AppleScript (가장 간편)
osascript -e 'quit app "Ollama"' && sleep 2 && open -a Ollama

# 방법 B — brew 설치 시
brew services restart ollama

# 방법 C — 메뉴바 🦙 클릭 → Quit Ollama → Launchpad 에서 재실행`} />

              <p className="text-[10.5px] font-semibold mt-1.5">🐧 Linux</p>
              <CodeBlock code={`sudo systemctl restart ollama`} />

              <p className="text-[10.5px] font-semibold mt-1.5">🪟 Windows</p>
              <CodeBlock code={`Stop-Process -Name "ollama" -Force
Start-Process "C:\\Program Files\\Ollama\\ollama.exe"
# 또는 시스템 트레이 우클릭 → Quit → 시작 메뉴에서 재실행`} />
            </div>

            {/* Step 5 — 검증 ⭐ */}
            <div>
              <p className="font-bold text-text">5️⃣ 검증 (재시작 후 확인) ⭐</p>
              <p className="text-[10px] text-text-secondary mb-1">3가지 명령으로 작동 + CORS 모두 확인:</p>
              <CodeBlock code={`# 1) Ollama 작동
curl http://localhost:11434/api/version

# 2) 모델 목록
curl http://localhost:11434/api/tags

# 3) CORS 헤더 (가장 중요!) — Access-Control-Allow-Origin 응답 확인
curl -H "Origin: ${typeof window !== 'undefined' ? window.location.origin : 'https://example.com'}" -I http://localhost:11434/api/version`} />
              <p className="text-[10px] text-text-secondary opacity-80 mt-1">
                💡 위 3) 응답에 <code className="bg-bg px-1 rounded">Access-Control-Allow-Origin: *</code> 가 있어야 OK.
                없으면 CORS 설정/재시작 다시 확인.
              </p>
            </div>

            {/* Step 6 — HTTPS mixed content */}
            <div>
              <p className="font-bold text-text">6️⃣ HTTPS Mixed Content 우회 (필요 시)</p>
              <p>이 페이지가 https 인데 Ollama 는 http://localhost → 일부 브라우저가 차단합니다.</p>
              <p className="mt-1"><b>Chrome / Edge</b>:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>주소창 자물쇠 🔒 클릭</li>
                <li>"사이트 설정" → "안전하지 않은 콘텐츠"</li>
                <li><b>허용</b> 선택 → 페이지 새로고침</li>
              </ol>
              <p className="mt-1"><b>Firefox</b>: 사이트 설정 → "혼합 콘텐츠 차단 해제"</p>
              <p className="text-[10px] text-text-secondary opacity-70 mt-1">
                💡 <code>localhost</code> 는 일부 브라우저에서 자동 예외 — 안 되는 경우만 위 절차 적용.
              </p>
            </div>

            {/* 완료 안내 */}
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-2 mt-2">
              <p className="text-emerald-800 dark:text-emerald-200">
                ✅ 위 6 단계 완료 후 아래 <b>🔌 연결 테스트</b> 버튼 클릭 → 성공 시 추론 호출 가능
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 사용자 설정 — DB 연계 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">⚙️ Ollama 연결 설정</p>
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-text-secondary">Ollama URL</span>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder={DEFAULT_URL}
            className="rounded px-2 py-1.5 border border-border bg-bg text-text text-sm font-mono"
          />
        </label>
        {/* REBUILD29 §16 — 연결 테스트 후 받은 모델 목록에서 선택 (자유 입력 X) */}
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-text-secondary">
            모델 선택
            {!pingResult?.ok && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">⚠ 먼저 연결 테스트</span>
            )}
          </span>
          {pingResult?.ok && models.length > 0 ? (
            <select
              value={model}
              onChange={e => { setModel(e.target.value); saveSetting('ollama_bridge_model', e.target.value); }}
              className="rounded px-2 py-1.5 border border-border bg-bg text-text text-sm font-mono"
            >
              {models.map(m => (
                <option key={m.name} value={m.name}>
                  {m.name}{m.details?.parameter_size ? ` (${m.details.parameter_size}, ${(m.size / 1e9).toFixed(1)}GB)` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              disabled
              placeholder="연결 테스트 후 활성화"
              className="rounded px-2 py-1.5 border border-border bg-card-bg text-text-secondary text-sm font-mono cursor-not-allowed opacity-60"
            />
          )}
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={ping}
            disabled={pinging}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold"
          >
            {pinging ? '확인 중…' : '🔌 연결 테스트'}
          </button>
          {savedAt && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ 저장됨</span>
          )}
        </div>

        {pingResult && (
          <div className={`mt-1 rounded p-2 text-[11px] ${
            pingResult.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}>
            {pingResult.ok
              ? `✅ Ollama ${pingResult.version} 연결 OK · 모델 ${pingResult.tagCount}개 발견`
              : `❌ ${pingResult.error}`}
          </div>
        )}

        {mixedContentRisk && (
          <div className="rounded p-2 text-[10.5px] bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200">
            ⚠ HTTPS 페이지에서 http://localhost 호출 — 브라우저가 mixed content 로 차단할 수 있어요. 위 도움말 4번 참고.
          </div>
        )}
      </div>

      {/* 추론 옵션 */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <label className="flex flex-col gap-0.5">
          <span className="text-text-secondary">max_tokens</span>
          <input
            type="number" min="64" max="4096" step="64"
            value={maxTokens}
            onChange={e => setMaxTokens(Number(e.target.value))}
            className="rounded px-2 py-1 border border-border bg-card-bg text-text"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-secondary">temperature</span>
          <input
            type="number" min="0" max="2" step="0.1"
            value={temperature}
            onChange={e => setTemperature(Number(e.target.value))}
            className="rounded px-2 py-1 border border-border bg-card-bg text-text"
          />
        </label>
      </div>

      {/* REBUILD29 §19 — 문항 입력 (DB 선택 + 외부 붙여넣기 통합) */}
      <QuestionPicker question={question} onChange={handleQuestionChange} />

      {/* REBUILD29 §26 — PromptEditor (섹션별 편집) */}
      {question && pingResult?.ok && (
        <PromptEditor
          question={question}
          model={model}
          running={running}
          onSubmit={(messages) => runInfer(messages)}
          disabled={!pingResult?.ok}
        />
      )}

      {/* 추론 실행 (default) */}
      {question && (
        <button
          onClick={() => runInfer()}
          disabled={running || !pingResult?.ok}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold"
        >
          {running ? '✨ 생성 중…' : `✨ ${model} 로 해설 생성 (default)`}
        </button>
      )}

      {/* 응답 */}
      {answer && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-violet-900 dark:text-violet-200">📝 Ollama 해설</p>
            {meta && (
              <p className="text-[10px] text-violet-700 dark:text-violet-300">
                {meta.total_ms}ms · {meta.eval_count ?? '?'} tokens
              </p>
            )}
          </div>
          <p className="text-sm text-violet-900 dark:text-violet-100 whitespace-pre-wrap leading-relaxed">{answer}</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-xs text-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <p className="text-[11px] text-text-secondary text-center pt-4">
        REBUILD28 §11 — 외부 Ollama bridge (사용자 PC 의 Ollama 직접 호출)
      </p>
    </div>
  );
}
