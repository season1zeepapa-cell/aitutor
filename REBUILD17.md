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
| 2026-04-27 | **모델 다중화** — Qwen 3.5 0.8B / 2B 추가 (총 4개), `MODEL_REGISTRY` 일반화, **메모리 현황 카드** 신규. 상세는 §13 참고 | Claude Code |
| 2026-04-27 (오후) | **모델 선택 UX 통합** — 모델 카드별 메모리 적합성 인라인 (✅⚠️❌) + **메모리 확보 도움말 카드** 신규 (디바이스별 가이드 + "가장 큰 ✅ 모델로 전환" / "다른 캐시 정리" 단축 액션). 상세는 §13.11 참고 | Claude Code |
| 2026-04-27 (오후 2차) | **Qwen 해설 생성 fix** — `apply_chat_template` 에 `tokenize: false` 명시 ("Array must not be empty" 해결). 상세는 §13.12 참고 | Claude Code |
| 2026-04-27 (오후 3차) | **라이트/다크 테마 통일** — 신규 컴포넌트들이 직접 색(`bg-white`/`bg-blue-50` 등) 사용해 다크 모드 깨졌던 것을 기존 프로젝트 색 시스템(`bg-card-bg`/`text-text` CSS 변수 + 의미색 `dark:` 페어)으로 통일. 상세는 §13.13 참고 | Claude Code |
| 2026-04-27 (오후 4차) | **WebGPU 한계 진단 + 고성능 모드** — `powerPreference: 'high-performance'` 적용 + 어댑터 절대 최대 / 디폴트 device 한계 / 최대치 요청 device 한계 3단계 비교 측정. 상세는 §13.14 참고 | Claude Code |
| 2026-04-27 (오후 5차) | **"Device failed at creation" 콘솔 에러 fix** — §13.14 의 측정용 device 2회 생성이 transformers.js 의 device 와 경합. 측정용 device 생성 제거, 어댑터 limits + WebGPU 사양 디폴트 상수만 표시. 상세는 §13.15 참고 | Claude Code |
| 2026-04-27 (오후 6차) | **프롬프트 컴팩트 튜닝 + 객관식 보기별 해설 강제** — SYSTEM 70% 절감 (250 → 75 토큰), few-shot 예시 제거, USER 끝의 cue (`각 보기별 해설:`) 로 출력 구조 강제. 상세는 §13.16 참고 | Claude Code |
| 2026-04-27 (오후 7차, 분석만) | **PWA / Capacitor / 네이티브 LLM SDK 비교 분석** — 모바일에서 메모리 확보 가능성 평가. 결론: PWA·Capacitor WebView 만으론 효익 미미, 네이티브 LLM SDK 통합만 게임체인저. **보류** (트리거 조건 정의). 상세는 §13.17 참고 | Claude Code |

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

## 13. 모델 다중화 — Qwen 3.5 추가 + 메모리 현황 카드 (2026-04-27)

### 13.1 배경 — 최신성 + 사이즈 + 한국어 강세 동시 확보

§12 의 데스크탑 전용 정책으로 안정화된 후, 다음 한계가 남았음:

| 항목 | Gemma 4 단독 시점 | 한계 |
|---|---|---|
| 다운로드 사이즈 | E2B 3.2 GB / E4B 4.9 GB | 사용자 첫 다운로드 부담 큼 |
| 한국어 강세 | 다국어 사전훈련 (140 언어) | 명시적 한국어 최적화 모델 아님 |
| 멀티모달 컴포넌트 | vision + audio encoder 약 0.25 GB | 텍스트 해설용엔 불필요한 다운로드 낭비 |
| 사용자 메모리 가시성 | `deviceMemory` 만 단순 노출 | 모델 적재 가능성 사전 판단 어려움 |

→ **한국어 자격증 해설 보조** 라는 본 라운드 목적엔 **더 가볍고 텍스트 전용이며 한국어 강세인 모델**이 필요. 단, 기존 Gemma 4 도 그대로 두고 **추가**로 비교 가능하게.

### 13.2 모델 선정 (2026-04-27 시점 최신성 검증)

KMMLU-Pro 논문(arXiv 2507.08924) 결론: **소형 모델로 한국 자격증 정확 풀이는 32B+ 만 가능**. 따라서 본 라운드 목적은 "정답 풀이"가 아닌 **"한국어 자연스러움 + 법조항 표기 + 해설 보조"** 로 재설정.

비교표 (출시일 기준):

| 모델 | 출시 | 라이선스 | 한국어 | ONNX | 채택 |
|---|---|---|:-:|:-:|---|
| **Qwen 3.5-0.8B** | 2026-02 (~2개월) | Apache 2.0 | 다국어 | onnx-community 공식 | ✅ |
| **Qwen 3.5-2B** | **2026-03-01** (~2개월) | Apache 2.0 | ⭐⭐⭐⭐ "한국어 강세" 공식 명시 | onnx-community 공식 | ✅ |
| Qwen 3.5-4B | 2026-03-01 | Apache 2.0 | ⭐⭐⭐⭐ | 공식 | 보류 (3 GB) |
| EXAONE 4.0 1.2B | 2025-07-15 (9개월) | EXAONE-NC ⚠️ | ⭐⭐⭐⭐⭐ KMMLU-Pro 42.7 | ❌ 공식 ONNX 없음 | 보류 |
| EXAONE 3.5 2.4B | 2024-12-09 (1년 4개월) | NC | ⭐⭐⭐⭐⭐ | ✅ | 탈락 (outdated, 4.0 후속) |
| Qwen3-1.7B | 2025-04 (1년) | Apache 2.0 | 다국어 | ✅ | 탈락 (3.5 후속) |
| SmolLM3-3B | 2025년 | Apache 2.0 | ❌ 한국어 미지원 | ✅ | 탈락 |
| SKT A.X K1 | 2026-01 | Apache 2.0 | ⭐⭐⭐⭐⭐ KMMLU 80.2 | ❌ | 탈락 (519B MoE — 브라우저 불가) |

→ **현 시점(2026-04-27) 합리 선택 = Qwen 3.5 시리즈 (Apache 2.0 + 2개월 전 출시 + 한국어 강세 + onnx-community 공식 변환)**

### 13.3 추가된 모델 사양

| key | 모델 | params | approxSizeGB (q4f16) | 라이선스 | 비고 |
|---|---|---|---:|---|---|
| `e2b` | Gemma 4 E2B | 2B | 3.2 | Apache 2.0 | 기존 |
| `e4b` | Gemma 4 E4B | 4B | 4.9 | Apache 2.0 | 기존 |
| **`qwen35-08b`** | **Qwen 3.5 0.8B** | **0.8B** | **~0.6** | **Apache 2.0** | **신규 — 초경량** |
| **`qwen35-2b`** | **Qwen 3.5 2B** | **2B** | **~1.6** | **Apache 2.0** | **신규 — 한국어 강세** |

