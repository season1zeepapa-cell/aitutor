# REBUILD64 — 지식 라이브러리 산재 워크플로우 분석과 정형화 제안

> **작성**: 2026-06-28 KST  
> **범위**: `workspace/aitutor` 코드베이스 기준. KISA 지식 라이브러리, 문제 시드, 정적 자산, DB 학습/드릴, DocStore/Pool/Driver 계열 수집 흐름을 함께 조사했다.  
> **목적**: 여기저기 흩어진 "추출 → 저장 → 관리 → 조회 → 앱 활용" 흐름을 케이스별로 정리하고, AI TutorTwo 안에서 무엇을 유지하고 무엇을 별도 `docpipe`/문서 파이프라인으로 분리할지 기준을 세운다.

---

## §0. 결론 요약

현재 `aitutor`에는 지식 라이브러리 관련 흐름이 크게 네 갈래로 존재한다.

| 구분 | 현재 위치 | 현재 용도 | 앱 런타임 사용 | 판단 |
|---|---|---:|---:|---|
| KISA 정적 지식 라이브러리 | `kisa-module/library`, `course`, `library-kisec2026`, `library-jssec2023` → `src/data/kisa-library.json` | 자료 라이브러리, 이론교육, 그림퀴즈, 코드예시 | O | 핵심 유지 |
| KISA 설계기준 실습 | `kisa-module/library-kisec2026/practice/*.md` → `src/data/kisa-practice.json` | 실습 학습 탭 | O | 핵심 유지 |
| KISA DB 학습/드릴 | `kisa-module/chapters`, `seed`, `explanations` → `kisa_chapters`, `kisa_questions` | 학습 상세, 드릴, SRS, 채점 | O | 핵심 유지, 단 정적 라이브러리와 관계 명확화 필요 |
| 일반 문제 수집/이관 | `ImportTab`, `api/import-docstore.js`, `api/pool-upload.js`, `pool-*.js`, `driver-module` | 일반 기출문제 추출/등록 | 부분 O | KISA 지식 라이브러리와 분리 관리 |

가장 중요한 정리 원칙은 다음이다.

1. `kisa-module/*`는 원천/작업 자료다.
2. `src/data/*.json`은 앱 번들용 파생 산출물이다. 직접 수정 대상이 아니다.
3. `public/q-images/*`는 앱에서 실제 서빙되는 정적 자산이다.
4. `kisa_chapters`, `kisa_questions` DB는 문제 풀이/채점/SRS의 기준 데이터다.
5. 문서 PDF/HWP/HWPX의 일반 추출 파이프라인은 `aitutor` 안에 더 넣기보다 별도 `docpipe`에서 표준화하고, `aitutor`에는 검수 완료된 산출물만 반영하는 편이 맞다.

---

## §1. 현재 폴더/파일 현황

조사 시점 기준 주요 규모는 다음과 같다.

| 경로 | 크기/개수 | 성격 |
|---|---:|---|
| `kisa-module/` | 약 7.1MB, JSON 381개, MD 163개, TXT 1개 | KISA 지식/시드/문서화 원천 |
| `src/data/` | 약 1.2MB, JSON 2개 | 앱 번들용 파생 데이터 |
| `public/q-images/` | 약 57MB, 이미지 624개 | 앱 정적 이미지 자산 |
| `scripts/` | 약 924KB | 빌드/검증/DB 적재/보정 스크립트 |
| `kisa-pool/` | 약 200MB | PDF 원본 및 추출 이미지 보관소 성격 |
| `driver-module/` | 약 98MB | 운전면허 문제은행 1회성 수집/적재 패키지 |
| `pool/` | 0B | 현재 비어 있음 |

`kisa-module` 내부 JSON/MD 분포:

| 경로 | JSON | MD | 현재 역할 |
|---|---:|---:|---|
| `chapters/` | 3 | 0 | `kisa_chapters` DB 적재 원천 |
| `library/` | 69 | 69 | 2021 진단가이드 약점 항목 원천 |
| `course/` | 73 | 73 | 2025 양성과정 교재 카드 원천 |
| `library-kisec2026/` | 81 | 15 | 2026 기본과정 교재 카드 + 실습 MD |
| `library-jssec2023/` | 42 | 0 | JS 시큐어코딩 가이드 카드 원천 |
| `explanations/` | 5 | 0 | DB 문항 해설 보강 원천 |
| `seed/` | 107 | 0 | `kisa_questions` DB 문항 원천 |
| 루트 문서 | 2 | 6 | 사양/핸드오프/인덱스 |

