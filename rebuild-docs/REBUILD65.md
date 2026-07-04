# REBUILD65 — 지식 라이브러리 JSON 형식 및 DB 테이블 정의서

> **작성**: 2026-06-28 KST  
> **범위**: `workspace/aitutor` 기준 KISA 지식 라이브러리, KISA 문항/챕터 DB, 앱 번들 JSON, 약점 메모/첨부, LLM 해설 캐시.  
> **목적**: 현재 코드베이스에 산재한 지식 라이브러리별 JSON 형식과 DB 저장 테이블/컬럼을 한 문서에 정리하고, 실제 DB에 저장된 건수와 공개 샘플 데이터를 기록한다.

---

## §0. 요약

현재 `aitutor`의 지식 라이브러리는 두 계층으로 나뉜다.

| 계층 | 저장 위치 | 앱 사용 방식 | DB 저장 여부 |
|---|---|---|---|
| 정적 지식 카드 | `kisa-module/library*/*.json`, `course/*.json` | `scripts/build-kisa-library.mjs`로 `src/data/kisa-library.json` 생성 후 앱에서 직접 import | 원칙적으로 DB 저장 아님 |
| 실습 Markdown | `kisa-module/library-kisec2026/practice/*.md` | `scripts/build-kisa-practice.mjs`로 `src/data/kisa-practice.json` 생성 후 앱에서 직접 import | DB 저장 아님 |
| 학습 챕터 | `kisa-module/chapters/*.json` | `scripts/kisa-chapters-import.js`로 DB 적재 후 `api/kisa-study.js`에서 조회 | `kisa_chapters` |
| 드릴/시험 문항 | `kisa-module/seed/**/*.json` | `scripts/kisa-seed-import.js`로 DB 적재 후 드릴/시험 API에서 조회 | `kisa_questions` |
| 문항 해설 보강 | `kisa-module/explanations/*.json` | `scripts/kisa-explanations-import.js`로 `kisa_questions.explanation` 업데이트 | `kisa_questions.explanation` |
| 사용자 풀이/SRS/시험 | 앱 API 런타임 생성 | `kisa-attempt`, `kisa-review`, `kisa-exam` | `kisa_diagnosis_attempts`, `kisa_review_queue`, `kisa_exam_sessions` |
| 약점 메모 | 앱 API 런타임 생성 | `MemoPanel`이 `chapter_code` 기준 저장/조회 | `question_memos`, `memo_files` |
| LLM 해설 캐시/사용량 | 앱 API 런타임 생성 | `kisa-attempt?action=llm-explain`, `_llm/usage` | `kisa_question_llm_explanations`, `llm_usage_log` |

실제 DB 조회 결과:

| 테이블 | 실제 저장 건수 | 비고 |
|---|---:|---|
| `kisa_chapters` | 69 | KISA 설계/구현 챕터 |
| `kisa_questions` | 967 | KISA 문항 |
| `kisa_diagnosis_attempts` | 0 | 현재 사용자 풀이 기록 없음 |
| `kisa_review_queue` | 0 | 현재 복습 큐 없음 |
| `kisa_exam_sessions` | 0 | 현재 시험 세션 없음 |
| `kisa_reports` | 0 | 현재 보고서 저장 없음 |
| `kisa_question_llm_explanations` | 14 | provider별 저장 해설 캐시 |
| `llm_usage_log` | 36 | LLM 호출 로그 |
| `aitutor_settings` | 8 | 런타임 설정 |
| `question_memos` | 3 | 일반/약점 메모. 본문 샘플은 민감 가능성 때문에 조회 제외 |
| `memo_files` | 1 | 메모 첨부파일 메타 |

`kisa_questions` 문항 유형별 실제 건수:

| question_type | 건수 |
|---|---:|
| `mcq` | 449 |
| `blank` | 274 |
| `diagnosis4` | 192 |
| `composite` | 52 |
| **합계** | **967** |

주의할 점:

- `kisa_chapters`는 실제 DB에 존재하고 앱에서 핵심으로 쓰이지만, 현재 `kisa-module/migrations/*.sql` 안에는 CREATE TABLE 정의가 없다. REBUILD14 문서와 실제 DB `information_schema` 기준으로 정의를 복원해야 한다.
- `src/data/kisa-library.json`, `src/data/kisa-practice.json`은 앱 번들용 생성물이다. DB 정본이 아니며 수동 수정 대상도 아니다.
- 정적 라이브러리와 DB 문항/챕터를 연결하는 핵심 키는 `chapter_code`다.

---

## §1. JSON 자산 분류

### 1-1. 앱 번들 JSON

| 파일 | 생성 원천 | 생성 스크립트 | 앱 사용처 | DB 저장 |
|---|---|---|---|---|
| `src/data/kisa-library.json` | `kisa-module/library`, `course`, `library-kisec2026`, `library-jssec2023`, `public/q-images` | `npm run build:lib` | `LibraryFab`, `QuestionLibraryModal`, `TheoryList`, `TheoryDetail`, `StudyDetail`, `DiagramQuiz` | X |
| `src/data/kisa-practice.json` | `kisa-module/library-kisec2026/practice/*.md` | `npm run build:practice` | `Study`, `PracticeDetail` | X |

