// pool-import-v2.js — 표/그림 보존 고품질 파이프라인
// HWP/PDF를 페이지별로 분할하여 Gemini Vision으로 추출
// 표, 그림, 다이어그램이 포함된 문제를 정확하게 처리
//
// 사용법:
//   node pool-import-v2.js --exam-title="2026년 1회차" --category-id=1
//   node pool-import-v2.js --exam-id=4 --dry-run
//   node pool-import-v2.js --exam-id=4 --force-vision    ← 모든 파일 Vision
//   node pool-import-v2.js --exam-id=4 --hwp-vision      ← HWP를 직접 Vision 전송
//
// 방안 1 파이프라인: HWP → PDF(LibreOffice) → 페이지 이미지 → Vision
// 방안 1-B (LibreOffice 없을 때): HWP를 직접 Gemini Vision으로 전송
//
// 기존 pool-import.js와 완전 독립 — 기존 로직에 영향 없음

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('./api/db');

const POOL_DIR = path.join(__dirname, 'pool');
const DONE_DIR = path.join(POOL_DIR, 'done');
const TEMP_DIR = path.join(POOL_DIR, 'temp');

// ── CLI 인자 파싱 ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const HWP_VISION = args.includes('--hwp-vision');
const getArg = (name) => {
  const a = args.find(a => a.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : null;
};

const EXAM_ID = getArg('exam-id') ? parseInt(getArg('exam-id')) : null;
const EXAM_TITLE = getArg('exam-title');
const CATEGORY_ID = getArg('category-id') ? parseInt(getArg('category-id')) : null;
const SUPPORTED_EXT = /\.(pdf|hwp|hwpx|png|jpg|jpeg)$/i;

// ── 입력 검증 ──
if (!EXAM_ID && !EXAM_TITLE) {
  console.error('pool-import-v2: 표/그림 보존 고품질 파이프라인\n');
  console.error('사용법:');
  console.error('  node pool-import-v2.js --exam-id=4 [--dry-run]');
  console.error('  node pool-import-v2.js --exam-title="2026년 1회차" --category-id=1');
  console.error('  node pool-import-v2.js --exam-id=4 --hwp-vision   ← HWP 직접 Vision');
  console.error('\n방안 1: HWP → PDF(LibreOffice) → 페이지 이미지 → Vision');
  console.error('방안 1-B: HWP → 직접 Gemini Vision (LibreOffice 없을 때)');
  process.exit(1);
}
if (EXAM_TITLE && !CATEGORY_ID) {
  console.error('--exam-title 사용 시 --category-id는 필수입니다.');
  process.exit(1);
}

// ── Gemini 클라이언트 ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── 시스템 도구 확인 ──
function checkTools() {
  const tools = {};
  try { execSync('which soffice', { stdio: 'pipe' }); tools.libreoffice = true; } catch { tools.libreoffice = false; }
  try { execSync('which pdftoppm', { stdio: 'pipe' }); tools.poppler = true; } catch { tools.poppler = false; }
  try { execSync('which hwp5txt', { stdio: 'pipe' }); tools.hwp5txt = true; } catch {
    try { execSync('which /Users/2team/Library/Python/3.9/bin/hwp5txt', { stdio: 'pipe' }); tools.hwp5txt = true; } catch { tools.hwp5txt = false; }
  }
  return tools;
}

// ── 파일 → base64 ──
function fileToBase64(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath).toString('base64');
  const mimeMap = {
    '.pdf': 'application/pdf', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.hwp': 'application/x-hwp', '.hwpx': 'application/x-hwpx',
  };
  return { data, mimeType: mimeMap[ext] || 'application/octet-stream' };
}

// ── HWP → PDF 변환 (LibreOffice headless) ──
function hwpToPdf(hwpPath) {
  const outputDir = TEMP_DIR;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const basename = path.basename(hwpPath, path.extname(hwpPath));

  console.log(`   [변환] HWP → PDF (LibreOffice headless)`);
  execSync(`soffice --headless --convert-to pdf "${hwpPath}" --outdir "${outputDir}"`, {
    stdio: 'pipe', timeout: 60000,
  });

  const pdfPath = path.join(outputDir, `${basename}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF 변환 실패: ${pdfPath} 생성되지 않음`);
  }
  console.log(`   [변환] PDF 생성: ${pdfPath}`);
  return pdfPath;
}

