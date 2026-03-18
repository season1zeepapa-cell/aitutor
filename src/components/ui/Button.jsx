// 버튼 컴포넌트 — Quizlet 스타일
export default function Button({ children, variant = 'primary', size = 'md', disabled, onClick, className = '', type = 'button' }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-primary hover:bg-primary-hover text-white focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-badge-bg hover:bg-card-bg-hover text-text border border-border focus:ring-border',
    danger: 'bg-danger hover:bg-danger-hover text-white focus:ring-danger/50',
    ghost: 'bg-transparent hover:bg-badge-bg text-text-secondary hover:text-text focus:ring-border',
    gradient: 'btn-gradient focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