### 1-2. 원천 JSON/MD

| 경로 | 형식 | 개수 | 역할 | DB 저장 |
|---|---:|---:|---|---|
| `kisa-module/library/*.json` | 진단가이드 약점 카드 | 69 | 정적 지식 번들 원천 | X |
| `kisa-module/library/*.md` | 진단가이드 약점 카드 문서형 | 69 | 사람 검수/참고용 | X |
| `kisa-module/course/*.json` | 2025 양성과정 교재 카드 | 73 | 정적 지식 번들 원천 | X |
| `kisa-module/course/*.md` | 교재 카드 문서형 | 73 | 사람 검수/참고용 | X |
| `kisa-module/library-kisec2026/*.json` | 2026 기본과정 카드 | 81 | 정적 지식 번들 원천 | X |
| `kisa-module/library-kisec2026/practice/*.md` | 실습 본문 | 13 + README | 실습 번들 원천 | X |
| `kisa-module/library-jssec2023/*.json` | JS 시큐어코딩 카드 | 42 | 정적 지식 번들 원천 | X |
| `kisa-module/chapters/*.json` | 학습 챕터 | 3파일, 69 챕터 | DB 챕터 적재 원천 | O |
| `kisa-module/seed/**/*.json` | 문항 seed | 107파일 | DB 문항 적재 원천 | O |
| `kisa-module/explanations/*.json` | 문항 해설 | 5파일 | DB 문항 해설 업데이트 원천 | O |

---

## §2. 정적 지식 번들 JSON 형식

### 2-1. `src/data/kisa-library.json`

최상위 구조:

```json
{
  "version": 2,
  "sources": [
    {
      "id": "library",
      "label": "진단가이드 (보안약점)",
      "count": 69,
      "items": []
    }
  ]
}
```

`sources[]` 구성:

| source id | label | 항목 수 | 원천 |
|---|---:|---:|---|
| `library` | 진단가이드 (보안약점) | 69 | `kisa-module/library/*.json` |
| `course` | 양성과정 교재 | 73 | `kisa-module/course/*.json` |
| `kisec2026` | 2026 기본과정 교재 | 81 | `kisa-module/library-kisec2026/*.json` |
| `jssec2023` | JS 시큐어코딩 가이드 | 42 | `kisa-module/library-jssec2023/*.json` |
| **합계** |  | **265** |  |

공통 `items[]` 필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 카드 ID. `DSG-IV-01`, `IMP-IV-01`, `COURSE-*`, `JS-*` |
| `title` | string | 카드 제목 |
| `source` | string | `library`, `course`, `kisec2026`, `jssec2023` |
| `unit` | string? | 교재 단원. 일부 source에 존재 |
| `g1` | string | 1차 그룹. 예: `설계단계`, `구현단계`, `Ⅳ단원` |
| `g2` | string | 2차 그룹. 예: `입력데이터 검증 및 표현` |
| `order` | number | 앱 표시 정렬값 |
| `category` | string | 한글 분류명 |
| `summary` | string | 요약/개요 |
| `keywords` | string[] | 검색/연관 추천용 키워드 |
| `cwe` | string | CWE 코드. 없으면 빈 문자열 |
| `image` | string | 약점 개요 이미지 URL. `/q-images/library/...` |
| `typeImages` | array | 유형별 이미지. 현재 XSS 유형 문제 등 |
| `theory` | object/null | 구현단계 이론교육 원인/영향/대응 |
| `diagnosisImage` | string | 진단방법 이미지 URL. `/q-images/diagnosis/...` |
| `design` | object/null | 설계단계 요구사항/관련 약점 |
| `detail` | array | UI 상세 섹션. `{label,text}` |
| `relatedLibrary` | string[]? | `course` 카드에서 연관 약점 코드 |
| `codeExamples` | array | 취약/안전 코드 예시 |
| `diagnosisCode` | object | 정탐/오탐 코드 예시 |

`codeExamples[]` 형식:

```json
{
  "lang": "JavaScript (mysql 드라이버)",
  "vulnerable": "취약 코드",
  "safe": "안전 코드",
  "note": "설명"
}
```

`design` 형식:

```json
{
  "description": "설계 요구사항 설명",
  "measures": ["보안대책"],
  "related": [
    { "category": "입력데이터 검증 및 표현", "weakness": "SQL 삽입", "code": "IMP-IV-01" }
  ],
  "considerations": [
    { "point": "① 최소권한 DB 계정 사용", "detail": "..." }
  ]
}
```

`theory` 형식:

```json
{
  "cause": ["원인"],
  "impact": ["영향"],
  "countermeasure": ["대응"]
}
```

실제 번들 샘플:

