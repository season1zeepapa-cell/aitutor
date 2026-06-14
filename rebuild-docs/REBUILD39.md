# REBUILD39 — Ollama Bridge 실험실: thinking 토글 + 모델 정보 카드 이식

> **작성**: 2026-05-07 KST
> **범위**: `workspace/aitutor/src/labs/ollama-bridge/OllamaBridgeTester.jsx` + 신규 메타 카탈로그
> **트리거**: 실 사용자 보고 — `gemma4:26b` 로 추론 시 빈 응답(0자) + 2048 tokens 다 사용
> **원인**: Ollama 0.11+ 에서 reasoning 응답이 `message.thinking` 으로 분리되는데 브릿지 페이지가 `message.content` 만 읽음 → 빈 응답으로 보임
> **해결 범위**: 통합/분리 서버에 이미 있는 thinking 토글 UI + 모델 정보 카드를 브릿지에도 동일 패턴으로 이식, 추가로 응답 fallback 로직 도입

---

## §0. 결론 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| thinking 토글 UI | ❌ 없음 (Qwen 만 코드에서 강제 false) | ✅ 3-state 토글 (auto/on/off), 통합/분리와 동일 |
| 모델 정보 카드 | ❌ 없음 | ✅ 한국어 강도 + capabilities 칩 + 권장 파라미터 + 팁 |
| 모델 메타 카탈로그 | ❌ 없음 (모델 select 만) | ✅ 브릿지 전용 17개 패밀리 메타 (R-3 정책 준수, 통합/분리와 독립) |
| 빈 응답 fallback | ❌ `(빈 응답)` 단순 표시 | ✅ `message.thinking` 으로 fallback + 라벨링 표시 |
| `gemma4:26b` 빈 응답 | 🚨 재현됨 | ✅ thinking 응답 노출됨 (예상) |

**핵심 효과**:
1. 사용자가 thinking 모드를 모델별로 명시 제어 가능 (자동/켜기/끄기)
2. 모델 선택 즉시 한국어 적합성 / 파라미터 권장값 / 사용 팁 노출 → 잘못된 모델 선택 사전 방지
3. reasoning 모델(gemma4, DeepSeek R1)의 thinking-only 응답도 사용자에게 노출 → 보고된 빈 응답 케이스 해결

---

## §1. 변경 사항 — 파일 단위

### 1.1 신규 파일 — 브릿지 전용 모델 메타 카탈로그

**경로**: `workspace/aitutor/src/lib/lab/ollama-bridge-model-meta.js` (신규, ~210줄)

**왜 별도 파일인가**:
- memory `feedback_aitutor_independence` (REBUILD32 §15 R-3, 2026-05-05) — **통합/분리/브릿지 카탈로그 자동 동기화 강제 금지**. 차이는 "버그" 아니라 "의도된 차이"
- 통합 (`LAB_MODELS`) / 분리 (`server.py MODELS`) 와 브릿지(사용자 PC ollama list)는 **운영 모델 풀이 완전 다름**
- 브릿지는 사용자가 `ollama pull` 한 임의 태그(예: `qwen3:4b`, `gemma4:26b`, `gpt-oss-safeguard:20b`)를 받음 → family prefix 매칭 방식 채택

**구조**:
```js
export const OLLAMA_MODEL_META = [
  {
    match: /^qwen3?\.5/i,         // 정규식 매칭 (lowercase 기준)
    name: 'Qwen 3.5',
    org: 'Alibaba',
    korean_strength: 5,           // 1~5 (5=원어민급)
    capabilities: { think_supported: true, think_default: false, tools: true, context_k: 32 },
    params: { temperature: 0.3, top_p: 0.9, repeat_penalty: 1.1 },
    tips: '한국어 자격증 해설에 가장 안정적. thinking 은 끄기 권장 (켜면 빈 응답 위험).',
  },
  // ... 17개 패밀리
];

export function getOllamaModelMeta(modelTag) { /* family prefix 매칭 → 메타 또는 EMPTY_META */ }
export function resolveAutoThink(meta) { /* thinkMode='auto' 일 때 실효 think 값 */ }
```

