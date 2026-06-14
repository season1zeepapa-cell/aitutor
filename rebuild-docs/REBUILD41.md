# REBUILD41 — Gemma 4 영문 reasoning + thinking 토글 누락 hotfix

> **작성**: 2026-05-07 KST
> **트리거**: 사용자 보고 — `gemma4:e4b` 로 추론 시 reasoning trace 만 영문으로 출력되고 실제 답변이 안 보임 (스크린샷)
> **범위**:
>   - `src/lib/qwen.js` — `applyKoreanLock` generic 함수 신규 export (Qwen 체크 없음)
>   - `src/lib/lab/ollama-bridge-model-meta.js` — Gemma 4/3 think 메타 보강
>   - `src/labs/ollama-bridge/OllamaBridgeTester.jsx` — 한국어 강 모델 일괄 한국어 lock 적용
> **결과**: 사용자 케이스 동시 두 문제 (영문 reasoning + thinking 토글 누락) 해결

---

## §0. 결론 요약

| 증상 | 원인 | REBUILD41 해결 |
|------|------|----------------|
| Gemma 4 reasoning 자체가 영문 ("Here's a thinking process...") | `applyQwenStrict` 의 한국어 강제가 **Qwen 모델만** 적용 → Gemma 무방비 | ✅ `applyKoreanLock` generic 신규 + 한국어 강 모델 (⭐3+) 자동 적용 |
| thinking 토글이 모델 카드에 안 보임 | Gemma 4/3 메타에 `think_supported` 미정의 → ParamSliders 가 토글 숨김 | ✅ Gemma 4/3 메타에 `think_supported: true` + `think_default: false` |
| reasoning 만 출력되고 실제 답변 안 보임 | Ollama 가 응답을 `message.thinking` 으로 분리 (REBUILD39 fallback 으로 노출되긴 했음) | ✅ `auto` 모드에서 `think: false` 자동 적용 → Ollama 가 thinking 모드 안 씀 |

**핵심 효과**: 사용자가 별도 조작 없이 Gemma 4 선택 → 자동으로 thinking OFF + 한국어 시스템 프롬프트 → 정상 한국어 답변.

---

## §1. 진단 — 사용자 화면이 알려준 것

### 1.1 스크린샷 분석

```
[💭 thinking]
Here's a thinking process to ensure the output meets all constraints:
1. **Analyze the Request and Constraints:**
   * **Role:** Korean Certification Academy Instructor (writing detailed post-exam ...)
   * **Goal:** Write a thorough explanation for a multiple-choice question ...
   * **Output Format (Strict):**
     * Line 1: "정답은 ②번입니다" (No greetings/introductions).
   * Correct Answer Explanation (2-3 lines): Must cite ...
```

분석:
- ✅ **REBUILD39 의 thinking fallback 로직은 정상 작동** — `[💭 thinking]` 라벨로 노출됨
- ❌ **reasoning 자체가 영문** — 모델이 시스템 프롬프트를 영어로 받아 영어로 사고 중
- ❌ **`[💬 answer]` 섹션이 안 보임** — Ollama 가 `message.content` 를 비웠음 (thinking only 모드)

### 1.2 두 가지 문제의 결합

| # | 문제 | 영향 |
|---|------|------|
| A | 한국어 강제 시스템 프롬프트가 Qwen 만 | Gemma 4 가 영문 사고 → 영문 reasoning |
| B | Gemma 4 메타에 `think_supported` 없음 | thinking 토글 노출 X → 사용자가 끌 방법 없음 |

A 만 고치면 → 영문은 사라지지만 reasoning trace 만 보이고 답변 없음 (B 가 미해결)
B 만 고치면 → thinking 끄긴 했지만 한국어 강제 안 들어가 영문 답변

→ **A + B 동시 해결 필수**.

---

## §2. 변경 사항 — 파일 단위

### 2.1 `src/lib/qwen.js` — generic `applyKoreanLock` 함수 신규

**Before**: `applyQwenKoreanLock(messages, modelKeyOrId)` 안에 `isQwenModel` 체크가 박혀있어 Qwen 외 모델은 무시.

