// /lab/hf/compare 진입점 (REBUILD22 §x Phase 4a)
import { useState, useEffect } from 'react';
import HfCompare from './HfCompare';

export default function HfCompareLab() {
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
        <p className="text-sm text-text-secondary">HF 실험실이 비활성화되어 있습니다.</p>
      </div>
    );
  }
  return <HfCompare />;
}
