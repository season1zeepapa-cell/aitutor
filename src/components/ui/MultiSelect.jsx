// MultiSelect.jsx — 다중 선택 드롭다운 (칩 태그 방식)
// 카테고리/시험 선택에서 여러 항목을 동시에 선택 가능
import { useState, useRef, useEffect } from 'react';

export default function MultiSelect({ options, selected, onChange, placeholder = '전체', label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 항목 토글
  const toggle = (id) => {
    const strId = String(id);
    if (selected.includes(strId)) {
      onChange(selected.filter(v => v !== strId));
    } else {
      onChange([...selected, strId]);
    }
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(o => String(o.id)));
    }
  };

  // 선택된 항목 라벨
  const selectedLabels = selected
    .map(id => options.find(o => String(o.id) === id))
    .filter(Boolean);

  // 표시 텍스트
  const displayText = selected.length === 0
    ? placeholder
    : selected.length === options.length
      ? `${placeholder} (전체)`
      : selected.length <= 2
        ? selectedLabels.map(o => o.name || o.title).join(', ')
        : `${selectedLabels[0]?.name || selectedLabels[0]?.title} 외 ${selected.length - 1}개`;

  return (
    <div ref={ref} className="relative flex-1 min-w-[140px]">
      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-1 px-3 py-2.5 rounded-xl border text-sm transition-all text-left
          ${open
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border hover:border-primary/50'}
          ${selected.length > 0 ? 'bg-primary/5 text-text font-medium' : 'bg-input-bg text-muted'}`}
      >
        <span className="truncate">{displayText}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {/* 전체 선택 */}
          <label className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
            <input
              type="checkbox"
              checked={selected.length === options.length && options.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary/20"
            />
            <span className="text-sm font-medium text-primary">전체 선택</span>
          </label>

          {/* 항목 목록 */}
          {options.map(opt => (
            <label key={opt.id}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <input
                type="checkbox"
                checked={selected.includes(String(opt.id))}
                onChange={() => toggle(opt.id)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{opt.name || opt.title}</span>
            </label>
          ))}

          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">항목 없음</p>
          )}
        </div>
      )}

      {/* 선택된 칩 태그 (3개 이상일 때) */}
      {selected.length > 0 && selected.length < options.length && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedLabels.slice(0, 3).map(opt => (
            <span key={opt.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
              {opt.name || opt.title}
              <button type="button" onClick={() => toggle(opt.id)}
                className="hover:text-red-500 transition-colors">×</button>
            </span>
          ))}
          {selected.length > 3 && (
            <span className="px-2 py-0.5 rounded-full bg-muted/10 text-muted text-xs">
              +{selected.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
