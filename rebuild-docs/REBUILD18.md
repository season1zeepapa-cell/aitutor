# REBUILD18 — 로컬 모델의 정답 해설 통합 방안 (UI/UX + 출시 계획)

작성일: 2026-04-27
범위: workspace/aitutor — `/lab/local-ai` 시범 (REBUILD17) 의 검증 결과를 정답 해설 본 기능에 통합
선행 문서: REBUILD16 (LLM 호출 통일 §8.4 / 비용 추적 §8.8 / 사용량 UI §8.9), REBUILD17 (Gemma 4 + Qwen 3.5 시범 + 메모리 적합성 + 보기별 해설 프롬프트)

---

## 0. TL;DR

REBUILD17 의 격리 시범(`/lab/local-ai`) 에서 검증된 4개 모델(Gemma 4 E2B/E4B + Qwen 3.5 0.8B/2B)을 **본 기능의 AI 해설(`/api/{gemini|openai|claude}` 흐름)** 에 4번째 프로바이더로 통합.

### 본 라운드 결정 (✅ 2026-04-27 사용자 승인)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 통합 방식 | ✅ **`PROVIDERS` 상수에 'local' 4번째 추가 (대칭형)** |
| 2 | 활성화 흐름 | ✅ **명시적 ON/OFF** (자동 활성화 X — 다운로드 부담) |
| 3 | DB 저장 | ✅ **외부 모델과 동일 — `question_explanations` 에 `provider='local-{model}'` 로 저장** |
| 4 | 사용량 기록 | ✅ **`llm_usage_log` 에 `provider='local-{model}', estimated_cost=0` 기록** |
| 5 | 모델 로드 안 된 경우 UX | ✅ **"디바이스" 버튼 클릭 시 활성화 카드 inline 즉시 표시** |
| 6 | 다운로드 락 흐름 | ✅ **REBUILD17 §13.X 의 락 그대로 적용 — 본 화면에서도 동일 보호** |
| **7** | **메모리 단일 모델 정책** | ✅ **한 번에 1개 모델만 메모리 적재 (이미 inference.js 싱글톤 패턴)** |
| **8** | **`/lab/local-ai` 시범 페이지** | ✅ **유지 (관리자 전용 디버깅·모델 비교·메모리 진단 풀 버전)** |

### 단계적 출시

```
Phase 1 [본 라운드]: 외부 3 + 로컬 1 (대칭 PROVIDERS)
Phase 2 [후속]:    "로컬 우선 + 외부 폴백" 자동 모드 (사용자 토글)
Phase 3 [장래]:    캐시 워밍업 (자주 푸는 카테고리 사전 다운로드)
```

---

## 1. 배경

### 1.1 시범 → 실제 활용으로의 전환

REBUILD17 으로 `/lab/local-ai` 격리 모듈 완성:
- 4개 모델 (Gemma 4 E2B/E4B + Qwen 3.5 0.8B/2B) 다운로드 + WebGPU 추론
- 메모리 적합성 자동 판정 + 다운로드 락 + 컴팩트 프롬프트 + 보기별 해설

다음 단계 = **"실제 사용자가 평소에 풀던 문항 해설에 로컬 모델 선택지 제공"**.

### 1.2 통합의 의미

| 항목 | 효과 |
|---|---|
| **외부 API 비용 절감** | 로컬 모델 호출은 0원 (REBUILD16 §8.8 의 `llm_usage_log` 추적과 함께) |
| **데이터 격리** | 사용자 학습 데이터 + 문항 본문이 외부 API 안 거침 (보안 민감 사용자) |
| **외부 API 장애 무관** | 키 만료(REBUILD16 §11.6) 또는 quota 초과 시도 동작 |
| **검증 통로** | 시범 단계와 실제 사용 모두에서 모델 품질 비교 데이터 축적 |

---

## 2. 현재 AI 해설 기능 분석

### 2.1 사용자 흐름 (현재)

```
사용자: 카드 학습 (QuizTab) → 정답 확인 → AiSubPanels 의 "AI 해설" 탭 클릭
            ↓
src/tabs/QuizTab/AiExplanation.jsx
  - 3개 프로바이더 버튼: Gemini / OpenAI / Claude
  - 사용자가 버튼 클릭 → generateExplanation(provider)
            ↓
src/hooks/useSSE.js
  - ENDPOINTS = { gemini: '/api/gemini', openai: '/api/openai', claude: '/api/claude' }
  - SSE 스트리밍 (실패 시 일반 모드 폴백)
            ↓
api/{gemini|openai|claude}.js  (SSE 응답)
  - api/_llm/{gemini|openai-chat|anthropic}.js 호출
  - api/_llm/usage.js → logUsage() → llm_usage_log 기록
            ↓
프론트: 토큰 단위 표시 + 완료 시 POST /api/explanations { action:'save' }
            ↓
question_explanations DB 에 저장 (provider, model, content, extra_prompt)
```