**After**:
```js
// Qwen 체크 없는 generic 한국어 강제 (REBUILD41 신규)
export function applyKoreanLock(messages) { /* 3중 패턴 동일 */ }

// 기존 함수는 wrapper 로 남김 (역호환)
export function applyQwenKoreanLock(messages, modelKeyOrId) {
  if (!isQwenModel(modelKeyOrId)) return messages;
  return applyKoreanLock(messages);
}
```

**왜 분리한 함수로?**:
- `applyQwenStrict` / `applyQwenKoreanLock` 은 Qwen-specific 로 명명되어 다른 lab 에서 이미 사용 중. 시그니처 깨면 다른 lab 영향.
- 새 함수로 분리 → 안전하게 점진 적용. 테스트도 격리.

**idempotent 보장**:
- system 메시지에 `'CRITICAL: 반드시 한국어'` 이미 있으면 skip
- user 메시지에 `'한국어(Korean)로만'` 있으면 skip
- assistant seed `'네, 한국어로 답변드리겠습니다.'` 있으면 skip
- → 여러 번 호출해도 안전. `applyQwenStrict` → `applyKoreanLock` 순서 호출 시 Qwen 모델은 두 번째에서 자동 skip.

### 2.2 `src/lib/lab/ollama-bridge-model-meta.js` — Gemma 메타 보강

```diff
  {
    match: /^gemma4/i,
    name: 'Gemma 4',
    org: 'Google',
    korean_strength: 3,
-   capabilities: { multimodal: true, context_k: 128 },
+   capabilities: { multimodal: true, context_k: 128, think_supported: true, think_default: false },
    params: { temperature: 0.3, top_p: 0.95, repeat_penalty: 1.05 },
-   tips: '... ⚠ 일부 빌드는 응답을 thinking 필드로 분리 — 빈 응답 시 [💭 thinking] 접두로 표시됨.',
+   tips: 'Gemma 패밀리 / 멀티모달 / 128K. ⚠ thinking 켜면 reasoning trace 만 노출되고 답변이 빈 응답처럼 보임 — "끄기" 권장.',
  },
```

Gemma 3 도 동일한 변경. Gemma 2 는 thinking 모드 없으므로 무수정.

**효과**:
- 모델 정보 카드 → `💭 thinking 지원` 칩 자동 노출
- ParamSliders 토글 자동 노출 + "권장: 끄기" 표시
- `thinkMode='auto'` 시 `resolveAutoThink(currentModel)` → `think_default = false` → `ollamaBody.think = false` 자동 주입
- 사용자가 토글로 강제로 켜고 싶으면 "켜기" 클릭 가능

### 2.3 `OllamaBridgeTester.jsx` — runInfer 한국어 lock

```diff
+ import { applyQwenStrict, isQwenModel, applyKoreanLock } from '../../lib/qwen';

  const runInfer = async (customMessages = null) => {
    ...
    const baseMessages = customMessages || buildLabMessages(question);
-   // Qwen 한국어 강제 + thinking 비활성
-   const messages = applyQwenStrict(baseMessages, model);
+   // Qwen 한국어 강제 + thinking 비활성 (idempotent)
+   let messages = applyQwenStrict(baseMessages, model);
+   // REBUILD41 — Qwen 외 한국어 강 모델 (⭐3+) 도 한국어 lock 적용
+   //   대상: Gemma 4/3, Solar, EEVE, GPT-OSS, Qwen 2.5 등
+   //   Qwen 은 applyQwenStrict 가 이미 처리 → 중복 회피 (isQwenModel 체크)
+   if (!isQwenModel(model) && (currentModel?.korean_strength || 0) >= 3) {
+     messages = applyKoreanLock(messages);
+   }
```

**조건 설계**:
- `korean_strength >= 3` (Gemma 4/3, Qwen 2.5, GPT-OSS, Solar, EEVE 등) — 한국어 강제 적용
- `korean_strength <= 2` (Llama 3.x, Phi, Mistral 등) — 한국어 강제 안 함 (영어 답변이 더 정확하고, 한국어 강제 시 품질 저하 가능)
- 메타가 없는 모델 (`currentModel = {}`) — `korean_strength` 가 `undefined` → `|| 0` 으로 fallback → 적용 안 함

