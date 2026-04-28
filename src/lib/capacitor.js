// Capacitor 플랫폼 감지 유틸리티
// 웹/iOS/Android 환경을 구분하여 네이티브 기능 분기 처리
import { Capacitor } from '@capacitor/core';

// 네이티브 플랫폼 여부 (iOS 또는 Android)
export function isNative() {
  return Capacitor.isNativePlatform();
}

// 현재 플랫폼 ('web' | 'ios' | 'android')
export function getPlatform() {
  return Capacitor.getPlatform();
}
