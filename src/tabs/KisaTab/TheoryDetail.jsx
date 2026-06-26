// 이론교육 상세 — /kisa/theory/:code
// KISEC 2026 교재 양식(원인/영향/대응/진단방법 4박스)으로 약점 1개를 학습한다.
//   - 원인/영향/대응: 교재 문구 그대로(theory.cause/impact/countermeasure 배열)
//   - 진단방법: 플로우차트 이미지(diagnosisImage), 없으면 텍스트(diagnosis.method) fallback
//   - DB/API 무변경 — 번들(kisa-library.json) 직참조.
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import libData from '../../data/kisa-library.json';

// 4박스 레이블별 색상(Image #4 양식)
const BOX_STYLE = {
  cause: { label: '원인', chip: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200', border: 'border-slate-200 dark:border-slate-700' },
  impact: { label: '영향', chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', border: 'border-red-200 dark:border-red-900/50' },
  countermeasure: { label: '대응', chip: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', border: 'border-green-200 dark:border-green-900/50' },
};

export default function TheoryDetail() {
  const { code } = useParams();
  const navigate = useNavigate();

  const item = useMemo(
    () => libData.sources.find((s) => s.id === 'kisec2026')?.items.find((i) => i.id === code) || null,
    [code],
  );

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

  const t = item.theory || { cause: [], impact: [], countermeasure: [] };
  // 진단방법 텍스트 fallback (이미지 없을 때): detail 의 '진단방법' 라벨
  const diagMethod = (item.detail || []).find((d) => d.label === '진단방법')?.text || '';

  return (
    <div className="space-y-3">
      {/* 상단 네비 */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={() => navigate('/kisa/theory')} className="text-text-secondary hover:text-text">← 이론교육 목록</button>
      </div>

      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">🔧 구현단계</span>
          {item.category && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-light text-primary">{item.category}</span>
          )}
          <span className="text-[10px] font-mono text-text-secondary ml-auto">{item.id}</span>
        </div>
        <h1 className="text-base font-bold text-primary">{item.title}</h1>
      </div>

      {/* 1~3. 원인 / 영향 / 대응 (교재 문구 그대로) */}
      {['cause', 'impact', 'countermeasure'].map((key) => {
        const style = BOX_STYLE[key];
        const items = t[key] || [];
        if (items.length === 0) return null;
        return (
          <div key={key} className={`rounded-xl bg-card-bg border ${style.border} overflow-hidden`}>
            <div className="flex">
              {/* 좌측 레이블 */}
              <div className={`flex items-center justify-center px-3 py-3 shrink-0 w-16 ${style.chip} font-bold text-sm`}>
                {style.label}
              </div>
              {/* 우측 내용 (불릿) */}
              <ul className="flex-1 p-3 space-y-1.5">
                {items.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span className="text-text-secondary shrink-0">•</span>
                    <span className="flex-1">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}

      {/* 4. 진단방법 (이미지 우선, 없으면 텍스트) */}
      <div className="rounded-xl bg-card-bg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex">
          <div className="flex items-center justify-center px-3 py-3 shrink-0 w-16 bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200 font-bold text-sm leading-tight text-center">
            진단<br />방법
          </div>
          <div className="flex-1 p-3">
            {item.diagnosisImage ? (
              <img src={item.diagnosisImage} alt={`${item.title} 진단방법`} className="w-full rounded-lg border border-border bg-white" loading="lazy" />
            ) : diagMethod ? (
              <p className="text-sm leading-relaxed text-text-secondary">{diagMethod}</p>
            ) : (
              <p className="text-xs text-text-secondary py-2">진단방법 도식 이미지 준비 중입니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* 출처 */}
      <p className="text-[10px] text-text-secondary px-1">
        출처: KISEC 2026년 SW보안약점 진단원 기본과정 {item.id && `· ${item.id}`}
      </p>
    </div>
  );
}