`public/q-images` 이미지 분포:

| 하위 경로 | 파일 수 | 현재 역할 |
|---|---:|---|
| `public/q-images/` 루트 | 243 | 일반 기출/기존 문제 이미지 |
| `public/q-images/diagnosis/` | 137 | KISA 진단방법 이미지. 한글 원본 + ASCII 사본 혼재 |
| `public/q-images/library/` | 114 | KISA/JS 라이브러리 다이어그램. 한글 원본 + ASCII 사본 혼재 |
| `public/q-images/driver/` | 130 | 운전면허 문제은행 이미지 |

---

## §2. 핵심 런타임 데이터: `src/data`

현재 앱에서 직접 import하는 지식 라이브러리 번들은 두 개다.

| 파일 | 생성 스크립트 | 원천 | 앱 사용처 |
|---|---|---|---|
| `src/data/kisa-library.json` | `scripts/build-kisa-library.mjs` | `kisa-module/library`, `course`, `library-kisec2026`, `library-jssec2023`, `public/q-images` | `LibraryFab`, `QuestionLibraryModal`, `TheoryList`, `TheoryDetail`, `StudyDetail`, `DiagramQuiz` |
| `src/data/kisa-practice.json` | `scripts/build-kisa-practice.mjs` | `kisa-module/library-kisec2026/practice/*.md` | `Study`, `PracticeDetail` |

`kisa-library.json` 현재 구성:

| source id | label | 항목 수 | 주요 필드/특징 |
|---|---:|---:|---|
| `library` | 진단가이드 (보안약점) | 69 | `DSG-*`, `IMP-*`, 개요, 보안대책, 코드예시, 진단코드, 일부 이미지 |
| `course` | 양성과정 교재 | 73 | `COURSE-*`, 단원/연관 라이브러리 중심 |
| `kisec2026` | 2026 기본과정 교재 | 81 | `K26-*`, `DSG-*`, `IMP-*`, 이론교육, 설계 요구사항, 코드예시 |
| `jssec2023` | JS 시큐어코딩 가이드 | 42 | `JS-*`, JS 코드예시, JS 다이어그램, XSS 유형 이미지 |

세부 집계:

| source | image | diagnosisImage | theory | design | codeExamples | typeImages |
|---|---:|---:|---:|---:|---:|---:|
| `library` | 28 | 49 | 0 | 20 | 49 | 0 |
| `course` | 0 | 0 | 0 | 0 | 0 | 0 |
| `kisec2026` | 28 | 49 | 49 | 20 | 49 | 0 |
| `jssec2023` | 40 | 39 | 0 | 0 | 41 | 3 |

`kisa-practice.json` 현재 구성:

| 항목 | 수량 |
|---|---:|
| 전체 실습 | 13 |
| 표준형 | 7 |
| 변형형 | 6 |

중요한 운영 제약:

- `Dockerfile`의 프론트 빌더는 `src/`, `public/` 중심으로 빌드한다.
- `kisa-module/`은 앱 런타임 번들에 직접 의존하지 않는 원천 폴더다.
- 따라서 `build:lib`, `build:practice`를 통해 `src/data/*.json`을 생성하고 커밋하는 방식이 현재 설계다.
- 결론적으로 `src/data/*.json`은 "수정 대상"이 아니라 "생성 결과"로 봐야 한다.

---

## §3. 케이스 A — KISA 정적 지식 라이브러리 빌드 흐름

### 현재 흐름

```
kisa-module/library/*.json
kisa-module/course/*.json
kisa-module/library-kisec2026/*.json
kisa-module/library-jssec2023/*.json
public/q-images/library/*
public/q-images/diagnosis/*
        |
        v
scripts/build-kisa-library.mjs
        |
        v
src/data/kisa-library.json
        |
        v
앱: LibraryFab / QuestionLibraryModal / Theory* / StudyDetail / DiagramQuiz
```