```json
{
  "id": "JS-IV-01",
  "title": "SQL 삽입",
  "source": "jssec2023",
  "g1": "구현단계",
  "g2": "입력데이터 검증 및 표현",
  "category": "입력데이터 검증 및 표현",
  "summary": "데이터베이스 드라이버를 사용할 경우 개발자가 직접 쿼리 문자열을 정의하고...",
  "keywords": [],
  "cwe": "CWE-89",
  "image": "/q-images/library/js-iv-01.png",
  "diagnosisImage": "/q-images/diagnosis/js-iv-01.png",
  "detail": [
    {
      "label": "보안대책",
      "text": "사용자 입력값으로 쿼리를 생성할 때는 쿼리 빌더를 사용하여 SQL 인젝션을 방어할 수 있다..."
    }
  ],
  "codeExamples": [
    {
      "lang": "JavaScript (mysql 드라이버)",
      "vulnerable": "const query = `SELECT email FROM user WHERE user_id = ${userInput}`;",
      "safe": "const query = 'SELECT email FROM user WHERE user_id = ?';",
      "note": "외부 입력값을 문자열로 직접 연결하지 말고 con.query(query, 값) 형태로 바인딩한다."
    }
  ]
}
```

### 2-2. `src/data/kisa-practice.json`

최상위 구조:

```json
{
  "version": 1,
  "count": 13,
  "items": []
}
```

`items[]` 필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 파일명 기반 실습 ID |
| `num` | number | 실습 번호 |
| `title` | string | 첫 `#` 제목 |
| `source` | string | 첫 `> 출처:` 라인 |
| `type` | string | `표준형` 또는 `변형형` |
| `body` | string | Markdown 본문 전체 |

실제 번들 샘플:

```json
{
  "id": "01-db-insert-signup",
  "num": 1,
  "title": "실습 01 — DB에 데이터를 입력하는 기능에 대한 설계단계 보안약점 진단",
  "source": "KISEC 2026 기본과정 교재 p302–304 (Ⅳ-02 보안설계 기준 및 설계 기준 실습)",
  "type": "표준형",
  "body": "# 실습 01 — DB에 데이터를 입력하는 기능에 대한 설계단계 보안약점 진단\n..."
}
```

---

## §3. 원천 JSON 형식

### 3-1. `kisa-module/library/*.json`

대표 파일: `kisa-module/library/IMP-IV-01-sql-injection.json`

필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `chapter_code` | string | `IMP-IV-01`, `DSG-IV-01` |
| `title` | string | 약점명/설계항목명 |
| `stage` | string | `design` 또는 `implementation` |
| `category` | string | 영문 카테고리 |
| `cwe` | string | CWE 코드 |
| `source` | string/object | 출처 |
| `overview` | string | 개요 |
| `countermeasure` | string | 보안대책 |
| `code_examples` | array | 코드 예시 |
| `diagnosis` | object | 진단방법/정탐/오탐 |
| `references` | array | 참고문헌 |
| `tags` | array | 태그 |
| `question_hooks` | object | 문항 생성용 힌트 |

### 3-2. `kisa-module/course/*.json`

대표 파일: `kisa-module/course/COURSE-IMP-IV-01-sql-injection.json`

필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `unit_code` | string | `COURSE-IMP-IV-01` |
| `chapter_code_ref` | string | 연결 약점 코드 |
| `title` | string | 제목 |
| `unit` | string | 교재 단원 |
| `type` | string | 카드 유형 |
| `category` | string | 영문/한글 분류 |
| `source` | string | 출처 |
| `summary` | string | 요약 |
| `sections` | array | 섹션 목록 |
| `key_concepts` | array | 핵심 개념 |
| `exam_points` | array | 시험 포인트 |
| `keywords` | array | 키워드 |
| `related_library` | array | 연관 `chapter_code` |
| `tags` | array | 태그 |

### 3-3. `kisa-module/library-kisec2026/*.json`

대표 파일: `kisa-module/library-kisec2026/IMP-IV-01-sql-injection.json`

`library`와 유사하지만 다음 필드가 보강되어 있다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `impact` | string/array | 영향 |
| `theory` | object | 원인/영향/대응 박스 |
| `diagnosis.requirements` | array? | 설계/진단 요구사항. seed 생성 소재 |

### 3-4. `kisa-module/library-jssec2023/*.json`

대표 파일: `kisa-module/library-jssec2023/JS-IV-01-sql-injection.json`

필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `chapter_code` | string | `JS-IV-01` |
| `title` | string | JS 보안약점명 |
| `stage` | string | 보통 `implementation` |
| `category` | string | 영문 카테고리 |
| `cwe` | string | CWE 코드 |
| `applies_to` | array | 적용 대상 |
| `source` | string | 출처 |
| `overview` | string | 개요 |
| `impact` | string | 영향 |
| `countermeasure` | string | 보안대책 |
| `code_examples` | array | JS 취약/안전 코드 예시 |

### 3-5. `kisa-module/chapters/*.json`

최상위 구조:

```json
{
  "chapters": []
}
```

`chapters[]` 필드:

| 필드 | 타입 | DB 컬럼 | 설명 |
|---|---|---|---|
| `chapter_code` | string | `kisa_chapters.chapter_code` | PK |
| `stage` | string | `stage` | `design`/`implementation` |
| `category` | string | `category` | 영문 카테고리 |
| `title` | string | `title` | 챕터 제목 |
| `definition` | string | `definition` | 정의 |
| `cause` | string/null | `cause` | 원인 |
| `impact` | string/null | `impact` | 영향 |
| `countermeasures` | string[] | `countermeasures` JSONB | 대응책 |
| `reference_docs` | string[] | `reference_docs` TEXT[] | 참고 문서 |
| `tags` | string[] | `tags` TEXT[] | 태그 |
| `related_chapters` | string[]? | `related_chapters` TEXT[] | 설계→구현 연관 |