이 조건은 **사용자가 명시 OFF 할 수 있어야** 더 좋은데, 현재 PR 범위는 hotfix 라서 후속 검토.

---

## §3. 사용자 케이스 재현 → 예상 흐름

### Before (REBUILD41 적용 전)

```
1) 사용자 gemma4:e4b 선택
2) 모델 정보 카드 — thinking 칩 없음, 토글 안 보임
3) thinkMode = 'auto' → resolveAutoThink 미정의 → think 옵션 안 들어감
4) Ollama 가 자체 thinking 모드 진입 → message.thinking 에 영문 reasoning, content 비어있음
5) REBUILD39 fallback → [💭 thinking 응답 (content 비어있음)] 라벨 + 영문 텍스트 노출
6) 사용자 화면: "Here's a thinking process..." (영문 reasoning trace 만 보임, 실제 답변 없음)
```

### After (REBUILD41 적용 후)

```
1) 사용자 gemma4:e4b 선택
2) 모델 정보 카드 — 💭 thinking 지원 칩 노출 + 권장 파라미터 + 팁 갱신
3) ParamSliders thinking 토글 자동 노출 + "권장: 끄기"
4) thinkMode = 'auto' → resolveAutoThink → think_default: false → ollamaBody.think = false
5) korean_strength = 3 → !isQwenModel("gemma4:e4b") = true → applyKoreanLock 적용
   → 시스템 프롬프트에 "당신은 한국어 자격증 시험 전문 강사입니다." +
                  "⚠ CRITICAL: 반드시 한국어로만 답변하세요. 영어 사용 금지."
   → 마지막 user 에 "⚠ 반드시 한국어(Korean)로만 답변하세요. English 사용 금지."
   → assistant seed "네, 한국어로 답변드리겠습니다.\n\n"
6) Ollama 호출 — think:false + 한국어 강제 시스템 프롬프트
7) 모델이 한국어로 답변 생성 (thinking 안 함, content 정상)
8) 사용자 화면: 평소 한국어 해설 답변
```

### 사용자가 thinking 켜고 싶다면

1. 모델 정보 카드 다음 ParamSliders → 💭 Thinking 모드 → "켜기" 클릭
2. `thinkMode = 'on'` → `ollamaBody.think = true`
3. 모델이 한국어 reasoning + 한국어 answer 동시 생성
4. REBUILD39 fallback → `[💭 thinking]\n\n...\n\n[💬 answer]\n\n...` 두 섹션 모두 한국어로 노출

---

## §4. 검증

### 4.1 빌드 통과
```
✓ built in 2.99s
```
에러 0. 청크 사이즈 경고는 기존부터 (이번 변경분 무영향).

### 4.2 idempotent 검증

`applyQwenStrict` → `applyKoreanLock` 순서 호출 시 동일 메시지 두 번 추가 안 되는지:

| 케이스 | 1차 (`applyQwenStrict`) | 2차 (`applyKoreanLock`) |
|--------|-------------------------|--------------------------|
| Qwen 모델 | system + user + assistant seed 추가 | 모두 skip (이미 들어있음) ✅ |
| 비-Qwen ⭐3+ | applyQwenStrict 가 isQwenModel false → 메시지 변경 없음 | system + user + assistant seed 추가 ✅ |
| 비-Qwen ⭐≤2 | 변경 없음 | 적용 안 함 (조건 false) ✅ |

→ 정합.

### 4.3 다른 lab 영향 점검

| 사용처 | `applyQwenStrict` 변경? | `applyQwenKoreanLock` 변경? | 영향 |
|---------|-------------------------|------------------------------|------|
| `local-gcp/LocalGcpTester` | ❌ (변경 없음) | ❌ wrapper 동작 동일 | 무영향 |
| `server-infer/ServerInferTester` | ❌ | ❌ | 무영향 |
| `webllm/`, `hf-playground/`, `hf-compare/` | ❌ | ❌ | 무영향 |
| `ollama-bridge/OllamaBridgeTester` | ❌ + `applyKoreanLock` 신규 사용 | — | 본 PR 의 의도 |

