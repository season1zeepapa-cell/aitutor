# REBUILD61 — 이론교육(구현단계 49) : 원인·영향·대응·진단방법 4박스

> **작성**: 2026-06-26 KST
> **트리거**: 사용자 요청 — KISEC 2026 기본과정 지식 라이브러리를 활용해 **이론교육** 추가. 양식은 교재의 약점별 **1.원인 2.영향 3.대응 4.진단방법** 4박스(구현단계부터). 원인/영향/대응은 **교재 문구 동일**, 진단방법은 **이미지** 제공 예정.
> **결과**: 구현단계 49개 약점의 원인/영향/대응 박스를 교재 PDF에서 그대로 추출(`theory`), 4박스 이론교육 화면(`/kisa/theory`) 신설. 진단방법은 약점명 이미지 자동매칭(`public/q-images/diagnosis/`). **DB/API 무변경**(번들 직참조).

---

## §0. 결론 요약

| 작업 | 파일 | 결과 |
|------|------|------|
| 원인/영향/대응 박스 추출 | `kisa-module/library-kisec2026/IMP-*.json` (49개 `theory`) | 멀티에이전트 워크플로우, 교재 문구 그대로 |
| 진단방법 이미지 매칭 | `scripts/build-kisa-library.mjs` | `public/q-images/diagnosis/` 약점명 자동매칭(`diagnosisImage`) |
| 이론교육 화면 | `TheoryList.jsx`, `TheoryDetail.jsx`, `index.jsx`, `Dashboard.jsx` | 4박스 양식(Image #4) + 대시보드 진입 |

---

## §1. 배경 / 확인

- KISEC 2026 기본과정은 이미 `kisec2026` 자료원으로 라이브러리화됨([[aitutor-kisec2026-library]], 81개 = 구현 49·설계 20·이론 12).
- 기존 항목에 `impact`·`countermeasure`(교재 기반)는 있으나 **`원인` 박스는 없음**. 교재 4박스를 정확히 재현하려면 원인/영향/대응을 PDF 박스에서 그대로 추출.
- 교재 PDF의 교재 페이지 == PDF 물리 페이지(**오프셋 0**). 각 약점 JSON `source.pages` 시작 페이지에 4박스 표 존재.

## §2. 원인/영향/대응 박스 추출 (워크플로우)

- `kisec-theory-boxes` 워크플로우 — 구현단계 49개 약점을 병렬 추출. 각 에이전트가 `pdftotext`로 약점 페이지의 "원인/영향/대응" 박스를 **불릿 단위 배열**로 추출(진단방법 플로우차트는 제외, 이미지로 처리). 49/49 성공.
- 결과를 각 약점 JSON 의 `theory: { cause[], impact[], countermeasure[] }` 로 저장(교재 원문 그대로, 의역·요약 금지).
- 검증: SQL삽입 원인 1·영향 3·대응 4 항목이 교재(Image #4)와 일치.

## §3. 진단방법 이미지 자동매칭

- 폴더 `public/q-images/diagnosis/` — 사용자가 **약점명.png**(예: `SQL 삽입.png`)로 제공.
- `build-kisa-library.mjs` 가 폴더 스캔 + `normalizeName`(NFC) 으로 `title` 매칭 → `diagnosisImage` 자동 연결. jssec 공격흐름도(`q-images/library/`)와 **다른 폴더**라 파일명 충돌 무관.

## §4. 이론교육 화면

- **목록** `/kisa/theory`(`TheoryList`) — 구현단계 약점을 분류(입력검증~API오용)별로 나열. `theory` 보유 항목만.
- **상세** `/kisa/theory/:code`(`TheoryDetail`) — Image #4 양식 4박스:
  - 원인(회색)·영향(빨강)·대응(초록): `theory.*` 불릿 리스트(교재 문구).
  - 진단방법(회색): `diagnosisImage` 우선, 없으면 `diagnosis.method` 텍스트 fallback.
- 진입: `Dashboard` 에 "📚 이론교육" 카드 추가. 라우트 `index.jsx`.

## §5. 검증

- 빌드 `build:lib`(265개) + `build:fe` 에러 0 ✅
- `theory` 49/49 보유, SQL삽입 원인/영향/대응 교재 일치 ✅
- 화면: dev + Playwright 로 `/kisa/theory/IMP-IV-01` 4박스 렌더 확인(진단방법은 이미지 전 텍스트 fallback) ✅

## §6. 남은 작업

- **진단방법 이미지 49개** 수령 → `public/q-images/diagnosis/` 투입 시 자동 연결(재빌드).
- 설계단계(DSG 20)도 동일 양식 확장(원하면).
- 원인/영향/대응 자동추출 일부 약점 육안 검수(SQL삽입 등 확인, 전수는 권장).