원천 샘플:

```json
{
  "chapter_code": "IMP-IV-01",
  "stage": "implementation",
  "category": "input_validation",
  "title": "SQL 삽입 (SQL Injection)",
  "definition": "SQL 질의문을 생성할 때 검증되지 않은 외부 입력값을 허용하여 악의적인 질의문이 실행될 수 있는 보안약점.",
  "cause": "사용자 입력을 문자열 연결로 SQL에 포함. PreparedStatement/파라미터 바인딩 미사용.",
  "impact": "인증 우회, 전체 DB 조회/수정/삭제, 관리자 권한 획득, OS 명령 실행 가능.",
  "countermeasures": ["PreparedStatement / 파라미터 바인딩 (?)으로 쿼리 작성"],
  "reference_docs": ["KISA 진단가이드 §1.1.1", "CWE-89"],
  "tags": ["sql", "injection", "cwe-89"]
}
```

### 3-6. `kisa-module/seed/**/*.json`

최상위 구조:

```json
{
  "questions": []
}
```

공통 필드:

| 필드 | 타입 | DB 컬럼 | 설명 |
|---|---|---|---|
| `question_type` | string | `kisa_questions.question_type` | `mcq`, `diagnosis4`, `blank`, `composite` |
| `weakness_category` | string | `weakness_category` | 영문 카테고리 |
| `weakness_code` | string | `weakness_code` | 문항 고유 코드. UPSERT 기준 일부 |
| `weakness_name_ko` | string | `weakness_name_ko` | 한글 약점명 |
| `chapter_code` | string | `chapter_code` | 지식 라이브러리 연결 키 |
| `stage` | string | `stage` | `design`/`implementation` |
| `language` | string | `language` | `java`, `python`, `javascript`, `etc` 등 |
| `difficulty` | string | `difficulty` | `하`, `중`, `상` |
| `body` | string | `body` | 문제 본문 |
| `reference` | string | `reference` | 참고 |
| `tags` | string[] | `tags` | 태그 |
| `explanation` | string | `explanation` | 기본 해설 |

`mcq` 전용:

| JSON 필드 | DB 컬럼 | 설명 |
|---|---|---|
| `choices` | `choices` JSONB | 선택지 배열 |
| `answer_index` | `answer_index` | 0-based 정답 인덱스 |
| `choice_explanations` | `choice_explanations` JSONB | 선지별 해설 |

`diagnosis4` 전용:

| JSON 필드 | DB 컬럼 | 설명 |
|---|---|---|
| `vulnerable_code` | `vulnerable_code` | 취약 코드 |
| `code_language` | `code_language` | 코드 언어 |
| `vulnerable_lines` | `vulnerable_lines` INT[] | 취약 라인 |
| `rationale_keywords` | `rationale_keywords` TEXT[] | 근거 채점 키워드 |
| `fix_keywords` | `fix_keywords` TEXT[] | 수정 채점 키워드 |
| `safe_code` | `safe_code` | 안전 코드 |
| `model_answer` | `model_answer` JSONB | 모범답안 |

`blank` 전용:

| JSON 필드 | DB 컬럼 | 설명 |
|---|---|---|
| `blank_template` | `blank_template` | 빈칸 템플릿 |
| `blank_answers` | `blank_answers` JSONB | 정답/유의어 |

`composite` 전용:

| JSON 필드 | DB 컬럼 | 설명 |
|---|---|---|
| `artifacts` | `artifacts` JSONB | 요구사항정의서/아키텍처설계서/개발가이드 등 산출물 |
| `rubric` | `rubric` JSONB | 채점 루브릭 |
| `report_template` | `report_template` JSONB | 진단보고서 양식 |

seed 원천 샘플:

```json
{
  "question_type": "mcq",
  "weakness_code": "IMP-IV-01-M1",
  "stage": "implementation",
  "chapter_code": "IMP-IV-01",
  "weakness_category": "input_validation",
  "weakness_name_ko": "SQL 삽입",
  "language": "etc",
  "difficulty": "하",
  "body": "다음 중 'SQL 삽입(SQL Injection)' 보안약점에 대한 설명으로 옳지 않은 것은?",
  "choices": [
    { "num": 1, "text": "DB와 연동된 웹 응용프로그램에서..." },
    { "num": 4, "text": "외부 입력값을 문자열로 결합한 동적쿼리는..." }
  ],
  "answer_index": 3
}
```

---

## §4. JSON → DB 매핑

| 원천 | 적재 스크립트 | 대상 테이블/컬럼 | UPSERT/연결 기준 |
|---|---|---|---|
| `kisa-module/chapters/*.json` | `scripts/kisa-chapters-import.js` | `kisa_chapters` | `chapter_code` |
| `kisa-module/seed/**/*.json` | `scripts/kisa-seed-import.js` | `kisa_questions` | `weakness_code + language + difficulty` |
| `kisa-module/explanations/*.json` | `scripts/kisa-explanations-import.js` | `kisa_questions.explanation` | `weakness_code` |
| `src/data/kisa-library.json` | 없음 | 없음 | 앱 번들 직접 import |
| `src/data/kisa-practice.json` | 없음 | 없음 | 앱 번들 직접 import |
| 사용자 약점 메모 | `api/memos.js` | `question_memos.chapter_code` | `chapter_code` |
| LLM 해설 생성 | `api/kisa-attempt.js` | `kisa_question_llm_explanations` | `question_id + provider` 최신순 재사용 |

