// 이론교육 상세 — /kisa/theory/:code
// 단계별로 교재 양식이 다르다.
//   - 구현(implementation): 원인/영향/대응/진단방법 4박스 (theory + diagnosisImage)
//   - 설계(design): 요구사항 설명 / 요구사항 내용 / 관련 보안약점(IMP 링크) (design)
//   - DB/API 무변경 — 번들(kisa-library.json) 직참조.
import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import libData from '../../data/kisa-library.json';
import CodeBlock from '../../components/CodeBlock'; // 코드 하이라이트(StudyDetail과 동일)
import { useImageModal } from '../../App'; // 이미지 탭하여 전체화면 확대(기출문제와 동일)

// 구현 4박스 레이블 색상(Image #4)
const BOX_STYLE = {
  cause: { label: '원인', chip: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200', border: 'border-slate-200 dark:border-slate-700' },
  impact: { label: '영향', chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', border: 'border-red-200 dark:border-red-900/50' },
  countermeasure: { label: '대응', chip: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', border: 'border-green-200 dark:border-green-900/50' },
};

// 약점명 정규화(관련약점 → IMP code 보강용)
const norm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, '');

// 좌(레이블)+우(내용) 한 박스
function LabelBox({ label, chip, border, children }) {
  return (
    <div className={`rounded-xl bg-card-bg border ${border} overflow-hidden`}>
      <div className="flex">
        <div className={`flex items-center justify-center px-2 py-3 shrink-0 w-16 ${chip} font-bold text-xs leading-tight text-center`}>
          {label}
        </div>
        <div className="flex-1 p-3">{children}</div>
      </div>
    </div>
  );
}

function Bullets({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((line, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-text-secondary shrink-0">•</span>
          <span className="flex-1">{line}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TheoryDetail() {
  const { code } = useParams();
  const navigate = useNavigate();
  const openImage = useImageModal();
  const [openCons, setOpenCons] = useState(() => new Set()); // 설계 고려사항 아코디언 펼침
  const toggleCons = (i) =>
    setOpenCons((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  const [open2026, setOpen2026] = useState(() => new Set()); // 2026 교재 코드예시 아코디언(초기 모두 접힘)
  const toggle2026 = (i) =>
    setOpen2026((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const item = useMemo(
    () => libData.sources.find((s) => s.id === 'kisec2026')?.items.find((i) => i.id === code) || null,
    [code],
  );

  // 관련 보안약점(설계) → 구현(IMP) 이론교육 링크: code 우선, 없으면 약점명으로 보강
  const impByName = useMemo(() => {
    const m = {};
    (libData.sources.find((s) => s.id === 'kisec2026')?.items || [])
      .filter((x) => x.id && x.id.startsWith('IMP-') && x.theory)
      .forEach((x) => { m[norm(x.title)] = x.id; });
    return m;
  }, []);
  const linkCode = (r) => r.code || impByName[norm(r.weakness)] || '';

  // 구현(IMP) → 관련 설계(DSG) 역참조: 설계 항목의 related[]가 이 구현약점을 가리키면 링크(설계영역과 반대방향)
  const designByImp = useMemo(() => {
    const m = {};
    (libData.sources.find((s) => s.id === 'kisec2026')?.items || [])
      .filter((x) => x.id && x.id.startsWith('DSG-') && x.design)
      .forEach((dsg) => {
        (dsg.design.related || []).forEach((r) => {
          const impId = r.code || impByName[norm(r.weakness)];
          if (!impId) return;
          (m[impId] ||= []).push({ id: dsg.id, title: dsg.title, category: dsg.category });
        });
      });
    // id 중복 제거
    Object.keys(m).forEach((k) => {
      const seen = new Set();
      m[k] = m[k].filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
    });
    return m;
  }, [impByName]);

  if (!item) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
          <p className="font-bold text-red-700 dark:text-red-300 mb-2">약점을 찾을 수 없습니다</p>
          <button onClick={() => navigate('/kisa/theory')} className="px-3 py-1.5 rounded-lg border border-border text-xs">목록으로</button>
        </div>
      </div>
    );
  }

  const isDesign = !!item.design;

  return (
    <div className="space-y-3">
      {/* 상단 네비 */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={() => navigate(`/kisa/theory${isDesign ? '?stage=design' : ''}`)} className="text-text-secondary hover:text-text">← 이론교육 목록</button>
      </div>

      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
            {isDesign ? '📐 설계단계' : '🔧 구현단계'}
          </span>
          {item.category && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-light text-primary">{item.category}</span>
          )}
          <span className="text-[10px] font-mono text-text-secondary ml-auto">{item.id}</span>
        </div>
        <h1 className="text-base font-bold text-primary">{item.title}</h1>
      </div>

      {isDesign ? (
        /* ── 설계 양식 (Image #5): 요구사항 설명 / 요구사항 내용 / 관련 보안약점 ── */
        <>
          {item.design.description && (
            <LabelBox label={<>요구사항<br />설명</>} chip="bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200" border="border-slate-200 dark:border-slate-700">
              <p className="text-sm leading-relaxed">{item.design.description}</p>
            </LabelBox>
          )}
          {item.design.measures.length > 0 && (
            <LabelBox label={<>요구사항<br />내용</>} chip="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" border="border-violet-200 dark:border-violet-900/50">
              <Bullets items={item.design.measures} />
            </LabelBox>
          )}
          {item.design.related.length > 0 && (
            <LabelBox label={<>관련<br />구현약점</>} chip="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" border="border-red-200 dark:border-red-900/50">
              <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">이 설계 기준이 미흡하면 발생하는 <span className="font-semibold text-red-600 dark:text-red-400">구현단계 보안약점</span>입니다.</p>
              <ul className="space-y-1.5">
                {item.design.related.map((r, i) => {
                  const to = linkCode(r);
                  return (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed items-start">
                      <span className="text-text-secondary shrink-0">•</span>
                      {to ? (
                        <button
                          onClick={() => navigate(`/kisa/theory/${to}`)}
                          className="flex-1 text-left text-primary hover:underline font-medium"
                        >
                          {r.category && <span className="text-text-secondary font-normal">{r.category} &gt; </span>}
                          {r.weakness} <span className="text-[10px]">↗</span>
                        </button>
                      ) : (
                        <span className="flex-1">
                          {r.category && <span className="text-text-secondary">{r.category} &gt; </span>}
                          {r.weakness}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </LabelBox>
          )}

          {/* 설계 시 고려사항 — 아코디언(교재 상세) */}
          {(item.design.considerations || []).length > 0 && (
            <div className="rounded-xl bg-card-bg border border-border p-3">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
                📐 <span>설계 시 고려사항</span>
                <span className="text-[10px] text-text-secondary font-normal">({item.design.considerations.length})</span>
              </h3>
              <div className="space-y-2">
                {item.design.considerations.map((c, i) => {
                  const open = openCons.has(i);
                  return (
                    <div key={i} className="rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => toggleCons(i)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <span className="text-primary/60 text-xs">{open ? '▾' : '▸'}</span>
                        <span className="flex-1 text-xs font-semibold">{c.point}</span>
                        <span className="text-[10px] text-text-secondary">{open ? '접기' : '펼치기'}</span>
                      </button>
                      {open && (
                        <div className="p-3">
                          <p className="text-sm leading-relaxed text-text-secondary">{c.detail}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── 구현 양식 (Image #4): 원인 / 영향 / 대응 / 진단방법 ── */
        <>
          {['cause', 'impact', 'countermeasure'].map((key) => {
            const style = BOX_STYLE[key];
            const items = (item.theory || {})[key] || [];
            if (items.length === 0) return null;
            return (
              <LabelBox key={key} label={style.label} chip={style.chip} border={style.border}>
                <Bullets items={items} />
              </LabelBox>
            );
          })}
          {/* 진단방법 (이미지 우선, 없으면 텍스트) */}
          <LabelBox label={<>진단<br />방법</>} chip="bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200" border="border-slate-200 dark:border-slate-700">
            {item.diagnosisImage ? (
              <div className="relative cursor-pointer" onClick={() => openImage(item.diagnosisImage)} title="탭하여 크게 보기">
                <img src={item.diagnosisImage} alt={`${item.title} 진단방법`} className="w-full rounded-lg border border-border bg-white" loading="lazy" />
                <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium pointer-events-none">
                  🔍 탭하여 크게
                </span>
              </div>
            ) : (item.detail || []).find((d) => d.label === '진단방법')?.text ? (
              <p className="text-sm leading-relaxed text-text-secondary">{(item.detail || []).find((d) => d.label === '진단방법').text}</p>
            ) : (
              <p className="text-xs text-text-secondary py-2">진단방법 도식 이미지 준비 중입니다.</p>
            )}
          </LabelBox>

          {/* 관련 설계 항목 — 이 구현약점을 가리키는 설계(DSG) 항목 역링크(설계영역 '관련 보안약점' UI와 동일 양식) */}
          {(designByImp[item.id] || []).length > 0 && (
            <LabelBox label={<>관련<br />설계항목</>} chip="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" border="border-violet-200 dark:border-violet-900/50">
              <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">이 약점의 근원이 되는 <span className="font-semibold text-violet-600 dark:text-violet-400">설계단계 기준</span>입니다.</p>
              <ul className="space-y-1.5">
                {designByImp[item.id].map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed items-start">
                    <span className="text-text-secondary shrink-0">•</span>
                    <button
                      onClick={() => navigate(`/kisa/theory/${d.id}`)}
                      className="flex-1 text-left text-primary hover:underline font-medium"
                    >
                      {d.category && <span className="text-text-secondary font-normal">{d.category} &gt; </span>}
                      {d.title} <span className="text-[10px]">↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </LabelBox>
          )}

          {/* 2026 교재 코드예시 — kisec2026 항목의 codeExamples 직참조(StudyDetail과 동일 양식) */}
          {(item.codeExamples || []).length > 0 && (
            <div className="rounded-xl bg-card-bg border border-border p-3">
              <h3 className="text-sm font-bold mb-1">
                📘 2026 교재 코드예시 <span className="text-[10px] text-text-secondary font-normal">({item.codeExamples.length})</span>
              </h3>
              <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">KISEC 2026 기본과정 교재의 언어·기법별 취약/안전 코드.</p>
              <div className="space-y-2">
                {item.codeExamples.map((ex, exIdx) => {
                  const open = open2026.has(exIdx);
                  const lang = (ex.lang || '').toLowerCase().split(/[ (]/)[0] || 'java';
                  return (
                    <div key={exIdx} className="rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => toggle2026(exIdx)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <span className="text-primary/60 text-xs">{open ? '▾' : '▸'}</span>
                        <span className="flex-1 text-xs font-semibold">{ex.lang || '코드'}</span>
                        <span className="text-[10px] text-text-secondary">{open ? '접기' : '펼치기'}</span>
                      </button>
                      {open && (
                        <div className="p-3 space-y-3">
                          {ex.vulnerable && (
                            <div>
                              <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">❌ 취약한 코드</div>
                              <CodeBlock code={ex.vulnerable} language={lang} />
                            </div>
                          )}
                          {ex.safe && (
                            <div>
                              <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">✅ 안전한 코드</div>
                              <CodeBlock code={ex.safe} language={lang} />
                            </div>
                          )}
                          {ex.note && (
                            <p className="text-xs text-text-secondary leading-relaxed pt-1 border-t border-border">
                              <span className="font-bold text-text">설명: </span>{ex.note}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 출처 */}
      <p className="text-[10px] text-text-secondary px-1">
        출처: KISEC 2026년 SW보안약점 진단원 기본과정 {item.id && `· ${item.id}`}
      </p>
    </div>
  );
}
