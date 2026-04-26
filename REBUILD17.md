# REBUILD17 — 로컬 오픈 모델(Gemma 4) AI 해설 통합 가이드

작성일: 2026-04-25
범위: workspace/aitutor — AI 해설 생성 파이프라인 + 로컬 LLM 도입
선행 문서: REBUILD16 §8.4(LLM 호출 통일), §8.8(비용 추적), §8.9(사용량 UI), §8.15(운전면허 해설 보완 보류)

---

## 0. 요약 (TL;DR) — 2026-04-25 의사결정 반영

aitutor 의 **AI 해설 생성**을 외부 LLM API 의존에서 **Google Gemma 4 (Apache 2.0 오픈 가중치)** 로컬 모델로 일부 대체하는 도입 계획.

### 확정 사항 ⭐

| 항목 | 결정 |
|---|---|
| **1차 대상** | **📱 모바일 사용자** (PWA + WebGPU 온디바이스 추론) |
| **모델 사이즈** | **Gemma 4 E2B (2B) 또는 E4B (4B)** — 모바일 가능 사이즈 |
| **추론 인프라** | **transformers.js + ONNX** (브라우저 WebGPU) — 클라우드 GPU 0 |
| **모델 다운로드** | 첫 실행 시 한 번 (1.5GB E2B / 2.7GB E4B) → 브라우저 캐시 |
| **데스크톱 사용자** | **현재 그대로** (OpenAI/Gemini/Claude 외부 API) — 후속 라운드에서 동일 모델 적용 검토 |
| **Capacitor** | **유지** (향후 App Store 배포 등 네이티브 확장 가능성 대비) |
| **콘텐츠 생성 배치** | (옵션 B) 보류 — 운전면허 해설 보완 자체가 §8.15 에서 보류 결정 |
| **클라우드 호스팅** | (옵션 A) 보류 — 모바일 사용자 PWA 가 검증되면 데스크톱 확장 시 재검토 |

### 단계적 출시 경로

```
1차 [본 라운드]: 📱 모바일 사용자 — PWA + WebGPU + Gemma 4 E4B
2차 [후속]:    💻 데스크톱 사용자 — 동일 PWA 경로 또는 클라우드 호스팅
3차 [장래]:    📲 App Store 네이티브 — Capacitor + MediaPipe (확장 시점)
```

### 코드 변경 최소화

- 기존 `api/_llm/openai-chat.js` fetch 패턴이 그대로 활용 가능 (관리자 배치 도입 시)
- 모바일 PWA 는 **백엔드 호출 없이 브라우저에서 직접 추론** — Lambda/AWS 비용 0원

---

## 1. 배경 + 동기

### 1.1 외부 API 의존의 한계

| 이슈 | 영향 |
|---|---|
| API 키 운영 부담 | Gemini/Anthropic 키가 INVALID 상태 (REBUILD16 §11.6) — OpenAI 만 동작 |
| 비용 가시성 | `llm_usage_log` (REBUILD16 §8.8) 로 추적은 되지만 운영 비용 부담 존재 |
| 데이터 외부 전송 | 사용자 학습 데이터 + 문항 본문이 외부 API 로 전송 |
| 네트워크 의존 | 외부 API 장애·지연 시 AI 해설 기능 중단 |

### 1.2 운전면허 해설 보완 (§8.15) 와 연결

REBUILD16 §8.15 에서 운전면허 해설 부족 케이스(빈 3건 + 짧은 42건) 보완을 보류했는데, **로컬 모델로 무비용 보완 가능** → 보류 해소 후보.

### 1.3 도입의 의미

- 운영 비용 절감 (배치 작업 0원)
- 데이터 격리 (사용자 PC 또는 자체 인프라)
- 외부 API 장애 영향 차단
- 향후 신규 트랙(자격증) 콘텐츠 생성 자동화 발판

---

## 2. Gemma 4 모델 소개

### 2.1 핵심 사양 (2026-04-02 출시 — 공식 정보)

| 항목 | 값 |
|---|---|
| 라이선스 | **Apache 2.0** (상업적 사용·수정·배포 자유, 별도 계약 불필요) |
| 사이즈 | **4종** — E2B(2B) / E4B(4B) / 26B / 31B |
| 컨텍스트 | E2B/E4B: 128K · 26B/31B: **256K** |
| 멀티모달 | **텍스트 + 이미지 + 비디오** (E2B/E4B 는 오디오 입력 추가) |
| 언어 | 사전훈련 140+ 언어, 즉시 지원 35+ 언어 (**한국어 포함**) |
| OCR / 차트 이해 | 공식 use case 로 명시 |
| Ollama 지원 | **Day-one** (`ollama pull gemma4`) |

### 2.2 사이즈별 활용 가이드

| 모델 | 파라미터 | 권장 RAM | 권장 환경 | aitutor 적합도 |
|---|---|---|---|---|
| **E2B** | 2B | 4GB | 모바일·엣지 | 짧은 해설 적합. 한국어 품질 검증 필요 |
| **E4B** | 4B | 8GB | 일반 노트북 (Mac M2/M3, Windows 16GB+) | ⭐ **관리자 PC 1차 후보** |
| **26B** | 26B | 32GB+ | 워크스테이션 (Mac M2/M3 Max, GPU PC) | 🥇 **고품질 해설 — 검수 필요량 ↓** |
| **31B** | 31B | 48GB+ | 서버 / 클라우드 GPU (NVIDIA L4/A10) | 클라우드 호스팅용 |

### 2.3 가격 (참고 — 외부 API 비교용)

| 항목 | Gemma 4 31B | OpenAI gpt-5.4-mini | Claude Haiku 4.5 | Gemini 2.5 Flash |
|---|---|---|---|---|
| 입력 (1M tokens) | $0.13 | $0.40 | $1.00 | $0.30~1.00 |
| 출력 (1M tokens) | $0.38 | $1.60 | $5.00 | $2.50 |

