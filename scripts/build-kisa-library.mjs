// KISA 라이브러리 합본 생성 (REBUILD45 / 정렬·계층 개선 REBUILD46)
// kisa-module/library(진단가이드) + 교재/가이드 자료원 json → src/data/kisa-library.json
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

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libDir = join(root, 'kisa-module/library');
const kisec2026Dir = join(root, 'kisa-module/library-kisec2026'); // 2026 기본과정 교재(별도 자료원)
const jssec2023Dir = join(root, 'kisa-module/library-jssec2023'); // JS 시큐어코딩 가이드(별도 자료원)
const devsec2021Dir = join(root, 'kisa-module/library-devsec2021'); // 소프트웨어 개발보안 가이드 2021(별도 자료원)
const pysec2023Dir = join(root, 'kisa-module/library-pysec2023'); // Python 시큐어코딩 가이드(별도 자료원)
const imageDir = join(root, 'public/q-images/library'); // 약점별 개요 다이어그램 이미지
const outDir = join(root, 'src/data');
const outFile = join(outDir, 'kisa-library.json');

// ── 약점명 ↔ 이미지 파일 자동 매칭 ─────────────────────────────────────
// 사용자가 이미지를 "약점명.png" 로 public/q-images/library/ 에 넣으면,
// 약점 제목(title)과 파일명을 정규화해 비교하여 자동으로 연결한다.
// 정규화: 소문자화 + 공백·괄호·대괄호·언더스코어·하이픈·점 제거 → "SQL 삽입" == "sql삽입.png"
const normalizeName = (s) =>
  String(s || '')
    .normalize('NFC')                           // macOS 파일명 NFD(자모분리) → NFC(완성형) 통일
    .toLowerCase()
    .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '') // 확장자 제거(파일명용)
    .replace(/[\s()[\]_\-.]/g, '')              // 공백·구분자 제거
    .trim();

// ⚠️ 한글 파일명은 macOS NFD(자모분리)로 저장돼 운영 리눅스(서버)에서 브라우저 NFC 요청과 매칭 실패한다.
//    → 매칭된 이미지를 chapter_code 기반 ASCII 파일명으로 사본 복사하고, 그 ASCII 경로를 서빙한다(한글 회피).
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function asciiCopy(folder, origFile, base) {
  if (!origFile) return '';
  const ext = (origFile.match(/\.(png|jpe?g|gif|webp)$/i) || ['.png'])[0].toLowerCase();
  const name = slug(base) + ext;
  const dir = join(root, 'public/q-images', folder);
  if (name && name !== origFile) {
    try { copyFileSync(join(dir, origFile), join(dir, name)); } catch { /* 원본 없으면 무시 */ }
  }
  return `/q-images/${folder}/${name || origFile}`;
}

// 약점명(정규화) → 원본 파일명 맵 (library 다이어그램 이미지)
const imageMap = (() => {
  const map = {};
  if (!existsSync(imageDir)) return map;
  for (const f of readdirSync(imageDir)) {
    if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(f)) continue;
    map[normalizeName(f)] = f;
  }
  return map;
})();

// title(약점명)로 이미지 탐색 → ASCII 사본 경로. JSON image 명시 시 우선.
const resolveImage = (d) => {
  const orig = d.image || imageMap[normalizeName(d.title)];
  if (!orig) return '';
  return asciiCopy('library', orig, d.chapter_code || normalizeName(d.title));
};

