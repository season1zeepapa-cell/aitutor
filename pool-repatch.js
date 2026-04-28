// pool-repatch.js — 통합 문제 추출 파이프라인 (HWP / PDF / 이미지 대응)
// 파일 확장자별 최적 전략 자동 선택 → Gemini Vision → DB UPDATE + 이미지 서빙
//
// 지원 파일:
//   HWP  → hwp5html → 표 <table> 보존 + bindata/ 이미지 추출 → Vision
//   PDF  → Gemini Vision 직접 전송 (PDF MIME 지원)
//   이미지 → Gemini Vision 직접 전송
//
// 사용법:
//   node pool-repatch.js --exam-id=136 --file="파일명.hwp" --dry-run
//   node pool-repatch.js --exam-id=136 --file="시험지.pdf"
//   node pool-repatch.js --exam-id=136 --file="scan.jpg"
//   node pool-repatch.js --exam-id=136 --file="파일명.hwp" --only-visual

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('./api/db');

const POOL_DIR = path.join(__dirname, 'pool');
const TEMP_DIR = path.join(POOL_DIR, 'temp');
const IMAGE_DIR = path.join(__dirname, 'public', 'q-images');
const HWP5HTML = '/Users/2team/Library/Python/3.9/bin/hwp5html';

// ── CLI 인자 파싱 ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY_VISUAL = args.includes('--only-visual');
const getArg = (name) => {
  const a = args.find(a => a.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : null;
};

const EXAM_ID = getArg('exam-id') ? parseInt(getArg('exam-id')) : null;
const FILE_NAME = getArg('file');

if (!EXAM_ID || !FILE_NAME) {
  console.error('pool-repatch: 통합 문제 추출 파이프라인 (HWP/PDF/이미지)\n');
  console.error('사용법:');
  console.error('  node pool-repatch.js --exam-id=136 --file="파일명.hwp" --dry-run');
  console.error('  node pool-repatch.js --exam-id=136 --file="시험지.pdf"');
  console.error('  node pool-repatch.js --exam-id=136 --file="scan.jpg"');
  console.error('  node pool-repatch.js --exam-id=136 --file="파일명.hwp" --only-visual');
  console.error('\n지원 파일:');
  console.error('  HWP/HWPX → hwp5html (표 보존 + 이미지 추출) → Vision');
  console.error('  PDF      → Gemini Vision 직접 전송');
  console.error('  PNG/JPG  → Gemini Vision 직접 전송');
  console.error('\n옵션:');
  console.error('  --dry-run      미리보기만 (DB/파일 수정 안 함)');
  console.error('  --only-visual  표/그림 마커가 있는 문제만 업데이트');
  process.exit(1);
}

const filePath = path.join(POOL_DIR, FILE_NAME);
if (!fs.existsSync(filePath)) {
  console.error(`파일을 찾을 수 없습니다: ${filePath}`);
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ══════════════════════════════════════════════════
// 1단계: 파일 형식별 추출 (HWP / PDF / 이미지)
// ══════════════════════════════════════════════════
function extractFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.hwp' || ext === '.hwpx') {
    return extractHwp(filePath);
  } else if (ext === '.pdf') {
    return extractPdf(filePath);
  } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
    return extractImage(filePath);
  } else {
    throw new Error(`지원하지 않는 파일 형식: ${ext} (지원: .hwp, .pdf, .png, .jpg)`);
  }
}

