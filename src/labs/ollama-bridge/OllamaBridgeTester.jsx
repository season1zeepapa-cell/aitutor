// 외부 Ollama bridge 테스터 — 사용자 PC 의 Ollama 직접 호출
//
// 사용자 PC 에 설치된 Ollama (기본 localhost:11434) 직접 호출.
// 데스크톱 한정 — RAM 충분 시 대형 모델 (70B 등) 가능. CORS / mixed content 이슈 안내 포함.
//
// 사용자 설정 저장: /api/user-settings (DB 연계)
//   key=ollama_bridge_url   (예: http://localhost:11434)
//   key=ollama_bridge_model (예: qwen3:4b)

import { useState, useEffect, useRef } from 'react';
import { applyQwenStrict, isQwenModel, applyKoreanLock } from '../../lib/qwen';
import QuestionPicker from '../../components/lab/QuestionPicker';
import PromptEditor from '../../components/lab/PromptEditor';
import ParamSliders from '../../components/lab/ParamSliders';
// REBUILD40 — 메모리 현황 카드 (정보) + 통합/분리 서버 참고용 카드
import OllamaPcStatusCard from '../../components/lab/OllamaPcStatusCard';
import MemoryCard from '../../components/lab/MemoryCard';
import { buildLabMessages } from '../../lib/lab/promptBuilder';
import ErrorBanner from '../../components/lab/ErrorBanner';
// REBUILD39 — 브릿지 전용 모델 메타 카탈로그 (통합/분리와 독립 운영, R-3 정책)
import { getOllamaModelMeta, resolveAutoThink } from '../../lib/lab/ollama-bridge-model-meta';

const DEFAULT_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen3:4b';

// 사용자 OS 자동 감지 — 상태 배너에서 맞춤 명령어 안내용
// navigator.userAgent 문자열 안에 OS 이름이 포함되어 있어서, 그걸로 판별
function detectOS() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';      // macOS / iPhone / iPad 모두 mac 으로 묶음
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

