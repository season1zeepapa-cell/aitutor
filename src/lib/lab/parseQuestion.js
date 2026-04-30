// 문항 자동 파싱 (REBUILD29 §19 — 사용자 요청 2026-04-30)
//
// 사용자가 외부에서 복사한 텍스트를 자동으로 { body, choices, answer } 구조로 파싱.
// 다양한 패턴 인식:
//   - "① 보기1" / "1) 보기1" / "1. 보기1" / "(1) 보기1"
//   - "정답: ②" / "정답 2" / "[정답] ②"

const CIRCLE = ['①', '②', '③', '④', '⑤'];
const CIRCLE_TO_NUM = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };

// 보기 시작 패턴 (line 시작 또는 공백 후)
const CHOICE_PATTERNS = [
  /^\s*([①②③④⑤])\s*(.+)/,      // ① 보기
  /^\s*(\d)\)\s*(.+)/,              // 1) 보기
  /^\s*\((\d)\)\s*(.+)/,            // (1) 보기
  /^\s*(\d)\.\s*(.+)/,              // 1. 보기
];

// 정답 패턴
const ANSWER_PATTERNS = [
  /정답\s*[:：]\s*([①②③④⑤])/,
  /정답\s*[:：]?\s*(\d)\s*[번)]?/,
  /\[정답\]\s*([①②③④⑤])/,
  /\[정답\]\s*(\d)/,
  /answer\s*[:：]\s*(\d)/i,
];

/**
 * 텍스트에서 문항 구조 추출.
 * @param {string} text 자유 형식 문항 텍스트
 * @returns {{body, choices, answer, answer_extra, parseError?}} 또는 부분 결과
 */
export function parseQuestionText(text) {
  if (!text || typeof text !== 'string') {
    return { body: '', choices: [], answer: null, parseError: '입력 텍스트 없음' };
  }

  const lines = text.split('\n').map(l => l.trim());
  const result = { body: '', choices: [], answer: null, answer_extra: null };

  // 1) 정답 추출 (전체 텍스트에서)
  for (const pattern of ANSWER_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const v = m[1];
      result.answer = CIRCLE_TO_NUM[v] || (parseInt(v, 10) || null);
      break;
    }
  }

  // 2) 보기 + 본문 분리
  const bodyLines = [];
  let inChoices = false;

  for (const line of lines) {
    if (!line) continue;
    if (/^\s*정답\b|^\s*\[정답\]/i.test(line)) continue; // 정답 줄 skip

    let matched = false;
    for (const pattern of CHOICE_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        const num = CIRCLE_TO_NUM[m[1]] || parseInt(m[1], 10);
        if (num >= 1 && num <= 5) {
          result.choices[num - 1] = m[2].trim();
          inChoices = true;
          matched = true;
          break;
        }
      }
    }
    if (!matched && !inChoices) {
      bodyLines.push(line);
    } else if (!matched && inChoices) {
      // 보기 시작 후 빈 매칭 = 보기의 후속 줄 또는 정답 영역
      // 마지막 보기에 이어 붙임 (멀티라인 보기 지원)
      const lastIdx = result.choices.length - 1;
      if (lastIdx >= 0 && result.choices[lastIdx]) {
        result.choices[lastIdx] += ' ' + line;
      }
    }
  }

  result.body = bodyLines.join('\n').trim();
  // 빈 슬롯 제거
  result.choices = result.choices.filter(Boolean);

  // 검증
  if (!result.body) result.parseError = '문제 본문 추출 실패';
  else if (result.choices.length < 2) result.parseError = `보기 ${result.choices.length}개만 발견 (최소 2개 필요)`;
  else if (!result.answer) result.parseError = '정답 표시 미발견 (선택 사항)';

  return result;
}

/**
 * 정답을 ① ② ③ ④ ⑤ 표기로 변환.
 */
export function answerLabel(answer) {
  if (!answer) return '?';
  return CIRCLE[answer - 1] || `(${answer})`;
}

/**
 * question 객체 검증 — body/choices 필수.
 */
export function isValidQuestion(q) {
  return !!(q && q.body && Array.isArray(q.choices) && q.choices.length >= 2);
}
