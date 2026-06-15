# REBUILD45 — 자료 라이브러리 앱 연결 + 플로팅 메뉴

> **작성**: 2026-06-15 KST
> **트리거**: 사용자 요청 — "라이브러리 앱 연결 + 아코디언 방식으로 검색·참조하는 플로팅 메뉴를 우측 상/하단에 추가 (상단이동 버튼과 겹치지 않게)"
> **범위**: library(69)+course(73)=142개 자료를 앱에 번들하고, 전역 플로팅 라이브러리 메뉴 신설
> **결과**: 우측 하단 플로팅 버튼 → 드로어 패널(아코디언 + 검색), 청크 분리로 초기 번들 무영향

---

## §0. 결론 요약

| 산출물 | 내용 |
|--------|------|
| 데이터 합본 | `src/data/kisa-library.json` — 142개 통합 인덱스 (240KB) |
| 합본 스크립트 | `scripts/build-kisa-library.mjs` (`npm run build:lib`) |
| 플로팅 메뉴 | `src/components/LibraryFab.jsx` — 아코디언 + 검색 |
| 앱 연결 | `App.jsx` 전역 마운트 (lazy → 별도 청크 252KB) |

---

## §1. 데이터 연결 — Docker 빌드 호환이 관건

**문제**: `kisa-module/library`·`course` 는 `kisa-module/` 아래인데, Dockerfile frontend-builder 는 `src/`·`public/` 만 COPY 한다. 직접 import 하면 **배포 빌드가 깨진다**.

**해결**: 빌드 전 `scripts/build-kisa-library.mjs` 로 합본을 `src/data/kisa-library.json` 에 생성 → **git 커밋**. Docker 는 이 커밋된 json 을 src 와 함께 번들한다 (kisa-module 불필요).

- `build:lib` 는 로컬 전용 (kisa-module 이 있는 환경). `build:fe` 에는 넣지 않음 (Docker 에 kisa-module 없으므로).
- 합본 스키마: `{ sources: [{ id, label, count, items: [{ id, title, source, group, category, summary, keywords, cwe, detail[] }] }] }`

---

## §2. 플로팅 라이브러리 메뉴 (LibraryFab)

- **버튼 위치**: `fixed right-4 bottom-32 z-50` — 상단이동 버튼(`bottom-20`) **바로 위**에 세로 배치 → **겹치지 않음**.
- **패널**: 우측 드로어(`max-w-md`, full height), `z-[60]`.
- **아코디언**: 자료원(진단가이드/교재) → 분류·단원 그룹 → 항목 → 클릭 시 상세(요약·보안대책·진단방법·정탐/오탐·시험포인트·키워드).
- **검색**: 제목·id·분류·요약·키워드 전체 필터 (검색 시 평면 결과).

---

## §3. 확장성 — "계속 추가" 구조

새 자료를 추가하려면:
1. 새 자료를 `kisa-module/<new>/` 에 카드(json)로 추가
2. `build-kisa-library.mjs` 에 `sources` 항목 추가 + `npm run build:lib`
3. 끝 — LibraryFab 은 `sources` 를 순회하므로 **자동 노출** (UI 수정 불필요)

---

## §4. 검증 / 영향 범위

| 항목 | 결과 |
|------|------|
| 빌드 | ✅ 통과, LibraryFab 별도 청크(252KB) 분리 → 초기 번들 무영향 |
| 배포 빌드 | ✅ 안전 (src/data 합본만 사용, kisa-module 비의존) |
| 기존 UI | 🟢 상단이동/BottomNav 와 위치 충돌 없음 |
| 배포 반영 | 🟡 **src 변경이므로 Cloud Run 재배포로 실제 앱에 반영됨** |

---

## §5. 다음 단계

1. 항목 상세에서 `related_library` 클릭 → 해당 카드로 점프 (교차 참조)
2. 학습화면(KisaTab)에서 특정 chapter_code 의 라이브러리 카드 인라인 표시
3. 문제 자동 생성 — `question_hooks`/`exam_points` 활용

---

**완료 일시**: 2026-06-15 KST
**연관 문서**: REBUILD43(library), REBUILD44(course), `src/components/LibraryFab.jsx`
