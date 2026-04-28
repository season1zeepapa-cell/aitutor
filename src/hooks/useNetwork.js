// 네트워크 상태 감지 훅 — Capacitor 네이티브 + 웹 브라우저 지원
import { useState, useEffect } from 'react';
import { isNative } from '../lib/capacitor';

export default function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cleanup = () => {};

    if (isNative()) {
      // 네이티브: @capacitor/network 플러그인 사용
      import('@capacitor/network').then(({ Network }) => {
        Network.getStatus().then(s => setIsOnline(s.connected));
        Network.addListener('networkStatusChange', s => setIsOnline(s.connected))
          .then(handle => { cleanup = () => handle.remove(); });
      });
    } else {
      // 웹: navigator.onLine + 이벤트 리스너
      setIsOnline(navigator.onLine);
      const goOnline = () => setIsOnline(true);
      const goOffline = () => setIsOnline(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      cleanup = () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }

    return () => cleanup();
  }, []);

  return isOnline;
}
