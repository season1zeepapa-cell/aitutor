# REBUILD48 — KisaTab 정렬 보강 + 코드 하이라이트 + 교차점프 + 부분 초기화

> **작성**: 2026-06-15 KST
> **트리거**: 사용자 요청 — 후속 4건 일괄 (① 다른 화면 가이드순 정렬 ② 코드 syntax highlight ③ 라이브러리↔학습 교차점프 ④ 부분 초기화 UI)
> **범위**: WrongNotes·CodeBlock·LibraryFab·Stats
> **결과**: 오답노트 가이드순, LibraryFab 코드 Prism 하이라이트, 라이브러리→학습 점프, scope별 초기화

---

## §0. 결론 요약

| # | 작업 | 변경 |
|---|------|------|
| 1 | 가이드순 정렬 | WrongNotes `by_category` 가이드순 정렬 (Dashboard·Stats는 이미 `stages.categories`로 정렬돼 무변경) |
| 2 | 코드 하이라이트 | LibraryFab 자체 `<pre>` → 공통 `CodeBlock`(Prism). C#/C 언어 보강 |
| 3 | 교차 점프 | LibraryFab 라이브러리 항목 → "📖 학습에서 자세히 보기" → `/kisa/study/{code}` |
| 4 | 부분 초기화 | Stats 초기화 모달에 scope 선택(전체/응시기록/복습큐/모의고사) |

---

## §1. 가이드순 정렬 (WrongNotes)

- `CATEGORY_ORDER`(붙임3) + `catRank` 로 `by_category`(서버 빈도순)를 가이드 순서로 정렬.
- Dashboard(`stages[].categories`)·Stats(`weaknessCategories`)는 이미 가이드순 → 무변경 확인.

## §2. 코드 신택스 하이라이트 (LibraryFab)

- `CodeBlock.jsx` 는 이미 Prism 하이라이트 + 라인번호 보유(StudyDetail 사용 중). prism-clike/csharp/c 추가 + LANG_MAP(csharp/c#/cs/c) 보강.
- LibraryFab 자체 단순 `<pre>` 제거 → 공통 `SharedCodeBlock` 사용. `guessLang(lang)`(C#/Python/JS/Java) 로 언어 추정.
- 취약/안전은 라벨(빨강/초록)로 구분 유지.

## §3. 라이브러리 ↔ 학습 교차 점프 (LibraryFab)

- `useNavigate` 추가. 라이브러리(보안약점) 항목 상세에 "📖 학습에서 자세히 보기" 버튼.
- 클릭 → 패널 닫고 `navigate('/kisa/study/' + chapter_code)` (id = chapter_code, study 상세와 일치).
- 교재(course) 항목은 study 대상이 아니라 버튼 미표시.

## §4. 부분 초기화 UI (Stats)

- 기존: `handleReset` 이 `scope:'all'` 고정 (서버는 attempts/srs/exams/all 지원하나 UI 없음).
- 개선: `resetScope` state + 모달에 4개 옵션(전체/응시기록만/복습큐만/모의고사만) 선택 → `apiPost(reset, { scope: resetScope })`.
- 서버 무변경 (이미 scope 지원).

---

## §5. 검증 / 영향

| 항목 | 결과 |
|------|------|
| 빌드 | ✅ 통과 |
| 서버 | 🟢 무변경 (정렬·점프·scope 모두 클라이언트/기존 API) |
| 배포 반영 | 🟡 src 변경 → Cloud Run 재배포 |

---

## §6. 다음 단계

1. course 항목의 `related_library` → 해당 보안약점 카드/학습 점프
2. DrillSession 문제 출제 순서 옵션(가이드순 모드)
3. 코드 복사 버튼

---

**완료 일시**: 2026-06-15 KST
**연관 문서**: REBUILD46(LibraryFab 정렬·아코디언), REBUILD47(study 정렬·아코디언), `CodeBlock.jsx`
