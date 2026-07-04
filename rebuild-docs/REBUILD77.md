# REBUILD77 — 복습(SRS) 문제유형화 + 유형·그룹별 선택 복습

> **작성**: 2026-07-04 KST
> **범위**: `api/kisa-review.js`, `src/tabs/KisaTab/ReviewHome.jsx`(신규), `index.jsx`, `Dashboard.jsx`
> **목적**: 대시보드 상단의 "🔔 복습 N" 배지를 없애고, 복습을 다른 학습처럼 **문제유형 버튼**으로 편입. 복습 대상을 **문제유형별·약점그룹별로 나눠 보여주고 선택적으로 복습**할 수 있는 랜딩을 신설한다.

---

## §1. 배경

- 기존: 대시보드 헤더의 소형 배지 → `/kisa/drill?srs=true`(전체 복습)만. 유형/그룹을 고를 수 없었다.
- 요청: 배지 제거 → 메인 문제유형 버튼으로 추가 + 복습 대상을 유형/그룹으로 선택 복습.

## §2. 복습 집계 API (`api/kisa-review.js`)

- **`GET ?action=breakdown`** 신설 — 복습 예정(도래: `suspended=FALSE AND next_review_at <= NOW()`) 문항을 두 축으로 집계:
  - `byType`: 문제유형별(mcq/blank/diagnosis4/composite/codeid) 개수
  - `byCategory`: 약점 7분류별 개수
  - `total`: 전체 도래 수
- 대시보드 배지 수(`due_today`)와 동일 조건 → 합계 일치.

## §3. 복습 랜딩 (`ReviewHome.jsx`, `/kisa/review`)

- **전체 복습** 버튼(N개) → `/kisa/drill?srs=true`.
- **문제유형별** 그리드 — 각 유형 `이모지 라벨 N` → `/kisa/drill?srs=true&type=<유형>`.
- **약점 그룹별** 목록(표준 순서) — 각 그룹 `이모지 라벨 N` → `/kisa/drill?srs=true&category=<분류>`.
- 개수 0인 유형/그룹은 자동 숨김. 복습 대상이 0이면 안내 + "새 문제 풀러 가기".
- SRS 필터 동작: `kisa-drill` 의 srsOnly 쿼리가 공통 `conditions`(type·category 포함)를 그대로 적용 → 유형/그룹 조건이 복습 큐에도 반영(추가 서버 변경 불필요). `DrillSession` 은 srs 모드에서 type 미지정 시 전체 유형, 명시 시 그 유형만(REBUILD 복습배지 수정과 정합).

## §4. 대시보드 (`Dashboard.jsx`)

- 헤더의 "🔔 복습 N" 배지 **제거**.
- 문제유형 그리드에 **"🔁 복습 (SRS)"** 버튼 추가 — desc 에 오늘 복습 수 표시(`오늘 복습 N개 · 유형·그룹별 선택`), 복습 있으면 highlight. `/kisa/review` 진입.

## §5. 검증

- `breakdown` 쿼리 운영 DB 확인 — 복습 도래 codeid 2건(대시보드 배지 수와 일치).
- API 모듈 로드 정상, build:fe 정상.
