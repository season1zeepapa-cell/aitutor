// REBUILD30 §0.4 — 실험실 공통 모델 카탈로그 중앙화 (2026-04-30)
//
// 이전: LocalGcpTester / ServerInferTester 가 각각 동일 4모델 정의 → 동기화 위험.
// 변경: 단일 출처. 두 lab 이 import 로 사용.
//
// 주의: ServerInfer 는 격리 service /infer/models 응답을 동적 로딩하므로
// 본 상수는 fallback (네트워크 실패 시) 역할로만 쓰이고,
// LocalGcp 는 일심동체 컨테이너의 고정 카탈로그라 본 상수를 그대로 사용.
//
// 모델 시리즈: REBUILD29 §24 — Qwen 3.5 + Gemma 4 통일

export const LAB_MODELS = [
  { key: 'qwen35-2b',   name: 'Qwen 3.5 2B',   org: 'Alibaba', size: '~1.6GB', note: '경량 / 한국어 강' },
  { key: 'qwen35-4b',   name: 'Qwen 3.5 4B',   org: 'Alibaba', size: '~2.5GB', note: '균형 / 한국어 강 / 추천' },
  { key: 'gemma4-e2b',  name: 'Gemma 4 E2B',   org: 'Google',  size: '~3.2GB', note: '효율적 멀티모달 / 128K' },
  { key: 'gemma4-e4b',  name: 'Gemma 4 E4B',   org: 'Google',  size: '~4.9GB', note: 'Gemma 패밀리 / 멀티모달' },
];

export const DEFAULT_MODEL_KEY = 'qwen35-4b';