// ── PDF → 페이지별 PNG (poppler pdftoppm) ──
function pdfToImages(pdfPath) {
  const outputDir = TEMP_DIR;
  const basename = path.basename(pdfPath, '.pdf');
  const prefix = path.join(outputDir, basename);

  console.log(`   [변환] PDF → 페이지별 PNG (pdftoppm)`);
  execSync(`pdftoppm -png -r 200 "${pdfPath}" "${prefix}"`, {
    stdio: 'pipe', timeout: 60000,
  });

  // 생성된 이미지 목록 (page-01.png, page-02.png, ...)
  const images = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(basename) && f.endsWith('.png'))
    .sort()
    .map(f => path.join(outputDir, f));

  console.log(`   [변환] ${images.length}페이지 이미지 생성`);
  return images;
}

// ── Gemini Vision — 페이지 이미지에서 문제 추출 ──
async function extractFromImage(imagePath, pageNum) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const { data, mimeType } = fileToBase64(imagePath);

  const prompt = `이 시험지 이미지 (${pageNum}페이지)에서 객관식 문제를 모두 추출해주세요.

중요 — 표와 그림 처리:
- 표(table)가 보이면 "has_table": true로 설정하고, 표의 모든 행/열 데이터를 "table_description"에 텍스트로 완전히 정리
- 그림/다이어그램이 보이면 "has_image": true로 설정하고, "image_description"에 상세 설명
- 표나 그림 데이터를 body에도 가능한 한 포함 (예: "구분 | 값1 | 값2")
- 표/그림 없이는 풀 수 없으면 "needs_visual": true

반드시 아래 JSON 배열 형식으로만 출력하세요:
[
  {
    "original_number": "문제 번호 (숫자)",
    "body": "문제 본문 (표 데이터도 텍스트로 포함)",
    "choices": [
      {"num": 1, "text": "선택지 텍스트"},
      {"num": 2, "text": "선택지 텍스트"},
      {"num": 3, "text": "선택지 텍스트"},
      {"num": 4, "text": "선택지 텍스트"}
    ],
    "answer": 0,
    "has_table": false,
    "has_image": false,
    "table_description": "",
    "image_description": "",
    "needs_visual": false
  }
]

주의: 선택지 번호(①②③④) 제거, 법률명 「」 유지, 5지선다 포함, 빠뜨리지 마세요.`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data } },
  ]);

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) return [];

  try {
    const questions = JSON.parse(jsonMatch[1]);
    return Array.isArray(questions) ? questions : [];
  } catch {
    console.error(`   [경고] ${pageNum}페이지 JSON 파싱 실패`);
    return [];
  }
}

// ── Gemini Vision — 문서 파일 직접 전송 ──
async function extractFromDocument(filePath) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const ext = path.extname(filePath).toLowerCase();

  // PDF는 Gemini가 직접 지원, HWP는 바이너리 전송 시도
  const { data, mimeType } = fileToBase64(filePath);
  // HWP MIME은 Gemini가 미지원할 수 있으므로 PDF로 변환 우선
  const effectiveMime = ext === '.hwp' ? 'application/pdf' : mimeType;

  const prompt = `이 시험 문서에서 객관식 문제를 모두 추출해주세요.

중요 — 표와 그림 처리:
- 표(table)가 있으면 "has_table": true, 표 전체 내용을 "table_description"에 텍스트로 정리
- 그림/다이어그램이 있으면 "has_image": true, "image_description"에 설명
- 표 데이터를 body에도 텍스트로 포함 (예: 행1: A | B | C)
- 표/그림 없이 풀 수 없으면 "needs_visual": true

반드시 JSON 배열만 출력:
[
  {
    "original_number": "문제 번호",
    "body": "문제 본문 (표 데이터 텍스트 포함)",
    "choices": [{"num": 1, "text": "..."}, {"num": 2, "text": "..."}, {"num": 3, "text": "..."}, {"num": 4, "text": "..."}],
    "answer": 0,
    "has_table": false, "has_image": false,
    "table_description": "", "image_description": "",
    "needs_visual": false
  }
]

주의: 선택지 번호 제거, 법률명 「」 유지, 5지선다 포함, 빠뜨리지 마세요.`;

  console.log(`   Gemini Vision 문서 분석 중 (${ext})...`);
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: effectiveMime, data } },
  ]);

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error('JSON 추출 실패');

  const questions = JSON.parse(jsonMatch[1]);
  if (!Array.isArray(questions)) throw new Error('파싱 결과가 배열이 아닙니다');
  return questions;
}