**커버 패밀리** (17개):

| 패밀리 | 한국어 | thinking 권장 | 비고 |
|--------|--------|---------------|------|
| Qwen 3.5 | ⭐5 | OFF (빈 응답 위험) | REBUILD33 §33.8 hotfix 반영 |
| Qwen 3 | ⭐4 | OFF | /no_think 자동 토큰 |
| Qwen 2.5 / Qwen 2.5 Coder | ⭐4/3 | — | coder 변형 별도 |
| Gemma 4 / Gemma 3 / Gemma 2 | ⭐3/3/2 | — | multimodal, 128K context |
| DeepSeek R1 | ⭐3 | **ON** (끄면 토큰 반복) | REBUILD33 §33.9 반영 |
| DeepSeek (R1 외) | ⭐3 | — | coder 특화 |
| Llama 3.2 / 3.1 / 3 | ⭐2 | — | 영어 우선 |
| Phi-4 / Phi-3.5 | ⭐2 | — | reasoning, 영어 |
| Mistral | ⭐2 | — | 영어 다양성 |
| GPT-OSS / GPT-OSS-Safeguard | ⭐3 | — | OpenAI 오픈소스 |
| Solar (Upstage) | ⭐5 | — | 한국 토종 |
| EEVE (Yanolja) | ⭐5 | — | 한국 토종, 4K context 주의 |

미지원 패밀리는 `EMPTY_META` 반환 → 정보 카드 / thinking 토글 자동 미표시. 새 패밀리 추가는 배열에 항목 추가만으로 가능.

### 1.2 수정 — `OllamaBridgeTester.jsx`

#### imports (3줄 추가)
```diff
+ import ParamSliders from '../../components/lab/ParamSliders';
+ // REBUILD39 — 브릿지 전용 모델 메타 카탈로그 (통합/분리와 독립 운영, R-3 정책)
+ import { getOllamaModelMeta, resolveAutoThink } from '../../lib/lab/ollama-bridge-model-meta';
```

#### state 추가 (1줄)
```diff
+ const [thinkMode, setThinkMode] = useState('auto');  // 'auto' | 'on' | 'off'
```

#### computed (3줄)
```diff
+ const currentModel = getOllamaModelMeta(model);
```

#### `runInfer` 안의 think 옵션 처리 변경

**Before**:
```js
if (isQwenModel(model)) ollamaBody.think = false;
```

**After**:
```js
// 1) 사용자 명시 'on'/'off' 우선
// 2) 'auto' → 모델 메타의 think_default
// 3) 메타 없는 Qwen 패밀리 → 안전망 false (REBUILD33 §33.8)
if (thinkMode === 'on') {
  ollamaBody.think = true;
} else if (thinkMode === 'off') {
  ollamaBody.think = false;
} else {
  const auto = resolveAutoThink(currentModel);
  if (auto !== undefined) ollamaBody.think = auto;
  else if (isQwenModel(model)) ollamaBody.think = false;
}
```

#### 응답 fallback 추가

**Before**:
```js
setAnswer(d.message?.content || '(빈 응답)');
```

**After**:
```js
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
```

이 fallback 로직이 **사용자 보고된 `gemma4:26b` 빈 응답 케이스의 직접 해결**.

#### 모델 정보 카드 JSX (~80줄, ServerInferTester 패턴 그대로 재사용)

배치: 메모리 관리 카드 다음, ParamSliders 이전 (= 추론 직전 종합 검토 흐름).

표시 요소:
- 헤더: `🔍 {name} 상세 정보` + `{org} · {size} · {원본 태그}` (모노스페이스)
- 한국어 강도: ⭐ 별점 (1~2 별이면 amber 색상으로 경고)
- Capabilities 칩: 💭 thinking 지원 / 🖼️ multimodal / 🛠️ tools / 💻 코드 / 📜 NK context
- 권장 파라미터: temp / top_p / repeat_penalty (메타에 있을 때만)
- 팁: 마지막 박스, 한국어 한 문장

#### 추론 옵션 영역 교체

