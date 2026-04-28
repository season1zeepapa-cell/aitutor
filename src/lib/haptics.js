// 진동 피드백 유틸리티 — 웹(navigator.vibrate) + 네이티브 대응
// @capacitor/haptics는 설치 시에만 동적 로드

// 정답 시 진동 — 짧고 가벼운 성공 느낌
export function vibrateCorrect() {
  if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

// 오답 시 진동 — 강하고 긴 경고 느낌
export function vibrateWrong() {
  if (navigator.vibrate) navigator.vibrate([100, 30, 100]);
}
