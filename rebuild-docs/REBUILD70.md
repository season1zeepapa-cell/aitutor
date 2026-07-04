# REBUILD70 — 이수시험 모드에 codeid 편입

> **작성**: 2026-07-02 KST
> **범위**: `api/kisa-exam.js`, `src/tabs/KisaTab/KisaExamMode.jsx`
> **목적**: REBUILD69로 정규 문항이 된 `codeid`(코드식별)를 **이수시험 모의고사 모드**에 편입한다.

---

## §1. 배경
REBUILD69에서 codeid는 드릴·SRS·오답노트에 편입됐다. 남은 것은 실전 모의고사(`/kisa/exam`). 이수시험 모드는 mcq+blank(이론) / diagnosis4+composite(실기)를 샘플링해 채점한다.

## §2. 설계 — codeid = 실기(practical) 영역
codeid는 코드 기반 문제이므로 **실기 영역**에 편입한다. 채점 합산(`kisa-exam.js` submit)이 `if mcq||blank → theory else → practical` 구조라 **codeid는 자동으로 실기 점수에 합산**된다(코드 무변경).

## §3. 변경 내용
- **`kisa-exam.js`**
  - `EXAM_CONFIG`에 `codeid` 배정: theory60=0(순수 이론 유지), **practical100=5**, **full3h=5**.
  - `sampleQuestions()`에 codeid 랜덤 샘플링 블록 추가.
  - 요청 문항수 합계에 `cfg.codeid` 포함(부족 시 503 가드).
  - 세션 문항 조회(`action=session`)는 이미 `choices`·`vulnerable_code`·`code_language`를 SELECT(정답 숨김) → 무변경.
  - 채점(`action=submit`)은 `scoreAttempt`가 codeid 처리 + else→practical 합산 → 무변경.
- **`KisaExamMode.jsx`**
  - practical100: 문항수 15→**20**, 설명 "진단 13 + 복합 2 + 코드식별 5".
  - full3h: 문항수 45→**50**, 설명 "이론 30 + 실기 20".
  - 렌더는 registry 기반(`ExamBody`/`hasAnswer`)이라 codeid `CodeidExamBody`가 자동 사용 → 컴포넌트 무변경.

## §4. 검증
- codeid 가용 303(필요 5) — 샘플링 충분.
- codeid → 실기 영역 합산 확인, 정답 응시 100점.
- `node --check` OK, `build:fe` 정상. DB 변경/시드 없음(REBUILD69에서 적재 완료).

## §5. 참고
- theory60(이론 전용)은 codeid 미포함 — codeid가 실기(practical) 점수로 합산되므로 이론 전용 모드에 넣으면 영역 구분이 어긋난다.
- 배정 문항수(5/5)는 조정 가능 — `EXAM_CONFIG` + `KisaExamMode.jsx` desc/count만 함께 수정.
