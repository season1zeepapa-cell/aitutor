# KISA 지식 라이브러리 — 데이터 스키마 정의서 (JSON 형식 + DB 테이블)

> **작성**: 2026-06-28 KST
> **목적**: aitutor 지식 라이브러리의 ① 자료원별 JSON 형식 ② DB 테이블 정의서(컬럼) ③ JSON↔DB 매핑 ④ 실제 저장 샘플을 한 문서로 정리.
> **근거**: 소스 JSON 직접 확인 + 운영 Supabase DB 실조회(2026-06-28). 기출문제(exams/questions)는 별도 도메인이라 제외.

---

## §0. 핵심 구분 — 지식 라이브러리는 2계열

| 계열 | 저장 위치 | 소스 폴더 | 앱 접근 | 비고 |
|------|----------|----------|---------|------|
| **번들형(static)** | `src/data/kisa-library.json`(git 번들) | library / course / kisec2026 / jssec2023 | import(직참조), **DB 안 거침** | 학습/검색/퀴즈/이론 |
| **DB형(runtime)** | Supabase PostgreSQL | chapters → DB / explanations → DB / seed → DB | API 조회 | 학습자료 본문·문항·해설 |

→ **즉 같은 "약점"이라도 번들(kisec2026 카드)과 DB(kisa_chapters/kisa_questions)에 별개로 존재**한다. (중복·정합 이슈는 [[KNOWLEDGE-LIBRARY-AUDIT]] 참조)

---

## §1. 자료원별 JSON 형식 (소스)

### 1-A. 번들형 자료원 → `src/data/kisa-library.json`

#### ① library (진단가이드 2021, 69개) · kisec2026 약점카드(81개) · jssec2023(42개) — 약점카드 계열
공통 베이스 + 자료원별 확장:

| 필드 | 타입 | library | kisec2026 | jssec2023 | 설명 |
|------|------|:---:|:---:|:---:|------|
| `chapter_code` | string | ✅ | ✅ | ✅ | 약점 ID (예 IMP-IV-01) |
| `title` | string | ✅ | ✅ | ✅ | 약점명 |
| `stage` | string | ✅ | ✅ | ✅ | design/implementation |
| `category` | string | ✅ | ✅ | ✅ | input_validation 등 |
| `cwe` | string | ✅ | ✅ | ✅ | CWE 번호 |
| `source` | object | ✅ | ✅ | ✅ | {doc, section, pages} 출처 |
| `overview` | string | ✅ | ✅ | ✅ | 개요 |
| `impact` | string | — | ✅ | ✅ | 영향 |
| `countermeasure` | string | ✅ | ✅ | ✅ | 대응 |
| `code_examples` | array | ✅ | ✅ | ✅ | [{lang,vulnerable,safe,note}] |
| `diagnosis` | object | ✅ | ✅ | — | {method,true_positive,false_positive} |
| `references` | array | ✅ | ✅ | — | 참고자료 |
| `tags` | array | ✅ | ✅ | — | 태그 |
| `question_hooks` | object | ✅ | ✅ | — | 출제 힌트(keywords 등) |
| `theory` | object | — | ✅ | — | **이론교육 4박스** {cause[],impact[],countermeasure[]} |
| `applies_to` | array | — | — | ✅ | [VanillaJS,ReactJS,ExpressJS] |
| `type_images`(파일) | array | — | XSS만 | — | XSS 유형 이미지 |

#### ② course(양성과정 73) · kisec2026 이론카드(K26) — 이론/단원 계열
| 필드 | 타입 | 설명 |
|------|------|------|
| `unit_code` | string | 단원/이론 ID (COURSE-01, K26-1-01) |
| `unit` | string | 단원(Ⅰ~Ⅵ) |
| `title`·`type` | string | 제목·유형 |
| `source` | object | 출처 |
| `summary` | string | 요약 |
| `sections` | array | 본문 섹션 [{title,content}] |
| `key_concepts`·`exam_points`·`keywords`·`tags` | array | 개념·시험포인트·키워드 |
| `related_library` | array | 연결 약점 코드(점프) |

> 이미지: 소스 JSON엔 없고, 약점명 파일(`public/q-images/`)을 **빌드가 자동매칭**(asciiCopy) → 번들의 `image`/`diagnosisImage`/`typeImages`로 주입.

### 1-B. DB형 자료원 → Supabase

#### ③ chapters/*.json → `kisa_chapters`
`chapter_code, stage, category, title, definition, cause, impact, countermeasures[], reference_docs[], tags[]`

#### ④ seed/**/*.json → `kisa_questions`
`stage, chapter_code, weakness_code, question_type, weakness_category, weakness_name_ko, language, difficulty, body, choices, answer_index, reference, tags` (+ 타입별: vulnerable_code/blank_template/model_answer…)

