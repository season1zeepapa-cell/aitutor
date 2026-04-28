// 트랙 레지스트리 — REBUILD16 §10 Stage 2 (R5)
// 신규 트랙 추가 시: src/tracks/{trackId}.js 생성 후 여기 등록.
//
// 사용 예:
//   import { TRACKS, getTrack } from '@/tracks';
//   const meta = getTrack('kisa');

import kisa from './kisa';

export const TRACKS = {
  kisa,
};

/** trackId → 메타 (없으면 undefined) */
export function getTrack(id) {
  return TRACKS[id];
}

/** 등록된 모든 trackId 배열 (라우팅·관리 UI 등에서 사용) */
export const TRACK_IDS = Object.keys(TRACKS);

export default TRACKS;
