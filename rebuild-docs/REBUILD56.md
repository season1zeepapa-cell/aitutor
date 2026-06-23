# REBUILD56 — KISEC 2026 기본과정 교재 별도 라이브러리화 (kisec2026 source)

> **작성**: 2026-06-23 KST
> **트리거**: 사용자 요청 — 최신 교육자료(`KISEC_2026년_SW보안약점 진단원 기본과정.pdf`, 570p)를 **별도 자료원**으로 라이브러리화. 문제 작성·조회 시 기존 자료와 **구분 관리**되기를 원함.
> **결과**: 2026 교재 전체를 `kisec2026` 자료원으로 추출(81개 항목 = 이론 12 + 약점 69), 조회 화면에서 초록 "2026교재" 배지로 분리 노출.

---

## §0. 결론 요약

| 작업 | 산출물 | 결과 |
|------|--------|------|
| 자료원 분리 구조 활용 | `kisa-library.json` `sources[]` | 기존 `library`/`course`에 `kisec2026` 추가 |
| 페이지 지도 | `kisa-module/library-kisec2026/MAP.md` | 570p 단원·항목별 추출 범위 정본 |
| 이론영역 추출 | `K26-*.json` 12개 | Ⅰ~Ⅲ·Ⅳ-01·Ⅵ 목차 단위 카드 |
| 약점항목 추출 | `DSG-*/IMP-*.json` 69개 | 설계 20 + 구현 49, 2026 교재로 보강 복제 |
| 빌드 통합 | `scripts/build-kisa-library.mjs` | 약점/이론 카드 자동 분기 매핑 |
| 조회 배지 | `QuestionLibraryModal.jsx`, `LibraryFab.jsx` | 초록 "2026교재" 배지 |

빌드: `library 69 + course 73 + kisec2026 81 = 223개`. 프론트 빌드 ✓, JSON 0개 깨짐.

---

## §1. 배경 — 이미 "자료원 분리" 구조였다

`src/data/kisa-library.json`은 REBUILD45부터 `{version, sources[]}` 구조다. 기존 두 자료원:
- `library` — 2021 진단가이드 약점항목 69개 (`kisa-module/library/`, chapter_code 기반)
- `course` — **2025** 양성과정 교재 73개 (`kisa-module/course/`, unit_code 기반)

즉 2026 교재는 `course`의 다음 버전 성격이며, **세 번째 source 추가**가 기존 패턴과 정확히 일치한다. `LibraryFab`은 `sources`를 자동 순회(REBUILD45 주석: "새 자료원은 sources에 추가만 하면 자동 노출")하므로 구조 변경이 거의 없다.

## §2. 추출 전략 (하이브리드)

PDF는 PowerPoint 기반이라 `pdftotext -layout`로 깔끔히 추출됨(`_extract/full.txt`, form feed=페이지 경계). 페이지 지도는 `MAP.md` 참조.

- **약점항목(Ⅳ-02, Ⅴ 전체)** → 기존 `library/`의 chapter_code 체계(DSG-*/IMP-*)로 **전체 복제 + 2026 보강**. 기존 파일을 베이스로 `source.doc`/`pages`를 2026으로 교체하고, 교재에서 발견한 신규·변경분만 반영. `diagnosis.requirements`(요구사항→checklist→methods→artifacts) 4계층 구조 전량 보존 — **주관식 출제 핵심**.
- **이론영역(Ⅰ~Ⅲ, Ⅳ-01, Ⅵ)** → `course` 스키마(unit_code) 재사용. 신규 코드 `K26-<단원>-<소단원>`. `exam_points`(객관식 출제), `key_concepts`(용어), `keywords`(주관식 채점)가 출제 소재.

## §3. 2026 교재 주요 신규·변경 (보강 반영분)

- **생성형 AI 위협(Ⅰ-03)** — OWASP Top 10 for LLM 2025, 프롬프트 인젝션·탈옥·방어 (2026 신규 단원)
- **N2SF 국가 망 보안체계(Ⅰ-05)** — C/S/O 등급분류, 제로트러스트 오버레이 (2026 신규)
- **암호 기준 현행화** — FIPS 140-2→**140-3**, TLSv1.2 이상, SHA-3/LEA/LSH 등 권고 알고리즘 확대 (DSG-SF-05/06/08)
- **비밀번호 정책** — 10자리 이상 기준, 재설정 본인인증 수단 현행화 (DSG-SF-03, IMP-SF-09)
- **신규 코드예제** — XXE 파서별 비활성화, Lucy XssFilter, pickle+HMAC 역직렬화, DNSSEC 등

대부분의 약점항목은 2021 베이스와 본문이 수렴하여 충실 복제가 정답이었고, 변경은 교재 본문 근거가 있는 것만 반영(추측 금지).

## §4. 빌드 통합 방식

`build-kisa-library.mjs`:
- `mapLibrary(d, src)`, `mapCourse(d, src)` — source 파라미터화(기존 호출은 기본값 유지, 무영향).
- `kisec2026Dir` 폴더를 읽어 **항목에 `chapter_code`가 있으면 약점카드(mapLibrary), `unit_code`면 이론카드(mapCourse)**로 분기. source는 `'kisec2026'` 주입.
- `_extract/`·`MAP.md`는 `readdirSync`의 `.json` 필터로 자동 제외. 폴더 미존재 시 `existsSync`로 안전.

조회 배지: `SOURCE_BADGE.kisec2026 = { label:'2026교재', cls:'emerald' }` (두 컴포넌트 동일).

## §5. 검증

- JSON 유효성: 81개 전부 통과(0 fail)
- id 중복: 0 (약점카드는 기존과 동일 chapter_code지만 source가 달라 검색키 `source+id`로 구분)
- 표시 필드: summary/g1 빈 항목 0
- `build:lib` ✓ (223개), `build:fe` ✓ (3.19s)

## §6. 남은 후속 작업 (이번 범위 밖)

1. **문항(question) source 태깅** — 2026 교재 기반 문제 작성 시 `origin:"kisec2026"` 식별 필드로 출제·관리 분리. (주관식 파이프라인 작업과 함께)
2. **주관식 출제 파이프라인** — DSG의 `diagnosis.requirements`·`question_hooks.diagnosis_seed`에서 "요구사항↔진단방법↔산출물" 복합서술형 자동 생성.
3. **예상문제 배치 적재** — 위 소재로 예상문제 미리 생성→DB 적재.
4. 운영 배포 — Cloud Run `aitutortwo-prod` (`--project` 명시 필수).

> 자료원 분리 인프라가 완성되어, 위 후속 작업은 모두 `kisec2026` 태그 위에서 진행 가능.