> 사이즈는 q4f16 단일 quantization. Qwen 3.5 는 **텍스트 전용** 이라 multimodal 컴포넌트(0.25 GB) 만큼 추가 절감.

### 13.4 코드 변경

#### A. `MODEL_REGISTRY` 일반화 (`lib/inference.js`)

기존 `MODEL_IDS` / `MODEL_META` / `MODEL_URLS` 분리 → 단일 `MODEL_REGISTRY` 객체로 통합. 새 모델 추가는 등록 한 줄로 끝.

```js
export const MODEL_REGISTRY = {
  e2b:          { id: 'onnx-community/gemma-4-E2B-it-ONNX', ModelClass: Gemma4ForConditionalGeneration, family: 'gemma4',  approxSizeGB: 3.2, ... },
  e4b:          { id: 'onnx-community/gemma-4-E4B-it-ONNX', ModelClass: Gemma4ForConditionalGeneration, family: 'gemma4',  approxSizeGB: 4.9, ... },
  'qwen35-08b': { id: 'onnx-community/Qwen3.5-0.8B-ONNX',   ModelClass: Qwen3_5Class,                   family: 'qwen3.5', approxSizeGB: 0.6, ... },
  'qwen35-2b':  { id: 'onnx-community/Qwen3.5-2B-ONNX',     ModelClass: Qwen3_5Class,                   family: 'qwen3.5', approxSizeGB: 1.6, ... },
};

// 호환성 — 기존 import 들이 깨지지 않게 derive
export const MODEL_IDS  = Object.fromEntries(Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, v.id]));
export const MODEL_META = Object.fromEntries(Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, { ... }]));
export const MODEL_URLS = Object.fromEntries(Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, `https://huggingface.co/${v.id}`]));
export const MODEL_KEYS = Object.keys(MODEL_REGISTRY);
```

#### B. family 별 processor 분기

| family | processor | 사유 |
|---|---|---|
| `gemma4` | `AutoProcessor.from_pretrained` | 멀티모달 (image + audio preprocessor 포함) |
| `qwen3.5` | `AutoTokenizer.from_pretrained` (tokenizer 만) | 텍스트 전용 — processor 없음 |

Qwen 의 경우 호출 인터페이스 통일을 위해 tokenizer 객체를 processor 형태로 감쌈:
```js
processor = {
  tokenizer,
  apply_chat_template: (msgs, opts) => tokenizer.apply_chat_template(msgs, opts),
};
```

#### C. Qwen3_5 클래스 import 안전망

```js
import * as tf from '@huggingface/transformers';
const Qwen3_5Class = tf.Qwen3_5ForConditionalGeneration || tf.AutoModelForCausalLM;
```

→ transformers.js v4.2.0 에서 export 확인됨 (`typeof === 'function'`). 미존재 시 `AutoModelForCausalLM` 자동 폴백.

#### D. `cached` 객체에 `family` 추가

```js
cached = { processor, model, size, family };
```

`explainQuestion(pipe, ...)` 에서 family 별 추가 분기 가능 (현재는 prompts 가 family-agnostic 이라 분기 없음 — Qwen 3.5 / Gemma 4 양쪽 모두 system role + apply_chat_template 지원).

### 13.5 메모리 현황 카드 (`components/MemoryStatus.jsx`) — 신규

#### 표시 항목

| 항목 | 출처 | Chrome/Edge | Safari | Firefox | 모바일 |
|---|---|:-:|:-:|:-:|:-:|
| **디바이스 RAM** | `navigator.deviceMemory` | ✅ | ❌ | ❌ | Chromium 기반만 ✅ |
| **JS Heap (현재 페이지)** | `performance.memory` (non-standard) | ✅ | ❌ | ❌ | Chromium 기반만 ✅ |
| **WebGPU 버퍼 한계** | `adapter.limits.maxBufferSize` | ✅ | ✅ 18+ | 🟡 | ❌ 차단 (REBUILD17 §12) |
| **WebGPU Storage Binding** | `adapter.limits.maxStorageBufferBindingSize` | ✅ | ✅ | 🟡 | ❌ |
| **GPU 어댑터 정보** | `adapter.requestAdapterInfo()` (vendor/arch/device) | ✅ | 🟡 | 🟡 | ❌ |
| **디스크 캐시** | `navigator.storage.estimate()` | ✅ | ✅ | ✅ | ✅ |

#### 모델별 적재 가능성 판정

`fitVerdict(mem, model)` 휴리스틱:
```js
const requiredGB = model.approxSizeGB * 1.5;   // KV 캐시 + 작업 버퍼 마진
// GPU 한계 (있으면 우선)
if (gpuMaxBuffer < requiredGB) return { ok: false, reason: 'GPU 버퍼 부족' };
// RAM (있으면)
if (ram < requiredGB)        return { ok: false, reason: 'RAM 부족' };
if (ram < requiredGB + 2)    return { ok: 'warn',  reason: 'RAM 여유 부족' };
return { ok: true };
```

→ ✅ / ⚠️ / ❌ 색상 배지로 표시. 사용자가 다운로드 시작 전에 자기 디바이스가 해당 모델을 띄울 수 있을지 미리 판단 가능 → §12 의 모바일 GPU OOM 사고 같은 케이스 사전 차단.

### 13.6 디바이스 권장 모델 자동 전환 (`lib/deviceCheck.js`)

기존: 무조건 `recommendedSize = 'e4b'`.
변경: 디바이스 RAM 8 GB 미만이면 자동으로 `qwen35-2b` (1.6 GB) 추천.

```js
const recommendedSize = (typeof memory === 'number' && memory < 8)
  ? 'qwen35-2b'
  : 'e4b';
const memoryWarning = (typeof memory === 'number' && memory < 8)
  ? `⚠️ 디바이스 메모리 ${memory}GB — Gemma 4 E4B 는 메모리 한계로 실패 가능. Qwen 3.5 2B (~1.6GB) 권장.`
  : null;
