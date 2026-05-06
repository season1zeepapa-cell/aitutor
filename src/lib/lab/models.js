// 실험실 공통 모델 카탈로그 (ServerInferTester fallback)
//
// 격리 진실 소스: workspace/aitutor/server-infer/server.py MODELS
// 격리 service /infer/models 응답 도달 시 본 fallback 은 즉시 덮어씌워진다.
//
// REBUILD32 §15 R-3 — 통합/분리 catalog 독립 운영. 자동 동기화 검증 스크립트 도입 금지.
//
// disabled_engines 필드는 ServerInferTester.jsx 의 ollama 호환 fallback 필터가 사용 중.
// (현재 운영 단일 엔진은 ollama. 옛 multi-engine 시대의 차단 메모는 보존하되 신규 추가 불요.)

export const LAB_MODELS = [
  {
    key: 'qwen35-2b', name: 'Qwen 3.5 2B', org: 'Alibaba', size: '~1.6GB', note: '경량 / 한국어 강',
    disabled_engines: ['vllm', 'transformers', 'llama-server', 'llama-cpp-python', 'onnxruntime-genai'],
    disabled_reason: 'Qwen 3.5 transformers weights 비공개 + llama.cpp 미지원 + ONNX 가 Transformers.js 형식',
  },
  {
    key: 'qwen35-4b', name: 'Qwen 3.5 4B', org: 'Alibaba', size: '~2.5GB', note: '균형 / 한국어 강',
    disabled_engines: ['vllm', 'transformers', 'llama-server', 'llama-cpp-python', 'onnxruntime-genai'],
    disabled_reason: 'Qwen 3.5 transformers weights 비공개 + llama.cpp 미지원 + ONNX 가 Transformers.js 형식',
  },
  {
    key: 'gemma4-e2b', name: 'Gemma 4 E2B', org: 'Google', size: '~3.2GB', note: '효율적 멀티모달 / 128K',
    disabled_engines: ['vllm', 'transformers', 'llama-server', 'llama-cpp-python', 'onnxruntime-genai'],
    disabled_reason: 'transformers/llama.cpp 모두 Gemma 4 미지원 + ONNX 가 Transformers.js 형식',
  },
  {
    key: 'gemma4-e4b', name: 'Gemma 4 E4B', org: 'Google', size: '~4.9GB', note: 'Gemma 패밀리 / 멀티모달',
    disabled_engines: ['vllm', 'transformers', 'llama-server', 'llama-cpp-python', 'onnxruntime-genai'],
    disabled_reason: 'transformers/llama.cpp 모두 Gemma 4 미지원 + ONNX 가 Transformers.js 형식',
  },
  // ─── REBUILD30 §23 (2026-05-03) — 사용자 요청 신규 모델 (서버 통합/분리 lab 한정) ───
  // 6 엔진 폭넓게 호환 (onnxruntime-genai 만 차단 — ONNX 공개 미러 없음).
  // REBUILD30 §47 (2026-05-04) — note 정정 (실제 호환 엔진 수)
  {
    key: 'qwen25-3b', name: 'Qwen 2.5 3B', org: 'Alibaba', size: '~2GB', note: '범용 / 한국어 강 / 5 엔진 호환 (onnx-genai 제외)',
    disabled_engines: ['onnxruntime-genai'],
    disabled_reason: 'Qwen 2.5 3B 의 onnxruntime-genai 호환 ONNX 미러 없음',
  },
  // REBUILD30 §26 — Gemma 2 가 HF gated (Google 액세스 신청 필요)
  {
    key: 'gemma2-2b', name: 'Gemma 2 2B', org: 'Google', size: '~1.6GB', note: '경량 / 다국어 / 3 엔진 호환 (Ollama + GGUF 계열)',
    disabled_engines: ['onnxruntime-genai', 'vllm', 'transformers'],
    disabled_reason: 'Gemma 2 weights 가 HF gated + ONNX 미러 없음',
  },
  // REBUILD30 §34 — onnxruntime-genai 전용 모델 (Microsoft / onnxruntime 공식)
  // REBUILD33 §33.7 (2026-05-06 hotfix) — 옛 phi35-mini (onnxruntime-genai 전용) 제거.
  //   사유: REBUILD33 §13.2 에서 격리 service ollama 전용 phi35-mini 가 추가되어 같은 key 중복 발생.
  //         normalizeLabModels 가 LAB_MODELS 순회 시 동일 key 두 항목 모두 통과 → 분리 service UI 에
  //         Phi-3.5 Mini 가 2번 노출되고 카테고리 카운트도 +1 부풀려짐.
  //         옛 onnxruntime-genai 전용 phi35-mini 는 inference-py 제거(REBUILD33 Phase 2)로 사용처 폐기됨.
  //   gemma3-4b 는 ollama 미호환이라 격리 service UI 에 노출되지 않음 → 보존 (다른 lab 의 fallback 가치).
  {
    key: 'gemma3-4b', name: 'Gemma 3 4B', org: 'Google', size: '~2.5GB', note: 'Gemma 신형 / onnxruntime-genai 전용',
    disabled_engines: ['ollama', 'llama-server', 'vllm', 'llama-cpp-python', 'transformers'],
    disabled_reason: 'onnxruntime-genai 전용 (onnxruntime 공식 ONNX-genai)',
  },
  // REBUILD30 §47 — DeepSeek R1 Distill Qwen 7B 다중 엔진 확장 (4 엔진)
  {
    key: 'deepseek-r1-qwen-7b', name: 'DeepSeek R1 Distill Qwen 7B', org: 'DeepSeek', size: '~4.5GB',
    note: 'Reasoning 특화 / Qwen 베이스 / 4 엔진 호환',
    disabled_engines: ['vllm', 'transformers'],
    disabled_reason: 'transformers/vllm 은 핀 버전 안정성 미검증 (보류)',
  },
  // REBUILD30 §47 — Qwen 2.5 7B 신규 (한국어 강, 5 엔진 호환)
  {
    key: 'qwen25-7b', name: 'Qwen 2.5 7B', org: 'Alibaba', size: '~5GB', note: '범용 / 한국어 강 / 5 엔진 호환 (onnx-genai 제외)',
    disabled_engines: ['onnxruntime-genai'],
    disabled_reason: 'onnxruntime-genai 호환 ONNX 미러 없음',
  },
  // REBUILD30 §47 — Phi-4 Mini 신규 (Microsoft 최신, onnxruntime-genai 전용)
  {
    key: 'phi4-mini', name: 'Phi-4 Mini', org: 'Microsoft', size: '~2.5GB', note: '최신 SLM / Reasoning 강세 / onnxruntime-genai 전용',
    disabled_engines: ['ollama', 'llama-server', 'vllm', 'llama-cpp-python', 'transformers'],
    disabled_reason: 'onnxruntime-genai 전용 (Microsoft 공식 onnx-genai 형식)',
  },
  // ─── REBUILD33 §13.2 영어 자격증 (TOEIC + GCP/AWS) — 격리 service 전용 6 모델 ───
  // 격리 service (server-infer) 전용 — 통합 service 는 모두 미지원 (의도된 차이, §20)
  // 백엔드 응답 도착 전 fallback 표시용. category/tier/recommended 메타는 server.py 진실 소스에서 도착.
  {
    key: 'phi35-mini', name: 'Phi-3.5 Mini', org: 'Microsoft', size: '~2.3GB',
    note: 'TOEIC RC / 가벼운 영어 추론 (격리 전용)',
    disabled_engines: ['llama-server', 'vllm', 'llama-cpp-python', 'transformers', 'onnxruntime-genai'],
    disabled_reason: '격리 service 의 Ollama 엔진에서만 운영 (통합 service 미지원)',
  },
  {
    key: 'phi4-14b', name: 'Phi-4 (14B)', org: 'Microsoft', size: '~9GB',
    note: 'GCP/AWS 시나리오 추론 최강 (영어, 격리 전용)',
    disabled_engines: ['llama-server', 'vllm', 'llama-cpp-python', 'transformers', 'onnxruntime-genai'],
    disabled_reason: '격리 service 의 Ollama 엔진에서만 운영 (통합 service 미지원)',
  },
  {
    key: 'llama31-8b', name: 'Llama 3.1 8B', org: 'Meta', size: '~4.7GB',
    note: 'TOEIC LC / 영어 일반 (격리 전용)',
    disabled_engines: ['llama-server', 'vllm', 'llama-cpp-python', 'transformers', 'onnxruntime-genai'],
    disabled_reason: '격리 service 의 Ollama 엔진에서만 운영 (통합 service 미지원)',
  },
  {
    key: 'llama32-3b', name: 'Llama 3.2 3B', org: 'Meta', size: '~2.0GB',
    note: '가벼운 영어 (응답 속도 우선, 격리 전용)',
    disabled_engines: ['llama-server', 'vllm', 'llama-cpp-python', 'transformers', 'onnxruntime-genai'],
    disabled_reason: '격리 service 의 Ollama 엔진에서만 운영 (통합 service 미지원)',
  },
  {
    key: 'qwen25-coder-7b', name: 'Qwen 2.5 Coder 7B', org: 'Alibaba', size: '~4.7GB',
    note: 'GCP/AWS 코드/SDK 예제 (격리 전용)',
    disabled_engines: ['llama-server', 'vllm', 'llama-cpp-python', 'transformers', 'onnxruntime-genai'],
    disabled_reason: '격리 service 의 Ollama 엔진에서만 운영 (통합 service 미지원)',
  },
  {
    key: 'mistral-7b', name: 'Mistral 7B', org: 'Mistral', size: '~4.4GB',
    note: '영어 다양성 (백업, 격리 전용)',
    disabled_engines: ['llama-server', 'vllm', 'llama-cpp-python', 'transformers', 'onnxruntime-genai'],
    disabled_reason: '격리 service 의 Ollama 엔진에서만 운영 (통합 service 미지원)',
  },
];

