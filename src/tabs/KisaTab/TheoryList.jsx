// 이론교육 목록 — /kisa/theory
// KISEC 2026 교재 구현단계 약점을 분류별로 나열. 각 약점 → 4박스 상세(원인/영향/대응/진단방법).
//   - 데이터: 번들(kisa-library.json) kisec2026 자료원의 IMP 약점 중 theory 보유 항목.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import libData from '../../data/kisa-library.json';

// 분류(category 한글 라벨) 순서·아이콘 — 교재 목차 순
const CAT_ORDER = {
  '입력데이터 검증 및 표현': 1, '보안기능': 2, '시간 및 상태': 3,
  '에러처리': 4, '코드오류': 5, '캡슐화': 6, 'API오용': 7, 'API 오용': 7,
};
const CAT_EMOJI = {
  '입력데이터 검증 및 표현': '🔍', '보안기능': '🔐', '시간 및 상태': '⏱️',
  '에러처리': '⚠️', '코드오류': '🐛', '캡슐화': '📦', 'API오용': '🔧', 'API 오용': '🔧',
};
// 약점 번호 추출(IMP-IV-01 → 1) — 분류 내 정렬
const num = (code) => { const m = String(code).match(/(\d+)\s*$/); return m ? +m[1] : 0; };

export default function TheoryList() {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const items = (libData.sources.find((s) => s.id === 'kisec2026')?.items || [])
      .filter((x) => x.id && x.id.startsWith('IMP-') && x.theory);
    const by = {};
    for (const it of items) {
      const cat = it.category || '기타';
      (by[cat] ||= []).push(it);
    }
    return Object.entries(by)
      .sort((a, b) => (CAT_ORDER[a[0]] || 99) - (CAT_ORDER[b[0]] || 99))
      .map(([cat, list]) => [cat, list.sort((x, y) => num(x.id) - num(y.id))]);
  }, []);

  const total = grouped.reduce((n, [, l]) => n + l.length, 0);

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📖</span>
          <h2 className="text-base font-bold text-primary">이론교육 (구현단계)</h2>
          <span className="ml-auto text-[10px] text-text-secondary">{total}개 약점</span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          KISEC 2026 교재 양식대로 약점별 <b>원인 · 영향 · 대응 · 진단방법</b>을 학습하세요.
        </p>
      </div>

      {/* 분류별 약점 목록 */}
      {grouped.map(([cat, list]) => (
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
