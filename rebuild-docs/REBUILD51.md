# REBUILD51 — 교재 단원카드 관련 학습 링크 추가

> **작성**: 2026-06-15 KST
> **트리거**: 사용자 요청 — "교재 단원카드 관련 학습 링크 추가"
> **범위**: `build-kisa-library`(unit 필드), `LibraryFab`(단원카드 링크 버튼)
> **결과**: 라이브러리의 모든 교재 항목에 학습 진입 링크 부여

---

## §0. 변경

| 교재 항목 | 링크 |
|-----------|------|
| Ⅰ·Ⅱ·Ⅲ단원 (동향/법률/진단이해) | "📖 학습 자료 보기" → `/kisa/study` |
| Ⅵ단원 (실습) | "🎯 문제 풀이(드릴) 시작" → `/kisa/drill` |
| Ⅳ·Ⅴ단원 (보안약점) | "🔗 연관 보안약점 학습 (IMP-…)" → `/kisa/study/{code}` *(REBUILD49)* |

## §1. 구현

- `build-kisa-library.mjs` mapCourse 에 `unit`(Ⅰ~Ⅵ) 필드 추가 → 합본 재생성 (단원카드 분기용).
- LibraryFab: `handleJump(code)` → **`handleGo(path)`** 로 일반화 (학습 상세/목록/드릴 모두 이동 가능).
  - ItemRow prop `onJump` → `onGo`, 호출 3곳 갱신.
  - course 단원카드(relatedLibrary 없음)에 `unit==='Ⅵ' ? /kisa/drill : /kisa/study` 버튼.

## §2. 검증 / 영향

| 항목 | 결과 |
|------|------|
| 빌드 | ✅ 통과, onJump/handleJump 잔존 0 |
| 데이터 | 🟢 합본에 unit 필드 추가 재생성 |
| 배포 | 🟡 src 변경 → Cloud Run 재배포 |

---

**완료 일시**: 2026-06-15 KST
**연관 문서**: REBUILD49(course 교차점프), REBUILD45(플로팅 메뉴)
