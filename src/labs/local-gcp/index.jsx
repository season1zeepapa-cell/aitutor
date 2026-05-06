// /lab/local-gcp 진입점 (서버 통합 매장 로컬 AI)
// 가드: lab_local_lambda_enabled === true && admin
//   ※ DB 토글 키는 호환성을 위해 그대로 유지 (관리자가 옮길 필요 X)
import { useEffect, useState } from 'react';
import LocalGcpTester from './LocalGcpTester';

function getAuthUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function LocalGcpLab() {
  const [enabled, setEnabled] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getAuthUser());
    fetch('/api/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setEnabled(data?.lab_local_lambda_enabled === true))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (enabled === false) {
    return (
      <div className="max-w-md mx-auto p-6 mt-12 text-center">
        <p className="text-sm text-text-secondary">
          서버 통합 실험실이 비활성화되어 있습니다.
        </p>
        <p className="text-[11px] text-text-secondary mt-2">
          관리자가 <code className="px-1 bg-card-bg rounded">lab_local_lambda_enabled</code> 설정을 켜야 표시됩니다.
        </p>
      </div>
    );
  }
  if (!user || !user.admin) {
    return (
      <div className="max-w-md mx-auto p-6 mt-12 text-center">
        <p className="text-sm text-text-secondary">관리자 전용 페이지입니다.</p>
        <a href="/lab" className="inline-block mt-3 text-xs text-primary hover:underline">← 실험실</a>
      </div>
    );
  }
  return <LocalGcpTester />;
}