### 현재 장점

- 자료원별 `sources[]` 구조가 이미 있다. 새 자료원 추가가 가능하다.
- `LibraryFab`는 `sources[]`를 순회하므로 새 source가 들어와도 기본 조회는 동작한다.
- `chapter_code` 기반으로 DB 문항과 정적 지식을 연결할 수 있다.
- 이미지 파일명 한글/NFD 문제를 REBUILD63에서 ASCII 사본으로 우회했다.

### 현재 취약점/정리 필요점

- `kisa-module` 내부의 `.json`과 `.md`가 모두 존재하지만 앱은 JSON만 빌드에 사용한다. MD는 사람 검수용/동반 문서인지, 생성 원천인지 역할이 문서화되어 있지 않다.
- `library`, `kisec2026`, `jssec2023`가 모두 약점 항목을 담고 있어 동일 `IMP-IV-01` 성격의 데이터가 여러 source에 중복 존재한다. 의도된 다중 출처지만, "대표 카드"와 "보조 출처" 기준이 없다.
- `build-kisa-library.mjs` 안에 자료원 매핑, 이미지 매칭, ASCII 사본 생성, 필드 정규화가 모두 들어 있다. 기능이 커져서 검증 리포트가 없으면 누락을 찾기 어렵다.
- 이미지 경로는 JSON 안에 `/q-images/...`로 들어가지만, 해당 이미지가 실제 존재하는지 별도 doctor가 없다.

### 정형화 제안

1. `kisa-module` 원천 파일에 `source_id`, `source_title`, `source_version`, `derived_from`, `review_status`를 명시한다.
2. `src/data/kisa-library.json`은 항상 생성물로 취급하고, 수동 수정 금지 규칙을 문서화한다.
3. `scripts/build-kisa-library.mjs` 실행 후 다음 검증을 자동 출력한다.
   - source별 항목 수
   - 중복 `id` 현황
   - 누락 이미지 수
   - `image`, `diagnosisImage`, `typeImages` 존재 파일 확인
   - 한글/NFD 파일명 원본과 ASCII 사본 매핑표
4. `kisa-module/source-manifest.json`을 추가해 자료원을 등록형으로 바꾼다.

예상 manifest:

```json
{
  "sources": [
    {
      "id": "kisa-2021-diagnosis",
      "bundle_id": "library",
      "path": "library",
      "kind": "weakness_catalog",
      "item_id_field": "chapter_code",
      "runtime": true
    },
    {
      "id": "kisec-2026-basic-course",
      "bundle_id": "kisec2026",
      "path": "library-kisec2026",
      "kind": "course_catalog",
      "item_id_field": "chapter_code_or_unit_code",
      "runtime": true
    }
  ]
}
```

---

## §4. 케이스 B — KISA DB 학습/드릴 흐름

정적 지식 번들과 별개로 DB 기반 학습/드릴 흐름이 있다.

### 현재 흐름

```
kisa-module/chapters/*.json
        |
        v
scripts/kisa-chapters-import.js
        |
        v
DB: kisa_chapters
        |
        v
api/kisa-study.js
        |
        v
Study / StudyDetail
```

```
kisa-module/seed/**/*.json
kisa-module/explanations/*.json
        |
        v
scripts/kisa-validate.js
scripts/kisa-seed-import.js
scripts/kisa-explanations-import.js
        |
        v
DB: kisa_questions
        |
        v
api/kisa-drill.js / api/kisa-attempt.js / api/kisa-review.js
        |
        v
DrillSession / SRS / 채점
```

### 현재 연결 방식

- `kisa_questions.chapter_code`가 앱의 관련 지식 모달 연결 키다.
- `DrillSession`은 문제를 DB에서 받고, `QuestionLibraryModal`은 같은 `chapter_code`로 `src/data/kisa-library.json`의 `source === 'library'` 항목을 찾는다.
- `StudyDetail`은 DB의 `kisa-study?action=detail` 결과와 정적 번들의 `kisec2026` 항목을 함께 사용한다.

### 현재 장점