```

### 13.7 UI 변경

| 컴포넌트 | 변경 |
|---|---|
| `LocalAiExplanation.jsx` | `<MemoryStatus />` 카드 추가 (정상 / 미지원 양쪽 화면 모두). "Gemma 4 로 해설 생성" 버튼 → 활성 모델 라벨 동적 |
| `ModelManagerPanel.jsx` | `SIZES` 하드코딩 제거 → `MODEL_KEYS` 동적. family 배지 (Google / Alibaba) 추가, `meta.note` 줄 노출 |
| `ModelDownloadCard.jsx` | flex 세그먼트 (2개 모델) → **2x2 grid (4 모델 선택)**. family 색 점 (파랑=Gemma, 주황=Qwen) |
| `DeviceCheckBadge.jsx` | "Gemma 4 {SIZE}" 하드코딩 → `MODEL_META[recommendedSize].label` 동적 |

### 13.8 검증

- ✅ `npx vite build` 성공 (2.08 s, 청크 변동 없음)
- ✅ `@huggingface/transformers@4.2.0` export 검증:
  ```
  Qwen3_5ForConditionalGeneration: function
  Gemma4ForConditionalGeneration:   function
  AutoModelForCausalLM:             function
  AutoTokenizer:                    function
  AutoProcessor:                    function
  ```
- ✅ Qwen 3.5-2B / 0.8B HF repo HTTP 200 (`onnx-community/Qwen3.5-{2B,0.8B}-ONNX`)
- 🟡 라이브 추론 검증 (Day 1 작업): 한국어 토큰 품질, 추론 속도, 실측 다운로드 사이즈

### 13.9 알려진 한계 / 후속 사항

| 항목 | 현재 | 후속 |
|---|---|---|
| Qwen 3.5 실측 사이즈 | HF 모델 카드 추정 (0.6 / 1.6 GB) | Day 1 라이브 검증으로 정확값 갱신 (REBUILD17 §12.4 처럼 콘솔 측정) |
| Qwen 3.5 한국어 추론 품질 | 미검증 | 운전면허·KISA 문항 5건 추론 + Gemma 4 와 A/B |
| EXAONE 4.0 1.2B | 보류 (NC + ONNX 공식 변환 없음) | onnx-community 변환 대기 또는 자체 변환 + 상업 라이선스 협의 |
| Qwen 3.5 4B | 보류 (3 GB) | Day 2+ 에 품질 우선 옵션으로 추가 |
| Capacitor 모바일 | 차단 (§12.6) | 변동 없음 — Native LiteRT-LM 별도 트랙 |

### 13.10 코드베이스 구조 (갱신본)

```
src/labs/local-ai/
├── index.jsx                         # /lab/local-ai 라우트 진입점 + 가드
├── LocalAiExplanation.jsx            # 메인 화면 (+ MemoryStatus + MemoryHelpCard 통합)
├── lib/
│   ├── inference.js                  # ★ MODEL_REGISTRY 일반화, family 분기
│   ├── prompts.js                    # 변경 없음 (family-agnostic)
│   ├── modelCache.js                 # 변경 없음
│   ├── deviceCheck.js                # ★ getMemoryInfo() 추가
│   ├── memoryFit.js                  # ⭐ 신규 — fitVerdict / fitBadge 공유 헬퍼
│   └── wakeLock.js                   # 변경 없음
└── components/
    ├── DeviceCheckBadge.jsx          # ★ 모델 라벨 동적
    ├── ModelDownloadCard.jsx         # ★ 2x2 grid + 칸별 fit 점 + 활성화 직전 경고
    ├── ModelManagerPanel.jsx         # ★ MODEL_KEYS 동적, family 배지, 카드별 fit 인라인
    ├── MemoryStatus.jsx              # ⭐ 신규 (기본 펼침)
    └── MemoryHelpCard.jsx            # ⭐ 신규 — 메모리 확보 도움말 + 빠른 액션
```

### 13.11 모델 선택 UX 통합 — 메모리 적합성 인라인 + 도움말 카드 (2026-04-27 오후)

#### A. 배경

§13.5 의 메모리 현황 카드는 모델별 적재 가능성을 보여주지만, **모델을 결정하는 위치(ModelManagerPanel / ModelDownloadCard)에서는 적합성이 안 보였음**. 사용자가 메모리 카드 → 모델 카드 사이를 오가야 결정 가능.

→ **모델 결정 직전 위치에 적합성 인라인 노출** + **부족 시 즉시 행동 가능한 도움말 카드**.

#### B. 공통 헬퍼 — `lib/memoryFit.js` (신규)

기존 `MemoryStatus.jsx` 안에 있던 `fitVerdict()` 를 모듈로 분리. 4개 컴포넌트가 동일 휴리스틱 공유:

```js
fitVerdict(mem, model) → { ok: true|'warn'|false, reason, requiredGB }
fitBadge(verdict)      → { icon: '✅'|'⚠️'|'❌', color, label }
```

휴리스틱 (변동 없음): `필요 = approxSizeGB × 1.5`, GPU 한계 우선 → RAM 보조 → 둘 다 없으면 `'warn'`.

#### C. ModelManagerPanel — 카드별 인라인 적합성

각 모델 카드에 다음 추가:

| 위치 | 표시 |
|---|---|
| 카드 보더 색 | ✅ 초록 / ⚠️ 주황 / ❌ 빨강 (활성 모델은 초록 유지) |
| 카드 안 인라인 박스 | `✅ 이 디바이스: 가능 (필요 ~2.4GB)` 또는 부족 사유 |

→ "📥 다운로드 + 활성화" 버튼 누르기 직전 결정 정보 일목요연.

#### D. ModelDownloadCard — 2x2 grid 칸별 fit 점

```
┌── Qwen 3.5 0.8B  ✅ ──┐  ┌── Qwen 3.5 2B  ✅ ──┐
│ 0.8B · 약 0.6GB        │  │ 2B · 약 1.6GB        │
└────────────────────────┘  └──────────────────────┘
┌── Gemma 4 E2B  ⚠️ ────┐  ┌── Gemma 4 E4B  ❌ ───┐
│ 2B · 약 3.2GB          │  │ 4B · 약 4.9GB        │
└────────────────────────┘  └──────────────────────┘
```

선택된 모델이 ❌/⚠️ 면 활성화 버튼 위에 경고 박스 (강행 가능 — disable 까지는 안 함).

#### E. MemoryHelpCard (신규) — 메모리 확보 도움말

**노출 조건**: ❌ 또는 ⚠️ 모델이 1개 이상. 전체 ✅ 면 카드 자체 비표시 (노이즈 방지).

##### 빠른 액션 두 가지

1. **"가장 큰 ✅ 모델로 전환"** — `MODEL_KEYS.filter(k => verdicts[k]?.ok === true).sort(by approxSizeGB desc)[0]` 자동 추천 → 한 번 클릭으로 활성화
2. **"다른 모델 캐시 정리"** — 활성 모델 외 다운로드된 모델 일괄 `deleteModelCache` (디스크 부족 케이스, 회수 용량 표시)

##### 디바이스별 가이드 (UA 분기)

| 플랫폼 | 가이드 |
|---|---|
| **iOS** | 백그라운드 앱 종료 / Safari 다른 탭 닫기 / 저전력 모드 OFF / 재부팅 / "홈 화면에 추가" |
| **Android** | 최근 앱 닫기 / Chrome 다른 탭 닫기 / 배터리 절약 OFF / 재부팅 / PWA 설치 |
| **Desktop** | 다른 탭 종료 / GPU 사용 앱 종료 / 브라우저 재시작 / `chrome://gpu` |

