# REBUILD57 — 설계 "요구사항→진단방법" 주관식/객관식 문항 추가

> **작성**: 2026-06-23 KST
> **트리거**: 사용자 요청 — 설계(DSG) 20개 항목의 "요구사항에 대한 진단방법"을 ① 객관식으로 고르거나 ② 주관식으로 서술하는 유형 추가.
> **결과**: 코드 변경 없이(기존 mcq/composite 재활용) DSG 20개 × 78문항(mcq 54 + composite 24) seed 생성. [[REBUILD56]]의 `library-kisec2026` diagnosis.requirements를 소재로 사용.

---

## §0. 결론 요약

| 항목 | 결과 |
|------|------|
| 신규 코드 | **0** — 기존 `mcq`(McqCard/scoreMcq), `composite`(CompositeCard/scoreComposite) 재활용 |
| 문항 | DSG 20개 항목, mcq 54 + composite 24 = **78문항** |
| 위치 | `kisa-module/seed/v3/design-method/<chapter_code>.json` (20파일) |
| 소재 | `library-kisec2026/DSG-*.json`의 `diagnosis.requirements`(요구사항→checklist→methods→artifacts) |
| 적재 | `node scripts/kisa-seed-import.js kisa-module/seed/v3/design-method/*.json` (weakness_code UPSERT) |

## §1. 유형 설계 — 새 type 불필요

시험 실습(60%)이 서술형이라 "요구사항↔진단방법"이 핵심. 기존 4개 type으로 둘 다 표현 가능:

- **객관식** → `mcq`. body=요구사항/진단방법 질문, choices=진단방법 또는 관련 산출물 4지선다(정답+오답3), `answer_index`(0-based), `choice_explanations`. 두 출제축:
  - `-DMn`: "요구사항 X의 진단방법으로 옳지 않은 것은?"
  - 관련 산출물 매칭: "이 진단방법의 관련 산출물로 옳은 것은?"
- **주관식 서술** → `composite`(경량 구성). artifacts=[요구사항정의서 1종], rubric=[{item, points, required_keywords, artifact_ref, method}] (**합계 8점**), report_template. `scoreComposite`가 `required_keywords` 부분매칭(synonyms 지원)으로 부분점수 자동 채점.
  - `-DMEn` weakness_code.

`blank`(완전일치)은 자유 서술과 안 맞아 배제. composite의 키워드 매칭이 적합.

## §2. 데이터 흐름 (변경 없음 확인)

- `kisa-seed-import.js` `UPSERT_COLS`에 `choices/answer_index/choice_explanations`(mcq)·`artifacts/rubric/report_template`(composite) 전부 포함 → seed 그대로 적재.
- 출제: `kisa-drill.js` ALLOWED_TYPES에 mcq·composite 이미 포함. composite는 [[REBUILD55]]에서 드릴 진입까지 완료.
- 채점: `scorer.js` scoreMcq/scoreComposite 그대로.
- 화면: McqCard/CompositeCard/ResultOverlay 그대로.

## §3. 검증

- 20파일 JSON 유효성 ✓ / weakness_code 전역 유니크 ✓(UPSERT 충돌 없음)
- mcq: choices 4개 + answer_index(0-based)가 `correct:true` 선지와 일치 (54문항 전부)
- composite: rubric points 합=8 (24문항 전부), 모범답안(키워드 전체)으로 scoreComposite=100점
- 채점 시뮬레이션: 충실 답안 100점 / 빈약 답안 0점, synonyms 매칭(ORM↔MyBatis 등) 정상

## §4. 남은 작업

1. **운영 DB 적재** — `DATABASE_URL=... node scripts/kisa-seed-import.js kisa-module/seed/v3/design-method/*.json` (운영 점검은 [[ismsp-prod-db-query]] 패턴, 배포는 [[aitutor-deploy]]).
2. 출제 노출 — Dashboard에 "진단방법" 필터/진입(현재는 chapter_code·type 필터로 출제 가능).
3. 구현단계(IMP) 진단방법 문항 — 동일 패턴 확장 가능.
4. 예상문제 배치 — 본 유형을 예상문제로 대량 생성→적재.