- 드릴/채점/SRS는 DB 기준이라 사용자별 학습 상태를 관리할 수 있다.
- 정적 라이브러리와 DB 문항이 `chapter_code`로 연결되어 있다.
- `kisa-validate.js`가 seed 스키마를 어느 정도 검증한다.

### 현재 취약점/정리 필요점

- `kisa_chapters`의 학습 챕터와 `src/data/kisa-library.json`의 지식 카드가 각각 따로 존재한다. 둘 다 `chapter_code`를 쓰지만 어느 쪽이 "챕터 설명의 정본"인지 불분명하다.
- `Study` 목록은 DB API를 사용하고, `TheoryList`는 정적 JSON을 사용한다. 같은 학습 영역 안에서 조회 기준이 갈린다.
- seed 원천이 여러 세대다.
  - `seed/design`, `seed/implementation`
  - `seed/v3/design`
  - `seed/v3/design-method`
  - `seed/v3/implementation`
  - `blank-questions.json`, `mcq-extra-questions.json`
- DB 적재 스크립트는 운영 DB에 직접 반영하는 형태라, "어떤 seed 버전이 현재 운영 DB에 들어갔는지" manifest가 없다.

### 정형화 제안

1. `chapter_code`를 모든 KISA 지식/문항/이미지/메모의 1차 연결 키로 확정한다.
2. 정적 지식과 DB 데이터를 다음처럼 역할 분리한다.

| 데이터 | 기준 | 역할 |
|---|---|---|
| `kisa-module/library*/*.json` | 원천 카드 | 지식 콘텐츠 원문/구조 |
| `src/data/kisa-library.json` | 파생 번들 | 앱 오프라인 조회/이론/모달 |
| `kisa_chapters` | DB 챕터 인덱스 | 학습 목록, 문항 수, 사용자 진행과 연결 |
| `kisa_questions` | DB 문제 정본 | 드릴, 채점, SRS |

3. DB 적재 단위마다 `seed_manifest`를 남긴다.

예상 manifest:

```json
{
  "seed_batch_id": "kisa-seed-20260628-v3",
  "source_globs": [
    "kisa-module/seed/v3/implementation/*.json",
    "kisa-module/seed/v3/design-method/*.json"
  ],
  "target_tables": ["kisa_questions"],
  "upsert_key": "weakness_code + language + difficulty",
  "validated_at": "2026-06-28T00:00:00+09:00",
  "question_count": 0
}
```

4. 앱에서 `kisa-study`와 정적 번들을 섞어 쓰는 곳은 문서상 명시한다.
   - `Study`: DB 기준 목록
   - `StudyDetail`: DB 챕터 + 정적 `kisec2026` 코드예시 병합
   - `TheoryList/TheoryDetail`: 정적 `kisec2026` 기준
   - `QuestionLibraryModal`: 정적 `library` 기준

---

## §5. 케이스 C — 실습 Markdown 흐름

### 현재 흐름

```
kisa-module/library-kisec2026/practice/*.md
        |
        v
scripts/build-kisa-practice.mjs
        |
        v
src/data/kisa-practice.json
        |
        v
Study practice 탭 / PracticeDetail / MarkdownLite
```

### 현재 상태

- 실습 MD 13개가 있다.
- `README.md`는 제외하고 01~13 파일만 번들에 들어간다.
- `build-kisa-practice.mjs`가 제목, 출처, 표준형/변형형, 본문을 추출한다.

### 개선 제안

- 각 MD 상단에 YAML front matter를 두어 `id`, `type`, `source`, `related_codes`, `review_status`를 명확히 한다.
- 지금은 파일명 번호 기준으로 `num <= 7`이면 표준형, 이후는 변형형이다. 장기적으로는 본문 메타데이터 기준이 안전하다.
- `kisa-practice.json` 역시 파생물로 취급한다.

예상 front matter:

```md
---
id: 01-db-insert-signup
type: standard
related_codes: [DSG-IV-01, DSG-SF-03]
source: KISEC 2026 기본과정
review_status: reviewed
---
```

---

## §6. 케이스 D — 이미지/도식 자산 흐름

### 현재 흐름

