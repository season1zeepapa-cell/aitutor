// pool/ 폴더의 PDF·HWP 기출문제를 Gemini Vision으로 추출하여 DB에 등록하는 배치 스크립트
// 사용법:
//   node pool-import.js --exam-id=4 --category-id=1
//   node pool-import.js --exam-title="2026년 1회차" --category-id=1
//   node pool-import.js --exam-id=4 --dry-run
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('./api/db');

const POOL_DIR = path.join(__dirname, 'pool');
const DONE_DIR = path.join(POOL_DIR, 'done');

// ── CLI 인자 파싱 ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const getArg = (name) => {
  const a = args.find(a => a.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : null;
};

const EXAM_ID = getArg('exam-id') ? parseInt(getArg('exam-id')) : null;
const EXAM_TITLE = getArg('exam-title');
const CATEGORY_ID = getArg('category-id') ? parseInt(getArg('category-id')) : null;
const FORCE_VISION = args.includes('--force-vision');  // 표/그림 보존을 위해 Vision 강제
const SUPPORTED_EXT = /\.(pdf|hwp|hwpx|png|jpg|jpeg|txt)$/i;

// ── 입력 검증 ──
if (!EXAM_ID && !EXAM_TITLE) {
  console.error('사용법:');
  console.error('  node pool-import.js --exam-id=4 [--category-id=1] [--dry-run]');
  console.error('  node pool-import.js --exam-title="2026년 1회차" --category-id=1 [--dry-run]');
  console.error('  node pool-import.js --exam-id=4 --force-vision   ← 표/그림 보존 (Vision 강제)');
  process.exit(1);
}
if (EXAM_TITLE && !CATEGORY_ID) {
  console.error('--exam-title 사용 시 --category-id는 필수입니다.');
  process.exit(1);
}

// ── Gemini 클라이언트 (재사용) ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── 파일에서 base64 + MIME 추출 ──
function fileToBase64(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath).toString('base64');
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.hwp': 'application/x-hwp',
    '.hwpx': 'application/x-hwpx',
  };
  return { data, mimeType: mimeMap[ext] || 'application/octet-stream' };
}

// ── PDF 텍스트 추출 (pdf-parse) ──
async function extractPdfText(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const result = await pdfParse(dataBuffer);
    return result.text || '';
  } catch {
    return '';
  }
}

