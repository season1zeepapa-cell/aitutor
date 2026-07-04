# KISA 지식 라이브러리 — 생애주기 감사 & 정형화 제안

> **작성**: 2026-06-28 KST
> **목적**: aitutor에 산재된 지식 라이브러리 **추출→저장→관리→조회→활용** 워크플로우를 코드베이스 기준으로 케이스별 정리하고, 전체 폴더/파일의 활용·미활용을 판정하여 정형화·최적화 방향을 제안한다.
> **범위**: 지식 라이브러리(약점/교재/실습 데이터)에 한정. 기출문제(pool/exams/questions DB)는 별도 도메인으로 경계만 표시.
> **성격**: 분석·설계 문서. 실제 코드 변경은 후속(별도 승인).

---

## §0. 한눈 요약

- 지식 라이브러리 데이터는 **3개 저장소**에 분산: `kisa-module/`(소스 JSON, git) → `src/data/*.json`(번들, 빌드산출) → Supabase DB(운영). + 이미지 `public/q-images/`.
- **추출 방식이 5가지로 산재**(워크플로우·Vision·크롭·수동·이미지직접)되어 매번 비표준.
- 자료원 4종(`library`/`course`/`kisec2026`/`jssec2023`)의 **스키마가 제각각**이고, **활용도 편차가 큼**(kisec2026 최다 활용, course는 검색 전용).
- **死파일/미활용**: `_extract/full.txt`(빌드 미참조 잔재), `migrations/*.sql`(일회성 이력), `seed/` 일부(DB 미적재 추정), `extract-diagram-images.mjs`(방향전환 미사용).
- 핵심 개선: ① 추출 표준화(플레이북/도구) ② 소스·산출·DB 3계층 명확화 ③ 자료원 스키마 통일 ④ 死파일 정리 ⑤ npm 명령 정형화.

---

## §1. 생애주기 개요

```
[추출 Extract]   PDF/교재 → JSON/MD/이미지         (5가지 방식 산재)
      │
      ▼
[저장 Store]     kisa-module/*(소스,git) · public/q-images/*(이미지)
      │
      ▼
[관리 Manage]    build:lib / build:practice → src/data/*.json(번들)
                 kisa-*-import → Supabase DB        (수동 CLI)
      │
      ▼
[조회 Query]     앱: 번들 import(static) · API: DB read
      │
      ▼
[활용 Use]       KisaTab 화면들 + LibraryFab/모달    (자료원별 노출 편차)
```

---

## §2. 케이스별 정리

### 2.1 추출 (Extract) — 5가지 방식 산재 ⚠️

| 케이스 | 방식 | 도구/위치 | 산출 | 표준화 | 비고 |
|---|---|---|---|---|---|
| **E1 워크플로우 추출** | PDF `pdftotext` → 멀티에이전트 → JSON | `jssec-extract`·`kisec-theory-boxes`(일회성 워크플로우 스크립트) | library-jssec2023, kisec2026 theory | ❌ 매번 수기 작성 | jssec 42개·이론 49개가 이 방식 |
| **E2 Vision 추출** | HWP/PDF/이미지 → Gemini Vision → 구조화 | `pool-import.js`·`pool-import-v2.js`·`pool-repatch.js` | (기출 questions DB) | △ CLI | **기출 전용** — 라이브러리 아님(경계) |
| **E3 다이어그램 크롭** | PDF `pdftoppm` bbox 크롭 → PNG | `scripts/extract-diagram-images.mjs` | (없음) | ❌ MAPPINGS 수기좌표 | **방향전환으로 미사용**(아래 §3) |
| **E4 수동 작성** | 사람이 직접 JSON 작성 | `kisa-module/chapters/*`, `explanations/*` | chapters 3, explanations 5 | ❌ 수작업 | DB 학습자료/해설 |
| **E5 이미지 직접 제공** | 사용자가 약점명.png 투입 → 빌드가 ASCII 사본 | `build-kisa-library.mjs` `asciiCopy()` | q-images ASCII | ✅ 자동매칭(NFC) | 진단방법·다이어그램 |

**문제**: 같은 "약점 추출"인데 E1(워크플로우)·E4(수동)이 혼재. 새 교재마다 워크플로우를 새로 짜야 함.

### 2.2 저장 (Store) — 3계층 + 이미지

| 계층 | 위치 | 내용 | git | 성격 |
|---|---|---|---|---|
| **소스(Master)** | `kisa-module/` | 자료원 JSON·교재 md | ✅ | 기준 데이터 |
| **번들(Derived)** | `src/data/kisa-library.json`(1.2MB), `kisa-practice.json`(95KB) | 빌드 산출 합본 | ✅ | 재생성 가능 |
| **운영 DB** | Supabase `kisa_chapters`·`kisa_questions` | 학습자료·문항 | — | 런타임 |
| **이미지** | `public/q-images/{library,diagnosis}` | 한글원본+ASCII 사본 | ✅ | 한글=소스, ASCII=산출 |

