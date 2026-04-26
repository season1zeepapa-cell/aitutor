// /lab/local-ai 라우트 진입점
//
// 가드: /api/config 의 lab_local_ai_enabled === true 일 때만 LocalAiExplanation 마운트
// 격리 원칙: 기존 src/pages, src/tabs, src/components, src/lib 코드 import 0건

import { useState, useEffect } from 'react';
import LocalAiExplanation from './LocalAiExplanation';

export default function LocalAiLab() {
  const [enabled, setEnabled] = useState(null);     // null=로딩, true/false 확정

  useEffect(() => {
    fetch('/api/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setEnabled(data?.lab_local_ai_enabled === true))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-sm text-gray-500">
        실험실 상태 확인 중…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-md mx-auto p-8 space-y-4">
        <h1 className="text-lg font-bold">🧪 실험실 — 비활성</h1>
        <p className="text-sm text-gray-600">
          현재 실험실(디바이스 AI) 기능이 비활성 상태입니다.
        </p>
        <p className="text-xs text-gray-500">
          관리자가 설정 → 회원관리 → 시스템 설정에서 활성화할 수 있습니다.
        </p>
        <a href="/" className="block text-center py-2.5 rounded-xl border border-gray-300 text-sm">
          홈으로
        </a>
      </div>
    );
  }

  return <LocalAiExplanation />;
}
