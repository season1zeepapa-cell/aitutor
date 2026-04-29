// api/memo-files.js — 메모 첨부파일 메타데이터 CRUD (REBUILD23: S3 → GCS)
//
// 실제 파일은 GCS 버킷에 저장하며, 본 API 는 object key (DB 컬럼명은 s3_key 그대로 유지) 만 관리한다.
// 업로드: 클라이언트가 /api/upload-sign(action=upload) 에서 V4 signed PUT URL 획득 → GCS 직접 업로드 → /api/memo-files(action=confirm) 로 메타 저장
// 다운로드: /api/memo-files(action=download) 로 메타 조회 → /api/upload-sign(action=download&id=...) 로 V4 signed GET 획득
//
// 인증: Cloud Run service account ADC (env 키 불필요)
const { query } = require('./db');
const { withCors } = require('./middleware');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_FILES_BUCKET;
const bucket = BUCKET_NAME ? storage.bucket(BUCKET_NAME) : null;

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

  // ── GCS 업로드 완료 후 메타데이터 DB 저장 ──
  if (req.method === 'POST' && action === 'confirm') {
    const { memo_id, files } = req.body;
    if (!memo_id || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'memo_id와 files 배열이 필요합니다.' });
    }

    const saved = [];
    for (const f of files) {
      // 클라이언트가 보내는 키 이름은 s3_key 그대로 유지 (호환성)
      const objectKey = f.s3_key || f.gcs_key;
      if (!objectKey || !f.filename || !f.mime_type || typeof f.size !== 'number') continue;
      const result = await query(
        `INSERT INTO memo_files (memo_id, filename, mime_type, s3_key, size)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, memo_id, filename, mime_type, s3_key, size, created_at`,
        [memo_id, f.filename, f.mime_type, objectKey, f.size]
      );
      saved.push(result.rows[0]);
    }

    return res.json({ files: saved, message: `${saved.length}개 파일이 등록되었습니다.` });
  }

  // ── 파일 삭제 (DB 메타 + GCS 객체) ──
  if (req.method === 'POST' && action === 'delete') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: '파일 ID가 필요합니다.' });

    const result = await query(
      'DELETE FROM memo_files WHERE id = $1 RETURNING s3_key',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });

    // GCS 에서도 삭제 (실패해도 DB 는 이미 삭제됨 — 고아 객체는 Lifecycle 로 정리 가능)
    const objectKey = result.rows[0].s3_key;
    if (objectKey && bucket) {
      try {
        await bucket.file(objectKey).delete({ ignoreNotFound: true });
      } catch (err) {
        console.warn('[memo-files] GCS 삭제 실패(무시):', err.message);
      }
    }

    return res.json({ message: '파일이 삭제되었습니다.' });
  }

  res.status(400).json({ error: '알 수 없는 액션입니다.' });
});