### 2.3 관리 (Manage) — 빌드·임포트 스크립트

| 스크립트 | 입력 | 출력 | npm | 표준화 |
|---|---|---|---|---|
| `build-kisa-library.mjs` | library+course+kisec2026+jssec2023 | kisa-library.json | `build:lib` ✅ | ✅ |
| `build-kisa-practice.mjs` | kisec2026/practice/*.md | kisa-practice.json | `build:practice` ✅ | ✅ |
| `kisa-chapters-import.js` | chapters/*.json | DB kisa_chapters | ❌ 수동 CLI | △ |
| `kisa-explanations-import.js` | explanations/*.json | DB kisa_questions.explanation | ❌ 수동 CLI | △ |
| `kisa-seed-import.js` | seed/**/*.json | DB kisa_questions | ❌ 수동 CLI | △ |
| `kisa-validate.js` | seed | 검증 로그 | ❌ 수동 | △ |
| `migrations/*.sql` | — | DB 스키마 | ❌ 수동 1회 | 이력 |

### 2.4 조회 (Query) — 번들(static) vs DB(API)

- **번들 직참조**(API 불필요): `LibraryFab`, `QuestionLibraryModal`, `TheoryList/Detail`, `DiagramQuiz`, `Study`, `PracticeDetail`, `StudyDetail`(일부)
- **DB(API)**: `StudyDetail`(kisa-study)·드릴·시험모드 → `kisa_chapters`/`kisa_questions`
- **혼합**: `StudyDetail`은 번들(kisec2026 codeExamples/image) + API(DB chapter) 둘 다

### 2.5 활용 (Use) — 자료원별 UI 노출

| 자료원 | 개수 | 검색(LibraryFab/모달) | 전용 화면 | 활용도 |
|---|---|---|---|---|
| **kisec2026** | 81 | ✅ | 이론교육(TheoryList/Detail)+학습상세 | ⭐⭐⭐ 최다 |
| **jssec2023** | 42 | ✅ | 그림퀴즈(DiagramQuiz) image/typeImages | ⭐⭐ |
| **library** | 69 | ✅ | ❌ 전용 상세 없음(검색만) | ⭐⭐ |
| **course** | 73 | ✅ (relatedLibrary로 약점 점프) | ❌ 전용 상세 없음 | ⭐ |
| **practice**(kisec2026) | 13 | — | 설계기준 실습(PracticeDetail) | ⭐ |

---

## §3. 전체 폴더/파일 인벤토리 — 활용 판정

### kisa-module/

| 폴더 | 규모 | 소비처 | 판정 |
|---|---|---|---|
| `library/` | json 69 + md 69 (1.1M) | build:lib·build:practice → 번들 `library` 자료원(검색) | 🟢 활용(단 md 69 용도 확인필요) |
| `library-kisec2026/` | json 81 + md 15 (1.8M) | build:lib·practice → 번들 + 실습 | 🟢 활용(최다) |
| `library-jssec2023/` | json 42 (244K) | build:lib → 번들 `jssec2023` | 🟢 활용 |
| `course/` | json 73 + md 73 (936K) | build:lib → 번들 `course`(검색만) | 🟡 부분(상세 화면 없음, md 용도 불명) |
| `chapters/` | json 3 (72K) | kisa-chapters-import → DB | 🟢 활용(DB) |
| `explanations/` | json 5 (60K) | kisa-explanations-import → DB | 🟢 활용(DB) |
| `seed/` | json 106 (2.7M) | kisa-seed-import → DB | 🟡 **부분**(적재 현황 점검 필요, design-method 미적재 이력) |
| `migrations/` | sql 8 (44K) | 코드 참조 0, 수동 1회 적용 | ⚪ 이력(보존) |
| `library-kisec2026/_extract/` | full.txt | build가 .json만 읽어 **미참조** | 🔴 死(잔재) |

### 산출물·이미지

| 대상 | 판정 |
|---|---|
| `src/data/kisa-library.json`·`kisa-practice.json` | 🟢 활용(번들, 8개 컴포넌트 import) |
| `public/q-images/{library,diagnosis}` 한글 원본 | 🟡 소스(빌드 입력) — 서빙엔 미사용 |
| `public/q-images/{library,diagnosis}` ASCII 사본 | 🟢 활용(실제 서빙) |
| `scripts/extract-diagram-images.mjs` | 🔴 미사용(방향전환, npm 미등록, 산출물 없음) |

### 번들 필드 활용 (정정 포함)