### 2.2 핵심 코드 지점 (Phase 1 변경 영향 범위)

| 파일 | 역할 | 변경 필요 |
|---|---|---|
| `src/tabs/QuizTab/AiExplanation.jsx:10-14` | `PROVIDERS` 상수 (현재 3개) | ✅ 4번째 추가 |
| `src/tabs/QuizTab/AiExplanation.jsx:60` | `generateExplanation(provider)` 분기 | ✅ provider==='local' 분기 |
| `src/hooks/useSSE.js:6-10` | `ENDPOINTS` 매핑 | ⚠️ 로컬은 백엔드 X — 분기 다름 |
| `src/tabs/SettingsTab/LlmSettingsPanel.jsx:7-11` | 설정 패널 PROVIDERS | ✅ 4번째 추가 |
| `src/constants/llm.js` | 프로바이더별 모델 카탈로그 | ✅ LOCAL_CATALOG 추가 |
| `api/explanations.js:45-57` | `save` action — provider 컬럼 | ⚠️ `provider='local-qwen35-2b'` 같은 값 받기만 |
| `api/_llm/usage.js` | `logUsage()` 호출 | ⚠️ 프론트에서 직접 호출할 통로 신설 (로컬은 백엔드 미경유) |

### 2.3 LocalAiExplanation 의 재활용 가능 자산

`src/labs/local-ai/lib/inference.js` 의 다음이 그대로 재사용:
- `MODEL_REGISTRY` (4개 모델)
- `loadPipe(size)` / `disposePipe()` / `explainQuestion(pipe, q, opts)`
- `lib/memoryFit.js` 의 `fitVerdict()` / `fitBadge()`
- `lib/deviceCheck.js` 의 `getMemoryInfo()` / `checkDeviceAi()`

→ 본 라운드는 **격리 모듈을 본 기능에 import** 만 하면 됨. 추론 로직 중복 작성 X.

---

## 3. 핵심 의사결정 (4가지)

### 3.1 통합 방식 — A vs B vs C

#### A. **`PROVIDERS` 상수에 4번째 추가 (대칭형)** ⭐ 권장

기존:
```js
const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4', catalog: GEMINI_CATALOG },
  { key: 'openai', label: 'OpenAI', color: '#10a37f', catalog: OPENAI_CATALOG },
  { key: 'claude', label: 'Claude', color: '#d97706', catalog: CLAUDE_CATALOG },
];
```

후:
```js
const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4', catalog: GEMINI_CATALOG },
  { key: 'openai', label: 'OpenAI', color: '#10a37f', catalog: OPENAI_CATALOG },
  { key: 'claude', label: 'Claude', color: '#d97706', catalog: CLAUDE_CATALOG },
  { key: 'local',  label: '디바이스', color: '#16a34a', catalog: LOCAL_CATALOG, deviceLocal: true },
];
```

**장점**:
- 사용자 학습 비용 거의 0 (기존 패턴 유지)
- 코드 변경 최소
- 다른 프로바이더와 동등 비교 (학습용 가치)

**단점**:
- 모델 로드 안 된 상태에서 사용자 클릭 시 "활성화 카드" 끼어들어야 — UX 분기 필요

#### B. 별도 섹션 "🔒 디바이스 AI" (분리형)
- AiExplanation 안에 별도 섹션으로 노출
- 일반 AI 해설(외부 3개) + 디바이스 AI 해설(로컬) 별도 그룹
- **단점**: UI 복잡, 두 그룹 간 인지적 분리

#### C. 자동 모드 (외부 우선, 외부 실패 시 로컬 폴백)
- 사용자가 "AI 해설" 누르면 시스템이 자동 선택
- **단점**: 사용자가 어떤 모델로 받았는지 불명확, 비결정적

→ **권장: A**. B/C 는 후속 라운드에 추가 가능.

### 3.2 활성화 흐름

#### 모델 메모리 적재 단일성 (이미 보장됨)

`src/labs/local-ai/lib/inference.js:79` — `let cached = null` (모듈 전역 단일 변수).
- 다른 모델 활성화 시 `disposePipe()` 자동 호출 → 이전 모델 GC
- WebGPU device + ONNX session 모두 한 모델만 점유
- → **본 라운드 추가 작업 0**. 4 모델 중 1개만 메모리 점유 보장

#### 모델 로드 0개 → 활성화 카드 inline (결정 #5)

