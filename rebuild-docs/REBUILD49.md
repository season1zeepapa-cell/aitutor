# REBUILD49 — course 교차점프 + 가이드순 출제 옵션 + 코드 복사 버튼

> **작성**: 2026-06-15 KST
> **트리거**: 사용자 요청 — 후속 3건 (① course→연관 보안약점 교차점프 ② DrillSession 가이드순 출제 옵션 ③ 코드 복사 버튼)
> **범위**: build-kisa-library·LibraryFab(①), api/kisa-drill·DrillSession(②), CodeBlock(③)
> **결과**: 교재 항목→학습 점프, 드릴 출제순서 토글(가이드순↔랜덤), 코드 블록 복사

---

## §0. 결론 요약

| # | 작업 | 변경 |
|---|------|------|
| 1 | course 교차점프 | 합본 course 항목에 `relatedLibrary` 추가, "🔗 연관 보안약점 학습" 버튼 |
| 2 | 가이드순 출제 | `api/kisa-drill` `order=guide` 옵션(SQL ORDER BY 가이드순) + DrillSession 토글 |
| 3 | 코드 복사 | 공통 `CodeBlock` 헤더에 📋 복사 버튼 (LibraryFab·StudyDetail 양쪽 적용) |

---

## §1. course → 연관 보안약점 교차점프

- `build-kisa-library.mjs` mapCourse 에 `relatedLibrary: d.related_library` 추가 → 합본 재생성.
- LibraryFab `handleJump(code)` 로 변경(기존 item→code). 라이브러리 항목은 `item.id`, course 항목은 `relatedLibrary[0]` 로 `/kisa/study/{code}` 점프.
- course 항목 상세에 "🔗 연관 보안약점 학습 (IMP-…)" 버튼 (relatedLibrary 있을 때).

## §2. DrillSession 가이드순 출제 옵션

- **서버**(`api/kisa-drill`): `order=guide` 파라미터 → 일반 출제 `ORDER BY` 를 단계(설계→구현)→분류(가이드순 CASE)→chapter_code→id 로 분기. 기본은 기존(미시도 우선+랜덤).
- **클라**(`DrillSession`): `guideOrder` state + 배지줄 토글(📑 가이드순 / 🎲 랜덤, SRS 모드 제외). 토글 시 `useRef` 가드로 세션 리셋 후 재출제(초기 마운트 중복 방지).

## §3. 코드 복사 버튼

- 공통 `CodeBlock.jsx` 헤더에 📋 복사 버튼. 라인번호 제외한 원문(`lines.map(content)`)을 `navigator.clipboard` 로 복사, 1.5초 "✓ 복사됨" 표시.
- 공통 컴포넌트라 LibraryFab(라이브러리)·StudyDetail(학습) 모두 자동 적용.

---

## §4. 검증 / 영향

| 항목 | 결과 |
|------|------|
| 빌드 | ✅ 통과 |
| 서버 변경 | 🟡 `api/kisa-drill` ORDER BY 분기 (배포로 반영). 상수 CASE라 SQL injection 없음 |
| 데이터 | 🟢 합본 재생성(relatedLibrary 추가), kisa-module 원본 불변 |
| 배포 반영 | 🟡 src+api 변경 → Cloud Run 재배포 |

---

## §5. 다음 단계

1. 가이드순 출제 시 "현재 챕터 위치" 표시
2. 코드 블록 다크모드 테마 미세 조정
3. 교재 단원카드(Ⅰ·Ⅱ·Ⅲ·Ⅵ)의 관련 학습 링크

---

**완료 일시**: 2026-06-15 KST
**연관 문서**: REBUILD48(정렬·하이라이트·교차점프·부분초기화), `api/kisa-drill.js`, `CodeBlock.jsx`