→ Gemma 4 31B 는 외부 API 보다 **3~10배 저렴**. 로컬 실행 시 무료.

### 2.4 다른 후보 모델 비교

| 후보 | 한국어 품질 | 라이선스 | 비고 |
|---|---|---|---|
| **Gemma 4 26B/31B** | ⭐⭐⭐⭐ (140 언어 사전훈련) | Apache 2.0 ✓ | 멀티모달 + OCR — 표지판 문항 가능성 |
| Llama 3.3 70B | ⭐⭐⭐ | Llama Community | 대형, 한국어 약간 약함 |
| Qwen 2.5 14B/32B | ⭐⭐⭐⭐ | Apache 2.0 | 중국어 편향 |
| **Exaone 3.5 7.8B** (LG AI) | ⭐⭐⭐⭐⭐ | 비상업 라이선스 | 한국어 최강이나 상업 제한 |

→ **Gemma 4 가 라이선스 + 멀티모달 + 한국어 종합에서 최선**.

---

## 3. 통합 아키텍처

### 3.1 인터페이스 — Ollama (OpenAI 호환)

aitutor 의 `api/_llm/openai-chat.js` 가 표준 fetch 패턴이라 endpoint URL 만 바꾸면 그대로 동작.

```
┌─ aitutor (Lambda 또는 로컬 스크립트) ──────────────┐
│ api/_llm/local.js (신규) ─ OpenAI 호환 fetch        │
│   ├─ ENDPOINT = http://localhost:11434/v1/chat/completions │
│   └─ 환경변수 LOCAL_LLM_ENDPOINT 로 오버라이드 가능   │
└──────────────────┬──────────────────────────────┘
                   │ (HTTP)
                   ↓
┌─ Ollama 서버 ────────────────────────────────────┐
│ ollama serve (default :11434)                       │
│ 모델: gemma4:e4b (4B), gemma4:26b, gemma4:31b 등    │
│ /v1/chat/completions (OpenAI 호환)                  │
│ /api/chat (Ollama 네이티브, 권장)                    │
└──────────────────────────────────────────────────┘
```

### 3.2 신규 코드 (최소 변경)

```
api/_llm/local.js (신규, ~80줄)
  ├─ ENDPOINT = process.env.LOCAL_LLM_ENDPOINT || 'http://localhost:11434/v1/chat/completions'
  ├─ chat(...)        — OpenAI 호환 호출 (logUsage 자동)
  ├─ chatStream(...)  — SSE 스트리밍
  └─ provider = 'local-gemma4' 로 logUsage
```

`logUsage` 도 그대로 활용 — `llm_usage_log` 에 `provider='local-gemma4'`, `estimated_cost=0` 으로 기록 → 호출량 가시화 유지.

### 3.3 환경변수

```bash
# 로컬 개발 (관리자 PC)
LOCAL_LLM_ENDPOINT=http://localhost:11434/v1/chat/completions
LOCAL_LLM_MODEL=gemma4:e4b

# 클라우드 (시나리오 A 도입 시)
LOCAL_LLM_ENDPOINT=https://aitutor-llm.run.app/v1/chat/completions
LOCAL_LLM_API_KEY=...   # Cloud Run IAM 또는 자체 토큰
```

---

## 4. 시나리오 비교 (1차 채택: ⭐ 옵션 D)

### 4.0 옵션 D — 📱 모바일 PWA + WebGPU 온디바이스 ⭐ **1차 채택**

```
사용자 모바일 브라우저 (Chrome/Safari) — PWA 설치 (홈 화면)
  ↓ "AI 추가 해설" 버튼 클릭
브라우저 안의 transformers.js + WebGPU
  ├─ (첫 실행) Gemma 4 E4B ONNX 모델 다운로드 1.5~2.7GB → IndexedDB 캐시
  ├─ (이후) 캐시에서 즉시 로드
  └─ WebGPU 로 GPU 가속 추론 → 5~15 토큰/초
응답 표시 (백엔드 호출 0)
```

| 항목 | 값 |
|---|---|
| 인프라 비용 | **0원** (사용자 디바이스에서 추론) |
| 백엔드 호출 | **0회** (Lambda 미사용) |
| 데이터 격리 | ✅ 100% (외부 전송 없음) |
| Capacitor 필요 | ❌ 불필요 (단, 본 결정에서는 향후 확장 대비 **유지**) |
| 도입 난이도 | 🟡 중간 (transformers.js 통합 + ONNX Gemma 4 모델 + WebGPU 폴백) |
| 설치 동선 | Chrome/Safari "홈 화면에 추가" → 앱처럼 동작 |

#### WebGPU 브라우저 지원 (2026-04 시점)

| 환경 | 지원 |
|---|---|
| Chrome / Edge (Android, Desktop) | ✅ 113+ (2023~) |
| Safari (iOS / macOS) | ✅ 18.0+ (2024 가을 출시, 2026 시점 대다수) |
| Firefox | 🟡 130+ (Android/Desktop 일부) |
| 삼성 인터넷 | ✅ Chrome 기반 |

→ iOS 18+ 가 핵심. WebGPU 미지원 환경은 **WASM 폴백** 또는 외부 API fallback.

#### 디바이스 사양 가이드

| 사이즈 | 권장 디바이스 | 추론 속도 |
|---|---|---|
| **E2B** (1.5GB) | iPhone 13+, Galaxy S22+, 일반 안드로이드 6GB RAM+ | 8~20 t/s |
| **E4B** (2.7GB) | iPhone 15 Pro+ 8GB, Galaxy S24+ 12GB, 고사양 안드로이드 | 5~15 t/s |