```
사용자: "📱 디바이스" 버튼 클릭
   ↓
useDeviceAi 훅: pipeReady === false?
   ↓ Yes
DeviceAiCard 표시 (활성화 안 됨 안내 + 활성화 버튼)
   ↓ 사용자 [활성화하기]
DeviceModelChooser 표시 (REBUILD17 의 모델 선택 + 적합성)
   ↓ 사용자 모델 선택
loadPipe(size) → 다운로드 (락 진입) → 적재
   ↓ 적재 완료
explainQuestion() 자동 호출 → 결과 표시
```

#### 옵션 1. **명시적 활성화** ⭐ 권장
- 사용자가 "디바이스" 버튼 누르면 활성화 카드 (모델 선택 + 다운로드) 표시
- 활성화 후 자동으로 해설 생성
- 다음번엔 캐시되어 즉시 동작

#### 옵션 2. 자동 활성화
- 페이지 진입 시 백그라운드 다운로드 시작
- **반대 이유**: 사용자가 디바이스 AI 안 쓸 수도 있는데 자동으로 1.6~4.9 GB 받는 건 강압적

#### 옵션 3. 사용자 사전 활성화 (설정 탭)
- 설정 탭에서 사용자가 미리 켜놓음
- 카드 학습 시 즉시 사용 가능
- **장점**: 명확한 전환 지점
- **단점**: 진입 장벽

→ **권장: 1 (명시적 활성화) + 3 (설정 탭에서 사전 ON 옵션도 제공)**.

### 3.3 DB 저장

#### 옵션 1. **외부 모델과 동일하게 저장** ⭐ 권장
```sql
INSERT INTO question_explanations
  (question_id, provider, model, content, extra_prompt)
VALUES
  ($1, 'local-qwen35-2b', 'Qwen3.5-2B-ONNX', $4, $5)
```
- `question_explanations` 의 `provider` 컬럼이 string 이라 `local-{key}` 형식 그대로 들어감
- API explanations.js `save` action 변경 0 (그대로 받음)
- 사용자가 다음 방문 때 **다른 디바이스에서도** 같은 해설 조회 가능 — 가치 ↑

#### 옵션 2. 휘발 (DB 저장 X)
- 매번 새로 생성 → 토큰 절감 가치 0
- 캐시는 IndexedDB 자체 모델 캐시만 (해설 결과는 안 남음)
- **반대 이유**: REBUILD16 §8.4 의 통일 패턴에 어긋남, 사용자 학습 가치 ↓

→ **권장: 1**. 단, **저장 권한** 정책 명확화 — 외부 모델은 백엔드에서 검증 후 저장하지만 로컬은 프론트가 직접 저장 요청 → 인증 토큰 검증만 잘 되면 안전.

### 3.4 사용량 기록 (`llm_usage_log`)

#### 옵션 1. **프론트에서 직접 `/api/usage-log` 호출** ⭐ 권장
- 신규 엔드포인트: `POST /api/usage-log` (인증 필요)
- 프론트에서 `explainQuestion` 끝난 후 호출:
  ```js
  await fetch('/api/usage-log', {
    method: 'POST',
    body: JSON.stringify({
      provider: `local-${size}`,
      model: MODEL_REGISTRY[size].id,
      action: 'card_explain',
      question_id: q.id,
      input_tokens: 0,    // 프론트에서 추정 가능
      output_tokens: 0,   // 또는 토큰 카운트
      estimated_cost: 0,
      latency_ms: ...,
    }),
  });
  ```
- REBUILD16 §8.9 의 LlmUsagePanel 에 자동 표시

#### 옵션 2. 사용량 기록 안 함
- 비용 0 이라 기록 의미 없음?
- **반대 이유**: 호출량 가시화 자체가 가치 (얼마나 디바이스 모델로 전환됐는지)

→ **권장: 1**. 비용은 0 이지만 호출량 / 모델별 사용 빈도 / 평균 지연 시간 등 운영 데이터.

---

## 4. UI/UX 제안

### 4.1 AiExplanation 화면 — Phase 1

#### Before (현재)
```
┌─ AI 해설 ──────────────────────────────┐
│ [Gemini] [OpenAI] [Claude]            │ ← 버튼 3개
│                                        │
│ (클릭 시 SSE 스트리밍 → 결과 표시)     │
└────────────────────────────────────────┘
```

#### After (Phase 1)
```
┌─ AI 해설 ──────────────────────────────┐
│ [Gemini] [OpenAI] [Claude] [📱 디바이스] │ ← 4번째 추가
│                                        │
│ ┌─ 📱 디바이스 AI 가 활성 안 됨 ───┐    │
│ │ 모델을 다운로드하고 활성화하면      │    │
│ │ 외부 서버 없이 이 기기에서 추론 가능 │    │
│ │                                  │    │
│ │ [ 활성화하기 ⚙️ ]              │    │
│ └──────────────────────────────────┘    │
└────────────────────────────────────────┘
```

