// 네트워크관리사2급 기출문제 25개 파일 DB 등록 스크립트
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('./api/db');

const CATEGORY_ID = 3; // 네트워크관리사2급
const POOL_DIR = path.join(__dirname, 'pool');

// 파일명에서 년도, 회차 추출
function parseFileName(filename) {
  const match = filename.match(/(\d{4})년정기제(\d{2})회/);
  if (!match) return null;
  return {
    year: parseInt(match[1]),
    round: parseInt(match[2]),
    title: `${match[1]}년 정기 ${parseInt(match[2])}회`
  };
}

// 문제 파싱
function parseQuestions(text) {
  const questions = [];
  // 문제 시작 패턴으로 split
  const parts = text.split(/(?=^\s*\d{1,2}\.\s)/m).filter(p => /^\s*\d{1,2}\.\s/.test(p));

  for (const part of parts) {
    const numMatch = part.match(/^\s*(\d{1,2})\.\s/);
    if (!numMatch) continue;
    const num = parseInt(numMatch[1]);

    // 선택지 분리: ① ② ③ ④ ⑤ 기준
    const choicePattern = /[①②③④⑤]/;
    const firstChoiceIdx = part.search(choicePattern);
    if (firstChoiceIdx === -1) {
      console.error(`  [에러] 문제 ${num}: 선택지를 찾을 수 없음`);
      // 선택지 없이라도 등록
      questions.push({
        original_number: num,
        body: part.substring(numMatch[0].length).trim(),
        choices: []
      });
      continue;
    }

    const body = part.substring(numMatch[0].length, firstChoiceIdx).trim();
    const choicePart = part.substring(firstChoiceIdx);

    // 선택지 추출
    const choiceMatches = choicePart.split(/(?=[①②③④⑤])/).filter(Boolean);
    const choices = choiceMatches.map((c, i) => ({
      num: i + 1,
      text: c.replace(/^[①②③④⑤]\s*/, '').trim()
    }));

    questions.push({ original_number: num, body, choices });
  }
  return questions;
}

async function main() {
  try {
    console.log('=== 사전 작업: category_id=3 기존 데이터 전체 삭제 ===');

    // 기존 데이터 삭제 (순서 중요: FK 의존 순서)
    let res;
    res = await query('DELETE FROM question_explanations WHERE question_id IN (SELECT id FROM questions WHERE exam_id IN (SELECT id FROM exams WHERE category_id = 3))');
    console.log(`  question_explanations 삭제: ${res.rowCount}건`);

    res = await query('DELETE FROM question_bookmarks WHERE question_id IN (SELECT id FROM questions WHERE exam_id IN (SELECT id FROM exams WHERE category_id = 3))');
    console.log(`  question_bookmarks 삭제: ${res.rowCount}건`);

    res = await query('DELETE FROM question_memos WHERE question_id IN (SELECT id FROM questions WHERE exam_id IN (SELECT id FROM exams WHERE category_id = 3))');
    console.log(`  question_memos 삭제: ${res.rowCount}건`);

    res = await query('DELETE FROM questions WHERE exam_id IN (SELECT id FROM exams WHERE category_id = 3)');
    console.log(`  questions 삭제: ${res.rowCount}건`);

    res = await query('DELETE FROM exams WHERE category_id = 3');
    console.log(`  exams 삭제: ${res.rowCount}건`);

    console.log('');

    // pool 폴더에서 .txt 파일 목록 (정렬)
    const files = fs.readdirSync(POOL_DIR)
      .filter(f => f.endsWith('네트워크관리사2급필기.txt'))
      .sort();

    console.log(`=== ${files.length}개 파일 처리 시작 ===\n`);

    let totalQuestions = 0;

    for (const file of files) {
      const info = parseFileName(file);
      if (!info) {
        console.error(`[에러] 파일명 파싱 실패: ${file}`);
        continue;
      }

      // 시험 생성
      const examRes = await query(
        'INSERT INTO exams (category_id, title, year, round) VALUES ($1, $2, $3, $4) RETURNING id',
        [CATEGORY_ID, info.title, info.year, info.round]
      );
      const examId = examRes.rows[0].id;
      console.log(`[시험 생성] ${info.title} (exam_id=${examId})`);

      // 파일 읽기 & 파싱
      const text = fs.readFileSync(path.join(POOL_DIR, file), 'utf-8');
      const questions = parseQuestions(text);

      if (questions.length < 50) {
        console.warn(`  ⚠ 경고: ${questions.length}문제만 파싱됨 (기대: 50문제)`);
      }

      // DB 등록
      let inserted = 0;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        try {
          await query(
            'INSERT INTO questions (exam_id, question_number, original_number, body, choices, answer, explanation) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [
              examId,
              i + 1,
              String(q.original_number),
              q.body,
              JSON.stringify(q.choices),
              '0',
              null
            ]
          );
          inserted++;
        } catch (err) {
          console.error(`  [에러] 문제 ${q.original_number} 등록 실패: ${err.message}`);
        }
      }

      console.log(`  → ${inserted}문제 등록 완료`);
      totalQuestions += inserted;
    }

    console.log(`\n=== 완료: 총 ${totalQuestions}문제 등록 ===`);
  } catch (err) {
    console.error('치명적 에러:', err);
  } finally {
    // 커넥션 풀 종료
    const { getPool } = require('./api/db');
    await getPool().end();
  }
}

main();
