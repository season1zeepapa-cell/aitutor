# REBUILD71 — 코드 약점드릴 전수 학습 + 이어서 학습하기

> **작성**: 2026-07-02 KST
> **범위**: `api/kisa-drill.js`, `src/tabs/KisaTab/CodeDrillHome.jsx`(신규), `src/tabs/KisaTab/DrillSession.jsx`, `src/tabs/KisaTab/index.jsx`, `src/tabs/KisaTab/Dashboard.jsx`
> **목적**: 코드 약점드릴(codeid)이 10문항으로 고정돼 있던 것을 **전체/약점 분류 그룹별 전수 풀이**로 확장하고, 중단 지점을 기억했다가 **이어서 학습하기**로 재개하게 한다.

---

## §1. 문제

- `DrillSession.jsx`는 챕터 지정이 없으면 `sessionTotal = Math.min(available, 10)` 로 **한 세션 10문항 제한**. codeid 303문항을 체계적으로 전수 풀 수 없었다.
- "중단 후 이어하기" UX 부재 — 다만 서버(`kisa-drill?action=next`)는 이미 **미시도 문항 우선**(`submitted_at ASC NULLS FIRST`) 서빙이라 재개의 뼈대는 존재했다.

## §2. 설계

```
/kisa/code-drill (CodeDrillHome 랜딩)
  · 전체 진도(예 148/303) + 8개 약점 분류 그룹별 진도 카드
  · 범위 선택 후 "이어서 학습하기"
        ↓
/kisa/drill?type=codeid&full=1[&category=<enum>]  (DrillSession full 모드)
  · full=1 → 10개 제한 해제: total = 범위 전체
  · 진행도 baseline = 이미 푼(distinct) 문항수 → 중단 지점부터 표시
  · 서버가 미시도 문항 우선 서빙 → 안 푼 문제부터 자동 이어짐
```

## §3. 변경 내용

### 백엔드 `kisa-drill.js`
- `action=count`: 응답에 **`attempted`**(현재 필터 범위에서 시도한 distinct 문항수) 추가. SRS 모드 제외.
- **`action=progress`(신규)**: 유형(기본 codeid)의 `overall{total,attempted}` + `byCategory[{category,total,attempted}]` 반환. `count(DISTINCT q.id)` 로 JOIN 중복 보정. 랜딩 진도 표시용.

### 프론트
- **`CodeDrillHome.jsx`(신규, `/kisa/code-drill`)**: progress API로 전체·분류별 진도 바 렌더. 각 범위 "학습 시작/이어서/복습(완주)" 버튼 → `/kisa/drill?type=codeid&full=1[&category=]`. 하단에 기록 없는 빠른 퀴즈(`/kisa/code-quiz`) 링크.
- **`DrillSession.jsx`**: `full=1` 파라미터 → `sessionTotal=available`(전수), 진행도 baseline=`attempted`(이어하기). 이미 완주(attempted≥total)면 baseline 0(새 복습 패스). 완주 시 알림 후 `/kisa/code-drill` 복귀. **다른 드릴 유형은 무영향**(full 미전달 시 기존 10개 로직 유지).
- `index.jsx`: `/kisa/code-drill` 라우트. `Dashboard.jsx`: "코드 약점드릴" 버튼 → 랜딩(`/kisa/code-drill`), 설명 "전수 학습 · 이어하기 · SRS".

## §4. 이어하기 동작 원리

- 진도 baseline = DB `kisa_diagnosis_attempts` 의 distinct 시도 문항수(범위 필터 적용). 세션 로컬 상태가 아니라 **서버 진실**에 근거 → 어느 기기·언제 접속해도 동일 진도.
- 세션 내 중복 방지(`exclude_ids`)는 그대로. 재접속(새 세션)은 `exclude_ids` 초기화되지만 서버가 미시도 우선 서빙하므로 **이미 푼 문제는 뒤로** → 자연스러운 이어하기.
- 자가평가(self_grade)가 2번째 attempt를 만들어도 distinct 문항수 기준이라 진도 왜곡 없음.

## §5. 검증 / 후속

- `node --check`·`build:fe` 정상. progress 쿼리 실측(codeid 303, 7개 분류) 정상.
- DB 변경/시드 없음(codeid는 REBUILD69에서 적재).
- `full` 모드는 범용 파라미터라 다른 유형 드릴에도 확장 가능(현재는 codeid 랜딩만 사용).
- "처음부터(진도 초기화)"는 미제공 — 필요 시 범위별 attempts 삭제 엔드포인트 추가(오답노트·SRS 영향 주의).

## §6. 후속 — 문항 답안 순서 정상화

코드식별 문항의 답안 영역이 "② 안전/취약 → ① 보안약점" 순으로 나오던 것을 **"① 보안약점 → ② 안전/취약"** 순(번호 순서)으로 통일. 드릴(`CodeidCard.jsx`)·시험(`CodeidExamBody.jsx`)·빠른퀴즈(`CodeQuiz.jsx`) 3곳 모두 동일 적용. 라벨(①/②)·채점·데이터는 무변경, 렌더 순서만 조정.

## §7. 후속 — 랜딩 UI 개선 (`CodeDrillHome.jsx`)

- **분류 그룹 순서 정상화**: 알파벳순(API오용·코드오류…) → KISA 가이드 표준 순서(입력검증→보안기능→시간및상태→에러처리→코드오류→캡슐화→API오용→세션통제). 프론트에서 `CATEGORY_ORDER` 기준 정렬(백엔드/DB 무변경).
- **콤팩트 카드**: 그룹 카드가 "이름+% / 진행바 / 큰 버튼" 3줄 → **카드 전체 탭 가능한 2줄**(이름·진도·액션 라벨 한 줄 + 얇은 진행바)로 축소. 전체 카드·설명도 슬림화해 세로 점유 대폭 감소.