// ── Gemini Vision으로 문서에서 문제 일괄 추출 ──
async function extractQuestionsFromFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // PDF/TXT인 경우 텍스트 추출 먼저 시도
  let textContent = '';
  if (ext === '.txt') {
    textContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`   txt 파일 읽기: ${textContent.length}자`);
  } else if (ext === '.pdf') {
    textContent = await extractPdfText(filePath);
    console.log(`   pdf-parse 추출: ${textContent.length}자`);
  }

  // ── Vision 사용 여부 판단 ──
  // --force-vision: CLI 옵션으로 강제 Vision 모드
  // 자동 감지: 텍스트에 <표>, <그림> 등 시각 자료 마커가 있으면 Vision 사용
  // HWP/HWPX: 바이너리 파일은 항상 Vision 사용
  // 이미지 파일: 항상 Vision 사용
  // Vision 사용 여부 판단
  // - 이미지/HWP 파일: 항상 Vision (바이너리 → 이미지로 전송)
  // - TXT 파일: Vision 불가 (텍스트만 전송). 대신 표/그림 마커 감지 시 프롬프트 강화
  // - PDF: Vision 가능 (pdf MIME 지원)
  const hasVisualMarker = /(<표>|<그림>|다음\s*표|구성도|토폴로지|헤더\s*구조|다이어그램)/.test(textContent);
  const isImageFile = /\.(png|jpg|jpeg)$/i.test(ext);
  const isBinaryDoc = /\.(hwp|hwpx)$/i.test(ext);
  const isTxt = ext === '.txt';
  // TXT는 Vision API로 전송 불가 (MIME 미지원) → 텍스트 모드 + 프롬프트 강화
  const useVision = !isTxt && (FORCE_VISION || isImageFile || isBinaryDoc || textContent.length < 200);
  // TXT이지만 표/그림 마커가 있으면 프롬프트에 표 추출 지시 추가
  const enhancedTextMode = isTxt && (hasVisualMarker || FORCE_VISION);

  if (useVision) {
    console.log(`   🔍 Vision 모드 사용 (${isBinaryDoc ? 'HWP 바이너리' : isImageFile ? '이미지' : 'PDF'})`);
  }
  if (enhancedTextMode) {
    console.log(`   ⚠️  표/그림 마커 감지 → 텍스트 강화 모드 (표 내용 재구성 요청)`);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Vision 모드 또는 텍스트 강화 모드일 때 표/그림 메타데이터도 함께 추출
  const includeVisualMeta = useVision || enhancedTextMode;
  const visualFields = includeVisualMeta ? `
    "has_table": false,
    "has_image": false,
    "table_description": "표가 있으면 표 내용을 텍스트로 정리, 없으면 빈 문자열",
    "image_description": "그림이 있으면 그림 내용을 설명, 없으면 빈 문자열",
    "needs_visual": false` : '';

  const visualInstructions = includeVisualMeta ? `
- 문제에 표(table)가 포함되어 있으면 "has_table": true, "table_description"에 표 내용을 완전히 텍스트로 정리
- 문제에 그림/다이어그램이 있으면 "has_image": true, "image_description"에 설명
- 표나 그림 없이는 문제를 풀 수 없는 경우 "needs_visual": true
- 표의 행/열 데이터를 body에 가능한 한 텍스트로 포함 (예: "구분 | 값1 | 값2")
- "<표>" 같은 마커가 있으면 전후 맥락에서 표 데이터를 유추하여 table_description에 정리` : '';

  const prompt = `이 ${useVision ? '문서 이미지' : '텍스트'}에서 객관식 시험 문제를 모두 추출해주세요.
반드시 아래 JSON 배열 형식으로만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.

[
  {
    "original_number": "원래 문제 번호 (숫자)",
    "body": "문제 본문 (순수 텍스트, HTML 태그 없이)",
    "choices": [
      {"num": 1, "text": "1번 선택지 텍스트"},
      {"num": 2, "text": "2번 선택지 텍스트"},
      {"num": 3, "text": "3번 선택지 텍스트"},
      {"num": 4, "text": "4번 선택지 텍스트"}
    ],
    "answer": 0${visualFields ? ',' + visualFields : ''}
  }
]

주의사항:
- 문제가 여러 개이면 모두 추출하여 배열에 포함
- 선택지 앞 번호·동그라미(①②③④) 제거하고 텍스트만
- 법률명의 「」 괄호는 그대로 유지
- answer는 정답이 표시되어 있으면 번호, 아니면 0
- 5지선다도 있으면 5번째 선택지 포함
- 문제를 하나도 빠뜨리지 마세요${visualInstructions}`;

  let parts;
  if (useVision) {
    // Vision: 문서 파일을 직접 전송
    const { data, mimeType } = fileToBase64(filePath);
    parts = [
      { text: prompt },
      { inlineData: { mimeType, data } },
    ];
  } else {
    // 텍스트 기반: 추출된 텍스트를 프롬프트에 포함
    parts = [
      { text: prompt + '\n\n--- 추출된 텍스트 ---\n' + textContent },
    ];
  }

  console.log(`   Gemini ${useVision ? 'Vision' : 'Text'} 파싱 중...`);
  const result = await model.generateContent(parts);
  const responseText = result.response.text();

  // JSON 배열 추출
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) {
    throw new Error('JSON 추출 실패:\n' + responseText.substring(0, 500));
  }

  const questions = JSON.parse(jsonMatch[1]);
  if (!Array.isArray(questions)) {
    throw new Error('파싱 결과가 배열이 아닙니다');
  }

  return questions;
}

// ── 시험 자동 생성 ──
async function getOrCreateExam() {
  if (EXAM_ID) return EXAM_ID;

  // 같은 제목의 시험이 있으면 재사용
  const existing = await query(
    'SELECT id FROM exams WHERE title = $1 AND category_id = $2',
    [EXAM_TITLE, CATEGORY_ID]
  );
  if (existing.rows.length > 0) {
    console.log(`기존 시험 사용: id=${existing.rows[0].id} ("${EXAM_TITLE}")`);
    return existing.rows[0].id;
  }

  // 새로 생성
  const maxSort = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM exams');
  const result = await query(
    'INSERT INTO exams (title, category_id, sort_order) VALUES ($1, $2, $3) RETURNING id',
    [EXAM_TITLE, CATEGORY_ID, maxSort.rows[0].next]
  );
  console.log(`시험 생성: id=${result.rows[0].id} ("${EXAM_TITLE}")`);
  return result.rows[0].id;
}

// ── 중복 체크 ──
async function isDuplicate(examId, originalNumber) {
  const result = await query(
    'SELECT id FROM questions WHERE exam_id = $1 AND original_number = $2',
    [examId, String(originalNumber)]
  );
  return result.rows.length > 0;
}