```
public/q-images/library/<한글 원본 또는 명시 이미지>
public/q-images/diagnosis/<한글 원본>
        |
        v
scripts/build-kisa-library.mjs
        |
        v
public/q-images/library/<chapter_code 기반 ASCII 사본>
public/q-images/diagnosis/<chapter_code 기반 ASCII 사본>
        |
        v
src/data/kisa-library.json image/diagnosisImage/typeImages
        |
        v
앱에서 <img src="/q-images/...">
```

REBUILD63에서 확인된 운영 이슈:

- macOS 한글 파일명은 NFD로 저장될 수 있다.
- 브라우저/리눅스 컨테이너는 NFC 요청과 바이트 단위 경로가 달라 404가 난다.
- 현재 해결 방식은 한글 원본을 유지하고, 빌드 시 `chapter_code` 기반 ASCII 사본을 만들어 그 경로를 JSON에 넣는 것이다.

### 현재 판단

- 한글 원본 이미지는 바로 삭제하면 안 된다. 빌드 스크립트가 원본을 매칭해 ASCII 사본을 만들기 때문이다.
- ASCII 사본은 앱 런타임 자산이다.
- `public/q-images/driver`는 KISA 지식 라이브러리와 성격이 다르다.
- `public/q-images` 루트의 243개 이미지는 일반 기출문제 자산으로 보이며 KISA 라이브러리와 분리해야 한다.

### 정형화 제안

1. KISA 라이브러리 자산은 source와 runtime을 분리한다.

```
kisa-module/assets/
  library-source/
  diagnosis-source/
public/q-images/library/
public/q-images/diagnosis/
```

2. 단, 현재 앱은 `public/q-images` 기준으로 이미 운영 중이므로 즉시 이동하지 말고 manifest부터 만든다.

예상 manifest:

```json
{
  "assets": [
    {
      "asset_id": "diag-imp-iv-01",
      "chapter_code": "IMP-IV-01",
      "kind": "diagnosis_flow",
      "source_file": "1-1 SQL 삽입.png",
      "runtime_file": "imp-iv-01.png",
      "runtime_path": "/q-images/diagnosis/imp-iv-01.png"
    }
  ]
}
```

3. `build:lib` 후 다음 doctor를 추가한다.
   - JSON이 참조하는 이미지 실제 존재 확인
   - `text/html` fallback이 아니라 `image/*`로 서빙되는지 확인
   - ASCII 사본 누락 확인
   - 사용되지 않는 이미지 후보 리포트. 단, 원본/사본 관계가 확인되기 전 삭제 금지

---

## §7. 케이스 E — 일반 문제 수집/이관 흐름

KISA 지식 라이브러리와 별개로, 일반 기출문제 수집 흐름도 여러 개 있다.

### E-1. DocStore 이관

위치:

- UI: `src/tabs/ImportTab/index.jsx`
- API: `api/import-docstore.js`

흐름:

```
docstore DB: exams / exam_questions
        |
        v
api/import-docstore.js
        |
        v
aitutor DB: exams / questions
        |
        v
일반 퀴즈 화면
```

성격:

- KISA 지식 라이브러리라기보다 일반 문제은행 이관 도구다.
- 해설 생성에 LLM을 사용한다.
- `docstore`와 `aitutor`의 DB 스키마를 동시에 전제하므로 독립 파이프라인 문서가 필요하다.

### E-2. PoolUpload 파일 업로드

위치:

- UI: `src/tabs/ImportTab/PoolUpload.jsx`
- API: `api/pool-upload.js`
- 업로드 서명: `api/upload-sign.js`

현재 주의점:

- `PoolUpload.jsx`는 파일을 base64로 읽어 `file_data`, `file_name`, `mime_type`을 `/api/pool-upload`로 보내는 형태다.
- 현재 `api/pool-upload.js`의 `extract`는 `s3_key`를 필수로 요구하고 GCS 버킷에서 다운로드하는 형태다.
- 즉 UI와 API 사이에 REBUILD23의 GCS 전환 이후 남은 계약 불일치가 보인다.

이 흐름은 지식 라이브러리라기보다 "소량 일반 문제 추출 → DB 등록" 도구다. 다만 `docpipe`에서 만들 문서 추출 표준에는 참고할 가치가 있다.

흡수할 패턴:

- 파일 크기/MIME 제한
- 추출 결과 미리보기 후 등록
- 표/그림 포함 여부 플래그

