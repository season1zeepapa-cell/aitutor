// api/pool-upload.js — 웹에서 소량 문제 파일 업로드 → Gemini Vision 추출 → DB 등록  [REBUILD23 §17: S3 → GCS]
// 방안 3: 웹 UI에서 PDF/이미지 파일을 업로드하여 문제를 추출·등록
// 기존 API에 영향 없이 독립 동작
const { query } = require('./db');
const { withAdmin } = require('./middleware');
const gemini = require('./_llm/gemini');
const { Storage } = require('@google-cloud/storage');

// 인증: Cloud Run service account ADC (env 키 불필요)
const storage = new Storage();
const BUCKET_NAME = process.env.GCS_FILES_BUCKET;
const bucket = BUCKET_NAME ? storage.bucket(BUCKET_NAME) : null;

module.exports = withAdmin(async (req, res) => {
  const { action } = req.body || req.query || {};

  // ── action: extract — GCS 에 업로드된 파일에서 문제 추출 (미리보기) ──
  if (action === 'extract') {
    const { s3_key, file_name } = req.body;
    if (!s3_key) return res.status(400).json({ error: 's3_key가 필요합니다.' });
    if (!bucket) return res.status(500).json({ error: 'GCS 버킷이 설정되지 않았습니다.' });

    // 경로 접두사로 간단 검증 (upload-sign 이 생성한 경로만 허용)
    if (!s3_key.startsWith('uploads/pool/')) {
      return res.status(400).json({ error: '유효하지 않은 s3_key' });
    }

    try {
      const file = bucket.file(s3_key);
      const [meta] = await file.getMetadata();
      const [buffer] = await file.download();
      const mime_type = meta.contentType || 'application/octet-stream';

      const ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif'];
      if (!ALLOWED_MIMES.includes(mime_type)) {
        return res.status(400).json({
          error: `지원하지 않는 파일 형식입니다. (지원: PDF, PNG, JPG) — 수신: ${mime_type}`,
        });
      }
      if (buffer.length > 20 * 1024 * 1024) {
        return res.status(400).json({ error: '파일 크기가 20MB를 초과합니다.' });
      }

      const file_data = buffer.toString('base64');
      const questions = await extractQuestionsVision(file_data, mime_type, file_name || s3_key);
      return res.json({
        success: true,
        s3_key,
        file_name: file_name || s3_key.split('/').pop(),
        questions,
        visual_count: questions.filter(q => q.has_table || q.has_image).length,
      });
    } catch (err) {
      console.error('[pool-upload] extract 오류:', err.message);
      return res.status(500).json({ error: '문제 추출에 실패했습니다: ' + err.message });
    }
  }

  // ── action: register — 추출된 문제를 DB에 등록 ──
  if (action === 'register') {
    const { exam_id, exam_title, category_id, questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: '등록할 문제가 없습니다.' });
    }

    try {
      // 시험 ID 확보 (기존 또는 신규 생성)
      let examId = exam_id;
      if (!examId && exam_title && category_id) {
        const existing = await query(
          'SELECT id FROM exams WHERE title = $1 AND category_id = $2',
          [exam_title, parseInt(category_id)]
        );
        if (existing.rows.length > 0) {
          examId = existing.rows[0].id;
        } else {
          const maxSort = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM exams');
          const result = await query(
            'INSERT INTO exams (title, category_id, sort_order) VALUES ($1, $2, $3) RETURNING id',
            [exam_title, parseInt(category_id), maxSort.rows[0].next]
          );
          examId = result.rows[0].id;
        }
      }

      if (!examId) {
        return res.status(400).json({ error: 'exam_id 또는 (exam_title + category_id)가 필요합니다.' });
      }

      // 다음 문제 번호 조회
      const lastQ = await query(
        'SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE exam_id = $1',
        [examId]
      );
      let nextNum = lastQ.rows[0].max_num + 1;

      let inserted = 0, skipped = 0;

      for (const q of questions) {
        // 중복 체크
        const dup = await query(
          'SELECT id FROM questions WHERE exam_id = $1 AND original_number = $2',
          [examId, String(q.original_number)]
        );
        if (dup.rows.length > 0) { skipped++; continue; }

        // 표 내용을 body에 추가
        let bodyText = q.body || '';
        if (q.has_table && q.table_description && !bodyText.includes(q.table_description.substring(0, 20))) {
          bodyText += '\n\n[표]\n' + q.table_description;
        }

        await query(
          `INSERT INTO questions (exam_id, question_number, original_number, body, choices, answer)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [examId, nextNum, String(q.original_number), bodyText,
           JSON.stringify(q.choices), String(q.answer || 0)]
        );
        nextNum++;
        inserted++;
      }

      return res.json({
        success: true,
        exam_id: examId,
        inserted,
        skipped,
        total: questions.length,
      });
    } catch (err) {
      console.error('[pool-upload] register 오류:', err.message);
      return res.status(500).json({ error: '문제 등록에 실패했습니다: ' + err.message });
    }
  }

  return res.status(400).json({ error: '지원하지 않는 action입니다. (extract | register)' });
});

// ── Gemini Vision으로 문제 추출 ──
async function extractQuestionsVision(base64Data, mimeType, fileName) {
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
    "choices": [
      {"num": 1, "text": "1번 선택지"},
      {"num": 2, "text": "2번 선택지"},
      {"num": 3, "text": "3번 선택지"},
      {"num": 4, "text": "4번 선택지"}
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

  // 헬퍼는 OpenAI 형식 messages 를 받아 내부에서 Gemini contents/inlineData 로 변환
  const { text: responseText } = await gemini.chat({
    model: 'gemini-2.5-flash',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
      ],
    }],
    maxTokens: 8192,  // 다수 문항 추출 대응
    timeout: 90000,
  });
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) {
    throw new Error('JSON 추출 실패 — AI 응답 형식 오류');
  }

  const questions = JSON.parse(jsonMatch[1]);
  if (!Array.isArray(questions)) {
    throw new Error('파싱 결과가 배열이 아닙니다');
  }

  return questions;
}