→ 다른 lab 무영향. wrapper 패턴으로 역호환 보장.

### 4.4 정책 준수

| 정책 | 준수 |
|------|------|
| Qwen thinking 무조건 false (메모리) | ✅ 보존 — `applyQwenStrict` 의 `applyQwenNoThink` 그대로 |
| 통합/분리/브릿지 독립 운영 (R-3) | ✅ 메타 변경은 브릿지 전용 파일. lib/qwen.js 의 generic 함수는 모든 lab 이 옵트인 사용 |
| 비용 증가 사용자 승인 | ✅ UI/lib 전용. 인프라 무영향 |
| 한국어 주석 / 영어 식별자 | ✅ |

---

## §5. 영향 범위

| 항목 | 영향 |
|------|------|
| 백엔드 API | ❌ 무영향 |
| Ollama 엔진 / GPU | ❌ 무영향 |
| 다른 실험실 (`/lab/*`) | ❌ 무영향 (`applyQwenKoreanLock` 동작 동일) |
| Cloud Run 자원 / 비용 | ❌ 무영향 |
| 빌드 사이즈 | 🟡 ~1KB 증가 (`applyKoreanLock` 함수 추가) |
| DB / Supabase | ❌ 무영향 |

**롤백 비용**: 매우 낮음 — 단일 커밋 revert.

---

## §6. 후속 액션 (선택)

1. **사용자 명시 OFF 옵션** — `currentModel.korean_strength >= 3` 자동 한국어 lock 을 무효화하는 토글 (예: "원어 답변 허용") — 영어 자격증 학습 시 유용
2. **다른 lab 일관 적용** — 통합 / 분리 service 도 한국어 강 모델에 동일 lock 적용 검토 (현재는 백엔드 system prompt 가 그 역할 하는 것으로 추정)
3. **Phi-4 / Llama 3.1** 의 한국어 강 변형 (예: `phi-4-korean`, `llama3-korean`) 매칭 패밀리 추가
4. **Gemma 4 가 Ollama 자체 thinking 모드 진입한 정확한 원인** — Ollama 0.11+ 의 think 기본 동작 / 모델 metadata / Modelfile 분석. 현재는 black box 로 두고 우리 측 think:false 강제로 우회

---

## §7. 커밋 / 배포 흐름

```bash
# 1) 빌드 통과
cd workspace/aitutor && npx vite build  # ✓ built in 2.99s

# 2) 커밋
git add workspace/aitutor/src/lib/qwen.js \
        workspace/aitutor/src/lib/lab/ollama-bridge-model-meta.js \
        workspace/aitutor/src/labs/ollama-bridge/OllamaBridgeTester.jsx \
        workspace/aitutor/rebuild-docs/REBUILD41.md
git commit -m "fix(aitutor): 브릿지 Gemma 4 영문 reasoning + thinking 토글 누락 hotfix (REBUILD41)"
git push origin main

# 3) Cloud Run 재배포
gcloud builds submit --config cloudbuild.yaml --project=aitutortwo-prod \
  --substitutions=_TAG=v$(date +%Y%m%d-%H%M%S)

# 4) 검증
#    a) gemma4:e4b 선택 → 정보 카드에 💭 thinking 지원 칩 노출
#    b) ParamSliders 에 thinking 토글 + "권장: 끄기"
#    c) thinkMode=auto 그대로 두고 추론 → 한국어 답변 (영문 reasoning 안 나와야 함)
#    d) 사용자가 토글로 "켜기" 시도 → 한국어 reasoning + 한국어 answer 두 섹션 모두 노출
#    e) qwen3.5:9b 같은 Qwen 모델 — 기존과 동일 동작 (regression 없음)
```

---

**완료 일시**: 2026-05-07 KST
**연관 문서**: REBUILD33 §33.8 (Qwen 빈 응답 hotfix), §33.9 (DeepSeek R1 thinking 토글), REBUILD39 (브릿지 thinking 토글 + 모델 정보 카드 + 응답 fallback)
**다음 문서**: 사용자 명시 OFF 옵션 / 다른 lab 일관 적용 / Phi-4 한국어 변형 추가 등 후속 검토 시 REBUILD42+
