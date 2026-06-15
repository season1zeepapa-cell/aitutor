# REBUILD43 — KISA 보안약점/설계기준 라이브러리 구축 (진단가이드 → json+md)

> **작성**: 2026-06-15 KST
> **트리거**: 사용자 요청 — KISA 진단원 이수시험 학습 모듈 개선. "기초 자료를 라이브러리화 → 검색 스터디 → 지속 업데이트 → 문제 타입·수 확장"
> **범위**: 공식 시험 출제 구조 역설계(붙임2·3 분석) + `소프트웨어 보안약점 진단가이드(2021)` 612쪽을 보안약점/설계기준 단위 라이브러리로 변환
> **결과**: `kisa-module/library/` 에 **69개 항목 × (json+md) = 138개 파일** 구축, 기존 `chapters` chapter_code 와 1:1 연결

---

## §0. 결론 요약

| 산출물 | 내용 |
|--------|------|
| 시험 출제 구조 역설계 | 붙임2(문제 예시) + 붙임3(보안약점 기준) 정밀 분석 → 이론(객관형) + 실습(단순/복합 서술형) |
| 라이브러리 | 구현단계 49 + 설계단계 20 = **69개**, json(데이터)+md(열람) 이중 포맷 |
| 문제 생성 연료 | 코드예제 137 · 정탐 87 · 오탐 69 · 설계 진단방법 242 |

**핵심**: "합격이 목표 → 공식 문제 형태부터 역설계"로 접근. 출제 범위 전체(설계+구현 보안약점)를 구조화 데이터로 만들어, 학습·검색·문제생성·채점의 단일 원천(SSOT)을 확보했다.

---

## §1. 시험 출제 구조 역설계 (붙임2 · 붙임3)

### 1.1 출제 구조 (붙임2 문제 예시)

```
시험 ── 이론시험 ── 객관형: 코드 제시 → 보안약점 설명 4~5지선다 (틀린 것 고르기)
     │
     └─ 실습시험 ┬─ 단순서술형: 보안약점 분석 (부분배점, "빨간 글씨 핵심 키워드 필수")
                └─ 복합서술형: 산출물 3종(요구사항정의서·아키텍처설계서·개발가이드+코드)
                              검토 → 진단보고서 작성 (8점, 정형 양식)
```

- 채점 특징: 핵심 키워드 포함 여부로 정·오탐 판정 → `question_hooks.keywords` 로 대응.
- 복합서술형 = 설계 산출물 검토 → `DSG-*` 의 `diagnosis.requirements[].checklist[].methods[]` 가 채점 루브릭.

### 1.2 출제 영역 카탈로그 (붙임3)

- **설계단계** 보안설계기준: 입력검증·보안기능·에러처리·세션통제
- **구현단계** 보안약점 7대 분류: 입력검증·보안기능·시간및상태·에러처리·코드오류·캡슐화·API오용

---

## §2. 라이브러리 설계

### 2.1 위치/포맷

```
kisa-module/library/
  IMP-<cat>-NN-<slug>.json / .md   ← 구현단계 보안약점 (49)
  DSG-<cat>-NN-<slug>.json / .md   ← 설계단계 보안설계기준 (20)
```
- `chapter_code` 는 기존 `kisa-module/chapters/` 와 **동일 체계** → 학습화면에 바로 매핑.
- json = 앱/검색/문제생성용 구조화 데이터, md = 사람 열람용.

### 2.2 구현단계 json 스키마

`chapter_code, title, stage, category, cwe, source, overview, countermeasure, code_examples[{lang,vulnerable,safe}], diagnosis{method, true_positive[], false_positive[]}, references, tags, question_hooks{keywords, mcq_seed, diagnosis_seed}`

- **정탐(true_positive)** = 실제 취약 코드, **오탐(false_positive)** = 실제 안전 코드 → 붙임2 실습 "정·오탐 분석" 직결.

### 2.3 설계단계 json 스키마 (전용)

`… design_item, description, security_measures[], design_considerations[{point,detail}], diagnosis{requirements[{requirement, checklist[{question, methods[{method, artifacts}]}]}]}, related_weaknesses[{category,weakness,code}] …`

- **진단방법 ↔ 관련산출물(artifacts)** 짝이 복합서술형(8점) 채점 기준.
- `related_weaknesses.code` 로 설계기준 → 구현약점 연결 (예: DBMS조회 → SQL삽입 IMP-IV-01).

---

## §3. 변환 결과

| 단계 | 카테고리 | chapter_code | 개수 |
|------|----------|--------------|------|
| 구현 | 입력검증/보안기능/시간상태/에러/코드오류/캡슐화/API | IMP-IV·SF·TS·EH·CE·EN·AA | 49 |
| 설계 | 입력검증/보안기능/에러/세션 | DSG-IV·SF·EH·SC | 20 |

- 원본: `소프트웨어 보안약점 진단가이드(2021)` 612쪽 (텍스트 PDF, pdftotext 추출).
- 변환: 항목별 본문 라인 매핑 → 병렬 에이전트 배치 변환 → `node` json 유효성 일괄 검증 (파싱실패 0, 누락 0).
- 품질 원칙: 원문에 없는 코드/정탐/오탐은 **빈 배열** (지어내지 않음), CWE는 원문 참고자료 우선, OCR 오기 교정.

**통계**: 코드예제 137 · 정탐 87 · 오탐 69 · 설계 진단방법 242.

---

## §4. 문제 생성 연결고리 (question_hooks)

각 항목에 문제 자동생성용 메타를 내장:
- `keywords` — 서술형 채점용 핵심 키워드 (붙임2 "빨간 글씨")
- `mcq_seed` — 객관형 생성 시드 (취약/안전·정탐/오탐 코드쌍)
- `diagnosis_seed` — 서술형 생성 시드 (정탐 코드 진단 / 설계 산출물 진단보고서)

---

## §5. 영향 범위 / 다음 단계

| 항목 | 영향 |
|------|------|
| 앱 런타임/배포 | ❌ 무영향 (`kisa-module` 은 `.gcloudignore` 배포 제외, 데이터 파일) |
| 기존 chapters | 🟢 chapter_code 연결만, 변경 없음 |

**후속 (REBUILD44+ 검토)**:
1. **앱 연결** — chapter 학습화면에 라이브러리 표시 + 검색(Lunr) 인덱싱
2. **문제 자동 생성** — `question_hooks` 기반 객관형/서술형 파이프라인 (P0: 복합서술형 8점)
3. **DB 임포트** — `kisa_questions` 등에 생성 문항 적재

---

**완료 일시**: 2026-06-15 KST
**연관 문서**: REBUILD42(자원 정리), `kisa-module/library/` (라이브러리 본체), `kisa-module/chapters/` (학습 챕터)