export const DEFAULT_MODEL_KEY = 'qwen25-3b';  // 신규 만능 모델로 default 변경
const LAB_MODEL_INDEX = Object.fromEntries(LAB_MODELS.map(model => [model.key, model]));

/** 서버 응답 모델 카탈로그를 프론트 공통 순서/메타데이터 기준으로 정규화.
 *
 * REBUILD33 §33.7 (2026-05-06 hotfix) — key 기반 dedup 안전장치.
 *   배경: LAB_MODELS 에 동일 key 가 우발적으로 중복 정의될 경우 normalized 에 같은 key 가
 *         두 번 등장하여 UI 에 모델 카드가 중복 노출되는 사례 발생 (옛 phi35-mini × 새 phi35-mini).
 *   대책: LAB_MODELS 순회 결과를 key 기반 Set 으로 dedup 하여 첫 매칭만 유지.
 */
export function normalizeLabModels(models = LAB_MODELS) {
  if (!Array.isArray(models) || models.length === 0) return LAB_MODELS;
  const runtimeMap = new Map(
    models
      .filter(model => model && typeof model === 'object' && model.key)
      .map(model => [model.key, model])
  );

  const seenKeys = new Set();
  const normalized = LAB_MODELS
    .filter(model => {
      if (!runtimeMap.has(model.key)) return false;
      if (seenKeys.has(model.key)) return false;  // dedup 안전장치
      seenKeys.add(model.key);
      return true;
    })
    .map(model => {
      const runtime = runtimeMap.get(model.key) || {};
      return {
        ...model,
        ...runtime,
        disabled_engines: runtime.disabled_engines ?? model.disabled_engines,
        disabled_reason: runtime.disabled_reason ?? model.disabled_reason,
      };
    });

  const extras = models.filter(model => model?.key && !LAB_MODEL_INDEX[model.key]);
  return [...normalized, ...extras];
}
