// 오프라인 상태 배너 — 네트워크 끊김 시 화면 상단에 표시
import useNetwork from '../hooks/useNetwork';

export default function OfflineBanner() {
  const isOnline = useNetwork();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-danger text-white text-center text-xs font-bold py-2 safe-top">
      네트워크에 연결되어 있지 않습니다
    </div>
  );
}