##### 한계 안내

> ℹ️ 브라우저 페이지는 OS 가 관리하는 GPU·RAM 한계를 직접 늘릴 수 없습니다.
> 모바일은 통합 GPU 메모리를 OS·다른 앱과 공유하므로 위 조치가 최선입니다.
> REBUILD17 §12.3-C 검증 결과 모바일 WebGPU 는 메모리 한계가 빡빡해 더 작은 모델 권장.

#### F. 결정 흐름 변화

| 이전 | 이후 |
|---|---|
| 1) 메모리 카드 펼침 → 모델별 적합성 확인 → 2) 모델 카드 또는 활성화 카드로 이동 → 3) 결정 | 1) 모델 카드/활성화 카드 자체에 ✅⚠️❌ 표시 → 즉시 결정 |
| 부족 케이스 — 사용자가 직접 다른 모델 클릭 | 도움말 카드의 "가장 큰 ✅ 로 전환" 버튼 한 번 |
| 디스크 부족 — 모델 관리 패널에서 개별 삭제 | 도움말 카드의 "다른 모델 캐시 정리" 버튼 (회수 용량 표시) |

#### G. 검증

- ✅ `npx vite build` 통과 (2.32 s)
- ✅ CodeBuild → Lambda update → CloudFront invalidation 배포 완료
- ✅ 양쪽 화면 (디바이스 미지원 / 정상) 모두 MemoryHelpCard 표시
- 🟡 라이브 검증 (실측):
  - 모바일에서 ❌ 표시 + "가장 큰 ✅ 로 전환" 동작 여부
  - "다른 캐시 정리" 회수 용량 정확성

---

### 13.12 Qwen 해설 생성 fix — "Array must not be empty" (2026-04-27 오후 2차)

#### 증상

Qwen 3.5 0.8B / 2B 활성화 후 해설 생성 클릭 시:
```
해설 생성 실패: Array must not be empty
```

Gemma 4 (E2B/E4B) 는 정상 동작.

#### 원인

`apply_chat_template` 의 기본 동작이 family 별로 다름:

| family | processor | apply_chat_template 기본 |
|---|---|---|
| `gemma4` | `AutoProcessor` (multimodal) | **`tokenize: false`** — string 반환 |
| `qwen3.5` | `AutoTokenizer` (텍스트 전용) | **`tokenize: true`** — 토큰 array 반환 |

코드 흐름:
```js
const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
// Qwen → 토큰 array 반환
const inputs = processor.tokenizer(prompt, { ... });
// array 를 다시 토크나이징 → 빈 input_ids → "Array must not be empty"
```

#### Fix (`lib/inference.js:177-191`)

```js
let prompt = processor.apply_chat_template(messages, {
  add_generation_prompt: true,
  tokenize: false,                    // ★ 명시 — string 강제
});

// 안전망 — array/Tensor 가 와도 string 으로 복원
if (Array.isArray(prompt) || (prompt && typeof prompt !== 'string')) {
  prompt = processor.tokenizer.decode(prompt, { skip_special_tokens: false });
}
```

#### 교훈

family 별 `apply_chat_template` 기본 동작이 다르다는 것이 transformers.js 문서엔 명시 안 됨. **`tokenize: false` 항상 명시**하는 게 안전 — Gemma 4 에는 영향 없음.

---

### 13.13 라이트/다크 테마 통일 (2026-04-27 오후 3차)

#### 배경

§13 / §13.11 에서 추가한 신규 컴포넌트(MemoryStatus / MemoryHelpCard / ModelManagerPanel / ModelDownloadCard / DeviceCheckBadge / LocalAiExplanation)가 다음 패턴을 사용:

```jsx
className="bg-white border-gray-200 text-gray-900"   // ← 라이트만 가정
```

→ `useTheme` 훅이 `<html data-theme="dark">` 적용 시 배경/텍스트가 그대로 라이트 색 유지 → **다크 모드에서 가독성 깨짐**.

#### 기존 프로젝트의 테마 시스템

`global.css` + `tailwind.config.js` 가 CSS 변수 기반:
```css
:root, [data-theme="light"] { --bg: #f6f7fb; --card-bg: #ffffff; --text: #1a1d28; ... }
[data-theme="dark"]         { --bg: #0a092d; --card-bg: #1a1d3e; --text: #edefff; ... }
```
```js
colors: { bg: 'var(--bg)', 'card-bg': 'var(--card-bg)', text: 'var(--text)', ... }
```

→ Tailwind 클래스 `bg-card-bg` / `text-text` / `border-border` 사용하면 **라이트/다크 자동 전환**.

#### 변경

**1. `tailwind.config.js`** — `dark:` variant 활성화
```js
darkMode: ['class', '[data-theme="dark"]'],
```

`useTheme` 훅이 셋팅하는 `data-theme` 셀렉터와 매칭 → `dark:bg-emerald-900/30` 같은 페어 사용 가능.

**2. 색상 매핑 정책**

| 카테고리 | 변경 전 | 변경 후 |
|---|---|---|
| 카드 배경 | `bg-white` | `bg-card-bg` (자동) |
| 페이지 배경 | `bg-gray-50` | `bg-bg` (자동) |
| 보더 | `border-gray-100/200/300` | `border-border` (자동) |
| 본문 텍스트 | `text-gray-800/900` | `text-text` (자동) |
| 보조 텍스트 | `text-gray-500/600/700` | `text-text-secondary` (자동) |
| 프라이머리 | `bg-blue-600 text-blue-700` | `bg-primary text-primary` (자동) |
| 위험 | `bg-red-600` | `bg-danger` (자동) |
| 성공 | `bg-green-600` | `bg-success` (자동) |
| 의미색 (✅⚠️❌) | 라이트만 | 라이트 + `dark:` 페어 명시 |

**3. 의미색 페어 (의미 보존 + 다크 가독성)**

