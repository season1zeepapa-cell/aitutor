# REBUILD53 — KISA 문제풀 완전 재구축 (라이브러리 기반, Claude Code 생성)

> **작성**: 2026-06-16 KST
> **트리거**: 사용자 요청 — 가이드(붙임2) 분석 → 객관식·단답형·실기형 문제풀 완전 재구축. 답안해설 유형별 맞춤(객관식 선지별 자세히 + 정답 확인법). 문제출제·해설은 반드시 Claude Code(에이전트 직접 작성).
> **범위**: 스키마(005) + 도구(validate/import) + 프론트(composite·선지별 해설) + 채점(scoreComposite) + 시험연계 + 501문항 생성 + 운영 적용
> **결과**: 운영 active 문항 378 → **501** (기존 폐기·복구가능), 유형별 mcq207·diagnosis138·composite20·blank136

---

## §0. 결론 요약

| 단계 | 산출물 |
|------|--------|
| 스키마(005) | composite 타입 + mcq choice_explanations + 드리프트 명시화 |
| 도구 | kisa-validate / kisa-seed-import (composite·blank·선지별 지원) |
| 프론트 | CompositeCard/Result/ExamBody + McqResult 선지별 해설 + registry |
| 채점 | scoreComposite(rubric 키워드 부분점수) + kisa-exam composite 슬롯 |
| 생성 | 라이브러리 142개 → Claude Code 에이전트 배치 → 69챕터 501문항 |
| 운영 | 005 마이그 + v3 import 501 + 기존 378 폐기 |

---

## §1. 스키마 (마이그레이션 005)

- 드리프트 명시화: `stage`/`chapter_code`/`explanation` `ADD COLUMN IF NOT EXISTS` (001에 없으나 코드 사용 — SSOT 복구)
- `question_type` CHECK에 `composite` 추가
- mcq 선지별 해설: `choice_explanations JSONB` [{num,correct,why}]
- composite: `artifacts`/`rubric`/`report_template` JSONB + CHECK
- attempts: `report_text`/`rubric_hits`

## §2. 출제 형태 (붙임2) → 유형

| 가이드 | 타입 | 답안해설 |
|--------|------|----------|
| 객관형 | mcq | **선지별 O/X + why**(정답 근거/오답 함정) + 정답 확인법 |
| 단순서술형 | diagnosis4 | 키워드 의미 + 부분점수(verdict20/line20/rationale30/fix30) + 자가확인 |
| 복합서술형 | composite(신규) | 산출물 3종 검토 → 진단보고서(8점 rubric) + 모범보고서 + 정탐/오탐 |
| (용어 드릴) | blank | 빈칸 정답 + 해설 |

## §3. Claude Code 생성 파이프라인

- 입력: 라이브러리 142개(`question_hooks.{mcq_seed,diagnosis_seed}` + `code_examples`(취약/안전) + `diagnosis.checklist`(composite 루브릭))
- 방식: REBUILD43/44 에이전트 배치 패턴. 1 에이전트 = 수 챕터, 출처 원문 기반(지어내기 금지).
- 생성: `kisa-module/seed/v3/<stage>/<chapter_code>.json` 69파일
  - DSG 20챕터 × 8문항(mcq3+diag2+composite1+blank2) = 160
  - IMP 49챕터 × 7문항(mcq3+diag2+blank2) = 341
  - 합 **501** (mcq207·diagnosis138·composite20·blank136)
- 검증: kisa-validate 전수 에러 0. UPSERT 키(weakness_code+lang+diff) 중복 0, weakness_code 501개 고유.

## §4. 운영 적용 (롤백 가능)

순서(안전): 마이그 → v3 import(공존) → v3 501 검증 → 기존 폐기(`created_at < T`).
- import: 501 INSERT, 실패 0
- 기존 378 `is_active=false` (삭제 아님 — 복구 가능)
- 최종 active 501 / 전체 879

## §5. 검증 / 영향

| 항목 | 결과 |
|------|------|
| validate | ✅ 전수 에러 0 |
| 운영 DB | ✅ active 378→501, 기존 보존 |
| 프론트 빌드 | ✅ 통과 |
| api 구문 | ✅ scorer/attempt/exam OK |
| 배포 | 🟡 src+api 변경 → Cloud Run 재배포(aitutortwo-prod) |

## §6. 다음 단계
1. 앱 실전 풀이 QA(로그인 후): composite 산출물 검토·진단보고서·rubric 채점, mcq 선지별 해설
2. 시험 모드 composite 출제 밸런스 조정
3. blank 동의어 보강

---

**완료 일시**: 2026-06-16 KST
**연관 문서**: REBUILD43(library), REBUILD44(course), `migrations/005`, `seed/v3/**`