#### 활성화 클릭 → 모델 선택 + 다운로드
```
┌─ 📱 디바이스 AI 활성화 ───────────────┐
│ 모델 선택 (이 디바이스에 적합한 모델)   │
│                                        │
│ [ Qwen 3.5 0.8B  ✅ 0.6GB ]          │ ← 현재 디바이스에 ✅
│ [ Qwen 3.5 2B   ✅ 1.6GB ]          │   (이전 시범 모듈 재사용)
│ [ Gemma 4 E2B   ⚠️ 3.2GB ]          │
│ [ Gemma 4 E4B   ❌ 4.9GB ]          │
│                                        │
│ ⓘ 첫 다운로드 후엔 캐시됨 (다운로드 0) │
│                                        │
│ [📥 다운로드 + 활성화]                  │
└────────────────────────────────────────┘
```

#### 활성화 후 다음 클릭부터
```
┌─ AI 해설 ──────────────────────────────┐
│ [Gemini] [OpenAI] [Claude] [📱 Qwen3.5 2B ⚡]  │ ← "⚡" = 활성 상태
│                                        │
│ [ 디바이스 AI 로 해설 생성 ]            │
└────────────────────────────────────────┘
```

### 4.2 SettingsTab — LlmSettingsPanel

#### 새 섹션 추가
```
┌─ LLM 설정 ─────────────────────────────┐
│ 기본 프로바이더: [Gemini ▼]             │
│ 기본 모델: [gemini-2.5-flash ▼]         │
│ Temperature: [0.3]                     │
│ ...                                    │
│                                        │
│ ─── 디바이스 AI (NEW) ───               │
│ ☐ 디바이스 AI 사용                     │
│   ON 시 카드 학습에 "📱 디바이스" 버튼  │
│   추가됨. 첫 사용 시 모델 다운로드.     │
│                                        │
│ 활성 모델: [ Qwen 3.5 2B (1.6GB ✅)▼ ] │
│   ☑ 자동 활성화 (페이지 로드 시)        │
│                                        │
│ [→ /lab/local-ai 에서 상세 관리]       │
└────────────────────────────────────────┘
```

### 4.3 사용 흐름 — 처음 사용자

```
1. 카드 학습 → 정답 확인 → "AI 해설" 탭
2. [📱 디바이스] 버튼 클릭
3. "디바이스 AI 가 활성 안 됨" 안내 카드
4. [활성화하기] 클릭 → 모델 선택 카드 (현재 디바이스 ✅ 모델 추천)
5. 모델 선택 → 다운로드 시작 (락 진입)
6. 다운로드 완료 → 자동으로 해설 생성
7. 결과 표시 + DB 저장
```

### 4.4 사용 흐름 — 활성 사용자 (모델 캐시됨)

```
1. 카드 학습 → 정답 확인 → "AI 해설" 탭
2. [📱 Qwen3.5 2B ⚡] 클릭
3. 즉시 추론 시작 (다운로드 0)
4. 결과 표시 + DB 저장
```

→ **외부 API 와 거의 동일한 즉시성**. 단, 첫 토큰 지연이 외부보다 약간 김 (모바일이 아닌 데스크탑 기준 1~3초 vs 외부 0.5~2초).

---

## 5. 단계별 출시 계획

### Phase 1 — 본 라운드 (예상 1~2일)

#### 코드 변경

| 파일 | 변경 |
|---|---|
| `src/constants/llm.js` | `LOCAL_CATALOG` 추가 (REBUILD17 의 MODEL_REGISTRY 기반 derive) |
| `src/tabs/QuizTab/AiExplanation.jsx` | `PROVIDERS` 4번째 추가 + provider==='local' 분기 (loadPipe + explainQuestion 호출) |
| `src/tabs/SettingsTab/LlmSettingsPanel.jsx` | 디바이스 AI 섹션 추가 (활성 모델 선택 + 자동 활성화 토글) |
| `api/explanations.js` | 변경 없음 (provider 컬럼이 이미 string) |
| `api/usage-log.js` (신규) | `POST /api/usage-log` — 프론트가 직접 호출 |
| `src/components/AiProviderButton.jsx` (신규 또는 인라인) | 디바이스 모델 활성 상태 인디케이터 (⚡) |

#### 신규 컴포넌트 (작은 단위)

```
src/tabs/QuizTab/local-ai-bridge/  (신규 디렉토리)
  ├─ DeviceAiCard.jsx        — 활성화 안 됨 카드 + 활성화 버튼
  ├─ DeviceModelChooser.jsx  — 모델 선택 (REBUILD17 컴포넌트 재사용)
  └─ useDeviceAi.js          — pipe/activeSize 상태 + activate/generate 캡슐화
```

→ `src/labs/local-ai/lib/{inference,memoryFit,deviceCheck}.js` 직접 import.