// ── 파일별 최적 파이프라인 선택 ──
async function processFile(filePath, tools) {
  const ext = path.extname(filePath).toLowerCase();
  const isHwp = ext === '.hwp' || ext === '.hwpx';
  const isPdf = ext === '.pdf';
  const isImage = /\.(png|jpg|jpeg)$/i.test(ext);

  // 전략 1: 이미지 파일 → 직접 Vision
  if (isImage) {
    console.log(`   [전략] 이미지 → 직접 Vision`);
    return await extractFromImage(filePath, 1);
  }

  // 전략 2: HWP + LibreOffice + poppler → 페이지별 이미지 → Vision (최고 품질)
  if (isHwp && tools.libreoffice && tools.poppler) {
    console.log(`   [전략] HWP → PDF(LibreOffice) → 페이지 이미지(poppler) → Vision`);
    const pdfPath = hwpToPdf(filePath);
    const images = pdfToImages(pdfPath);

    let allQuestions = [];
    for (let i = 0; i < images.length; i++) {
      console.log(`   [Vision] ${i + 1}/${images.length} 페이지 처리 중...`);
      const pageQuestions = await extractFromImage(images[i], i + 1);
      allQuestions = allQuestions.concat(pageQuestions);
      // API 속도 제한
      if (i < images.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    // 임시 파일 정리
    cleanTemp();
    return deduplicateQuestions(allQuestions);
  }

  // 전략 3: PDF + poppler → 페이지별 이미지 → Vision
  if (isPdf && tools.poppler) {
    console.log(`   [전략] PDF → 페이지 이미지(poppler) → Vision`);
    const images = pdfToImages(filePath);

    let allQuestions = [];
    for (let i = 0; i < images.length; i++) {
      console.log(`   [Vision] ${i + 1}/${images.length} 페이지 처리 중...`);
      const pageQuestions = await extractFromImage(images[i], i + 1);
      allQuestions = allQuestions.concat(pageQuestions);
      if (i < images.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    cleanTemp();
    return deduplicateQuestions(allQuestions);
  }

  // 전략 4: PDF → Gemini Vision 직접 전송 (poppler 없을 때)
  if (isPdf) {
    console.log(`   [전략] PDF → Gemini Vision 직접 전송`);
    return await extractFromDocument(filePath);
  }

  // 전략 5: HWP → Gemini Vision 직접 전송 (LibreOffice 없을 때, --hwp-vision)
  if (isHwp && HWP_VISION) {
    console.log(`   [전략] HWP → Gemini Vision 직접 전송 (실험적)`);
    return await extractFromDocument(filePath);
  }

  // 전략 6: HWP → hwp5txt → 텍스트 + Vision 강화 프롬프트 (폴백)
  if (isHwp && tools.hwp5txt) {
    console.log(`   [전략] HWP → hwp5txt(텍스트) + 강화 프롬프트 (표/그림 부분 제한)`);
    const hwp5txtPath = '/Users/2team/Library/Python/3.9/bin/hwp5txt';
    const txtPath = filePath.replace(/\.hwpx?$/i, '.txt');
    execSync(`"${hwp5txtPath}" "${filePath}" > "${txtPath}"`, { stdio: 'pipe' });
    const textContent = fs.readFileSync(txtPath, 'utf-8');
    fs.unlinkSync(txtPath);

    // 텍스트 기반이지만 표/그림 메타 추출 포함
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = buildTextPrompt(textContent);
    const result = await model.generateContent([{ text: prompt }]);
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\[[\s\S]*\])/);
    if (!jsonMatch) throw new Error('JSON 추출 실패');
    return JSON.parse(jsonMatch[1]);
  }

  throw new Error(`지원하지 않는 파일 형식 또는 필요 도구 미설치: ${ext}`);
}

// ── 텍스트 기반 프롬프트 (폴백용) ──
function buildTextPrompt(textContent) {
  return `이 텍스트에서 객관식 시험 문제를 모두 추출해주세요.

반드시 JSON 배열만 출력:
[
  {
    "original_number": "문제 번호",
    "body": "문제 본문",
    "choices": [{"num": 1, "text": "..."}, {"num": 2, "text": "..."}, {"num": 3, "text": "..."}, {"num": 4, "text": "..."}],
    "answer": 0,
    "has_table": false, "has_image": false,
    "table_description": "", "image_description": "",
    "needs_visual": false
  }
]

주의:
- <표> 마커가 있으면 has_table: true, needs_visual: true
- 선택지 번호 제거, 법률명 「」 유지, 5지선다 포함

--- 텍스트 ---
${textContent}`;
}

// ── 페이지 경계 중복 제거 ──
function deduplicateQuestions(questions) {
  const seen = new Map();
  for (const q of questions) {
    const key = String(q.original_number);
    // 같은 번호가 있으면, body가 더 긴 것(표 포함)을 유지
    if (!seen.has(key) || (q.body || '').length > (seen.get(key).body || '').length) {
      seen.set(key, q);
    }
  }
  const result = Array.from(seen.values()).sort((a, b) =>
    parseInt(a.original_number) - parseInt(b.original_number)
  );
  if (result.length < questions.length) {
    console.log(`   [중복제거] ${questions.length}개 → ${result.length}개 (페이지 경계 중복 ${questions.length - result.length}건)`);
  }
  return result;
}

// ── 임시 파일 정리 ──
function cleanTemp() {
  if (fs.existsSync(TEMP_DIR)) {
    const files = fs.readdirSync(TEMP_DIR);
    for (const f of files) {
      fs.unlinkSync(path.join(TEMP_DIR, f));
    }
    console.log(`   [정리] temp/ 임시 파일 ${files.length}개 삭제`);
  }
}

// ── 시험 자동 생성 (pool-import.js와 동일) ──
async function getOrCreateExam() {
  if (EXAM_ID) return EXAM_ID;
  const existing = await query(
    'SELECT id FROM exams WHERE title = $1 AND category_id = $2',
    [EXAM_TITLE, CATEGORY_ID]
  );
  if (existing.rows.length > 0) {
    console.log(`기존 시험 사용: id=${existing.rows[0].id} ("${EXAM_TITLE}")`);
    return existing.rows[0].id;
  }
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
  // 폴더 준비
  if (!fs.existsSync(DONE_DIR)) fs.mkdirSync(DONE_DIR, { recursive: true });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  // 시스템 도구 확인
  const tools = checkTools();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`pool-import-v2: 표/그림 보존 고품질 파이프라인`);
  console.log('='.repeat(60));
  console.log(`시스템 도구:`);
  console.log(`  LibreOffice: ${tools.libreoffice ? '✅' : '❌ (HWP→PDF 변환 불가)'}`);
  console.log(`  poppler:     ${tools.poppler ? '✅' : '❌ (PDF→이미지 불가, 직접 Vision 사용)'}`);
  console.log(`  hwp5txt:     ${tools.hwp5txt ? '✅' : '❌ (텍스트 폴백 불가)'}`);

  if (!tools.libreoffice && !tools.poppler) {
    console.log(`\n  💡 최고 품질을 위해 설치를 권장합니다:`);
    console.log(`     brew install --cask libreoffice`);
    console.log(`     brew install poppler`);
    console.log(`  현재는 Gemini Vision 직접 전송 모드로 동작합니다.\n`);
  }

  // pool 폴더 스캔 (TXT 제외 — v2는 원본 파일 직접 처리)
  const files = fs.readdirSync(POOL_DIR)
    .filter(f => SUPPORTED_EXT.test(f) && !fs.statSync(path.join(POOL_DIR, f)).isDirectory())
    .sort();

  if (files.length === 0) {
    console.log('\npool/ 폴더에 처리할 파일이 없습니다. (PDF/HWP/이미지 파일을 넣어주세요)');
    process.exit(0);
  }

  console.log(`\n파일 ${files.length}개 발견`);
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (미리보기)' : '실제 등록'}`);

  // 시험 ID 확보
  const examId = DRY_RUN ? (EXAM_ID || 0) : await getOrCreateExam();
  console.log(`시험 ID: ${examId}`);

  const lastQ = await query(
    'SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE exam_id = $1',
    [examId]
  );
  let nextNum = lastQ.rows[0].max_num + 1;

  let totalInserted = 0, totalSkipped = 0, totalVisual = 0;

  for (const file of files) {
    const filePath = path.join(POOL_DIR, file);
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`파일: ${file}`);
    console.log('─'.repeat(50));

    try {
      // 최적 전략으로 문제 추출
      const questions = await processFile(filePath, tools);
      console.log(`   추출된 문제: ${questions.length}개`);

      // 통계
      const visualCount = questions.filter(q => q.has_table || q.has_image).length;
      if (visualCount > 0) {
        console.log(`   📊 표/그림 포함: ${visualCount}개`);
      }

      // DB 등록
      for (const q of questions) {
        if (!DRY_RUN && await isDuplicate(examId, q.original_number)) {
          console.log(`   [건너뜀] #${q.original_number} — 이미 등록됨`);
          totalSkipped++;
          continue;
        }

        const hasVisual = q.has_table || q.has_image || false;

        // 표 내용을 body에 추가
        let bodyText = q.body;
        if (q.has_table && q.table_description && !bodyText.includes(q.table_description.substring(0, 20))) {
          bodyText += '\n\n[표]\n' + q.table_description;
        }

        if (DRY_RUN) {
          console.log(`   [미리보기] #${q.original_number}: ${bodyText.substring(0, 70)}...`);
          console.log(`     선택지 ${q.choices.length}개, 정답: ${q.answer}`);
          if (hasVisual) {
            console.log(`     📊 표=${q.has_table || false} 그림=${q.has_image || false} 필수=${q.needs_visual || false}`);
            if (q.table_description) console.log(`     📋 표: ${q.table_description.substring(0, 80)}...`);
            if (q.image_description) console.log(`     🖼️  그림: ${q.image_description.substring(0, 80)}...`);
          }
        } else {
          await query(
            `INSERT INTO questions (exam_id, question_number, original_number, body, choices, answer)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [examId, nextNum, String(q.original_number), bodyText,
             JSON.stringify(q.choices), String(q.answer || 0)]
          );
          console.log(`   [등록] #${q.original_number} → Q${nextNum}${hasVisual ? ' 📊' : ''}`);
          nextNum++;
          totalInserted++;
          if (hasVisual) totalVisual++;
        }
      }

      // 처리 완료 파일 이동
      if (!DRY_RUN) {
        fs.renameSync(filePath, path.join(DONE_DIR, file));
        console.log(`   파일 이동 → pool/done/${file}`);
      }

    } catch (err) {
      console.error(`   [오류] ${file}: ${err.message}`);
    }
  }

  // 임시 폴더 정리
  cleanTemp();

  // 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log(`처리 완료 (v2 파이프라인)`);
  console.log(`  등록: ${totalInserted}개`);
  console.log(`  건너뜀(중복): ${totalSkipped}개`);
  if (totalVisual > 0) console.log(`  📊 표/그림 포함: ${totalVisual}개`);
  if (DRY_RUN) console.log('  (DRY-RUN 모드)');
  console.log('='.repeat(60));
  console.log(`\n해설 생성: node pool-explain.js --exam-id=${examId}`);

  process.exit(0);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