분리할 패턴:

- Gemini Vision 결과를 바로 `questions` DB에 넣는 구조
- 추출 결과의 원본 페이지/좌표/검수 상태가 없는 구조

### E-3. `pool-*.js` 루트 스크립트

위치:

- `pool-import.js`
- `pool-import-v2.js`
- `pool-explain.js`
- `pool-patch-visual.js`
- `pool-repatch*.js`

성격:

- 일반 문제 추가/보정/해설 생성용 레거시 작업 스크립트다.
- 현재 `pool/` 폴더는 비어 있다.
- KISA 지식 라이브러리 표준 흐름에 넣기보다 "일반 문제은행 운영 도구"로 분리 문서화하는 편이 맞다.

### E-4. `driver-module`

위치:

- `driver-module/source`
- `driver-module/scripts`
- `driver-module/data/raw-extracted.json`
- `public/q-images/driver`

흐름:

```
운전면허 PDF
        |
        v
pdftotext / pdfimages
        |
        v
driver-module/data/raw-extracted.json
driver-module/data/images
        |
        v
driver-module/scripts/04_import.js
        |
        v
DB questions + public/q-images/driver
```

성격:

- 매우 명확한 1회성 PDF 문제은행 파이프라인이다.
- `docpipe`가 일반 문서/문제 추출 파이프라인을 만들 때 참고하기 좋다.
- 하지만 KISA 지식 라이브러리와 직접 섞으면 폴더 의미가 흐려진다.

---

## §8. 사용/비사용/주의 자산 분류

### 앱 런타임 핵심. 삭제 금지

| 경로 | 이유 |
|---|---|
| `src/data/kisa-library.json` | `LibraryFab`, `QuestionLibraryModal`, `Theory*`, `StudyDetail`, `DiagramQuiz`가 직접 import |
| `src/data/kisa-practice.json` | `Study`, `PracticeDetail`이 직접 import |
| `public/q-images/library/*.png` 중 JSON 참조 파일 | 지식 라이브러리/그림퀴즈 표시 |
| `public/q-images/diagnosis/*.png` 중 JSON 참조 파일 | 이론교육 진단방법 이미지 |
| `public/q-images/driver/*` | 운전면허 문제 이미지 |
| `public/q-images` 루트 일반 문제 이미지 | 기존 일반 문제 이미지일 가능성 큼 |

### 원천/검수 자료. 런타임 직접 사용은 아니지만 유지 필요

| 경로 | 이유 |
|---|---|
| `kisa-module/library/*.json` | `build:lib` 원천 |
| `kisa-module/course/*.json` | `build:lib` 원천 |
| `kisa-module/library-kisec2026/*.json` | `build:lib` 원천 |
| `kisa-module/library-jssec2023/*.json` | `build:lib` 원천 |
| `kisa-module/library-kisec2026/practice/*.md` | `build:practice` 원천 |
| `kisa-module/seed/**/*.json` | DB 문항 적재 원천 |
| `kisa-module/chapters/*.json` | DB 챕터 적재 원천 |
| `kisa-module/explanations/*.json` | DB 문항 해설 보강 원천 |
| `public/q-images/library`, `diagnosis`의 한글 원본 | ASCII 사본 생성의 매칭 원천 |

### 아카이브/분리 후보. 바로 삭제는 금지, manifest 확인 후 이동

| 경로 | 이유 |
|---|---|
| `kisa-module/library/*.md`, `course/*.md` | 현재 build 스크립트는 JSON만 읽는다. 사람 검수용이면 `docs/source-cards` 역할로 명시 필요 |
| `kisa-module/library-kisec2026/_extract/full.txt` | 추출 중간 산출물. 재현성을 위해 `source/_extract`로 보관하거나 `docpipe` workspace-data로 이동 후보 |
| `kisa-pool/processed/*.pdf` | 원본 PDF 보관소. 앱 코드 저장소에 계속 둘지 재검토 필요 |
| `kisa-pool/processed/진단방법/*.png` | `public/q-images/diagnosis`로 복사된 원천처럼 보임. 중복 관계 manifest 필요 |
| `driver-module/data/raw-extracted.json` | 운전면허 1회성 추출 중간 산출물 |
| `driver-module/source/cookies.txt` | 다운로드 보조 파일로 보임. 민감정보/쿠키 여부 확인 필요 |
| `pool-*.js` | 일반 문제 레거시 운영 스크립트. 유지하되 KISA와 분리 표기 필요 |