관계 키:

```text
kisa_questions.chapter_code
  → kisa_chapters.chapter_code
  → src/data/kisa-library.json items[].id
  → question_memos.chapter_code
```

이 구조 때문에 신규 seed를 만들 때 `chapter_code`가 정적 라이브러리와 일치하지 않으면 관련 지식 모달이 비게 된다.

---

## §5. DB 테이블 정의서

### 5-1. `kisa_chapters`

역할: KISA 학습 챕터 인덱스. `/api/kisa-study?action=list|detail`에서 사용한다.

실제 DB 건수: 69.

주의: 현재 repo의 `kisa-module/migrations`에는 CREATE TABLE이 없다. 실제 DB `information_schema`와 REBUILD14 문서 기준으로 정리했다.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `chapter_code` | varchar | NO |  | PK 성격. `DSG-IV-01`, `IMP-IV-01` |
| `stage` | varchar | NO |  | `design`/`implementation` |
| `category` | varchar | NO |  | 영문 카테고리 |
| `title` | varchar | NO |  | 챕터 제목 |
| `definition` | text | NO |  | 정의 |
| `cause` | text | YES |  | 원인 |
| `impact` | text | YES |  | 영향 |
| `countermeasures` | jsonb | NO | `[]` | 대응책 배열 |
| `reference_docs` | text[] | YES | `{}` | 참조 문서 |
| `tags` | text[] | YES | `{}` | 태그 |
| `is_active` | boolean | NO | `true` | 활성 여부 |
| `created_at` | timestamptz | NO | `now()` | 생성시각 |
| `updated_at` | timestamptz | NO | `now()` | 수정시각 |
| `related_chapters` | text[] | YES | `{}` | 연관 챕터 코드 |

실제 DB 샘플:

```json
{
  "chapter_code": "DSG-IV-01",
  "stage": "design",
  "category": "input_validation",
  "title": "DBMS 조회 및 결과 검증",
  "definition": "DBMS 조회 시 SQL 질의문에 포함되는 외부 입력값과 조회 결과값의 유효성을 검증하는 설계 기준...",
  "countermeasures": [
    "외부 입력이 들어가는 모든 SQL은 PreparedStatement / 파라미터 바인딩으로 설계",
    "화이트리스트 기반 입력값 검증 (타입·길이·형식) 적용",
    "DB 계정 최소 권한 원칙 (SELECT만, 테이블 단위 제한)",
    "DB 조회 결과값도 검증 (XSS 페이로드 포함 여부 등)"
  ],
  "reference_docs": [
    "KISA 개발보안 가이드 §3-3.1.1",
    "KISA 진단가이드 §1.1.1 SQL 삽입"
  ],
  "tags": ["sql", "dbms", "injection"],
  "is_active": true
}
```

### 5-2. `kisa_questions`

역할: KISA 드릴/시험 문항 정본.

실제 DB 건수: 967.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `question_type` | varchar | NO |  | `mcq`, `diagnosis4`, `blank`, `composite` |
| `weakness_category` | varchar | NO |  | 영문 분류 |
| `weakness_code` | varchar | YES |  | 문항 코드. seed UPSERT 기준 |
| `weakness_name_ko` | varchar | NO |  | 한글 약점명 |
| `language` | varchar | NO |  | `java`, `python`, `javascript`, `kotlin`, `swift`, `etc` |
| `difficulty` | varchar | NO |  | `하`, `중`, `상` |
| `body` | text | NO |  | 문제 본문 |
| `vulnerable_code` | text | YES |  | 진단형 취약 코드 |
| `code_language` | varchar | YES |  | 코드 언어 |
| `choices` | jsonb | YES |  | MCQ 선택지 |
| `answer_index` | integer | YES |  | 0-based 정답 |
| `vulnerable_lines` | integer[] | YES |  | 취약 라인 |
| `rationale_keywords` | text[] | YES |  | 근거 키워드 |
| `fix_keywords` | text[] | YES |  | 수정 키워드 |
| `safe_code` | text | YES |  | 안전 코드 |
| `model_answer` | jsonb | YES |  | 모범답안 |
| `reference` | text | YES |  | 참고 |
| `tags` | text[] | YES | `{}` | 태그 |
| `is_active` | boolean | NO | `true` | 활성 여부 |
| `created_by` | integer | YES |  | 생성자 |
| `created_at` | timestamptz | NO | `now()` | 생성시각 |
| `updated_at` | timestamptz | NO | `now()` | 수정시각 |
| `stage` | varchar | YES |  | `design`/`implementation` |
| `chapter_code` | varchar | YES |  | 지식 연결 키 |
| `explanation` | text | YES |  | 기본 해설 |
| `blank_template` | text | YES |  | blank 문제 템플릿 |
| `blank_answers` | jsonb | YES |  | blank 정답/유의어 |
| `choice_explanations` | jsonb | YES |  | MCQ 선지별 해설 |
| `artifacts` | jsonb | YES |  | composite 산출물 |
| `rubric` | jsonb | YES |  | composite 채점 루브릭 |
| `report_template` | jsonb | YES |  | composite 보고서 양식 |