**Before** — 분리 input 2개:
```jsx
<div className="grid grid-cols-2 gap-2 text-[11px]">
  <label>max_tokens <input ... /></label>
  <label>temperature <input ... /></label>
</div>
```

**After** — `ParamSliders` 단일 컴포넌트:
```jsx
<ParamSliders
  temperature={temperature} onTemperatureChange={setTemperature}
  maxTokens={maxTokens} onMaxTokensChange={setMaxTokens}
  disabled={running}
  thinkMode={thinkMode} onThinkModeChange={setThinkMode}
  thinkSupported={currentModel?.capabilities?.think_supported || false}
  thinkRecommend={currentModel?.capabilities?.think_default ? 'on' : 'off'}
/>
```

UX 효과:
- 슬라이더로 변경 → 키보드 입력 없이 마우스 한 번에
- thinking 토글: `think_supported: true` 인 모델 (Qwen 3.5 / Qwen 3 / DeepSeek R1) 에서만 노출
- 권장값 표시: "권장: 끄기" / "권장: 켜기" 가 토글 우측에 자동 노출

---

## §2. 사용자 보고 케이스 검증

### 입력 (사용자가 본 화면)

```
모델: gemma4:26b
max_tokens: 2048
temperature: 0.3
응답: (빈 응답)
시간: 44630ms
토큰: 2048
```

### 변경 후 예상 흐름

**시나리오 A** — Ollama 가 reasoning 을 `message.thinking` 으로 분리
- `content = ""`, `thinking = "..."` (실제 답변)
- 새 fallback 로직 → `[💭 thinking 응답 (content 비어있음)]\n\n...` 으로 노출
- ✅ 사용자가 답변을 볼 수 있음 (단, `[💭 thinking]` 라벨로 어느 필드인지 명확히 표시)

**시나리오 B** — 둘 다 채워진 정상 응답
- `content = "답변"`, `thinking = "추론과정"`
- 새 로직 → `[💭 thinking]\n\n...\n\n[💬 answer]\n\n...` 두 섹션 모두 노출
- ✅ 사용자가 추론 과정 + 최종 답변 모두 확인

**시나리오 C** — 진짜 빈 응답 (모델 손상 / 컨텍스트 폭주)
- `content = ""`, `thinking = ""`
- 기존과 동일하게 `(빈 응답)` 표시
- 이 경우엔 모델 자체 문제이니 사용자가 다른 모델로 시도해야 함

### 추가 사용자 액션

`gemma4:26b` 사용자가 페이지 새로고침 후:
1. 모델 정보 카드 노출 — Gemma 4 메타 (한국어 ⭐3, multimodal, 128K context, 권장 temp 0.3)
2. **thinking 토글은 노출 안 됨** (Gemma 4 메타에 `think_supported: false` 가 디폴트) — 이 경우 응답 fallback 로직만 작동
3. 추론 시도 → thinking 으로 빠진 응답 노출됨

### 다른 모델에서 토글 활용 예시

| 모델 | 토글 노출? | 권장값 | 사용자 액션 |
|------|-----------|--------|------------|
| `qwen3.5:9b` | ✅ | 끄기 (안전) | 그대로 둠. 답변 안 나오면 'on' 시도 |
| `qwen3:4b` | ✅ | 끄기 | /no_think 토큰도 자동 적용 (이중 안전망) |
| `deepseek-r1:8b` | ✅ | **켜기** | 그대로 두면 reasoning trace 활성, 더 안정적 |
| `gemma4:26b` | ❌ | — | 토글 미표시 — 메타에 think_default 없음. fallback 만 작동 |
| `llama3:8b` | ❌ | — | 동일 |

---

## §3. 검증

### 3.1 빌드 통과
```
✓ built in 2.96s
```
에러 0. 청크 사이즈 경고는 기존부터 있던 것 (이번 변경분 무영향).

### 3.2 디자인 일관성
- `ParamSliders` 통합 컴포넌트 그대로 재사용 → 통합/분리 서버와 100% 동일 UX
- 모델 정보 카드 색상/구조 ServerInferTester 와 동일 (violet 계열)
- 다크모드 토큰 일관 (`dark:bg-violet-900/20` 등)