→ 1차는 **E4B (4B) 권장** (한국어 품질 ↑). 저사양 디바이스는 자동으로 E2B 폴백 또는 외부 API.

---

### 4.1 옵션 A — 사용자 실시간 (클라우드 호스팅)

```
사용자가 카드 학습 시 "AI 추가 해설" 버튼 클릭
  ↓
aitutor Lambda → 로컬 모델 서버 (Cloud Run GPU 또는 EC2/Bedrock)
  ↓
스트리밍 응답
```

| 항목 | 값 |
|---|---|
| 호스팅 옵션 | Cloud Run GPU(L4) / EC2 g5 / AWS Bedrock 매니지드 |
| 비용 | 시간당 $0.7+ (Cloud Run L4) 또는 토큰 비용 (Bedrock) |
| 콜드스타트 | Cloud Run GPU: 10~30초 (사용자 첫 호출 지연) |
| 도입 난이도 | 🔴 높음 (인프라 + 보안 + 모니터링) |

### 4.2 옵션 B — 콘텐츠 생성 배치 (관리자 PC 로컬) ⏸ **보류**

```
관리자 PC 에 Ollama + Gemma 4 설치
  ↓
필요 시 driver-module/scripts/06_explain_local.js 실행
  ├─ DB SELECT (빈/짧은 해설)
  ├─ Ollama 호출 (배치)
  └─ JSON 저장 + 검수 후 DB UPDATE
```

| 항목 | 값 |
|---|---|
| 비용 | **0원** (관리자 PC 전기료 외) |
| 호출량 | 무제한 |
| 데이터 격리 | ✅ 100% (외부 전송 없음) |
| 도입 난이도 | 🟢 낮음 (`brew install ollama; ollama pull gemma4:e4b`) |
| 즉시 활용 | 운전면허 빈/짧은 해설 보완, KISA 추가 해설 |

### 4.3 옵션 C — 하이브리드 (장기 목표)

| 작업 | 사용 모델 |
|---|---|
| **모바일 사용자 실시간** | **로컬 Gemma 4 E4B (옵션 D — 본 라운드)** |
| 데스크톱 사용자 실시간 | OpenAI / Gemini / Claude (현재 그대로 — 후속 라운드에 PWA 동일 적용 검토) |
| 콘텐츠 생성 배치 | 옵션 B (보류) — 운전면허 해설 보완 진행 시 활성화 |

→ 본 라운드 = D, 다음 단계 후 점진 확장.

---

## 5. 1차 출시 — 옵션 D (모바일 PWA + WebGPU + Gemma 4 E4B)

### 5.1 신규 자산

```
src/lib/localAi/                       ← 신규 디렉토리
  ├─ index.js                          모델 로드/추론 진입점
  ├─ modelManager.js                   ONNX 모델 다운로드 + IndexedDB 캐시 관리
  ├─ inference.js                      transformers.js + WebGPU 호출
  └─ deviceCheck.js                    WebGPU 지원 + 디바이스 사양 감지

src/components/LocalAiBadge.jsx        ← "📱 디바이스 AI" 표시 + 모델 다운로드 진행률

src/tabs/QuizTab/AiExplanation.jsx     ← 수정: 'local' 프로바이더 추가
src/tabs/SettingsTab/LlmSettingsPanel  ← 수정: '디바이스 AI (Gemma 4 E4B)' 탭

prompts/driver-explanation.md          ← 운전면허 해설 작성 프롬프트 (재사용 자산)
```

### 5.2 작업 단계

#### Step 1 — 모델 ONNX 변환 + 호스팅 결정 (1일)

브라우저에서 직접 사용하려면 **Gemma 4 ONNX 형식** 필요.

| 옵션 | 장단점 |
|---|---|
| Hugging Face 의 **공식 ONNX 변환본** 사용 | ⭐ 가장 쉬움. CDN 으로 받음 |
| 자체 변환 + S3/CloudFront 호스팅 | 트래픽 통제 가능. 변환 + 양자화 필요 |
| **Hugging Face Hub** 직접 다운로드 | 모델 호스팅 위탁. CORS 정책 확인 필요 |

→ 1차는 **Hugging Face 공식 ONNX 사용** 가장 빠름. 트래픽 폭증 시 자체 호스팅으로 전환.

#### Step 2 — transformers.js 통합 (1~2일)

```bash
# 의존성 추가
npm install @xenova/transformers
```

```js
// src/lib/localAi/inference.js (예시)
import { pipeline } from '@xenova/transformers';

let pipe = null;

export async function getPipe(onProgress) {
  if (pipe) return pipe;
  pipe = await pipeline(
    'text-generation',
    'onnx-community/gemma-4-e4b-it',   // 모델 ID
    { progress_callback: onProgress, device: 'webgpu' }
  );
  return pipe;
}

export async function explainQuestion({ body, choices, answer }) {
  const pipe = await getPipe();
  const prompt = buildPrompt(body, choices, answer);  // §5.4 프롬프트
  const result = await pipe(prompt, { max_new_tokens: 256, temperature: 0.3 });
  return result[0].generated_text;
}
```

#### Step 3 — 디바이스 능력 감지 + 폴백 (반나절)

```js
// src/lib/localAi/deviceCheck.js
export async function checkDeviceAi() {
  // 1) WebGPU 지원 여부
  if (!navigator.gpu) return { supported: false, reason: 'WebGPU 미지원' };

  // 2) 디바이스 메모리 (가능하면)
  const memory = navigator.deviceMemory || 0;     // GB
  if (memory > 0 && memory < 6) return { supported: false, reason: '메모리 부족' };

  // 3) 모바일 여부 — 1차 라운드는 모바일만
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (!isMobile) return { supported: false, reason: '데스크톱 — 후속 라운드' };

  // 4) WebGPU adapter 확인 (실제 어댑터 동작 검증)
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { supported: false, reason: 'WebGPU 어댑터 없음' };

  return { supported: true, recommendedSize: memory >= 8 ? 'e4b' : 'e2b' };
}
```