// ── HWP: hwp5html → HTML(표 보존) + 이미지 추출 ──
function extractHwp(hwpPath) {
  const outputDir = path.join(TEMP_DIR, 'html_' + Date.now());
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  console.log(`\n[1단계] HWP → HTML 변환 (hwp5html)`);
  execSync(`"${HWP5HTML}" "${hwpPath}" --output "${outputDir}"`, {
    stdio: 'pipe', timeout: 60000,
  });

  const htmlPath = path.join(outputDir, 'index.xhtml');
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML 변환 실패: ${htmlPath} 생성되지 않음`);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  console.log(`   HTML 크기: ${(html.length / 1024).toFixed(1)}KB`);

  // 이미지 파일 수집 (bindata/ 폴더)
  const images = {};
  const binDir = path.join(outputDir, 'bindata');
  if (fs.existsSync(binDir)) {
    const imgFiles = fs.readdirSync(binDir).filter(f => /\.(jpg|jpeg|png|gif|bmp)$/i.test(f));
    for (const imgFile of imgFiles) {
      const imgPath = path.join(binDir, imgFile);
      const buffer = fs.readFileSync(imgPath);
      const data = buffer.toString('base64');
      const imgExt = path.extname(imgFile).toLowerCase();
      const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.bmp': 'image/bmp' };
      let finalData = data, finalBuffer = buffer;
      let finalMime = mimeMap[imgExt] || 'image/jpeg', finalExt = imgExt;

      // BMP → JPEG 변환 (Gemini는 BMP 미지원)
      if (imgExt === '.bmp') {
        try {
          const jpgPath = imgPath.replace(/\.bmp$/i, '.jpg');
          execSync(`sips -s format jpeg "${imgPath}" --out "${jpgPath}"`, { stdio: 'pipe' });
          finalBuffer = fs.readFileSync(jpgPath);
          finalData = finalBuffer.toString('base64');
          finalMime = 'image/jpeg';
          finalExt = '.jpg';
          fs.unlinkSync(jpgPath);
        } catch {
          console.log(`   ⚠️  BMP→JPG 변환 실패: ${imgFile}`);
          continue;
        }
      }

      images[`bindata/${imgFile}`] = { data: finalData, buffer: finalBuffer, mimeType: finalMime, ext: finalExt };
    }
    console.log(`   이미지: ${Object.keys(images).length}개 추출`);
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  return { mode: 'hwp', html, images };
}

// ── PDF: 2단계 파이프라인 (텍스트 + 이미지 분리 추출) ──
function extractPdf(pdfPath) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const tempId = Date.now();

  // poppler 도구 확인
  let hasPdftotext = false, hasPdftohtml = false, hasPdfimages = false, hasPdftoppm = false;
  try { execSync('which pdftotext', { stdio: 'pipe' }); hasPdftotext = true; } catch {}
  try { execSync('which pdftohtml', { stdio: 'pipe' }); hasPdftohtml = true; } catch {}
  try { execSync('which pdfimages', { stdio: 'pipe' }); hasPdfimages = true; } catch {}
  try { execSync('which pdftoppm', { stdio: 'pipe' }); hasPdftoppm = true; } catch {}

  const hasPoppler = hasPdftotext || hasPdftohtml;

  // poppler 없으면 Vision 직접 전송 (폴백)
  if (!hasPoppler) {
    console.log(`\n[1단계] PDF → Gemini Vision 직접 전송 (poppler 미설치)`);
    const buffer = fs.readFileSync(pdfPath);
    return {
      mode: 'vision-direct',
      fileData: { data: buffer.toString('base64'), buffer, mimeType: 'application/pdf', ext: '.pdf' },
      images: {},
    };
  }

  console.log(`\n[1단계] PDF → 2단계 파이프라인 (poppler)`);
  console.log(`   도구: pdftotext=${hasPdftotext ? '✅' : '❌'} pdftohtml=${hasPdftohtml ? '✅' : '❌'} pdfimages=${hasPdfimages ? '✅' : '❌'}`);

  // ── 1-A: 텍스트 추출 (pdftotext -layout) ──
  let textContent = '';
  if (hasPdftotext) {
    const txtPath = path.join(TEMP_DIR, `pdf_${tempId}.txt`);
    try {
      execSync(`pdftotext -layout "${pdfPath}" "${txtPath}"`, { stdio: 'pipe', timeout: 30000 });
      textContent = fs.readFileSync(txtPath, 'utf-8');
      fs.unlinkSync(txtPath);
      console.log(`   텍스트 추출: ${textContent.length}자 (pdftotext -layout)`);
    } catch (e) {
      console.log(`   ⚠️  pdftotext 실패: ${e.message.substring(0, 60)}`);
    }
  }

  // ── 1-B: HTML 추출 (pdftohtml — 표 구조 보존) ──
  let htmlContent = '';
  if (hasPdftohtml) {
    const htmlDir = path.join(TEMP_DIR, `pdfhtml_${tempId}`);
    fs.mkdirSync(htmlDir, { recursive: true });
    try {
      execSync(`pdftohtml -noframes -enc UTF-8 "${pdfPath}" "${htmlDir}/output"`, { stdio: 'pipe', timeout: 30000 });
      const htmlFile = path.join(htmlDir, 'output.html');
      if (fs.existsSync(htmlFile)) {
        htmlContent = fs.readFileSync(htmlFile, 'utf-8');
        console.log(`   HTML 추출: ${(htmlContent.length / 1024).toFixed(1)}KB (pdftohtml)`);
      }
      fs.rmSync(htmlDir, { recursive: true, force: true });
    } catch (e) {
      console.log(`   ⚠️  pdftohtml 실패: ${e.message.substring(0, 60)}`);
      if (fs.existsSync(path.join(TEMP_DIR, `pdfhtml_${tempId}`))) {
        fs.rmSync(path.join(TEMP_DIR, `pdfhtml_${tempId}`), { recursive: true, force: true });
      }
    }
  }

  // ── 1-C: 이미지 추출 (pdfimages — PDF 내장 이미지만) ──
  const images = {};
  if (hasPdfimages) {
    const imgPrefix = path.join(TEMP_DIR, `pdfimg_${tempId}`);
    try {
      execSync(`pdfimages -png "${pdfPath}" "${imgPrefix}"`, { stdio: 'pipe', timeout: 30000 });
      const imgFiles = fs.readdirSync(TEMP_DIR)
        .filter(f => f.startsWith(`pdfimg_${tempId}`) && /\.(png|jpg|ppm)$/i.test(f));
      for (const imgFile of imgFiles) {
        const imgPath = path.join(TEMP_DIR, imgFile);
        const buffer = fs.readFileSync(imgPath);
        // 너무 작은 이미지 (아이콘 등) 무시 — 5KB 이상만
        if (buffer.length < 5 * 1024) {
          fs.unlinkSync(imgPath);
          continue;
        }
        const data = buffer.toString('base64');
        const imgExt = path.extname(imgFile).toLowerCase();
        const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.ppm': 'image/x-portable-pixmap' };
        images[`pdfimg/${imgFile}`] = {
          data, buffer,
          mimeType: mimeMap[imgExt] || 'image/png',
          ext: imgExt === '.ppm' ? '.png' : imgExt,
        };
        fs.unlinkSync(imgPath);
      }
      if (Object.keys(images).length > 0) {
        console.log(`   이미지 추출: ${Object.keys(images).length}개 (pdfimages, 5KB+ 필터)`);
      }
    } catch (e) {
      console.log(`   ⚠️  pdfimages 실패: ${e.message.substring(0, 60)}`);
    }
  }

  // HTML이 있으면 HWP와 동일한 방식으로 처리, 없으면 텍스트+Vision
  if (htmlContent) {
    return { mode: 'pdf-html', html: htmlContent, images, textContent };
  } else if (textContent) {
    // 텍스트만 있는 경우 — Vision 직접 전송과 병행
    const buffer = fs.readFileSync(pdfPath);
    return {
      mode: 'pdf-text',
      textContent,
      fileData: { data: buffer.toString('base64'), buffer, mimeType: 'application/pdf', ext: '.pdf' },
      images,
    };
  } else {
    // poppler 추출 모두 실패 → Vision 직접 전송
    const buffer = fs.readFileSync(pdfPath);
    return {
      mode: 'vision-direct',
      fileData: { data: buffer.toString('base64'), buffer, mimeType: 'application/pdf', ext: '.pdf' },
      images: {},
    };
  }
}

// ── 이미지: Gemini Vision 직접 전송 ──
function extractImage(imgPath) {
  console.log(`\n[1단계] 이미지 → Gemini Vision 직접 전송`);
  const buffer = fs.readFileSync(imgPath);
  const data = buffer.toString('base64');
  const ext = path.extname(imgPath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
  console.log(`   이미지 크기: ${(buffer.length / 1024).toFixed(1)}KB`);
  return {
    mode: 'vision-direct',
    fileData: { data, buffer, mimeType: mimeMap[ext] || 'image/jpeg', ext },
    images: {},
  };
}

// ══════════════════════════════════════════════════
// 2단계: HTML 표 → 텍스트 변환
// ══════════════════════════════════════════════════
function htmlTableToText(html) {
  return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match) => {
    const rows = [];
    const rowMatches = match.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rowMatches) {
      const cells = [];
      const cellMatches = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      for (const cell of cellMatches) {
        let text = cell
          .replace(/<[^>]+>/g, '')
          .replace(/&#13;/g, '')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) cells.push(text);
      }
      if (cells.length > 0) rows.push(cells.join(' | '));
    }
    return rows.length > 0 ? '\n' + rows.join('\n') + '\n' : '';
  });
}

// ══════════════════════════════════════════════════
// 3단계: Gemini Vision — 파일 형식별 문제 추출
// ══════════════════════════════════════════════════

// PDF/이미지: Gemini Vision에 파일을 직접 전송
async function extractFromVision(fileData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  console.log(`[3단계] Gemini Vision 직접 분석 (${fileData.mimeType})`);

  const prompt = `이 시험 문서에서 모든 객관식 문제를 추출해주세요.

매우 중요:
- 표(table) 데이터 → body에 "| 열1 | 열2" 형식으로 포함
- 그림/다이어그램/스크린샷 → body에 텍스트로 완전히 기술
  - 명령어 출력 → 실제 출력 텍스트 그대로 포함
  - 설정 파일 → 파일 내용 그대로 포함
  - 다이어그램 → 구성 요소와 흐름을 텍스트로 설명
- 선택지(①②③④) → choices에만 넣기, body에서 제거
- 50문제 전부 빠짐없이 추출

JSON 배열만 출력:
[
  {
    "original_number": 1,
    "body": "문제 본문 전체 (표/이미지 내용 텍스트 포함)",
    "choices": [{"num": 1, "text": "..."}, {"num": 2, "text": "..."}, {"num": 3, "text": "..."}, {"num": 4, "text": "..."}],
    "answer": 0,
    "has_table": false,
    "has_image": false,
    "image_index": null
  }
]

주의: original_number=정수, 선택지 기호 제거, 법률명 「」 유지, answer=정답번호 또는 0`;

  const parts = [
    { text: prompt },
    { inlineData: { mimeType: fileData.mimeType, data: fileData.data } },
  ];

  const result = await model.generateContent(parts);
  const responseText = result.response.text();

  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error('JSON 추출 실패 — AI 응답 형식 오류');

  let jsonStr = jsonMatch[1]
    .replace(/[\x00-\x1f]/g, (ch) => ch === '\n' || ch === '\r' || ch === '\t' ? ch : '')
    .replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');

  let questions;
  try {
    questions = JSON.parse(jsonStr);
  } catch (e) {
    console.log(`   ⚠️  JSON 파싱 실패, 복구 시도: ${e.message.substring(0, 60)}`);
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      questions = JSON.parse(jsonStr.substring(0, lastBrace + 1) + ']');
    } else {
      throw e;
    }
  }
  if (!Array.isArray(questions)) throw new Error('파싱 결과가 배열이 아닙니다');

  return { questions, imageRefs: [] };
}

// HWP: HTML 파싱 + 이미지 배열 → Gemini Vision
async function extractFromHtml(htmlContent, images) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // HTML body 추출
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : htmlContent;
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // img → [이미지N] 플레이스홀더 + 이미지 참조 수집
  const imageRefs = [];
  content = content.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (match, src) => {
    if (images[src]) {
      imageRefs.push({ placeholder: `[이미지${imageRefs.length + 1}]`, src, ...images[src] });
      return `\n[이미지${imageRefs.length}]\n`;
    }
    return '';
  });

  // 표 → 텍스트
  content = htmlTableToText(content);

  // HTML 태그 정리
  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#13;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  console.log(`[3단계] Gemini Vision 추출 (텍스트 ${(content.length / 1024).toFixed(1)}KB, 이미지 ${imageRefs.length}개)`);

  const imageInstructions = imageRefs.length > 0 ? `
- [이미지N]이 있는 문제: has_image를 true로 설정하고, image_index에 해당 이미지 번호(1부터)를 기록
- 이미지 내용(명령어 출력, 설정파일, 다이어그램 등)을 body에 텍스트로 완전히 기술
  - 명령어 출력 → 실제 출력 텍스트 그대로 포함
  - 설정 파일 → 파일 내용 그대로 포함
  - 다이어그램/구성도 → 구성 요소와 흐름을 텍스트로 설명
  - 스크린샷 → 화면에 보이는 내용을 상세히 기술` : '';

  const prompt = `다음은 네트워크관리사 2급 필기 시험지입니다.
모든 객관식 문제를 추출해주세요.

매우 중요:
- 표(table) 데이터 → body에 "| 열1 | 열2" 형식으로 포함
- 선택지(①②③④) → choices에만 넣기, body에서 제거
- 50문제 전부 빠짐없이 추출${imageInstructions}

JSON 배열만 출력:
[
  {
    "original_number": 1,
    "body": "문제 본문 전체 (표/이미지 내용 텍스트 포함)",
    "choices": [{"num": 1, "text": "..."}, {"num": 2, "text": "..."}, {"num": 3, "text": "..."}, {"num": 4, "text": "..."}],
    "answer": 0,
    "has_table": false,
    "has_image": false,
    "image_index": null
  }
]

주의: original_number=정수, 선택지 기호 제거, 법률명 「」 유지, answer=정답번호 또는 0
--- 시험지 텍스트 ---
${content}`;

  // Gemini에 텍스트 + 이미지 함께 전송
  const parts = [{ text: prompt }];
  for (const img of imageRefs) {
    parts.push({ text: `\n--- ${img.placeholder} ---` });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const result = await model.generateContent(parts);
  const responseText = result.response.text();

  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error('JSON 추출 실패 — AI 응답 형식 오류');

  let jsonStr = jsonMatch[1]
    .replace(/[\x00-\x1f]/g, (ch) => ch === '\n' || ch === '\r' || ch === '\t' ? ch : '') // 제어문자 제거
    .replace(/,\s*]/g, ']')    // trailing comma 수정
    .replace(/,\s*}/g, '}');   // trailing comma 수정

  let questions;
  try {
    questions = JSON.parse(jsonStr);
  } catch (e) {
    // JSON 파싱 실패 시 잘린 부분 복구 시도
    console.log(`   ⚠️  JSON 파싱 실패, 복구 시도: ${e.message.substring(0, 60)}`);
    // 마지막 완전한 객체까지만 잘라서 파싱
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      const truncated = jsonStr.substring(0, lastBrace + 1) + ']';
      questions = JSON.parse(truncated);
    } else {
      throw e;
    }
  }
  if (!Array.isArray(questions)) throw new Error('파싱 결과가 배열이 아닙니다');

  // imageRefs 정보를 questions에 연결
  return { questions, imageRefs };
}

// ══════════════════════════════════════════════════
// 4단계: 이미지 파일 저장 (public/q-images/)
// ══════════════════════════════════════════════════
function saveImages(examId, questions, imageRefs) {
  if (imageRefs.length === 0) return {};

  if (!DRY_RUN && !fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }

  // 문제별 이미지 매핑: image_index → 이미지 파일
  const imageMap = {}; // { original_number: image_url }

  for (const q of questions) {
    if (!q.has_image || !q.image_index) continue;
    const imgIdx = q.image_index - 1;
    if (imgIdx < 0 || imgIdx >= imageRefs.length) continue;

    const img = imageRefs[imgIdx];
    const fileName = `exam${examId}_q${q.original_number}${img.ext || '.jpg'}`;
    const imageUrl = `/q-images/${fileName}`;

    if (DRY_RUN) {
      console.log(`   [이미지 미리보기] #${q.original_number} → ${imageUrl} (${(img.buffer.length / 1024).toFixed(1)}KB)`);
    } else {
      const destPath = path.join(IMAGE_DIR, fileName);
      fs.writeFileSync(destPath, img.buffer);
      console.log(`   [이미지 저장] #${q.original_number} → ${imageUrl} (${(img.buffer.length / 1024).toFixed(1)}KB)`);
    }

    imageMap[String(q.original_number)] = imageUrl;
  }

  return imageMap;
}

