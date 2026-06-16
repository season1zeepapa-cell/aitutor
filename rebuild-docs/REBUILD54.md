# REBUILD54 — KISA 문제풀 QA 검증 + 양식(composite) 확대 + 문제↔라이브러리 연동 모달

> **작성**: 2026-06-16 KST
> **트리거**: 사용자 요청(텔레그램) — ① 붙임2 예시 재검토 후 생성 문제 검증·보완·정답 재검증·해설 보완 ② 요구사항 양식/보고서 양식(복합서술형) 문제 추가 ③ 문제 풀이 중 "지식 라이브러리" 버튼으로 해당 문제 관련 지식을 모달 조회
> **전제**: REBUILD53(v3 501문항 완전 재구축) 완료 상태에서 출발
> **결과**: 운영 active 문항 501 → **509**(composite 20→28), QA 수정 ~8건 반영, 프론트 라이브러리 연동 모달 신규

---

## §0. 결론 요약

| 작업 | 산출물 | 결과 |
|------|--------|------|
| QA 검증 | 전 69챕터 붙임2 대조 전수 점검 | 수정 ~8건, 재import |
| composite 확대(요청 a) | IMP 핵심 8챕터에 복합서술형 추가 | composite 20→28, active 509 |
| 문제↔라이브러리 모달(요청 b) | QuestionLibraryModal + 풀이화면 버튼 | 빌드 통과 |
| 운영 적용 | UPSERT 재import + 중복 정리 | active 509 / 중복 0 |

---

## §1. QA 검증 (붙임2 재대조, 전 69챕터)

REBUILD53에서 생성한 501문항을 붙임2 출제형태 및 원천 라이브러리와 다시 대조해 전수 점검. 발견·수정한 항목:

| 챕터 | 수정 내용 |
|------|-----------|
| DSG-IV-10 | 스마트쿼트(’) → 일반 따옴표 정규화 |
| DSG-EH-01 | 키릴문자 'и'→IOException 정정, 단정문 보정, vulnerable_lines `[0]`→`[]`(오탐) |
| IMP-IV-16-M3 | 발문-정답 모순 수정 |
| IMP-SF-10 | blank(B2) 동의어 보강 |
| IMP-SF-15 | D2 language `swift`→`etc` 정정 |
| IMP-AA-01 | B2 해설 보완 |

- **재import 시 중복 발생 처리**: UPSERT 키(weakness_code+language+difficulty)에서 language를 바꾼 2건(IMP-SF-15-D2, IMP-SF-16-D1)은 구(舊) language 행이 폐기되지 않고 남아 active가 503으로 증가. 구 행(swift/java)을 `is_active=false`로 폐기해 **active 501 / 중복 0** 복구.

## §2. 요구사항/보고서 양식 문제 확대 (요청 a — composite)

붙임2 "복합서술형"(요구사항정의서·아키텍처설계서·개발가이드 산출물 검토 → 진단보고서 작성) 문제를 IMP(구현) 단계로 확장. 기존 composite 20개는 모두 DSG(설계)에만 존재 → **IMP 핵심 8챕터에 추가**.

| 신규 weakness_code | 약점 | 진단 구조(rubric 합 8점) |
|---|---|---|
| IMP-IV-01-C1 | SQL 삽입 | 동적쿼리 결합 / ORDER BY 화이트리스트 / 가이드 필터링 규칙 |
| IMP-IV-03-C1 | 경로 조작 | 경로순회 문자 / 매핑표·화이트리스트 / 가이드 규칙 |
| IMP-IV-04-C1 | XSS | Stored 미인코딩 / c:out 적합(오탐 함정) / 가이드 규칙 |
| IMP-IV-05-C1 | OS 명령어 삽입 | 멀티라인 특수문자 / 리다이렉트 특수문자 / 가이드 규칙 |
| IMP-IV-06-C1 | 위험한 형식 파일 업로드 | 블랙리스트 방식 / 대소문자 미구분 / 가이드 규칙 |
| IMP-SF-02-C1 | 부적절한 인가 | 요구사항 적합 / 삭제권한 누락 / 클라이언트측 의존 |
| IMP-SF-05-C1 | 암호화되지 않은 중요정보 | 솔트+SHA-256 적합(오탐) / 평문전송 결함 |
| IMP-SF-06-C1 | 중요정보 하드코딩 | 외부복호화 적합(오탐) / 암호화 키 하드코딩 |

- 산출물 3종: **보안요구사항명세서 · 개발가이드 · 개발산출물(취약 소스코드)**. "일부 충족·일부 결함" 구성으로 정탐/오탐 판정을 함께 평가.
- 원천: 각 챕터 `library/IMP-*.json`의 `overview`·`countermeasure`·`code_examples`·`diagnosis`. 지어내기 없음.
- report_template: `{sections:[진단항목, 판정, 현황 및 문제점, 개선방안]}` (기존 양식 통일).

## §3. 문제↔라이브러리 연동 모달 (요청 b)

문제 풀이 중 해당 문제의 보안약점에 대한 지식 라이브러리를 즉시 조회.

- 신규 `src/components/QuestionLibraryModal.jsx`: props `{chapterCode, onClose}`. `src/data/kisa-library.json`에서 `source==='library' && id===chapterCode` 항목을 찾아 **바텀시트 모달**로 표시(제목/분류·CWE → 요약 → 상세 → 취약·안전 코드 → 키워드). 매칭 없으면 "연관 지식 자료 없음".
- `src/components/LibraryFab.jsx`: 코드 렌더(`CodeSection`/`CodeBlock`/`guessLang`)를 `export`로 전환 → 모달에서 재사용(중복 구현 제거).
- 버튼 추가: `DrillSession.jsx`(문제 배지 줄에 "📚 관련 지식", `question.chapter_code` 있을 때만), `StudyDetail.jsx`(헤더에 "📚 관련 지식 보기").

## §4. 운영 적용 / 검증

| 항목 | 결과 |
|------|------|
| validate(전 69파일) | ✅ 에러 0 (경고 181 = 비차단 언어·난이도 조합 중복) |
| 유형 분포 | mcq207 · diagnosis138 · composite28 · blank136 = **509** |
| 운영 DB | ✅ active 509 / 중복 0 (composite 8 INSERT, QA 499 UPDATE, 구 행 2 폐기) |
| 프론트 빌드 | ✅ build:fe 통과 |
| 배포 | Cloud Run 재배포(aitutortwo-prod) |

## §5. 다음 단계
1. 앱 실전 QA: IMP composite 풀이·채점, 라이브러리 모달 매칭 정확도(특히 IMP 챕터 코드 ↔ library id)
2. composite를 나머지 IMP 챕터로 점진 확대(현재 입력검증·보안기능 핵심만)
3. 라이브러리 모달에서 course(교재) 연계 항목도 노출 검토

---

**완료 일시**: 2026-06-16 KST
**연관 문서**: REBUILD53(v3 재구축), `seed/v3/implementation/IMP-*-C1`, `migrations/005`
