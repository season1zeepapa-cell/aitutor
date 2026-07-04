// 단답형(blank) 템플릿 빈칸 표기 정규화 (REBUILD79)
//   BlankCard 파서는 {{N}} 만 인식한다. 그런데 DB 에는 (①)·(가)·___①___·[[N]]·순수 ___ 등
//   다양한 표기로 저장돼 있어 입력칸이 렌더되지 않는 문항이 다수 있었다.
//   → blank_answers 개수(nAns)를 기준으로 마커를 {{1}}..{{nAns}} 로 변환하고,
//     "고유 빈칸번호 == {1..nAns}" 를 만족할 때만 적용(불일치는 수동 검토 로그).
//
//   실행: DATABASE_URL=... node scripts/fix-blank-templates.mjs [--apply]
//     기본 dry-run(변경 안 함). --apply 붙이면 실제 UPDATE.
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 필요'); process.exit(1); }
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const KR = ['가','나','다','라','마','바','사','아','자','차','카','타','파','하'];
const braceRe = /\{\{\s*(\d+)\s*\}\}/g;
const uniqBraceNums = (t) => new Set([...t.matchAll(braceRe)].map((m) => Number(m[1])));

// 고유 빈칸번호가 0..k 이면 전부 +1 시프트해 1-base 로 (예: {{0}}{{1}} → {{1}}{{2}})
function shiftToOneBase(t) {
  const nums = [...uniqBraceNums(t)];
  if (nums.length && Math.min(...nums) === 0) {
    return t.replace(braceRe, (_, n) => `{{${Number(n) + 1}}}`);
  }
  return t;
}

// 템플릿을 {{N}} 표준으로 정규화. 이미 정상이면 그대로.
function normalize(tpl, nAns) {
  let t = String(tpl || '');

  // 이미 {{N}} 이고 고유 번호가 1..nAns 와 일치 → 변경 없음
  const u0 = uniqBraceNums(t);
  if (u0.size === nAns && [...u0].every((n) => n >= 1 && n <= nAns)) return { out: t, changed: false, ok: true };

  // 1) [[N]] → {{N}}
  t = t.replace(/\[\[\s*(\d+)\s*\]\]/g, (_, n) => `{{${n}}}`);

  // 2a) 언더스코어 동반 괄호숫자 ___(N)___ → {{N}} (확실한 빈칸, 자리수 무관)
  t = t.replace(/_+\(\s*(\d+)\s*\)_*|_*\(\s*(\d+)\s*\)_+/g, (_, a, b) => `{{${a || b}}}`);
  // 2b) 순수 한 자리 괄호숫자 (N=1~9, 언더스코어 없음) → {{N}}
  //     코드 인자(setMaxAge(1000) 등 여러 자리)는 제외해 오탐 방지. 초과 시 검증에서 걸러짐.
  t = t.replace(/\(\s*([1-9])\s*\)/g, (_, n) => `{{${n}}}`);

  // 3) ___①___ / (①) / 단독 ① → 원문자 번호. 앞뒤 언더스코어·괄호 흡수.
  t = t.replace(/[_（(]*\s*([①-⑳])\s*[_）)]*/g, (_, c) => {
    const n = CIRCLED.indexOf(c) + 1;
    return n > 0 ? `{{${n}}}` : _;
  });

  // 4) (가)(나)... → 순서 번호. 괄호 있는 한글 낱자만(오탐 방지).
  t = t.replace(/[（(]\s*([가-하])\s*[）)]/g, (_, k) => {
    const n = KR.indexOf(k) + 1;
    return n > 0 && n <= nAns ? `{{${n}}}` : _;
  });

  // 5) 원문자·번호가 하나도 안 잡혔고 순수 언더스코어(_{3,})만 있으면 등장 순서대로 번호 부여
  if (uniqBraceNums(t).size === 0 && /_{3,}/.test(t)) {
    let i = 0;
    t = t.replace(/_{3,}/g, () => `{{${++i}}}`);
  }

  // 6) 0-base → 1-base 시프트
  t = shiftToOneBase(t);

  const u = uniqBraceNums(t);
  const ok = u.size === nAns && [...u].every((n) => n >= 1 && n <= nAns);
  return { out: t, changed: t !== String(tpl || ''), ok };
}

async function main() {
  const r = await pool.query(
    `SELECT id, chapter_code, blank_template, blank_answers
     FROM kisa_questions WHERE question_type='blank' AND is_active=TRUE ORDER BY chapter_code`);
  let already = 0, fixed = 0, failed = 0;
  const fails = [];
  for (const q of r.rows) {
    const nAns = Array.isArray(q.blank_answers) ? q.blank_answers.length : 0;
    const { out, changed, ok } = normalize(q.blank_template, nAns);
    if (!changed && ok) { already++; continue; }
    if (ok) {
      fixed++;
      if (APPLY) await pool.query(`UPDATE kisa_questions SET blank_template=$1, updated_at=NOW() WHERE id=$2`, [out, q.id]);
    } else {
      failed++;
      fails.push(`${q.chapter_code} (답${nAns}, 빈칸${uniqBraceNums(out).size}): ${String(q.blank_template).slice(0, 80)}`);
    }
  }
  console.log(`정상 유지 ${already} · 정규화 ${fixed} · 실패(수동검토) ${failed} ${APPLY ? '[APPLIED]' : '[dry-run]'}`);
  if (fails.length) { console.log('\n── 실패(수동검토 필요) ──'); fails.forEach((f) => console.log('  •', f)); }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
