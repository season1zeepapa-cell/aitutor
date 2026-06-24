// KISA 라이브러리 합본 생성 (REBUILD45 / 정렬·계층 개선 REBUILD46)
// kisa-module/library(진단가이드) + course(양성과정 교재) json → src/data/kisa-library.json
//
// 왜 필요한가: Dockerfile frontend-builder 는 src/·public/ 만 COPY 한다.
// kisa-module/ 은 빌드 컨텍스트에 없으므로, 앱이 쓰려면 빌드 전 src/ 안에 합본을 만들어 두어야 한다.
// 이 스크립트로 생성한 src/data/kisa-library.json 을 git 에 커밋 → Docker 빌드가 src 와 함께 번들.
//
// 정렬: 원본 가이드 순서를 따른다.
//   - 단계:   설계(design) → 구현(implementation)
//   - 분류:   입력검증 → 보안기능 → 시간및상태 → 에러처리 → 코드오류 → 캡슐화 → API오용 → 세션통제
//   - 항목:   분류 안에서 번호순
//   - 교재:   단원 Ⅰ→Ⅵ, Ⅳ·Ⅴ 는 분류로 세분
//
// 실행: node scripts/build-kisa-library.mjs  (또는 npm run build:lib)

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libDir = join(root, 'kisa-module/library');
const courseDir = join(root, 'kisa-module/course');
const kisec2026Dir = join(root, 'kisa-module/library-kisec2026'); // 2026 기본과정 교재(별도 자료원)
const outDir = join(root, 'src/data');
const outFile = join(outDir, 'kisa-library.json');

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
// 원본 가이드 분류 순서
const CAT_ORDER = {
  input_validation: 1, security_feature: 2, time_state: 3, error_handling: 4,
  code_error: 5, encapsulation: 6, api_abuse: 7, session_control: 8,
};
const STAGE_LABEL = { design: '설계단계', implementation: '구현단계' };
const STAGE_ORDER = { design: 1, implementation: 2 };
const UNIT_ORDER = { 'Ⅰ': 1, 'Ⅱ': 2, 'Ⅲ': 3, 'Ⅳ': 4, 'Ⅴ': 5, 'Ⅵ': 6 };
const ABBR_CAT = { IV: 'input_validation', SF: 'security_feature', TS: 'time_state', EH: 'error_handling', CE: 'code_error', EN: 'encapsulation', AA: 'api_abuse', SC: 'session_control' };

const codeNum = (code) => { const m = String(code).match(/(\d+)\s*$/); return m ? +m[1] : 0; };
const catAbbr = (code) => { const m = String(code).match(/-(IV|SF|TS|EH|CE|EN|AA|SC)-/); return m ? m[1] : ''; };