#### ⑤ explanations/*.json → `kisa_questions.explanation` (UPDATE)
`weakness_code, explanation` (2필드, weakness_code로 매칭 갱신)

---

## §2. 번들 출력 형식 (`src/data/kisa-library.json`)

`build-kisa-library.mjs`가 1-A 자료원을 변환·합본:
```json
{
  "version": 2,
  "sources": [
    { "id": "library",   "label": "진단가이드 (보안약점)", "count": 69, "items": [ … ] },
    { "id": "course",    "label": "양성과정 교재",          "count": 73, "items": [ … ] },
    { "id": "kisec2026", "label": "2026 기본과정 교재",      "count": 81, "items": [ … ] },
    { "id": "jssec2023", "label": "JS 시큐어코딩 가이드",    "count": 42, "items": [ … ] }
  ]
}
```
`items[]` 카드 필드(mapLibrary 변환 후): `id, title, source, g1, g2, order, category, summary, keywords, cwe, image, typeImages, theory, design, diagnosisImage, detail[], codeExamples[], diagnosisCode{}`

---

## §3. DB 테이블 정의서 (운영 Supabase, 2026-06-28 실조회)

### 3-1. `kisa_chapters` — 학습자료 (69 rows)

| 컬럼 | 타입 | NULL | 설명 |
|------|------|:---:|------|
| `chapter_code` | varchar | NOT NULL | **PK**, 약점 ID |
| `stage` | varchar | NOT NULL | design/implementation |
| `category` | varchar | NOT NULL | 분류 |
| `title` | varchar | NOT NULL | 약점명 |
| `definition` | text | NOT NULL | 정의 |
| `cause` | text | NULL | 원인 |
| `impact` | text | NULL | 영향 |
| `countermeasures` | jsonb | NOT NULL | 대응 배열 |
| `reference_docs` | array | NULL | 참조문서 |
| `tags` | array | NULL | 태그 |
| `related_chapters` | array | NULL | 연관 약점 |
| `is_active` | boolean | NOT NULL | 활성 |
| `created_at`/`updated_at` | timestamptz | NOT NULL | 생성/수정 |

### 3-2. `kisa_questions` — 문항 (967 rows)

분포: **mcq 449 · blank 274 · diagnosis4 192 · composite 52**

| 컬럼 | 타입 | NULL | 용도(타입) |
|------|------|:---:|------|
| `id` | uuid | NOT NULL | **PK** |
| `question_type` | varchar | NOT NULL | mcq/blank/diagnosis4/composite |
| `weakness_category` | varchar | NOT NULL | 분류 |
| `weakness_code` | varchar | NULL | 약점+변형 키(UK 조합) |
| `weakness_name_ko` | varchar | NOT NULL | 약점명 |
| `language` | varchar | NOT NULL | java/python/c/etc |
| `difficulty` | varchar | NOT NULL | 하/중/상 |
| `body` | text | NOT NULL | 문제 본문 |
| `chapter_code` | varchar | NULL | FK→kisa_chapters |
| `stage` | varchar | NULL | 단계 |
| `choices` | jsonb | NULL | (mcq) 선택지 [{num,text}] |
| `answer_index` | int | NULL | (mcq) 정답 |
| `choice_explanations` | jsonb | NULL | (mcq) 선택지별 해설 |
| `vulnerable_code` | text | NULL | (diagnosis4) 취약코드 |
| `code_language` | varchar | NULL | 코드 언어 |
| `vulnerable_lines` | array | NULL | (diagnosis4) 취약 라인 |
| `rationale_keywords` | array | NULL | (diagnosis4) 근거 키워드 |
| `fix_keywords` | array | NULL | (diagnosis4) 수정 키워드 |
| `safe_code` | text | NULL | 안전코드 |
| `model_answer` | jsonb | NULL | (diagnosis4) 모범답안 |
| `blank_template` | text | NULL | (blank) 빈칸 템플릿 |
| `blank_answers` | jsonb | NULL | (blank) 정답 |
| `artifacts` | jsonb | NULL | (composite) 산출물 |
| `rubric` | jsonb | NULL | (composite) 채점기준 |
| `report_template` | jsonb | NULL | (composite) 보고서 양식 |
| `explanation` | text | NULL | 공통 해설 |
| `reference` | text | NULL | 출처 |
| `tags` | array | NULL | 태그 |
| `created_by` | int | NULL | 작성자 |
| `is_active` | boolean | NOT NULL | 활성 |
| `created_at`/`updated_at` | timestamptz | NOT NULL | 생성/수정 |

