// 모달 컴포넌트 — Quizlet 스타일
export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-4xl', full: 'max-w-full mx-2' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3 sm:px-4 pb-8 overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative bg-card-bg border border-border rounded-2xl w-full ${sizes[size]} shadow-lg fade-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
          <h3 className="text-lg font-bold text-text truncate">{title}</h3>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text hover:bg-badge-bg rounded-xl transition-all" aria-label="닫기">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
