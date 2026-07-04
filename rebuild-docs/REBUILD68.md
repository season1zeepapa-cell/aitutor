# REBUILD68 — 코드식별 퀴즈(코드로 약점·안전여부 맞히기) 신규 유형 전수 생성

> **작성**: 2026-07-02 KST
> **범위**: `scripts/build-kisa-codebank.mjs`(신규), `scripts/build-kisa-code-quiz.mjs`(신규), `src/data/kisa-codebank.json`(신규), `src/data/kisa-code-quiz.json`(신규), `src/tabs/KisaTab/CodeQuiz.jsx`(신규), `src/tabs/KisaTab/index.jsx`, `src/tabs/KisaTab/Dashboard.jsx`, `src/tabs/KisaTab/Study.jsx`, `package.json`
> **목적**: KISA 진단원 이수시험 문제풀에 **새 문제유형**을 추가한다 — 코드예시를 보여주고 ① 49개 구현단계 보안약점 중 무엇인지(4지선다) ② 안전한 코드인지 취약한 코드인지(2지) 두 가지를 맞힌다. 3개 가이드 PDF의 코드예시를 **전수 문제화**하고, 해설은 라이브러리 내용 조합으로 생성한다.

---

## §1. 배경 / 요구사항

- 요청: `KISEC 2026 기본과정`·`소프트웨어 개발보안 가이드(2021.12.29)`·`소프트웨어 진단가이드(2021)` 세 PDF의 **모든 코드예시**로, 코드→(약점 49지 + 안전/취약) 맞히기 문제를 **전수 생성**. 지식라이브러리 먼저 생성 → 문제 생성 → Claude가 해설.
- **핵심 사실**: 이 코드예시들은 이미 `src/data/kisa-library.json`에 자료원별로 구조화돼 있다(`codeExamples:[{lang,vulnerable,safe,note}]`). 즉 신규 PDF 추출이 아니라 **기존 추출 데이터의 재활용 + 문제화**다.
  - `library`(개발보안·진단가이드 2021) = 49 IMP 항목 · 137 코드예시
  - `kisec2026`(2026 교재) = 49 IMP 항목 · 148 코드예시 (id 체계 IMP-* 동일)
  - `jssec2023`(JS 가이드)·`course`(코드 0)는 대상 아님 → 제외.
- 결정(사용자): **클라이언트 전용 퀴즈**(DiagramQuiz 방식, DB/API/마이그레이션 무변경) + **해설은 라이브러리 내용 조합**(Claude 작성 템플릿).

## §2. 데이터 파이프라인 (원천 → 코드뱅크 → 문제)

정본/파생 분리 원칙(REBUILD45~) 유지. 두 빌드 스크립트 모두 산출 JSON을 git 커밋(Dockerfile은 `src/`만 COPY).

### §2.1 코드뱅크 — `build-kisa-codebank.mjs` → `src/data/kisa-codebank.json`
- 입력: `src/data/kisa-library.json`의 `library` + `kisec2026` 자료원.
- 정본 49개 약점 = `library` 자료원 중 `g1==='구현단계'` (검증됨).
- 각 `codeExample`을 **취약 코드 / 안전 코드 2개 엔트리로 분해**. `"......"` 류 placeholder는 배제(`isRealCode`).
- **전역 중복 제거**(정규화 코드 기준): `kisec2026` 코드예시 대부분이 `library`와 동일(2021 가이드 코드 재수록) → **249개 중복 제거**.
- 산출: **303개 엔트리** (취약 150 / 안전 153). 자료원별 library 266, kisec2026 고유 37.

### §2.2 문제 + 해설 — `build-kisa-code-quiz.mjs` → `src/data/kisa-code-quiz.json`
- 코드뱅크 엔트리마다 문제 1개:
  - 정답: `answerWeaknessId`(IMP-XX) + `answerIsSafe`(bool).
  - 보기(약점 4지선다): 정답 + **같은 분류 우선 오답 3개**. 결정적 seeded 셔플(Math.random 미사용 → 빌드 재현성, git diff 안정).
  - **해설(조합 생성)**: `정답 판정 + 판별 포인트(안전/취약 근거) + 코드별 note + 약점 개요(summary) + 보안 대책(detail 보안대책) + 분류·출처·CWE`. 라이브러리 실제 내용을 조합해 문항별 구체·정확.
- 산출: **303문제** (취약 150 / 안전 153). 분류 분포: 입력검증 123 · 보안기능 96 · 코드오류 26 · 캡슐화 24 · API오용 14 · 에러처리 12 · 시간및상태 8.
- npm: `build:codebank`, `build:code-quiz`(코드뱅크+퀴즈 연속).

## §3. UI — `CodeQuiz.jsx` (`/kisa/code-quiz`)

- **클라이언트 전용**(DiagramQuiz 패턴): `kisa-code-quiz.json` 직참조, 로컬 채점, DB/API/registry/마이그레이션 무변경.
- 흐름: **설정(분류·문항수 선택) → 풀이 → 결과**.
  - 코드는 `CodeBlock`(prismjs 하이라이팅)로 렌더. `lang` 문자열("Java (JDBC)" 등)→언어토큰 매핑(`langToken`, javascript를 java보다 먼저 판정).
  - 2단 정답: ② 안전/취약(2지) + ① 약점(4지). **둘 다 선택해야 제출** 활성, **둘 다 맞아야 정답 처리**(점수).
  - 채점 후 해설은 `MarkdownLite`로 렌더 + "이 약점 이론 학습(2026 교재)" 링크(`/kisa/theory/:IMP-id`).
- 배선: `index.jsx`(lazy import + `<Route path="code-quiz">`), `Dashboard.jsx`(💻 코드 약점퀴즈 StartButton), `Study.jsx`(그림/코드 퀴즈 2버튼 그리드).

## §4. 검증

- 데이터 무결성 전수 검사: 303문제 전부 보기 4개·정답이 보기에 포함·보기 중복 0·정답 타입 정상 → **통과**.
- `npm run build:fe` 정상. `CodeQuiz` 청크 lazy-load 분리 확인.
- 코드뱅크/퀴즈 재생성 idempotent(seeded 정렬 → 동일 입력 동일 출력).

## §5. 제약 / 후속

- 클라이언트 전용이라 **SRS 복습큐·오답노트·이수시험 모드에는 미편입**(요구사항대로). 향후 정규 문항(층위 A: `kisa_questions.question_type` + registry + scorer + migration)으로 승격 시 편입 가능.
- `kisec2026`는 대부분 `library`와 동일 코드라 고유 기여 37개. 2026 교재 고유 코드가 늘면 재빌드로 자동 반영.
- 세 번째 PDF(진단가이드 2021 원본)는 디스크에 없으나 그 내용은 `library` 자료원에 이미 반영돼 있음.
- 해설은 "라이브러리 조합" 방식 — 특정 약점의 심층 수제 해설이 필요하면 `build-kisa-code-quiz.mjs`의 `buildExplanation`에 약점별 보강 텍스트를 얹어 재생성.
