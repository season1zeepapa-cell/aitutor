// 이론교육 목록 — /kisa/theory
// 구현단계(원인/영향/대응/진단방법) + 설계단계(요구사항 설명/내용/관련약점)를 탭으로 구분, 분류별 나열.
//   - 데이터: 번들(kisa-library.json) kisec2026 자료원. 구현=theory 보유 IMP, 설계=design 보유 DSG.
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import libData from '../../data/kisa-library.json';

// 분류(category 한글 라벨) 순서·아이콘
const CAT_ORDER = {
  '입력데이터 검증 및 표현': 1, '보안기능': 2, '시간 및 상태': 3,
  '에러처리': 4, '코드오류': 5, '캡슐화': 6, 'API오용': 7, 'API 오용': 7, '세션통제': 8,
};
const CAT_EMOJI = {
  '입력데이터 검증 및 표현': '🔍', '보안기능': '🔐', '시간 및 상태': '⏱️',
  '에러처리': '⚠️', '코드오류': '🐛', '캡슐화': '📦', 'API오용': '🔧', 'API 오용': '🔧', '세션통제': '🎫',
};
const num = (code) => { const m = String(code).match(/(\d+)\s*$/); return m ? +m[1] : 0; };

export default function TheoryList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 'impl'(구현) | 'design'(설계) — 설계 상세에서 돌아올 때 ?stage=design 으로 복원
  const [stage, setStage] = useState(searchParams.get('stage') === 'design' ? 'design' : 'impl');

  const { implGroups, designGroups, implCount, designCount } = useMemo(() => {
    const items = libData.sources.find((s) => s.id === 'kisec2026')?.items || [];
    const group = (list) => {
      const by = {};
      for (const it of list) (by[it.category || '기타'] ||= []).push(it);
      return Object.entries(by)
        .sort((a, b) => (CAT_ORDER[a[0]] || 99) - (CAT_ORDER[b[0]] || 99))
        .map(([cat, l]) => [cat, l.sort((x, y) => num(x.id) - num(y.id))]);
    };
    const impl = items.filter((x) => x.id?.startsWith('IMP-') && x.theory);
    const design = items.filter((x) => x.id?.startsWith('DSG-') && x.design);
    return { implGroups: group(impl), designGroups: group(design), implCount: impl.length, designCount: design.length };
  }, []);

  const groups = stage === 'design' ? designGroups : implGroups;

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📖</span>
          <h2 className="text-base font-bold text-primary">이론교육</h2>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          KISEC 2026 교재 양식대로 약점별 핵심을 학습하세요. 구현은 <b>원인·영향·대응·진단방법</b>, 설계는 <b>요구사항·관련 보안약점</b>.
        </p>
      </div>

      {/* 단계 탭 */}
      <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <button
          onClick={() => setStage('impl')}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-bold transition-all ${stage === 'impl' ? 'bg-card-bg text-primary shadow-sm' : 'text-text-secondary hover:text-text'}`}
        >
          🔧 구현단계 <span className="text-[10px] opacity-70">({implCount})</span>
        </button>
        <button
          onClick={() => setStage('design')}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-bold transition-all ${stage === 'design' ? 'bg-card-bg text-primary shadow-sm' : 'text-text-secondary hover:text-text'}`}
        >
          📐 설계단계 <span className="text-[10px] opacity-70">({designCount})</span>
        </button>
      </div>

      {/* 분류별 약점 목록 */}
      {groups.map(([cat, list]) => (
        <div key={cat} className="rounded-xl bg-card-bg border border-border p-3">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
            <span>{CAT_EMOJI[cat] || '•'}</span>
            <span>{cat}</span>
            <span className="text-[10px] text-text-secondary">({list.length})</span>
          </h3>
          <div className="space-y-1">
            {list.map((it) => (
              <button
                key={it.id}
                onClick={() => navigate(`/kisa/theory/${it.id}`)}
                className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-primary-light active:scale-[0.99] transition-all"
              >
                <span className="text-[10px] font-mono text-text-secondary w-16 shrink-0">{it.id}</span>
                <span className="flex-1 text-xs font-medium truncate">{it.title}</span>
                <span className="text-text-secondary text-xs shrink-0">→</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <button onClick={() => navigate('/kisa')} className="w-full py-2 rounded-lg border border-border text-sm text-text-secondary">
        ← 대시보드로
      </button>
    </div>
  );
}
