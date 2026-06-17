# REBUILD55 — 드릴 문항 응답 보강(chapter_code/composite) + 복합서술형 드릴 진입

> **작성**: 2026-06-16 KST
> **트리거**: 사용자 피드백 — 풀이 중 "📚 관련 지식" 버튼이 안 뜸. 원인 추적 → 드릴 API 응답 누락 + composite 드릴 미노출 발견 후 보완.
> **결과**: 관련 지식 모달 정상 동작(운영 API 직접 검증), 복합서술형(composite)을 드릴에서 직접 연습 가능

---

## §0. 결론 요약

| 작업 | 파일 | 결과 |
|------|------|------|
| chapter_code 응답 노출 | `api/kisa-drill.js` | 관련 지식 버튼/모달 정상화 |
| composite 산출물 응답 노출 | `api/kisa-drill.js` | 드릴 composite 빈 화면 방지 |
| composite 드릴 허용 | `api/kisa-drill.js` ALLOWED_TYPES | `?type=composite` 출제 가능 |
| 복합서술형 진입 버튼 | `src/tabs/KisaTab/Dashboard.jsx` | 드릴에서 직접 연습 |

---

## §1. 증상 / 원인

- **증상**: 문제 풀이 화면에서 "📚 관련 지식" 버튼이 보이지 않음.
- **원인**: `api/kisa-drill.js`의 `publicQuestion` 화이트리스트에 **`chapter_code` 누락**. 프론트는 `{question.chapter_code && (...)}` 조건으로 버튼을 렌더하므로, 값이 항상 `undefined` → 버튼 미노출.
- **부수 발견**: composite 문항이 드릴에 나올 때 `artifacts`/`report_template`도 화이트리스트에 없어 빈 화면. 또한 `ALLOWED_TYPES`에 `composite`가 없어 `?type=composite` 필터가 무시됨(랜덤 시에만 간헐 출제) + Dashboard에 진입 버튼 없음 → 사실상 드릴에서 풀 수 없었음.

## §2. 수정

1. `publicQuestion`에 **`chapter_code`** 추가 → 관련 지식 모달이 해당 문제 자료를 매칭.
2. composite일 때 **`artifacts`/`report_template`** 노출(채점 기준 `rubric`은 컨닝 방지로 계속 숨김).
3. `ALLOWED_TYPES = ['mcq','diagnosis4','blank','composite']` — composite 필터 허용.
4. Dashboard에 **"복합서술형 드릴"** 버튼 추가 → `/kisa/drill?type=composite`.

## §3. 운영 검증 (실제 배포 API)

운영 토큰으로 배포 서버를 직접 호출해 응답 확인:

```
GET /api/kisa-drill?action=next
 → chapter_code: "DSG-SF-08" / "DSG-IV-07" / "IMP-IV-01"   ✓ (이전: undefined)
GET /api/kisa-drill?action=count → { total: 509 }            ✓
```

composite 풀이 경로(드릴):
`Dashboard 복합서술형 버튼 → drill ?type=composite → CompositeCard(artifacts/report_template) → onSubmit({report_text}) → kisa-attempt(scoreComposite, rubric_hits) → CompositeResult`. 전 구간 정상.

## §4. 영향 / 검증

| 항목 | 결과 |
|------|------|
| 관련 지식 버튼 | ✅ 운영 API chapter_code 반환 확인 |
| composite 드릴 | ✅ 출제·채점·결과 경로 정상 |
| api 구문 / build:fe | ✅ 통과 |
| 배포 | Cloud Run 재배포(aitutortwo-prod) |

## §5. 참고
- 시험 모드(`kisa-exam.js`)는 이전부터 `artifacts/report_template`을 SELECT하므로 영향 없음. 시험에는 라이브러리 버튼을 두지 않음(컨닝 방지).
- 드릴 인증은 정수형 `uid`(JWT payload). 검증 시 가짜 UUID는 타입 불일치로 500 → 실제 정수 uid로 정상 응답.

