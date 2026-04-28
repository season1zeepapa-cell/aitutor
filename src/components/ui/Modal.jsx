// 모달 컴포넌트 — Quizlet 스타일 + 접근성 (role, aria, 포커스 트래핑)
import { useEffect, useRef, useCallback } from 'react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const modalRef = useRef(null);

  // 포커스 트래핑: Tab 키가 모달 안에서만 순환
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  // 모달 열릴 때 포커스 이동 + 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement;
    const timer = setTimeout(() => {
      const firstBtn = modalRef.current?.querySelector('button, [href], input');
      if (firstBtn) firstBtn.focus();
    }, 50);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      if (prev && prev.focus) prev.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-4xl', full: 'max-w-full mx-2' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3 sm:px-4 pb-8 overflow-y-auto"
      onClick={onClose}
      role="presentation"
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={handleKeyDown}
        className={`relative bg-card-bg border border-border rounded-2xl w-full ${sizes[size]} shadow-lg fade-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
          <h3 id="modal-title" className="text-lg font-bold text-text truncate">{title}</h3>
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