주요 제약:

| 제약 | 내용 |
|---|---|
| `question_type` | `mcq`, `diagnosis4`, `blank`, `composite` |
| `mcq_requires_choices` | MCQ는 `choices`, `answer_index` 필요 |
| `diag_requires_fields` | diagnosis4는 코드/라인/키워드/안전코드 필요 |
| `blank_requires_fields` | blank는 `blank_template`, `blank_answers` 필요 |
| `composite_requires_fields` | composite는 `artifacts`, `rubric` 필요 |

실제 DB 샘플: MCQ

```json
{
  "id": "b595134c…",
  "question_type": "mcq",
  "stage": "design",
  "chapter_code": "DSG-EH-01",
  "weakness_category": "error_handling",
  "weakness_code": "DSG-EH-01-01",
  "weakness_name_ko": "예외처리 설계",
  "language": "etc",
  "difficulty": "중",
  "body_preview": "예외처리·오류메시지 설계 원칙으로 부적절한 것은?",
  "choices": [
    { "num": 1, "text": "사용자에게는 일반화된 메시지를 표시하고, 상세 에러는 서버 로그로만 기록한다" },
    { "num": 2, "text": "스택 트레이스·DB 쿼리·서버 경로 등 내부 정보를 HTTP 응답 본문에 그대로 노출한다" }
  ],
  "answer_index": 1,
  "has_explanation": true,
  "is_active": false
}
```

실제 DB 샘플: blank

```json
{
  "id": "b42520d6…",
  "question_type": "blank",
  "chapter_code": "DSG-EH-01",
  "weakness_category": "error_handling",
  "weakness_code": "DSG-EH-01-BLANK-A",
  "weakness_name_ko": "예외처리 설계",
  "language": "java",
  "difficulty": "하",
  "body_preview": "[설계 · 예외처리 설계]\n아래 빈칸을 채우시오.",
  "blank_template": "예외 메시지에 {{1}}(스택트레이스)를 그대로 노출하면 시스템 구조와 취약점 정보가 유출된다.",
  "has_explanation": true,
  "is_active": false
}
```

실제 DB 샘플: composite

```json
{
  "id": "8474432c…",
  "question_type": "composite",
  "stage": "design",
  "chapter_code": "DSG-EH-01",
  "weakness_category": "error_handling",
  "weakness_code": "DSG-EH-01-C1",
  "weakness_name_ko": "예외처리",
  "language": "java",
  "difficulty": "상",
  "body_preview": "다음은 어느 웹 애플리케이션 프로젝트의 분석·설계 단계 산출물 3종...",
  "artifacts": [
    {
      "type": "요구사항정의서",
      "title": "보안요구사항정의서 — 예외처리(SR-EH)",
      "content": "SR-EH-01 명시적 예외는 예외처리 블럭으로 처리하고..."
    }
  ],
  "has_explanation": true,
  "is_active": true
}
```

### 5-3. `kisa_diagnosis_attempts`

역할: 사용자 풀이/채점 결과. MCQ, diagnosis4, blank, composite 답안을 한 테이블에 저장한다.

실제 DB 건수: 0.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | integer | NO |  | 사용자 |
| `question_id` | uuid | NO |  | `kisa_questions.id` |
| `mode` | varchar | NO |  | `drill`, `exam`, `review` |
| `exam_session_id` | uuid | YES |  | 시험 세션 |
| `mcq_selected` | integer | YES |  | MCQ 선택 |
| `verdict_yn` | boolean | YES |  | 진단형 취약 여부 판단 |
| `cited_lines` | integer[] | YES | `{}` | 지적 라인 |
| `rationale_text` | text | YES | `''` | 근거 답안 |
| `fix_text` | text | YES | `''` | 수정 설명 |
| `fix_code` | text | YES | `''` | 수정 코드 |
| `auto_score` | integer | YES |  | 자동 점수 |
| `keyword_hits` | jsonb | YES |  | 키워드 hit |
| `llm_score` | integer | YES |  | LLM 점수 |
| `llm_feedback` | jsonb | YES |  | LLM 피드백 |
| `final_score` | integer | YES |  | 최종 점수 |
| `self_grade` | varchar | YES |  | `again`, `hard`, `good`, `easy` |
| `time_spent_sec` | integer | YES | `0` | 소요시간 |
| `submitted_at` | timestamptz | NO | `now()` | 제출시각 |
| `blank_answers_user` | jsonb | YES |  | blank 사용자 답 |
| `report_text` | text | YES |  | composite 보고서 답안 |
| `rubric_hits` | jsonb | YES |  | composite 루브릭 채점 결과 |

### 5-4. `kisa_review_queue`

역할: SM-2 복습 큐.

