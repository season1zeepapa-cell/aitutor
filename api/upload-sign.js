// api/upload-sign.js — GCS V4 signed URL 발급 (업로드 PUT / 다운로드 GET)  [REBUILD23 §17]
//
// Cloud Run 의 6MB request payload 한도를 우회하기 위해 클라이언트가 GCS 에 직접 PUT 한다.
//
// 변경 (vs S3 시절):
//   - presigned POST (multipart) → V4 signed PUT (단일 PUT 으로 단순화)
//   - 클라이언트는 fetch(url, { method: 'PUT', body: file, headers: {Content-Type} }) 한 번
//   - 다운로드는 동일 (V4 signed GET)
//
// 인증: Cloud Run service account ADC (env 키 불필요)
const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const { query } = require('./db');
const { withAuth } = require('./middleware');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_FILES_BUCKET;
const bucket = BUCKET_NAME ? storage.bucket(BUCKET_NAME) : null;

// MIME 화이트리스트 (신뢰 가능한 유형만 업로드 허용)
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });
  if (!bucket) return res.status(500).json({ error: 'GCS 버킷이 설정되지 않았습니다.' });

  const { action, purpose, filename, mime_type, size, s3_key, id } = req.body || {};

  // ── 업로드 URL 발급 (V4 signed PUT) ──
  if (action === 'upload') {
    if (!purpose || !filename || !mime_type || typeof size !== 'number') {
      return res.status(400).json({ error: 'purpose, filename, mime_type, size 필수' });
    }

    // pool 은 관리자 전용
    if (purpose === 'pool' && !req.user.admin) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    if (!['memo', 'pool'].includes(purpose)) {
      return res.status(400).json({ error: 'purpose는 memo 또는 pool' });
    }

    // 용도별 크기 제한 (memo 5MB, pool 20MB)
    const MAX_SIZE = purpose === 'pool' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (size <= 0 || size > MAX_SIZE) {
      return res.status(400).json({ error: `파일 크기는 ${MAX_SIZE / 1024 / 1024}MB 이하` });
    }

    if (!ALLOWED_MIMES.has(mime_type)) {
      return res.status(400).json({ error: '허용되지 않는 파일 형식입니다.' });
    }

    // 경로 traversal 방지를 위해 확장자만 추출
    const rawExt = String(filename).split('.').pop() || 'bin';
    const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const uuid = crypto.randomUUID();
    const prefix = purpose === 'memo' ? `memos/${req.user.uid}` : `uploads/pool/${req.user.uid}`;
    const key = `${prefix}/${uuid}.${ext}`;

    // V4 signed URL (PUT) — 클라이언트는 한 번의 fetch(PUT) 로 업로드
    const [url] = await bucket.file(key).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 5 * 60 * 1000,   // 5분
      contentType: mime_type,
      extensionHeaders: {
        'x-goog-content-length-range': `0,${MAX_SIZE}`,  // 크기 강제
      },
    });

    // 클라이언트가 사용할 PUT 요청 명세 — { url, method, headers }
    return res.json({
      key,
      url,
      method: 'PUT',
      headers: {
        'Content-Type': mime_type,
        'x-goog-content-length-range': `0,${MAX_SIZE}`,
      },
    });
  }

  // ── 다운로드 URL 발급 (V4 signed GET) ──
  if (action === 'download') {
    // id 로 조회 시 DB 에서 소유권 검증 후 object key 획득
    let targetKey = s3_key;
    if (!targetKey && id) {
      const row = await query('SELECT memo_id, s3_key FROM memo_files WHERE id = $1', [id]);
      if (row.rows.length === 0) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
      targetKey = row.rows[0].s3_key;
    }
    if (!targetKey) return res.status(400).json({ error: 's3_key 또는 id 필요' });

    // 경로 접두사 기반 간단 권한 체크 (관리자는 모두 허용)
    const ownedByUser = targetKey.startsWith(`memos/${req.user.uid}/`)
      || targetKey.startsWith(`uploads/pool/${req.user.uid}/`);
    if (!ownedByUser && !req.user.admin) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const [url] = await bucket.file(targetKey).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 1000,   // 1분
    });
    return res.json({ url, key: targetKey });
  }

  return res.status(400).json({ error: 'action은 upload 또는 download' });
});
