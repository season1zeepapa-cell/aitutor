# REBUILD84 — 구형 이론 MCQ(mcq) 유형 완전 제거, objective 로 일원화

> 2026-07-04. 선행: REBUILD83(2025 교재 라이브러리 제거).

## §1. 배경과 결정

이론 MCQ(`mcq`)는 REBUILD16 시기의 구형 자동생성 유형(약점당 원인/방어 2문항 패턴, 활성 261·비활성 188)으로,
지식 라이브러리 기반 신형 `objective`(활성 552, 약점당 8문항, 코드/설명 지문)와 목적이 완전히 겹쳤다.
실사용도 시도 2건·SRS 큐 1건뿐. 사용자 결정으로 **완전 제거하고 objective 로 일원화**.

## §2. DB 조치

- `DELETE FROM kisa_questions WHERE question_type='mcq'` → **449건 삭제**.
- FK 는 attempts·review_queue·llm_explanations 모두 ON DELETE CASCADE, reports 는 SET NULL → 고아 레코드 0 확인.
- 잔여 유형: blank 274 · codeid 1049 · composite 52 · diagnosis4 192 · objective 552 · shortessay 552.

## §3. 코드 변경 (핵심 3건)

1. **모의 이수시험 블루프린트 교체** (`api/kisa-exam.js`)
   - theory60·full3h: `mcq 20 + blank 10` → **`objective 20 + blank 10`** (이론 30문항 구조 유지).
   - 이론 점수 합산 분기도 `objective || blank` 로 교체.
2. **챕터별 드릴의 objective 지원** (`api/kisa-drill.js`, `api/kisa-study.js`)
   - objective 의 chapter_code 는 `OBJ-<챕터>-N` 형태라 기존 정확매칭으로는 챕터 필터가 안 걸림.
   - drill 의 chapter_code 조건을 `(= $n OR LIKE 'OBJ-'||$n||'%')` 로 확장.
   - study 상세 응답 `mcq_count` → `objective_count` (LIKE 'OBJ-'||챕터||'%' 카운트).
3. **레지스트리에서 mcq 항목 제거** (`src/components/QuestionTypes/registry.js`)
   - ⚠️ McqCard·McqResult·McqExamBody·scoreMcq 등 "Mcq" 명의 인프라는 **objective 가 그대로 사용하므로 유지**.
     제거한 것은 `mcq` 유형 등록·디스패치뿐.

## §4. 그 외 변경

| 파일 | 조치 |
|------|------|
| `api/kisa-attempt.js` | 유형 리스트에서 mcq 제거, LLM 해설 프롬프트의 선택지 분기 mcq→objective |
| `api/_kisa/scorer.js` | mcq 디스패치 제거 (scoreMcq 함수는 objective 용으로 유지) |
| `Dashboard.jsx` | '이론 드릴 (MCQ)' 카드 제거(저장된 카드순서는 자동 병합), 카테고리 바로시작 분기 objective 통일 |
| `DrillConfig.jsx` | TYPE_META/TYPE_KEYS 에서 mcq 제거, 기본 유형 objective |
| `DrillSession.jsx` | 자가평가 재전송 분기 mcq→objective |
| `StudyDetail.jsx` | 챕터 드릴 버튼 '이론(MCQ)'→'이론 객관식'(objective_count) |
| `KisaExamMode.jsx` | theory60 설명 'MCQ 30문항'→'객관식 20 + 단답형 10' |
| `ReviewHome.jsx` | TYPE_META mcq 제거 + objective·shortessay 라벨 신규(기존 누락 보완) |
| `WrongNotes.jsx` | 답안 표시 분기 mcq→objective (objective 도 '선택: N번' 표시되도록 개선) |
| `TutorialOverlay.jsx` | 드릴 안내 문구 objective 기준으로 갱신 |
| `scripts/kisa-validate.js` | TYPES 에서 mcq 제거 + mcq 검증 블록 삭제 |
| `scripts/seed/kisa-mcq.js` | 구형 시드 생성 스크립트 삭제 |

## §5. 검증

- `npm run build:fe` 통과, API 5개 파일 require 로드 통과.
- 잔재 grep: `'mcq'` 유형 참조 0건 (`mcq_selected` 컬럼명·`McqCard` 계열 컴포넌트는 의도적 유지).
- DB 고아 레코드 0 (attempts·SRS).

## §6. 참고

- 삭제된 mcq 449건은 DB 하드 삭제라 **DB 차원 복구 불가** (시드 재생성 스크립트도 함께 삭제됨 — git 이력에는 남음).
- 복습(SRS)·오답노트의 기존 mcq 기록은 CASCADE 로 함께 정리됨 (시도 2건 수준이라 영향 미미).

## §7. 후속 — 비활성 문항 정리 (같은 날)

mcq 제거에 이어 비활성(is_active=FALSE) 잔존 문항도 하드 삭제:

- **blank 비활성 138건 + diagnosis4 비활성 54건 = 192건 삭제** (문제풀 v3 재구축 때 비활성화된 구버전).
- 삭제 전 확인: 시도기록 0건, SRS 큐 0건 — 어떤 사용자 기록도 딸려 있지 않은 완전한 죽은 데이터.
- 결과: 전 유형 비활성 0. 최종 문항 분포 — objective 552 · shortessay 552 · codeid 1049 · diagnosis4 138 · blank 136 · composite 52 (**총 2,479, 전부 활성**).
- 코드 변경 없음(서빙은 원래 is_active=TRUE 만 조회) → 빌드·배포 불필요, 문서 커밋만.