#### 검증 항목
- ✅ 외부 3개 프로바이더 동작 회귀 없음
- ✅ 디바이스 미지원(Safari/모바일) 시 "디바이스" 버튼 자동 숨김
- ✅ 활성화 → 다운로드 → 추론 → DB 저장 → 다음 방문 시 조회 흐름
- ✅ 다운로드 락 (REBUILD17 §13.X) 본 화면에서도 동작
- ✅ `llm_usage_log` 에 `provider='local-qwen35-2b'` 등 기록

### Phase 2 — 후속 (예상 2~3일)

**자동 모드 도입**: 설정 탭에서 사용자가 "로컬 우선" 토글 시:
- AI 해설 클릭 → 활성 디바이스 모델 있으면 자동 사용
- 디바이스 모델 없거나 적합성 ❌ → 외부 (사용자 기본 프로바이더) 폴백
- 폴백 사실은 결과 카드에 "외부 폴백 사용" 작은 배지

**조건**: Phase 1 의 데이터로 한국어 품질 검증 + 사용자 만족도 확인 후.

### Phase 3 — 장래

**캐시 워밍업**: 사용자가 자주 푸는 카테고리(예: 운전면허) 전환 시 백그라운드 다운로드 시작 안내. 트리거 — 사용자가 동일 시험 5문항 이상 풀었을 때.

---

## 6. UI/UX 디테일 — 와이어프레임 6종

### 6.1 카드 학습 - AI 해설 탭 (활성 안 됨)

```
┌─ ✅ 정답 — ②번 ──────────────────────┐
│ 「도로교통법」 시행령 제48조 ...      │
│                                      │
│ ─── AI 해설 ─────                    │
│ [Gemini] [OpenAI] [Claude] [📱 디바이스] │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 📱 디바이스 AI 가 활성 안 됨   │  │
│ │ 외부 서버 없이 이 기기에서      │  │
│ │ AI 해설을 생성할 수 있습니다.   │  │
│ │ [활성화하기]  [상세 →]          │  │
│ └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 6.2 활성화 클릭 → 모델 선택 카드

```
┌─ 📱 디바이스 AI 활성화 ────────────┐
│ 이 디바이스에 적합한 모델 추천:     │
│                                    │
│ ⭐ Qwen 3.5 2B    1.6GB  [선택]    │
│    한국어 강세, 가장 가벼움          │
│                                    │
│ ☐ Qwen 3.5 0.8B  0.6GB  [선택]    │
│    초경량, 저사양                   │
│                                    │
│ ☐ Gemma 4 E2B    3.2GB  ⚠️         │
│    멀티모달 (메모리 빠듯)           │
│                                    │
│ ☐ Gemma 4 E4B    4.9GB  ❌         │
│    이 디바이스는 부족함             │
│                                    │
│ [📥 다운로드 + 활성화] [취소]      │
└────────────────────────────────────┘
```

### 6.3 다운로드 진행 (락 활성)

```
┌─ 📱 Qwen 3.5 2B 다운로드 중… ─────┐
│ [████████░░░░░░░] 53% (847/1638MB) │
│ 모델 파일 5/8 받는 중…              │
│                                    │
│ 🔒 페이지를 떠나지 마세요.          │
│   다운로드가 중단됩니다.            │
│                                    │
│ [⏸ 취소하고 캐시 정리]             │
└────────────────────────────────────┘
```

### 6.4 활성 후 다음 사용 시 (캐시 hit)

```
┌─ ✅ 정답 — ②번 ──────────────────────┐
│ ...                                  │
│ ─── AI 해설 ─────                    │
│ [Gemini] [OpenAI] [Claude] [📱 Qwen3.5 2B ⚡]  │
│                                      │
│ [✨ 디바이스 AI 로 해설 생성]         │
└──────────────────────────────────────┘
   ↓ 클릭
