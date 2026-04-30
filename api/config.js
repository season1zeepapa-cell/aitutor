// 공개 런타임 설정 엔드포인트 (REBUILD23 이후 Cloud Run Express 핸들러)
//
// 비인증 GET /api/config — 클라이언트(LoginPage 등)가 안전하게 읽을 플래그만 반환.
// 비밀(시크릿/내부 토글)은 절대 여기 노출 금지. 화이트리스트 방식으로 한정 키만 응답.
//
// 캐시: settings 헬퍼가 30초 in-memory cache 처리.
// CDN/브라우저 캐시는 비활성 (관리자 토글이 즉시 반영되도록).

const { withCors } = require('./middleware');
const { getSetting } = require('./_runtime/settings');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다.' });
  }

  // 클라이언트 캐시 차단 — 토글 변경 즉시 반영 위해
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // 화이트리스트 — 클라이언트에 노출해도 안전한 플래그만 반환
  // REBUILD26 §7-1: lab_server_ai_enabled / lab_server_ai_gguf_enabled 응답 제외
  // (server-ai/server-ai-gguf 실험실 폐기. DB row 는 history 보존 — getSetting 호출 안 함).
  const signupDisabled = await getSetting('signup_disabled', 'true');
  const labLocalAi = await getSetting('lab_local_ai_enabled', 'false');
  // REBUILD22 §x — HF Inference Providers 실험실 토글
  const labHf = await getSetting('lab_hf_enabled', 'false');
  // Cloud Run 일심동체 추론 (REBUILD23~26 — 앱+모델 같은 컨테이너, 8 엔진 동거).
  // DB key (lab_local_lambda_enabled) 는 마이그 부담으로 보존, UI 라벨은 Cloud Run 으로 갱신됨.
  const labLocalLambda = await getSetting('lab_local_lambda_enabled', 'false');
  // REBUILD26 §3.2 — 격리 추론 service (aitutor-inference) 실험실 토글
  const labServerInfer = await getSetting('lab_server_infer_enabled', 'false');
  // REBUILD28 §11 — 외부 Ollama bridge 실험실 토글 (사용자 PC localhost:11434 직접 호출)
  const labOllamaBridge = await getSetting('lab_ollama_bridge_enabled', 'false');
  // REBUILD18 — LLM 프로바이더 활성화 (default: 모두 ON)
  const providerGemini = await getSetting('provider_gemini_enabled', 'true');
  const providerOpenai = await getSetting('provider_openai_enabled', 'true');
  const providerClaude = await getSetting('provider_claude_enabled', 'true');
  const providerLocal  = await getSetting('provider_local_enabled',  'true');

  res.json({
    signup_disabled: signupDisabled === 'true',
    lab_local_ai_enabled: labLocalAi === 'true',
    lab_hf_enabled: labHf === 'true',
    lab_local_lambda_enabled: labLocalLambda === 'true',
    lab_server_infer_enabled: labServerInfer === 'true',
    lab_ollama_bridge_enabled: labOllamaBridge === 'true',
    provider_gemini_enabled: providerGemini === 'true',
    provider_openai_enabled: providerOpenai === 'true',
    provider_claude_enabled: providerClaude === 'true',
    provider_local_enabled:  providerLocal  === 'true',
  });
});
