# AI TutorTwo — 학습 메인 페이지 재구성 (rebuild5)

> 작성일: 2026-03-19
> 프로젝트: workspace/aitutor
> 배포: [https://aitutor-six.vercel.app](https://aitutor-six.vercel.app)

---

## 1. 개요

기존 `/quiz` 경로에서 바로 문제 목록(QuizTab)이 렌더링되던 구조를 **학습 허브 페이지**로 교체하고, 3가지 학습 유형(카테고리/랜덤/카드)을 서브 라우트로 분리했습니다.

### 변경 동기

- 사용자가 학습 방식을 선택할 수 있는 진입점 필요
- 전체 통계(카테고리 수, 시험 수, 문제 수)를 한눈에 볼 수 있는 대시보드 필요
- 랜덤 출제, 카드 학습 등 다양한 학습 모드 제공

---

## 2. 라우트 구조 변경

### Before

```
/quiz → QuizTab (문제 목록 바로 표시)
```

### After

```
/quiz            → LearnHub    (학습 허브 — 대시보드 + 학습 유형 선택)
/quiz/category   → QuizTab     (기존 카테고리 학습 — 코드 변경 없음)
/quiz/random     → RandomQuiz  (랜덤 학습 — 신규)
/quiz/card       → CardStudy   (카드 학습 — 신규)
```

---

## 3. 커밋 이력 (4건)

| 커밋 | 설명 |
|------|------|
| `2cdbdc6` | 학습 허브 페이지 + 랜덤/카드 학습 모드 추가 |
| `de1ac10` | 랜덤 학습 문제 수 다이얼 직접 입력 추가 |
| `4b6dc90` | 대시보드 과목→문제수 변경 + 헤더 타이틀 클릭 시 홈 새로고침 |
| `5049b7c` | 랜덤 학습 문제 수 선택을 휠 피커(슬롯머신) UI로 교체 |

---

## 4. 신규 파일 (4개)

### 4-1. `src/lib/shuffle.js`

Fisher-Yates 셔플 알고리즘 유틸리티. 원본 배열을 변경하지 않고 새 배열을 반환합니다.

```javascript
export default function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

### 4-2. `src/pages/LearnHub.jsx` — 학습 허브

```
┌─────────────────────────────────┐
│ 대시보드 (3열 그리드)              │
│  카테고리 수 │ 시험 수 │ 문제수     │
├─────────────────────────────────┤
│ 학습 유형 선택                     │
│ ┌──────────────────────────────┐│
│ │ 📦 카테고리 학습         →    ││
│ └──────────────────────────────┘│
│ ┌──────────────────────────────┐│
│ │ 🔄 랜덤 학습             →    ││
│ └──────────────────────────────┘│
│ ┌──────────────────────────────┐│
│ │ 🃏 카드 학습             →    ││
│ └──────────────────────────────┘│
└─────────────────────────────────┘
```

**주요 구현:**

- `/api/questions` (action: meta) + `/api/questions?limit=1` 병렬 호출로 통계 데이터 조회
- 카테고리 수, 시험 수, 총 문제수 3열 그리드 대시보드
- 학습 유형 카드 3개 (아이콘 + 설명 + 화살표), `navigate()`로 서브 라우트 이동
- 로딩 중 스켈레톤 애니메이션

### 4-3. `src/pages/RandomQuiz.jsx` — 랜덤 학습

**2단계 UI (mode: setup → quiz)**

**setup 단계:**

```
문제 수
┌────────┐  ┌──────┬──────┐
│   ·3·  │  │  10  │  20  │
│ ▶ 5 ◀ │  ├──────┼──────┤
│   ·7·  │  │  30  │ 전체 │
└────────┘  └──────┴──────┘
 휠 피커       프리셋 버튼
```

- 카테고리/시험 select 필터
- 슬롯머신 스타일 휠 피커 (CSS scroll-snap 기반, 5~50 범위, 5단위, 초기값 5)
  - 위아래 페이드 그라데이션 + 가운데 강조 바
  - 스크롤바 숨김 처리 (overflow wrapper 기법)
  - 프리셋 버튼(10/20/30/전체) 클릭 시 휠 자동 스크롤
- "학습 시작" 버튼

**quiz 단계:**

- 전체 문제를 `apiGet`으로 가져온 후 프론트에서 `shuffle()` + `slice(count)`
- QuizCard 컴포넌트 재사용하여 목록 렌더링
- 상단에 문항 수 표시 + "다시 설정" 뒤로가기

**휠 피커 (WheelPicker) 컴포넌트 구현:**

| 항목 | 설명 |
|------|------|
| 값 범위 | 5, 10, 15, 20, 25, 30, 35, 40, 45, 50 |
| 스냅 방식 | CSS `scroll-snap-type: y mandatory` |
| 스크롤 감지 | 디바운스 80ms 후 `Math.round(scrollTop / itemHeight)` |
| 외부 동기화 | `skipRef`로 프리셋 클릭 시 onChange 재발 방지 |
| 페이드 효과 | CSS `mask-image: linear-gradient(...)` |
| 스크롤바 숨김 | 내부 div를 `width: calc(100% + 20px)`로 확장, 래퍼에서 `overflow: hidden` |

### 4-4. `src/pages/CardStudy.jsx` — 카드 학습

- setup 단계: 카테고리/시험 선택 → "학습 시작"
- study 단계: 한 화면에 QuizCard 1개만 표시 (`isExpanded=true` 고정)
- 이전/다음 버튼으로 `currentIndex` 이동
- 진행률 바 (`width: (currentIndex+1)/total * 100%`)
- 문제가 없을 때 빈 상태 UI + "다시 설정하기" 링크

---

## 5. 수정 파일 (4개)

### 5-1. `src/App.jsx`

- Lazy import 3개 추가: `LearnHub`, `RandomQuiz`, `CardStudy`
- Route 4개 구성:

```jsx
<Route path="/quiz" element={<LearnHub />} />
<Route path="/quiz/category" element={<QuizTab />} />
<Route path="/quiz/random" element={<RandomQuiz />} />
<Route path="/quiz/card" element={<CardStudy />} />
```

### 5-2. `src/components/BottomNav.jsx`

- 학습 탭 활성 판별을 `===` → `startsWith('/quiz')`로 변경
- 모든 `/quiz/*` 서브 라우트에서 학습 탭 활성화 유지

```javascript
// Before
const isActive = location.pathname === tab.path;

// After
const isActive = tab.path === '/quiz'
  ? location.pathname.startsWith('/quiz')
  : location.pathname === tab.path;
```

### 5-3. `src/components/Header.jsx`

- "AI TutorTwo" 타이틀 영역을 `<a>` 태그로 래핑
- 클릭 시 `window.location.href = '/quiz'`로 학습 메인 이동 + 페이지 새로고침
- `navigate()` 대신 `window.location.href`를 사용하여 SPA 캐시 초기화

### 5-4. `src/pages/LearnHub.jsx` — 대시보드 통계 변경

- 3번째 통계 카드: "과목" → "문제수"로 변경
- 총 문제 수 조회를 위해 `/api/questions?page=1&limit=1` API 병렬 호출 추가
- 응답의 `total` 필드에서 문제 수 추출

---

## 6. 테스트

### 신규: `tests/step6-learn-hub.spec.js` (16개 테스트)

| 그룹 | 테스트 | 수 |
|------|--------|------|
| 6-1: 학습 허브 | 렌더링, 학습 유형 표시, 각 카드 클릭 → 서브 라우트 이동, BottomNav 활성 | 7 |
| 6-2: BottomNav 서브 라우트 | /quiz/category, /quiz/random, /quiz/card에서 학습 탭 활성 | 3 |
| 6-3: 랜덤 학습 | setup UI, 프리셋 토글, 전체 버튼, 뒤로가기 | 4 |
| 6-4: 카드 학습 | setup UI, 뒤로가기 | 2 |

### 수정: `tests/step2-quiz.spec.js`

- 기본 경로를 `/quiz` → `/quiz/category`로 변경 (LearnHub 라우트 변경 반영)

### 테스트 결과

```
step2: 문제풀이 탭      4/4 passed
step3: AI 메모          passed
step4: 관리/연동         passed (1개 기존 이슈)
step5: 설정 + 빌드      passed
step6: 학습 허브         16/16 passed
```

---

## 7. 기술 결정 사항

| 결정 | 이유 |
|------|------|
| 랜덤 출제를 프론트 셔플로 구현 | 문제 수 수백 건 수준이므로 전체 로드 부담 적음, 별도 API 불필요 |
| QuizCard를 3개 학습 유형 모두 재사용 | UI 일관성 유지 + 코드 중복 방지 |
| 새 페이지 3개도 lazy import | 기존 탭과 동일한 코드 스플리팅 패턴 유지 |
| 휠 피커를 CSS scroll-snap으로 구현 | 외부 라이브러리 없이 네이티브 스크롤 + 모바일 터치 지원 |
| 헤더 타이틀 클릭에 window.location.href 사용 | SPA navigate()와 달리 완전한 새로고침 보장 |

---

## 8. 빌드 산출물

```
dist/
├── index.html                          1.15 kB
├── assets/
│   ├── vendor-react-CRTlaaT4.js      161.15 kB (52.73 kB gzip)
│   ├── QuizCard-BGDY8ru8.js           57.48 kB (19.39 kB gzip)
│   ├── index-C9V2O1eh.js              30.75 kB (10.86 kB gzip)
│   ├── index-CBpGaC9O.css             27.45 kB ( 6.16 kB gzip)
│   ├── RandomQuiz-jQcXVYRL.js          6.24 kB ( 2.35 kB gzip)  ← 신규
│   ├── CardStudy-DLUcepjs.js           4.87 kB ( 1.80 kB gzip)  ← 신규
│   ├── LearnHub-BSO9EpUI.js            4.05 kB ( 1.50 kB gzip)  ← 신규
│   ├── shuffle-BcLUN6dP.js             0.15 kB ( 0.14 kB gzip)  ← 신규
│   └── ... (기존 청크)
```

신규 페이지 3개 + 셔플 유틸 합계: **15.31 kB (5.79 kB gzip)** — 가벼운 추가량

---

## 9. 프로젝트 구조 (변경 후)

```
src/
├── App.jsx                    # 라우트 4개 추가 (수정)
├── components/
│   ├── BottomNav.jsx          # startsWith 활성 판별 (수정)
│   ├── Header.jsx             # 타이틀 클릭 → 홈 새로고침 (수정)
│   └── ...
├── lib/
│   ├── api.js
│   ├── capacitor.js
│   └── shuffle.js             # 🆕 Fisher-Yates 셔플
├── pages/
│   ├── LoginPage.jsx
│   ├── LearnHub.jsx           # 🆕 학습 허브 (대시보드)
│   ├── RandomQuiz.jsx         # 🆕 랜덤 학습 (휠 피커)
│   └── CardStudy.jsx          # 🆕 카드 학습 (플래시카드)
├── tabs/
│   ├── QuizTab/               # 기존 — /quiz/category로 경로만 변경
│   ├── ManageTab/
│   ├── ImportTab/
│   └── SettingsTab/
└── tests/
    ├── step6-learn-hub.spec.js # 🆕 16개 테스트
    └── step2-quiz.spec.js      # 경로 수정
```

---

## 10. 향후 개선 가능 사항

| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 학습 통계 저장 | 정답/오답 기록 → DB 저장 → 대시보드에 정답률 표시 | 높 |
| 오답 노트 모드 | 틀린 문제만 모아서 재학습 | 높 |
| 시험 모드 | 제한 시간 + 자동 채점 + 점수 결과 화면 | 중 |
| 카드 학습 스와이프 | 이전/다음 버튼 대신 좌우 스와이프 제스처 | 중 |
| 휠 피커 햅틱 피드백 | Capacitor Haptics 플러그인으로 스크롤 시 진동 | 낮 |
| MetaContext 캐싱 | 3개 페이지에서 각각 meta API 호출 → 전역 1회 로드 공유 | 중 |