┌─ 📝 디바이스 AI 해설 ─────────────────┐
│ 정답은 ②번입니다.                     │
│                                      │
│ ① 6개월 — 임시운전증명서 기간이며... │
│ ② 1년 — 「도로교통법」 시행령 ...    │
│ ③ 2년 — 정식 면허 갱신 주기와 혼동.  │
│ ④ 3년 — 무관한 기간.                │
│                                      │
│ 📱 디바이스 추론 · 외부 전송 0       │
│ ⏱ 4.2초 · 178 토큰                  │
└──────────────────────────────────────┘
```

### 6.5 SettingsTab - 디바이스 AI 섹션

```
┌─ ⚙️ LLM 설정 ──────────────────────┐
│ 기본 프로바이더: [Gemini ▼]         │
│ ...                                │
│                                    │
│ ─── 📱 디바이스 AI ──── (NEW) ──── │
│ ☐ 디바이스 AI 사용                 │
│   카드 학습에 "📱 디바이스" 버튼    │
│   추가. 첫 사용 시 모델 다운로드.   │
│                                    │
│ ─ 활성 모델 ─                      │
│ [Qwen 3.5 2B (1.6GB) ⚡ 적재됨▼]   │
│                                    │
│ ─ 자동 활성화 ─                    │
│ ☑ 페이지 로드 시 자동 적재         │
│   (캐시된 모델만 — 다운로드는 X)   │
│                                    │
│ ─ 메모리 진단 ─                    │
│ RAM 16GB · GPU 4GB · 디스크 50GB   │
│ [→ /lab/local-ai 에서 상세 관리]   │
└────────────────────────────────────┘
```

### 6.6 모델 적합성 ❌ 시 자동 폴백 안내 (Phase 2)

```
┌─ AI 해설 ──────────────────────────┐
│ [Gemini] [OpenAI] [Claude] [📱 디바이스] │
│                                    │
│ ❌ 이 디바이스는 디바이스 AI 부적합 │
│   (메모리 부족 또는 WebGPU 미지원)  │
│                                    │
│ → Gemini 로 자동 전환 (외부 폴백)  │
│   [수동 선택]                       │
└────────────────────────────────────┘
```

---

## 7. 코드 변경 영향 범위

### 7.1 신규 파일

```
api/usage-log.js                                # POST /api/usage-log (인증 필요)
src/tabs/QuizTab/local-ai-bridge/
  ├─ DeviceAiCard.jsx                           # 활성화 안 됨 카드
  ├─ DeviceModelChooser.jsx                     # 모델 선택 (small variant)
  └─ useDeviceAi.js                             # 상태 + activate/generate 훅
src/constants/llm-local.js                      # LOCAL_CATALOG (MODEL_REGISTRY derive)
```

### 7.2 수정 파일

```
src/constants/llm.js                            # PROVIDERS / DEFAULT_LLM_SETTINGS 에 'local' 추가
src/tabs/QuizTab/AiExplanation.jsx              # PROVIDERS 4번째 + provider==='local' 분기
src/tabs/SettingsTab/LlmSettingsPanel.jsx       # 디바이스 AI 섹션 추가
src/hooks/useSSE.js                             # 'local' 분기 (백엔드 미경유 — explainQuestion 직접 호출)
api/explanations.js                             # 변경 0 (이미 provider 자유 string)
```

### 7.3 변경 없음 (격리 유지)

```
src/labs/local-ai/  (전체)                     # ✅ 관리자 시범 페이지 그대로 유지
                                                #    - 디버깅, 모델 비교, 메모리 진단 풀 버전
                                                #    - 새 모델 추가 시 1차 검증 통로
                                                #    - 본 라운드는 src/tabs/QuizTab/local-ai-bridge/ 만 추가 (직접 import)
