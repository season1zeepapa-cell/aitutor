// Vercel 서버리스 함수 - docstore 기출문제 임포트 API
// docstore의 exam_questions → error의 questions 테이블로 이동
const { query } = require('./db');
const { verifyToken, extractToken } = require('./auth');

// 원형 숫자 매핑
const CIRCLE_NUMS = ['①', '②', '③', '④', '⑤'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 관리자 인증 필수
  const token = extractToken(req);
  const payload = verifyToken(token);
  if (!payload || !payload.admin) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }

  try {
    // ── GET: 시험 목록 / 문제 미리보기 ──
    if (req.method === 'GET') {
      const { examId } = req.query || {};

      if (examId) {
        // 특정 docstore 시험의 문제 목록
        const result = await query(
          `SELECT id, question_number, body, choices, answer, explanation
           FROM exam_questions WHERE exam_id = $1
           ORDER BY question_number`,
          [examId]
        );
        return res.json({ questions: result.rows });
      }

      // docstore exams 목록 (문제 수 포함)
      const result = await query(
        `SELECT e.id, e.title, e.year, e.round, e.subject,
                COUNT(eq.id)::int AS question_count
         FROM exams e
         LEFT JOIN exam_questions eq ON eq.exam_id = e.id
         GROUP BY e.id
         ORDER BY e.created_at DESC`
      );
      return res.json({ exams: result.rows });
    }

    // ── POST: 임포트 / 해설 생성 / 상태 조회 ──
    if (req.method === 'POST') {
      const { action } = req.body || {};

      // ── 임포트: docstore → error ──
      if (action === 'import') {
        const { sourceExamId, targetExamId, questionIds } = req.body;
        if (!sourceExamId || !targetExamId) {
          return res.status(400).json({ error: 'sourceExamId, targetExamId 필수' });
        }

        // 현재 최대 question_number
        const maxResult = await query(
          'SELECT COALESCE(MAX(question_number), 0) AS max_num FROM questions'
        );
        let nextNum = maxResult.rows[0].max_num + 1;

        // docstore 문제 조회
        let whereClause = 'WHERE eq.exam_id = $1';
        const params = [sourceExamId];
        if (questionIds && questionIds.length > 0) {
          whereClause += ' AND eq.id = ANY($2)';
          params.push(questionIds);
        }

        const sourceQuestions = await query(
          `SELECT eq.id, eq.question_number, eq.body, eq.choices, eq.answer, eq.explanation
           FROM exam_questions eq ${whereClause}
           ORDER BY eq.question_number`,
          params
        );

        let imported = 0;
        const importedIds = [];

        for (const sq of sourceQuestions.rows) {
          // choices 변환: ["보기1","보기2",...] → [{"num":1,"text":"① 보기1"},...]
          let choices = sq.choices || [];
          if (typeof choices === 'string') choices = JSON.parse(choices);

          const convertedChoices = choices.map((text, i) => ({
            num: i + 1,
            text: `${CIRCLE_NUMS[i] || (i + 1)} ${text}`
          }));

          const insertResult = await query(
            `INSERT INTO questions (exam_id, question_number, original_number, body, choices, answer, explanation)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
              targetExamId,
              nextNum,
              String(sq.question_number),
              sq.body,
              JSON.stringify(convertedChoices),
              sq.answer || 0,
              sq.explanation || null
            ]
          );

          importedIds.push({
            sourceId: sq.id,
            newId: insertResult.rows[0].id,
            questionNumber: nextNum
          });
          nextNum++;
          imported++;
        }

        console.log(`[Import] ${imported}개 문제 임포트 완료 (exam ${sourceExamId} → ${targetExamId})`);
        return res.json({ success: true, imported, importedIds });
      }

      // ── 해설 생성: 다중 LLM 지원 ──
      if (action === 'generate-explanation') {
        const { questionId, provider = 'gemini', model: requestedModel } = req.body;
        if (!questionId) return res.status(400).json({ error: 'questionId 필수' });

        // 문제 조회
        const qResult = await query(
          'SELECT id, body, choices, answer FROM questions WHERE id = $1',
          [questionId]
        );
        if (qResult.rows.length === 0) {
          return res.status(404).json({ error: '문제를 찾을 수 없습니다.' });
        }

        const q = qResult.rows[0];
        let choices = q.choices;
        if (typeof choices === 'string') choices = JSON.parse(choices);

        const choicesText = choices.map(c =>
          typeof c === 'object' ? `${c.num}. ${c.text}` : c
        ).join('\n');

        const prompt = `자격증 시험 문제의 해설을 작성해주세요.

문제: ${q.body}
선택지:
${choicesText}
정답: ${q.answer}번

다음 HTML 형식으로 해설을 작성해주세요:

<div class="exp-result"></div>
<div class="exp-body">
    <p class="exp-answer">정답: <strong>정답번호 선택지내용</strong></p>
    <div class="exp-section">
        <div class="exp-section-title">해설</div>
        <p>상세한 해설 내용</p>
    </div>
    <div class="exp-section">
        <div class="exp-section-title">오답 분석</div>
        <ul class="exp-list">
            <li><strong>번호 (O/X)</strong> - 설명</li>
        </ul>
    </div>
    <div class="exp-tip"><strong>핵심 암기</strong>: 핵심 키워드</div>
</div>

주의: HTML만 출력하세요. 마크다운이나 \`\`\` 블록 없이 순수 HTML만 반환하세요.`;

        let explanation;

        if (provider === 'openai') {
          // OpenAI API 호출
          const OpenAI = require('openai');
          const openai = new OpenAI({ apiKey: (process.env.OPENAI_API_KEY || '').trim() });
          const selectedModel = requestedModel || 'gpt-4o-mini';
          const completion = await openai.chat.completions.create({
            model: selectedModel,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
          });
          explanation = completion.choices[0]?.message?.content || '';

        } else if (provider === 'claude') {
          // Claude API 호출 (HTTPS 직접)
          const https = require('https');
          const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
          if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 미설정' });
          const selectedModel = requestedModel || 'claude-sonnet-4-20250514';
          const body = JSON.stringify({
            model: selectedModel,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          });
          const apiRes = await new Promise((resolve, reject) => {
            const req2 = https.request('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
              timeout: 60000,
            }, (res2) => {
              const chunks = [];
              res2.on('data', c => chunks.push(c));
              res2.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf8');
                try {
                  const parsed = JSON.parse(data);
                  if (res2.statusCode !== 200) reject(new Error(parsed.error?.message || `Claude ${res2.statusCode}`));
                  else resolve(parsed);
                } catch { reject(new Error('Claude 응답 파싱 실패')); }
              });
            });
            req2.on('error', reject);
            req2.on('timeout', () => { req2.destroy(); reject(new Error('Claude 타임아웃')); });
            req2.write(body);
            req2.end();
          });
          explanation = apiRes.content?.[0]?.text || '';

        } else {
          // Gemini API 호출 (기본)
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const selectedModel = requestedModel || 'gemini-2.5-flash';
          const genModel = genAI.getGenerativeModel({ model: selectedModel });
          const result = await genModel.generateContent([{ text: prompt }]);
          explanation = result.response.text();
        }

        // ```html ... ``` 블록 제거
        const htmlMatch = explanation.match(/```html\s*([\s\S]*?)```/);
        if (htmlMatch) explanation = htmlMatch[1];
        explanation = explanation.trim();

        // questions 테이블에 해설 저장
        await query(
          'UPDATE questions SET explanation = $1, updated_at = NOW() WHERE id = $2',
          [explanation, questionId]
        );

        console.log(`[Import] 해설 생성 완료: question #${questionId} (${provider}/${requestedModel})`);
        return res.json({ success: true, questionId, explanation, provider, model: requestedModel });
      }

      // ── 상태 조회: 임포트된 문제들의 해설 유무 확인 ──
      if (action === 'status') {
        const { targetExamId } = req.body;
        if (!targetExamId) return res.status(400).json({ error: 'targetExamId 필수' });

        const result = await query(
          `SELECT id, question_number, original_number, body, answer,
                  (explanation IS NOT NULL AND explanation != '') AS has_explanation
           FROM questions WHERE exam_id = $1
           ORDER BY question_number`,
          [targetExamId]
        );
        return res.json({ questions: result.rows });
      }

      // ── 소스 문제 삭제 (docstore exam_questions에서 삭제) ──
      if (action === 'delete-questions') {
        const { questionIds } = req.body;
        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
          return res.status(400).json({ error: 'questionIds 배열 필수' });
        }
        // 삭제 전 해당 문제들의 exam_id 조회
        const examCheck = await query(
          'SELECT DISTINCT exam_id FROM exam_questions WHERE id = ANY($1)',
          [questionIds]
        );
        const affectedExamIds = examCheck.rows.map(r => r.exam_id);

        const result = await query(
          'DELETE FROM exam_questions WHERE id = ANY($1) RETURNING id',
          [questionIds]
        );
        console.log(`[Import] 소스 문제 ${result.rowCount}개 삭제`);

        // 문제가 0개인 시험 그룹 자동 삭제
        let deletedExams = [];
        if (affectedExamIds.length > 0) {
          const emptyExams = await query(
            `SELECT e.id FROM exams e
             WHERE e.id = ANY($1)
             AND NOT EXISTS (SELECT 1 FROM exam_questions eq WHERE eq.exam_id = e.id)`,
            [affectedExamIds]
          );
          if (emptyExams.rows.length > 0) {
            const emptyIds = emptyExams.rows.map(r => r.id);
            await query('DELETE FROM exams WHERE id = ANY($1)', [emptyIds]);
            deletedExams = emptyIds;
            console.log(`[Import] 빈 시험 그룹 ${emptyIds.length}개 삭제:`, emptyIds);
          }
        }

        return res.json({ success: true, deleted: result.rowCount, deletedExams });
      }

      return res.status(400).json({ error: '알 수 없는 action' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[ImportDocstore] 에러:', err);
    res.status(500).json({ error: '서버 오류', detail: err.message });
  }
};
