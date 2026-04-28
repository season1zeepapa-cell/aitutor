// PWA 아이콘 SVG → PNG 변환 스크립트 (일회성)
// 사용: node scripts/kisa-icon-gen.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_PATH = path.join(__dirname, '..', 'public', 'icons', 'icon.svg');
const OUTDIR = path.join(__dirname, '..', 'public', 'icons');

const svgBuffer = fs.readFileSync(SVG_PATH);

const TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // maskable (안전영역 확보 위해 패딩 포함) — 여기서는 same 크기 + 작은 방패
  { file: 'icon-maskable-512.png', size: 512 },
  // apple-touch-icon
  { file: 'apple-touch-icon.png', size: 180 },
  // favicon
  { file: 'favicon-32.png', size: 32 },
];

async function main() {
  console.log('🎨 아이콘 생성 시작...');
  for (const t of TARGETS) {
    const outPath = path.join(OUTDIR, t.file);
    await sharp(svgBuffer)
      .resize(t.size, t.size)
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(outPath);
    const stat = fs.statSync(outPath);
    console.log(`  ✅ ${t.file.padEnd(28)} ${t.size}x${t.size}  ${(stat.size / 1024).toFixed(1)}KB`);
  }
  console.log('\n🎊 아이콘 생성 완료');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