api/{gemini|openai|claude}.js                   # 외부 API 흐름 그대로
api/_llm/{gemini|openai-chat|anthropic}.js      # 그대로
```

---

## 8. 위험 요소 + 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| **다운로드 락 충돌** | 사용자가 카드 학습 중 다운로드 시작 → 락 활성 → 다른 카드/탭 이동 못함 | REBUILD17 의 락이 잘 동작 — 안내 배너로 명시 |
| **WebGPU 미지원 사용자** | 디바이스 버튼 누르면 에러 | `checkDeviceAi()` 결과로 버튼 자동 숨김 |
| **모델 다운로드 중 페이지 새로고침** | 부분 다운로드 잔존 | beforeunload 경고 + 다음 진입 시 캐시 검증 |
| **DB 저장 권한 (provider 자유 string)** | 악의적 클라이언트가 가짜 provider 저장 | `api/explanations.js` 의 save 시 인증 + provider 화이트리스트 추가 |
| **외부 모델과 결과 비교 어려움** | 같은 문제에 어느 모델이 좋은지 학습자가 헷갈림 | 결과 카드 하단에 "다른 모델로도 보기" 링크 |
| **첫 다운로드 부담 (1.6 GB)** | 사용자가 활성화 시작 후 후회 | 다운로드 시작 전 "사이즈 명시 + 와이파이 권장" 컨펌 |
| **추론 속도 (외부 API 보다 느림)** | 첫 토큰 지연 1~3초 | 진행률 표시 + 스트리밍 (이미 구현) |

---

## 9. KPI / 검증 항목

### Phase 1 출시 후 1~2주

| 지표 | 목표 |
|---|---|
| 디바이스 AI 활성화율 (전체 사용자 중 활성화한 비율) | 10%+ |
| 디바이스 AI 해설 횟수 / 외부 API 해설 횟수 | 5%+ |
| 평균 첫 토큰 지연 (디바이스 vs 외부) | 디바이스 < 5초 |
| 모델별 사용 분포 (`llm_usage_log` 기준) | Qwen 3.5 2B > 50% (가벼움 + 한국어) |
| 한국어 품질 (사용자 5점 척도) | 평균 3.5점+ |
| 회귀 (기존 외부 API 동작) | 0% 영향 |

### Phase 2 트리거 조건

- 위 KPI 모두 만족
- 추가로 "외부 모델로 다시 받고 싶다"는 피드백 비율 < 30%
- → Phase 2 (자동 폴백 모드) 활성화

---

## 10. REBUILD17 / REBUILD16 와의 연결

| 기존 | 본 라운드와의 관계 |
|---|---|
| REBUILD16 §8.4 LLM 호출 통일 | `PROVIDERS` 패턴 그대로 활용 — 통일성 유지 |
| REBUILD16 §8.8 비용 추적 (`llm_usage_log`) | 로컬 모델도 `provider='local-{key}'` 로 기록 — 호출량 가시화 |
| REBUILD16 §8.9 LlmUsagePanel | 자동으로 디바이스 AI 사용량 표시 (코드 변경 0) |
| REBUILD17 §13 모델 다중화 | MODEL_REGISTRY 그대로 import — Phase 1 자산 100% 재사용 |
| REBUILD17 §13.X 다운로드 락 | 본 화면에서도 그대로 동작 — 통합 시 추가 작업 0 |
| REBUILD17 §13.16 컴팩트 프롬프트 | `prompts.js` 그대로 재사용 — 보기별 해설 형식 유지 |
| REBUILD17 §13.17 모바일 SDK 보류 | 본 라운드는 데스크탑 전용 정책 그대로. 모바일은 Phase 4 이상 |

---

## 11. 의사결정 결과 (✅ 2026-04-27 사용자 승인 완료)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 통합 방식 | ✅ A (PROVIDERS 4번째) |
| 2 | 활성화 흐름 | ✅ 명시적 (1+3 조합) |
| 3 | DB 저장 | ✅ 외부 모델과 동일 (`provider='local-{key}'`) |
| 4 | 사용량 기록 | ✅ 신규 `/api/usage-log` 엔드포인트 |
| 5 | 모델 로드 안 됨 UX | ✅ 활성화 카드 inline |
| 6 | Phase 1 작업 시작 | ✅ 진행 |
| **7** | **메모리 단일 모델 정책** | ✅ **이미 보장 (싱글톤)** — 본 라운드 변경 없음 |
| **8** | **`/lab/local-ai` 시범 페이지** | ✅ **유지 (관리자 전용)** — 격리 모듈 그대로 |

→ Phase 1 코드 변경 진행 중.

---

## 12. 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-04-27 | 최초 작성 — 로컬 모델의 정답 해설 통합 방안. UI/UX 와이어프레임 6종 + 단계별 출시 + KPI | Claude Code |
| 2026-04-27 (갱신) | 사용자 승인 반영 + 의사결정 #7 (단일 모델 메모리 적재) / #8 (`/lab/local-ai` 시범 페이지 유지) 명시 | Claude Code |
| 2026-04-27 (Phase 1 완료) | **§13 Phase 1 구현 완료 보고** + 라벨 "온디바이스 AI" 적용 + 관리자 프로바이더 토글 추가. 상세는 §13 참고 | Claude Code |

---

## 13. Phase 1 구현 완료 보고 (2026-04-27 저녁)

### 13.1 신규 파일

| 파일 | 역할 |
|---|---|
| `api/usage-log.js` | 디바이스 AI 사용량 기록 (provider 화이트리스트, 토큰/비용 0 강제) |
| `src/tabs/QuizTab/local-ai-bridge/useDeviceAi.js` | 디바이스 AI 통합 훅 (격리 모듈 import + activate/generate/unload + verdicts) |
| `src/tabs/QuizTab/local-ai-bridge/DeviceAiCard.jsx` | 4가지 상태 분기 카드 (미지원 / 다운로드 / 활성화 안 됨 / 활성 완료) + 내장 ModelChooser |
| `src/tabs/SettingsTab/LlmProviderToggleCard.jsx` | 4개 프로바이더 글로벌 활성/비활성 토글 (관리자 전용) |

### 13.2 수정 파일

| 파일 | 변경 |
|---|---|
| `src/constants/llm.js` | `DEFAULT_LLM_SETTINGS.local` 추가 (model='qwen35-2b'), loadLlmSettings 머지 |
| `src/tabs/QuizTab/AiExplanation.jsx` | PROVIDERS 4번째 'local' 추가 + provider==='local' 분기 + DeviceAiCard 인라인 + 저장/표시 local 지원 + `/api/config` 받아 visibleProviders 필터링 |
| `src/tabs/SettingsTab/index.jsx` | AI 섹션 최상단에 LlmProviderToggleCard 추가 |
| `api/admin.js` | `ALLOWED_SETTING_KEYS` 에 4개 provider 토글 키 추가 |
| `api/config.js` | 4개 provider 키 공개 노출 (default true) |
| `server.js` | apiFiles 에 'usage-log' 등록 |

### 13.3 라벨 정책 변경

사용자 요청 (2026-04-27 오후) — "디바이스" / "디바이스 AI" → **"온디바이스 AI"** 통일

| 위치 | Before | After |
|---|---|---|
| AiExplanation.jsx PROVIDERS label | `'디바이스'` | `'온디바이스 AI'` |
| 4번째 버튼 텍스트 | `📱 디바이스 ⚡` | `📱 온디바이스 AI ⚡` |
| DeviceAiCard 활성화 표제 | `📱 디바이스 AI 활성화` | `📱 온디바이스 AI 활성화` |
| DeviceAiCard 미지원 표제 | `📱 디바이스 AI 사용 불가` | `📱 온디바이스 AI 사용 불가` |

### 13.4 관리자 프로바이더 토글 (의사결정 §11 후속)

§11 의 6개 의사결정 외에 사용자 추가 요청으로 구현된 **글로벌 토글 시스템**:

#### 흐름
```
관리자 — 설정 → AI 설정 탭 → 🎛 AI 해설 프로바이더 토글
   ↓ 토글 클릭 (예: Claude OFF)
