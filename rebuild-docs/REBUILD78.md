# REBUILD78 — 대시보드 학습 카드 드래그 재배치

> **작성**: 2026-07-04 KST
> **범위**: `src/tabs/KisaTab/Dashboard.jsx`
> **목적**: 대시보드의 학습 진입 카드(학습자료·이론교육·각종 드릴·복습 등 14개)를 사용자가 **드래그로 순서 변경**할 수 있게 한다. 순서는 기기별로 저장.

---

## §1. 접근

- 외부 dnd 라이브러리(@dnd-kit 등) 없이 **Pointer Events**로 구현 — 모바일 터치 + 데스크톱 마우스를 단일 코드로 처리(PWA 주 사용처가 모바일).
- 카드를 하드코딩 JSX(14개)에서 **데이터 배열(DASH_CARDS)**로 전환. id·emoji·title·desc·to·highlight.
- 순서는 `localStorage['kisa-dash-order-v1']`에 id 배열로 저장. 서버/DB 무관(개인 기기 설정).

## §2. 동작

- 카드 그리드 위에 **"↕️ 순서 편집" 토글**. 편집 모드에서만 드래그 활성(그 외엔 기존처럼 탭 → 이동).
- 편집 모드:
  - 각 카드에 `⋮⋮` 핸들 표시 + grab 커서 + ring 강조, 클릭(navigate) 비활성.
  - `onPointerDown` → 드래그 시작(pointer capture), `onPointerMove` → `document.elementFromPoint`로 커서 아래 카드(`[data-card-id]`)를 찾아 실시간 재배열, `onPointerUp` → localStorage 저장.
  - 그리드 컨테이너 `touchAction:'none'`으로 편집 중 스크롤 간섭 차단.
- "완료" 누르면 일반 모드 복귀.

## §3. 안전장치

- `loadCardOrder()` — 저장된 순서를 현재 카드 목록과 병합: 화이트리스트 통과 id 만 유지, **새로 추가된 카드는 뒤에 자동 편입, 삭제된 id 는 제거**. 향후 카드 증감에도 깨지지 않음.
- 동적 desc/highlight(복습 카드의 오늘 복습 수)는 렌더 시 override 로 주입 — 데이터 배열은 정적 유지.

## §4. 검증

- `npm run build:fe` 정상. localStorage 키 버전(v1)로 향후 스키마 변경 대비.
