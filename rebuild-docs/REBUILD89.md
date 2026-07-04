# REBUILD89 — 소수 카테고리 objective/shortessay 증설 (9·10번째 문항)

> 2026-07-04. 선행: REBUILD88(composite 확충). REBUILD85 §6-3 과제 완료. 생성 스킬: `kisa-exam-question-gen`.

## §1. 대상과 규모

문항이 가장 적던 3개 카테고리의 약점 5개에 각각 objective·shortessay 9·10번째 문항을 추가 — **총 20문항**.

| 카테고리 | 약점 | objective | shortessay |
|----------|------|----------:|-----------:|
| API오용 | IMP-AA-01(DNS lookup)·IMP-AA-02(취약한 API) | 16→20 | 16→20 |
| 시간및상태 | IMP-TS-01(TOCTOU)·IMP-TS-02(무한 재귀) | 16→20 | 16→20 |
| 세션통제 | DSG-SC-01(세션통제 설계) | 8→10 | 8→10 |

전체: objective 552→**562**, shortessay 552→**562** (약점당 8~10문항).

## §2. 생성 원칙 (스킬 준수)

- 지식 근거는 `kisa-library.json` library 자료원만 — 없는 내용 미창작. 외부 LLM 미사용.
- 기존 1~8번과 관점 중복 회피: 9·10번은 **진단방법·판정 기준·경계 사례** 각도 위주
  (예: TOCTOU pool 자체모듈 안전 판정, strncpy 도 금지 목록 포함, 대체 API 부재 시 인자·반환값 검사, 세션 타임아웃 2~5분/15~30분).
- chapter_code 접미사 `-9`/`-10` 으로 UPSERT 충돌 회피. 난이도 하/중/상 혼합.
- objective 해설의 정답 원문자 = answer_index 정합 (REBUILD82 §4 교훈 자동검증 포함).

## §3. 검증 (전수 자동검증 20/20 통과)

- objective(10): answer_index 범위·선택지 중복 없음·해설 "정답은 ⓝ" 원문자와 answer_index 일치.
- shortessay(10): rubric 배점 합 5점·**모범답안 자가채점 100점·무관 답 0점** (scoreComposite 실채점기 사용).
- 적재: `kisa-seed-exam.mjs` — 삽입 20 · 갱신 1,104 · 실패 0 (exam.seed.json 1,104→1,124).

## §4. 결과

문항 DB 총계 2,832 → **2,852**. 데이터만 변경 → 배포 불필요.
REBUILD85 §6 과제 3종(blank 공백·composite 확충·소수 카테고리 증설) 전부 완료 — 남은 확장 여지는 codeid(자료원 추가 시)와 약점당 11번째 이후 증설뿐.
