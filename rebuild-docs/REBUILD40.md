# REBUILD40 — Ollama Bridge 메모리 현황 카드 (옵션 B)

> **작성**: 2026-05-07 KST
> **트리거**: 사용자 요청 — "통합과 분리 서버처럼 메모리 현황을 브릿지 페이지에 추가해주세요. 서버와 브릿지 사용자 PC 가능한지요?"
> **선택**: **옵션 B** — 사용자 PC Ollama 강화 + 참고용 Cloud Run 서버 메모리 카드 모두 추가
> **범위**: 신규 컴포넌트 1개 (`OllamaPcStatusCard`) + `OllamaBridgeTester.jsx` 수정

---

## §0. 결론 요약

### 무엇이 가능한가 — 정직한 평가

| 데이터 | 가능? | 출처 | 정확도 |
|--------|-------|------|--------|
| **사용자 PC Ollama** |||
| 로드된 모델 + size + VRAM | ✅ | Ollama `/api/ps` | 정확 |
| 모델 expires_at (자동 unload 시간) | ✅ | Ollama `/api/ps` | 정확 |
| 다운로드된 전체 모델 + 디스크 크기 | ✅ | Ollama `/api/tags` | 정확 |
| Ollama 버전 | ✅ | Ollama `/api/version` | 정확 |
| **사용자 PC 시스템** |||
| 대략적 PC RAM (4/8/16/32 GB 단위) | 🟡 | `navigator.deviceMemory` | 정확도 낮음 (privacy 캡 8GB) |
| 시스템 RAM 사용률 / 가용량 | ❌ | — | 브라우저 보안 제약 |
| GPU 종류 / 사용률 / 온도 | ❌ | — | 브라우저 보안 제약 |
| CPU 사용률 | ❌ | — | 브라우저 보안 제약 |
| **Cloud Run 서버** |||
| 통합 (aitutor) 메모리 | ✅ | `/api/local-infer?action=memory` | 정확 |
| 분리 (aitutor-server-infer) 메모리 | ✅ | `/api/iso-infer?action=memory` | 정확 |

### 변경 결과

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 사용자 PC 메모리 정보 | 기존 메모리 관리 카드에 모델 목록만 | ✅ 합계 진행 바 + 디스크 모델 + navigator + 솔직한 라벨링 |
| Cloud Run 서버 메모리 | ❌ 없음 | ✅ 통합 + 분리 두 카드 (참고용 라벨, lazy 로드) |
| 정보 vs 동작 분리 | 동작 카드에 모두 포함 | ✅ 정보 카드(신규) ↔ 동작 카드(기존, 그대로 유지) 분리 |
| 신규 컴포넌트 | — | ✅ `OllamaPcStatusCard.jsx` (브릿지 전용) |

---

## §1. 아키텍처 결정

### 1.1 왜 새 컴포넌트인가 (`OllamaPcStatusCard`)

기존 `MemoryCard` 컴포넌트는 **백엔드 endpoint 호출** 모델로 설계됨:
```js
const r = await fetch(endpoint, { credentials: 'include' });  // /api/iso-infer?action=memory
```

브릿지는 **브라우저 → localhost 직접** 호출이라 fundamentally 다름:
- localhost 호출은 CORS / mixed content 제약 (REBUILD38 참고)
- 응답 구조도 다름 (Ollama 표준 `/api/ps`, `/api/tags` 응답)
- GPU/CPU/시스템 RAM 못 가져옴 → "❌ 브라우저 제약" 라벨링 필요

→ MemoryCard 를 분기로 떡칠하는 것보다 **별도 컴포넌트 분리**가 깔끔.
→ MemoryCard 는 그대로, OllamaPcStatusCard 는 신규 (정직한 책임 분리).

### 1.2 정보 vs 동작 카드 분리

기존 단일 "🧠 메모리 관리" 카드에 정보(로드 모델) + 동작(로드/언로드)이 섞여 있었음.

REBUILD40 후:

```
┌─────────────────────────────────────────────┐
│ 📊 사용자 PC Ollama 상태 (정보)            │  ← OllamaPcStatusCard (신규)
│   - 합계 RAM/VRAM 진행 바                  │
│   - 메모리 적재 모델 + expires_at          │
│   - 디스크 모델 펼침 (디스크 합계)         │
│   - 시스템 정보 (navigator + 한계 안내)    │
│   - [🔄 새로고침]                          │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ 🧠 메모리 관리 — 모델 로드/해제 (동작)     │  ← 기존 (그대로 유지)
│   - 로드된 모델 (간단)                     │
│   - 차단 경고 + [📥 로딩] [🗑️ 모두 해제]   │
│   - 정책 안내                              │
│   - 페이지 이탈 자동 해제 토글             │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ ℹ️ 참고용 — Cloud Run 서버 메모리 (점선) │  ← MemoryCard 재사용 (신규 배치)
│ ┌──────────────────────────────────────┐    │
│ │ ▶ 📊 (참고) 통합 — aitutor          │    │
│ └──────────────────────────────────────┘    │
│ ┌──────────────────────────────────────┐    │
│ │ ▶ 📊 (참고) 분리 — aitutor-server… │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 1.3 참고용 서버 카드의 솔직한 안내

브릿지에서 서버 메모리는 **추론 성능과 무관**:
- 브릿지 추론 = 사용자 PC Ollama (localhost 직접)
- Cloud Run 서버 = SPA 호스팅 + 메타 API (auth/questions 등) 만

→ 사용자가 헷갈리지 않게 카드 묶음 위에 점선 박스 + 안내 문구:
```
ℹ️ 참고용 — 아래는 Cloud Run 서버 메모리입니다.
브릿지는 사용자 PC 에서 추론하므로 서버 메모리는 추론 성능과 무관해요.
```

비교/디버깅 가치가 있을 때만 펼쳐보도록 lazy 로드 (펼치기 클릭 시 fetch).

---

## §2. 변경 사항 — 파일 단위

### 2.1 신규 파일 — `src/components/lab/OllamaPcStatusCard.jsx` (~210줄)

**구조**:

| 섹션 | 데이터 소스 | 표시 |
|------|------------|------|
| 헤더 | `pingResult.version` | Ollama 버전 + [🔄 새로고침] |
| 합계 RAM | `loadedModels` 합산 + `navigator.deviceMemory` | 진행 바 (80% 초과 시 rose 색) |
| 합계 VRAM | `loadedModels.size_vram` 합산 | emerald 진행 바 + GPU 오프로드 % |
| 메모리 적재 모델 | `loadedModels` (Ollama `/api/ps`) | 모델별 size + VRAM + expires_at |
| 디스크 모델 | `diskModels` (Ollama `/api/tags`) | 펼침 토글, 합계 + 모델별, 🟢/⚪ 적재 여부 |
| 시스템 정보 | `navigator.deviceMemory` + 한계 안내 | navigator 값 + ❌ 가져올 수 없는 항목 명시 |

**핵심 helpers**:
```js
const fmtBytes = (b) => /* B / KB / MB / GB 자동 단위 */
const fmtExpiresAt = (iso) => /* "4분 12초 후 unload" */
const PaletteBar = ({ percent, color }) => /* 색상별 진행 바 */
```

**props** (4개, 모두 optional):
- `loadedModels` — `/api/ps` 응답 (배열)
- `diskModels` — `/api/tags` 응답 (배열)
- `ollamaVersion` — 헤더 표시용 문자열
- `onRefresh` — 새로고침 콜백 (async)

### 2.2 수정 — `OllamaBridgeTester.jsx`

#### imports (3줄)
```diff
+ // REBUILD40 — 메모리 현황 카드 (정보) + 통합/분리 서버 참고용 카드
+ import OllamaPcStatusCard from '../../components/lab/OllamaPcStatusCard';
+ import MemoryCard from '../../components/lab/MemoryCard';
```

#### JSX — 메모리 관리 카드 직전 (정보 카드 추가, 14줄)
```jsx
{pingResult?.ok && (
  <OllamaPcStatusCard
    loadedModels={loadedModels}
    diskModels={models}
    ollamaVersion={pingResult?.version}
    onRefresh={async () => {
      await ping();              // /api/version + /api/tags
      await refreshLoadedModels();  // /api/ps
    }}
  />
)}
```

#### JSX — 메모리 관리 카드 직후 (참고 서버 카드 묶음, 18줄)
```jsx
<div className="rounded-xl border border-dashed border-border/60 bg-bg/30 p-2.5 space-y-2">
  <p>ℹ️ 참고용 — 아래는 Cloud Run 서버 메모리입니다... 추론 성능과 무관 ...</p>
  <MemoryCard title="📊 (참고) 통합 서버 — aitutor"
              service="aitutor"
              endpoint="/api/local-infer?action=memory" />
  <MemoryCard title="📊 (참고) 분리 서버 — aitutor-server-infer"
              service="aitutor-server-infer"
              endpoint="/api/iso-infer?action=memory" />