→ 디바이스 AI 미지원 → 기존 외부 API (OpenAI 등) 자동 폴백.

#### Step 4 — 모델 다운로드 UX (반나절)

첫 실행 시 1.5~2.7GB 다운로드는 사용자 경험 핵심:

```
┌─ 디바이스 AI 활성화 카드 ─────────────────────────┐
│ 📱 이 기기에서 AI 해설을 받아볼 수 있습니다.       │
│   - 첫 실행 시 모델 다운로드 (약 2.7GB, 와이파이 권장) │
│   - 이후엔 기기에서 즉시 동작 (인터넷 불필요)       │
│   - 데이터는 외부로 전송되지 않습니다              │
│                                                  │
│ [활성화하기] [나중에]                              │
└─────────────────────────────────────────────────┘

활성화 클릭 시:
[● ●●●●●●○○○○○○○○○○ 35% — 945MB / 2.7GB]
"잠시만요... 다 받으면 한 번만 받으면 돼요!"
```

다운로드 중 백그라운드 가능, 다른 페이지 자유롭게 이용. 완료 시 토스트.

#### Step 5 — 프롬프트 설계 (`prompts/driver-explanation.md`)

```markdown
당신은 운전면허 학과시험 강사입니다. 학습자에게 친근하면서 정확한 해설을 작성합니다.

# 작성 규칙
- 분량: 2~3 문장 (필요 시 4문장까지)
- 관련 법령은 「법령명」 한국식 따옴표로 표기 (예: 「도로교통법」)
- 정답 번호와 함께 "왜 이게 맞는지" 설명
- 오답 보기 중 헷갈리는 것이 있으면 짧게 보충 설명
- 한국어로만 작성

# 입력
문제: {body}
보기:
① {choices[0]}
② {choices[1]}
③ {choices[2]}
④ {choices[3]}
정답: {answer}{answer_extra ? `, ${answer_extra}` : ''}

# 출력
해설만 작성 (다른 메타정보 포함 X)
```

이 프롬프트는 콘텐츠 배치(옵션 B)에서도 재사용 가능 → `prompts/` 디렉토리 공통 자산.

#### Step 6 — UI 통합 (1일)

`src/tabs/QuizTab/AiExplanation.jsx` 의 `PROVIDERS` 에 'local' 추가:

```jsx
const PROVIDERS = [
  { key: 'local',  label: '📱 디바이스 AI', color: '#16a34a', mobileOnly: true },
  { key: 'gemini', label: 'Gemma',     color: '#4285f4' },
  { key: 'openai', label: 'OpenAI',    color: '#10a37f' },
  { key: 'claude', label: 'Claude',    color: '#d97706' },
];
```

모바일 + WebGPU 지원 시 기본 'local' 자동 선택. 그렇지 않으면 외부 API.

#### Step 7 — 라이브 검증 (반나절)

| 검증 디바이스 | 기대 |
|---|---|
| iPhone 15 Pro (Safari 18) | ✅ E4B 동작 |
| iPhone 13 (Safari 18) | ✅ E2B 폴백 또는 E4B |
| Galaxy S24 (Chrome) | ✅ E4B |
| 일반 갤럭시 (Chrome) | ✅ E2B 또는 외부 API 폴백 |
| iPad / 데스크톱 | ❌ 1차 미지원 (외부 API) |
| WebGPU 미지원 구형 폰 | ❌ 외부 API 폴백 |

### 5.3 비용·시간 추정

| 항목 | 값 |
|---|---|
| 의존성 추가 | `@xenova/transformers` (~3MB) |
| 빌드 후 dist 증가 | ~수 MB (WebGPU 셰이더 포함) |
| 사용자 첫 다운로드 | 2.7GB (E4B 기준, 와이파이 1~10분) |
| 추론 속도 | 모바일 5~15 t/s |
| 배터리 영향 | AI 호출 시 발열·소모 ↑ |
| **인프라 비용** | **0원** |
| **사용자 비용** | 데이터 (와이파이 권장) + 디스크 캐시 |

---

## 6. 후속 라운드 계획

### 6.1 2차 — 데스크톱 PWA 지원 (모바일 출시 후 1~2주 안정화 뒤)

데스크톱 브라우저는 일반적으로 GPU·메모리 여유가 있어 더 큰 모델도 가능:

| 항목 | 값 |
|---|---|
| 대상 | Chrome/Edge/Safari 데스크톱 |
| 모델 | Gemma 4 E4B (모바일과 통일) 또는 26B (NVIDIA RTX 등 강한 GPU) |
| 작업 | `deviceCheck.js` 의 모바일 체크 제거 + 데스크톱 GPU 능력 추가 검증 |
| 코드 영향 | 매우 낮음 — 모바일과 동일 인프라 |

### 6.2 3차 — 옵션 B 콘텐츠 생성 배치 (운전면허 해설 보완 시)

§8.15 운전면허 해설 보완 결정 시 활성화. 관리자 PC 에 Ollama + Gemma 4 26B 로:

```bash
brew install ollama
ollama pull gemma4:26b
node driver-module/scripts/06_explain_local.js
```

본 라운드 §5.5 의 프롬프트(`prompts/driver-explanation.md`) 그대로 재사용.

### 6.3 4차 — 옵션 A 클라우드 호스팅 (트래픽 증가 시)

다음 조건 중 둘 이상 충족 시 도입 검토:
- 외부 API 월 비용이 일정 임계 (예: $30) 초과
- 데스크톱 사용자 비중이 높고 PWA 캐시 부담이 큼
- B2B 도입으로 데이터 격리 요구

