// 격리 추론 실험실 (server-infer) — Ollama 단일 엔진 격리 service
//
// 구조:
//   격리 service: aitutor-server-infer (별도 Cloud Run, asia-southeast1, 24Gi/6CPU + L4 GPU)
//   인증: 메인 service SA 가 ID Token 발급 → 격리 service /infer 로 forward (--no-allow-unauthenticated)
//   엔진: Ollama 단일, 모델 카드 = Ollama 호환 모델만 표시
//   회사 자산 컨셉 — 다양한 한국어 + 영어 모델 (학습 앱 외 다른 앱도 호출 가능)

import { useState, useEffect, useRef } from 'react';
import QuestionPicker from '../../components/lab/QuestionPicker';
import PromptEditor from '../../components/lab/PromptEditor';
import ParamSliders from '../../components/lab/ParamSliders';
import MemoryCard from '../../components/lab/MemoryCard';
import { buildLabMessages } from '../../lib/lab/promptBuilder';
import {
  DEFAULT_MODEL_KEY,
  LAB_MODELS,
  normalizeLabModels,
} from '../../lib/lab/models';

// 백엔드 응답 도달 전 임시 표시용 fallback. /api/iso-infer?action=models 가 진실 소스.
// LAB_MODELS 중 disabled_engines 에 'ollama' 가 없는 것 = ollama 호환 = 격리 service 노출 가능.
// (이전 m.engines.ollama 체크는 LAB_MODELS 에 engines 필드가 없어 항상 빈 배열이 되던 버그)
const FALLBACK_MODELS = LAB_MODELS.filter(
  m => !(Array.isArray(m.disabled_engines) && m.disabled_engines.includes('ollama'))
);
const FALLBACK_DEFAULT_MODEL_KEY =
  FALLBACK_MODELS.find(m => m.key === DEFAULT_MODEL_KEY)?.key
  || (FALLBACK_MODELS[0] && FALLBACK_MODELS[0].key)
  || DEFAULT_MODEL_KEY;

// REBUILD33 §33 — 카테고리 필터 정의. server.py 의 category 메타와 동기화.
// 동기화 강제 X (REBUILD32 §15 R-3) — 백엔드가 새 카테고리 보내면 '기타' 그룹으로 자동 흡수.
const CATEGORY_META = {
  recommended: { label: '⭐ 추천',   color: 'amber',  description: '카테고리 별 1순위' },
  korean:      { label: '🇰🇷 한국어', color: 'blue',   description: '한국어 자격증 / 다국어 모델' },
  english:     { label: '🇬🇧 영어',   color: 'emerald',description: '영어 자격증 (TOEIC / GCP / AWS)' },
  code:        { label: '💻 코드',    color: 'purple', description: '코드 / SDK 예제' },
  translator:  { label: '🌐 번역',    color: 'emerald',description: '번역 보조 (한↔영 양방향)' },
  all:         { label: '🌏 전체',    color: 'slate',  description: '모든 모델' },
};

// REBUILD33 §33.10 — 번역 보조 파이프라인 상수
const TRANSLATOR_MODEL_KEY = 'qwen25-1.5b';
const TRANSLATOR_DISPLAY_NAME = 'Qwen 2.5 1.5B';
const TRANSLATOR_DISPLAY_SIZE = '~1GB';
// 번역 task 전용 system prompt (low temperature 0.0 + 출력만 반환 강제)
const PROMPT_KO_TO_EN = '당신은 정확한 번역 모델입니다. 입력된 한국어를 자연스러운 영어로 번역하세요. 설명/주석 금지, 번역된 영어만 출력하세요.';
const PROMPT_EN_TO_KO = 'You are an accurate translation model. Translate the input English to natural Korean. No explanation/commentary. Output Korean translation only.';

