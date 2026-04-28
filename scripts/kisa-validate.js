// KISA 시드 JSON 스키마 검증 — DB 업로드 전 사전 확인
//
// 사용법:
//   node scripts/kisa-validate.js kisa-module/seed/design/01-input-validation.json
//   node scripts/kisa-validate.js kisa-module/seed/**/*.json    (shell glob)
//
// 검증 항목:
//   1. 필수 필드 존재 (stage, chapter_code, question_type 등)
//   2. enum 값 유효성 (stage, weakness_category, language, difficulty, question_type)
//   3. chapter_code 접두어-stage 일치 (DSG→design, IMP→implementation)
//   4. diagnosis4: vulnerable_code/lines/keywords/safe_code 모두 필수
//   5. vulnerable_lines 값이 code 라인 범위 내인지
//   6. rationale_keywords/fix_keywords 개수 권장범위 (3-7)
//   7. MCQ: choices 길이 + answer_index 범위
//   8. 중복 (chapter_code + language + difficulty) 체크

const fs = require('fs');
const path = require('path');

const STAGES = ['design', 'implementation'];
const TYPES = ['mcq', 'diagnosis4'];
const LANGUAGES = ['java', 'python', 'javascript', 'kotlin', 'swift', 'etc'];
const DIFFICULTIES = ['하', '중', '상'];
const CATEGORIES = [
  'input_validation', 'security_feature', 'time_state',
  'error_handling', 'code_error', 'encapsulation', 'api_abuse',
  'session_control',
];

let errorCount = 0, warnCount = 0, totalCount = 0;

function err(file, idx, msg) {
  console.error(`  ❌ [${file}] #${idx}: ${msg}`);
  errorCount++;
}
function warn(file, idx, msg) {
  console.warn(`  ⚠️  [${file}] #${idx}: ${msg}`);
  warnCount++;
}

function countLines(code) {
  if (!code) return 0;
  // "1  ...\n2  ..." 형태에서 최대 라인 번호 추출
  const lines = code.split('\n');
  let maxLine = 0;
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s/);
    if (m) maxLine = Math.max(maxLine, parseInt(m[1]));
  }
  return maxLine || lines.length;
}