호스팅 옵션:

| 옵션 | 비용 | 콜드스타트 | 운영 부담 |
|---|---|---|---|
| **AWS Bedrock — Gemma 4** (가능 시) | 토큰 비용 | 0 | 🟢 낮음 |
| **Vertex AI** (Google Cloud) | 토큰 비용 | 0 | 🟢 낮음 |
| **Cloud Run + GPU(L4 24GB)** | 시간당 $0.7, 호출 시만 과금 | 10~30초 | 🟡 중간 |
| **EC2 g5.xlarge (A10G 24GB)** | 월 $720 (24/7) | 0 | 🔴 높음 |

### 6.4 5차 — Capacitor 네이티브 앱 (App Store 진출 시)

- Capacitor 셸은 이번 결정에서 **유지 (제거 안 함)** — 향후 확장 대비
- App Store / Play Store 진출 결정 시 활성화
- 모델 추론은 **MediaPipe LLM Inference** (Android/iOS 공식 SDK) 또는 **WebView + 본 라운드 PWA 코드 재사용**
- 코드 재사용률 ↑ (PWA 가 안에서 그대로 동작)

---

## 7. 검증 계획

### 7.1 품질 메트릭

| 항목 | 측정 방법 | 목표 |
|---|---|---|
| 한국어 자연스러움 | 사람 검수 (5점 척도) | 평균 4점+ |
| 사실 정확성 (법조항) | 사람 검수 (적합/부적합) | 95%+ |
| 분량 적절성 | 길이 80~300자 비율 | 80%+ |
| 「법령명」 표기 | 정규식 매칭 | 70%+ |
| 외부 API 와 비교 | 동일 문항 동일 프롬프트로 양쪽 호출 후 비교 | A/B 테스트 |

### 7.2 작은 시작

운전면허 빈 3건(`#418/#643/#964`) 으로 5번 반복 호출 → 일관성 확인 → OK 면 짧은 42건으로 확장.

### 7.3 회귀 위험

| 항목 | 영향 |
|---|---|
| 코드 영향 | 신규 파일만 (외부 API 흐름 변경 0) |
| 데이터 영향 | 운전면허 explanation 일부 UPDATE (보완 케이스만) |
| 라이브 영향 | 옵션 B 는 0 (관리자 PC 작업) |
| 회귀 가능성 | 매우 낮음 |

---

## 8. 의사결정 결과 (2026-04-25 확정)

| # | 항목 | **확정** |
|---|---|---|
| 1 | 시나리오 | ✅ **D — 모바일 PWA + WebGPU 온디바이스** (옵션 A/B 보류, C 는 장기) |
| 2 | 모델 사이즈 | ✅ **Gemma 4 E4B (4B)** 우선, 저사양 디바이스는 E2B 폴백 |
| 3 | 추론 인프라 | ✅ **transformers.js + ONNX + WebGPU** (브라우저 안에서 직접) |
| 4 | 모델 호스팅 | ✅ Hugging Face 공식 ONNX 사용 (트래픽 폭증 시 자체 S3 전환) |
| 5 | 첫 활용 작업 | ✅ **모바일 사용자 AI 추가 해설** (카드 학습 시 "AI 해설" 클릭) |
| 6 | 데스크톱 사용자 | ✅ 현재 외부 API 그대로 (후속 라운드에 PWA 동일 적용) |
| 7 | Capacitor | ✅ **유지** (향후 App Store 진출 가능성 대비, 즉시 재활용) |
| 8 | 콘텐츠 생성 배치 (옵션 B) | ⏸ 보류 (§8.15 운전면허 해설 보완 자체가 보류) |
| 9 | 클라우드 호스팅 (옵션 A) | ⏸ 보류 (모바일 PWA 검증 후 데스크톱·B2B 확장 시 재검토) |

---

## 9. 다음 작업 제안 — 옵션 D 1차 출시 워크플랜

```
Day 1 (반나절)
  - @xenova/transformers 의존성 추가
  - src/lib/localAi/ 디렉토리 신설
  - deviceCheck.js — WebGPU + 모바일 + 메모리 감지
  - Hugging Face 의 onnx-community/gemma-4-e4b-it 모델 로드 시범
  - 모바일 디바이스(개인 폰) 에서 1문항 추론 검증

Day 2 (반나절)
  - inference.js — pipeline 통합 + 한국어 프롬프트
  - prompts/driver-explanation.md 작성
  - 운전면허 #1, #5 같은 일반 문항 5건 추론 → 품질 측정

Day 3 (1일)
  - LocalAiBadge.jsx — 모델 다운로드 진행률 UI
  - modelManager.js — IndexedDB 캐시 관리 + 진행률 콜백
  - 사용자 동의 카드 ("📱 디바이스 AI 활성화") UX 디자인

Day 4 (1일)
  - AiExplanation.jsx 수정 — PROVIDERS 에 'local' 추가, 모바일+WebGPU 자동 선택
  - LlmSettingsPanel — '디바이스 AI' 탭 + 활성화 상태 표시
  - 외부 API 폴백 로직

Day 5 (반나절)
  - 빌드 + 배포
  - 라이브 검증 — iPhone / Android / 데스크톱 (폴백 확인)
  - 추론 속도 / 배터리 / 캐시 동작 측정

Day 6+ (후속)
  - 6.1 데스크톱 PWA 지원 (deviceCheck 의 모바일 체크 제거)
  - 6.4 Capacitor 네이티브 검토 (App Store 결정 시점)
```

### 작은 시작 — Day 1 핵심 검증

가장 큰 위험은 **iPhone Safari 18 에서 transformers.js + WebGPU 실제 동작 여부**. 이걸 가장 먼저 확인해야 다음 단계 의미 있음. Day 1 끝에 "iPhone 에서 1문항 한국어 해설 받았다" 가 마일스톤.

