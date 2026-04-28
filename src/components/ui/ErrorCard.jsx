// 에러 상태 카드 — 사용자 친화적 에러 표시 + 재시도 버튼
import Card from './Card';

export default function ErrorCard({ message = '데이터를 불러오지 못했습니다.', onRetry }) {
  return (
    <Card className="text-center py-10">
      <svg className="w-12 h-12 mx-auto text-danger/60 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-sm text-text-secondary mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-all active:scale-[0.97]">
          다시 시도
        </button>
      )}
    </Card>
  );
}