---

## §9. 표준 폴더 구조 제안

현재 구조를 한 번에 크게 옮기면 위험하다. 우선 "역할 라벨"을 붙인 뒤 단계적으로 정리한다.

### 1단계: 현재 구조 유지 + manifest 추가

```
kisa-module/
  source-manifest.json           # 신규: 자료원 등록표
  asset-manifest.json            # 신규: 원본 이미지 ↔ 런타임 이미지 매핑표
  chapters/
  library/
  course/
  library-kisec2026/
  library-jssec2023/
  seed/
  explanations/

src/data/
  kisa-library.json              # 생성물
  kisa-practice.json             # 생성물

public/q-images/
  library/
  diagnosis/
  driver/

scripts/
  build-kisa-library.mjs
  build-kisa-practice.mjs
  kisa-validate.js
  kisa-doctor.mjs                # 신규 제안
```

### 2단계: 빌드 산출물/원천 역할을 명확히 분리

```
kisa-module/
  sources/
    kisa-2021-diagnosis/
    kisa-2025-course/
    kisec-2026-basic/
    jssec-2023/
  cards/
    library/
    course/
    kisec2026/
    jssec2023/
  practice/
  seeds/
  manifests/
```

단, 이 구조 이동은 import 경로와 스크립트 수정이 따르므로 바로 실행하지 말고 doctor/manifest를 먼저 만든 뒤 진행한다.

### 3단계: `docpipe`와 역할 분리

```
workspace/docpipe/
  documents/
    <doc_id>/
      original/
      versions/v1/document.ir.json
      versions/v1/document.md
      versions/v1/chunks.jsonl
      versions/v1/images/
      versions/v1/tables/
      versions/v1/assets.json
  exporters/
    aitutor-kisa/
```

`docpipe`는 PDF/HWP/HWPX 추출, IR 생성, 표/이미지 자산화를 맡는다. `aitutor`는 다음만 받는다.

- 검수 완료 카드 JSON
- 검수 완료 seed JSON
- 앱용 ASCII 이미지 자산
- `src/data` 번들 생성 결과

---

## §10. 표준 워크플로우 제안

### 케이스 1. 새 KISA 지식 자료원 추가

1. `kisa-module/source-manifest.json`에 source 등록
2. source별 원본/추출물 보관
3. 카드 JSON 생성
4. `npm run build:lib`
5. `npm run build:fe`
6. `kisa-doctor`로 항목 수/이미지/중복 ID 확인
7. 앱에서 `LibraryFab`, `TheoryList`, `StudyDetail` 표시 확인

### 케이스 2. 기존 약점 카드 보강

1. `kisa-module/<source>/*.json` 수정
2. 관련 MD가 검수용이면 함께 갱신
3. `npm run build:lib`
4. `src/data/kisa-library.json` diff 확인
5. 이미지 참조가 있으면 `public/q-images` 존재 확인
6. `build:fe`

### 케이스 3. 이미지/도식 추가

1. 원본 파일은 가급적 ASCII 파일명으로 추가
2. 한글 원본을 유지해야 하면 `chapter_code` 매칭 가능하도록 제목/번호 규칙 유지
3. `npm run build:lib`로 ASCII 사본 생성
4. JSON의 `image`, `diagnosisImage`, `typeImages`가 ASCII 경로인지 확인
5. 앱에서 `image/*`로 서빙되는지 확인

### 케이스 4. 실습 MD 추가

1. `kisa-module/library-kisec2026/practice/NN-*.md` 추가
2. front matter 또는 최소 제목/출처 형식 유지
3. `npm run build:practice`
4. `Study`의 실습 탭과 `PracticeDetail` 확인

### 케이스 5. 드릴 문항 seed 추가

