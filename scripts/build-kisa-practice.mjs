// KISA 설계기준 실습 번들 생성
// kisa-module/library-kisec2026/practice/*.md → src/data/kisa-practice.json
//
// 왜 필요한가: Dockerfile frontend-builder 는 src/·public/ 만 COPY 한다.
// kisa-module/ 은 빌드 컨텍스트에 없으므로, 앱이 쓰려면 빌드 전 src/ 안에 번들을 만들어 둔다.
// 이 스크립트로 생성한 src/data/kisa-practice.json 을 git 에 커밋 → Docker 빌드가 src 와 함께 번들.
//
// 실행: node scripts/build-kisa-practice.mjs  (또는 npm run build:practice)

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'kisa-module/library-kisec2026/practice');
const outDir = join(root, 'src/data');
const outFile = join(outDir, 'kisa-practice.json');

// README 제외, 실습 md 만 (01~13)
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .sort();

const items = files
  .map((f) => {
    const body = readFileSync(join(dir, f), 'utf8');
    const id = f.replace(/\.md$/, '');
    const num = parseInt(id.match(/^(\d+)/)?.[1] || '0', 10);
    // 제목: 첫 '# ' 헤더 (예: "실습 01 — DB에 데이터를 입력하는 기능 …")
    const title = (body.match(/^#\s+(.+)$/m)?.[1] || id).trim();
    // 출처: 첫 '> 출처:' 인용
    const source = (body.match(/^>\s*출처:\s*(.+)$/m)?.[1] || '').trim();
    // 표준형(01~07: 보안설계기준 표) / 변형형(08~13: 진단 평가서식)
    const type = num <= 7 ? '표준형' : '변형형';
    return { id, num, title, source, type, body };
  })
  .sort((a, b) => a.num - b.num);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify({ version: 1, count: items.length, items }));
console.log(`✓ src/data/kisa-practice.json 생성: ${items.length}개 실습 (표준형 ${items.filter((i) => i.type === '표준형').length} + 변형형 ${items.filter((i) => i.type === '변형형').length})`);