const TIER_META = {
  light:    { label: '🪶 가벼움',  hint: 'cold start ~30초',  badgeClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' },
  balanced: { label: '⚖ 균형',    hint: 'cold start ~1분',    badgeClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  heavy:    { label: '🐘 큰 모델', hint: 'cold start 1~2분',  badgeClass: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300' },
};

export default function ServerInferTester() {
  const [models,    setModels]    = useState(FALLBACK_MODELS);
  const [modelKey,  setModelKey]  = useState(FALLBACK_DEFAULT_MODEL_KEY);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [meta, setMeta] = useState(null);
  const [running, setRunning] = useState(false);
  // 구조화 에러 — { message, status, code, cause, upstream, elapsedMs, userAction, raw }
  const [error, setError] = useState(null);
  // showAnswer state 는 사용 안 함 (옛 dead state 제거됨)
  const [history, setHistory] = useState([]);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [temperature, setTemperature] = useState(0.3);
  const [catalogError, setCatalogError] = useState('');
  const [healthBusy, setHealthBusy] = useState(false);
  // REBUILD33 §33 — 카테고리 필터: 'recommended' | 'korean' | 'english' | 'code' | 'all'
  const [activeCategory, setActiveCategory] = useState('recommended');
  // REBUILD33 §33.9 — thinking 모드: 'auto' (모델별 권장) | 'on' | 'off'
  const [thinkMode, setThinkMode] = useState('auto');
  // REBUILD33 §33.10 — 번역 보조 모드: 'off' | 'on' (한국어 약 모델 시만 사용)
  const [translateMode, setTranslateMode] = useState('off');
  // 번역 진행 표시 (3단계 파이프라인 진행 중)
  // { stage: '1/3'|'2/3'|'3/3', model_name, message, t0 }
  const [translateProgress, setTranslateProgress] = useState(null);
  const t0Ref = useRef(0);
  // 마지막 요청 보관 (🔁 다시 시도 버튼용)
  const lastReqRef = useRef(null);

  const currentModel = models.find(m => m.key === modelKey) || models[0];

  // REBUILD33 §33.10 — 번역 보조 토글 노출 조건:
  //   1) 모델 한국어 약 (korean_strength ≤ 2)
  //   2) 자기 자신이 번역 보조 모델이 아님 (translator 카테고리 / capabilities.translator!==true)
  //   3) 번역 보조 모델이 카탈로그에 존재 (qwen25-1.5b)
  const translatorAvailable = models.some(m => m.key === TRANSLATOR_MODEL_KEY);
  const translatorSupported =
    !!currentModel
    && currentModel.korean_strength != null
    && currentModel.korean_strength <= 2
    && currentModel.category !== 'translator'
    && !currentModel.capabilities?.translator
    && translatorAvailable;

  // REBUILD33 §33 — 카테고리별 모델 분류 + count
  // 카테고리 메타 누락 시 '기타' 그룹으로 흡수 (백엔드 변경 무방어 운영)
  const categoryCounts = {
    recommended: models.filter(m => m.recommended).length,
    korean:      models.filter(m => m.category === 'korean').length,
    english:     models.filter(m => m.category === 'english').length,
    code:        models.filter(m => m.category === 'code').length,
    all:         models.length,
  };
  const visibleModels = (() => {
    if (activeCategory === 'recommended') return models.filter(m => m.recommended);
    if (activeCategory === 'all')         return models;
    return models.filter(m => m.category === activeCategory);
  })();

  // ─── 초기 로드: 격리 service 카탈로그 (429 cold start retry — 격리 인스턴스 spawn 중 흡수) ─────
  useEffect(() => {
    (async () => {
      const MAX_RETRIES = 3;
      const BASE_DELAY_MS = 2000;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const r = await fetch('/api/iso-infer?action=models', { credentials: 'include' });
          if (r.status === 429 && attempt < MAX_RETRIES - 1) {
            // Cold start retry — 2초, 4초, 8초 대기
            setCatalogError(`격리 service 기동 중... (${attempt + 1}/${MAX_RETRIES} 재시도)`);
            await new Promise(res => setTimeout(res, BASE_DELAY_MS * Math.pow(2, attempt)));
            continue;
          }
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || d.message || `HTTP ${r.status}`);
          // 격리 service /infer/models 응답 = ollama 호환 모델 + 동적 available
          // ⚠ key 기반 매핑 필수 — normalizeLabModels 가 LAB_MODELS 순서로 재정렬하므로
          //   인덱스 i 로 매핑하면 d.models[i] 와 어긋나 다른 모델의 available 이 적용됨.
          const nextModels = Array.isArray(d.models) && d.models.length
            ? (() => {
                const byKey = Object.fromEntries(
                  d.models.filter(s => s && s.key).map(s => [s.key, s])
                );
                return normalizeLabModels(d.models).map(m => ({
                  ...m,
                  available: byKey[m.key]?.available !== false,
                  unavailable_reason: byKey[m.key]?.unavailable_reason || null,
                }));
              })()
            : FALLBACK_MODELS;
          const nextDefaultKey = d.default_model_key || d.default_model || FALLBACK_DEFAULT_MODEL_KEY;
          // default 모델이 unavailable 이면 첫 사용 가능 모델로 fallback
          const nextModelKey =
            nextModels.find(m => m.key === nextDefaultKey && m.available !== false)?.key
            || nextModels.find(m => m.available !== false)?.key
            || nextModels[0]?.key
            || FALLBACK_DEFAULT_MODEL_KEY;

          setModels(nextModels);
          setModelKey(nextModelKey);
          setCatalogError('');  // 성공 시 에러 메시지 클리어
          return;
        } catch (e) {
          if (attempt === MAX_RETRIES - 1) {
            setCatalogError(`카탈로그 로드 실패 (fallback 사용): ${e.message}`);
          }
        }
      }
    })();
  }, []);

  // QuestionPicker 변경 시 응답 클리어
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setAnswer('');
    setMeta(null);
    setError(null);
  };

  // REBUILD33 §33.10 — 단일 /api/iso-infer 호출 헬퍼 (번역 파이프라인 + 일반 추론 공용)
  // 기존 handleRun 의 fetch + 응답 파싱 로직을 함수화. 동작은 100% 동일.
  const callIsoInfer = async ({ model_key, messages, max_tokens, temperature: temp, think, keep_warm }) => {
    const body = { model_key, messages, max_tokens, temperature: temp };
    if (think !== undefined) body.think = think;
    if (keep_warm) body.keep_warm = true;

    let res, rawBody = '', data = null;
    try {
      res = await fetch('/api/iso-infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      return { ok: false, networkError: netErr?.message || 'unknown' };
    }
    try { rawBody = await res.text(); } catch {}
    try { data = JSON.parse(rawBody); } catch { data = null; }
    return { ok: res.ok, status: res.status, data, rawBody };
  };

  // ─── 추론 호출 — 단일 엔진 (engine 파라미터 없음) + 구조화 에러 + 안전한 응답 파싱 ─────
  // REBUILD33 §33.10: translateMode='on' 시 3단계 파이프라인 (한→영 → 추론 → 영→한)
  //                  translateMode='off' (default) 시 기존 단일 호출 동작 100% 보존
  const handleRun = async (customMessages = null) => {
    if (!question) return;
    setAnswer('');
    setMeta(null);
    setError(null);
    setTranslateProgress(null);
    setRunning(true);
    t0Ref.current = Date.now();

    const messages = customMessages || buildLabMessages(question);
    lastReqRef.current = { customMessages };

    // 번역 모드 ON + 한국어 약 모델 (translatorSupported) 시 3단계 파이프라인
    const useTranslate = translateMode === 'on' && translatorSupported;

    if (useTranslate) {
      await runTranslatePipeline(messages);
    } else {
      await runDirectInfer(messages);
    }
    setRunning(false);
    setTranslateProgress(null);
  };

  // 일반 추론 (번역 OFF) — 기존 동작 100% 보존
  const runDirectInfer = async (messages) => {
    const requestBody = {
      model_key: modelKey,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
    if (thinkMode === 'on')  requestBody.think = true;
    if (thinkMode === 'off') requestBody.think = false;

    let res, rawBody = '', data = null;
    try {
      res = await fetch('/api/iso-infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });
    } catch (netErr) {
      const totalMs = Date.now() - t0Ref.current;
      setError({
        message: `브라우저-서버 연결 실패: ${netErr?.message || 'unknown'}`,
        code: 'CLIENT_NETWORK',
        cause: netErr?.message,
        elapsedMs: totalMs,
        userAction: '인터넷 연결 확인 후 다시 시도하거나, [서버 통합] 모드로 시도해주세요.',
      });
      return;
    }
    try { rawBody = await res.text(); } catch {}
    try { data = JSON.parse(rawBody); } catch { data = null; }
    const totalMs = Date.now() - t0Ref.current;

    if (res.ok && data) {
      setAnswer(data.answer || '');
      setMeta({ ...data.meta, client_total_ms: totalMs });
      setHistory(h => [{
        time: new Date().toLocaleTimeString(),
        engine: data.meta?.engine || 'ollama',
        modelKey: data.meta?.model_key,
        infer_ms: data.meta?.infer_ms,
        total_ms: data.meta?.total_ms,
        chars: (data.answer || '').length,
      }, ...h].slice(0, 10));
    } else {
      const detail = data?.detail || {};
      setError({
        message: detail.message || data?.message || data?.error || `HTTP ${res.status}`,
        status: res.status,
        code: detail.error || data?.error || null,
        cause: detail.cause || null,
        upstream: detail.ollama_tag || null,
        elapsedMs: totalMs,
        userAction: res.status === 429
          ? '격리 service 가 cold start 중입니다. 30초 후 다시 시도해주세요.'
          : res.status === 503
            ? 'Ollama 모델 다운로드 또는 service 비활성. 잠시 후 다시 시도하세요.'
            : '다시 시도하거나 다른 모델을 선택해보세요.',
        raw: rawBody?.slice(0, 1500) || null,
      });
    }
  };

  // REBUILD33 §33.10 — 번역 보조 파이프라인 (3단계, 모델별 keep_warm=True 로 unload skip)
  const runTranslatePipeline = async (originalMessages) => {
    // user 메시지의 한국어 본문 추출 (system 메시지는 한국어 강제 prompt 라 제외)
    const koreanInput = originalMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n\n');

    // 1/3: 한국어 → 영어 (번역 모델, low temp)
    setTranslateProgress({ stage: '1/3', model_name: TRANSLATOR_DISPLAY_NAME, message: '한국어 → 영어 변환 중', t0: Date.now() });
    const r1 = await callIsoInfer({
      model_key: TRANSLATOR_MODEL_KEY,
      messages: [
        { role: 'system', content: PROMPT_KO_TO_EN },
        { role: 'user', content: koreanInput },
      ],
      max_tokens: maxTokens,
      temperature: 0.0,
      keep_warm: true,  // 다음 단계에서 추론 모델 호출 — 번역 모델 unload 안 함
    });
    if (!r1.ok || !r1.data) {
      const detail = r1.data?.detail || {};
      setError({
        message: `번역 보조 1/3 (한→영) 실패: ${detail.message || r1.data?.message || r1.data?.error || `HTTP ${r1.status}`}`,
        status: r1.status,
        code: detail.error || r1.data?.error || 'TRANSLATE_KO_TO_EN_FAILED',
        elapsedMs: Date.now() - t0Ref.current,
        userAction: '번역 보조를 OFF 로 끄고 직접 추론하거나, 다른 모델을 선택해주세요.',
        raw: r1.rawBody?.slice(0, 1500) || null,
      });
      return;
    }
    const englishInput = (r1.data.answer || '').trim();
    const t1ms = r1.data.meta?.total_ms || 0;

    // 2/3: 영어 → 추론 모델 (사용자가 선택한 모델, 영어 답변)
    setTranslateProgress({ stage: '2/3', model_name: currentModel?.name || modelKey, message: '영어 추론 중', t0: Date.now() });
    const inferBody = {
      model_key: modelKey,
      messages: [{ role: 'user', content: englishInput }],
      max_tokens: maxTokens,
      temperature,
      keep_warm: true,  // 다음 단계에서 다시 번역 모델 호출 — 추론 모델 unload 안 함
    };
    if (thinkMode === 'on')  inferBody.think = true;
    if (thinkMode === 'off') inferBody.think = false;
    const r2 = await callIsoInfer(inferBody);
    if (!r2.ok || !r2.data) {
      const detail = r2.data?.detail || {};
      setError({
        message: `번역 보조 2/3 (추론) 실패: ${detail.message || r2.data?.message || r2.data?.error || `HTTP ${r2.status}`}`,
        status: r2.status,
        code: detail.error || r2.data?.error || 'INFER_FAILED',
        elapsedMs: Date.now() - t0Ref.current,
        userAction: '추론 모델이 영어 입력에 응답 실패. 다른 모델로 시도해주세요.',
        raw: r2.rawBody?.slice(0, 1500) || null,
      });
      return;
    }
    const englishAnswer = (r2.data.answer || '').trim();
    const t2ms = r2.data.meta?.total_ms || 0;

    // 3/3: 영어 답변 → 한국어 (번역 모델)
    setTranslateProgress({ stage: '3/3', model_name: TRANSLATOR_DISPLAY_NAME, message: '영어 → 한국어 변환 중', t0: Date.now() });
    const r3 = await callIsoInfer({
      model_key: TRANSLATOR_MODEL_KEY,
      messages: [
        { role: 'system', content: PROMPT_EN_TO_KO },
        { role: 'user', content: englishAnswer },
      ],
      max_tokens: maxTokens,
      temperature: 0.0,
      keep_warm: false,  // 마지막 호출 — 단일 모델 정책 복귀 (다음 일반 호출 시 unload OK)
    });
    if (!r3.ok || !r3.data) {
      const detail = r3.data?.detail || {};
      setError({
        message: `번역 보조 3/3 (영→한) 실패: ${detail.message || r3.data?.message || r3.data?.error || `HTTP ${r3.status}`}`,
        status: r3.status,
        code: detail.error || r3.data?.error || 'TRANSLATE_EN_TO_KO_FAILED',
        elapsedMs: Date.now() - t0Ref.current,
        userAction: '번역 3단계 실패. 영어 답변은 메타에 보관됩니다.',
        raw: r3.rawBody?.slice(0, 1500) || null,
      });
      return;
    }
    const koreanAnswer = (r3.data.answer || '').trim();
    const t3ms = r3.data.meta?.total_ms || 0;

    const totalMs = Date.now() - t0Ref.current;
    setAnswer(koreanAnswer);
    setMeta({
      model_key: modelKey,
      model_name: currentModel?.name || modelKey,
      engine: 'ollama',
      infer_ms: t1ms + t2ms + t3ms,
      total_ms: t1ms + t2ms + t3ms,
      client_total_ms: totalMs,
      // 번역 파이프라인 메타 — 응답 details 펼침에 노출
      translate_meta: {
        translator_model: TRANSLATOR_DISPLAY_NAME,
        infer_model: currentModel?.name || modelKey,
        english_input: englishInput,
        english_answer: englishAnswer,
        t1ms, t2ms, t3ms,
      },
    });
    setHistory(h => [{
      time: new Date().toLocaleTimeString(),
      engine: 'ollama (translate)',
      modelKey: `${TRANSLATOR_MODEL_KEY} → ${modelKey} → ${TRANSLATOR_MODEL_KEY}`,
      infer_ms: t1ms + t2ms + t3ms,
      total_ms: t1ms + t2ms + t3ms,
      chars: koreanAnswer.length,
    }, ...h].slice(0, 10));
  };

  // 마지막 요청 그대로 재시도
  const handleRetry = () => handleRun(lastReqRef.current?.customMessages || null);

  // 격리 service 헬스 체크 (/api/iso-infer?action=health → /healthz)
  const handleHealthCheck = async () => {
    setHealthBusy(true);
    try {
      const r = await fetch('/api/iso-infer?action=health', { credentials: 'include' });
      const d = await r.json();
      const lines = [
        `🏥 격리 service 상태`,
        `service:           ${d.ok ? '✅ OK' : '❌ DOWN'}`,
        `Ollama (11434):    ${d.ollama_reachable ? '✅ OK' : '❌ DOWN'}`,
        `engine:            ${d.engine || '-'}`,
        `models 카탈로그:   ${d.models_count ?? '-'}종`,
        `default_model:     ${d.default_model || '-'}`,
        d.ollama_error ? `\nOllama 에러: ${d.ollama_error}` : '',
      ];
      alert(lines.filter(Boolean).join('\n'));
    } catch (e) {
      alert(`헬스 체크 실패: ${e.message}`);
    } finally {
      setHealthBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">🧪 서버 분리 (Ollama 격리 추론)</h1>
        <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
      </header>

      {/* 안내 배너 */}
      <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 px-3 py-2.5 text-[11px] text-violet-900 dark:text-violet-200 leading-relaxed space-y-1.5">
        <div>
          🧪 <b>서버 분리 모드</b> — 메인 앱과 <b>별도 Cloud Run</b> (`aitutor-server-infer`, asia-southeast1, 24Gi / 6CPU + L4 GPU)
        </div>
        <div className="opacity-90">
          ⚙️ <b>Ollama 단일 엔진</b> · <b>회사 자산 컨셉</b> — 다양한 한국어/영어 모델을 격리 환경에서 운영. 학습 앱 외 다른 앱도 호출 가능 (인증된 service만).
          <a href="/lab/local-gcp" className="ml-1 underline hover:no-underline">서버 통합 모드 →</a>
        </div>
        <div className="opacity-75 text-[10px] border-t border-violet-300/40 dark:border-violet-700/40 pt-1.5 mt-1">
          ⏱ <b>첫 호출 cold start</b> — 작은 모델(2B 등) ~30초, 큰 모델(7B) 1~2분 (모델 lazy pull 포함). 이후 warm 호출은 5초 이내.
          <br />
          🔄 idle 5분 후 인스턴스 자동 종료 → 다음 호출 시 cold start 재발생. 429 시 자동 재시도 (최대 3회, 지수 backoff).
        </div>
      </div>

      {catalogError && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
          ⚠ {catalogError}
        </div>
      )}

      {/* 엔진 정보 뱃지 — 단일 엔진 */}
      <div className="rounded-xl border border-border bg-card-bg p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold text-text">⚙️ 추론 엔진</p>
          <span className="text-[10px] text-text-secondary">단일 엔진</span>
        </div>
        <div className="mt-2 p-2.5 rounded-lg border-2 border-violet-500 bg-violet-500/10">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-sm font-bold text-text">Ollama</div>
            <div className="text-[10px] text-text-secondary">✅ active</div>
          </div>
          <div className="text-[10px] text-text-secondary mt-0.5">
            Go wrapper · 모델 자동관리 · GGUF 양자화 · 격리 service 단독 진실 소스
          </div>
        </div>
      </div>

      {/* 메모리 상태 카드 (모델 선택 직전 위치, 모델 결정 참고용) */}
      <MemoryCard
        title="📊 격리 서버 메모리 상태"
        service="aitutor-server-infer"
        endpoint="/api/iso-infer?action=memory"
        unloadEndpoint="/api/iso-infer?action=unload-all"
        restartEndpoint="/api/iso-infer?action=restart-container"
      />

      {/* 모델 선택 — 격리 service /infer/models 응답 = ollama 호환 모델 + 동적 가용성
          REBUILD33 §33/§33.10: 15개 모델(번역 보조 포함) 인지 부담 ↓ → 카테고리 필터칩 + 2-col grid + 추천/티어 시각화
          P1-B (REBUILD34): translator 카테고리는 토글로만 노출(의도된 숨김), 카테고리 칩에는 미노출 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2.5">
        <div className="flex items-baseline justify-between flex-wrap gap-1">
          <p className="text-xs font-bold text-text">
            📦 모델 선택 ({visibleModels.length}/{models.length}종)
          </p>
          {currentModel && (
            <p className="text-[10px] text-text-secondary">
              현재 선택: <span className="font-semibold text-text">{currentModel.name}</span>
            </p>
          )}
        </div>

        {/* 카테고리 필터칩 — 가로 스크롤 가능 (모바일) */}
        <div className="flex flex-wrap gap-1.5">
          {['recommended', 'korean', 'english', 'code', 'all'].map(cat => {
            const meta = CATEGORY_META[cat];
            const count = categoryCounts[cat] || 0;
            const isActive = activeCategory === cat;
            // 카테고리에 모델 0개면 disabled (예: code 카테고리 fallback 시점)
            const disabled = count === 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => !disabled && setActiveCategory(cat)}
                disabled={disabled}
                title={meta.description}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all whitespace-nowrap ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed border-border'
                    : isActive
                      ? 'bg-violet-600 border-violet-600 text-white font-bold shadow-sm'
                      : 'border-border text-text-secondary hover:border-violet-400 hover:text-text'
                }`}
              >
                {meta.label} <span className="opacity-80">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 모델 카드 — 2-col grid (모바일은 1-col) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {visibleModels.map(m => {
            // 동적 가용성 (서버 응답의 available + unavailable_reason)
            const unavailable = m.available === false;
            const cardDisabled = running || unavailable;
            const isSelected = modelKey === m.key;
            const tier = TIER_META[m.tier] || null;
            const catColor = CATEGORY_META[m.category]?.color || 'slate';
            const dotClass = {
              blue:    'bg-blue-500',
              emerald: 'bg-emerald-500',
              purple:  'bg-purple-500',
              amber:   'bg-amber-500',
              slate:   'bg-slate-400',
            }[catColor];
            return (
              <button
                key={m.key}
                onClick={() => !unavailable && setModelKey(m.key)}
                disabled={cardDisabled}
                title={unavailable ? m.unavailable_reason || '자원 부족' : ''}
                className={`p-2.5 rounded-lg border-2 text-left transition-all relative ${
                  unavailable
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 cursor-not-allowed'
                    : isSelected
                      ? 'border-violet-500 bg-violet-500/10 shadow-sm'
                      : 'border-border hover:border-violet-400/50'
                } ${(running && !unavailable) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {/* 헤더: 카테고리 도트 + 모델명 + 추천 ⭐ */}
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass} flex-shrink-0`} aria-hidden="true" />
                  <div className={`text-sm font-bold ${unavailable ? 'text-amber-800 dark:text-amber-300' : 'text-text'}`}>
                    {m.name}
                  </div>
                  {m.recommended && !unavailable && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400" title="이 카테고리의 1순위 추천">⭐</span>
                  )}
                  {unavailable && <span className="text-amber-600">⚠</span>}
                </div>

                {/* 메타 라인: org · size + 티어 뱃지 */}
                <div className="flex items-center justify-between gap-1 mt-1 flex-wrap">
                  <div className="text-[10px] text-text-secondary">
                    {m.org} · {m.size}
                  </div>
                  {tier && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tier.badgeClass}`}
                      title={tier.hint}
                    >
                      {tier.label}
                    </span>
                  )}
                </div>

                {/* 설명 */}
                <div className="text-[10px] text-text-secondary mt-1 leading-snug line-clamp-2">
                  {m.note}
                </div>

                {/* 큰 모델 cold start 경고 (선택 안된 상태에서만) */}
                {!unavailable && !isSelected && m.tier === 'heavy' && (
                  <div className="text-[9px] text-rose-600 dark:text-rose-400 mt-1 opacity-80">
                    ⏱ 첫 호출 1~2분 소요 (모델 lazy pull)
                  </div>
                )}

                {/* 사용 불가 사유 */}
                {unavailable && (
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                    🚫 {m.unavailable_reason || '자원 부족'}
                  </div>
                )}
              </button>
            );
          })}
          {visibleModels.length === 0 && models.length > 0 && (
            <p className="col-span-full text-[11px] text-text-secondary text-center py-4">
              이 카테고리에 모델이 없습니다. 다른 카테고리를 선택해주세요.
            </p>
          )}
          {models.length === 0 && (
            <p className="col-span-full text-[11px] text-amber-700 dark:text-amber-300">
              ⚠️ 모델 카탈로그를 받지 못했습니다. 격리 service 기동 후 다시 시도해주세요.
            </p>
          )}
        </div>

        <p className="text-[10px] text-text-secondary opacity-70 pt-1 leading-relaxed">
          💡 첫 호출 시 Ollama registry 에서 lazy pull. 가벼움 ~30초 / 균형 ~1분 / 큰 모델 1~2분. 이후 warm 호출은 5초 내.
        </p>
      </div>

      {/* QuestionPicker (DB 선택 + 외부 붙여넣기 통합) */}
      <QuestionPicker question={question} onChange={handleQuestionChange} />

      {/* REBUILD33 §33.9 — 선택된 모델 상세 정보 패널 (capabilities / 권장 파라미터 / 한국어 강도 / 팁) */}
      {currentModel && (currentModel.capabilities || currentModel.tips) && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-900/20 p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-violet-900 dark:text-violet-200">
              🔍 {currentModel.name} 상세 정보
            </p>
            <span className="text-[10px] text-violet-700 dark:text-violet-300">
              {currentModel.org} · {currentModel.size}
            </span>
          </div>

          {/* 한국어 강도 (별점) + 카테고리 + 번역 보조 권장 hint */}
          {typeof currentModel.korean_strength === 'number' && (
            <div className="text-[11px] text-violet-900 dark:text-violet-200 flex items-center gap-2 flex-wrap">
              <span>🌐 한국어 강도</span>
              <span className={`font-mono tracking-wider ${currentModel.korean_strength <= 2 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {'⭐'.repeat(currentModel.korean_strength)}
                <span className="opacity-30">{'⭐'.repeat(5 - currentModel.korean_strength)}</span>
              </span>
              <span className="text-[10px] opacity-70">({currentModel.korean_strength}/5)</span>
              {translatorSupported && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300 font-bold">
                  🌐 번역 보조 권장
                </span>
              )}
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

      {/* 파라미터 — REBUILD33 §33.9 thinking 토글 + §33.10 번역 보조 토글 (모두 모델 의존 optional) */}
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
        translateMode={translateMode}
        onTranslateModeChange={setTranslateMode}
        translateSupported={translatorSupported}
        translatorName={TRANSLATOR_DISPLAY_NAME}
        translatorSize={TRANSLATOR_DISPLAY_SIZE}
      />

      {/* PromptEditor (섹션별 편집) */}
      {question && (
        <PromptEditor
          question={question}
          model={modelKey}
          running={running}
          onSubmit={(messages) => handleRun(messages)}
        />
      )}

      {question && (
        <button onClick={() => handleRun()} disabled={running}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold">
          {running
            ? translateMode === 'on' && translatorSupported
              ? `🌐 번역 보조 추론 중… (3단계)`
              : `🧪 Ollama × ${currentModel?.name} 격리 추론 중…`
            : translateMode === 'on' && translatorSupported
              ? `🌐 번역 보조 ON · ${TRANSLATOR_DISPLAY_NAME} → ${currentModel?.name} → ${TRANSLATOR_DISPLAY_NAME}`
              : `🚀 Ollama × ${currentModel?.name} 로 격리 추론`}
        </button>
      )}

      {/* REBUILD33 §33.10 — 번역 보조 진행 표시 (3단계 파이프라인 진행 중) */}
      {translateProgress && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 p-3 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              🌐 번역 보조 파이프라인
            </p>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono">
              {translateProgress.stage}
            </span>
          </div>
          <p className="text-[11px] text-emerald-900 dark:text-emerald-100">
            <span className="font-semibold">{translateProgress.model_name}</span>: {translateProgress.message}
            <span className="ml-1 inline-block animate-pulse">⏳</span>
          </p>
          <div className="flex gap-1 pt-0.5">
            {['1/3', '2/3', '3/3'].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${
                translateProgress.stage === s
                  ? 'bg-emerald-500 animate-pulse'
                  : (parseInt(translateProgress.stage) > parseInt(s)
                    ? 'bg-emerald-500'
                    : 'bg-emerald-200 dark:bg-emerald-800')
              }`} />
            ))}
          </div>
        </div>
      )}

      {/* 에러 — 구조화 에러 + 재시도/헬스체크 버튼 */}
      {error && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-900 dark:text-red-200 break-words">
                {error.message}
              </p>
              <p className="text-[10px] text-red-700 dark:text-red-300 mt-1">
                {error.status && `HTTP ${error.status} · `}
                {error.code && `code=${error.code} · `}
                {error.upstream && `upstream=${error.upstream} · `}
                {error.elapsedMs != null && `${error.elapsedMs}ms 후`}
              </p>
            </div>
          </div>

          {error.cause && (
            <p className="text-[11px] text-red-800 dark:text-red-200 pl-6">
              <span className="font-semibold">원인:</span> <code className="break-all">{error.cause}</code>
            </p>
          )}

          {error.userAction && (
            <p className="text-[11px] text-red-900 dark:text-red-100 pl-6 leading-relaxed">
              <span className="font-semibold">👉 다음 단계:</span> {error.userAction}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pl-6 pt-1">
            <button
              type="button"
              onClick={handleRetry}
              disabled={running}
              className="text-[11px] px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold"
            >
              🔁 다시 시도
            </button>
            <button
              type="button"
              onClick={handleHealthCheck}
              disabled={healthBusy}
              className="text-[11px] px-3 py-1 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold"
            >
              {healthBusy ? '확인 중…' : '🏥 격리 service 상태 확인'}
            </button>
            <a
              href="/lab/local-gcp"
              className="text-[11px] px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-text font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              ☁️ 서버 통합 모드로 임시 회피
            </a>
            {error.raw && (
              <details className="w-full pt-1">
                <summary className="text-[10px] text-red-700 dark:text-red-300 cursor-pointer select-none">전체 응답 보기 (디버그)</summary>
                <pre className="mt-1 bg-bg p-2 rounded text-[10px] text-text overflow-x-auto whitespace-pre-wrap break-all max-h-48">{error.raw}</pre>
              </details>
            )}
          </div>
        </div>
      )}

      {answer && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-2">
          <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            {meta?.translate_meta
              ? `✅ 번역 보조 결과 (${meta.translate_meta.translator_model} → ${meta.translate_meta.infer_model} → ${meta.translate_meta.translator_model} · 총 ${meta?.client_total_ms}ms)`
              : `✅ 격리 추론 결과 (ollama · ${meta?.infer_ms}ms / 총 ${meta?.client_total_ms}ms)`}
          </p>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed text-text">{answer}</pre>

          {/* REBUILD33 §33.10 — 번역 모드 시 번역 과정 + 영어 원본 답변 펼침 (학습 가치 ↑) */}
          {meta?.translate_meta && (
            <details className="pt-1">
              <summary className="text-[10px] text-emerald-700 dark:text-emerald-300 cursor-pointer select-none font-semibold">
                🌐 번역 과정 자세히 보기 (영어 원본 / 단계별 시간)
              </summary>
              <div className="mt-2 space-y-2 text-[11px]">
                <div className="rounded-md bg-bg p-2">
                  <p className="font-bold text-text-secondary mb-1">
                    1/3 · {meta.translate_meta.translator_model} (한 → 영) · {meta.translate_meta.t1ms}ms
                  </p>
                  <pre className="whitespace-pre-wrap text-text leading-relaxed text-[10px]">
                    {meta.translate_meta.english_input || '(빈 응답)'}
                  </pre>
                </div>
                <div className="rounded-md bg-bg p-2">
                  <p className="font-bold text-text-secondary mb-1">
                    2/3 · {meta.translate_meta.infer_model} (영어 추론) · {meta.translate_meta.t2ms}ms
                  </p>
                  <pre className="whitespace-pre-wrap text-text leading-relaxed text-[10px]">
                    {meta.translate_meta.english_answer || '(빈 응답)'}
                  </pre>
                </div>
                <div className="rounded-md bg-bg p-2">
                  <p className="font-bold text-text-secondary mb-1">
                    3/3 · {meta.translate_meta.translator_model} (영 → 한) · {meta.translate_meta.t3ms}ms
                  </p>
                  <p className="text-text-secondary leading-relaxed text-[10px]">
                    위의 한국어 응답이 3단계 결과입니다.
                  </p>
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card-bg p-3 space-y-1.5">
          <p className="text-xs font-bold text-text">📊 호출 이력 (최근 {history.length})</p>
          <ul className="space-y-1">
            {history.map((h, i) => (
              <li key={i} className="text-[10px] text-text-secondary font-mono flex justify-between">
                <span>{h.time} · {h.engine} · {h.modelKey}</span>
                <span>{h.infer_ms}ms / {h.chars}자</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