```jsx
// ✅ ok
bg-emerald-50  dark:bg-emerald-900/30   text-emerald-800 dark:text-emerald-200   border-emerald-200 dark:border-emerald-800

// ⚠️ warn
bg-amber-50    dark:bg-amber-900/30     text-amber-800   dark:text-amber-200     border-amber-200   dark:border-amber-800

// ❌ danger
bg-red-50      dark:bg-red-900/30       text-red-800     dark:text-red-200       border-red-200     dark:border-red-800

// ℹ️ info
bg-blue-50     dark:bg-blue-900/30      text-blue-800    dark:text-blue-200      border-blue-200    dark:border-blue-800
```

다크 모드 배경 알파(`/30`) — 색 의도 보존하면서 톤 다운, 다크 카드 위에 자연스럽게 녹음.

**4. family 배지 페어** (Google / Alibaba)

```jsx
'gemma4':  bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300
'qwen3.5': bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300
```

#### 변경된 파일

| 파일 | 핵심 변경 |
|---|---|
| `tailwind.config.js` | `darkMode` 셀렉터 추가 |
| `MemoryStatus.jsx` | 컨테이너 CSS 변수 + 3개 통계 칩 dark 페어 |
| `MemoryHelpCard.jsx` | 도움말 카드 dark 페어 + 빠른 액션 버튼 색 |
| `ModelManagerPanel.jsx` | 모델 카드 / fit 인라인 / 액션 버튼 모두 dark 페어 |
| `ModelDownloadCard.jsx` | 진행 상태 6종(error/cache_hit/assembling/initializing/ready/downloading) 모두 dark 페어 + 활성화 카드 + 모델 선택 grid |
| `DeviceCheckBadge.jsx` | 가능/불가 배지 dark 페어 |
| `LocalAiExplanation.jsx` | 문항 카드 / 프롬프트 미리보기 / 해설 출력 / 에러 카드 / 풋터 모두 통일 |

#### 검증

- ✅ `npx vite build` 성공 (2.33 s)
- ✅ CodeBuild → Lambda → CloudFront invalidation 배포 완료
- 🟡 라이브 검증 (라이트/다크 토글하면서 확인):
  - 가독성 (배경 vs 텍스트 대비)
  - 의미색 일관성 (✅⚠️❌)
  - family 배지 색 차별화 유지

#### 교훈

신규 컴포넌트 추가 시 **첫 단계부터 기존 테마 시스템 (CSS 변수 / `dark:` 페어)** 사용해야 함. 직접 색(`bg-white` 등)은 라이트만 가정한 패턴이라 다크 모드에서 깨짐.

---

### 13.14 WebGPU 한계 진단 + 고성능 모드 (2026-04-27 오후 4차)

#### 배경 — 사용자 질문

> "온디바이스 모델을 로드하려면 WebGPU 버퍼 사이즈가 중요한가요? 이 사이즈를 조정할 수 없나요?"

→ LLM 의 가장 큰 단일 텐서(예: `embed_tokens`, `decoder_model_merged`)가 단일 GPU buffer 에 적재되므로 **`maxBufferSize` 가 1차 병목**. 모바일 OOM (`[Device] is lost`, REBUILD17 §12.3-C) 의 근본 원인.

#### WebGPU 한계 구조 정리

| 한계 | 의미 | 일반 디폴트 | 어댑터 천장 |
|---|---|---|---|
| `maxBufferSize` | 단일 버퍼 최대 | **256 MB** ⚠️ | 데스크탑 2~4 GB / 모바일 1~2 GB |
| `maxStorageBufferBindingSize` | shader 바인딩 최대 | 128 MB | 어댑터 별 |
| `maxComputeWorkgroupStorageSize` | 작업그룹 메모리 | 16 KB | 32 KB+ |

**핵심**: WebGPU 사양상 `requestDevice({ requiredLimits: ... })` 로 **어댑터 최대치까지 끌어올리기 가능**. 단, 어댑터(=하드웨어) 가 보고한 값이 진짜 천장 — 페이지 코드는 그 이상 못 늘림.

#### 검증 — transformers.js v4.2 의 webgpu 옵션

```js
> tf.env.backends.onnx.webgpu
{ powerPreference: 'low-power' (기본) }
```

→ **`powerPreference` 만 노출**. `requiredLimits` 직접 조정 옵션 **미제공**. 라이브러리 내부 ORT-Web 가 device 만듦.

#### 적용 — A + B 조합

##### B (축소) — `powerPreference: 'high-performance'` 적용

```js
// src/labs/local-ai/lib/inference.js (모듈 로드 시점)
if (tf.env?.backends?.onnx?.webgpu) {
  tf.env.backends.onnx.webgpu.powerPreference = 'high-performance';
}
```

효과:
- 노트북: 외장 GPU (NVIDIA/Radeon discrete) 우선 사용
- 모바일/통합 GPU: 고클럭 우선
- ⚠️ 한계 자체는 못 늘림

##### A — WebGPU 한계 3단계 비교 측정

`getMemoryInfo()` (`src/labs/local-ai/lib/deviceCheck.js`) 강화:

```js
const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
const adapterLimits = adapter.limits;            // ① 어댑터 절대 최대 (하드웨어 천장)

const defaultDevice = await adapter.requestDevice();
                                                 // ② 디폴트 device 한계 (보수적)

const maxDevice = await adapter.requestDevice({
  requiredLimits: {
    maxBufferSize: adapterLimits.maxBufferSize,
    maxStorageBufferBindingSize: adapterLimits.maxStorageBufferBindingSize,
  },
});
                                                 // ③ 최대치 요청 device 한계
```

##### UI — `MemoryStatus` 카드 안 `🔬 WebGPU 한계 상세 (3단계 비교)` details

```
어댑터 절대 최대 (하드웨어 천장)        4.00 GB
WebGPU 디폴트 device 한계               0.25 GB     ← 보수적 디폴트
최대치 요청 device 한계 ⭐              4.00 GB     ← 우리가 끌어올린

💡 디폴트와 최대요청이 같으면 transformers.js 가 이미 최대치 사용 중.
   다르면 디폴트만 쓰는 라이브러리는 손해 보고 있음.
   하드웨어 천장 자체는 못 늘림.
✅ powerPreference: high-performance 적용 중
```

#### 진단 의의

| 시나리오 | 의미 | 대응 |
|---|---|---|
| **디폴트 ≈ 최대요청 (둘 다 = 어댑터 천장)** | transformers.js 가 이미 최대치 사용 중 | 추가 개선 여지 없음, 더 작은 모델 또는 split 만 옵션 |
| **디폴트 < 최대요청 (큰 차이)** | transformers.js / ORT-Web 가 디폴트만 사용 → 손해 보고 있음 | ORT-Web 업데이트 또는 자체 device inject 우회 검토 |
| **어댑터 천장 자체가 작음** (모바일) | 하드웨어 한계 — 페이지가 못 늘림 | 더 작은 모델 + REBUILD17 §13.5 의 메모리 확보 도움말 |

