# REBUILD80 — 이론·단답형 드릴 시작 설정(카테고리 다중선택 + 순서/랜덤 토글)

> **작성**: 2026-07-04 KST
> **범위**: `api/kisa-drill.js`, `src/tabs/KisaTab/DrillConfig.jsx`(신규), `index.jsx`, `Dashboard.jsx`, `DrillSession.jsx`
> **목적**: 이론 드릴(MCQ)·단답형 드릴을 바로 출제하지 않고, **시작 설정 화면**을 거치도록 한다 — 카테고리 다중선택(전체/개별) + 출제 순서 토글(순서대로↔랜덤, 초기값 순서대로).

---

## §1. 설정 화면 (`DrillConfig.jsx`, `/kisa/drill-config?type=mcq|blank`)

- **카테고리 다중선택**: 약점 7분류 칩(표준 순서) + [전체]. 미선택 = 전체. 각 칩에 해당 유형의 문항수 표시(문항 0인 분류는 자동 숨김).
- **출제 순서 토글**: `📑 순서대로`(가이드 분류·번호순, **초기값**) ↔ `🔀 랜덤`(무작위).
- 선택 상태에 따라 시작 버튼에 예상 문항수 표시. 시작 → `/kisa/drill?type=...&full=1&categories=...&order=guide`(랜덤은 order 미전달=서버 기본).

## §2. API 다중 카테고리 (`api/kisa-drill.js`)

- `categories=a,b` 파라미터 추가(화이트리스트 통과분). 있으면 단일 `category` 보다 우선.
- `count`·`next` 의 category 조건을 `weakness_category = ANY($n)` 로 — 다중 분류 OR 출제. 기존 단일 `category`(복습 그룹별·대시보드 카테고리별)는 그대로 유지.

## §3. 순서/랜덤

- 순서대로 = 기존 `order=guide`(guideOrder) 재사용: `stage → weakness_category(표준순) → chapter_code` 정렬.
- 랜덤 = 기본 출제(`미시도 우선, RANDOM()`).
- `DrillSession` 의 `guideOrder` 초기값을 `searchParams.get('order')==='guide'` 로 설정 → 설정 화면 선택이 그대로 반영.

## §4. 연결

- 대시보드 "이론 드릴"·"단답형 드릴" 카드 → `/kisa/drill-config?type=...` (기존 직접 `/kisa/drill?type=...` 에서 변경).
- `DrillSession` 에 `categories` searchParam 전달(count/next). useCallback 의존성에 추가.

## §5. 검증

- API 모듈 로드 정상, build:fe 정상. categories 는 parameterized `ANY($n)` 로 SQL 안전.