---

## 10. REBUILD16 와의 연계

| REBUILD16 항목 | REBUILD17 와의 관계 |
|---|---|
| §3.4 SSM 운영 플래그 → §8.10 DB 토글로 대체 | 동일 패턴 — 인프라 권고를 더 가벼운 방식으로 대체 |
| §8.4 LLM 호출 fetch 통일 | 그대로 활용 — `_llm/local.js` 가 자연스럽게 합류 |
| §8.8 llm_usage_log | provider='local-gemma4' 로 호출량 가시화 |
| §8.9 LlmUsagePanel | 로컬 모델 호출도 자동 표시 (코드 변경 0) |
| §8.15 운전면허 해설 보완 보류 | **REBUILD17 도입 시 보류 해소 가능** |
| §12.2-F AI 비용 임계값 자동 차단 | 로컬 모델 도입 시 임계값 자체가 거의 0 |

---

## 11. 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-04-25 | 최초 작성 — Gemma 4(Apache 2.0, 2026-04-02 출시) 로컬 모델 도입 계획 + 시나리오 A/B/C + 1주 워크플랜 | Claude Code |
| 2026-04-25 | 의사결정 반영 — **시나리오 D (모바일 PWA + WebGPU 온디바이스) 1차 채택**. Capacitor 유지(향후 확장 대비). 모바일 우선·데스크톱 후속. 옵션 A/B 보류. §0/§4/§5/§6/§8/§9 갱신 | Claude Code |
| 2026-04-26 ~ 04-27 | 구현 + 디버깅 + 데스크탑 전용으로 정책 전환. 상세는 §12 참고 | Claude Code |

---

## 12. 구현 이력 (2026-04-26 ~ 04-27)

### 12.1 최종 채택 정책 — 데스크탑(WebGPU) 전용

REBUILD17 §0 의 "시나리오 D (모바일 PWA + WebGPU 온디바이스)" 1차 채택 → 실제 구현 검증 결과 **모바일 환경의 알려진 한계**로 인해 **데스크탑 전용 정책으로 정정**.

| 항목 | 최초 계획 (§0) | 실제 구현 (§13) |
|---|---|---|
| 우선 환경 | 모바일 PWA | **데스크탑 Chrome/Edge** |
| 추론 백엔드 | MediaPipe LLM Inference Web (WebGPU + LiteRT) | **Hugging Face Transformers.js + ONNX Runtime (WebGPU)** |
| 모델 파일 | `litert-community/gemma-4-E*B-it-litert-lm` (`.web.task`) | `onnx-community/gemma-4-E*B-it-ONNX` (`.onnx`) |
| Quantization | 자동 | **`q4f16` 단일 (string)** |
| 디바이스 분기 | (없음) | **WebGPU 전용, 분기 없음** |
| 모바일 | 1차 지원 대상 | **차단 (WebGPU 미지원으로 통합 안내)** |

### 12.2 구현/디버깅 타임라인 (2026-04-26)