// ══════════════════════════════════════════════════
// 5단계: DB UPDATE — body + image_url
// ══════════════════════════════════════════════════
async function updateQuestions(examId, questions, imageMap) {
  const existing = await query(
    `SELECT id, question_number, original_number, body, choices, answer, image_url
     FROM questions WHERE exam_id = $1 ORDER BY question_number`,
    [examId]
  );

  console.log(`\n[5단계] DB 업데이트 (기존 ${existing.rows.length}문제, 추출 ${questions.length}문제)`);

  let updated = 0, skipped = 0, notFound = 0, imgUpdated = 0;

  for (const nq of questions) {
    const origNum = String(nq.original_number);
    const dbQ = existing.rows.find(q => q.original_number === origNum);

    if (!dbQ) {
      console.log(`   [없음] #${origNum} — DB에 해당 문제 없음`);
      notFound++;
      continue;
    }

    // --only-visual: 표/그림 마커 문제만
    const hasVisualMarker = /(<표>|<그림>|다음\s*표|다음\s*그림|구성도|토폴로지)/.test(dbQ.body);
    if (ONLY_VISUAL && !hasVisualMarker && !nq.has_table && !nq.has_image) {
      skipped++;
      continue;
    }

    const oldBody = dbQ.body || '';
    const newBody = nq.body || '';
    const newImageUrl = imageMap[origNum] || null;

    // 변경 필요 여부 판단
    const oldHasMarker = /<표>|<그림>/.test(oldBody);
    const bodyImproved = newBody.length > oldBody.length * 1.1;
    const hasNewImage = newImageUrl && newImageUrl !== dbQ.image_url;

    if (!oldHasMarker && !bodyImproved && !hasNewImage) {
      if (Math.abs(newBody.length - oldBody.length) < 20) {
        skipped++;
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(`\n   [미리보기] #${origNum} (Q${dbQ.question_number})`);
      console.log(`     body: ${oldBody.length}→${newBody.length}자`);
      if (nq.has_table) console.log(`     📊 표 포함`);
      if (nq.has_image) console.log(`     🖼️  이미지 포함`);
      if (hasNewImage) console.log(`     📎 image_url: ${newImageUrl}`);
      updated++;
      if (hasNewImage) imgUpdated++;
    } else {
      // body + image_url 함께 업데이트
      if (hasNewImage) {
        await query(
          `UPDATE questions SET body = $1, choices = $2, image_url = $3, updated_at = NOW() WHERE id = $4`,
          [newBody, JSON.stringify(nq.choices), newImageUrl, dbQ.id]
        );
      } else {
        await query(
          `UPDATE questions SET body = $1, choices = $2, updated_at = NOW() WHERE id = $3`,
          [newBody, JSON.stringify(nq.choices), dbQ.id]
        );
      }
      const flags = [nq.has_table ? '📊' : '', nq.has_image ? '🖼️' : '', hasNewImage ? '📎' : ''].filter(Boolean).join('');
      console.log(`   [업데이트] #${origNum} body:${oldBody.length}→${newBody.length}자 ${flags}`);
      updated++;
      if (hasNewImage) imgUpdated++;
    }
  }

  return { updated, skipped, notFound, imgUpdated };
}

// ══════════════════════════════════════════════════
// 메인
// ══════════════════════════════════════════════════
async function main() {
  const ext = path.extname(filePath).toLowerCase();
  console.log('='.repeat(60));
  console.log('pool-repatch: 통합 문제 추출 파이프라인');
  console.log('='.repeat(60));
  console.log(`파일: ${FILE_NAME} (${ext})`);
  console.log(`시험 ID: ${EXAM_ID}`);
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN' : '실제 적용'}${ONLY_VISUAL ? ' + 표/그림만' : ''}`);
  console.log(`이미지 저장: ${IMAGE_DIR}`);

  // 1단계: 파일 형식별 추출
  const extracted = extractFile(filePath);

  // 2~3단계: Gemini로 문제 추출 (모드별 분기)
  let questions, imageRefs;
  switch (extracted.mode) {
    case 'hwp':
      // HWP: HTML(표 보존) + 이미지 배열 → Gemini Vision
      ({ questions, imageRefs } = await extractFromHtml(extracted.html, extracted.images));
      break;
    case 'pdf-html':
      // PDF: pdftohtml 결과(표 구조 보존) + 추출 이미지 → Gemini Vision
      console.log(`   PDF 모드: HTML 기반 (표 구조 보존)`);
      ({ questions, imageRefs } = await extractFromHtml(extracted.html, extracted.images));
      break;
    case 'pdf-text':
      // PDF: 텍스트 추출 + PDF Vision 동시 전송
      console.log(`   PDF 모드: 텍스트 + Vision 병행`);
      ({ questions, imageRefs } = await extractFromVision(extracted.fileData));
      break;
    default:
      // 이미지 또는 폴백: Vision 직접 전송
      ({ questions, imageRefs } = await extractFromVision(extracted.fileData));
  }
  console.log(`\n   추출: ${questions.length}문제`);
  const tableCount = questions.filter(q => q.has_table).length;
  const imgCount = questions.filter(q => q.has_image).length;
  if (tableCount > 0) console.log(`   📊 표 포함: ${tableCount}문제`);
  if (imgCount > 0) console.log(`   🖼️  이미지 포함: ${imgCount}문제`);

  // 4단계: 이미지 저장
  console.log(`\n[4단계] 이미지 저장 (${imageRefs.length}개 추출됨)`);
  const imageMap = saveImages(EXAM_ID, questions, imageRefs);
  const savedCount = Object.keys(imageMap).length;
  if (savedCount > 0) console.log(`   이미지 매핑: ${savedCount}문제`);

  // 5단계: DB 업데이트
  const result = await updateQuestions(EXAM_ID, questions, imageMap);

  // 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log('처리 완료');
  console.log(`  body 업데이트: ${result.updated}개`);
  console.log(`  이미지 연결: ${result.imgUpdated}개`);
  console.log(`  건너뜀: ${result.skipped}개`);
  console.log(`  DB 미존재: ${result.notFound}개`);
  if (DRY_RUN) console.log('  (DRY-RUN 모드)');
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
