# REBUILD59 — JS 시큐어코딩 가이드(2023) 지식 라이브러리화 + 그림으로 약점 맞히기 퀴즈

> **작성**: 2026-06-26 KST
> **트리거**: 사용자 요청 — ① `Javascript 시큐어코딩 가이드(2023년 개정본)` PDF를 지식 라이브러리로 구축(문제 출제·학습 활용), ② 각 보안약점 "개요"의 공격흐름도 이미지를 약점명으로 직접 제공 → 자동 연결, ③ 그림을 보여주고 약점을 맞히는 문제 출제.
> **결과**: JS 가이드 42개 약점을 별도 자료원(`jssec2023`)으로 라이브러리화, 약점명↔이미지 자동매칭, "그림으로 약점 맞히기" 퀴즈(43문제) 추가. **DB/API 무변경**(번들 직참조, [[REBUILD56]]~[[REBUILD58]] 패턴 계승).

---

## §0. 결론 요약

| 작업 | 파일 | 결과 |
|------|------|------|
| JS 가이드 라이브러리 | `kisa-module/library-jssec2023/*.json` (42개) | 별도 자료원 `jssec2023` 등록, 전체 265개 |
| 빌드 자료원 + 이미지 자동매칭 | `scripts/build-kisa-library.mjs` | jssec2023 추가, 약점명↔파일명 NFC 매칭, XSS typeImages |
| 그림 약점 퀴즈 | `src/tabs/KisaTab/DiagramQuiz.jsx` | 약점 40 + XSS 유형 3 = 43문제 |
| 학습 화면 개요도 | `src/tabs/KisaTab/StudyDetail.jsx`, `Study.jsx` | 개요도 섹션 + 퀴즈 진입 버튼 |

이미지 43개(사용자 제공): 약점 40개 연결 + XSS 상세 3개. 이미지 없는 약점 2개(`부적절한 예외 처리`, `제거되지 않고 남은 디버그 코드`)는 텍스트만.

---

## §1. JS 가이드 라이브러리화 (`library-jssec2023`)

**목표**: `Javascript 시큐어코딩 가이드(2023)`의 제2장 보안약점 42개를 `kisec2026`과 동일 틀의 약점카드 JSON으로 구축.

- **추출 방식**: 멀티에이전트 워크플로우(`jssec-extract`)로 41개를 병렬 추출(+SQL삽입 JS-IV-01 샘플 수작업). 각 에이전트가 `pdftotext`로 해당 섹션을 찾아 **개요(가)·안전한 코딩기법(나)·코드예제(다)**를 StructuredOutput 스키마로 반환.
  - 결과 40/41 성공. 실패 1개(`JS-EH-02 오류상황 대응 부재`)는 PDF에서 직접 추출해 보완.
  - 에이전트가 코드를 HTML 이스케이프(`&gt;` 등)로 반환 → 저장 시 1패스 디코딩으로 복원.
- **chapter_code 체계**: `JS-{분류}-{NN}` (IV/SF/TS/EH/CE/EN/AA). 전부 `stage: implementation`.
- **필드**: `title`(매칭키)·`overview`·`impact`·`countermeasure`·`code_examples[{lang,vulnerable,safe,note}]`·`applies_to`(VanillaJS/ReactJS/ExpressJS)·`cwe`·`source`.
- **빌드**: `build-kisa-library.mjs`에 `jssec2023Dir` 자료원 추가 → 번들 `src/data/kisa-library.json`의 `sources`에 `{id:'jssec2023', label:'JS 시큐어코딩 가이드'}`.

## §2. 약점명 ↔ 이미지 자동매칭

**배경**: 사용자가 각 약점의 개요 공격흐름도를 **약점명 파일명**(`SQL 삽입.png` 등)으로 `public/q-images/library/`에 직접 제공.

- **자동매칭**: `build-kisa-library.mjs`가 이미지 폴더를 스캔, `normalizeName`(소문자+공백/괄호/구분자 제거)으로 `title`과 파일명을 비교해 `image: /q-images/library/<파일>` 자동 연결. JSON에 `image` 수동 기입 불필요(명시 시 우선).
- **macOS NFD 함정**: macOS 파일명은 NFD(자모분리)라 코드 문자열(NFC)과 안 맞음 → `normalizeName`에 `.normalize('NFC')` 필수. (없으면 0건 매칭)
- **XSS 상세타입**: `JS-IV-04-xss.json`의 `type_images`(Reflective/Persistent/DOM) → 빌드가 `typeImages:[{type,desc,image}]`로 resolve.
- 경로 컨벤션은 기존 `image_url`과 동일한 절대경로(`/q-images/...`, server.js 정적 서빙). vite `publicDir`이 빌드 시 dist로 복사.

## §3. 그림으로 약점 맞히기 (`DiagramQuiz`, `/kisa/diagram-quiz`)

- **문제 풀**: `jssec2023` 자료원 직참조.
  - 약점 맞히기 40문제: `image` 있는 항목, 4지선다(정답+무작위 오답3, 보기 후보 42개 제목).
  - 유형 맞히기 3문제: `typeImages`(XSS Reflective/Persistent/DOM) → 유형명 맞히기.
- **해설**: jssec2023은 DB에 없으므로 `/kisa/study/:code`(DB 조회) 링크 대신, 정답 시 **개요+안전한 코딩기법을 번들에서 직접 노출**(자체 완결).
- 진입: `Study.jsx` 헤더에 "🖼️ 그림으로 약점 맞히기" 버튼, 라우트 `index.jsx`.

## §4. 검증

- 빌드: `build:lib`(265개) + `build:fe`(에러 0) ✅
- 이미지 매칭: 40개 연결 / 이미지 없는 2개 확인 / XSS typeImages 3개 ✅
- 한글·공백·괄호 파일명 이미지 서빙 `HTTP 200`(encodeURI) ✅
- 퀴즈 화면: dev 서버 + Playwright로 렌더 확인(43문제, 다이어그램 로드, 4지선다) ✅
- JSON 42개 유효성 + HTML 엔티티 잔존 0 ✅

## §5. 주의 / 한계

- **40개 약점 본문은 AI 자동추출** — SQL/XSS/예외처리 등 일부만 육안 검수. 시험 출제 사용 전 **전수 검수 권장**(특히 코드예제 들여쓰기·누락).
- 이미지 없는 2개 약점은 그림퀴즈에서 자동 제외(`image` 빈 값).
- `scripts/extract-diagram-images.mjs`(REBUILD 이전 진단가이드 자동크롭 시도)는 방향 변경(수동 이미지 제공)으로 **미사용** — 무해하나 정리 대상.

## §6. 남은 작업

- jssec2023 자동추출 본문 전수 검수.
- XSS 외 약점의 상세타입 이미지(있으면) 확장.
- `StudyDetail`이 jssec2023 번들 항목도 학습 지원(현재 DB 자료원만 상세 진입).
- 자료 라이브러리 모달(`QuestionLibraryModal`)에서 jssec2023 노출 확인.
