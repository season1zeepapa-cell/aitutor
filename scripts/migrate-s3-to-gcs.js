// scripts/migrate-s3-to-gcs.js — REBUILD23 §17.4
//
// 기존 AWS S3 버킷의 객체를 GCS 버킷으로 일괄 복사.
// DB 의 memo_files.s3_key 컬럼은 그대로 유지 (key path 가 동일하므로 마이그 0).
//
// 사용 예 (기본값으로 충분하면 인자 없이 실행 가능):
//   node scripts/migrate-s3-to-gcs.js \
//     --src-bucket=aitutor-files-794531974010 \
//     --dest-bucket=aitutor-files-aifactory-494108 \
//     --concurrency=5
//
// 또는 더 간단하게 gsutil (boto 에 AWS credential 기록 후):
//   gsutil -m rsync -r s3://aitutor-files-794531974010 gs://aitutor-files-aifactory-494108
//
// 인증:
//   - AWS: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (S3 GetObject 권한)
//   - GCP: ADC (gcloud auth application-default login) 또는 SA key

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Storage } = require('@google-cloud/storage');

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function main() {
  const args = parseArgs();
  const SRC_BUCKET   = args['src-bucket']  || process.env.SRC_BUCKET  || 'aitutor-files-794531974010';
  const DEST_BUCKET  = args['dest-bucket'] || process.env.DEST_BUCKET || 'aitutor-files-aifactory-494108';
  const CONCURRENCY  = parseInt(args['concurrency'] || '5', 10);
  const AWS_REGION   = args['aws-region'] || process.env.AWS_REGION || 'ap-northeast-2';
  const DRY_RUN      = args['dry-run'] === 'true';

  console.log(`[migrate] src=s3://${SRC_BUCKET}  →  dest=gs://${DEST_BUCKET}`);
  console.log(`[migrate] concurrency=${CONCURRENCY}, dry_run=${DRY_RUN}`);

  const s3 = new S3Client({ region: AWS_REGION });
  const gcs = new Storage();
  const destBucket = gcs.bucket(DEST_BUCKET);

  let pageToken;
  let totalCount = 0;
  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const queue = [];

  // Worker pool — 동시에 N 개 객체 복사
  async function copyOne(s3Object) {
    const key = s3Object.Key;
    try {
      const destFile = destBucket.file(key);
      const [exists] = await destFile.exists();
      if (exists) {
        skipCount++;
        return;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${key} (${s3Object.Size} bytes)`);
        okCount++;
        return;
      }

      const obj = await s3.send(new GetObjectCommand({ Bucket: SRC_BUCKET, Key: key }));
      const buffer = await streamToBuffer(obj.Body);

      await destFile.save(buffer, {
        contentType: obj.ContentType || 'application/octet-stream',
        resumable: false,
      });

      okCount++;
      if (okCount % 10 === 0) {
        console.log(`  ✓ ${okCount} 개 복사됨 (skip ${skipCount}, fail ${failCount})`);
      }
    } catch (err) {
      console.error(`  ✗ ${key}: ${err.message}`);
      failCount++;
    }
  }

  // S3 의 객체를 페이지 단위로 나열하면서 worker pool 로 복사
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: SRC_BUCKET,
      ContinuationToken: pageToken,
      MaxKeys: 1000,
    }));

    const objects = list.Contents || [];
    totalCount += objects.length;

    // 동시 CONCURRENCY 만큼 처리
    for (let i = 0; i < objects.length; i += CONCURRENCY) {
      const batch = objects.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(copyOne));
    }

    pageToken = list.IsTruncated ? list.NextContinuationToken : null;
  } while (pageToken);

  console.log('');
  console.log('=== 마이그레이션 완료 ===');
  console.log(`  총 객체     : ${totalCount}`);
  console.log(`  복사 성공   : ${okCount}`);
  console.log(`  이미 존재   : ${skipCount}`);
  console.log(`  실패        : ${failCount}`);

  if (failCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('[migrate] 치명적 오류:', err);
  process.exit(1);
});
