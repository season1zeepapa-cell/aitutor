// REBUILD30 §0.4 #5 — 에러 박스 통합 컴포넌트 (2026-04-30)
//
// 3 lab (LocalGcp / ServerInfer / OllamaBridge) 의 에러 박스 마크업 통일.
// 응답 박스(answer)는 lab 별 색상이 시각 식별 역할을 해서 통합 X — 에러만 통합.
//
// 변형:
//   default — rounded-xl + p-3 (LocalGcp / OllamaBridge)
//   compact — rounded-lg + px-3 py-2 (ServerInfer 카탈로그/추론 에러)

export default function ErrorBanner({ message, icon = '⚠', variant = 'default' }) {
  if (!message) return null;
  const isCompact = variant === 'compact';
  const layout = isCompact
    ? 'rounded-lg px-3 py-2 text-[11px]'
    : 'rounded-xl p-3 text-xs';
  const palette = isCompact
    ? 'border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-900 dark:text-rose-200'
    : 'border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-200';
  return (
    <div className={`${layout} ${palette}`}>
      {icon && <span className="mr-1">{icon}</span>}
      {message}
    </div>
  );
}
