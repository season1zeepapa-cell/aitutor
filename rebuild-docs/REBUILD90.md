# REBUILD90 — 오답노트·복습(SRS) 전면 점검 + 결함 3건 수정

> 2026-07-04. 사용자 요청 "오답노트·복습 기능 전체 점검" → 점검 보고 후 발견 3건 수정.

## §1. 점검 결과 요약 (정상 확인)

- **오답노트**: auto_score<70 최근 시도, 문항당 최신 1건(DISTINCT ON). mcq/비활성 삭제 잔재 없음(CASCADE 구조상 깨진 카드 불가). objective 분기(당일 수정분) 정상.
- **복습(SRS)**: 큐 34건(codeid 28·objective 3·blank 2·shortessay 1), 고아 0·suspended 0·도래 18. breakdown → 유형/그룹별 드릴(srs=true) 연결 정상. 자가평가 4버튼은 전 유형 노출 → SM-2 갱신 전 유형 동작. 라이브러리 "헷갈림→복습추가" 큐 합류 확인.

## §2. 수정한 결함 3건

| # | 결함 | 수정 |
|---|------|------|
| A | **오답노트 "다시 풀기" 챕터 무력화** — objective/shortessay/codeid 의 chapter_code(OBJ-·ESSAY-·CQ- 형태)가 드릴 API 챕터 정규식에서 탈락 → 조용히 전체 드릴로 시작 (신유형 도입 때부터 존재) | ① WrongNotes 에서 chapter_code/weakness_code 로부터 약점 코드(`(DSG|IMP)-XX-NN`) 추출해 전달 ② kisa-drill 챕터 필터에 `ESSAY-` prefix LIKE 추가(count·next 2곳 — OBJ·codeid 는 기왕 지원) |
| B | 서술형(shortessay·composite) "내 답"이 유형명만 표시 | kisa-review wrong_notes SELECT 에 `a.report_text` 추가 + renderUserAnswer 분기(120자 요약) |
| C | 서술형 "정답" 칸 '-' 표시 | correctAnswerText 에 model_answer.text 요약(120자) 분기, 없으면(composite) "모범답안 — 해설 참고" |

## §3. 검증

- 전 유형 챕터 필터 실측(운영 DB): shortessay IMP-AA-01→10 · objective→10 · codeid→24(weakness_code) · blank DSG-IV-01→2 · diagnosis4 IMP-IV-01→2.
- build:fe 통과, kisa-drill·kisa-review 로드 통과.

## §4. 남긴 것 (경미, 미수정)

- 오답노트 "다시 풀기"는 챕터 단위 재풀이라 동일 문항 재출제를 보장하진 않음(미시도 우선 서빙 정책) — 기존 설계 유지.
- 블라인드 판별(라이브러리 학습 모드)의 오답은 로컬 통계만 남고 오답노트에는 미수집 — 정식 문항 풀이가 아니므로 의도된 경계.
