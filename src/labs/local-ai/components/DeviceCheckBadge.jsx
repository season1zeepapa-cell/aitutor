// 디바이스 능력 점검 결과 배지
// 격리 모듈 — 기존 컴포넌트 의존 0 (Tailwind 만 사용)

import { useEffect, useState } from 'react';
import { getDeviceInfo } from '../lib/deviceCheck';

export default function DeviceCheckBadge() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    getDeviceInfo().then(setInfo);
  }, []);

  if (!info) {
    return <div className="text-xs text-gray-500">디바이스 점검 중…</div>;
  }

  return (
    <div className={`rounded-xl border p-3 text-xs ${info.supported
      ? 'border-green-200 bg-green-50 text-green-900'
      : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <p className="font-bold mb-1">
        {info.supported ? '✅ 디바이스 AI 가능' : '⚠️ 디바이스 AI 불가'}
      </p>
      {info.supported ? (
        <>
          <p>권장 모델: <span className="font-semibold">Gemma 4 {info.recommendedSize?.toUpperCase()}</span></p>
          {info.memoryWarning && (
            <p className="mt-1 text-amber-800">{info.memoryWarning}</p>
          )}
        </>
      ) : (
        <p>{info.reason}</p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-gray-600">진단 정보</summary>
        <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all">
{`UA: ${info.userAgent}
deviceMemory: ${info.deviceMemory ?? '미제공'}
hardwareConcurrency: ${info.hardwareConcurrency ?? '미제공'}
platform: ${info.platform || '미제공'}`}
        </pre>
      </details>
    </div>
  );
}