실제 DB 건수: 0.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `user_id` | integer | NO |  | 사용자 |
| `question_id` | uuid | NO |  | 문항 |
| `ease_factor` | real | NO | `2.5` | 난이도 계수 |
| `interval_days` | integer | NO | `0` | 복습 간격 |
| `repetitions` | integer | NO | `0` | 반복 횟수 |
| `next_review_at` | timestamptz | NO | `now()` | 다음 복습 |
| `last_reviewed_at` | timestamptz | YES |  | 마지막 복습 |
| `suspended` | boolean | NO | `false` | 중지 여부 |
| `created_at` | timestamptz | NO | `now()` | 생성 |
| `updated_at` | timestamptz | NO | `now()` | 수정 |

PK: `(user_id, question_id)`.

### 5-5. `kisa_exam_sessions`

역할: 실전 모의고사 세션.

실제 DB 건수: 0.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | integer | NO |  | 사용자 |
| `exam_type` | varchar | NO |  | `theory60`, `practical100`, `full3h` |
| `state` | varchar | NO | `in_progress` | `in_progress`, `submitted`, `expired`, `abandoned` |
| `question_ids` | uuid[] | NO | `{}` | 출제 문항 순서 |
| `answers` | jsonb | NO | `{}` | 자동저장 답안 |
| `total_score` | integer | YES |  | 총점 |
| `theory_score` | integer | YES |  | 이론 점수 |
| `practical_score` | integer | YES |  | 실기 점수 |
| `time_limit_sec` | integer | NO |  | 제한시간 |
| `started_at` | timestamptz | NO | `now()` | 시작 |
| `ended_at` | timestamptz | YES |  | 종료 |
| `expired_at` | timestamptz | YES |  | 만료 |

### 5-6. `kisa_reports`

역할: 진단보고서 저장 및 DOCX 내보내기 메타.

실제 DB 건수: 0.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | integer | NO |  | 사용자 |
| `question_id` | uuid | YES |  | 문항 |
| `attempt_id` | uuid | YES |  | 풀이 |
| `template_type` | varchar | NO |  | `simple`, `composite` |
| `title` | varchar | YES |  | 제목 |
| `payload` | jsonb | NO |  | 보고서 구조 |
| `docx_s3_key` | varchar | YES |  | DOCX 객체 키. 현재 GCS object key로 해석 |
| `created_at` | timestamptz | NO | `now()` | 생성 |
| `updated_at` | timestamptz | NO | `now()` | 수정 |

### 5-7. `kisa_question_llm_explanations`

역할: KISA 문항별 LLM 해설 캐시. `api/kisa-attempt.js`의 `llm-explain`에서 사용한다.

실제 DB 건수: 14.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `question_id` | uuid | NO |  | `kisa_questions.id` |
| `user_id` | integer | NO |  | 생성 사용자 |
| `provider` | varchar | NO |  | `gemini`, `openai`, `claude` |
| `model` | varchar | YES |  | 모델명 |
| `content` | text | NO |  | 해설 본문 |
| `created_at` | timestamptz | NO | `now()` | 생성 |

provider/model별 실제 요약:

| provider | model | 건수 |
|---|---|---:|
| `openai` | `gpt-4o-mini` | 10 |
| `claude` | `claude-haiku-4-5-20251001` | 3 |
| `gemini` | `gemini-2.5-flash` | 1 |

### 5-8. `llm_usage_log`

역할: LLM 호출 사용량/비용 기록.

실제 DB 건수: 36.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | bigint | NO | sequence | PK |
| `user_id` | integer | YES |  | 사용자 |
| `provider` | varchar | NO |  | 제공자 |
| `model` | varchar | NO |  | 모델명 |
| `action` | varchar | YES |  | `kisa_explain`, `kisa_grade` 등 |
| `question_id` | uuid | YES |  | 관련 KISA 문항 |
| `input_tokens` | integer | YES |  | 입력 토큰 |
| `output_tokens` | integer | YES |  | 출력 토큰 |
| `estimated_cost` | numeric | YES |  | 추정 비용 USD |
| `latency_ms` | integer | YES |  | 지연시간 |
| `success` | boolean | NO | `true` | 성공 여부 |
| `error_message` | text | YES |  | 오류 |
| `meta` | jsonb | YES |  | 추가 메타 |
| `created_at` | timestamptz | NO | `now()` | 생성 |

관련 뷰:

| 뷰 | 설명 |
|---|---|
| `v_llm_daily_cost` | 일자/provider/model별 호출 수, 토큰, 비용, 오류 집계 |

### 5-9. `aitutor_settings`

역할: DB 기반 런타임 설정.

실제 DB 건수: 8.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `key` | varchar | NO |  | PK |
| `value` | text | NO |  | 설정값. boolean도 문자열 |
| `updated_at` | timestamptz | NO | `now()` | 수정시각 |
| `updated_by` | integer | YES |  | 수정 관리자 |

### 5-10. `question_memos`

역할: 기존 일반 문제 메모 + REBUILD60 이후 약점 챕터 메모. 약점 메모는 `chapter_code` 기준으로 저장한다.

