# REBUILD75 — 코드퀴즈 풀 5개 문서 확장 (303 → 721문항)

> **작성**: 2026-07-03 KST
> **범위**: `scripts/build-kisa-codebank.mjs`, `scripts/build-kisa-code-quiz.mjs`, `src/data/kisa-codebank.json`, `src/data/kisa-code-quiz.json`, `kisa-module/seed/codeid/codeid.seed.json`, 운영 DB `kisa_questions`
> **목적**: 코드 약점드릴/코드퀴즈 문항 풀을 기존 2개 자료원(진단가이드·2026교재)에서 **5개 공식 문서 전체**로 확장. REBUILD74 의 출처 다중선택 칩이 5개로 늘어난다.

---

## §1. 결과

| 출처 | 문항 | 비고 |
|---|---|---|
| library (진단가이드 2021) | 267 | 기존 266 + REBUILD72 backfill 로 추가된 IMP-IV-09 안전코드 1 |
| kisec2026 (2026 교재) | 37 | 기존 그대로 (진단가이드와 중복 249건 자동 제외) |
| **devsec2021 (개발보안 가이드)** | **192** | 신규 — library 와 중복 79건 제외 후 C#·C 변형 등 고유분 |
| **jssec2023 (JS 가이드)** | **100** | 신규 |
| **pysec2023 (Python 가이드)** | **125** | 신규 |
| **합계** | **721** (취약 354 / 안전 367) | 기존 303 + 신규 418 |

DB 적재: `kisa-seed-codeid.mjs` — 삽입 418 · 갱신 303 · 실패 0. 운영 DB unnest(tags) 집계로 5개 출처 721문항 확인.

## §2. 핵심 설계 — 기존 진도·SRS 보존

- **CQ id 보존 맵**: 재생성 시 기존 `kisa-codebank.json` 을 읽어 `정규화코드+안전여부 → 기존 CQ id` 맵을 만들고, 같은 코드는 같은 id 를 재사용. 신규 코드만 max seq 이후 발번(CQ-0304~). → 검증: 기존 303문항 전부 없어짐 0 · 코드변경 0 · 약점변경 0.
- 시드 UPSERT 는 chapter_code(CQ-XXXX) 기준이므로, id 가 보존되는 한 kisa_questions uuid 불변 → 사용자 attempts·SRS·진도 안전.
- SOURCES 순서(library → kisec2026 → devsec2021 → jssec2023 → pysec2023)가 중복 코드의 선점(=id 소유) 순서. 앞으로도 순서를 바꾸면 안 된다.

## §3. 자료원별 약점 매핑 — 제목 정규화

- jssec/devsec/pysec 은 약점 번호 체계가 정본(IMP-*)과 달라(예: JS-IV-13 = IMP-IV-15) **id 직매칭 불가** → `normTitle()` 정규화 제목 매칭 추가.
- 정규화 규칙: NFC + 소문자 + 괄호 병기 제거(XSS/CSRF/TOCTOU) + 공백·구분자 제거 + 유의어 치환(패스워드→비밀번호, 해쉬→해시, 않은→않는, 메소드로부터→메소드부터).
- 미매칭 로그로 검증: devsec DSG 설계항목 3건만 미매칭(의도된 제외 — 설계 코드예시는 49개 구현약점이 아님). 나머지 전량 매칭.

## §4. 파급 효과 (코드 무변경으로 자동 반영)

- 코드 약점드릴 랜딩(REBUILD74): progress bySource 가 5개 출처를 반환 → 출처 칩 5개 자동 노출.
- 코드퀴즈(비기록 연습, `/kisa/code-quiz`): 번들 `kisa-code-quiz.json` 721문항으로 갱신.
- 그림/이론 등 다른 유형 무영향. 해설(explanation)은 기존 조합 템플릿 그대로, 출처 라벨 5종 추가.

## §5. 검증

- 재생성 안정성: 동일 입력 재실행 시 diff 0 (id 보존 맵 + 결정적 셔플).
- build:fe 정상. 시드 적재 실패 0. 운영 DB 분포 = 기대치 일치.