| 필드 | 판정 | 사용처 |
|---|---|---|
| id·title·source·category·summary·keywords·detail | 🟢 | LibraryFab·모달 |
| codeExamples·diagnosisCode | 🟢 | 라이브러리 패널·StudyDetail |
| theory·design | 🟢 | TheoryDetail(kisec2026) |
| image·typeImages | 🟢 | DiagramQuiz·StudyDetail |
| **diagnosisImage** | 🟢 **활용**(TheoryDetail 진단방법) — *에이전트 "orphan" 오판 정정* |
| g1·g2·order·unit | 🟡 | 정렬·그룹핑(LibraryFab 아코디언) — 화면 텍스트 미렌더 |

---

## §4. 산재로 인한 문제점

1. **추출 비표준(E1·E4 혼재)**: 약점 본문이 워크플로우(jssec/이론)와 수동(chapters/explanations)으로 갈려, 같은 약점이 자료원마다 다른 절차로 생성됨.
2. **자료원 스키마 불일치**: `library`(overview/diagnosis/code_examples) vs `kisec2026`(+theory/design/cwe) vs `course`(unit/sections/related_library) vs `jssec2023`(applies_to/type_images). 필드명·구조 제각각 → build-kisa-library가 자료원별 분기 누적.
3. **library/course 전용 화면 부재**: 번들·검색엔 있으나 상세 학습 경로 없음 → 142개 항목이 "검색하면 나오지만 학습 못 함" 상태.
4. **死/잔재 파일**: `_extract/full.txt`, `extract-diagram-images.mjs`, `migrations`(이력) — 신규 작업자에게 혼란.
5. **DB 적재 현황 불투명**: seed 106개 중 실제 DB 반영분 추적 어려움(import 수동·로그 미보존). design-method 미적재 이력.
6. **소스/산출 혼재**: q-images에 한글 원본(소스)과 ASCII 사본(산출)이 같은 폴더에 섞임.
7. **md 용도 불명**: library/course의 md 73·69개가 번들(json만 사용)에 안 들어감 — 참고용인지 死인지 불명확.

---

## §5. 개선 방향 (정형화·최적화)

### 5.1 저장 3계층 명확화
- **소스**(`kisa-module/`, 손수정 대상) / **산출**(번들·ASCII이미지, 빌드 재생성, `.gitignore` 후보 검토) / **DB**(운영) 경계를 문서·폴더로 못박기.
- q-images: 한글 원본을 `kisa-module/_assets/`(소스)로 이동, `public/q-images/`엔 ASCII 산출만 → 소스/산출 분리.

### 5.2 추출 표준화
- **추출 플레이북 1개**(`LIBRARY-PLAYBOOK.md`): "새 교재 라이브러리화" 표준 절차 + 워크플로우 프롬프트 템플릿(원인/영향/대응/코드예제 스키마 고정).
- E3(extract-diagram-images) 死코드 → `scripts/_archive/` 이동 또는 제거.
- (선택) 추출 엔진은 신규 `docpipe`/기존 `docstore`로 위임 검토 — 단 현 단계는 aitutor 내 표준 절차로 충분.

### 5.3 자료원 스키마 통일
- 4개 자료원 공통 코어 스키마 정의(`chapter_code·title·stage·category·source·overview·impact·countermeasure·code_examples·diagnosis`) + 자료원별 확장 필드 명시. build-kisa-library의 분기 단순화.

### 5.4 활용 공백 메우기 / 死파일 정리
- `library`·`course`에 전용 학습 경로를 줄지, 아니면 "검색 전용"으로 공식화할지 결정.
- `_extract/full.txt` 제거, `migrations`는 `kisa-module/migrations/`에 이력으로 유지하되 README로 적용현황 기록.
- library/course의 md 용도 판정 → 死면 제거, 참고면 위치 명시.

### 5.5 명령·검증 정형화
- npm 추가: `kisa:build`(lib+practice), `kisa:validate`, `kisa:import:*`, `kisa:check`(검증+빌드). 흩어진 단계를 한 줄로.
- DB 적재 후 카운트 로그 보존(어느 seed가 몇 개 들어갔는지) → 적재 현황 추적.

### 5.6 우선순위(무위험 → 변경)
1. **무위험**: §5.5 npm 명령 + §5.4 死파일 아카이브 + 본 감사문서/플레이북 작성
2. **저위험**: seed 적재 현황 점검·로그, md 용도 판정
3. **변경 검증 필요**: §5.1 q-images 소스/산출 분리, §5.3 스키마 통일(번들 동일성 검증 필수)

---

## §6. 다음 액션 (제안)
- 본 문서 검토 후, §5.6 1단계(무위험)부터 착수 여부 결정.
- `library`/`course` 활용 정책(전용화면 vs 검색전용) 사용자 결정 필요.
- 추출 표준은 aitutor 내 플레이북으로 1차, 엔진 통합(docpipe/docstore)은 별도 트랙.
