// 카드 컴포넌트 — Quizlet 스타일 둥근 카드
export default function Card({ children, onClick, className = '', hoverable = false }) {
  return (
    <div
      className={`bg-card-bg border border-border rounded-2xl p-4 sm:p-5 shadow-card
        ${hoverable ? 'cursor-pointer hover:bg-card-bg-hover hover:border-primary/30 hover:shadow-md active:scale-[0.98] transition-all duration-200' : ''}
        ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
