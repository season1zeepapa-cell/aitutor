// scripts/seed/_utils.js — KISA·신규 트랙 seed 생성 공통 헬퍼
// REBUILD16 §10 Stage 3 (R4)
//
// 사용 예:
//   const { shuffleKeep, importViaPsql } = require('./_utils');

const fs = require('fs');
const path = require('path');

/**
 * 배열을 섞으면서 정답 원소의 새 인덱스를 추적해 반환.
 * MCQ 4지선다에서 정답 위치 무작위 배치 시 사용.
 * @param {any[]} arr — 원본 배열
 * @param {number} correctIdx — 원본 배열에서 정답 인덱스
 * @returns {{arr:any[], newCorrect:number}}
 */
function shuffleKeep(arr, correctIdx) {
  const withIdx = arr.map((v, i) => ({ v, orig: i }));
  for (let i = withIdx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [withIdx[i], withIdx[j]] = [withIdx[j], withIdx[i]];
  }
  const newCorrect = withIdx.findIndex(x => x.orig === correctIdx);
  return { arr: withIdx.map(x => x.v), newCorrect };
}

/**
 * "정답: ..." + "해설: ..." 형식의 explanation 텍스트 생성기.
 * blank/mcq 모두 일관된 포맷으로 explanation 컬럼에 저장하기 위함.
 *
 * @param {string|string[]|object[]} answers — "PreparedStatement" / ["A","B"] /
 *   blank: [{idx:1, answers:["..."]}, ...]
 * @param {string} explanation — 해설 본문
 */
function buildExplanation(answers, explanation) {
  let answerLine;
  if (Array.isArray(answers) && answers.length > 0 && typeof answers[0] === 'object' && answers[0].idx) {
    // blank 형식
    answerLine = answers
      .map(a => `  #${a.idx} = ${(a.answers || []).join(' / ') || '-'}`)
      .join('\n');
    return `정답:\n${answerLine}${explanation ? `\n\n해설:\n${explanation}` : ''}`;
  }
  if (Array.isArray(answers)) {
    answerLine = answers.join(' / ');
  } else {
    answerLine = String(answers);
  }
  return `정답: ${answerLine}${explanation ? `\n\n해설:\n${explanation}` : ''}`;
}

/**
 * 생성된 seed JSON 을 지정 경로에 기록.
 * @param {string} relativePath — kisa-module/seed/blank-questions.json 같은 상대 경로 (저장소 루트 기준)
 * @param {object} data
 */
function writeSeedJson(relativePath, data) {
  const out = path.resolve(__dirname, '..', '..', relativePath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf-8');
  return out;
}

/**
 * Admin API 통한 seed 임포트 (psql 직접 호출 대안).
 * 운영 환경에서 사용 권장 — 권한·검증 일관성.
 *
 * @param {object} options
 * @param {string} options.url   — https://d2dcsdi9b1j2rf.cloudfront.net 같은 base URL
 * @param {string} options.token — 관리자 JWT 토큰 (Cookie 또는 Authorization)
 * @param {string} options.action  — 'seed' (기본)
 * @param {object} options.body  — { questions: [...] }
 */
async function importViaAdminApi({ url, token, action = 'seed', body }) {
  const endpoint = `${url.replace(/\/$/, '')}/api/kisa-admin?action=${action}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Cookie: `auth_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Admin import 실패 ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * KISA 의 표준 weakness_code 패턴 검증 (예: DSG-IV-01-BLANK-A, IMP-SF-04-MCQ-X-B)
 */
function validateWeaknessCode(code) {
  return /^(DSG|IMP)-[A-Z]{2}-\d{2}(-[A-Z\d-]+)?$/.test(code);
}

module.exports = {
  shuffleKeep,
  buildExplanation,
  writeSeedJson,
  importViaAdminApi,
  validateWeaknessCode,
};
