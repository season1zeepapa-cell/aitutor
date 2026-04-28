// pool-repatch-batch.js — 전체 HWP 파일 일괄 repatch
const { execSync } = require('child_process');

const files = [
  ['2020년정기제02회네트워크관리사2급필기.hwp', 137],
  ['2020년정기제03회네트워크관리사2급필기.hwp', 138],
  ['2020년정기제04회네트워크관리사2급필기.hwp', 139],
  ['2021년정기제01회네트워크관리사2급필기.hwp', 140],
  ['2021년정기제02회네트워크관리사2급필기.hwp', 141],
  ['2021년정기제03회네트워크관리사2급필기.hwp', 142],
  ['2021년정기제04회네트워크관리사2급필기.hwp', 143],
  ['2022년정기제01회네트워크관리사2급필기.hwp', 144],
  ['2022년정기제02회네트워크관리사2급필기.hwp', 145],
  ['2022년정기제03회네트워크관리사2급필기.hwp', 146],
  ['2022년정기제04회네트워크관리사2급필기.hwp', 147],
  ['2023년정기제01회네트워크관리사2급필기.hwp', 148],
  ['2023년정기제02회네트워크관리사2급필기.hwp', 149],
  ['2023년정기제03회네트워크관리사2급필기.hwp', 150],
  ['2023년정기제04회네트워크관리사2급필기.hwp', 151],
  ['2024년정기제01회네트워크관리사2급필기.hwp', 152],
  ['2024년정기제02회네트워크관리사2급필기.hwp', 153],
  ['2024년정기제03회네트워크관리사2급필기.hwp', 154],
  ['2024년정기제04회네트워크관리사2급필기.hwp', 155],
  ['2025년정기제01회네트워크관리사2급필기.hwp', 156],
  ['2025년정기제02회네트워크관리사2급필기.hwp', 157],
  ['2025년정기제03회네트워크관리사2급필기.hwp', 158],
  ['2025년정기제04회네트워크관리사2급필기.hwp', 159],
  ['2026년정기제01회네트워크관리사2급필기.hwp', 160],
];

async function main() {
  let totalUpdated = 0, totalSkipped = 0, totalFailed = 0;

  for (let i = 0; i < files.length; i++) {
    const [file, examId] = files[i];
    console.log(`\n[${i + 1}/${files.length}] ${file} → exam_id=${examId}`);
    try {
      const output = execSync(
        `node pool-repatch.js --exam-id=${examId} --file="${file}"`,
        { encoding: 'utf-8', timeout: 180000 }
      );
      const updateMatch = output.match(/업데이트: (\d+)개/);
      const skipMatch = output.match(/건너뜀: (\d+)개/);
      const u = updateMatch ? parseInt(updateMatch[1]) : 0;
      const s = skipMatch ? parseInt(skipMatch[1]) : 0;
      totalUpdated += u;
      totalSkipped += s;
      console.log(`   ✅ 업데이트 ${u}개, 건너뜀 ${s}개`);
    } catch (err) {
      console.error(`   ❌ 실패: ${err.message.substring(0, 150)}`);
      totalFailed++;
    }

    // API 속도 제한 방지
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('전체 배치 처리 완료');
  console.log(`  총 업데이트: ${totalUpdated}개`);
  console.log(`  총 건너뜀: ${totalSkipped}개`);
  console.log(`  실패: ${totalFailed}개`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
