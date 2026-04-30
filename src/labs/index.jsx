// /lab 실험실 메인 페이지 (REBUILD28 §11 — 사용자 결정 2026-04-30)
//
// 5개 lab 카탈로그 — admin 토글 + 진입 링크.
// 일반 사용자: 활성 lab 만 진입 가능, 토글 없음.
// admin 사용자: 카드에 토글 표시 → 클릭 시 즉시 활성/비활성 전환.
//
// /api/config 응답 의존:
//   - lab_local_ai_enabled
//   - lab_hf_enabled
//   - lab_local_lambda_enabled    (Cloud Run 일심동체)
//   - lab_server_infer_enabled    (격리)
//   - lab_ollama_bridge_enabled   (외부 Ollama bridge — 신규)

import { useEffect, useState } from 'react';
import { getAuthUser, apiPost } from '../lib/api';

const LABS = [
  {
    // REBUILD29 §22 — 직관적 용어 (서비스/추론엔진/모델 구성 명시)
    key: 'local-ai',
    icon: '📱',
    title: '온디바이스 모델',
    summary: '브라우저 안 WebGPU 추론 — 모델이 사용자 디바이스에서 실행. transformers.js (ONNX) + WebLLM (큰 모델).',
    href: '/lab/local-ai',
    flag: 'lab_local_ai_enabled',
    palette: 'amber',
  },
  {
    key: 'hf',
    icon: '🤗',
    title: '외부 추론 라우팅 (HF Inference)',
    summary: 'HuggingFace Inference Providers 외부 추론 — Llama / Qwen / DeepSeek / Mistral / Gemma 7종. 비교 모드 지원.',
    href: '/lab/hf',
    flag: 'lab_hf_enabled',
    palette: 'fuchsia',
  },
  {
    key: 'local-gcp',
    icon: '☁️',
    title: '서버 통합 (서비스+추론엔진+모델 한 컨테이너)',
    summary: '메인 앱 + 6 추론엔진 (Ollama / llama-server / vLLM / llama-cpp-python / onnx / transformers) 같은 Cloud Run, GPU L4 24GB.',
    href: '/lab/local-gcp',
    flag: 'lab_local_lambda_enabled',
    palette: 'cyan',
  },
  {
    key: 'server-infer',
    icon: '🧪',
    title: '서버 분리 (추론엔진+모델 별도 서비스)',
    summary: '메인 앱과 별도 Cloud Run (aitutor-inference) 으로 추론엔진+모델 분리. 동일 6 엔진 + 모델 양쪽 비교 가능.',
    href: '/lab/server-infer',
    flag: 'lab_server_infer_enabled',
    palette: 'emerald',
  },
  {
    key: 'ollama-bridge',
    icon: '🖥️',
    title: '사용자 PC 추론 (Ollama bridge)',
    summary: '사용자 데스크톱에 설치된 Ollama 를 브라우저가 직접 호출 (localhost:11434). 70B 모델까지 가능.',
    href: '/lab/ollama-bridge',
    flag: 'lab_ollama_bridge_enabled',
    palette: 'violet',
  },
];

const PALETTE = {
  amber:    'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
  fuchsia:  'border-fuchsia-300 dark:border-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-900/20',
  cyan:     'border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20',
  emerald:  'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
  violet:   'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20',
};

export default function LabsHome() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const user = getAuthUser();
  const isAdmin = user?.admin === true;

  useEffect(() => {
    fetch('/api/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then(setConfig)
      .catch(() => setConfig({}));
  }, []);

  // admin 토글 — 즉시 DB 갱신 + 로컬 state 갱신
  const toggleLab = async (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAdmin || saving) return;
    const newValue = !(config?.[key] === true);
    setSaving(key);
    setErrMsg('');
    try {
      await apiPost('/api/admin', { action: 'set_setting', key, value: String(newValue) });
      setConfig(prev => ({ ...(prev || {}), [key]: newValue }));
    } catch (err) {
      setErrMsg(`토글 실패: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">🧪 실험실</h1>
        <a href="/" className="text-xs text-primary hover:underline">← 홈</a>
      </header>

      <div className="rounded-lg border border-border bg-card-bg px-3 py-2 text-[12px] text-text-secondary leading-relaxed">
        AI TutorTwo 의 추론 실험 페이지 모음.
        {isAdmin
          ? ' 카드 우측 토글로 활성/비활성 전환 (admin 권한).'
          : ' 각 lab 은 admin 이 활성화한 경우만 진입 가능.'}
      </div>

      {errMsg && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-800 dark:text-red-200">
          {errMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LABS.map(l => {
          const enabled = config?.[l.flag] === true;
          const paletteClass = PALETTE[l.palette] || PALETTE.amber;
          const isSaving = saving === l.flag;
          return (
            <a
              key={l.key}
              href={enabled ? l.href : undefined}
              onClick={(e) => { if (!enabled) e.preventDefault(); }}
              className={`block rounded-xl border-2 p-3.5 transition-all ${paletteClass} ${
                enabled
                  ? 'hover:scale-[1.02] hover:shadow-md cursor-pointer'
                  : (isAdmin ? 'opacity-80 cursor-default' : 'opacity-60 cursor-not-allowed')
              }`}
            >
              <div className="flex items-start justify-between mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl flex-shrink-0">{l.icon}</span>
                  <h2 className="text-sm font-bold text-text leading-tight">{l.title}</h2>
                </div>

                {/* admin: 토글 / 일반: 상태 배지 */}
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={(e) => toggleLab(e, l.flag)}
                    disabled={isSaving}
                    className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
                      enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                    style={{ height: '22px', width: '40px' }}
                    aria-label={enabled ? `${l.title} 비활성화` : `${l.title} 활성화`}
                    title={enabled ? '클릭해서 비활성화' : '클릭해서 활성화'}
                  >
                    <div
                      className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ${
                    enabled
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>
                    {enabled ? '🟢 활성' : '🔴 비활성'}
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-text-secondary leading-relaxed">{l.summary}</p>
              {!enabled && !isAdmin && (
                <p className="text-[10px] text-text-secondary opacity-70 mt-2">
                  관리자가 설정 → 실험실에서 활성화 가능
                </p>
              )}
              {!enabled && isAdmin && (
                <p className="text-[10px] text-text-secondary opacity-70 mt-2">
                  ↗ 토글 클릭으로 활성화
                </p>
              )}
            </a>
          );
        })}
      </div>

      <div className="text-[10.5px] text-text-secondary opacity-70 leading-relaxed pt-2">
        💡 각 lab 진입 후 상단 우측의 <b>← 실험실</b> 링크로 이 페이지로 돌아옵니다.
      </div>
    </div>
  );
}
