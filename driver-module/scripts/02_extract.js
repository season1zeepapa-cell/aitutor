#!/usr/bin/env node
/**
 * driver-module/scripts/02_extract.js
 *
 * PDF (도로교통공단 1·2종 보통, 대형·특수 학과시험 문제은행) → 정규화 JSON
 *
 * 동작:
 *   1) pdftotext -layout 로 페이지별 텍스트 추출 (\f 페이지 구분자)
 *   2) 정규식으로 문항 단위 분리 (1번 ~ 1000번)
 *   3) 보기(①②③④⑤), 정답, 해설 추출
 *   4) 동영상 문항 감지 ("(홈페이지 참조)" 또는 "영상" 키워드)
 *   5) pdfimages -p 로 페이지별 이미지 추출 → 문항·이미지 매핑
 *   6) 결과: data/raw-extracted.json
 *
 * 결과 JSON 스키마:
 *   {
 *     no: 1,                      // 문항 번호
 *     page: 1,                    // PDF 페이지 (이미지 매핑용)
 *     body: "...",                // 본문
 *     choices: ["...", "...", ...],   // 보기 (4 또는 5개)
 *     answer: 1,                  // 첫 번째 정답
 *     answer_extra: null | 4,     // 두 번째 정답 (복수 정답 시)
 *     explanation: "...",         // 해설
 *     image_file: null | "p124-img-001.jpg",  // 이미지 파일명 (data/images/ 안)
 *     is_video: false,            // 동영상 문항 여부
 *     category: null              // 후속 분류 (교통법규/안전운전/표지·신호)
 *   }
 *
 * 사용:
 *   node 02_extract.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PDF_PATH = path.join(__dirname, '../source/1_2_bo_dae_teuk_2026_03.pdf');
const IMAGES_DIR = path.join(__dirname, '../data/images');
const OUTPUT_JSON = path.join(__dirname, '../data/raw-extracted.json');

// ─── 1) 페이지별 텍스트 추출 ───
console.log('[1/4] pdftotext 로 페이지별 텍스트 추출...');
const rawFullText = execSync(`pdftotext -layout "${PDF_PATH}" -`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

// PDF 글꼴/인코딩 이슈로 잘못 추출되는 글자 정규화
//   ⓛ (Latin small letter L with circle, U+24DB) → ① (Circled digit one)
//   기타 발견 시 추가
const NORMALIZE_MAP = {
  'ⓛ': '①',
};
let fullText = rawFullText;
for (const [k, v] of Object.entries(NORMALIZE_MAP)) {
  fullText = fullText.split(k).join(v);
}

// \f (form feed) = 페이지 구분자. 각 페이지는 1-indexed.
const pages = fullText.split('\f');
console.log(`    총 ${pages.length} 페이지`);

// ─── 2) 문항 파싱 ───
// 페이지를 순회하며 페이지 안에서 문항 번호를 찾고, 그 위치의 다음 문항 번호 또는 페이지 끝까지를 한 문항으로 묶음.
console.log('[2/4] 문항 단위 분리 + 보기/정답/해설 추출...');

const questions = [];
// 문항 번호 정규식 — 1줄 시작에 "{N}. " 형태
//   본문은 보통 첫 줄에 짧은 질문이지만 여러 줄로 이어질 수도 있음.
const questionStartRegex = /^(\d+)\.\s+(.*)$/;
//   라인 시작에서 ①~⑤ 검출. ① 다음 공백 0개 이상 (예: `①"자동차전용도로"` 같은 케이스 대응)
const choiceRegex = /^\s*([①②③④⑤])\s*(.*)$/;
const answerRegex = /^\s*■\s*정답\s*[：:]\s*([\d,\s]+)\s*$/;
const explanationStartRegex = /^\s*■\s*해설\s*[：:]\s*(.*)$/;

const choiceIndexMap = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };

// 페이지마다 등장하는 모든 문항 번호 수집 → 페이지·문항 매핑
const pageToQuestionNumbers = {};   // { 1: [1,2,3], 124: [433], ... }

let currentQuestion = null;
let currentSection = 'before';  // 'before' | 'body' | 'choices' | 'answer' | 'explanation'
let lastAcceptedNo = 0;          // 단조 증가 검증용 — 해설 안의 "1." 같은 위장 번호 차단

function flushQuestion() {
  if (currentQuestion && currentQuestion.no) {
    questions.push(currentQuestion);
  }
  currentQuestion = null;
  currentSection = 'before';
}

pages.forEach((pageText, pageIdx) => {
  const pageNum = pageIdx + 1;  // 1-indexed
  const lines = pageText.split('\n');

  pageToQuestionNumbers[pageNum] = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) return;

    // 문항 시작 검출
    const qm = line.match(questionStartRegex);
    if (qm) {
      const candidateNo = parseInt(qm[1], 10);

      // 단조 증가 휴리스틱 — 해설 안의 "1. ...", "가. ..." 같은 항목 번호 차단
      // 직전 문항보다 작거나 너무 큰 점프(예: +50 초과)면 위장 번호로 간주
      const isMonotonic = candidateNo > lastAcceptedNo;
      const isTooBig    = candidateNo > lastAcceptedNo + 50;
      if (!isMonotonic || isTooBig) {
        // 위장 번호 — 현재 문항(있으면)의 해설로 흡수
        if (currentQuestion && currentSection === 'explanation') {
          currentQuestion.explanation += ' ' + line.trim();
        } else if (currentQuestion && currentSection === 'body') {
          currentQuestion.body += ' ' + line.trim();
        }
        return;
      }

      // 새 문항 시작 — 이전 문항을 마무리
      flushQuestion();
      currentQuestion = {
        no: candidateNo,
        page: pageNum,
        body: qm[2].trim(),
        choices: [],
        answer: null,
        answer_extra: null,
        explanation: '',
        image_file: null,
        is_video: false,
        category: null,
      };
      currentSection = 'body';
      lastAcceptedNo = candidateNo;
      pageToQuestionNumbers[pageNum].push(currentQuestion.no);
      return;
    }

    if (!currentQuestion) return;

    // 보기 검출
    const cm = line.match(choiceRegex);
    if (cm) {
      currentSection = 'choices';
      const idx = choiceIndexMap[cm[1]];
      // 같은 라인에 보기가 두 개 붙어 있을 수 있음 (예: ① ... ② ...)
      // 우선 해당 라인의 ①~⑤ 위치를 모두 찾아 분리
      const matches = [...line.matchAll(/([①②③④⑤])\s+([^①②③④⑤]+)/g)];
      matches.forEach((m) => {
        const j = choiceIndexMap[m[1]];
        currentQuestion.choices[j - 1] = m[2].trim();
      });
      return;
    }

    // 정답 검출
    const am = line.match(answerRegex);
    if (am) {
      const nums = am[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      currentQuestion.answer = nums[0] ?? null;
      currentQuestion.answer_extra = nums[1] ?? null;
      currentSection = 'answer';
      return;
    }

    // 해설 시작
    const em = line.match(explanationStartRegex);
    if (em) {
      currentSection = 'explanation';
      currentQuestion.explanation = em[1].trim();
      return;
    }

    // 본문/해설 다음 줄 이어쓰기
    if (currentSection === 'body') {
      // 보기가 시작되기 전까지는 body 로 이어짐
      currentQuestion.body += ' ' + line.trim();
    } else if (currentSection === 'explanation') {
      currentQuestion.explanation += ' ' + line.trim();
    } else if (currentSection === 'choices') {
      // 보기 줄이 다음 줄로 이어지는 경우 (보기가 길 때)
      if (currentQuestion.choices.length > 0) {
        const lastIdx = currentQuestion.choices.length - 1;
        if (currentQuestion.choices[lastIdx]) {
          currentQuestion.choices[lastIdx] += ' ' + line.trim();
        }
      }
    }
  });
});

// 마지막 문항 flush
flushQuestion();

console.log(`    문항 ${questions.length}개 추출됨`);

// ─── 동영상 문항 검출 ───
questions.forEach(q => {
  const text = `${q.body} ${q.explanation}`;
  if (text.includes('(홈페이지 참조)') ||
      /다음\s*영상/.test(text) ||
      /동영상에서/.test(text)) {
    q.is_video = true;
  }
});

const videoCount = questions.filter(q => q.is_video).length;
console.log(`    동영상 문항 ${videoCount}개 감지`);

// 본문 정리 — 끝에 "(홈페이지 참조)" 같은 표시는 별도 처리되므로 본문에 남겨도 OK
// choices 빈 슬롯 정리
questions.forEach(q => {
  q.choices = q.choices.filter(c => c !== undefined && c !== '');
});

// ─── 후처리: 보기가 본문에 합쳐진 케이스 분리 ───
// 본문 안에 ①②③④(⑤) 가 모두 등장하면, 첫 ① 위치에서 본문/보기 분리.
// 이건 ① 다음에 공백/따옴표가 바로 오는 케이스(예: `①"자동차전용..."`) 대응.
let recoveredCount = 0;
questions.forEach(q => {
  if (q.choices.length >= 4) return;
  const body = q.body;
  // 모든 ①~⑤ 위치 찾기 (본문 안)
  const positions = [];
  for (const ch of '①②③④⑤') {
    const idx = body.indexOf(ch);
    if (idx !== -1) positions.push({ ch, idx });
  }
  positions.sort((a, b) => a.idx - b.idx);
  if (positions.length < 4) return;

  // 첫 ① 위치에서 본문 분리
  const firstChoiceIdx = positions[0].idx;
  const realBody = body.slice(0, firstChoiceIdx).trim();
  const remainingText = body.slice(firstChoiceIdx);

  // 보기 4~5개 분리 — 각 ②③④⑤ 위치에서 자르기
  const splitChoices = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx - firstChoiceIdx + 1;  // ① 다음부터
    const end = i + 1 < positions.length ? positions[i + 1].idx - firstChoiceIdx : remainingText.length;
    const choiceText = remainingText.slice(start, end).trim();
    splitChoices.push(choiceText);
  }

  if (splitChoices.length >= 4) {
    q.body = realBody;
    q.choices = splitChoices;
    recoveredCount++;
  }
});
if (recoveredCount > 0) {
  console.log(`    후처리로 보기 복구된 문항: ${recoveredCount}개`);
}

// ─── 3) 이미지 추출 + 페이지·문항 매핑 ───
console.log('[3/4] pdfimages 로 이미지 추출 + 매핑...');

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
// 기존 이미지 정리 (재실행 시 누적 방지)
fs.readdirSync(IMAGES_DIR).forEach(f => fs.unlinkSync(path.join(IMAGES_DIR, f)));

// pdfimages -p (페이지 번호 prefix) -j (jpeg) 로 추출
//   결과 파일명: img-{page}-{idx}.jpg 형식 (page는 0-padded)
execSync(`pdfimages -p -j "${PDF_PATH}" "${IMAGES_DIR}/img"`, { stdio: 'inherit' });

const imageFiles = fs.readdirSync(IMAGES_DIR).sort();
console.log(`    추출된 이미지 ${imageFiles.length}개`);

// 파일명 패턴: img-{page}-{idx}.{ext} (pdfimages -p 옵션)
//   페이지·이미지 인덱스 매핑
const pageImages = {};   // { page: [filename, filename, ...] }
imageFiles.forEach(name => {
  // pdfimages -p 출력: img-XXX-NNN.jpg (XXX=페이지)
  const m = name.match(/^img-(\d+)-\d+\.(jpg|png|ppm|tif)$/);
  if (!m) return;
  const page = parseInt(m[1], 10);
  if (!pageImages[page]) pageImages[page] = [];
  pageImages[page].push(name);
});

// 문항·이미지 매핑 — 단순 규칙: "이 페이지의 첫 번째 이미지를 이 페이지의 첫 번째 문항에 매핑"
//   PDF 가 한 페이지 한 문항(그림 문항)으로 정리되어 있는지가 관건. 검수 단계에서 확인.
let mappedCount = 0;
Object.entries(pageImages).forEach(([pageStr, files]) => {
  const page = parseInt(pageStr, 10);
  const qNumsOnPage = pageToQuestionNumbers[page] || [];
  if (qNumsOnPage.length === 0 || files.length === 0) return;

  // 일단 페이지의 첫 문항에 첫 이미지(가장 큰 jpeg) 매핑
  // ppm (픽토그램) 같은 작은 장식 이미지는 제외
  const candidate = files.find(f => f.endsWith('.jpg') || f.endsWith('.png'));
  if (!candidate) return;

  const targetQ = questions.find(q => q.no === qNumsOnPage[0]);
  if (targetQ && !targetQ.image_file) {
    targetQ.image_file = candidate;
    mappedCount++;
  }
});

console.log(`    이미지·문항 매핑 ${mappedCount}건`);

// ─── 4) 통계 + 저장 ───
console.log('[4/4] 결과 저장...');
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(questions, null, 2), 'utf-8');

const stats = {
  total: questions.length,
  withImage: questions.filter(q => q.image_file).length,
  videos: questions.filter(q => q.is_video).length,
  withMultipleAnswers: questions.filter(q => q.answer_extra !== null).length,
  withFiveChoices: questions.filter(q => q.choices.length === 5).length,
  missingAnswer: questions.filter(q => q.answer === null).length,
  missingExplanation: questions.filter(q => !q.explanation).length,
  emptyChoices: questions.filter(q => q.choices.length < 4).length,
};

console.log('\n=== 추출 통계 ===');
Object.entries(stats).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log(`\n결과: ${OUTPUT_JSON}`);