실제 DB 건수: 3. 본문 `content`는 사용자 작성 데이터라 샘플 조회 제외.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | integer | NO | sequence | PK |
| `question_id` | integer | YES |  | 일반 문제 ID. 약점 메모에서는 null 가능 |
| `content` | text | NO |  | 메모 본문 |
| `created_at` | timestamptz | YES | `now()` | 생성 |
| `updated_at` | timestamptz | YES | `now()` | 수정 |
| `chapter_code` | text | YES |  | 약점 챕터 코드 |

### 5-11. `memo_files`

역할: 메모 첨부파일 메타. 실제 파일은 GCS에 저장하고, DB 컬럼명은 호환성 때문에 `s3_key`를 유지한다.

실제 DB 건수: 1.

| 컬럼 | 타입 | Null | 기본값 | 설명 |
|---|---|---:|---|---|
| `id` | integer | NO | sequence | PK |
| `memo_id` | integer | NO |  | `question_memos.id` |
| `filename` | varchar | NO |  | 원본 파일명 |
| `mime_type` | varchar | NO |  | MIME |
| `data` | text | YES |  | 과거 base64 저장 컬럼. 현재는 비권장 |
| `size` | integer | NO | `0` | 파일 크기 |
| `created_at` | timestamptz | YES | `now()` | 생성 |
| `s3_key` | varchar | YES |  | 현재는 GCS object key |

---

## §6. 일반 문제 DB와 KISA 지식 DB의 경계

`aitutor`에는 기존 일반 문제은행 테이블도 있다.

| 테이블 | 성격 | KISA 지식 라이브러리와의 관계 |
|---|---|---|
| `categories` | 일반 문제 카테고리 | KISA 전용 아님 |
| `exams` | 일반 시험/회차 | KISA 전용 아님 |
| `subjects` | 일반 과목 | KISA 전용 아님 |
| `questions` | 일반 기출문제 | KISA 문항은 원칙적으로 `kisa_questions` 사용 |
| `question_explanations` | 일반 문제 해설 | KISA 기본 해설은 `kisa_questions.explanation`, LLM 캐시는 `kisa_question_llm_explanations` |
| `question_bookmarks`, `exam_results` | 일반 문제 학습 상태 | KISA는 별도 SRS/attempt/exam 테이블 사용 |

예외:

- `question_memos`와 `memo_files`는 기존 일반 문제 메모 인프라를 재사용한다.
- 약점 메모는 `question_memos.chapter_code`로 KISA 챕터에 연결한다.

---

## §7. 현재 스키마 리스크와 개선 제안

### 7-1. `kisa_chapters` DDL 누락

실제 DB와 코드에는 `kisa_chapters`가 존재하지만 `kisa-module/migrations`에 CREATE TABLE 문서가 없다.

권장 조치:

- `006_kisa_chapters_schema.sql` 또는 `docs/DB_SCHEMA_KISA.md`에 실제 DDL을 복원한다.
- 최소 컬럼: `chapter_code`, `stage`, `category`, `title`, `definition`, `cause`, `impact`, `countermeasures`, `reference_docs`, `tags`, `is_active`, `created_at`, `updated_at`, `related_chapters`.

### 7-2. 정적 JSON과 DB 챕터의 중복

`kisa-module/library*`와 `kisa_chapters`가 모두 챕터 설명을 갖고 있다.

권장 기준:

- 앱의 풍부한 지식 보기: `src/data/kisa-library.json`
- 드릴/진행도/문항 수와 결합된 학습 인덱스: `kisa_chapters`
- 연결 키: `chapter_code`

### 7-3. 생성물 수동 수정 방지

`src/data/kisa-library.json`, `src/data/kisa-practice.json`은 생성물이다.

권장 조치:

- 원천 수정 → `npm run build:lib`/`npm run build:practice` → diff 검토.
- 생성물에는 직접 편집하지 않는다는 규칙을 `kisa-module/README.md` 또는 별도 `DATA_FLOW.md`에 명시한다.

### 7-4. 문항 활성 상태 점검

실제 샘플에서 초기 설계 문항 일부는 `is_active=false`, composite 일부는 `true`다. 문항 수는 967건이지만 실제 출제 가능 문항은 `is_active=true` 조건에 따라 달라진다.

권장 doctor:

```sql
SELECT question_type, is_active, count(*)
FROM kisa_questions
GROUP BY question_type, is_active
ORDER BY question_type, is_active;
```

### 7-5. 지식 라이브러리 doctor 추가

추가할 검증:

- `kisa_questions.chapter_code`가 `kisa_chapters.chapter_code`에 존재하는지
- `kisa_questions.chapter_code`가 `src/data/kisa-library.json`의 `items[].id` 중 하나인지
- `kisa_chapters.chapter_code` 69개와 정적 라이브러리 `DSG/IMP` 코드 69개가 일치하는지
- `image`, `diagnosisImage`, `typeImages.image`가 실제 `public/q-images`에 존재하는지
- `kisa-module/seed`의 `weakness_code + language + difficulty` 중복 여부

---

## §8. 운영 기준 한 줄 정리

정적 지식은 `kisa-module` 원천에서 `src/data` 번들로 만들고, 앱은 이를 직접 읽는다.  
학습/드릴/시험에 필요한 상태성 데이터는 DB의 `kisa_*` 테이블에 저장한다.  
두 세계를 연결하는 표준 키는 `chapter_code`다.