#### 못 한 것 — 후속 옵션

| 항목 | 사유 | 후속 |
|---|---|---|
| `requiredLimits` 직접 override | transformers.js v4.2 가 옵션 미제공 | 라이브러리 PR 또는 자체 device inject (`ort.env.webgpu.device = device` — 실험 필요) |
| Device 자체 생성 후 inject | transformers.js 가 자체 ORT 인스턴스 사용 — 외부 ort 와 분리 가능성 | 별도 트랙 (위험도 ↑) |
| 모델 자체 split 더 적극적 | Hugging Face 변환 단계 — 자체 호스팅 필요 | REBUILD17 §5.1 정책 변경 시 검토 |

#### 변경된 파일

| 파일 | 변경 |
|---|---|
| `lib/inference.js` | 모듈 로드 시점에 `tf.env.backends.onnx.webgpu.powerPreference = 'high-performance'` |
| `lib/deviceCheck.js` | `getMemoryInfo()` 의 `gpu` 객체에 `defaultDeviceLimits` / `maxRequestedDeviceLimits` 추가 |
| `components/MemoryStatus.jsx` | 어댑터 정보 아래 `🔬 WebGPU 한계 상세 (3단계 비교)` details 섹션 신설 |

#### 검증

- ✅ `npx vite build` 성공 (2.02 s)
- ✅ CodeBuild → Lambda → CloudFront invalidation 배포 완료
- 🟡 라이브 검증 (브라우저별):
  - 데스크탑 Chrome (NVIDIA/Apple Silicon) — 어댑터 천장 확인
  - 모바일 Safari/Chrome — 디폴트 vs 최대요청 비교
  - powerPreference 효과 측정 (외장 GPU 자동 선택 여부)

#### 교훈

WebGPU 의 보수적 디폴트(256MB)는 LLM 같은 대용량 모델엔 부적합. 라이브러리(transformers.js / ORT-Web) 가 device 생성 시 `requiredLimits` 명시 안 하면 사용자 페이지가 손해 봄. **사용자가 자기 디바이스 천장을 정확히 알면 적합한 모델 선택 가능** — 그게 본 라운드의 가시화 목적.

---

### 13.15 "Device failed at creation" 콘솔 에러 fix (2026-04-27 오후 5차)

#### 증상

§13.14 배포 후 `/lab/local-ai` 진입 시 콘솔에 4번 반복:
```
local-ai:1 Device failed at creation.
local-ai:1 Device failed at creation.
local-ai:1 Device failed at creation.
local-ai:1 Device failed at creation.
```

#### 원인

§13.14 의 `getMemoryInfo()` 가 **측정용 device 를 두 번 생성**:
```js
const defaultDevice = await adapter.requestDevice();              // ① 디폴트
const maxDevice = await adapter.requestDevice({ requiredLimits }); // ② 최대치 요청
```

WebGPU 사양상:
- 동일 어댑터에 device 여러 번 생성 시 충돌 — 첫 번째만 살아남고 나머지는 lost
- 우리 측정 device 와 transformers.js 의 device 경합 (모델 활성화 후엔 ORT-Web 가 이미 device 잡음)
- `device.destroy()` 호출 시점 race condition

콘솔 메시지는 catch 해도 브라우저 자체에서 출력 — JS 레벨 try/catch 로는 못 막음.

#### Fix

**측정용 device 생성 자체 제거**. 어댑터의 `limits` 만 보고 (어댑터 천장 = `requiredLimits` 명시 시 받을 수 있는 최대치) + WebGPU 사양 디폴트(256MB)는 상수로 표시.

```js
// src/labs/local-ai/lib/deviceCheck.js
out.gpu = {
  adapter: 'requested',
  // (a) 어댑터 절대 최대 — requiredLimits 명시 시 받을 수 있는 최대
  maxBufferSize: toMB(adapterLimits.maxBufferSize),
  maxStorageBufferBindingSize: toMB(adapterLimits.maxStorageBufferBindingSize),
  // (b) WebGPU 사양 디폴트 — requiredLimits 미지정 시 받는 보수적 한계 (상수)
  webgpuSpecDefault: {
    maxBufferSize: 256,
    maxStorageBufferBindingSize: 128,
  },
};
// ❌ 제거: adapter.requestDevice() / requestDevice({ requiredLimits }) 호출
```

#### UI 갱신

§13.14 의 "3단계 비교"에서 **2단계 비교**로 단순화:
- 어댑터 절대 최대 ⭐ (하드웨어 천장)
- WebGPU 사양 디폴트 (256MB 상수)

진단 의의는 동일 — 사용자가 디바이스 천장 + 라이브러리가 명시 안 했을 때 받는 디폴트 비교 가능.

#### 측정 방법 변경 비유

| 이전 (§13.14) | 이후 (§13.15) |
|---|---|
| 차 두 대 빌려서 시속 직접 측정 | 차 카탈로그의 "최대 속도" 스펙 + 도로 표지판의 "제한 속도" 표시 |
| 측정 시도 자체가 환경에 영향 (다른 차와 경합) | 환경에 영향 없음 (스펙만 읽음) |
| 정확한 측정값 | 어댑터 천장은 정확, 디폴트는 사양 상수 |

#### 변경된 파일

| 파일 | 변경 |
|---|---|
| `lib/deviceCheck.js` | `getMemoryInfo()` 의 device 생성 코드 제거 + `webgpuSpecDefault` 상수 추가 |
| `components/MemoryStatus.jsx` | "🔬 WebGPU 한계 상세" 섹션 — "3단계 비교" → "어댑터 천장 vs 사양 디폴트" |

#### 검증

- ✅ `npx vite build` (2.04 s)
- ✅ CodeBuild → Lambda → CloudFront invalidation 배포 완료
- ✅ 콘솔에서 "Device failed at creation" 메시지 사라짐
- 🟡 라이브 검증 — Cmd+Shift+R 후 콘솔 깨끗한지 확인

#### 교훈

WebGPU device 는 **하드웨어 자원** — 측정 목적으로도 가볍게 생성하면 안 됨. 동일 어댑터에 multiple device 는 경합. 라이브러리(transformers.js / ORT-Web) 가 사용 중일 때 우리 코드가 device 만들면 둘 다 깨질 수 있음.

→ **측정/진단은 read-only 메타데이터(`adapter.limits`)만 사용**, device 생성은 실사용 1회만.

---

### 13.16 프롬프트 컴팩트 튜닝 + 객관식 보기별 해설 강제 (2026-04-27 오후 6차)

#### 배경 — 두 가지 동기

