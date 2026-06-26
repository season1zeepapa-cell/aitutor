# REBUILD63 — 한글 이미지 운영 미표시 버그 수정 (NFD → ASCII 사본 서빙)

> **작성**: 2026-06-26 KST
> **트리거**: 진단방법 이미지 1-1~1-7 재반영 후 운영 확인 중, **한글 파일명 이미지가 운영에서 안 보이는** 문제 발견.
> **결과**: 한글(NFD) 파일명 회피 — 빌드 시 매칭 이미지를 **chapter_code 기반 ASCII 파일명 사본**으로 복사하고 그 경로를 서빙. 진단방법(diagnosis)·jssec 다이어그램(library)·XSS 유형 이미지 전부 적용.

---

## §0. 증상 / 원인

- 운영에서 `/q-images/diagnosis/1-1 SQL 삽입.png`, `/q-images/library/SQL 삽입.png` 등 **한글 파일명 이미지가 `text/html`(404→SPA fallback)** 반환. ASCII 파일명(`exam140_q13.jpg`)은 정상.
- 확정 테스트: 같은 파일을 **NFC URL → 실패 / NFD URL → 정상(image/png)**.
- **원인**: macOS에서 만든 한글 파일명이 **NFD(자모분리)**로 저장됨. 로컬 macOS는 파일명 정규화를 무시해 매칭됐지만, **운영 리눅스 컨테이너는 바이트 단위 비교**라 브라우저의 NFC 요청과 불일치 → 404.
- 영향: 진단방법 49개 + jssec 그림퀴즈 40개 + XSS 유형 3개 (한글 파일명 전부). ※ jssec 그림퀴즈도 그간 운영에서 미표시 상태였음.

## §1. 해결 — ASCII 사본 서빙 (`build-kisa-library.mjs`)

- `asciiCopy(folder, origFile, base)` 헬퍼: 매칭된 한글 원본을 **`slug(chapter_code)` 기반 ASCII 파일명**으로 같은 폴더에 복사하고 ASCII 절대경로 반환.
  - 진단방법: `IMP-IV-01` → `/q-images/diagnosis/imp-iv-01.png`
  - jssec 다이어그램: `JS-IV-01` → `/q-images/library/js-iv-01.png`
  - XSS 유형: `JS-IV-04` + 유형 → `/q-images/library/js-iv-04-reflective-xss.png` 등
- 매칭 맵(`imageMap`·`diagnosisByCode`·`diagnosisMap`) 값을 경로 → **원본 파일명**으로 변경, `resolveImage`/`resolveDiagnosisImage`/`typeImages` 가 `asciiCopy` 경유.
- 한글 원본은 **소스로 유지**(사용자가 약점명으로 제공하는 워크플로우 보존), ASCII 사본이 실제 서빙. 사본은 git 커밋(로컬 `build:lib` 산출물 → Docker COPY).

## §2. 검증

- `build:lib` → ASCII 사본 diagnosis 49 + library(js-) 43 생성, JSON 경로 ASCII 확인 ✅
- `build:fe` → dist 에 ASCII 사본 복사 확인 ✅
- 배포 후 운영에서 `imp-iv-01.png` 등 `image/png` 정상 서빙 확인 (아래 배포 시).

## §3. 교훈

- **q-images 등 정적 자산 파일명에 한글 금지** — macOS NFD ↔ 리눅스 바이트비교 불일치. 신규 이미지는 ASCII 사본 자동 생성 경로를 타므로 사용자는 계속 약점명(한글)으로 제공 가능.
- 운영 이미지 점검 시 `%{http_code}` 만으로 불충분 — `%{content_type}`(image/* 여부)까지 확인해야 SPA fallback 오탐을 잡는다.
