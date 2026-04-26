// Wake Lock API — 다운로드 중 화면 꺼짐 방지
// iOS Safari 16.4+, Android Chrome, Edge 등 지원

let lock = null;

export async function activateWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return { active: false, reason: 'Wake Lock API 미지원' };
  }
  try {
    lock = await navigator.wakeLock.request('screen');
    // 사용자가 백그라운드 갔다 돌아올 때 lock 이 자동 해제될 수 있음 — 재요청 핸들러
    lock.addEventListener('release', () => { lock = null; });
    return { active: true };
  } catch (err) {
    return { active: false, reason: err.message };
  }
}

export async function releaseWakeLock() {
  if (lock) {
    try { await lock.release(); } catch { /* 무시 */ }
    lock = null;
  }
}

/** visibility 가 active 로 돌아올 때 자동 재요청 */
export function attachVisibilityRetry() {
  const handler = async () => {
    if (document.visibilityState === 'visible' && !lock) {
      await activateWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
