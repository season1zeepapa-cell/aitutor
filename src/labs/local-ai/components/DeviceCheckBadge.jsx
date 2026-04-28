// 디바이스 능력 점검 결과 배지 — 라이트/다크 테마 통일

import { useEffect, useState } from 'react';
import { getDeviceInfo } from '../lib/deviceCheck';
import { MODEL_META } from '../lib/inference';

export default function DeviceCheckBadge() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    getDeviceInfo().then(setInfo);
  }, []);

  if (!info) {
    return <div className="text-xs text-text-secondary">디바이스 점검 중…</div>;
  }

  return (
    <div className={`rounded-xl border p-3 text-xs ${info.supported
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200'
      : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200'}`}>
      <p className="font-bold mb-1">
        {info.supported ? '✅ 디바이스 AI 가능' : '⚠️ 디바이스 AI 불가'}
      </p>
      {info.supported ? (
        <>
          <p>권장 모델: <span className="font-semibold">{MODEL_META[info.recommendedSize]?.label || info.recommendedSize}</span></p>
          {info.memoryWarning && (
            <p className="mt-1 text-amber-800 dark:text-amber-300">{info.memoryWarning}</p>
          )}
        </>
      ) : (
        <p>{info.reason}</p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-text-secondary">진단 정보</summary>
        <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all text-text-secondary">
{`UA: ${info.userAgent}
deviceMemory: ${info.deviceMemory ?? '미제공'}
hardwareConcurrency: ${info.hardwareConcurrency ?? '미제공'}
platform: ${info.platform || '미제공'}`}
        </pre>
      </details>
    </div>
  );
}