// 도움말 코드 블록 (복사 버튼 포함)
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
  const [maxTokens, setMaxTokens] = useState(2048);  // Qwen 한국어 해설 default
  const [temperature, setTemperature] = useState(0.3);
  const [showHelp, setShowHelp] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);  // 🛠️ 문제 해결 팁 카드 펼침 토글
  // REBUILD39 — thinking 모드 토글 ('auto' | 'on' | 'off'). 통합/분리 서버와 동일 UX.
  //   auto = 모델 메타의 think_default 적용 (Qwen 3.5 → off, DeepSeek R1 → on 등)
  //   on/off = 사용자 명시. resolveAutoThink 보다 우선.
  const [thinkMode, setThinkMode] = useState('auto');
  const t0Ref = useRef(0);

  // ─── 메모리 관리 state (단일 모델 정책) ──────────────
  // loadedModels: /api/ps 응답 — 현재 메모리에 로딩된 모델 배열
  //   각 항목: { name, size, size_vram, expires_at, ... }
  // memBusy: 로딩/언로딩 진행 중 플래그 (버튼 disable 용)
  // autoUnloadOnLeave: 페이지 이탈 시 자동 해제 여부 (기본 ON — 메모리 안전)
  const [loadedModels, setLoadedModels] = useState([]);
  const [memBusy, setMemBusy] = useState(false);
  const [memError, setMemError] = useState('');
  const [autoUnloadOnLeave, setAutoUnloadOnLeave] = useState(true);

  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(url);
  const mixedContentRisk = isHttpsPage && url.startsWith('http://');

  // ─── 저장된 설정 로드 + 페이지 진입 시 자동 상태 체크 ──
  // 사용자가 "🔌 연결 테스트" 버튼을 누르지 않아도, 페이지가 열리면
  // 자동으로 Ollama 가 켜져있는지 한 번 확인 → 결과를 상단 배너에 표시.
  // 단, 설정을 먼저 불러온 다음에 ping 해야 사용자가 저장한 URL 로 체크 가능.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/user-settings', { credentials: 'include' });
        const s = r.ok ? await r.json() : {};
        if (cancelled) return;
        if (s.ollama_bridge_url) setUrl(s.ollama_bridge_url);
        if (s.ollama_bridge_model) setModel(s.ollama_bridge_model);
      } catch {
        // 설정 조회 실패는 무시 (기본값 사용)
      }
      if (cancelled) return;
      // 설정 적용 후 자동 ping — 사용자가 보고 있을 URL 기준으로 체크
      // (state 가 비동기라 다음 tick 으로 미뤄야 최신 url 반영됨)
      setTimeout(() => { if (!cancelled) ping(); }, 0);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 페이지 이탈 시 자동 메모리 해제 ─────────────────
  // 정책: autoUnloadOnLeave=true 면 컴포넌트 언마운트(다른 페이지 이동, 탭 닫기 직전 등) 시
  //       현재 메모리에 떠있는 모델을 모두 해제 → 사용자 PC RAM 보호
  // 주의: 별도 useEffect 로 분리해야 url/autoUnloadOnLeave 최신값 사용 가능
  useEffect(() => {
    return () => {
      // cleanup 시점에 토글 OFF 면 해제 안 함 (사용자가 "다시 올 거니까 둬" 라고 한 것)
      if (!autoUnloadOnLeave) return;
      // fetch 는 unmount 후에도 동작 — 응답은 무시되어도 서버에는 도달
      // /api/ps 로 현재 상태 조회 후 keep_alive=0 으로 모두 해제
      fetch(`${url.replace(/\/+$/, '')}/api/ps`)
        .then(r => r.ok ? r.json() : { models: [] })
        .then(d => Promise.all((d.models || []).map(m =>
          fetch(`${url.replace(/\/+$/, '')}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: m.name, keep_alive: 0 }),
          }).catch(() => {})
        )))
        .catch(() => {});
    };
  }, [url, autoUnloadOnLeave]);

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
      // ping 성공 시 현재 메모리 상태도 같이 조회 (배너에 즉시 반영)
      refreshLoadedModels();
    } catch (err) {
      setPingResult({ ok: false, error: err.message });
    } finally {
      setPinging(false);
    }
  };

  // ─── 메모리 관리 — 현재 로딩된 모델 조회 ─────────────
  // Ollama /api/ps : 메모리에 로딩 중인 모델 목록 + VRAM/RAM 사용량
  // 응답 예: { models: [{ name, size, size_vram, expires_at, ... }] }
  const refreshLoadedModels = async () => {
    try {
      const r = await fetch(`${url.replace(/\/+$/, '')}/api/ps`);
      if (!r.ok) return;  // 조용히 무시 (배너에서 처리)
      const d = await r.json();
      setLoadedModels(d.models || []);
    } catch {
      // 네트워크 에러 — 조용히 무시
    }
  };

  // ─── 메모리 관리 — 모든 모델 언로딩 ──────────────────
  // 정책: 동시에 1개 모델만 보관. 새 모델 로딩 전, 기존 모델 모두 해제.
  // 기법: /api/generate 에 keep_alive=0 으로 호출 → Ollama 가 즉시 메모리 해제
  //       (빈 prompt 라 추론 X, 단순 메모리 정리 명령)
  const unloadAllModels = async () => {
    setMemBusy(true);
    setMemError('');
    try {
      // 현재 메모리 상태 한 번 더 조회 (혹시 다른 클라이언트가 로딩했을 수도)
      const psRes = await fetch(`${url.replace(/\/+$/, '')}/api/ps`);
      const psData = psRes.ok ? await psRes.json() : { models: [] };
      const toUnload = psData.models || [];
      // 각 모델에 대해 keep_alive=0 으로 generate 호출 → 즉시 해제
      // 병렬 처리로 빠르게 (Promise.all)
      await Promise.all(toUnload.map(m =>
        fetch(`${url.replace(/\/+$/, '')}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m.name, keep_alive: 0 }),
        }).catch(() => {})  // 일부 실패해도 나머지는 진행
      ));
      // 해제 후 상태 갱신 (UI 즉시 반영)
      await refreshLoadedModels();
    } catch (err) {
      setMemError(`해제 실패: ${err.message}`);
    } finally {
      setMemBusy(false);
    }
  };

  // ─── 메모리 관리 — 선택한 모델 로딩 (차단형 단일 모델 정책) ───
  // 정책 (사용자 명시 요청 — 2026-05-03):
  //   - 다른 모델이 메모리에 있으면 → 자동 해제 X. 차단 + 명확한 안내 메시지
  //     사용자가 직접 [🗑️ 모두 해제] 후 다시 시도해야 함
  //   - 같은 모델이 이미 있으면 → 안내만 (불필요한 재로드 방지)
  //   - 메모리 비어있으면 → 정상 로드 (keep_alive=-1, 수동 해제까지 유지)
  // 이유: 사용자가 모델 변경을 명확히 인지하도록 — 큰 모델 자동 교체 시
  //       메모리 사용량 변동을 모르고 다른 작업이 느려지는 것 방지
  const loadSelectedModel = async () => {
    if (!model) return;
    setMemError('');

    // 1) 현재 메모리 상태 조회 (최신 정보로 판단)
    let inMemory = [];
    try {
      const psRes = await fetch(`${url.replace(/\/+$/, '')}/api/ps`);
      const psData = psRes.ok ? await psRes.json() : { models: [] };
      inMemory = psData.models || [];
      setLoadedModels(inMemory);  // UI 동기화
    } catch {
      inMemory = loadedModels;  // 네트워크 실패 시 마지막 알려진 상태 사용
    }

    // 2) 케이스 분기 — 차단 vs 진행
    // 케이스 A: 같은 모델이 이미 로드됨 → 안내만, 추가 작업 X
    if (inMemory.some(m => m.name === model)) {
      setMemError(`ℹ️ [${model}] 모델이 이미 메모리에 로드되어 있습니다. 바로 추론 호출하시면 됩니다.`);
      return;
    }
    // 케이스 B: 다른 모델이 이미 있음 → ❌ 차단 + 명확한 다음 액션 안내
    if (inMemory.length > 0) {
      const otherNames = inMemory.map(m => m.name).join(', ');
      setMemError(
        `❌ 단일 모델 정책 — 이미 [${otherNames}] 모델이 메모리에 있습니다.\n` +
        `먼저 위의 [🗑️ 모두 해제] 버튼을 눌러 기존 모델을 메모리에서 제거한 후, ` +
        `다시 [📥 로딩] 버튼을 눌러주세요.`
      );
      return;
    }

    // 케이스 C: 메모리 비어있음 → 정상 로드 진행
    setMemBusy(true);
    try {
      // 빈 prompt + keep_alive=-1 → Ollama 가 추론 없이 모델만 메모리에 올림 (영구 유지)
      const r = await fetch(`${url.replace(/\/+$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: -1 }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      await refreshLoadedModels();
    } catch (err) {
      setMemError(`로딩 실패: ${err.message}`);
    } finally {
      setMemBusy(false);
    }
  };

  // QuestionPicker 가 문항 로딩 담당
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
      // PromptEditor customMessages 우선
      const baseMessages = customMessages || buildLabMessages(question);
      // Qwen 한국어 강제 + thinking 비활성 (idempotent — 한국어 force 가 들어있으면 skip)
      let messages = applyQwenStrict(baseMessages, model);
      // REBUILD41 — Qwen 외 한국어 강 모델 (⭐3+) 도 한국어 lock 적용
      //   사용자 보고: Gemma 4 가 reasoning 을 영문으로 출력 → 시스템 프롬프트 한국어 강제 누락이 원인
      //   대상: korean_strength ≥ 3 (Gemma 4/3, Solar, EEVE, GPT-OSS, Qwen 2.5 등)
      //   Qwen 은 applyQwenStrict 가 이미 처리했으므로 중복 적용 회피 (isQwenModel 체크)
      if (!isQwenModel(model) && (currentModel?.korean_strength || 0) >= 3) {
        messages = applyKoreanLock(messages);
      }
      const ollamaBody = {
        model,
        messages,
        stream: false,
        options: { num_predict: maxTokens, temperature },
        // 단일 모델 정책 — keep_alive=-1 (수동 해제까지 메모리 유지)
        // Ollama 기본값 5m 대신 사용자 의도 존중. UI 의 [📥 로딩] 과 정합.
        keep_alive: -1,
      };
      // REBUILD39 — thinking 옵션 결정 (사용자 토글 우선 → 모델 메타 auto → Qwen 안전망)
      //   1) 사용자가 'on'/'off' 로 명시 → 그대로 적용
      //   2) 'auto' 일 때 → 모델 메타의 think_default 사용
      //      (예: DeepSeek R1 → true, Qwen 3.5 → false. resolveAutoThink 가 결정)
      //   3) 메타 없는 모델 + Qwen 패밀리 → 안전망 false (REBUILD33 §33.8 빈 응답 방지)
      if (thinkMode === 'on') {
        ollamaBody.think = true;
      } else if (thinkMode === 'off') {
        ollamaBody.think = false;
      } else {
        const auto = resolveAutoThink(currentModel);
        if (auto !== undefined) ollamaBody.think = auto;
        else if (isQwenModel(model)) ollamaBody.think = false;
      }
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
      // REBUILD39 — content 빈 응답 시 thinking 필드로 fallback (gemma4 / DeepSeek R1 류 대응)
      //   Ollama 0.11+ 부터 <think> 블록을 message.thinking 으로 분리해서 content 가 비어 보이는 케이스가 있음.
      //   사용자가 무엇이라도 볼 수 있게 thinking 도 노출하되, 어느 필드인지 명확히 라벨링.
      const contentText = d.message?.content || '';
      const thinkingText = d.message?.thinking || '';
      let merged;
      if (contentText && thinkingText) {
        merged = `[💭 thinking]\n\n${thinkingText}\n\n[💬 answer]\n\n${contentText}`;
      } else if (contentText) {
        merged = contentText;
      } else if (thinkingText) {
        merged = `[💭 thinking 응답 (content 비어있음)]\n\n${thinkingText}`;
      } else {
        merged = '';
      }
      setAnswer(merged || '(빈 응답)');
      setMeta({
        total_ms: Date.now() - t0Ref.current,
        eval_count: d.eval_count,
        eval_duration_ms: d.eval_duration ? Math.round(d.eval_duration / 1e6) : null,
      });
      // 추론 후 메모리 상태 갱신 — 첫 호출이면 새로 로딩됐을 것이므로 UI 반영
      refreshLoadedModels();
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

  // REBUILD39 — 선택된 모델의 메타데이터 (브릿지 전용 카탈로그)
  //   사용자가 ollama list 로 받은 임의의 태그(예: "qwen3:4b") 를 family prefix 로 매칭.
  //   미지원 패밀리는 빈 메타 → 정보 카드 자동 미표시 / thinking 토글 비활성.
  const currentModel = getOllamaModelMeta(model);

  // 사용자 OS 별 Ollama 실행/재시작 명령어 — 상태 배너에서 노출
  const os = detectOS();
  const startCmdByOs = {
    mac: 'open -a Ollama   # 또는 메뉴바 🦙 클릭',
    windows: 'Start-Process "C:\\Program Files\\Ollama\\ollama.exe"',
    linux: 'sudo systemctl start ollama   # 또는 ollama serve &',
    unknown: 'ollama serve &',
  };
  const osLabel = { mac: '🍎 macOS', windows: '🪟 Windows', linux: '🐧 Linux', unknown: '💻' }[os];

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">🖥️ 사용자 PC 추론 (Ollama)</h1>
        <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
      </header>

      {/* 페이지 진입 시 자동 ping 결과 — Ollama 상태 한눈에 표시 */}
      {/* 3가지 상태: ⏳ 확인 중 / ✅ 연결됨 / ❌ 미실행 */}
      {pinging && !pingResult && (
        <div className="rounded-xl border border-border bg-card-bg p-3 flex items-center gap-2 text-xs text-text-secondary">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>⏳ Ollama 상태 확인 중…</span>
        </div>
      )}
      {pingResult?.ok && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 p-3">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
            ✅ Ollama 연결됨
          </p>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-200 mt-0.5">
            버전 <b>{pingResult.version}</b> · 모델 <b>{pingResult.tagCount}개</b> 사용 가능
          </p>
        </div>
      )}
      {pingResult && !pingResult.ok && (
        <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 space-y-2">
          <p className="text-sm font-bold text-red-900 dark:text-red-100">
            ❌ Ollama 가 실행되지 않았어요
          </p>
          <p className="text-[11px] text-red-800 dark:text-red-200">
            Ollama 가 설치되어 있어도 꺼져 있으면 호출할 수 없어요. 아래 방법으로 켜주세요:
          </p>
          <div className="bg-white dark:bg-black/30 rounded p-2 text-[11px]">
            <p className="font-semibold text-text mb-1">{osLabel} — Ollama 켜기</p>
            <code className="block text-text font-mono text-[10.5px] break-all">{startCmdByOs[os]}</code>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={ping}
              disabled={pinging}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              {pinging ? '확인 중…' : '🔄 다시 확인'}
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              ❓ 자세한 설치 가이드
            </button>
          </div>
          <p className="text-[10px] text-red-700 dark:text-red-300 opacity-80 pt-0.5">
            💡 콘솔에 빨간 에러가 뜨는 건 정상이에요 — Ollama 가 꺼져 있을 때 브라우저가 자동으로 남기는 로그입니다.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 px-3 py-2 text-[11px] text-violet-900 dark:text-violet-200 leading-relaxed">
        🖥️ <b>사용자 PC 에 설치된 Ollama 직접 호출</b> — RAM 충분 시 대형 모델 (70B 등) 가능. 브라우저에서 <code>localhost:11434</code> 로 fetch.
        데스크톱 전용 (모바일 X). 처음 설정 시 아래 <b>❓ 도움말</b> 참조 (이후 자동 연결).
      </div>

      {/* 도움말 카드 (펼침 토글) — OS별 재시작/검증 포함 */}
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
                ✅ 위 6 단계 완료 후 페이지 새로고침 → 상단 자동 연결 상태 확인됨. 새 모델은 <b>🔄 모델 목록 새로고침</b> 으로 추가
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 🛠️ 문제 해결 팁 — 사용자 보고 케이스 기반
          - CORS 보안 강화 (* 대신 특정 origin)
          - 데스크톱 앱 vs Homebrew 설치 차이
          - 재시작 명령 3가지 (osascript / pkill / 메뉴바)
          - 환경변수 적용 검증 (curl)
          - 영구 저장 (LaunchAgent plist)
          - 자주 보는 에러 해석 */}
      <div className="rounded-xl border border-border bg-card-bg">
        <button
          type="button"
          onClick={() => setShowTroubleshoot(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-text"
        >
          <span>🛠️ 문제 해결 팁 — 자주 막히는 곳 (CORS / 재시작 / 영구 저장 / 에러 해석)</span>
          <span className="text-text-secondary">{showTroubleshoot ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {showTroubleshoot && (
          <div className="px-3 pb-3 border-t border-border space-y-4 text-[11px] text-text-secondary leading-relaxed">

            {/* Tip 1 — CORS 보안 강화 */}
            <div>
              <p className="font-bold text-text mt-2">💡 Tip 1 — CORS 보안 강화 (<code className="bg-bg px-1 rounded">*</code> 대신 특정 origin)</p>
              <p className="text-[10px] mb-1.5">
                <code className="bg-bg px-1 rounded">OLLAMA_ORIGINS=*</code> 는 모든 사이트에서 내 PC Ollama 호출 허용 → 보안 위험.
                실제 사용하는 사이트만 콤마로 명시 권장.
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mb-1">⚠️ 보안 위험 — 모든 사이트 허용</p>
              <CodeBlock code={`launchctl setenv OLLAMA_ORIGINS "*"`} />
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1.5 mb-1">✅ 권장 — 이 페이지 + 로컬 개발만 허용</p>
              <CodeBlock code={`launchctl setenv OLLAMA_ORIGINS "${typeof window !== 'undefined' ? window.location.origin : 'https://your-site.run.app'},http://localhost:5173,http://localhost:3000"`} />
              <p className="text-[10px] opacity-80 mt-1">
                💡 Origin 형식: <code className="bg-bg px-1 rounded">프로토콜://호스트:포트</code> 까지만 (경로 ❌, 끝 슬래시 ❌).
                여러 개는 콤마로 구분, 공백 없이.
              </p>
            </div>

            {/* Tip 2 — 데스크톱 앱 vs Homebrew 설치 차이 */}
            <div>
              <p className="font-bold text-text">💡 Tip 2 — Ollama 설치 방법 차이 (재시작 명령이 다름)</p>
              <table className="w-full mt-1 text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 font-semibold text-text">설치 방법</th>
                    <th className="text-left py-1 font-semibold text-text">확인 명령</th>
                    <th className="text-left py-1 font-semibold text-text">재시작 방법</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1">데스크톱 앱<br/>(ollama.com .dmg)</td>
                    <td className="py-1"><code className="bg-bg px-1 rounded">ls /Applications/Ollama.app</code></td>
                    <td className="py-1">AppleScript / open<br/>(brew 명령 ❌)</td>
                  </tr>
                  <tr>
                    <td className="py-1">Homebrew<br/>(brew install)</td>
                    <td className="py-1"><code className="bg-bg px-1 rounded">brew list ollama</code></td>
                    <td className="py-1"><code className="bg-bg px-1 rounded">brew services restart ollama</code></td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[10px] opacity-80 mt-1.5">
                🚨 <b>"Formula `ollama` is not installed"</b> 에러는 <b>데스크톱 앱으로 설치</b>했다는 신호.
                Homebrew 가 그 앱을 모르는 것뿐이니 정상. 아래 Tip 3 의 AppleScript 방식 사용.
              </p>
            </div>

            {/* Tip 3 — 재시작 3가지 방법 */}
            <div>
              <p className="font-bold text-text">💡 Tip 3 — Ollama 재시작 명령 (상황별 3가지)</p>
              <p className="text-[10px] mb-1.5">
                환경변수 변경 후 <b>반드시 재시작</b> 필요 — 이미 떠있던 Ollama 는 옛 환경변수로 작동 중.
              </p>

              <p className="text-[10.5px] font-semibold mt-1.5">⭐ 권장 — 정중한 종료 (AppleScript)</p>
              <CodeBlock code={`osascript -e 'quit app "Ollama"' && sleep 2 && open -a Ollama`} />
              <p className="text-[10px] opacity-80 mt-0.5">
                ✓ 앱이 정리(임시 파일, 진행 중 다운로드 등) 후 종료 → 안전. 평소 사용.
              </p>

              <p className="text-[10.5px] font-semibold mt-2">🚨 강제 종료 — 앱이 응답 없을 때만</p>
              <CodeBlock code={`pkill -x Ollama && sleep 2 && open -a Ollama`} />
              <p className="text-[10px] opacity-80 mt-0.5">
                ✓ <code className="bg-bg px-1 rounded">-x</code> = 정확히 'Ollama' 이름인 프로세스만 (안전).
                응답 없으면 <code className="bg-bg px-1 rounded">pkill -9 -x Ollama</code> 로 강제 시그널.
              </p>

              <p className="text-[10.5px] font-semibold mt-2">🖱️ 수동 — 메뉴바에서</p>
              <p className="text-[10px] pl-2">
                ① 화면 우상단 🦙 클릭 → <b>"Quit Ollama"</b><br/>
                ② Launchpad / Spotlight (⌘+Space) → "Ollama" 입력 → 엔터<br/>
                ③ 메뉴바 🦙 다시 나타나면 시작 완료
              </p>
            </div>

            {/* Tip 4 — 환경변수 적용 검증 */}
            <div>
              <p className="font-bold text-text">💡 Tip 4 — 환경변수가 진짜 적용됐는지 검증</p>
              <p className="text-[10px] mb-1.5">
                재시작 후 두 단계로 확인 — <b>(A) 시스템 등록</b> + <b>(B) Ollama 가 실제 적용했는지</b>.
              </p>

              <p className="text-[10.5px] font-semibold mt-1.5">A) 시스템 환경변수 등록 확인</p>
              <CodeBlock code={`launchctl getenv OLLAMA_ORIGINS`} />
              <p className="text-[10px] opacity-80 mt-0.5">
                ✓ 등록한 값이 그대로 출력돼야 OK. 빈 줄이면 setenv 실패.
              </p>

              <p className="text-[10.5px] font-semibold mt-2">B) Ollama 가 CORS 헤더 내려주는지 (가장 중요!)</p>
              <CodeBlock code={`curl -H "Origin: ${typeof window !== 'undefined' ? window.location.origin : 'https://your-site.run.app'}" -I http://localhost:11434/api/version`} />
              <p className="text-[10px] opacity-80 mt-0.5">
                ✓ 응답에 <code className="bg-bg px-1 rounded">Access-Control-Allow-Origin: ...</code> 헤더가 있어야 OK.<br/>
                ✗ 헤더 없으면 → Ollama 가 옛 환경변수로 작동 중 (재시작 다시).
              </p>

              <p className="text-[10.5px] font-semibold mt-2">📋 일괄 점검 — 한 번에 다 확인</p>
              <CodeBlock code={`echo "=== 1) 환경변수 ===" && launchctl getenv OLLAMA_ORIGINS
echo "=== 2) Ollama 응답 ===" && curl -s http://localhost:11434/api/version
echo "=== 3) CORS 헤더 ===" && curl -s -H "Origin: ${typeof window !== 'undefined' ? window.location.origin : 'https://your-site.run.app'}" -I http://localhost:11434/api/version | grep -i "access-control"`} />
            </div>

            {/* Tip 5 — LaunchAgent plist 영구 저장 */}
            <div>
              <p className="font-bold text-text">💡 Tip 5 — 재부팅 후에도 자동 적용 (LaunchAgent plist)</p>
              <p className="text-[10px] mb-1.5">
                <code className="bg-bg px-1 rounded">launchctl setenv</code> 는 <b>재부팅 시 사라짐</b>.
                매번 다시 입력하기 귀찮으면 plist 파일로 영구화. 한 번만 셋업하면 평생 자동.
              </p>

              <p className="text-[10.5px] font-semibold mt-1.5">① 셋업 스크립트 (한 번에 실행)</p>
              <CodeBlock code={`mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.ollama.origins.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ollama.origins</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/launchctl</string>
        <string>setenv</string>
        <string>OLLAMA_ORIGINS</string>
        <string>${typeof window !== 'undefined' ? window.location.origin : 'https://your-site.run.app'},http://localhost:5173,http://localhost:3000</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
chmod 644 ~/Library/LaunchAgents/com.ollama.origins.plist
plutil -lint ~/Library/LaunchAgents/com.ollama.origins.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ollama.origins.plist
launchctl getenv OLLAMA_ORIGINS`} />
              <p className="text-[10px] opacity-80 mt-1">
                ✓ 마지막 출력에 등록한 origin 들이 보이면 성공. <code className="bg-bg px-1 rounded">plutil -lint</code> 가 "OK" 안 내면 XML 오타 의심.
              </p>

              <p className="text-[10.5px] font-semibold mt-2">② 값 변경 시 (unload → 수정 → load 순서)</p>
              <CodeBlock code={`launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ollama.origins.plist
nano ~/Library/LaunchAgents/com.ollama.origins.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ollama.origins.plist
osascript -e 'quit app "Ollama"' && sleep 2 && open -a Ollama`} />

              <p className="text-[10.5px] font-semibold mt-2">③ 완전 제거 시</p>
              <CodeBlock code={`launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ollama.origins.plist
rm ~/Library/LaunchAgents/com.ollama.origins.plist`} />

              <p className="text-[10px] opacity-80 mt-1.5">
                ⚠️ <b>주의 함정</b> — Ollama 가 로그인 시 자동시작 켜져 있으면 plist 보다 먼저 켜질 수 있음 (race condition).
                해결 → 시스템 설정 → 일반 → 로그인 항목 에서 Ollama 제거 권장.
              </p>
            </div>

            {/* Tip 6 — 자주 보는 에러 해석 */}
            <div>
              <p className="font-bold text-text">💡 Tip 6 — 자주 보는 에러 메시지 해석</p>
              <table className="w-full mt-1 text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 font-semibold text-text">에러 메시지</th>
                    <th className="text-left py-1 font-semibold text-text">원인</th>
                    <th className="text-left py-1 font-semibold text-text">해결</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2"><code className="bg-bg px-1 rounded text-[9.5px]">Formula `ollama` is not installed</code></td>
                    <td className="py-1 pr-2">데스크톱 앱 설치 (brew 아님)</td>
                    <td className="py-1">Tip 3 의 osascript 방식</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2"><code className="bg-bg px-1 rounded text-[9.5px]">Application isn't running</code></td>
                    <td className="py-1 pr-2">Ollama 가 이미 꺼져있음</td>
                    <td className="py-1"><code className="bg-bg px-1 rounded">open -a Ollama</code> 만</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2"><code className="bg-bg px-1 rounded text-[9.5px]">Can't get application "Ollama"</code></td>
                    <td className="py-1 pr-2">앱 이름이 다름</td>
                    <td className="py-1"><code className="bg-bg px-1 rounded">ls /Applications | grep -i ollama</code> 로 정확 이름 확인</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2"><code className="bg-bg px-1 rounded text-[9.5px]">No 'Access-Control-Allow-Origin' header</code></td>
                    <td className="py-1 pr-2">CORS 환경변수 미적용</td>
                    <td className="py-1">setenv 후 <b>Ollama 재시작 필수</b></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2"><code className="bg-bg px-1 rounded text-[9.5px]">net::ERR_FAILED 403</code></td>
                    <td className="py-1 pr-2">CORS 또는 mixed content</td>
                    <td className="py-1">Tip 1 + 위 6단계 가이드 6️⃣</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-2"><code className="bg-bg px-1 rounded text-[9.5px]">net::ERR_CONNECTION_REFUSED</code></td>
                    <td className="py-1 pr-2">Ollama 가 안 켜져 있음</td>
                    <td className="py-1"><code className="bg-bg px-1 rounded">open -a Ollama</code> + <code className="bg-bg px-1 rounded">curl localhost:11434/api/version</code> 확인</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2"><code className="bg-bg px-1 rounded text-[9.5px]">Bootstrap failed: 5: Input/output error</code></td>
                    <td className="py-1 pr-2">plist 이미 등록됨 (중복)</td>
                    <td className="py-1"><code className="bg-bg px-1 rounded">launchctl bootout</code> 먼저 후 재등록</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 마무리 안내 */}
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-2 mt-2">
              <p className="text-blue-800 dark:text-blue-200">
                💬 <b>그래도 안 풀리면</b> — 다음 3가지 결과를 함께 알려주세요:<br/>
                ① <code className="bg-bg px-1 rounded">launchctl getenv OLLAMA_ORIGINS</code> 출력<br/>
                ② <code className="bg-bg px-1 rounded">curl -I http://localhost:11434/api/version</code> 응답 헤더 전체<br/>
                ③ 브라우저 콘솔 에러 메시지 (DevTools → Console)
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
        {/* 연결 테스트 후 받은 모델 목록에서 선택 (자유 입력 X) */}
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-text-secondary">
            모델 선택
            {!pingResult?.ok && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">⚠ Ollama 연결 안 됨 (페이지 새로고침)</span>
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
              placeholder="Ollama 연결 후 자동 활성화"
              className="rounded px-2 py-1.5 border border-border bg-card-bg text-text-secondary text-sm font-mono cursor-not-allowed opacity-60"
            />
          )}
        </label>

        {/* 라벨 명확화. 자동 ping 도입(상단 배너) 후
            이 버튼의 진짜 역할은 "ollama pull 로 새 모델 받은 직후 select 옵션 갱신". */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={ping}
            disabled={pinging}
            title="ollama pull 로 새 모델을 받은 직후 select 옵션에 추가하려면 클릭. 연결 상태는 페이지 진입 시 자동 확인됨."
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold"
          >
            {pinging ? '확인 중…' : '🔄 모델 목록 새로고침'}
          </button>
          {savedAt && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ 저장됨</span>
          )}
        </div>

        {/* 상단 자동 배너와 정보 중복 회피.
            성공 시: 짧게 모델 개수만 (전체 상태는 상단 ✅ 배너에 있음)
            실패 시: 에러 사유 (상단 배너의 OS별 안내와 보완) */}
        {pingResult && (
          <div className={`mt-1 rounded p-2 text-[11px] ${
            pingResult.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}>
            {pingResult.ok
              ? `✓ 모델 ${pingResult.tagCount}개 갱신됨`
              : `❌ ${pingResult.error}`}
          </div>
        )}

        {/* mixed content 경고: ping 성공 시 자동 숨김 (이미 통과한 케이스) */}
        {mixedContentRisk && !pingResult?.ok && (
          <div className="rounded p-2 text-[10.5px] bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200">
            ⚠ HTTPS 페이지에서 http://localhost 호출 — 브라우저가 mixed content 로 차단할 수 있어요. 위 도움말 6번 참고.
          </div>
        )}
      </div>

      {/* REBUILD40 — 사용자 PC Ollama 상태 카드 (정보 전용)
          기존 메모리 관리 카드와 분리: 정보 vs 동작.
          데이터: loadedModels (/api/ps) + models (/api/tags) + navigator.deviceMemory.
          노출 조건: Ollama 연결 OK 일 때. */}
      {pingResult?.ok && (
        <OllamaPcStatusCard
          loadedModels={loadedModels}
          diskModels={models}
          ollamaVersion={pingResult?.version}
          onRefresh={async () => {
            await ping();
            await refreshLoadedModels();
          }}
        />
      )}

      {/* ─── 메모리 관리 카드 — 단일 모델 정책 (사용자 PC RAM 보호) ─── */}
      {/* 표시 조건: Ollama 연결 OK 인 경우만 — 미연결이면 의미 없음 */}
      {pingResult?.ok && (
        <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-text">🧠 메모리 관리 — 모델 로드/해제</p>
            <button
              type="button"
              onClick={refreshLoadedModels}
              className="text-[10px] text-text-secondary hover:text-primary"
              title="현재 메모리에 로딩된 모델 목록 갱신 (다른 클라이언트가 변경했을 수도)"
            >
              🔄 메모리 상태 새로고침
            </button>
          </div>

          {/* 현재 로딩된 모델 표시 */}
          {loadedModels.length === 0 ? (
            <div className="rounded p-2 bg-bg text-[11px] text-text-secondary text-center">
              ⚪ 메모리 비어있음 — 모델이 로딩되지 않았습니다
            </div>
          ) : (
            <div className="space-y-1">
              {loadedModels.map(m => {
                // size_vram (GPU) + size (전체) — Ollama 응답 기반
                const totalGb = (m.size / 1e9).toFixed(2);
                const vramGb = m.size_vram ? (m.size_vram / 1e9).toFixed(2) : null;
                return (
                  <div key={m.name} className="rounded p-2 bg-emerald-50 dark:bg-emerald-900/30 text-[11px] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-emerald-900 dark:text-emerald-100">✅ {m.name}</p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                        {totalGb} GB{vramGb ? ` · GPU ${vramGb} GB` : ' · CPU 만'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 차단/허용 상태 사전 판단 — UI 활성화 + 시각적 피드백 */}
          {/* alreadyLoaded: 같은 모델이 이미 메모리에 있음 → 재로드 불필요 */}
          {/* blockedByOther: 다른 모델이 점유 중 → 로딩 차단, 먼저 [🗑️ 해제] 필요 */}
          {(() => {
            const alreadyLoaded = loadedModels.some(m => m.name === model);
            const blockedByOther = loadedModels.length > 0 && !alreadyLoaded;
            const otherNames = blockedByOther ? loadedModels.map(m => m.name).join(', ') : '';
            return (
              <>
                {/* 사전 경고 — 차단 상태일 때 클릭 전에 보여줌 */}
                {blockedByOther && (
                  <div className="rounded p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-[10.5px] text-amber-900 dark:text-amber-200 leading-relaxed">
                    ⚠️ <b>다른 모델 [{otherNames}] 이 메모리에 있습니다.</b>
                    <br />
                    단일 모델 정책에 따라 새 모델을 로딩하려면, 먼저 아래 <b>[🗑️ 모두 해제]</b> 버튼을 눌러 기존 모델을 해제해야 합니다.
                  </div>
                )}

                {/* 액션 버튼 — 로딩 / 해제 */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={loadSelectedModel}
                    disabled={memBusy || !model || blockedByOther || alreadyLoaded}
                    className="flex-1 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold"
                    title={
                      blockedByOther
                        ? `차단됨: 먼저 [${otherNames}] 모델을 해제하세요`
                        : alreadyLoaded
                        ? '이미 로드되어 있습니다'
                        : `${model} 을 메모리에 로딩`
                    }
                  >
                    {memBusy
                      ? '⏳ 처리 중…'
                      : alreadyLoaded
                      ? `✅ [${model}] 이미 로드됨`
                      : blockedByOther
                      ? `🚫 [${model}] 로딩 차단 — 먼저 해제 필요`
                      : `📥 [${model}] 메모리에 로딩`}
                  </button>
                  <button
                    type="button"
                    onClick={unloadAllModels}
                    disabled={memBusy || loadedModels.length === 0}
                    className="px-3 py-2 rounded-lg border border-border bg-bg hover:bg-card-bg disabled:opacity-50 text-text text-xs font-bold"
                    title="메모리에 로딩된 모든 모델 즉시 해제"
                  >
                    🗑️ 모두 해제
                  </button>
                </div>
              </>
            );
          })()}

          {/* 메모리 작업 에러/안내 표시 */}
          {memError && (
            <div className="rounded p-2 bg-red-50 dark:bg-red-900/30 text-[10.5px] text-red-800 dark:text-red-200 whitespace-pre-line">
              {memError}
            </div>
          )}

          {/* 정책 안내 — 기술 용어 풀어쓰기 */}
          <div className="rounded p-2 bg-bg border border-border text-[10px] text-text-secondary leading-relaxed">
            ℹ️ <b>단일 모델 정책 (차단형)</b> — 동시에 1개 모델만 메모리에 보관합니다.
            다른 모델이 이미 로딩되어 있으면 새 모델 로딩이 차단되며,
            먼저 [🗑️ 모두 해제] 후 다시 시도해야 합니다.
            <br />
            로드된 모델은 <b>사용자가 직접 해제할 때까지 메모리에 계속 유지</b>됩니다 (Ollama 기본 5분 자동 언로드 비활성).
          </div>

          {/* 페이지 이탈 시 자동 해제 토글 */}
          <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoUnloadOnLeave}
              onChange={e => setAutoUnloadOnLeave(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            <span>
              <b>페이지 떠날 때 자동 해제</b>
              <span className="text-text-secondary ml-1">(다른 페이지로 이동 시 메모리 자동 정리)</span>
            </span>
          </label>
        </div>
      )}

      {/* REBUILD40 — 참고용 Cloud Run 서버 메모리 카드
          ⚠ 브릿지는 사용자 PC 에서 추론하므로 서버 메모리는 추론 성능과 무관.
            이 페이지는 SPA 호스팅용 컨테이너만 사용 (api/auth, api/questions 등 메타 API).
          노출 이유: 사용자가 통합/분리 서버에 익숙하면 같은 정보를 한 곳에서 보고 싶어함.
          기본 닫힘 상태로 두 카드 모두 펼침 토글 → 클릭 시 lazy fetch.
          기존 MemoryCard 컴포넌트 100% 재사용 (lazy 로드 / 새로고침 / 액션 모두 동일). */}
      <div className="rounded-xl border border-dashed border-border/60 bg-bg/30 p-2.5 space-y-2">
        <p className="text-[11px] text-text-secondary leading-relaxed">
          ℹ️ <b>참고용</b> — 아래는 Cloud Run 서버 메모리입니다.
          브릿지는 <b>사용자 PC 에서 추론</b>하므로 서버 메모리는 추론 성능과 무관해요
          (서버는 SPA 호스팅 + 메타 API 만 담당).
          비교/디버깅용으로만 펼쳐보세요.
        </p>
        <MemoryCard
          title="📊 (참고) 통합 서버 — aitutor"
          service="aitutor"
          endpoint="/api/local-infer?action=memory"
        />
        <MemoryCard
          title="📊 (참고) 분리 서버 — aitutor-server-infer"
          service="aitutor-server-infer"
          endpoint="/api/iso-infer?action=memory"
        />
      </div>

      {/* REBUILD39 — 선택 모델 상세 정보 카드 (capabilities / 권장 파라미터 / 한국어 강도 / 팁)
          노출 조건: 메타 카탈로그에서 매칭된 모델만. 알 수 없는 태그면 자동 숨김. */}
      {currentModel && (currentModel.capabilities || currentModel.tips) && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-900/20 p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-violet-900 dark:text-violet-200">
              🔍 {currentModel.name} 상세 정보
            </p>
            <span className="text-[10px] text-violet-700 dark:text-violet-300 font-mono">
              {currentModel.org}{currentModel.size ? ` · ${currentModel.size}` : ''} · <span className="opacity-80">{model}</span>
            </span>
          </div>

          {/* 한국어 강도 (별점) */}
          {typeof currentModel.korean_strength === 'number' && (
            <div className="text-[11px] text-violet-900 dark:text-violet-200 flex items-center gap-2 flex-wrap">
              <span>🌐 한국어 강도</span>
              <span className={`font-mono tracking-wider ${currentModel.korean_strength <= 2 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {'⭐'.repeat(currentModel.korean_strength)}
                <span className="opacity-30">{'⭐'.repeat(5 - currentModel.korean_strength)}</span>
              </span>
              <span className="text-[10px] opacity-70">({currentModel.korean_strength}/5)</span>
            </div>
          )}

          {/* Capabilities 칩 */}
          {currentModel.capabilities && (
            <div className="flex flex-wrap gap-1">
              {currentModel.capabilities.think_supported && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 font-bold">
                  💭 thinking 지원
                </span>
              )}
              {currentModel.capabilities.multimodal && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-200 font-bold">
                  🖼️ multimodal
                </span>
              )}
              {currentModel.capabilities.tools && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-200 font-bold">
                  🛠️ tools
                </span>
              )}
              {currentModel.capabilities.coder && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold">
                  💻 코드 특화
                </span>
              )}
              {currentModel.capabilities.context_k && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 font-bold">
                  📜 {currentModel.capabilities.context_k}K context
                </span>
              )}
            </div>
          )}

          {/* 권장 파라미터 */}
          {currentModel.params && Object.keys(currentModel.params).length > 0 && (
            <div className="text-[10px] text-violet-900 dark:text-violet-200 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="font-bold">📊 권장:</span>
              {currentModel.params.temperature != null && (
                <span>temp <code className="font-mono">{currentModel.params.temperature}</code></span>
              )}
              {currentModel.params.top_p != null && (
                <span>top_p <code className="font-mono">{currentModel.params.top_p}</code></span>
              )}
              {currentModel.params.repeat_penalty != null && (
                <span>repeat_penalty <code className="font-mono">{currentModel.params.repeat_penalty}</code></span>
              )}
            </div>
          )}

          {/* 팁 */}
          {currentModel.tips && (
            <p className="text-[11px] text-violet-900 dark:text-violet-100 leading-relaxed bg-violet-100/40 dark:bg-violet-950/30 rounded-md px-2.5 py-1.5">
              💡 {currentModel.tips}
            </p>
          )}
        </div>
      )}

      {/* 추론 옵션 — REBUILD39 §39 ParamSliders 통합 (max_tokens + temperature + thinking 토글)
          thinking 토글은 모델이 think_supported 일 때만 노출 (그 외에는 자동 숨김). */}
      <ParamSliders
        temperature={temperature}
        onTemperatureChange={setTemperature}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        disabled={running}
        thinkMode={thinkMode}
        onThinkModeChange={setThinkMode}
        thinkSupported={currentModel?.capabilities?.think_supported || false}
        thinkRecommend={currentModel?.capabilities?.think_default ? 'on' : 'off'}
      />

      {/* 문항 입력 (DB 선택 + 외부 붙여넣기 통합) */}
      <QuestionPicker question={question} onChange={handleQuestionChange} />

      {/* PromptEditor (섹션별 편집) */}
      {question && pingResult?.ok && (
        <PromptEditor
          question={question}
          model={model}
          running={running}
          onSubmit={(messages) => runInfer(messages)}
          disabled={!pingResult?.ok}
        />
      )}

      {/* 추론 실행 — PromptEditor 의 [✨ 이 프롬프트로 전송] 과 동일 동작 (PromptEditor 가 디폴트 messages 빌드) */}
      {question && (
        <button
          onClick={() => runInfer()}
          disabled={running || !pingResult?.ok}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold"
        >
          {running ? '✨ 생성 중…' : `✨ ${model} 로 해설 생성`}
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

      {/* 에러 — ErrorBanner */}
      <ErrorBanner message={error} icon={null} />

      <p className="text-[11px] text-text-secondary text-center pt-4">
        외부 Ollama bridge — 사용자 PC 의 Ollama 직접 호출 (localhost:11434)
      </p>
    </div>
  );
}
