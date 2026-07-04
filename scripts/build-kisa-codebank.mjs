// KISA 구현단계 코드뱅크 생성 (REBUILD68 — 코드식별 퀴즈용 지식라이브러리)
//
// 무엇을: src/data/kisa-library.json 의 자료원 중 library(진단/개발보안가이드 2021)와
//   kisec2026(2026 기본과정 교재)의 "구현단계 49개 보안약점" 코드예시를 모아,
//   각 코드예시를 [취약 코드]·[안전 코드] 2개 엔트리로 분해한 "코드뱅크"를 만든다.
//   → 이후 build-kisa-code-quiz.mjs 가 이 코드뱅크에서 전수 문제를 생성한다.
//
// 왜: 코드식별 퀴즈(코드 보여주고 ①49개 약점 중 무엇인지 ②안전/취약인지 맞히기)의
//   단일 기준 데이터. library.json 은 앱 전반이 쓰는 큰 번들이라, 퀴즈 전용으로 슬림화.
//
// 실행: node scripts/build-kisa-codebank.mjs  (또는 npm run build:codebank)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libFile = join(root, 'src/data/kisa-library.json');
const outDir = join(root, 'src/data');
const outFile = join(outDir, 'kisa-codebank.json');

// 코드예시를 뽑을 자료원 (5개 공식 문서 전부 — REBUILD75 확장).
//   library    = 진단가이드(2021)   kisec2026 = 2026 기본과정 교재
//   devsec2021 = 개발보안 가이드(2021)   jssec2023 = JS 가이드   pysec2023 = Python 가이드
// 순서 = 중복 시 선점 순서(기존 id 보존을 위해 library 먼저).
const SOURCES = ['library', 'kisec2026', 'devsec2021', 'jssec2023', 'pysec2023'];

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const isRealCode = (s) => norm(s).replace(/[.\s:]/g, '').length >= 12; // "......" 류 placeholder 배제

// 약점 제목 정규화 — 자료원별 표기 차이(공백·괄호·유의어)를 흡수해 정본 49개와 매칭
//   예: "크로스사이트 스크립트(XSS)"→"크로스사이트스크립트", "취약한 패스워드 허용"→"취약한비밀번호허용"
const normTitle = (s) => String(s || '')
  .normalize('NFC')
  .toLowerCase()
  .replace(/\(.*?\)/g, '')          // 괄호 병기 제거 (XSS/CSRF/TOCTOU 등)
  .replace(/[\s·.:]/g, '')          // 공백·구분 기호 제거
  .replace(/패스워드/g, '비밀번호')
  .replace(/해쉬/g, '해시')
  .replace(/않은/g, '않는')
  .replace(/메소드로부터/g, '메소드부터');

const lib = JSON.parse(readFileSync(libFile, 'utf8'));
const getSource = (id) => (lib.sources || []).find((s) => s.id === id);

// ── 1) 정본 49개 구현단계 약점 (library 자료원 기준) ────────────────────
const librarySrc = getSource('library');
if (!librarySrc) throw new Error('library 자료원을 찾을 수 없음');

const weaknesses = [];
const weaknessById = new Map();
const weaknessByTitle = new Map(); // 정규화 제목 → 정본 약점 (JS/DEV/PY 자료원 매핑용)
for (const it of librarySrc.items || []) {
  if (it.g1 !== '구현단계') continue; // 설계(DSG) 제외 → 정확히 49개
  const measure = (it.detail || []).find((d) => /보안대책|대응/.test(d.label || ''))?.text || '';
  const w = {
    id: it.id, // IMP-XX-NN
    title: it.title,
    category: it.g2 || it.category || '',
    cwe: it.cwe || '',
    summary: norm(it.summary),
    measure: norm(measure),
  };
  weaknesses.push(w);
  weaknessById.set(it.id, w);
  weaknessByTitle.set(normTitle(it.title), w);
}
console.log(`[codebank] 정본 구현단계 약점: ${weaknesses.length}개 (기대 49)`);

// ── 기존 코드뱅크의 id 보존 맵 — 재생성해도 같은 (출처+코드)는 같은 CQ id 유지 (DB UPSERT·진도 안전) ──
//   출처별 전량 수록으로 전환하므로, 키를 source::isSafe::code 로 둔다.
//   (같은 코드가 여러 출처에 있으면 각 출처가 독립 문항 → 각자 자기 id 를 보존)
const prevIdByKey = new Map();
let maxSeq = 0;
if (existsSync(outFile)) {
  const prev = JSON.parse(readFileSync(outFile, 'utf8'));
  for (const p of prev.items || []) {
    prevIdByKey.set(`${p.source}::${p.isSafe ? 'S' : 'V'}::${norm(p.code)}`, p.id);
    const m = String(p.id).match(/^CQ-(\d+)$/);
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
  }
  console.log(`[codebank] 기존 id 보존: ${prevIdByKey.size}개 (max seq ${maxSeq})`);
}

