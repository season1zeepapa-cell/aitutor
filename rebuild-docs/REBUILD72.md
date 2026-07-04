# REBUILD72 — 5개 공식 문서 지식 라이브러리 완성 + 예시코드 라이브러리 신설

> **작성**: 2026-07-03 KST
> **범위**: `kisa-module/library-devsec2021/`(신규 69), `kisa-module/library-pysec2023/`(신규 46), `kisa-module/library/`·`library-jssec2023/`(전수 보완), `scripts/build-kisa-library.mjs`, `src/tabs/KisaTab/CodeLibrary.jsx`(신규 화면), Dashboard/라우팅/배지
> **목적**: KISA 공식 자료 5종 전부를 자료원(source) 단위 지식 라이브러리로 구축하고, 각 문서의 예시 코드를 **전수(全數)** 추출해 49개 보안약점 표준 그룹 순서로 취약/안전 코드를 조회하는 화면을 신설한다.

---

## §1. 자료원 최종 구성 (kisa-library.json v2, 총 380 항목)

| source id | 문서 (원본 PDF, kisa-pool/processed/) | 항목 | 코드보유 | 취약/안전 | 정탐/오탐 |
|---|---|---|---|---|---|
| `library` | 소프트웨어_보안약점_진단가이드(2021) | 69 (DSG20+IMP49) | 49 | 133/134 | 90/69 |
| `course` | 2025 양성과정 교재 | 73 | 0 | - | - |
| `kisec2026` | KISEC 2026년 기본과정 교재 | 81 | 49 | 142/144 | 87/69 |
| `jssec2023` | Javascript 시큐어코딩 가이드(2023 개정) | 42 | 41 | 48/52 | - |
| **`devsec2021`** ⭐신규 | 소프트웨어 개발보안 가이드(2021.12.29) | **69 (DSG20+IMP49)** | 52 | 136/139 | - |
| **`pysec2023`** ⭐신규 | Python 시큐어코딩 가이드(2023 개정) | **46 (IMP)** | 45 | 60/65 | - |

- 코드 prefix: `DEV-*`(구현 49: IV17·SF16·TS2·EH3·CE5·EN4·AA2), `DEV-DSG-*`(설계 20: IV10·SF8·EH1·SC1), `PY-*`(46: IV16·SF16·TS2·EH3·CE3·EN4·AA2 — Python 가이드는 메모리버퍼·해제자원·초기화변수 등 3항목이 원문에 없음).
- slug 는 기존 자료원(library/jssec2023)의 동일 약점 slug 를 재사용 → 자료원 간 약점 매칭 일관성 유지.
- devsec2021 은 Java 중심이지만 원문에 있는 C#·C 예시도 lang 필드로 구분해 전부 수록.

## §2. 전수(全數) 추출 방법론

1. `pdftotext -layout` 로 텍스트화 → 절/항목 시작 라인맵 작성 → 라인 범위 단위로 병렬 추출 에이전트 투입.
2. **전수 원칙**: 범위 내 "안전하지 않은 코드 (예시|의 예)" / "안전한 코드 …" / "정탐코드의 예" / "오탐코드의 예" 헤더를 grep 으로 계수하고, 추출 블록 수와 대조. 차이는 사유(페이지 넘김 재게재 병합, 산문 문장 오탐)를 항목별로 명시.
3. 정리 규칙: 코드 줄번호 프리픽스(`12:`/`12.`) 제거, 스마트 따옴표→ASCII, `￦`→`\`, 러닝헤더/세로 사이드바 잡음 제거, 페이지 분단 코드 병합. **원문 자체의 오탈자는 보존**하고 note 에 표기 (예: PY `passowrd`, DEV LDAP 의 C# 헤더 오기).

## §3. 기존 자료원 전수 검증 결과 (backfill)

- **library(진단가이드)**: 원문 헤더 519 vs 저장 422 의 갭을 49항목 전수 대조 → 대부분 **페이지 넘김 헤더 재게재 계수 착시**로 판명. 실누락은 **4건만**: IMP-IV-01 정탐 3건(JDO·Persistence·Hibernate 문자열 연결) + IMP-IV-09 안전 1건(XPathFilter) → 추가 완료.
- **jssec2023**: 코드 누락 0. 대신 과거 생성 손상 5파일 발견·수정 — overview 문자열 안에 `</overview>\n<parameter name="impact">…` 도구 태그 잔재(JS-IV-12/13, JS-SF-11/14, JS-EN-02) → impact 필드로 분리, JS-IV-13 의 applies_to 복원.
- **kisec2026**: 원문 마커 148 대비 저장 286+진단 156 으로 초과 커버(진단가이드 병합분) — 누락 없음.

## §4. 빌드 스크립트 (`build-kisa-library.mjs`)

- `devsec2021Dir`/`pysec2023Dir` 자료원 추가. devsec 은 stage 필드(design/implementation)로 mapLibrary 가 기존 정렬(설계→구현, 분류 표준순) 그대로 처리 — chapter_code 가 `DEV-DSG-*` 여도 category/stage 필드 기반이라 코드 파싱 무관.
- mapLibrary detail 에 `공격 영향`(impact)·`사고사례`(incident_cases) 항목 추가 — 신규 자료원의 필드가 상세 화면에 노출되도록.

## §5. 예시코드 라이브러리 화면 (신규)

- **`src/tabs/KisaTab/CodeLibrary.jsx`** — 라우트 `/kisa/code-library`, Dashboard 에 "💾 예시코드 라이브러리" 버튼.
- 구조: 문서(자료원) 칩 선택(개발보안→진단가이드→2026교재→JS→Python) → 49개 약점 표준 그룹(입력검증→…→API오용, order 정렬 유지) 섹션 → 항목 행(코드 블록 수 배지) 펼침 → `CodeSection`(LibraryFab 재사용)으로 ❌취약/✅안전(+정탐/오탐) 렌더.
- 검색: 약점명·코드 내용·언어·분류 전체 필터.
- 자료원 배지: LibraryFab·QuestionLibraryModal 의 SOURCE_BADGE 에 jssec2023(기존 누락)·devsec2021·pysec2023 추가.

## §6. 검증

- 신규/수정 JSON 전수 `json.load` 파싱 통과 (devsec 69 + pysec 46 + 보완 7).
- `npm run build:lib` → 380 항목 (library 69 + course 73 + kisec2026 81 + jssec2023 42 + devsec2021 69 + pysec2023 46).
- `npm run build:fe` 정상 — `CodeLibrary-*.js` 청크 생성, kisa-library 청크 1.80MB(gzip 432KB).

## §7. 후속 과제

- devsec2021·pysec2023 의 원문 오탈자(가이드 원문 유래) 노출 여부 검토 — note 에 표기돼 있으나 화면에서 안내 문구로 구분할지.
- kisa-library 청크가 1.8MB 로 성장 — 자료원별 동적 분할(lazy chunk) 검토.
- course(양성과정) 자료원은 코드예시가 없어 예시코드 라이브러리에서 제외됨(정상).