| 시각 (KST) | ECR digest | 이벤트 |
|---|---|---|
| ~13:00 | (다수) | MediaPipe + LiteRT-Community `web.task` 시도. chat template 4차 시행착오 (`<start_of_turn>` → 제거 → `<\|turn>system+user+model` → `<\|turn>user` 단일). 모바일 모델 관리 패널 (E2B/E4B) UI 추가 |
| 13:45 | `7ed462fa` | **Hugging Face Transformers.js + ONNX 로 전환** ([litert-community 의 web 버전 quality 이슈 공식 인정](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/discussions/1) 발견 후) |
| 14:02 | `501da0f6` | SharedArrayBuffer 미지원 환경 fix + WASM fallback 추가 |
| 14:11 | `35c0c621` | deviceCheck 데스크탑 차단 해제 |
| 14:46 | **`f9f16ee6`** | **tokenizer 직접 호출 (i.rgb fix)** — 첫 데스크탑 정상 동작 시점 ⭐ |
| 14:56 | `fdcb60fb` | progress_callback 파일별 누적 합산 (진행률 와리가리 fix) |
| 15:12 | `d88fbabb` | 모델 관리 패널 액션 정리 (다운로드/활성화/언로드/삭제) |
| 15:25 | `b89cbca4` | SYSTEM_PROMPT 재설계 + few-shot 예시 |
| 15:34 | `e6fa16b5` | 모바일 WASM 우선 / 데스크탑 WebGPU 우선 분기 |
| 18:14 ~ 18:51 | (다수) | dtype dict + UI 사이즈 정밀화 + 파일 상세 보기 |
| 20:02 ~ 20:40 | (다수) | 모바일 분기 제거 시도. dtype dict 키 누락으로 모바일 9 GB 다운로드 사고 발생 ([dtype 을 string 으로 강제하면 해결됨을 발견](https://github.com/huggingface/transformers.js)) |
| 21:03 | `bdd5373c` | `Gemma4ForCausalLM` 으로 변경 시도 (`textOnly: true` 자동) — **데스크탑 동작도 함께 깨짐** |
| 21:27 | `f9f16ee6` (재지정) | **`#4 (14:46)` 시점으로 Lambda 이미지 롤백** |
| 22:03 | `41acc7e` (commit) | 로컬 src 도 14:46 시점으로 복원 |
| 22:47 | `adc86fa` (commit) | **B3 정책: 모바일 진입 차단 추가** (UA 기반 `isMobile` 체크) |
| 22:55 | `05c9b01` (commit) | **모바일/WASM 관련 로직 일체 제거** — WebGPU 단일 시도, 폴백 없음, dtype string `'q4f16'` 강제 |
| 23:08 | `cdbf40b` (commit) | 주석 정리 (이력성/장황한 설명 제거, 107줄 → 24줄) |
| 23:37 | `68821c2` (commit) | UI 사이즈 측정을 `blob.size` (실측) 강제 + 파일 목록 기본 펼침 |
| 23:46 | `0595866` (commit) | 진행바 사이즈 표시 정직화 (`(추정)` 라벨 + 안내) |
| **2026-04-27 ~00:00** | `577a408` (commit) | `MODEL_META.approxSizeGB` 콘솔 실측값 반영 (E2B 1.5→3.2 / E4B 2.7→4.9) + `fmtMB` 형식 통일 |

### 12.3 핵심 의사결정과 사유

#### A. 추론 백엔드: MediaPipe → Transformers.js 전환

| 요소 | MediaPipe + LiteRT (`.web.task`) | Transformers.js + ONNX |
|---|---|---|
| 한국어 추론 | ❌ garbage 출력 (다국어 토큰 mix), [LiteRT-Community 가 web 버전 issue 공식 인정](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/discussions/1) | ✅ 정상 |
| chat template | 수동 작성 필요 (Gemma 4 새 토큰 `<\|turn>` ) | `processor.apply_chat_template()` 자동 |
| 진행률 callback | 단일 파일 단위 | 파일별 emit (누적 합산 필요) |
| Quantization | 모델 파일 안에 내장 | dtype 옵션으로 선택 (q4/q4f16/fp16/fp32/quantized) |

#### B. dtype: `'q4f16'` 단일 string (dict 절대 금지)

```js
// ✅ 안전 (모든 컴포넌트에 일괄 적용)
dtype: 'q4f16'

// ❌ 위험 — 키 누락 시 일부 컴포넌트가 fp32(기본값) 받아 9 GB+ 폭발
dtype: { embed_tokens: 'q4f16', decoder_model_merged: 'q4f16', ... }
```

#### C. 모바일 차단 → WebGPU 전용

모바일에서 시도했던 것들과 결과:
- WebGPU + q4f16: GPU OOM → 페이지 크래시 ("앗, 이런!")
- WASM + q4: 동작은 OK, 추론 매우 느림 (토큰당 1~3초)
- try/catch fallback: WebGPU 1차 다운로드 (q4f16) 실패 → WASM 2차 다운로드 (q4) → **두 set 누적 9 GB**

→ 최종: **모바일에서는 가능한 모든 시도가 사용자 경험 저하**. `deviceCheck` 의 WebGPU 미지원 안내로 통합 차단.

#### D. `Gemma4ForConditionalGeneration` 사용 (textOnly 미적용)

`Gemma4ForCausalLM` 사용 시 `textOnly=true` 가 자동 적용되어 vision/audio encoder 안 받음 (~0.25 GB 절약). 그러나 데스크탑 동작 회귀 발생 → 본 정책에서는 **`ForConditionalGeneration` 유지** (multimodal 컴포넌트도 함께 받음).

### 12.4 다운로드 파일 명세 (실측, 2026-04-27)

데스크탑 콘솔 진단 (`caches.open('transformers-cache')` + `blob.size` 합산):

#### 📦 E2B — 15개 / **3.17 GB**

| 카테고리 | 파일 | 사이즈 |
|---|---|---:|
| Decoder | `onnx/decoder_model_merged_q4f16.onnx` + `.onnx_data` | 1.42 GB |
| Embed tokens | `onnx/embed_tokens_q4f16.onnx` + `.onnx_data` | 1.48 GB |
| Audio encoder | `onnx/audio_encoder_q4f16.onnx` + `.onnx_data` | 163 MB |
| Vision encoder | `onnx/vision_encoder_q4f16.onnx` + `.onnx_data` | 95 MB |
| 토크나이저 | `tokenizer.json` + `tokenizer_config.json` + `chat_template.jinja` | 19.4 MB |
| 메타 | `config.json` + `generation_config.json` + `processor_config.json` + `preprocessor_config.json` | ~7 KB |

#### 📦 E4B — 16개 / **4.84 GB**

| 카테고리 | 파일 | 사이즈 |
|---|---|---:|
| Decoder | `decoder_model_merged_q4f16.onnx` + `.onnx_data` + `.onnx_data_1` | **2.71 GB** (E2B 보다 2GB 한계로 split) |
| Embed tokens | `embed_tokens_q4f16.onnx` + `.onnx_data` | 1.88 GB |
| Audio encoder | `audio_encoder_q4f16.onnx` + `.onnx_data` | 164 MB |
| Vision encoder | `vision_encoder_q4f16.onnx` + `.onnx_data` | 96 MB |
| 토크나이저 + 메타 | (E2B 와 동일) | ~19.4 MB |

> 단위: IEC GiB (1 GB = 2³⁰ bytes). HuggingFace 페이지의 SI GB 표기와 약 7.4% 차이 — 같은 데이터.

### 12.5 코드베이스 구조 (격리 모듈)

```
src/labs/local-ai/                    # 외부 코드 import 0건 (격리 원칙)
├── index.jsx                         # /lab/local-ai 라우트 진입점 + 가드 (lab_local_ai_enabled)
├── LocalAiExplanation.jsx            # 메인 화면 (운전면허 문항 + activate + generate)
├── lib/
│   ├── inference.js                  # loadPipe, explainQuestion, disposePipe (Transformers.js)
│   ├── prompts.js                    # SYSTEM_PROMPT + buildMessages + buildSinglePrompt
│   ├── modelCache.js                 # Transformers.js Cache API 조회/관리 (blob.size 실측)
│   ├── deviceCheck.js                # WebGPU 지원 체크 + memoryWarning
│   └── wakeLock.js                   # Wake Lock API (다운로드 중 화면 꺼짐 방지)
└── components/
    ├── DeviceCheckBadge.jsx          # ✅/❌ 디바이스 가능 여부 + 진단 정보
    ├── ModelDownloadCard.jsx         # 다운로드 진행률 / 활성화 카드
    └── ModelManagerPanel.jsx         # 모델 관리 패널 (다운로드/활성화/언로드/삭제 + 파일 목록)
```

### 12.6 알려진 한계 / 미해결 사항

| 항목 | 현재 상태 | 향후 |
|---|---|---|
| 모바일 지원 | ❌ 차단 (UA + WebGPU 통합) | Capacitor + Native LiteRT-LM 별도 앱 (대규모 작업) |
| 더 큰 Gemma 4 (26B/31B) | ❌ ONNX 변환 없음 (HF 미공개) | onnx-community 변환 대기 |
| text-only 다운로드 | ❌ multimodal 전체 받음 (~0.25 GB 낭비) | `Gemma4ForCausalLM` 적용 — 데스크탑 회귀 원인 재분석 후 |
| 한국어 강세 모델 | Gemma 4 만 지원 | Qwen 2.5, Llama 3.2 등 멀티 모델 레지스트리 (별도 프로젝트) |
| 진행 사이즈 정확성 | "(추정)" 명시 | Transformers.js progress_callback 의 total 정확도 개선 시 (라이브러리 의존) |

### 12.7 ESLint / 동작 검증 사항

- ✅ `Gemma4ForConditionalGeneration` import + `dtype: 'q4f16'` (string) + `device: 'webgpu'`
- ✅ `processor.tokenizer(prompt, { add_special_tokens: false, return_tensors: 'pt' })` — multimodal preprocessing 우회 (i.rgb 에러 회피)
- ✅ `model.generate({ ...inputs, max_new_tokens, do_sample, temperature, top_k, streamer })`
- ✅ Cache 측정: 항상 `blob.size` (Content-Length 헤더 무시)
- ✅ deviceCheck: WebGPU API + adapter 동작 + (옵션) `deviceMemory` 경고
- ❌ try/catch fallback 제거 (모바일 누적 다운로드 원인이었음)
- ❌ WASM 환경 설정 제거 (`env.backends.onnx.wasm.*`)
- ❌ 모바일 분기 일체 제거 (`isMobileEnv`, UA 패턴)

---

## 13. 참고 자료

### 13.1 외부 자료 (모델/라이브러리)

- [Gemma 4: Byte for byte, the most capable open models — Google Blog](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/)
- [Gemma 4 — Google DeepMind](https://deepmind.google/models/gemma/gemma-4/)
- [Welcome Gemma 4: Frontier multimodal intelligence on device — Hugging Face](https://huggingface.co/blog/gemma4)
- [Gemma 4 available on Google Cloud — Google Cloud Blog](https://cloud.google.com/blog/products/ai-machine-learning/gemma-4-available-on-google-cloud)
- [Google Releases Gemma 4 in Four Model Sizes Under Apache 2.0 — gHacks](https://www.ghacks.net/2026/04/06/google-releases-gemma-4-in-four-model-sizes-under-apache-2-0-license/)
- [gemma4 — Ollama Library](https://ollama.com/library/gemma4)
- [Run Google's Gemma 4 Locally — Full Ollama Setup Guide](https://medium.com/@nitinsgavane/free-run-googles-gemma-4-locally-full-ollama-setup-guide-226ce94a6fdb)
- [Bringing AI Closer to the Edge with Gemma 4 — NVIDIA Technical Blog](https://developer.nvidia.com/blog/bringing-ai-closer-to-the-edge-and-on-device-with-gemma-4/)
- [Gemma 4 31B Instruct API Pricing 2026](https://pricepertoken.com/pricing-page/model/google-gemma-4-31b-it)
- [transformers.js — Hugging Face 브라우저 추론 라이브러리](https://huggingface.co/docs/transformers.js)
- [WebGPU API — MDN 문서](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [PWA 설치 가능 가이드 — web.dev](https://web.dev/articles/install-criteria)

### 13.2 §12 구현 디버깅 중 참조한 자료

- [LiteRT-Community Gemma 4 E4B web 버전 알려진 이슈 토론](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/discussions/1) — MediaPipe + LiteRT-Community `web.task` 의 한국어 garbage 출력 / multimodal 미지원 / quality 문제 공식 인정
- [onnx-community/gemma-4-E2B-it-ONNX](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX) — Hugging Face 공식 ONNX 변환본 (현재 사용)
- [onnx-community/gemma-4-E4B-it-ONNX](https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX) — 동일, E4B 변형
- [Gemma 4 Prompt Formatting (공식)](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4) — Gemma 4 의 새 chat token (`<|turn>...<turn|>`) 정의
- [MediaPipe LLM Inference Web 가이드](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) — Gemma 4 가 다른 chat template 사용한다는 명시
- [tylermullen/Gemma4 Space](https://huggingface.co/spaces/tylermullen/Gemma4) — MediaPipe Web + Gemma 4 동작 확인된 유일한 공개 데모 (bundle.js 분석으로 chat template 형식 추출)
- [MediaPipe Issue #6270](https://github.com/google-ai-edge/mediapipe/issues/6270) — Apple M4 + Gemma 4 E2B WASM memory 충돌 버그
- [llama.cpp #21321](https://github.com/ggml-org/llama.cpp/issues/21321) / [#21516](https://github.com/ggml-org/llama.cpp/issues/21516) — Gemma 4 unused token 무한 루프 (다른 백엔드)
- [litert-torch #994](https://github.com/google-ai-edge/litert-torch/issues/994) — Gemma 3n quantization "tiller tiller" garbage 출력
- [Transformers.js v4 (WebGPU + 8B+ 지원)](https://github.com/huggingface/transformers.js)
- [ONNX Runtime Web — fp16 / WebGPU 지원](https://onnxruntime.ai/docs/tutorials/web/)
