# REBUILD81 — 이수시험 2대 신규 문제유형(이론 객관식·단순서술형) + 문제 생성 파이프라인

> **작성**: 2026-07-04 KST
> **범위(계획)**: DB question_type 2종 추가, `registry.js`·`scorer`·`kisa-attempt`·렌더 컴포넌트, `DrillConfig` 확장, `Dashboard` 카드 2종, 문제 생성 스킬(`.claude/skills/`), 시드 스크립트
> **목적**: KISA 공식 이수시험 안내서 "붙임2 문제 예시"의 두 형식 — ① 이론 객관식(코드/설명 지문 + 4~5지선다, 잘못된 것 고르기) ② 실습 단순서술형(보안약점 정·오탐 분석 서술) — 을 앱 문제유형으로 추가한다. **문제 생성·채점 모두 Claude Code 가 직접 수행(외부 LLM 사용 금지).**

---

## §1. 두 신규 유형 (기존 인프라 재사용)

### objective — 이론 객관식형
- 형식: `body`(질문, "…잘못된 것은?") + `vulnerable_code`(코드 지문, 선택) + `choices`(4~5지) + `answer_index` + `explanation`.
- 채점: `scoreMcq`(정답 인덱스 정확 매칭, 100/0) **재사용** — 외부 LLM 불필요.
- 렌더: `McqCard`/`McqResult` 재사용(+코드 지문 표시). 응답 필드 `mcq_selected`.

### shortessay — 단순서술형
- 형식: `body`(문제, 조건 ①②) + `rubric`[{item, points, required_keywords:[{base,synonyms}]}] + `model_answer`(모범답안 텍스트) + 배점 합계.
- 채점: `scoreComposite`(rubric별 키워드 부분매칭 → 배점 환산) **재사용** — 외부 LLM 불필요. 응답 필드 `report_text`.
- 렌더: `CompositeCard`/`CompositeResult` 재사용(문제 지시문 + 서술 textarea + 모범답안).

## §2. 문제 생성 — Claude Code 직접(외부 LLM 0)

- 소스: `src/data/kisa-library.json`(380항목)의 각 약점 개요·보안대책·코드예시·정탐/오탐.
- 생성 주체: Claude Code 서브에이전트(내부, 외부 API 미사용). 스킬 `kisa-exam-question-gen` 로 표준화 — 약점 1건 입력 → objective/shortessay JSON 산출.
- 초기: 설계 20 + 구현 49 = **69개 약점 각각 최소 1문항**(유형별). 이후 스킬로 지속 증설.
- 시드 키: `chapter_code` = `OBJ-{stage}-{cat}-{nn}` / `ESSAY-…` (누적 발번, 재실행 시 id 보존).

## §3. 출제 필터 (DrillConfig 확장)

- 두 유형도 설정 화면 경유. 카테고리 다중선택 + 순서/랜덤(REBUILD80)에 더해:
  - **설계/구현 구분**(stage) — 설계 20 / 구현 49 영역 선택.
  - **출처 다중선택**(sources) — 문항 tags 에 출처 저장(생성 시 근거 자료원).
- 랜덤 토글은 기존 order=guide/random 재사용.

## §4. 단계

1. (이번) 스키마 확정 + 생성 스킬 + registry/scorer/kisa-attempt/렌더 인프라 + 문항 생성 착수.
2. 문항 취합·시드·DB 적재 + DrillConfig 확장 + Dashboard 카드 2종.
3. 빌드·배포·검증. 이후 스킬로 문항 증설(약점당 2·3개…).

## §5. 원칙

- 외부 LLM(Gemini/OpenAI/Claude API) 호출 없음 — 생성·채점 전부 로컬(결정론 채점 + Claude Code 생성).
- 기존 문제유형·데이터 무영향(신규 question_type 만 추가).

---

## §6. 실행 결과 (완료)

- 문항 생성: 9개 병렬 Claude Code 에이전트 — 69약점 × (objective+shortessay) = **138문항**, 전부 지식 라이브러리 근거·JSON 검증 통과. 외부 LLM 호출 0.
- 품질 후처리: objective 정답 위치 편중(3번 41개) → 선택지 결정적 셔플로 재분산(11/13/18/13/14).
- DB: `question_type_check` 제약에 objective·shortessay 추가. 적재 최종 **삽입 69 + 갱신 69 · 실패 0** (시드 스크립트 jsonb 캐스팅 2회 수정: report_template 은 {text}로 감싸 $15::jsonb).
- 검증: 유형·단계 분포 = objective(설계20/구현49)·shortessay(설계20/구현49), rubric/report_template/choices/answer_index 누락 0.
- 렌더 호환: CompositeCard 는 sections 없으면 단일 서술 textarea → shortessay({text})와 자연 호환(코드 수정 불필요).
- 스킬 `kisa-exam-question-gen` 등록 — 이후 약점당 2·3번째 문항 증설 시 `OBJ-<ID>-2` 접미사 규칙으로 반복 실행.

---

## §7. 문항 증설 (2회차 — 138 → 276)

- `kisa-exam-question-gen` 스킬로 각 약점(69) **2번째** objective+shortessay 생성 → 138문항 추가, 총 **objective 138 + shortessay 138 = 276**.
- 2회차 차별화: 1회차(개요 중심)와 달리 **대책·진단방법·오탐 판정 중심**, 난이도 상/중 분산(약점ID 끝자리 홀=상·짝=중).
- chapter_code `-2` 접미사(`OBJ-<ID>-2`/`ESSAY-<ID>-2`)로 UPSERT 충돌 회피. objective 정답 위치 결정적 셔플로 분산, shortessay explanation 은 모범답안(model_answer.text)으로 보완.
- 적재: 삽입 138 + 갱신 138 · 실패 0. DB 분포 objective 138·shortessay 138, 해설 누락 0.
- **배포 불필요**: 데이터(exam.seed.json)만 변경, 코드 무변경 → count/next API 가 DB 실시간 조회로 자동 반영.
- 이후 3·4회차 증설은 동일 스킬로 `-3`/`-4` 접미사 반복(무한 확장 가능).
