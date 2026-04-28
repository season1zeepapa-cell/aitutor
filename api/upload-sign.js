// api/upload-sign.js — S3 presigned URL 발급 (업로드 POST / 다운로드 GET)
// Lambda Function URL의 6MB 요청 페이로드 제한을 우회하기 위해
// 클라이언트가 S3에 직접 업로드/다운로드하도록 서명 URL을 발급한다.
const crypto = require('crypto');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { query } = require('./db');
const { withAuth } = require('./middleware');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const BUCKET = process.env.S3_FILES_BUCKET;

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
  if (!BUCKET) return res.status(500).json({ error: 'S3 버킷이 설정되지 않았습니다.' });

  const { action, purpose, filename, mime_type, size, s3_key, id } = req.body || {};

  // ── 업로드 URL 발급 ──
  if (action === 'upload') {
    if (!purpose || !filename || !mime_type || typeof size !== 'number') {
      return res.status(400).json({ error: 'purpose, filename, mime_type, size 필수' });
    }

    // pool은 관리자 전용
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

    const presigned = await createPresignedPost(s3, {
      Bucket: BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 0, MAX_SIZE],
        ['eq', '$Content-Type', mime_type],
      ],
      Fields: { 'Content-Type': mime_type },
      Expires: 300,
    });

    return res.json({ key, ...presigned });
  }

  // ── 다운로드 URL 발급 ──
  if (action === 'download') {
    // id로 조회 시 DB에서 소유권 검증 후 s3_key 획득
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

    const url = await getSignedUrl(s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: targetKey }),
      { expiresIn: 60 });
    return res.json({ url, key: targetKey });
  }

  return res.status(400).json({ error: 'action은 upload 또는 download' });
});
