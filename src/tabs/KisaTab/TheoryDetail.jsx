// 이론교육 상세 — /kisa/theory/:code
// 단계별로 교재 양식이 다르다.
//   - 구현(implementation): 원인/영향/대응/진단방법 4박스 (theory + diagnosisImage)
//   - 설계(design): 요구사항 설명 / 요구사항 내용 / 관련 보안약점(IMP 링크) (design)
//   - DB/API 무변경 — 번들(kisa-library.json) 직참조.
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import libData from '../../data/kisa-library.json';
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
            <LabelBox label={<>관련<br />보안약점</>} chip="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" border="border-red-200 dark:border-red-900/50">
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
        </>
      )}

      {/* 출처 */}
      <p className="text-[10px] text-text-secondary px-1">
        출처: KISEC 2026년 SW보안약점 진단원 기본과정 {item.id && `· ${item.id}`}
      </p>
    </div>
  );
}
