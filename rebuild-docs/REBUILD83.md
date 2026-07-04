# REBUILD83 — 2025 기본과정 교재(course) 지식라이브러리 완전 제거

> 2026-07-04. 선행: REBUILD82(문제출제 현황 스냅샷).

## §1. 배경과 결정

2025 기본과정 교재(`course` 자료원, 73항목)는 2026 교재(`kisec2026`, 81항목)가 들어오면서 역할이 겹쳤다.
사용자 결정으로 **완전 제거**. 제거 전 의존성 전수 조사 결과 구조적 의존 0건 확인:

- 이론 학습(TheoryList/StudyDetail)은 kisec2026 만 사용.
- 코드 라이브러리·코드퀴즈 문항 생성(codebank)은 course 코드예시 0이라 애초에 제외.
- 이수시험 문항 생성 스킬(kisa-exam-question-gen)·DB 문항 tags 에 course 참조 없음.
- 타 자료원의 course 역참조 0건 (course→library 일방향 링크만 존재했음).
- 사용자 학습 진도는 문항 단위 기록이라 무관.

## §2. 제거 내역 (6곳 + 잔재 주석 3곳)

| 위치 | 조치 |
|------|------|
| `kisa-module/course/` | 원본 146파일(JSON+MD 73쌍) 삭제 — git 이력으로 복구 가능 |
| `scripts/build-kisa-library.mjs` | courseDir·courseItems·sources 항목 제거. `mapCourse()` 함수는 **kisec2026 이론카드가 재사용하므로 유지**(기본 파라미터만 제거) |
| `src/tabs/KisaTab/CodeQuiz.jsx` | SOURCE_LABELS·SOURCE_ORDER 에서 course 제거 |
| `src/tabs/KisaTab/CodeDrillHome.jsx` | SOURCE_LABELS·SOURCE_ORDER 에서 course 제거 |
| `src/components/LibraryFab.jsx` | SOURCE_BADGE 라벨 + course 전용 이동 버튼 분기 2개 제거 |
| `src/components/QuestionLibraryModal.jsx` | SOURCE_BADGE 라벨 제거 |
| `api/kisa-drill.js` | ALLOWED_SOURCES 화이트리스트에서 course 제거 |
| 주석 잔재 | build-kisa-codebank.mjs·CodeLibrary.jsx·build-kisa-library.mjs 의 course 언급 주석 정리 |

## §3. 재생성·검증

- `npm run build:lib` → kisa-library.json **380 → 307 항목** (library 69 + kisec2026 81 + jssec2023 42 + devsec2021 69 + pysec2023 46). JSON 내 `course` 문자열 0건.
- `npm run build:codebank` → 출력 동일(course 는 원래 코드예시 0) — 파생 데이터 무변경 확인.
- `npm run build:fe` → Vite 빌드 통과.
- 전수 grep(src·api·scripts·server-infer·server.js): `2025교재`·`2025 기본과정`·`'course'`·`COURSE-` 잔재 0건.

## §4. 참고

- DB 무변경 — 배포는 프론트 번들(kisa-library.json·jsx) + api/kisa-drill.js 코드 변경이라 Cloud Run 배포 필요.
- 일부 문항 해설 텍스트의 "2025 교재 p.xx" 류 인용은 단순 표기라 동작 무관(구조 링크 아님).
- 복구가 필요하면 이 커밋 직전 시점에서 `kisa-module/course/` 를 되살리고 위 6곳을 역적용하면 된다.
