// 이미지 확대 모달
// - 기본: 화면에 맞춰 전체가 보이도록 축소(object-contain)
// - 이미지 탭: 원본 크기로 확대(zoom) ↔ 화면맞춤 토글. 확대 상태에선 좌우·상하 스크롤(팬)으로 구석까지 확인.
//   가로로 긴 플로우차트(진단방법 도식 등)를 모바일 좁은 폭에서도 크게 볼 수 있다.
// - 배경 탭 또는 닫기 버튼: 닫기.
import { useState } from 'react';

export default function ImageModal({ src, alt, onClose }) {
  const [zoom, setZoom] = useState(false);
  if (!src) return null;

  const close = () => { setZoom(false); onClose(); };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm overflow-auto flex items-center justify-center p-4"
      onClick={close}
    >
      <img
        src={src}
        alt={alt || '확대 이미지'}
        onClick={(e) => { e.stopPropagation(); setZoom((z) => !z); }}
        className={
          zoom
            ? 'max-w-none cursor-zoom-out' // 원본 크기 — 부모 overflow-auto 로 스크롤(팬)
            : 'max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl fade-in cursor-zoom-in'
        }
      />

      {/* 닫기 버튼 */}
      <button
        onClick={(e) => { e.stopPropagation(); close(); }}
        className="fixed top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
        aria-label="닫기"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 안내 */}
      <span className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-[11px] pointer-events-none">
        {zoom ? '탭하면 화면맞춤 · 드래그로 이동' : '탭하면 원본 크기로 확대'}
      </span>
    </div>
  );
}