</div>
```

`MemoryCard` 의 `unloadEndpoint` / `restartEndpoint` 는 의도적으로 전달 안 함 → **참고용**이므로 액션 버튼 숨김 (사용자가 실수로 통합/분리 서버를 재시작하지 않게).

---

## §3. 검증

### 3.1 빌드 통과
```
✓ built in 3.10s
```
에러 0. 빌드 사이즈는 기존과 동일 (메모리 카드 컴포넌트는 lazy 로드 안 해서 메인 chunk 약간 증가).

### 3.2 솔직한 라벨링 점검

브라우저 한계를 사용자에게 명확히 전달하는지 확인:

```
🖥️ 시스템 정보 (브라우저 접근 가능 범위)
  • PC RAM (대략): 16 GB  (navigator.deviceMemory · 4/8/16/32 단위로 반올림됨)
  • 시스템 RAM 사용률 / GPU 정보 / CPU 사용률: ❌ 가져올 수 없음 (브라우저 보안 제약)
  💡 정확한 시스템 모니터링은 macOS 활성 상태 보기 / Windows 작업 관리자 / Linux htop 사용
```

✅ **약속하지 않은 것은 약속 안 함** (정직성 우선).

### 3.3 참고 서버 카드 안내

```
ℹ️ 참고용 — 아래는 Cloud Run 서버 메모리입니다.
브릿지는 사용자 PC 에서 추론하므로 서버 메모리는 추론 성능과 무관해요
(서버는 SPA 호스팅 + 메타 API 만 담당).
비교/디버깅용으로만 펼쳐보세요.
```

✅ 사용자가 "왜 여기에 서버 메모리가 있지?" 라는 의문을 가지지 않게.

### 3.4 정책 준수 검토

| 정책 | 준수 |
|------|------|
| R-3: 통합/분리/브릿지 독립 운영 | ✅ 신규 컴포넌트는 브릿지 전용. MemoryCard 는 props 만 다르게 (서버 endpoint 만 그대로 사용 — 자동 동기화 아님) |
| 비용 증가 사용자 승인 | ✅ UI 전용, 인프라/엔진/DB 무영향. MemoryCard 의 endpoint 는 이미 운영 중 (REBUILD30 §25 등) |
| 정직한 표현 | ✅ "참고용" 라벨, 브라우저 한계 명시, 약속 안 한 것은 약속 안 함 |
| 한국어 주석 / 영어 식별자 | ✅ |

---

## §4. 영향 범위

| 항목 | 영향 |
|------|------|
| 백엔드 API | ❌ 무수정 — 기존 `/api/local-infer?action=memory`, `/api/iso-infer?action=memory` 재사용 |
| Ollama 엔진 / GPU | ❌ 무영향 |
| 다른 실험실 (`/lab/local-gcp`, `/lab/server-infer`) | ❌ 무영향 (MemoryCard 기존 사용처 무수정) |
| Cloud Run 자원 / 비용 | ❌ 무영향 (UI 전용) |
| 빌드 사이즈 | 🟡 ~5KB 증가 (OllamaPcStatusCard 신규) |
| DB 스키마 | ❌ 무영향 |

**롤백 비용**: 매우 낮음 — 단일 커밋 revert.

---

## §5. UX 흐름 — 사용자 시나리오

### 시나리오 A — 처음 페이지 진입

1. Ollama 연결 자동 ping → `pingResult.ok = true` (이미 구현됨, REBUILD28~)
2. **📊 사용자 PC Ollama 상태** 카드 즉시 노출
   - 메모리 적재 0개 → "⚪ 메모리에 로드된 모델 없음"
   - 디스크 모델 펼치기 → 다운로드된 전체 모델 보임
   - 시스템 정보 → navigator.deviceMemory 표시
3. 🧠 메모리 관리 카드 → "메모리 비어있음" + [📥 로딩] 버튼

### 시나리오 B — 모델 로딩 후

1. 사용자가 [📥 qwen3.5:9b 메모리에 로딩] 클릭
2. ~10초 후 로딩 완료 → 두 카드 모두 자동 갱신
   - **📊 PC 상태** : RAM 6.6 GB / ≈16 GB (41%) + VRAM 5.8 GB + 메모리 적재 1개 + 디스크 합계 36.6 GB
   - **🧠 관리** : ✅ qwen3.5:9b 표시 + [🗑️ 모두 해제]

### 시나리오 C — 사용자가 서버 메모리 비교 궁금

1. 점선 박스 안내 읽음 ("참고용 — 추론 성능과 무관")
2. **▶ 📊 (참고) 통합 서버 — aitutor** 클릭 → lazy fetch → 컨테이너 RAM + GPU L4 VRAM + Ollama 로드 모델 표시
3. **▶ 📊 (참고) 분리 서버 — aitutor-server-infer** 동일하게 확인 가능

### 시나리오 D — Ollama 버전 확인

1. PC 상태 카드 헤더에 `v0.3.x` 자동 표시
2. 빌드 정보 헷갈리면 [🔄 새로고침] 으로 다시 호출

---

## §6. 후속 액션 (선택)

이번 PR 범위 밖, 후속 검토 후보:

1. **자동 갱신 옵션** — 5초마다 Ollama `/api/ps` 자동 폴링 (모델 로딩 진행 시각화)
2. **expires_at 카운트다운** — 현재는 텍스트 ("4분 12초 후 unload"), 실시간 카운트 다운 가능
3. **디스크 사용량 경고** — 디스크 모델 합계 > 100GB 시 ⚠ 경고 추가
4. **navigator.userAgentData.platform** — 더 정확한 OS 감지 (지금은 navigator.userAgent 사용 중)
5. **시스템 RAM 사용률 추정** — Ollama `/api/ps` 의 size 합산 + navigator.deviceMemory 비율로 대략 추정 (정확도 낮으니 주의)

---

## §7. 커밋 / 배포 흐름

```bash
# 1) 빌드 통과
cd workspace/aitutor && npx vite build  # ✓ built in 3.10s