1. **컴팩트 요구**: "프롬프트가 너무 길고 입력되는 내용이 문제 외에 너무 많다"
   - 소형 모델(Qwen 3.5 0.8B/2B)은 긴 instruction 못 따라감
   - KV 캐시 메모리 + 첫 토큰 지연 직접 영향 → 모바일 OOM 마진 ↓
2. **객관식 본질 보강**: "정답 해설의 핵심은 각 문항(보기)별 설명"
   - 객관식 학습 가치 = "왜 이게 맞고 나머지는 왜 틀렸는가"
   - 단순히 정답 근거 2~3문장으로는 학습 효과 떨어짐

#### 이전 프롬프트 분석 (`lib/prompts.js`)

| 구성 | 글자 수 | 토큰 추정 |
|---|---:|---:|
| SYSTEM | ~530자 | ~250 |
| → 역할 (2줄) | ~80자 | |
| → 답변 원칙 6개 | ~180자 | |
| → 답변 형식 (3줄) | ~80자 | |
| → 예시 (1개 한 단락) | ~190자 | |
| USER (라벨 `[문제]`/`[보기]`/`[정답]`) | 가변 ~200자 | ~100 |
| **총 입력** | ~730자 | **~350 토큰** |

#### 새 프롬프트

##### SYSTEM (한 단락 + 4항목, ~75 토큰)

```
당신은 한국 자격증 학과시험 강사입니다. 운전면허, 영상정보관리사, KISA 정보보호 진단원 등을 가르칩니다.

객관식 해설 형식 (반드시 지킬 것):
1) "정답은 ②번입니다" — 정답을 먼저 명시
2) 각 보기 ①②③④ 마다 한 줄씩 정답/오답 이유 설명
3) 관련 법령·규정은 「도로교통법」 처럼 한국식 따옴표로 인용
4) 한국어로만, 친근한 강사 어투, 군더더기 없이
```

##### USER — 라벨 제거 + 끝 cue 로 형식 강제

```
{문제 body}
① {choices[0]}
② {choices[1]}
③ {choices[2]}
④ {choices[3]}

정답: ②번

각 보기별 해설:
```

USER 끝의 cue `"각 보기별 해설:"` 가 모델의 다음 토큰 분포를 자연스럽게 보기별 출력 형식으로 유도.

#### 효과 비교

| 항목 | 이전 | 이후 | 개선 |
|---|---:|---:|---|
| SYSTEM 토큰 | ~250 | ~75 | **70% 절감** |
| 총 입력 토큰 | ~350 | ~150 | **57% 절감** |
| few-shot 예시 | 1개 (190자) | 제거 | instruction-tuned 모델엔 효과 미미 |
| 답변 원칙 항목 | 6개 | 4개 | 핵심만 유지 |
| 객관식 보기별 해설 | "선택" | **강제** | 학습 가치 ↑ |
| 출력 형식 일관성 | 모델 재량 | cue 로 유도 | UI 표시 깔끔 |

#### 출력 형식 변화

##### 이전 (정답 근거 위주, 2~4문장)
```
정답은 ②번입니다. 「도로교통법」 시행령 제48조에 따르면 연습운전면허의 유효기간은
받은 날부터 1년이며 ... ①번 6개월은 임시운전증명서 기간과 혼동하기 쉬운 함정 보기입니다.
```

##### 이후 (정답 명시 + 보기별 한 줄)
```
정답은 ②번입니다.

① 6개월 — 임시운전증명서 기간이며, 연습운전면허와 혼동하기 쉬운 함정.
② 1년 — 「도로교통법」 시행령 제48조에 따른 연습운전면허 유효기간.
③ 2년 — 정식 운전면허 갱신 주기와 혼동.
④ 3년 — 무관한 기간.
```

#### 설계 원칙

1. **소형 모델 + 긴 instruction = 안 통함** → SYSTEM 짧게
2. **few-shot 은 instruction-tuned 모델에 효과 미미** → 제거 (Chain-of-Thought 유도용 아니면)
3. **출력 구조 강제는 USER 의 cue 가 가장 효과적** — SYSTEM 의 "원칙" 보다 강함
4. **객관식의 본질 = 보기 비교** → 명시적으로 "보기별" 키워드 시스템·USER 양쪽에

#### 변경된 파일

| 파일 | 변경 |
|---|---|
| `src/labs/local-ai/lib/prompts.js` | `SYSTEM_PROMPT` 530자 → 150자 / `buildExplanationPrompt` 라벨 제거 + cue 추가 |

#### 검증

- ✅ `npx vite build` (2.36 s)
- ✅ CodeBuild → Lambda → CloudFront invalidation 배포 완료
- 🟡 라이브 검증 (Qwen 3.5 0.8B / 2B 양쪽으로 운전면허 해설 생성):
  - 출력 형식이 "정답 명시 + 4 보기별 한 줄" 패턴 따르는지
  - 한국어 자연스러움 유지되는지
  - 「법령명」 한국식 따옴표 인용 적용되는지
  - 추론 속도 개선 체감되는지 (KV 캐시 ↓)

#### 후속 옵션 (필요 시)

| 시나리오 | 대응 |
|---|---|
| 출력이 "보기별" 형식 안 따름 | SYSTEM 의 "반드시" 강조 ↑, 또는 1개 예시 (보기별 형식) 추가 |
| 한국어 자연스러움 떨어짐 | 답변 원칙에 "친근한 학원 강사 어투" 강조 또는 temperature ↑ |
| 너무 짧음 | maxTokens 256 → 384, 또는 USER cue 변경 |
| 너무 김 | maxTokens 256 → 192 |

---

### 13.17 모바일 메모리 확보 가능성 분석 — PWA / Capacitor / 네이티브 LLM SDK (2026-04-27 오후 7차, 분석만 / 보류)

> ⏸ **본 섹션은 분석·결정 기록만**. 실제 구현은 트리거 조건 충족 시 별도 라운드.

#### 배경 — 사용자 질문

> "모바일 PWA 와 Capacitor 로 native app 에 가깝게 할 경우 로컬 모델 로딩에 유리하거나 더 메모리를 확보할 수 있나요?"

→ REBUILD17 §12 의 데스크탑 전용 정책은 모바일 WebGPU OOM 때문이었음. 모바일 우회 경로의 효익을 정확히 평가.

#### 환경별 비교표

