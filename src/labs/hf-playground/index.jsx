// /lab/hf 라우트 진입점 (HF Inference Providers)
//
// 가드: /api/config 의 lab_hf_enabled === true 일 때만 마운트
// (기본 false — 관리자가 명시적으로 활성화).
// 격리 원칙: 기존 src/pages, src/tabs, src/components, src/lib 코드 import 0건

import { useState, useEffect } from 'react';
import HfPlayground from './HfPlayground';

export default function HfLab() {
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    fetch('/api/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setEnabled(data?.lab_hf_enabled === true))
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
          HF 실험실이 비활성화되어 있습니다.
        </p>
        <p className="text-[11px] text-text-secondary mt-2">
          관리자가 <code className="px-1 bg-card-bg rounded">lab_hf_enabled</code> 설정을 켜야 표시됩니다.
        </p>
      </div>
    );
  }

  return <HfPlayground />;
}
