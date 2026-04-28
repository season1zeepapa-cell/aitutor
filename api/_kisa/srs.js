// KISA 드릴 — SM-2 경량판 스페이스드 리피티션 알고리즘
// FEATURE_SPEC.md §7의 규칙을 그대로 구현.
//
// self_grade 입력에 따라 kisa_review_queue row 갱신 값을 계산한다.
//   again → repetitions=0, interval=1,  ease=max(1.3, ease-0.20)
//   hard  → repetitions+=1, interval=max(1, round(interval*1.2)), ease=max(1.3, ease-0.15)
//   good  → repetitions+=1, interval = (rep==1)?1:(rep==2)?3:round(interval*ease), ease unchanged
//   easy  → repetitions+=1, interval=round(interval*ease*1.3), ease=ease+0.15
//
// next_review_at은 now + interval_days (UTC 기준).

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

/**
 * SRS 상태를 self_grade로 업데이트
 * @param {object} current  — { ease_factor, interval_days, repetitions } (없으면 기본값 사용)
 * @param {'again'|'hard'|'good'|'easy'} grade
 * @returns {{ easeFactor, intervalDays, repetitions, nextReviewAt: Date }}
 */
function applySrs(current = {}, grade) {
  // DB row(snake_case)와 이전 applySrs 결과(camelCase) 양쪽 다 수용
  const ease0 = Number(current.ease_factor ?? current.easeFactor ?? DEFAULT_EASE);
  const interval0 = Number(current.interval_days ?? current.intervalDays ?? 0);
  const rep0 = Number(current.repetitions ?? 0);

  let easeFactor = ease0;
  let intervalDays = interval0;
  let repetitions = rep0;

  switch (grade) {
    case 'again':
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(MIN_EASE, ease0 - 0.20);
      break;
    case 'hard':
      repetitions = rep0 + 1;
      intervalDays = Math.max(1, Math.round(interval0 * 1.2));
      easeFactor = Math.max(MIN_EASE, ease0 - 0.15);
      break;
    case 'good':
      repetitions = rep0 + 1;
      if (repetitions === 1) intervalDays = 1;
      else if (repetitions === 2) intervalDays = 3;
      else intervalDays = Math.round(interval0 * ease0);
      // easeFactor 변경 없음
      break;
    case 'easy':
      repetitions = rep0 + 1;
      intervalDays = Math.round(Math.max(1, interval0) * ease0 * 1.3);
      easeFactor = ease0 + 0.15;
      break;
    default:
      throw new Error(`Unknown self_grade: ${grade}`);
  }

  // 다음 복습 시점 = now + intervalDays (UTC)
  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    easeFactor: Number(easeFactor.toFixed(3)),
    intervalDays,
    repetitions,
    nextReviewAt,
  };
}

module.exports = {
  applySrs,
  DEFAULT_EASE,
  MIN_EASE,
};
