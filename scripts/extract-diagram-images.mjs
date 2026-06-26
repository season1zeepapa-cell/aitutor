#!/usr/bin/env node
/**
 * extract-diagram-images.mjs
 * ---------------------------------------------------------------------------
 * "소프트웨어 보안약점 진단가이드(2021)" PDF의 각 보안약점 "취약점 개요"에 있는
 * 공격흐름도(다이어그램, 예: [그림 3-1] SQL 삽입 취약점)를 자동으로 잘라내어
 * public/q-images/library/ 에 PNG로 저장한다.
 *
 * 동작 원리(초보자용 설명):
 *  1) 다이어그램은 PDF 안에 "사진 한 장"이 아니라 선·도형으로 그려진 벡터라서
 *     pdfimages 로는 못 뽑는다. 그래서 페이지를 통째로 그림으로 만든 뒤(pdftoppm)
 *     다이어그램이 있는 사각형 영역만 잘라낸다(크롭).
 *  2) 그림은 "그림 N-N | ..." 캡션 바로 위에 있다. 캡션의 y좌표와 그림 위 본문의
 *     끝 y좌표 사이가 그림 영역이다. 그 좌표를 아래 MAPPINGS 에 미리 검증해 적어둔다.
 *
 * 새 약점을 추가하려면: PDF에서 캡션 페이지를 찾아(`그림 N-N`),
 *   `pdftotext -f P -l P -bbox-layout PDF -` 로 캡션/본문 y좌표를 확인한 뒤
 *   아래 MAPPINGS 에 한 줄 추가하면 된다.
 *
 * 좌표 단위 안내:
 *  - 렌더 해상도 DPI=200 기준 픽셀. 1pt = DPI/72 px (200dpi → 2.7778px).
 *  - x,y = 크롭 시작점(왼쪽 위), W,H = 잘라낼 폭/높이(픽셀).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 원본 PDF 경로 (커밋 대상 아님 — 로컬에만 존재)
const PDF = path.join(ROOT, 'kisa-pool/processed/소프트웨어_보안약점_진단가이드(2021).pdf');
// 저장 폴더 (vite publicDir → 빌드 시 dist 로 자동 복사)
const OUT_DIR = path.join(ROOT, 'public/q-images/library');

const DPI = 200; // 렌더 해상도

/**
 * 다이어그램 추출 매핑.
 *  - page      : PDF 실제 페이지 번호(목차 번호 아님)
 *  - chapter   : library-kisec2026 약점카드의 chapter_code (이미지 연결 키)
 *  - out       : 저장 파일명 (chapter_code 소문자 권장)
 *  - crop      : { x, y, w, h } 픽셀(DPI 기준). 검증된 값.
 *  - caption   : 참고용 캡션 텍스트(자동 검증/로그용)
 */
const MAPPINGS = [
  {
    page: 43,
    chapter: 'IMP-IV-01',
    out: 'imp-iv-01-sql-injection.png',
    crop: { x: 150, y: 1235, w: 1180, h: 390 },
    caption: '그림 3-1 | SQL 삽입 취약점',
  },
  // ── 확장 예정(좌표 검증 후 주석 해제) ──
  // { page: ??, chapter: 'IMP-IV-09', out: 'imp-iv-09-xml-injection.png',  crop: {x,y,w,h}, caption: '그림 3-2 | XML 삽입' },
  // { page: ??, chapter: 'IMP-IV-10', out: 'imp-iv-10-ldap-injection.png', crop: {x,y,w,h}, caption: '그림 3-3 | LDAP 삽입 취약점' },
];

function main() {
  if (!existsSync(PDF)) {
    console.error(`[오류] 원본 PDF를 찾을 수 없습니다: ${PDF}`);
    console.error('       kisa-pool/processed/ 아래에 진단가이드(2021) PDF가 있어야 합니다.');
    process.exit(1);
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  let ok = 0;
  for (const m of MAPPINGS) {
    const { page, crop, out, caption } = m;
    const outBase = path.join(OUT_DIR, out.replace(/\.png$/, ''));
    // pdftoppm 내장 크롭: -x -y -W -H (DPI 기준 픽셀). 추가 도구(ImageMagick) 불필요.
    const args = [
      '-f', String(page), '-l', String(page),
      '-r', String(DPI),
      '-x', String(crop.x), '-y', String(crop.y),
      '-W', String(crop.w), '-H', String(crop.h),
      '-png',
      PDF, outBase,
    ];
    try {
      execFileSync('pdftoppm', args, { stdio: 'pipe' });
      // pdftoppm 은 파일명에 페이지 번호를 붙인다(out-043.png). 깔끔한 이름으로 정리.
      const generated = `${outBase}-${String(page).padStart(3, '0')}.png`;
      const finalPath = path.join(OUT_DIR, out);
      if (existsSync(generated)) {
        execFileSync('mv', ['-f', generated, finalPath]);
      }
      console.log(`✅ ${out}  ←  p${page} (${caption})`);
      ok++;
    } catch (e) {
      console.error(`❌ ${out} 추출 실패 (p${page}): ${e.message}`);
    }
  }
  console.log(`\n완료: ${ok}/${MAPPINGS.length} 개 다이어그램을 ${path.relative(ROOT, OUT_DIR)} 에 저장했습니다.`);
}

main();