// ── 메인 파이프라인 ──
async function main() {
  // done 폴더 확보
  if (!fs.existsSync(DONE_DIR)) fs.mkdirSync(DONE_DIR, { recursive: true });

  // pool 폴더 스캔
  const files = fs.readdirSync(POOL_DIR)
    .filter(f => SUPPORTED_EXT.test(f) && !fs.statSync(path.join(POOL_DIR, f)).isDirectory())
    .sort();

  if (files.length === 0) {
    console.log('pool/ 폴더에 처리할 파일이 없습니다.');
    process.exit(0);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`pool/ 폴더에 ${files.length}개 파일 발견`);
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (미리보기)' : '실제 등록'}`);
  console.log('='.repeat(60));

  // 시험 ID 확보
  const examId = DRY_RUN ? (EXAM_ID || 0) : await getOrCreateExam();
  console.log(`시험 ID: ${examId}`);

  // 다음 문제 번호 조회
  const lastQ = await query(
    'SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE exam_id = $1',
    [examId]
  );
  let nextNum = lastQ.rows[0].max_num + 1;
  console.log(`다음 문제 번호: ${nextNum}부터\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalVisual = 0;  // 표/그림 포함 문제 수

  for (const file of files) {
    const filePath = path.join(POOL_DIR, file);
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`파일: ${file}`);
    console.log('─'.repeat(50));

    try {
      // 1단계: 문제 추출
      const questions = await extractQuestionsFromFile(filePath);
      console.log(`   추출된 문제: ${questions.length}개`);

      // 2단계: DB 등록
      for (const q of questions) {
        // 중복 체크
        if (!DRY_RUN && await isDuplicate(examId, q.original_number)) {
          console.log(`   [건너뜀] #${q.original_number} — 이미 등록됨`);
          totalSkipped++;
          continue;
        }

        // 표/그림 메타데이터 (Vision 모드에서만 포함됨)
        const hasVisual = q.has_table || q.has_image || false;
        const visualMeta = hasVisual ? {
          has_table: q.has_table || false,
          has_image: q.has_image || false,
          table_description: q.table_description || '',
          image_description: q.image_description || '',
          needs_visual: q.needs_visual || false,
        } : null;

        // 표 내용이 body에 누락된 경우, table_description을 body에 추가
        let bodyText = q.body;
        if (q.has_table && q.table_description && !bodyText.includes(q.table_description.substring(0, 20))) {
          bodyText += '\n\n[표]\n' + q.table_description;
        }

        if (DRY_RUN) {
          console.log(`   [미리보기] #${q.original_number}: ${bodyText.substring(0, 60)}...`);
          console.log(`     선택지 ${q.choices.length}개, 정답: ${q.answer}`);
          if (hasVisual) {
            console.log(`     📊 시각자료: 표=${q.has_table || false} 그림=${q.has_image || false} 필수=${q.needs_visual || false}`);
            if (q.table_description) console.log(`     📋 표 내용: ${q.table_description.substring(0, 80)}...`);
          }
        } else {
          await query(
            `INSERT INTO questions (exam_id, question_number, original_number, body, choices, answer)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [examId, nextNum, String(q.original_number), bodyText,
             JSON.stringify(q.choices), String(q.answer || 0)]
          );
          console.log(`   [등록] #${q.original_number} → question_number=${nextNum}${hasVisual ? ' 📊시각자료포함' : ''}`);
          nextNum++;
          totalInserted++;
          if (hasVisual) totalVisual++;
        }
      }

      // 3단계: 처리 완료 파일 이동
      if (!DRY_RUN) {
        const destPath = path.join(DONE_DIR, file);
        fs.renameSync(filePath, destPath);
        console.log(`   파일 이동: pool/${file} → pool/done/${file}`);
      }

    } catch (err) {
      console.error(`   [오류] ${file}: ${err.message}`);
    }
  }

  // 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log(`처리 완료`);
  console.log(`  등록: ${totalInserted}개`);
  console.log(`  건너뜀(중복): ${totalSkipped}개`);
  if (totalVisual > 0) console.log(`  📊 표/그림 포함: ${totalVisual}개`);
  if (DRY_RUN) console.log('  (DRY-RUN 모드 — 실제 저장되지 않았습니다)');
  console.log('='.repeat(60));
  console.log('\n해설 생성은 별도로 실행하세요:');
  console.log(`  node pool-explain.js --exam-id=${examId}`);

  process.exit(0);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
