// KISA 라이브러리 합본 생성 (REBUILD45)
// kisa-module/library(진단가이드) + course(양성과정 교재) json → src/data/kisa-library.json
//
// 왜 필요한가: Dockerfile frontend-builder 는 src/·public/ 만 COPY 한다.
// kisa-module/ 은 빌드 컨텍스트에 없으므로, 앱이 쓰려면 빌드 전 src/ 안에 합본을 만들어 두어야 한다.
// 이 스크립트로 생성한 src/data/kisa-library.json 을 git 에 커밋 → Docker 빌드가 src 와 함께 번들.
//
// 실행: node scripts/build-kisa-library.mjs  (또는 npm run build:lib)

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libDir = join(root, 'kisa-module/library');
const courseDir = join(root, 'kisa-module/course');
const outDir = join(root, 'src/data');
const outFile = join(outDir, 'kisa-library.json');

// 분류 코드 → 한글 라벨
const CAT_LABEL = {
  input_validation: '입력데이터 검증 및 표현',
  security_feature: '보안기능',
  time_state: '시간 및 상태',
  error_handling: '에러처리',
  code_error: '코드오류',
  encapsulation: '캡슐화',
  api_abuse: 'API오용',
  session_control: '세션통제',
};
const STAGE_LABEL = { design: '설계단계', implementation: '구현단계' };

function readJsons(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

// 진단가이드(library) 항목 → 통합 카드
function mapLibrary(d) {
  return {
    id: d.chapter_code,
    title: d.title,
    source: 'library',
    group: STAGE_LABEL[d.stage] || d.stage || '기타',
    category: CAT_LABEL[d.category] || d.category || '',
    summary: d.overview || d.description || '',
    keywords: d.tags || [],
    cwe: d.cwe || '',
    detail: [
      d.countermeasure ? { label: '보안대책', text: d.countermeasure } : null,
      Array.isArray(d.security_measures) && d.security_measures.length
        ? { label: '보안대책', text: d.security_measures.join('\n') }
        : null,
      d.diagnosis?.method ? { label: '진단방법', text: d.diagnosis.method } : null,
      (d.code_examples || []).length
        ? { label: '코드예제', text: `${d.code_examples.length}개 언어 (취약/안전 쌍) — 상세는 라이브러리 원문` }
        : null,
      (d.diagnosis?.true_positive || []).length || (d.diagnosis?.false_positive || []).length
        ? { label: '정탐/오탐', text: `정탐 ${(d.diagnosis.true_positive || []).length} · 오탐 ${(d.diagnosis.false_positive || []).length}` }
        : null,
      (d.question_hooks?.keywords || []).length
        ? { label: '핵심 키워드', text: d.question_hooks.keywords.join(', ') }
        : null,
    ].filter(Boolean),
  };
}

// 양성과정 교재(course) 항목 → 통합 카드
function mapCourse(d) {
  return {
    id: d.unit_code,
    title: d.title,
    source: 'course',
    group: d.unit ? `${d.unit}단원` : '단원',
    category: CAT_LABEL[d.category] || d.category || '개요',
    summary: d.summary || '',
    keywords: d.keywords || [],
    cwe: '',
    detail: [
      (d.exam_points || []).length
        ? { label: '시험 출제 포인트', text: d.exam_points.map((p) => `• ${p}`).join('\n') }
        : null,
      (d.sections || []).length
        ? { label: '구성', text: d.sections.map((s) => s.title).join(' · ') }
        : null,
      (d.related_library || []).length
        ? { label: '연관 라이브러리', text: d.related_library.join(', ') }
        : null,
    ].filter(Boolean),
  };
}

const libItems = readJsons(libDir).map(mapLibrary);
const courseItems = readJsons(courseDir).map(mapCourse);

const data = {
  version: 1,
  sources: [
    { id: 'library', label: '진단가이드 (보안약점)', count: libItems.length, items: libItems },
    { id: 'course', label: '양성과정 교재', count: courseItems.length, items: courseItems },
  ],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(data));
console.log(
  `✓ src/data/kisa-library.json 생성: library ${libItems.length} + course ${courseItems.length} = ${libItems.length + courseItems.length}개`
);