// ── 2) library + kisec2026 코드예시 → 코드뱅크 엔트리(취약/안전 분해) ──
const items = [];
const seenInSource = new Set(); // 같은 출처 안에서만 완전 동일 코드 중복 제거(원문 중복 게재 방지)
const globalDedup = new Map();  // dedupKey → 최초 등장 출처 (중복제거 토글 통계용)
const stat = {};
const unmatched = {}; // 정본 매핑 실패 항목 로그 (설계 DSG·이론 카드가 대부분이어야 정상)

for (const srcId of SOURCES) {
  const src = getSource(srcId);
  if (!src) { console.warn(`[codebank] 자료원 없음: ${srcId}`); continue; }
  stat[srcId] = { vuln: 0, safe: 0, dupInSource: 0, crossDup: 0, noWeakness: 0 };
  unmatched[srcId] = [];

  for (const it of src.items || []) {
    // 구현단계 약점 매핑: ① IMP-* id 직매칭 (library·kisec2026)
    //                    ② 정규화 제목 매칭 (jssec JS-* / devsec DEV-* / pysec PY-* — 번호 체계가 달라 제목으로)
    //   설계단계(DSG)·이론 카드는 정본 49 제목과 안 겹쳐 자연 제외된다.
    const w = weaknessById.get(it.id) || weaknessByTitle.get(normTitle(it.title));
    const examples = it.codeExamples || it.code_examples || [];
    if (!w) {
      if (examples.length > 0) { stat[srcId].noWeakness++; unmatched[srcId].push(`${it.id} ${it.title}`); }
      continue;
    }

    // 코드 후보 수집: ① 예시코드(취약/안전 분해) ② 진단코드 정탐(=취약)/오탐(=안전) — REBUILD87
    //   진단코드는 library·kisec2026 에만 존재하며 전부 Java. desc 가 판정 근거라 note 로 쓴다.
    const variants = [];
    for (const ex of examples) {
      const lang = ex.lang || '';
      const note = norm(ex.note);
      variants.push({ code: ex.vulnerable, isSafe: false, lang, note });
      variants.push({ code: ex.safe, isSafe: true, lang, note });
    }
    const dc = it.diagnosisCode || {};
    for (const t of dc.truePositive || []) variants.push({ code: t.code, isSafe: false, lang: 'Java', note: norm(t.desc) });
    for (const t of dc.falsePositive || []) variants.push({ code: t.code, isSafe: true, lang: 'Java', note: norm(t.desc) });

    {
      for (const variant of variants) {
        if (!isRealCode(variant.code)) continue;
        const dedupKey = `${variant.isSafe ? 'S' : 'V'}::${norm(variant.code)}`;
        // 같은 출처 안 완전 중복(원문 페이지 재게재 등)만 제거 — 출처 간 중복은 유지(출처별 전량 원칙)
        const inSrcKey = `${srcId}::${dedupKey}`;
        if (seenInSource.has(inSrcKey)) { stat[srcId].dupInSource++; continue; }
        seenInSource.add(inSrcKey);
        // 출처 간 중복 통계(런타임 토글의 예상 제거량 파악용)
        if (globalDedup.has(dedupKey)) stat[srcId].crossDup++;
        else globalDedup.set(dedupKey, srcId);
        // 기존 뱅크에 같은 (출처+코드)가 있으면 그 id 재사용(진도·SRS 보존), 아니면 신규 발번
        const id = prevIdByKey.get(inSrcKey) || `CQ-${String(++maxSeq).padStart(4, '0')}`;
        items.push({
          id,
          weaknessId: w.id,
          weaknessTitle: w.title,
          category: w.category,
          cwe: w.cwe,
          source: srcId,
          lang: variant.lang,
          isSafe: variant.isSafe,
          code: variant.code.replace(/\r\n/g, '\n'),
          note: variant.note,
          dedupKey, // 런타임 중복제거 토글용 (출처 무관 동일 코드 판별)
        });
        stat[srcId][variant.isSafe ? 'safe' : 'vuln']++;
      }
    }
  }
  if (unmatched[srcId].length > 0) {
    console.log(`[codebank] ${srcId} 정본 미매칭(코드 보유) ${unmatched[srcId].length}건:`, unmatched[srcId].join(' | '));
  }
}

// ── 3) 저장 ─────────────────────────────────────────────────────────────
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = {
  weaknesses,        // 정본 49개 (문항 보기·매핑용)
  items,             // 코드뱅크 엔트리
  meta: {
    total: items.length,
    vulnerable: items.filter((i) => !i.isSafe).length,
    safe: items.filter((i) => i.isSafe).length,
    bySource: stat,
    sources: SOURCES,
  },
};
writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');

console.log(`[codebank] 코드뱅크 엔트리: ${items.length}개 (취약 ${out.meta.vulnerable} / 안전 ${out.meta.safe})`);
console.log(`[codebank] 자료원별:`, JSON.stringify(stat));
console.log(`[codebank] → ${outFile}`);
