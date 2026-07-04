# REBUILD74 — 코드 약점드릴 출처(자료원) 다중선택 필터

> **작성**: 2026-07-03 KST
> **범위**: `api/kisa-drill.js`, `src/tabs/KisaTab/CodeDrillHome.jsx`, `src/tabs/KisaTab/DrillSession.jsx`
> **목적**: 코드 약점드릴 랜딩 상단에 출처별 **다중선택 칩**을 추가해, 선택한 출처(자료원)의 문항만 진도 집계·출제 대상이 되도록 한다. 실제 문제 풀이 페이지(DrillSession)는 동일 구성 유지 — 파라미터만 전달.

---

## §1. 데이터 근거

- codeid 문항의 출처는 `kisa_questions.tags` TEXT[] 에 저장돼 있음 (`['codeid', <source>]`, build-kisa-codeid-seed.mjs). GIN 인덱스(idx_kisa_questions_tags) 존재 → `tags && $1::text[]` 배열 겹침 연산으로 효율 필터.
- 현재 풀(303문항)의 출처 분포: `library`(진단가이드) 266 + `kisec2026`(2026교재) 37.
- **후속 과제**: devsec2021·pysec2023·jssec2023 의 예시코드도 코드퀴즈 풀로 확장(build-kisa-code-quiz.mjs 재생성 + codeid 시드 적재)하면 칩이 자동으로 늘어남 — 서버·UI 는 6개 출처(ALLOWED_SOURCES)를 이미 지원.

## §2. 서버 (`api/kisa-drill.js`)

- `ALLOWED_SOURCES` 화이트리스트(library/course/kisec2026/jssec2023/devsec2021/pysec2023) + `sources=a,b` 쉼표 파라미터 파싱.
- `action=count` / `action=next`: `q.tags && $n::text[]` 조건 추가 (다중선택 = OR 매칭).
- `action=progress`: ① byCategory·overall 이 sources 필터를 반영, ② **`bySource`**(출처별 total/attempted, 필터 무관 전체 기준) 신규 반환 — 랜딩 칩의 개수 표시용. `unnest(q.tags)` CROSS JOIN LATERAL 로 집계.

## §3. 랜딩 (`CodeDrillHome.jsx`)

- 헤더 아래 "출처 선택 (다중선택 가능)" 칩 줄: [전체] + 출처별 `라벨 attempted/total` 칩.
  - 칩 토글 = 다중선택. 빈 선택 = 전체(필터 없음). [전체] 클릭 시 선택 해제.
  - 선택 변경 시 progress 를 sources 파라미터로 재조회 → 전체 진도바·그룹별 카드가 선택 기준으로 갱신.
- `go()` 가 `/kisa/drill?type=codeid&full=1&sources=...` 로 선택값 전달.
- 출처 라벨: 진단가이드/2025교재/2026교재/JS가이드/개발보안/Python가이드 (kisa-library 자료원 체계와 동일).

## §4. 풀이 세션 (`DrillSession.jsx`)

- `sources` searchParam 읽어 `action=count`·`action=next` 호출에 그대로 전달. 화면 구성 변경 없음 (요구사항: 풀이 페이지 동일 유지).
- `fetchNextQuestion` useCallback 의존성에 sources 추가.

## §5. 검증

- `node require` 모듈 로드 정상, `npm run build:fe` 정상.
- SQL 은 전부 parameterized (`$n::text[]`), 화이트리스트 통과값만 바인딩.