POST /api/admin { action:'set_setting', key:'provider_claude_enabled', value:'false' }
   ↓ aitutor_settings DB 갱신
다른 사용자 페이지 새로고침 시:
   ↓ GET /api/config (30초 캐시)
   ↓ { provider_claude_enabled: false }
AiExplanation: visibleProviders = PROVIDERS.filter(p => providerEnabled[p.key])
   ↓
4개 → 3개로 줄어든 버튼만 노출
```

#### 안전장치
- `withAdmin` 미들웨어 — 일반 사용자 set 차단
- `ALLOWED_SETTING_KEYS` 화이트리스트 — 임의 키 차단
- `/api/config` 공개 화이트리스트 — 안전한 boolean 만 노출
- **최소 1개 활성 강제** — 모든 프로바이더 OFF 차단 (LlmProviderToggleCard 자체에서 차단)
- **default true** — DB 미설정 시 활성으로 간주 (회귀 0)

### 13.5 §11 의사결정 진행 상황

| # | 항목 | 상태 |
|---|---|---|
| 1 | 통합 방식 (PROVIDERS 4번째) | ✅ 완료 |
| 2 | 활성화 흐름 (명시적) | ✅ 완료 |
| 3 | DB 저장 (외부와 동일) | ✅ 완료 (`provider='local-{size}'`) |
| 4 | 사용량 기록 (`/api/usage-log`) | ✅ 완료 |
| 5 | 모델 로드 안 됨 UX (활성화 카드 inline) | ✅ 완료 |
| 6 | Phase 1 작업 시작 | ✅ **완료 + 배포** |
| 7 | 메모리 단일 모델 정책 | ✅ 보장 (싱글톤) |
| 8 | `/lab/local-ai` 시범 페이지 유지 | ✅ 변경 없음 |
| **추가** | **글로벌 프로바이더 토글** | ✅ **완료** (§13.4) |

### 13.6 배포

- CodeBuild SUCCEEDED (Phase 1 구현 1차) — 2분 03초
- CodeBuild SUCCEEDED (라벨 변경 2차) — 1분 47초
- CodeBuild SUCCEEDED (관리자 토글 3차) — 1분 48초
- 모두 Lambda Active + CloudFront invalidation 완료
- URL: https://d2dcsdi9b1j2rf.cloudfront.net

### 13.7 검증 필요 (다음 세션)

- 회귀: 외부 3개 프로바이더 정상 동작 (PROVIDERS 배열 + anyStreaming 변수 변경 영향)
- 저장본 표시: `provider='local-qwen35-2b'` 키가 `PROVIDERS.find(p => p.key === ...)` 안 됨 → 저장본 라벨 표시 후속 보완 필요
- usage-log API: 첫 호출 후 DB INSERT 확인
- 프로바이더 토글 OFF 시 30초 내 사용자 화면 반영
- 디바이스 AI 활성화 → 다운로드 → 추론 → DB 저장 → 다음 방문 시 조회 흐름 전체

### 13.8 후속 (Phase 2 트리거 조건)

§5.2 Phase 2 ("로컬 우선 + 외부 폴백") 활성화 조건:
- Phase 1 KPI (§9) 모두 만족
- "외부 모델로 다시 받고 싶다" 피드백 비율 < 30%
- 한국어 품질 평균 3.5점+

→ 검증 결과 데이터 축적 후 결정.
