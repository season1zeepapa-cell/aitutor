# REBUILD87 — 진단코드(정탐/오탐) 블록의 문항화: codebank·codeid 1,049 → 1,359

> 2026-07-04. 선행: REBUILD86(라이브러리 학습 레이어). 사용자 결정: B안(카드 추가 + codeid 문항 신규 생성).

## §1. 배경

진단가이드·2026교재의 **진단코드(정탐=진짜 취약 / 오탐=사실 안전) 315블록**은 조회 모드에만 노출되고
블라인드 판별 카드·codeid 문항에는 빠져 있었다(REBUILD86 검증에서 확인).
정탐/오탐은 "안전해 보이는 취약 코드 / 취약해 보이는 안전 코드" — 판별 훈련 가치가 예시코드보다 높은 함정 사례라 문항화 결정.

## §2. 구현 — codebank 확장 한 곳으로 체인 전체 자동 파생

`scripts/build-kisa-codebank.mjs` 의 코드 후보 수집을 확장:
- 기존: codeExamples 의 vulnerable/safe 분해
- 추가: `diagnosisCode.truePositive → isSafe:false`, `falsePositive → isSafe:true` (전부 Java, desc 를 note 로)

이후는 기존 체인 그대로 재실행:
`build:codebank → build-kisa-code-quiz → build-kisa-codeid-seed → kisa-seed-codeid(DB UPSERT)`

## §3. id 안전성 (핵심 검증)

codebank 의 id 보존 로직(`prevIdByKey`: source+isSafe+code → 기존 CQ 재사용, 신규만 max 이후 발번) 덕분에:
- 기존 1,049개: **내용 변경 0 · 소실 0 · id 전부 보존** (git HEAD 대비 전수 비교)
- 신규 310개: **CQ-1050 ~ CQ-1359** 로 이어 발번 (진단코드 315 중 5개는 원문 재게재 중복이라 in-source dedup 으로 자동 제거: library 2 + kisec2026 3)

## §4. 결과 수치

| 축 | 이전 | 이후 |
|----|-----:|-----:|
| codebank 카드 (=블라인드 판별) | 1,049 | **1,359** (취약 696/안전 663) |
| kisa-code-quiz.json | 1,049 | 1,359 |
| DB codeid 문항 | 1,049 | **1,359** (삽입 310·갱신 1,049·실패 0, 전부 활성) |
| 카드↔문항 1:1 (SRS 매핑) | 유지 | **유지** — 전 카드에서 "복습에 추가" 동작 |

출처별 카드: kisec2026 439 · library 424 · devsec2021 271 · pysec2023 125 · jssec2023 100.
신규 310 분포: library 157 + kisec2026 153 (취약 177 / 안전 133).

부수 효과: 코드 약점드릴·실전 모의(codeid 5문항 슬롯)·CodeQuiz 풀도 1,359로 확장.

## §5. 참고

- DB 표본 검증: CQ-1350 → weakness_code IMP-EN-01, is_safe true, explanation 정상 생성.
- 시드 적재는 원격 DB라 1회 타임아웃 후 재실행으로 완료 (스크립트는 chapter_code 기준 UPSERT — 재실행 안전).
- 블라인드 세션의 저장 위치(localStorage 인덱스)는 카드 배열이 늘며 약간 어긋날 수 있으나 범위 체크로 안전(처음부터 다시 진행하면 됨).

## §6. 후속 — DSG-EH-01 단답형 2문항 생성 (같은 날, REBUILD85 §6-1 완료)

- 비활성 삭제로 비어 있던 유일한 챕터. 시드(blank-questions.json)의 구형 2문항(빈칸 1개·BLANK-A/B 코드)이 원인이었음 → 현행 규격(B1/B2, 다중 빈칸, 난이도 중/하)으로 신규 작성해 **시드 교체 + DB 삽입**.
- 내용: B1(중, 빈칸3 — 오류메시지 일반화·서버 로그·fail-secure) / B2(하, 빈칸2 — try-catch·fail-closed 기본 거부).
- 검증: scorer 자가채점 — 모범답·대체표기 100점, 무관 답 0점. 결과 **blank 138 = 69챕터 × 2 완성** (전 유형 챕터 공백 0).
- DB·시드 데이터만 변경 → 배포 불필요.