// 진단방법 플로우차트 이미지 (public/q-images/diagnosis/) — 이론교육 4박스의 '진단방법'
const diagnosisDir = join(root, 'public/q-images/diagnosis');
const SEC_TO_CAT = { 1: 'IV', 2: 'SF', 3: 'TS', 4: 'EH', 5: 'CE', 6: 'EN', 7: 'AA' }; // 교재 절 번호 → IMP 분류
// ① byCode: 파일명 "절-번호 ..." → IMP-{분류}-{번호} (정확)  ② byName: 약점명(번호 접두사 제거) fallback. 값은 원본 파일명.
const { diagnosisByCode, diagnosisMap } = (() => {
  const byCode = {}, byName = {};
  if (!existsSync(diagnosisDir)) return { diagnosisByCode: byCode, diagnosisMap: byName };
  for (const f of readdirSync(diagnosisDir)) {
    if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(f)) continue;
    const m = f.match(/^(\d+)-(\d+)\s/); // "1-1 SQL 삽입.png"
    if (m && SEC_TO_CAT[+m[1]]) byCode[`IMP-${SEC_TO_CAT[+m[1]]}-${String(+m[2]).padStart(2, '0')}`] = f;
    byName[normalizeName(f.replace(/^\d+-\d+\s*/, ''))] = f;
  }
  return { diagnosisByCode: byCode, diagnosisMap: byName };
})();
const stripParen = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
// chapter_code 매칭 우선, 약점명 fallback → ASCII 사본 경로
const resolveDiagnosisImage = (d) => {
  const orig =
    diagnosisByCode[d.chapter_code] ||
    diagnosisMap[normalizeName(stripParen(d.title))] ||
    diagnosisMap[normalizeName(d.title)];
  if (!orig) return '';
  return asciiCopy('diagnosis', orig, d.chapter_code || normalizeName(d.title));
};

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
    // 취약점 개요 다이어그램. JSON 의 image 명시 또는 약점명↔파일명 자동 매칭(resolveImage).
    image: resolveImage(d),
    // 상세 타입별 다이어그램(예: XSS 의 Reflective/Persistent/DOM). "유형 맞히기" 문제에 사용.
    typeImages: Array.isArray(d.type_images)
      ? d.type_images
          .map((t) => {
            const orig = imageMap[normalizeName(t.file || t.type)];
            return { type: t.type || '', desc: t.desc || '', image: orig ? asciiCopy('library', orig, `${d.chapter_code}-${t.type}`) : '' };
          })
          .filter((t) => t.image)
      : [],
    // 이론교육 4박스 — 교재 원인/영향/대응(배열, 문구 그대로) + 진단방법 플로우차트 이미지
    theory: d.theory && (d.theory.cause || d.theory.impact || d.theory.countermeasure) ? d.theory : null,
    diagnosisImage: resolveDiagnosisImage(d),
    // 설계영역(DSG) 이론교육 — 요구사항 설명/내용 + 관련 보안약점(IMP 링크). 교재 문구 그대로.
    design:
      d.stage === 'design' && (d.description || d.security_measures)
        ? {
            description: d.description || '',
            measures: d.security_measures || [],
            related: (d.related_weaknesses || []).map((r) => ({ category: r.category || '', weakness: r.weakness || '', code: r.code || '' })),
            considerations: (d.design_considerations || []).map((c) => ({ point: c.point || '', detail: c.detail || '' })),
          }
        : null,
    detail: [
      d.impact ? { label: '공격 영향', text: d.impact } : null,
      d.countermeasure ? { label: '보안대책', text: d.countermeasure } : null,
      Array.isArray(d.security_measures) && d.security_measures.length ? { label: '보안대책', text: d.security_measures.join('\n') } : null,
      d.diagnosis?.method ? { label: '진단방법', text: d.diagnosis.method } : null,
      (d.incident_cases || []).length ? { label: '사고사례', text: d.incident_cases.map((c) => `• ${c}`).join('\n') } : null,
      (d.question_hooks?.keywords || []).length ? { label: '핵심 키워드', text: d.question_hooks.keywords.join(', ') } : null,
    ].filter(Boolean),
    codeExamples: (d.code_examples || []).map((c) => ({ lang: c.lang || '', vulnerable: c.vulnerable || '', safe: c.safe || '', note: c.note || '' })),
    diagnosisCode: {
      truePositive: (d.diagnosis?.true_positive || []).map((t) => ({ desc: t.desc || '', code: t.code || '' })),
      falsePositive: (d.diagnosis?.false_positive || []).map((t) => ({ desc: t.desc || '', code: t.code || '' })),
    },
  };
}

// 교재 이론카드 → 카드. g1=단원, g2=분류(Ⅳ·Ⅴ 항목카드만) — kisec2026 이론카드에서 사용
function mapCourse(d, src) {
  const isItem = /-(DSG|IMP)-/.test(d.unit_code); // K26- 등 prefix 무관하게 약점 항목카드 판별
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

// JS 시큐어코딩 가이드(별도 자료원). 전부 구현단계(implementation) 약점카드.
const jssec2023Items = (existsSync(jssec2023Dir) ? readJsons(jssec2023Dir) : [])
  .map((raw) => mapLibrary(raw, 'jssec2023'))
  .sort((a, b) => a.order - b.order);

// 소프트웨어 개발보안 가이드 2021(별도 자료원). 설계(DEV-DSG-*) 20 + 구현(DEV-*) 49 약점카드.
// stage 필드(design/implementation)로 mapLibrary 가 그룹·정렬을 처리한다.
const devsec2021Items = (existsSync(devsec2021Dir) ? readJsons(devsec2021Dir) : [])
  .map((raw) => mapLibrary(raw, 'devsec2021'))
  .sort((a, b) => a.order - b.order);

// Python 시큐어코딩 가이드(별도 자료원). 전부 구현단계(implementation) 약점카드.
const pysec2023Items = (existsSync(pysec2023Dir) ? readJsons(pysec2023Dir) : [])
  .map((raw) => mapLibrary(raw, 'pysec2023'))
  .sort((a, b) => a.order - b.order);

const data = {
  version: 2,
  sources: [
    { id: 'library', label: '진단가이드 (보안약점)', count: libItems.length, items: libItems },
    { id: 'kisec2026', label: '2026 기본과정 교재', count: kisec2026Items.length, items: kisec2026Items },
    { id: 'jssec2023', label: 'JS 시큐어코딩 가이드', count: jssec2023Items.length, items: jssec2023Items },
    { id: 'devsec2021', label: '개발보안 가이드(2021)', count: devsec2021Items.length, items: devsec2021Items },
    { id: 'pysec2023', label: 'Python 시큐어코딩 가이드', count: pysec2023Items.length, items: pysec2023Items },
  ],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(data));
const total = libItems.length + kisec2026Items.length + jssec2023Items.length + devsec2021Items.length + pysec2023Items.length;
console.log(`✓ src/data/kisa-library.json 생성: library ${libItems.length} + kisec2026 ${kisec2026Items.length} + jssec2023 ${jssec2023Items.length} + devsec2021 ${devsec2021Items.length} + pysec2023 ${pysec2023Items.length} = ${total}개`);
console.log(`  이미지 자동매칭: public/q-images/library/ 에서 ${Object.keys(imageMap).length}개 파일 인식`);
