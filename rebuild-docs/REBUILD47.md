# REBUILD47 — /kisa/study 항목 가이드순 정렬 + 상세 예시코드 아코디언

> **작성**: 2026-06-15 KST
> **트리거**: 사용자 요청 — "/kisa/study 항목을 가이드와 같은 순서로 정렬, 상세페이지 예시 코드는 접었다 펼치는 방식으로"
> **범위**: `src/tabs/KisaTab/Study.jsx`(목록 정렬), `StudyDetail.jsx`(코드 아코디언). 서버(`/api/kisa-study`) 무변경
> **결과**: 학습 목록이 설계→구현·분류·번호순, 상세 코드 예시가 예제별 접기/펼치기

---

## §0. 결론 요약

| 항목 | Before | After |
|------|--------|-------|
| 목록 순서 | API 응답 순서(가이드순 미보장) | **설계→구현 탭, 분류 가이드순, 항목 번호순** |
| 상세 코드 예시 | 탭 방식(여러 예제 중 1개) | **아코디언 — 예제별 접기/펼치기** (첫 예제 기본 펼침) |

---

## §1. Study.jsx — 가이드 순서 정렬

- `CATEGORY_ORDER`(붙임3): input_validation→security_feature→time_state→error_handling→code_error→encapsulation→api_abuse→session_control
- `byCategory` 그룹 후 `sortedCategories` 로 카테고리 정렬 + 각 카테고리 내 `chapter_code` 번호순(`chapterNum`).
- 클라이언트 정렬이라 서버(`/api/kisa-study?action=list`) 무변경.

## §2. StudyDetail.jsx — 예시코드 아코디언

- `selectedExample`(탭 인덱스) → `openExamples`(Set, 다중 펼침) + `toggleExample`.
- 코드 예시 섹션을 `code_examples.map` 아코디언으로 재작성:
  - 헤더(언어·난이도) 클릭 → 펼침/접힘 (▾/▸, "접기/펼치기")
  - 펼치면 ❌취약 코드 + "왜 취약한가" / ✅안전 코드 + "수정 포인트" / 근거·수정 키워드
  - 첫 예제 기본 펼침, 나머지 접힘 → 공간 효율
- `currentExample` 제거, 블록 내 `ex` 기준 렌더.

---

## §3. 검증 / 영향

| 항목 | 결과 |
|------|------|
| 빌드 | ✅ 통과, `selectedExample`/`currentExample` 잔존 참조 0 |
| 데이터 | 🟢 `/api/kisa-study` DB 기반 그대로 (LibraryFab 정적 합본과 별개) |
| 배포 반영 | 🟡 src 변경 → Cloud Run 재배포로 실제 앱 반영 |

---

## §4. 다음 단계

1. DrillSession/시험 등 다른 KisaTab 화면도 동일 가이드 순서 검토
2. 코드 구문 강조(syntax highlight)
3. LibraryFab ↔ Study 상세 교차 점프

---

**완료 일시**: 2026-06-15 KST
**연관 문서**: REBUILD46(LibraryFab 정렬·아코디언), `src/tabs/KisaTab/Study.jsx`, `StudyDetail.jsx`
