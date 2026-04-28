// KISA 학습 자료 API — 이론 학습 모드
//
//   GET /api/kisa-study?action=list
//        → 69개 챕터 목록 (stage/category별 그룹화 가능)
//        응답: { design: [{chapter_code, title, category, question_count}], implementation: [...] }
//
//   GET /api/kisa-study?action=detail&code=IMP-IV-01
//        → 특정 챕터 상세 + 관련 문항 코드 예시들
//        응답: {
//          chapter: {chapter_code, title, definition, cause, impact, countermeasures, reference_docs},
//          code_examples: [
//            { question_id, language, difficulty, vulnerable_code, safe_code,
//              rationale, fix_description, rationale_keywords, fix_keywords }
//          ]
//        }
const { query } = require('./db');
const { withAuth } = require('./middleware');

module.exports = withAuth(async (req, res) => {
  const action = req.query?.action;

  // --------------------------------------------------------------------
  // GET ?action=list — 전체 챕터 목록
  // --------------------------------------------------------------------
  if (req.method === 'GET' && action === 'list') {
    const result = await query(`
      SELECT
        c.chapter_code, c.stage, c.category, c.title, c.definition,
        (SELECT count(*) FROM kisa_questions q
          WHERE q.chapter_code = c.chapter_code AND q.is_active = TRUE)::int AS question_count,
        (SELECT count(DISTINCT q.language) FROM kisa_questions q
          WHERE q.chapter_code = c.chapter_code AND q.is_active = TRUE)::int AS language_count
      FROM kisa_chapters c
      WHERE c.is_active = TRUE
      ORDER BY c.stage DESC, c.category, c.chapter_code
    `);

    // stage 별로 그룹핑 후 반환
    const design = result.rows.filter(r => r.stage === 'design');
    const implementation = result.rows.filter(r => r.stage === 'implementation');

    return res.json({
      design, implementation,
      total: result.rows.length,
    });
  }

  // --------------------------------------------------------------------
  // GET ?action=detail&code=XXX — 특정 챕터 상세
  // --------------------------------------------------------------------
  if (req.method === 'GET' && action === 'detail') {
    const code = req.query?.code;
    if (!code) return res.status(400).json({ error: 'code 파라미터가 필요합니다.' });

    // 1) 챕터 메타
    const chapterRes = await query(
      `SELECT * FROM kisa_chapters WHERE chapter_code = $1 AND is_active = TRUE`,
      [code]
    );
    if (chapterRes.rows.length === 0) {
      return res.status(404).json({ error: '해당 챕터를 찾을 수 없습니다.' });
    }
    const chapter = chapterRes.rows[0];

    // 1-1) 연관 챕터 양방향 조회
    // 설계 → 구현: chapter.related_chapters 에 저장된 코드들
    // 구현 → 설계: 이 코드를 related_chapters 배열에 포함하는 설계 챕터
    const relatedForwardRes = (chapter.related_chapters || []).length > 0
      ? await query(
          `SELECT chapter_code, stage, category, title FROM kisa_chapters
           WHERE chapter_code = ANY($1::text[]) AND is_active = TRUE
           ORDER BY chapter_code`,
          [chapter.related_chapters]
        )
      : { rows: [] };

    const relatedReverseRes = await query(
      `SELECT chapter_code, stage, category, title FROM kisa_chapters
       WHERE $1 = ANY(related_chapters) AND is_active = TRUE
       ORDER BY chapter_code`,
      [chapter.chapter_code]
    );

    // 2) 관련 diagnosis4 문항에서 코드 예시 수집 (학습 자료 용)
    const examplesRes = await query(`
      SELECT
        id AS question_id,
        language, difficulty,
        vulnerable_code, safe_code, vulnerable_lines,
        rationale_keywords, fix_keywords,
        model_answer
      FROM kisa_questions
      WHERE chapter_code = $1 AND question_type = 'diagnosis4' AND is_active = TRUE
      ORDER BY difficulty, language
    `, [code]);

    // MCQ 문항 카운트 (드릴 시작 버튼 표시용)
    const mcqCountRes = await query(`
      SELECT count(*)::int AS cnt
      FROM kisa_questions
      WHERE chapter_code = $1 AND question_type = 'mcq' AND is_active = TRUE
    `, [code]);

    // 단답형(blank) 문항 카운트
    const blankCountRes = await query(`
      SELECT count(*)::int AS cnt
      FROM kisa_questions
      WHERE chapter_code = $1 AND question_type = 'blank' AND is_active = TRUE
    `, [code]);

    return res.json({
      chapter: {
        chapter_code: chapter.chapter_code,
        stage: chapter.stage,
        category: chapter.category,
        title: chapter.title,
        definition: chapter.definition,
        cause: chapter.cause,
        impact: chapter.impact,
        countermeasures: chapter.countermeasures || [],
        reference_docs: chapter.reference_docs || [],
        tags: chapter.tags || [],
      },
      code_examples: examplesRes.rows.map(r => ({
        question_id: r.question_id,
        language: r.language,
        difficulty: r.difficulty,
        vulnerable_code: r.vulnerable_code,
        safe_code: r.safe_code,
        vulnerable_lines: r.vulnerable_lines,
        rationale: r.model_answer?.rationale || '',
        fix_description: r.model_answer?.fix_description || '',
        rationale_keywords: r.rationale_keywords || [],
        fix_keywords: r.fix_keywords || [],
      })),
      // 연관 챕터 (설계↔구현 매핑)
      related_forward: relatedForwardRes.rows,   // 이 챕터가 직접 가리키는 챕터 (설계→구현)
      related_reverse: relatedReverseRes.rows,   // 이 챕터를 가리키는 챕터 (구현→설계)
      mcq_count: mcqCountRes.rows[0]?.cnt || 0,
      blank_count: blankCountRes.rows[0]?.cnt || 0,
      diagnosis_count: examplesRes.rows.length,
    });
  }

  return res.status(400).json({ error: `지원하지 않는 요청: ${req.method} ?action=${action}` });
});
