// KISA 설계기준 실습 상세 — /kisa/practice/:id
// 번들된 kisa-practice.json(실습 13개 md 전문)을 MarkdownLite 로 렌더.
import { useParams, useNavigate } from 'react-router-dom';
import practiceData from '../../data/kisa-practice.json';
import MarkdownLite from '../../components/MarkdownLite';

export default function PracticeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const item = practiceData.items.find((it) => it.id === id);

  if (!item) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
        <p className="font-bold text-red-700 dark:text-red-300 mb-2">실습을 찾을 수 없습니다</p>
        <button onClick={() => navigate('/kisa/study?tab=practice')} className="px-3 py-1.5 rounded-lg border border-border text-xs">
          목록으로
        </button>
      </div>
    );
  }

  // 첫 # 헤더 줄은 헤더 카드에서 따로 표시하므로 본문에서 제거
  const body = item.body.replace(/^#\s+.+$/m, '').trimStart();
  // "실습 01 — 제목" → 배지("실습 01")와 제목 분리
  const titleText = item.title.replace(/^실습\s*\d+\s*[—-]\s*/, '');

  return (
    <div className="space-y-3">
      {/* 상단 네비 */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => navigate('/kisa/study?tab=practice')}
          className="text-text-secondary hover:text-text"
        >
          ← 실습 목록
        </button>
      </div>

      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
            📋 실습 {String(item.num).padStart(2, '0')}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-light text-primary">
            {item.type}
          </span>
        </div>
        <h1 className="text-base font-bold text-primary">{titleText}</h1>
        {item.source && <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">{item.source}</p>}
      </div>

      {/* 본문 (참고자료 표 + 채운 양식 + 진단 해설) */}
      <div className="rounded-xl bg-card-bg border border-border p-4">
        <MarkdownLite source={body} />
      </div>
    </div>
  );
}