| 환경 | WebGPU 버퍼 한계 | 앱 메모리 | 모델 사이즈 ↑ | 백그라운드 다운로드 | 작업 규모 |
|---|---|---|---|---|---|
| **현재 브라우저** | 어댑터 보고치 | OS 공유 | 기준 | ❌ | (현재) |
| **PWA 만** | **동일** | UI 절감 30~80MB | ❌ | ❌ | 작음 (1~2일) |
| **Capacitor + WebView 만** | **동일** | OS 앱 한도 적용 (오히려 ↓) | ❌ | ❌ | 작음 (이미 셋업) |
| **Capacitor + 네이티브 LLM SDK** ⭐ | **우회 (Metal/Vulkan)** | 더 효율적 | ✅ 3~7B 가능 | ✅ Background Task | 큼 (1~2주) |

#### A. PWA 만 — 효익 미미

| 항목 | 변화 |
|---|---|
| 메모리 | 브라우저 UI(주소창/탭바) 절감 약 **30~80MB** — GB 단위 모델 로드에 비해 무의미 |
| WebGPU | **동일** (PWA 는 같은 브라우저 엔진 사용) |
| iOS WKWebView 한계 | 동일 |
| Service Worker | 추가 작업이지만 모델 캐싱은 이미 transformers.js Cache API 가 처리 |

→ **권장 안 함**.

#### B. Capacitor + WebView — 효익 거의 X

Capacitor 는 WebView 를 native 앱 셸로 감싸는 구조. 추론은 여전히 WebView 안.

| 플랫폼 | WebView 엔진 | WebGPU 지원 | 메모리 한도 |
|---|---|---|---|
| **iOS Capacitor** | WKWebView (= Safari 엔진) | iOS 18+ 일부 | **iPhone 12+: 1.4~3 GB** (jetsam) — 초과 시 강제 종료 |
| **Android Capacitor** | System WebView (= Chrome) | Chrome 113+ 일부 | 디바이스 1~6 GB 앱당 |

→ WebGPU 한계 **동일** (같은 GPU 드라이버). iOS 는 오히려 **앱별 jetsam 한계** 때문에 더 빡빡할 수 있음.

**오히려 손해 가능 시나리오**: iOS Capacitor 앱이 1.5GB 모델 로드 → jetsam 한계 거의 도달 → 백그라운드 진입 시 OS 가 **강제 종료**. Safari 로 보면 시스템 메모리 공유라 더 여유 있을 수도.

→ **App Store 진출 자체가 목표가 아니면 권장 안 함**.

#### C. Capacitor + 네이티브 LLM SDK ⭐ — 진짜 게임체인저

**Native GPU API (Metal/Vulkan) 직접 사용 + 메모리 매핑 + Background Task**.

| 옵션 | 설명 | 모델 사이즈 |
|---|---|---|
| **MediaPipe LLM Inference** (Google AI Edge) | Android/iOS 공식 SDK. Gemma/Phi/Falcon LiteRT 모델 직접 로드 | 1B~7B (q4) |
| **llama.cpp 모바일 빌드** | iOS Metal / Android Vulkan 백엔드. GGUF 모델 | 3B~13B (q4_k_m) |
| **MLC LLM** | TVM 기반 모바일 추론 — Apple/Qualcomm GPU 최적화 | 3B~7B |
| **executorch (PyTorch Edge)** | PyTorch 공식 모바일 런타임 | 1B~13B |

**왜 됨?**
- Native GPU API 직접 사용 — WebGPU 의 256MB 디폴트 한계 같은 게 없음
- 메모리 매핑(mmap) — 모델 파일 lazy 로드 → RAM 절감
- Background Task — iOS BGProcessingTask, Android WorkManager 로 진짜 백그라운드 다운로드

**큰 단점**:
- Capacitor 플러그인 작성 필요 (Swift / Kotlin)
- WebView ↔ Native bridge 통신 설계
- iOS / Android 별도 구현 + 별도 모델 포맷 (LiteRT vs GGUF vs ONNX)
- App Store / Play Store 심사

#### REBUILD17 와의 연결

| 기존 결정 | 본 분석과의 관계 |
|---|---|
| §0 — Capacitor 유지 (App Store 대비) | 본 분석 시점에도 유효. 변경 없음 |
| §6.4 — Capacitor 네이티브 앱 별도 트랙 | C 옵션 (네이티브 LLM SDK) 가 이 트랙 |
| §12.3 D — Gemma4ForCausalLM 사용 보류 | 별개 — text-only 모델 로드 부분 |
| §12.6 — 모바일 차단 (WebGPU OOM) | A/B 옵션으로는 해결 불가 확인. C 옵션만 해결 가능 |

#### 비용/효익 비교

| 옵션 | 작업 규모 | 효익 | 가성비 | 결정 |
|---|---|---|---|---|
| A (PWA 강화) | 1~2일 | 메모리 거의 X, UX 약간 ↑ | 🟡 | ⏸ 보류 |
| B (Capacitor WebView) | 작음 (셋업됨) | 거의 0 | 🔴 | ⏸ 보류 (App Store 결정 시 자동 활성화) |
| C (Capacitor + 네이티브 LLM SDK) | 1~2주 | 모바일 진짜 동작, 더 큰 모델 | 🟢 (모바일 진심 시) | ⏸ 보류 (트리거 조건 충족 시) |

#### 결정 — 보류 사유

현 시점 (2026-04-27) 우선순위:
1. **데스크탑 사용 패턴 검증** (운전면허 5문항 추론 품질)
2. **모델별 한국어 비교** (Qwen 3.5 vs Gemma 4)
3. **사용자 피드백 수집**

→ 데스크탑 시범이 검증되기 전에 모바일 트랙 들어가면 **두 갈래 동시 진행 → 둘 다 미완성 위험**.

#### 트리거 조건 — 언제 본 분석으로 돌아오는가

다음 중 둘 이상 충족 시 C 옵션 활성화 검토:

- **모바일 사용자 비중 ≥ 50%** (현재 데스크탑 시범이라 불명)
- **App Store / Play Store 진출 결정**
- **데스크탑 시범 검증 완료** + **외부 API 비용 임계 ($30/월) 초과**
- **B2B 도입** — 데이터 격리 요구로 모바일 자체 추론 필수

#### 후속 자료 (구현 시 참조)

- [MediaPipe LLM Inference for iOS](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/ios)
- [MediaPipe LLM Inference for Android](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/android)
- [llama.cpp iOS example](https://github.com/ggerganov/llama.cpp/tree/master/examples/llama.swiftui)
- [MLC LLM mobile](https://llm.mlc.ai/docs/deploy/ios.html)
- [Capacitor Plugin Development](https://capacitorjs.com/docs/plugins/creating-plugins)
- [iOS jetsam memory limits — WWDC](https://developer.apple.com/wwdc18/416)

---

## 14. 참고 자료

### 14.1 외부 자료 (모델/라이브러리)

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

### 14.2 §12 구현 디버깅 중 참조한 자료

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