# 2) 커밋 (지정 파일만)
git add workspace/aitutor/src/components/lab/OllamaPcStatusCard.jsx \
        workspace/aitutor/src/labs/ollama-bridge/OllamaBridgeTester.jsx \
        workspace/aitutor/rebuild-docs/REBUILD40.md
git commit -m "feat(aitutor): 브릿지 페이지 메모리 현황 + 참고용 서버 메모리 카드 (REBUILD40)"
git push origin main

# 3) Cloud Run 재배포
gcloud builds submit --config cloudbuild.yaml --project=aitutortwo-prod \
  --substitutions=_TAG=v$(date +%Y%m%d-%H%M%S)

# 4) 검증 — 배포된 URL/lab/ollama-bridge 에서:
#    a) 📊 사용자 PC Ollama 상태 카드가 모델 정보 카드 다음에 노출
#    b) 모델 로드 후 합계 진행 바 + VRAM 오프로드 % 정상 표시
#    c) 디스크 모델 펼치기 → 다운로드된 모델들 + 🟢/⚪ 적재 여부
#    d) 시스템 정보 라벨에 navigator.deviceMemory + ❌ 못 가져옴 명시
#    e) 점선 박스 "참고용" 안내 + 통합/분리 카드 lazy 로드 정상 동작
#    f) MemoryCard 의 액션 버튼은 참고 카드에는 안 보여야 함 (실수 방지)
```

---

**완료 일시**: 2026-05-07 KST
**연관 문서**: REBUILD33 §33 (통합 서버 MemoryCard 도입), REBUILD38 (브릿지 문제 해결 팁), REBUILD39 (브릿지 thinking 토글 + 모델 정보 카드)
**다음 문서**: 자동 갱신 / 디스크 경고 등 후속 개선 시 REBUILD41+
