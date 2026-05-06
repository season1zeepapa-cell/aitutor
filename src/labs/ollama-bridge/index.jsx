// /lab/ollama-bridge 가드 + 진입점

import { useState, useEffect } from 'react';
import OllamaBridgeTester from './OllamaBridgeTester';

export default function OllamaBridgeLab() {
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    fetch('/api/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setEnabled(data?.lab_ollama_bridge_enabled === true))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-sm text-text-secondary">
        실험실 상태 확인 중…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-md mx-auto p-8 space-y-4">
        <h1 className="text-lg font-bold text-text">🖥️ 사용자 PC 추론 (Ollama) — 비활성</h1>
        <p className="text-sm text-text-secondary">
          현재 사용자 PC 추론 실험실이 비활성 상태입니다.
        </p>
        <p className="text-xs text-text-secondary opacity-70">
          관리자가 설정 → 실험실에서 <code className="px-1 bg-card-bg rounded">lab_ollama_bridge_enabled</code> 를 켜야 표시됩니다.
        </p>
        <a href="/lab" className="block text-center py-2.5 rounded-xl border border-border text-sm text-text">
          ← 실험실로
        </a>
      </div>
    );
  }

  return <OllamaBridgeTester />;
}
