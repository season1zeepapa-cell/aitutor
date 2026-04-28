// api/memo-files.js — 메모 첨부파일 메타데이터 CRUD
// 실제 파일은 S3에 저장하며, 본 API는 s3_key만 관리한다.
// 업로드: 클라이언트가 /api/upload-sign(action=upload)에서 presigned POST 획득 → S3 직접 업로드 → /api/memo-files(action=confirm)로 메타 저장
// 다운로드: /api/memo-files(action=download)로 파일 메타 조회 → /api/upload-sign(action=download&id=...)로 presigned GET 획득
const { query } = require('./db');
const { withCors } = require('./middleware');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const BUCKET = process.env.S3_FILES_BUCKET;

module.exports = withCors(async (req, res) => {
  const action = req.query?.action || req.body?.action;

  // ── 파일 목록 조회 (memo_id 기준) ──
  if (req.method === 'GET' && action === 'list') {
    const { memo_id } = req.query;
    if (!memo_id) return res.status(400).json({ error: 'memo_id가 필요합니다.' });

    const result = await query(
      `SELECT id, memo_id, filename, mime_type, size, s3_key, created_at
       FROM memo_files WHERE memo_id = $1 ORDER BY created_at`,
      [memo_id]
    );
    return res.json({ files: result.rows });
  }

  // ── 여러 메모의 파일 목록 일괄 조회 ──
  if (req.method === 'GET' && action === 'batch') {
    const { memo_ids } = req.query;
    if (!memo_ids) return res.json({ files: [] });

    const ids = memo_ids.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return res.json({ files: [] });

    const result = await query(
      `SELECT id, memo_id, filename, mime_type, size, s3_key, created_at
       FROM memo_files WHERE memo_id = ANY($1) ORDER BY created_at`,
      [ids]
    );
    return res.json({ files: result.rows });
  }

  // ── 파일 메타 조회 (클라이언트가 이 값으로 /api/upload-sign 호출) ──
  if (req.method === 'GET' && action === 'download') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: '파일 ID가 필요합니다.' });

    const result = await query(
      'SELECT filename, mime_type, s3_key FROM memo_files WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    return res.json(result.rows[0]);
  }

  // ── S3 업로드 완료 후 메타데이터 DB 저장 ──
  if (req.method === 'POST' && action === 'confirm') {
    const { memo_id, files } = req.body;
    if (!memo_id || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'memo_id와 files 배열이 필요합니다.' });
    }

    const saved = [];
    for (const f of files) {
      if (!f.s3_key || !f.filename || !f.mime_type || typeof f.size !== 'number') continue;
      const result = await query(
        `INSERT INTO memo_files (memo_id, filename, mime_type, s3_key, size)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, memo_id, filename, mime_type, s3_key, size, created_at`,
        [memo_id, f.filename, f.mime_type, f.s3_key, f.size]
      );
      saved.push(result.rows[0]);
    }

    return res.json({ files: saved, message: `${saved.length}개 파일이 등록되었습니다.` });
  }

  // ── 파일 삭제 (DB 메타 + S3 객체) ──
  if (req.method === 'POST' && action === 'delete') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: '파일 ID가 필요합니다.' });

    const result = await query(
      'DELETE FROM memo_files WHERE id = $1 RETURNING s3_key',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });

    // S3에서도 삭제 (실패해도 DB는 이미 삭제됨 — 고아 객체는 Lifecycle로 정리 가능)
    const s3Key = result.rows[0].s3_key;
    if (s3Key && BUCKET) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
      } catch (err) {
        console.warn('[memo-files] S3 삭제 실패(무시):', err.message);
      }
    }

    return res.json({ message: '파일이 삭제되었습니다.' });
  }

  res.status(400).json({ error: '알 수 없는 액션입니다.' });
});
