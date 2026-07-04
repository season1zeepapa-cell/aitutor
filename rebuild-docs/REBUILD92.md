# REBUILD92 — 예시코드 라이브러리 코드 그룹 아코디언 UI

> 2026-07-04. 선행: REBUILD86(라이브러리 학습 레이어)·REBUILD91(온보딩 v5).

## §1. 배경

조회 모드에서 약점 항목을 펼치면 코드예시 전부(Java (JDBC API)·Java (MyBatis) 등 언어/프레임워크별 취약+안전 쌍 + 정탐/오탐 진단코드)가 한 번에 펼쳐져 스크롤이 과도했다. 사용자 요청으로 그룹별 접이식(아코디언)으로 개선.

## §2. 구현

- `CodeSection`(LibraryFab.jsx — 공용 컴포넌트)에 **`accordion` prop 추가**:
  - 그룹 단위 = 코드예시 1건(언어/프레임워크 라벨) + 진단코드 전체 1그룹.
  - 그룹 헤더: ▸/▾ + 라벨 + 배지(❌✅ 보유 표시, 진단코드는 🔴n 🟢m).
  - 그룹이 2개 이상이면 기본 접힘, 1개뿐이면 기본 펼침. 헤더 우측 **모두 펼치기/접기** 토글.
  - `accordion` 미지정(기본 false) 시 기존 렌더 그대로 — LibraryFab 드로어·QuestionLibraryModal 무영향.
- `CodeLibrary.jsx` 조회 모드 WeaknessRow 에서만 `<CodeSection item accordion />` 적용.

## §3. 참고

- 렌더 공용화 원칙(중복 구현 금지) 유지 — 신규 컴포넌트 없이 옵션 확장.
- build:fe 통과. 프론트 변경 → Cloud Run 배포 (REBUILD91 온보딩 v5 와 묶어 1회 배포).