1. `kisa-module/seed/v3/...`에 seed 추가
2. `node scripts/kisa-validate.js <파일>` 실행
3. `DATABASE_URL=... node scripts/kisa-seed-import.js <파일>`로 DB 반영
4. `api/kisa-drill?action=count` 또는 앱 드릴에서 수량 확인
5. 관련 지식 모달이 열리려면 `chapter_code`가 정적 라이브러리와 일치해야 한다.

### 케이스 6. 일반 PDF/이미지 문제 추가

1. KISA 지식 라이브러리와 분리한다.
2. 소량이면 `PoolUpload` 계열, 대량이면 `driver-module` 같은 별도 패키지 방식을 쓴다.
3. 추출 결과는 바로 DB에 넣지 말고 미리보기/검수 단계를 둔다.
4. 장기적으로는 `docpipe`에서 Document IR/검수 산출물을 만든 뒤 `aitutor`에 import한다.

---

## §11. 즉시 개선 과제

우선순위는 다음 순서가 좋다.

### P0. 문서/검증 정리

- `kisa-module/source-manifest.json` 추가
- `kisa-module/asset-manifest.json` 추가
- `scripts/kisa-doctor.mjs` 추가
  - `src/data/kisa-library.json` source별 수량 검증
  - 이미지 참조 파일 존재 검증
  - `chapter_code` 중복/누락 검증
  - seed의 `chapter_code`가 라이브러리에 존재하는지 검증
  - `kisa_chapters` 원천과 정적 라이브러리의 코드 차이 리포트

### P1. 생성물 직접 수정 방지

- `src/data/kisa-library.json`, `src/data/kisa-practice.json` 상단 주석을 넣을 수 없는 JSON 특성상 README 또는 REBUILD에 "수동 수정 금지"를 명시한다.
- 빌드 스크립트 출력에 "generated file" 안내를 추가한다.

### P1. DB/정적 지식 연결 명세화

- `chapter_code`를 공식 연결 키로 문서화한다.
- `QuestionLibraryModal`이 현재 `source === 'library'`만 정확 매칭하는 정책을 명시한다.
- 필요하면 향후 `sourcePriority: ['kisec2026', 'library', 'jssec2023']` 같은 정책을 추가한다.

### P1. PoolUpload 계약 불일치 점검

- 현재 UI는 `file_data` 전송, API는 `s3_key` 요구다.
- 이건 지식 라이브러리 본류는 아니지만 관리 탭의 실제 기능 장애 가능성이 있다.
- 수정 방향은 둘 중 하나다.
  - UI를 `upload-sign` → GCS PUT → `pool-upload.extract(s3_key)` 흐름으로 맞춘다.
  - API가 base64 직접 업로드도 다시 허용하게 한다.

### P2. `kisa-pool`, `driver-module` 아카이브 정책

- 앱 저장소에 대형 PDF 원본을 계속 둘지 결정한다.
- 원본은 `workspace-data` 또는 `docpipe`의 document store로 옮기고, `aitutor`에는 검수 완료 산출물만 남기는 방향이 좋다.
- 단, 이동 전 `public/q-images`와의 원본/사본 관계를 manifest로 확정해야 한다.

---

## §12. 최종 정리 원칙

`aitutor` 안의 지식 라이브러리는 "문서 처리 시스템"이 아니라 "검수 완료 지식의 소비 앱"으로 유지하는 것이 안전하다.

따라서 장기 구조는 다음이 적합하다.

```
docpipe
  원본 문서 수집
  PDF/HWP/HWPX 추출
  Document IR 생성
  표/이미지/도식 자산화
  카드 JSON/MD/seed 후보 생성
  검수 리포트 생성

aitutor
  검수 완료 kisa-module 카드 보관
  src/data 번들 생성
  public/q-images 런타임 자산 서빙
  DB 문항/드릴/SRS 운영
  앱에서 지식 조회/학습/풀이 활용
```

한 줄 기준:

> `docpipe`는 지식을 만든다. `aitutor`는 검수된 지식을 학습 경험으로 제공한다.

현재 `aitutor`에서 바로 해야 할 일은 대규모 구조 이동이 아니라, 원천/파생/런타임/DB 기준을 문서와 doctor로 고정하는 것이다. 그 다음에 폴더 이동이나 중복 정리를 해야 운영 이미지, 드릴 문항, 학습 챕터가 깨지지 않는다.