function readJsons(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

// 진단가이드(library) → 카드. g1=단계, g2=분류
function mapLibrary(d, src = 'library') {
  const catLabel = CAT_LABEL[d.category] || d.category || '';
  return {
    id: d.chapter_code,
    title: d.title,
    source: src,
    g1: STAGE_LABEL[d.stage] || d.stage || '기타',
    g2: catLabel,
    order: (STAGE_ORDER[d.stage] || 9) * 100000 + (CAT_ORDER[d.category] || 9) * 1000 + codeNum(d.chapter_code),
    category: catLabel,
    summary: d.overview || d.description || '',
    keywords: d.tags || [],
    cwe: d.cwe || '',
    detail: [
      d.countermeasure ? { label: '보안대책', text: d.countermeasure } : null,
      Array.isArray(d.security_measures) && d.security_measures.length ? { label: '보안대책', text: d.security_measures.join('\n') } : null,
      d.diagnosis?.method ? { label: '진단방법', text: d.diagnosis.method } : null,
      (d.question_hooks?.keywords || []).length ? { label: '핵심 키워드', text: d.question_hooks.keywords.join(', ') } : null,
    ].filter(Boolean),
    codeExamples: (d.code_examples || []).map((c) => ({ lang: c.lang || '', vulnerable: c.vulnerable || '', safe: c.safe || '', note: c.note || '' })),
    diagnosisCode: {
      truePositive: (d.diagnosis?.true_positive || []).map((t) => ({ desc: t.desc || '', code: t.code || '' })),
      falsePositive: (d.diagnosis?.false_positive || []).map((t) => ({ desc: t.desc || '', code: t.code || '' })),
    },
  };
}

// 양성과정 교재(course) → 카드. g1=단원, g2=분류(Ⅳ·Ⅴ 항목카드만)
function mapCourse(d, src = 'course') {
  const isItem = /-(DSG|IMP)-/.test(d.unit_code); // COURSE-/K26- 등 prefix 무관하게 약점 항목카드 판별
  const cat = isItem ? ABBR_CAT[catAbbr(d.unit_code)] : '';
  const catLabel = CAT_LABEL[cat] || (CAT_LABEL[d.category] || (isItem ? d.category : ''));
  return {
    id: d.unit_code,
    title: d.title,
    source: src,
    unit: d.unit || '', // 단원 로마숫자 (Ⅰ~Ⅵ) — 단원카드 학습 링크 분기용
    g1: d.unit ? `${d.unit}단원` : '단원',
    g2: isItem ? catLabel : '', // 단원카드(Ⅰ·Ⅱ·Ⅲ·Ⅵ)는 g2 없음 → 단원 직속
    order: (UNIT_ORDER[d.unit] || 9) * 100000 + (isItem ? (CAT_ORDER[cat] || 9) * 1000 + codeNum(d.unit_code) : 0),
    category: CAT_LABEL[d.category] || d.category || '개요',
    summary: d.summary || '',
    keywords: d.keywords || [],
    cwe: '',
    detail: [
      (d.exam_points || []).length ? { label: '시험 출제 포인트', text: d.exam_points.map((p) => `• ${p}`).join('\n') } : null,
      (d.sections || []).length ? { label: '구성', text: d.sections.map((s) => s.title).join(' · ') } : null,
      (d.related_library || []).length ? { label: '연관 라이브러리', text: d.related_library.join(', ') } : null,
    ].filter(Boolean),
    relatedLibrary: d.related_library || [], // 교차 점프용 (IMP/DSG 코드)
    codeExamples: [],
    diagnosisCode: { truePositive: [], falsePositive: [] },
  };
}

const libItems = readJsons(libDir).map((d) => mapLibrary(d)).sort((a, b) => a.order - b.order);
const courseItems = readJsons(courseDir).map((d) => mapCourse(d)).sort((a, b) => a.order - b.order);

// 2026 기본과정 교재(별도 자료원). 약점카드(chapter_code)·이론카드(unit_code) 혼재 → 필드로 분기.
// _extract/ 등 하위 폴더는 readdirSync 가 .json 만 필터하므로 자동 제외.
//
// 2026 교재는 설계/구현 '단계'가 아니라 교재 '단원(Ⅰ~Ⅵ)'으로 묶는다(교재 목차 기준).
//   - 약점카드: DSG → Ⅳ단원(분석·설계 단계), IMP → Ⅴ단원(구현 단계)
//   - 이론카드(K26): mapCourse 가 이미 unit 기반 g1(Ⅰ~Ⅵ단원)을 부여
const kisec2026Items = (existsSync(kisec2026Dir) ? readJsons(kisec2026Dir) : [])
  .map((raw) => {
    const item = raw.chapter_code ? mapLibrary(raw, 'kisec2026') : mapCourse(raw, 'kisec2026');
    if (raw.chapter_code) {
      const unit = raw.chapter_code.startsWith('DSG') ? 'Ⅳ' : 'Ⅴ';
      item.unit = unit;
      item.g1 = `${unit}단원`;
      // 단원 우선 정렬(Ⅳ=4·Ⅴ=5) + 단원 내 기존 분류·번호 순서 보존
      item.order = (UNIT_ORDER[unit] || 9) * 100000 + (item.order % 100000);
    }
    return item;
  })
  .sort((a, b) => a.order - b.order);

const data = {
  version: 2,
  sources: [
    { id: 'library', label: '진단가이드 (보안약점)', count: libItems.length, items: libItems },
    { id: 'course', label: '양성과정 교재', count: courseItems.length, items: courseItems },
    { id: 'kisec2026', label: '2026 기본과정 교재', count: kisec2026Items.length, items: kisec2026Items },
  ],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(data));
console.log(`✓ src/data/kisa-library.json 생성: library ${libItems.length} + course ${courseItems.length} + kisec2026 ${kisec2026Items.length} = ${libItems.length + courseItems.length + kisec2026Items.length}개`);
