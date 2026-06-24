# REBUILD58 — 자료 라이브러리 단원 그룹핑 + 학습자료에 2026 코드예시·설계기준 실습 탭

> **작성**: 2026-06-24 KST
> **트리거**: 사용자 요청 — ① 자료 라이브러리 모달의 2026 교재를 설계/구현 단계가 아닌 교재 단원으로 정리, ② 학습자료에 2026 교재 약점별 코드예시 추가, ③ 학습자료에 "설계기준 실습"(practice 13개) 탭 추가.
> **결과**: 세 가지 모두 **DB/API 무변경**(번들 직참조)으로 구현·배포. [[REBUILD56]](라이브러리화)·[[REBUILD57]](진단방법 문항)의 자산을 학습자료 UI에 통합.

---

## §0. 결론 요약

| 작업 | 파일 | 결과 |
|------|------|------|
| 자료 라이브러리 단원 그룹핑 | `scripts/build-kisa-library.mjs` | kisec2026을 Ⅰ~Ⅵ단원으로(설계/구현단계 라벨 제거) |
| 학습자료 2026 코드예시 | `src/tabs/KisaTab/StudyDetail.jsx` | "📘 2026 교재 코드예시" 섹션(148개) |
| 설계기준 실습 탭 | `Study.jsx`, `PracticeDetail.jsx`, `MarkdownLite.jsx`, `scripts/build-kisa-practice.mjs` | practice 13개 학습 탭 |

커밋: `6389398`(단원 그룹핑), `a493b1c`(학습자료 통합). 배포: Cloud Run `v20260624-152214` SUCCESS.

---

## §1. 자료 라이브러리 단원 그룹핑 (커밋 6389398)

**문제**: `LibraryFab` 모달의 kisec2026 자료원에서 약점카드가 `g1='설계단계'`(DSG 20)·`'구현단계'`(IMP 49)로 묶여, 교재 목차와 어긋남.

**수정**: `build-kisa-library.mjs`의 kisec2026 매핑 후처리 — 약점카드의 `g1`/`unit`/`order`를 교재 단원으로 재설정.
- `DSG → Ⅳ단원`(분석·설계), `IMP → Ⅴ단원`(구현). 이론카드(K26)는 mapCourse가 이미 Ⅰ~Ⅵ단원 부여.
- `order = UNIT_ORDER[unit]*100000 + (기존 order % 100000)` 로 단원 우선 정렬, 단원 내 분류·번호 보존.
- 결과: Ⅰ(5)·Ⅱ(2)·Ⅲ(3)·Ⅳ(21)·Ⅴ(49)·Ⅵ(1). 다른 자료원(library/course)은 무영향.

## §2. 학습자료 2026 코드예시 (커밋 a493b1c, 작업 A)

**배경**: 학습자료(`/kisa/study/:code`) 코드예시는 `kisa-study` API가 `diagnosis4` 문항(DB)에서만 추출(약점당 ~3개). `library-kisec2026` IMP 약점에는 2026 교재 코드예시 148개(`codeExamples:[{lang,vulnerable,safe,note}]`)가 별도로 있으나 미노출.

**수정**: `StudyDetail.jsx` — `src/data/kisa-library.json`을 import해 `chapterCode`로 kisec2026 항목 매칭, `codeExamples`를 **"📘 2026 교재 코드예시"** 섹션(별도 아코디언 `open2026`)으로 렌더. 기존 `CodeBlock` 재사용(lang은 `"Java (JDBC)"`→`java` 정제). **DB/API 무변경** — 번들 직참조.

## §3. 설계기준 실습 탭 (커밋 a493b1c, 작업 B)

**목표**: `library-kisec2026/practice/`의 실습 13개(REBUILD57에서 작성한 양식 md)를 학습자료에서 학습.

- **번들**: `scripts/build-kisa-practice.mjs`(신규) — practice/*.md(README 제외) → `src/data/kisa-practice.json` `[{id,num,title,source,type,body}]`. `package.json`에 `build:practice` 추가. (Dockerfile은 src/만 COPY → 번들을 git 포함)
- **렌더러**: `src/components/MarkdownLite.jsx`(신규) — 의존성 0 경량 마크다운(헤더·인용·GFM표·리스트·볼드·코드블록). practice md가 표 위주라 풀 파서 불필요.
- **탭**: `Study.jsx` — `📐 설계단계 · 📋 설계기준 실습 · 🔧 구현단계` 3탭. practice 탭은 API 대신 번들 JSON을 표준형(7)/변형형(6)으로 렌더. `?tab=practice`로 탭 복원.
- **상세**: `PracticeDetail.jsx`(신규) + `index.jsx` 라우트 `practice/:id`.

## §4. 검증

- 빌드: `build:lib`(223개) + `build:practice`(13개) + `build:fe`(에러 0) ✅
- MarkdownLite 파서: practice md 표·헤더·인용·리스트 정상 인식(노드 정규식 검증) ✅
- 단원 그룹핑: `설계단계`/`구현단계` 라벨 잔존 0, Ⅰ~Ⅵ 정렬 ✅
- 배포 후 운영 `/kisa/study` 반영.

## §5. 설계 노트
- **번들 직참조 선택 이유**: 코드예시·실습은 정적 데이터라 DB 적재·API 확장보다 `src/data/*.json` 번들이 단순·무위험. `kisa-library.json`(REBUILD45 패턴)과 동일.
- **의존성 0 렌더러**: react-markdown 도입 대신 ~110줄 경량 파서로 앱 톤(Tailwind 카드) 통일 + 번들 경량 유지.

## §6. 남은 작업
- Dashboard에 진단방법 출제 진입/필터, 구현단계(IMP) 진단방법 문항 확장, 예상문제 배치 생성→적재.