function validateQuestion(file, idx, q) {
  const loc = `${path.basename(file)}#${idx}`;

  // 1. 필수 필드 (v1 호환을 위해 stage/chapter_code는 권장으로)
  const required = ['question_type', 'weakness_category', 'weakness_name_ko', 'language', 'difficulty', 'body'];
  for (const f of required) {
    if (!q[f]) err(file, idx, `필수 필드 누락: ${f}`);
  }
  // v2 권장 필드
  const recommended = ['stage', 'chapter_code'];
  for (const f of recommended) {
    if (!q[f]) warn(file, idx, `v2 권장 필드 누락: ${f} (신규 문항은 반드시 포함)`);
  }

  // 2. enum 검증
  if (q.stage && !STAGES.includes(q.stage))
    err(file, idx, `stage 유효하지 않음: ${q.stage}`);
  if (q.question_type && !TYPES.includes(q.question_type))
    err(file, idx, `question_type 유효하지 않음: ${q.question_type}`);
  if (q.language && !LANGUAGES.includes(q.language))
    err(file, idx, `language 유효하지 않음: ${q.language}`);
  if (q.difficulty && !DIFFICULTIES.includes(q.difficulty))
    err(file, idx, `difficulty 유효하지 않음: ${q.difficulty}`);
  if (q.weakness_category && !CATEGORIES.includes(q.weakness_category))
    err(file, idx, `weakness_category 유효하지 않음: ${q.weakness_category}`);

  // 3. chapter_code 접두어-stage 일치
  if (q.chapter_code && q.stage) {
    if (q.stage === 'design' && !q.chapter_code.startsWith('DSG-'))
      err(file, idx, `stage=design 인데 chapter_code가 DSG-로 시작하지 않음: ${q.chapter_code}`);
    if (q.stage === 'implementation' && !q.chapter_code.startsWith('IMP-'))
      err(file, idx, `stage=implementation 인데 chapter_code가 IMP-로 시작하지 않음: ${q.chapter_code}`);
  }

  // 4-5. 타입별 필수 필드
  if (q.question_type === 'mcq') {
    if (!Array.isArray(q.choices) || q.choices.length < 2)
      err(file, idx, `MCQ choices 2개 이상 필요`);
    if (typeof q.answer_index !== 'number' || q.answer_index < 0 || q.answer_index >= (q.choices?.length || 0))
      err(file, idx, `MCQ answer_index 범위 오류`);
    if (q.choices?.length > 5)
      warn(file, idx, `MCQ 선택지 5개 초과 (권장 4~5개)`);
  }
  if (q.question_type === 'diagnosis4') {
    if (!q.vulnerable_code) err(file, idx, `diagnosis4 vulnerable_code 필수`);
    if (!Array.isArray(q.vulnerable_lines) || q.vulnerable_lines.length === 0)
      err(file, idx, `diagnosis4 vulnerable_lines 배열 필수 (비어있지 않음)`);
    if (!Array.isArray(q.rationale_keywords) || q.rationale_keywords.length === 0)
      err(file, idx, `diagnosis4 rationale_keywords 필수`);
    if (!Array.isArray(q.fix_keywords) || q.fix_keywords.length === 0)
      err(file, idx, `diagnosis4 fix_keywords 필수`);
    if (!q.safe_code) err(file, idx, `diagnosis4 safe_code 필수`);
    if (!q.model_answer || typeof q.model_answer.verdict !== 'boolean')
      err(file, idx, `diagnosis4 model_answer.verdict (boolean) 필수`);

    // 라인 범위 체크
    if (q.vulnerable_code && Array.isArray(q.vulnerable_lines)) {
      const maxLine = countLines(q.vulnerable_code);
      for (const ln of q.vulnerable_lines) {
        if (ln > maxLine) err(file, idx, `vulnerable_lines에 라인 ${ln}이 있는데 코드 최대 라인 ${maxLine}`);
      }
    }

    // 키워드 개수 권장
    if (q.rationale_keywords?.length > 7)
      warn(file, idx, `rationale_keywords ${q.rationale_keywords.length}개 (권장 3~5)`);
    if (q.rationale_keywords?.length < 2)
      warn(file, idx, `rationale_keywords ${q.rationale_keywords.length}개 (권장 3~5)`);
    if (q.fix_keywords?.length > 5)
      warn(file, idx, `fix_keywords ${q.fix_keywords.length}개 (권장 2~4)`);
  }
}

function validateFile(file) {
  totalCount++;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`❌ JSON 파싱 실패 [${file}]: ${e.message}`);
    errorCount++;
    return;
  }

  if (!Array.isArray(data.questions)) {
    console.error(`❌ questions 배열 없음 [${file}]`);
    errorCount++;
    return;
  }

  console.log(`\n📄 ${file} — ${data.questions.length}문항`);

  // 파일 내 중복 체크
  const seen = new Set();
  data.questions.forEach((q, i) => {
    validateQuestion(file, i, q);

    const key = `${q.chapter_code}|${q.language}|${q.difficulty}`;
    if (seen.has(key)) warn(file, i, `동일 파일 내 중복: ${key}`);
    seen.add(key);
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('사용법: node scripts/kisa-validate.js <파일경로...>');
    process.exit(1);
  }

  console.log('🔍 KISA 시드 스키마 검증 시작\n');
  for (const file of args) {
    validateFile(file);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 검증 결과`);
  console.log(`  검증 파일: ${totalCount}`);
  console.log(`  에러: ${errorCount}`);
  console.log(`  경고: ${warnCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(errorCount > 0 ? 1 : 0);
}

main();