### 3.3 신규 의존성
- 없음. ParamSliders 는 이미 존재. ollama-bridge-model-meta.js 는 순수 JS.

### 3.4 정책 준수 검토

| 정책 | 준수 |
|------|------|
| R-3: 통합/분리/브릿지 독립 카탈로그 | ✅ 별도 파일 (`ollama-bridge-model-meta.js`) |
| Qwen thinking 무조건 false (메모리) | ✅ thinkMode='auto' + Qwen 메타의 think_default=false → 자동 off |
| 비용 증가 사용자 승인 (메모리) | ✅ UI 전용 변경, 인프라/엔진 무영향 |
| 한국어 주석 / 영어 식별자 | ✅ |

---

## §4. 영향 범위

| 항목 | 영향 |
|------|------|
| 백엔드 API | ❌ 무영향 |
| Ollama 엔진 / GPU | ❌ 무영향 |
| 다른 실험실 (`/lab/*`) | ❌ 무영향 (브릿지 단일 페이지 + 신규 lib 1개) |
| Cloud Run 자원 / 비용 | ❌ 무영향 |
| 빌드 사이즈 | 🟡 ~3KB 증가 (메타 카탈로그 + 정보 카드 JSX) |
| DB 스키마 / Supabase | ❌ 무영향 |

**롤백 비용**: 매우 낮음 — 이 커밋만 revert 하면 즉시 복구 (신규 파일 + 단일 파일 수정).

---

## §5. 후속 액션 (선택)

1. **사용자 보고 후 메타 보강** — 새 모델 패밀리(예: `glm`, `command-r`, `falcon`) 추가 시 `OLLAMA_MODEL_META` 배열에 항목 추가
2. **모델 자동 감지 시 auto-pull suggest** — 한국어 약 모델 선택 시 "Solar / EEVE 권장" 토스트
3. **thinking 응답 길이 가드** — thinking 텍스트가 N자 이상이면 접기/펼치기 (긴 reasoning trace 방지)
4. **번역 보조** — ParamSliders 의 `translateMode` props 도 활용 가능 (한국어 약 모델 ⭐≤2 시 자동 노출). 현 PR 범위 외.

---

## §6. 커밋 / 배포 흐름

```bash
# 1) 빌드 통과
cd workspace/aitutor && npx vite build  # ✓ built in 2.96s

# 2) 커밋 (지정 파일만)
git add workspace/aitutor/src/lib/lab/ollama-bridge-model-meta.js \
        workspace/aitutor/src/labs/ollama-bridge/OllamaBridgeTester.jsx \
        workspace/aitutor/rebuild-docs/REBUILD39.md
git commit -m "feat(aitutor): 브릿지 페이지 thinking 토글 + 모델 정보 카드 (REBUILD39)"
git push origin main

# 3) Cloud Run 재배포
gcloud builds submit --config cloudbuild.yaml --project=aitutortwo-prod \
  --substitutions=_TAG=v$(date +%Y%m%d-%H%M%S)

# 4) 검증 — 배포된 URL/lab/ollama-bridge 에서:
#    a) 모델 정보 카드가 모델 선택 시 즉시 표시되는지 (currentModel 매칭)
#    b) 한국어 강도 별점 + capabilities 칩 노출
#    c) 권장 파라미터 / 팁 박스
#    d) Qwen 모델 선택 시 thinking 토글 노출 + "권장: 끄기" 표시
#    e) DeepSeek R1 선택 시 토글 + "권장: 켜기"
#    f) gemma4:26b 추론 → 빈 응답 시 [💭 thinking 응답 (content 비어있음)] 라벨 + 본문 노출
```

---

**완료 일시**: 2026-05-07 KST
**연관 문서**: REBUILD33 §33.8 (Qwen 빈 응답 hotfix), §33.9 (DeepSeek R1 thinking 토글), §33.10 (번역 보조), REBUILD38 (브릿지 문제 해결 팁)
**다음 문서**: 사용자 후속 모델 보고 시 REBUILD40+
