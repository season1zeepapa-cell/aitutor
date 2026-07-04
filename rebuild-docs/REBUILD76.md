# REBUILD76 — 코드약점 드릴 출처별 전량 수록 + 중복제거 토글 (721 → 1049)

> **작성**: 2026-07-04 KST
> **범위**: `scripts/build-kisa-codebank.mjs`, `build-kisa-code-quiz.mjs`, `build-kisa-codeid-seed.mjs`, `kisa-seed-codeid.mjs`, `api/kisa-drill.js`, `src/tabs/KisaTab/{CodeDrillHome,CodeQuiz,DrillSession}.jsx`, 운영 DB `kisa_questions.dedup_key`
> **목적**: 코드예시 라이브러리 출처별 코드예시 수 = 코드약점 드릴 출처별 문제 수가 **일치**하도록, 드릴 문제풀을 출처별 전량 수록으로 전환. 대신 문제풀이 시 **중복 제거 토글**로 출처 간 동일 코드를 1문항으로 합쳐 풀 수 있게 한다.

---

## §1. 문제 — 전역 중복제거로 인한 불일치

기존 codebank 는 전역 중복제거(정규화 코드 1개당 1문항)라, 라이브러리 코드예시 수와 드릴 문제 수가 어긋났다.

| 출처 | 라이브러리 코드예시(취약+안전) | 기존 드릴(전역 dedup) | 신규 드릴(출처별 전량) |
|---|---|---|---|
| library | 267 | 267 | 267 |
| kisec2026 | 286 | **37** | 286 |
| devsec2021 | 275 | **192** | 271 |
| jssec2023 | 100 | 100 | 100 |
| pysec2023 | 125 | 125 | 125 |
| **합계** | 1053 | 721 | **1049** |

- devsec2021 이 275가 아닌 271인 이유: 설계단계(DSG) 항목 3개(DSG-IV-10·SF-07·EH-01)의 코드예시 4블록은 49개 구현약점에 매핑되지 않아 codeid(구현약점 식별)에서 제외 — 정상.
- 신규 드릴 출처별 수 = 라이브러리 수와 일치(devsec 설계분 제외).

## §2. 출처별 전량 + dedup_key

- `build-kisa-codebank.mjs`: 전역 중복제거 제거 → **같은 출처 안 완전중복(원문 재게재)만** 제거하고 출처 간 중복은 유지. 각 엔트리에 `dedupKey = (S|V)::정규화코드`(출처 무관 동일코드 판별) 부여.
- **id 보존**: 보존 맵 키를 `source::isSafe::code` 로 전환 → 재생성해도 기존 721문항의 CQ id 전부 불변(검증: 없어짐 0·변경 0). 신규 328문항만 CQ-0722~ 발번.
- 중복제거 시 고유 dedup_key = **721** (= 기존 전역 dedup 값과 정확히 일치).

## §3. DB — dedup_key 컬럼 (마이그레이션 겸 시드)

- `kisa-seed-codeid.mjs` 가 시작 시 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS dedup_key TEXT` + 부분 인덱스 생성(멱등). UPSERT 에 dedup_key 포함.
- 적재 결과: 삽입 328 · 갱신 721 · 실패 0. 운영 DB codeid 총 **1049** · 고유 dedup_key **721** · NULL 0 · 출처 분포 = §1 신규열 일치.

## §4. 중복제거 토글 (API)

- `api/kisa-drill.js` `dedup=true` 파라미터:
  - `count`/`progress`: 총계·진도를 `count(DISTINCT COALESCE(dedup_key, chapter_code))` 로 — 고유 코드 기준.
  - `next`: 각 dedup_key 그룹에서 대표 1개(현재 출처범위 내 `min(chapter_code)` = 출처 우선순위)만 후보로 좁힌 뒤 미시도 우선 서빙. SRS 복습 모드는 개별 문항이라 dedup 미적용.
- 대표 선정이 **선택된 출처 범위 내**에서 이뤄지도록 서브쿼리에 sources 필터 재적용(파라미터 인덱스 재사용) — 특정 출처만 골라도 그 안에서 중복제거.

## §5. UI 토글

- **CodeDrillHome**(전수학습): 출처 칩 카드 하단에 "중복 코드 제거" 체크박스. 켜면 progress 재조회로 진도·그룹수가 고유코드 기준으로 갱신되고, 드릴 진입 URL 에 `dedup=true` 전달.
- **CodeQuiz**(빠른연습): 번들 직참조라 클라이언트에서 dedupKey 별 대표(SOURCE_ORDER 우선) 필터. 동일 토글 UI.
- **DrillSession**: `dedup` 파라미터를 count/next 로 전달만(화면 구성 불변).

## §6. 검증

- 기존 721 CQ id 보존(코드·출처·안전여부 불변) 전수 대조 통과.
- 운영 DB 분포·dedup_key NULL 0 확인. build:fe 정상.
- dedup ON 시 총계 721 = 기존값. OFF 시 1049 = 출처별 전량.