## §6. 관련 지식 모달 "검색·조회" 강화 (`QuestionLibraryModal.jsx`)

> 사용자 피드백 — 버튼을 누르면 현재 페이지(문제)에 **관련된 항목이 검색되어 조회**되어야 함.

- 기존: `chapter_code` 정확매칭 **1건**만 표시.
- 변경: 검색·목록형으로 재구성.
  1. **이 문제의 핵심 자료** — `chapter_code` 정확매칭 항목(펼친 상태, 상세+코드).
  2. **관련 지식** — 정확매칭 항목의 `keywords` 교집합(×2) + 같은 `category`(+1) 점수순 **상위 8건**을 접이식 목록으로 조회(진단가이드+교재 혼합).
  3. **검색창** — 제목·분류·id·키워드·요약 전체 검색(상위 30건). 입력 시 검색 결과 모드로 전환.
- props 변경 없음(`chapterCode`만으로 동작) → DrillSession/StudyDetail 수정 불필요.
- 코드 렌더는 `LibraryFab.CodeSection` 재사용 유지.

### §6.1 현재 문제 키워드로 조회 (키워드 칩)
> 사용자 피드백 — 버튼 클릭 시 **현재 페이지의 해당 키워드로 자료를 조회**.

- 검색창 아래에 **현재 문제 키워드 칩**을 노출(정확매칭 항목의 `keywords`). 예: SQL삽입 → `#sql #injection #dbms #input_validation #prepared-statement`.
- 칩을 탭하면 그 키워드로 전체 라이브러리 검색 결과를 조회(다시 탭하면 해제). 활성 칩은 강조.
- 키워드별 조회 예: `#injection` 18건 · `#input_validation` 27건 · `#dbms` 3건 등.

### §6.2 전역 플로팅 '자료 라이브러리'에 현재 주제 키워드 조회
> 사용자 피드백 — 우측 하단 플로팅 **자료 라이브러리(LibraryFab)**를 풀이/이론학습 중 누르면 현재 주제 키워드로 조회되어야 함. (배지형 '관련 지식'과 달리 LibraryFab은 전역이라 현재 주제를 몰랐음.)

- **경량 전역 store** 신규: `src/lib/currentChapter.js` — `setCurrentChapter`/`useCurrentChapter`(useSyncExternalStore, Provider 불필요).
- **현재 주제 등록**: `DrillSession`(풀이 문제 `question.chapter_code`)·`StudyDetail`(이론학습 `chapterCode`)이 마운트/문항변경 시 등록, 언마운트 시 해제.
- **LibraryFab 구독**: `useCurrentChapter`로 현재 주제 항목을 찾아, 드로어 검색창 아래에 **"지금 보는 주제 · <제목>" 키워드 칩**을 노출. 칩 탭 → `setQuery`로 기존 검색에 반영되어 조회(재탭 해제, 활성 강조).
- 시험 모드(KisaExamMode)는 현재 주제를 등록하지 않음 → 시험 중 LibraryFab은 전체 라이브러리만(컨닝 방지).

### §6.3 검색어 잔류 초기화
> 사용자 피드백 — 키워드로 조회한 뒤 모달을 닫았다 다시 열거나 다른 주제로 가도 이전 검색어(예: `xxe`)가 남음.

- LibraryFab은 전역으로 상시 마운트라 `query` state가 닫아도 유지됐음(배지형 모달은 언마운트되어 무관).
- 수정: ① **모달 열 때**(플로팅 버튼 onClick) `query`/펼침 초기화 ② **현재 주제 변경 시**(useEffect) 초기화 → 새 주제 기준으로 깨끗하게 시작.

---

**완료 일시**: 2026-06-16 KST
**연관 문서**: REBUILD54(QA·composite 확대·라이브러리 모달), `api/kisa-drill.js`, `Dashboard.jsx`