### 3-3. 보조 테이블 (현재 비어있음 — 사용자 진행상태용)
| 테이블 | rows | 용도 |
|--------|:---:|------|
| `kisa_question_llm_explanations` | 14 | LLM 생성 해설 캐시 |
| `kisa_diagnosis_attempts` | 0 | 진단 시도 기록 |
| `kisa_exam_sessions` | 0 | 시험 세션 |
| `kisa_reports` | 0 | 진단 보고서 |
| `kisa_review_queue` | 0 | 복습 큐 |

> 스키마 원천: `kisa-module/migrations/*.sql` (001_kisa_module ~ 005_kisa_question_rebuild).

---

## §4. JSON ↔ DB 매핑

| 소스 JSON | 임포트 스크립트 | 대상 | 비고 |
|-----------|----------------|------|------|
| `chapters/*.json` | kisa-chapters-import.js | `kisa_chapters` | chapter_code UPSERT |
| `seed/**/*.json` | kisa-seed-import.js | `kisa_questions` | weakness_code+language+difficulty UPSERT |
| `explanations/*.json` | kisa-explanations-import.js | `kisa_questions.explanation` | weakness_code UPDATE |
| `library/course/kisec2026/jssec2023` | build-kisa-library.mjs | **번들(DB 아님)** | static |

---

## §5. 실제 저장 샘플 (운영 DB)

### kisa_chapters — `IMP-IV-01`
```
chapter_code: IMP-IV-01 | stage: implementation | category: input_validation
title: SQL 삽입 (SQL Injection)
definition: SQL 질의문을 생성할 때 검증되지 않은 외부 입력값을 허용하여 악의적인 질의문이 실행될 수 있는 보안약점…
cause: 사용자 입력을 문자열 연결로 SQL에 포함. PreparedStatement/파라미터 바인딩 미사용.
impact: 인증 우회, 전체 DB 조회/수정/삭제, 관리자 권한 획득, OS 명령 실행 가능.
countermeasures(jsonb): ["PreparedStatement / 파라미터 바인딩(?)…","ORM 파라미터 바인딩…","입력값 화이트리스트 검증…"]
reference_docs: ["KISA 진단가이드 §1.1.1","CWE-89"] | tags: ["sql","injection","cwe-89"]
```

### kisa_questions (mcq) — `DSG-EH-01-M2`
```
question_type: mcq | stage: design | chapter_code: DSG-EH-01 | weakness_name_ko: 예외처리 | language: java | difficulty: 중
body: 다음 Java 코드의 예외처리 방식에 대한 설명으로 옳지 않은 것은? ```java try { … ```
choices(jsonb): [{num:1,text:"try 블록에서는 …"}, …]  | answer_index: 3
choice_explanations(jsonb): [{num:1,why:"옳은 진술(함정)…"}, …]
explanation: 정답 4번. IMP-EH-03 code_examples vulnerable 기반…
```

### kisa_questions (diagnosis4) — `IMP-AA-02-D1`
```
question_type: diagnosis4 | chapter_code: IMP-AA-02 | weakness_name_ko: 취약한 API 사용 | language: etc | difficulty: 중
body: 다음 C 코드의 API 사용에 대해 취약 여부를 판정하고… ```c …strcpy… ```
vulnerable_code: "…strcpy(buf, string);…" | code_language: c | vulnerable_lines: [3]
rationale_keywords: ["금지된 함수","strcpy","버퍼 오버플로우","CWE-676"] | fix_keywords: ["strcpy_s","안전한 함수","길이 제한"]
model_answer(jsonb): {verdict:true, rationale:"취약함. 3번 라인 strcpy()…"}
```

### kisa_questions (blank) — `DSG-IV-02-B1`
```
question_type: blank | chapter_code: DSG-IV-02 | weakness_name_ko: XML 조회 및 결과 검증
(blank_template + blank_answers(jsonb)로 빈칸/정답 관리)
```

---

## §6. 요약

| 구분 | 수량 | 저장 |
|------|------|------|
| 번들 약점/이론 카드 | 265개 (library 69+course 73+kisec2026 81+jssec2023 42) | static 번들 |
| DB 학습자료(kisa_chapters) | 69 | Supabase |
| DB 문항(kisa_questions) | 967 (mcq 449/blank 274/diagnosis4 192/composite 52) | Supabase |
| 빈 보조 테이블 | 5종(attempts/sessions/reports/review_queue 등) | 진행상태용 |

**관찰**:
- 번들형(library/course)과 DB형(kisa_chapters)에 **약점 정보가 이원화** — 정합·통합 검토 필요(§0, AUDIT 문서 §4).
- `kisa_questions`는 §1 [JSON↔DB 통합] 논의대로 **정규 컬럼 + JSONB(choices/model_answer/blank_answers/choice_explanations/artifacts/rubric) 하이브리드**가 이미 적용됨 → docpipe 설계 참고 모델.
