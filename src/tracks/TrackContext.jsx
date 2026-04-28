// React Context for current track — REBUILD16 R5 마무리.
// 두 번째 트랙 추가 시 트랙별 컴포넌트(Dashboard/Stats/Study/...)가
// 자신이 속한 트랙 메타를 어디서나 useTrack() 으로 받을 수 있게 함.
//
// 현재 KISA 단독 운영 단계: TrackProvider 기본값 = TRACKS.kisa.
// App.jsx 의 라우트가 trackId 를 읽어 Provider 로 감쌈.

import { createContext, useContext } from 'react';
import { TRACKS, getTrack } from './index';

const TrackContext = createContext(TRACKS.kisa);

/** 현재 트랙 메타 — 컴포넌트 어디서나 useTrack() 으로 접근 */
export function useTrack() {
  return useContext(TrackContext);
}

/** 트랙 ID 로 Provider 를 감싸는 헬퍼 */
export function TrackProvider({ trackId, children }) {
  const track = getTrack(trackId) || TRACKS.kisa;
  return <TrackContext.Provider value={track}>{children}</TrackContext.Provider>;
}

export default TrackContext;
