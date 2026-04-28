// 디바이스 AI 통합 훅 (REBUILD18 §7)
//
// 격리 모듈(src/labs/local-ai/) 의 inference / deviceCheck / memoryFit 을 직접 import 하여
// QuizTab AiExplanation 안에서 외부 API 와 동등한 인터페이스로 사용할 수 있게 캡슐화.
//
// 단일 모델 메모리 정책 (REBUILD18 의사결정 #7):
//   - cached 변수가 inference.js 에 모듈 전역 단일 → 이미 보장됨
//   - 다른 모델 활성화 시 disposePipe() 자동 호출

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadPipe,
  explainQuestion,
  disposePipe,
  getActiveModelSize,
  MODEL_REGISTRY,
  MODEL_META,
} from '../../../labs/local-ai/lib/inference';
import { checkDeviceAi, getMemoryInfo } from '../../../labs/local-ai/lib/deviceCheck';
import { fitVerdict } from '../../../labs/local-ai/lib/memoryFit';

export default function useDeviceAi() {
  const [device, setDevice] = useState(null);            // { supported, recommendedSize, ... }
  const [mem, setMem] = useState(null);                  // 메모리 측정 결과
  const [activeSize, setActiveSize] = useState(getActiveModelSize() || null);
  const [pipeReady, setPipeReady] = useState(!!getActiveModelSize());
  const [progress, setProgress] = useState(null);        // 다운로드/로드 진행
  const [activating, setActivating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const pipeRef = useRef(null);

  // 디바이스 점검 + 메모리 측정
  useEffect(() => {
    checkDeviceAi().then(setDevice);
    getMemoryInfo().then(setMem);
  }, []);

  // 활성화 (모델 다운로드 + WebGPU 적재). 다른 모델로 교체 시 자동 dispose
  const activate = useCallback(async (size) => {
    if (!device?.supported) {
      setError('이 디바이스에서 디바이스 AI 를 사용할 수 없습니다 (WebGPU 미지원).');
      return false;
    }
    setActivating(true);
    setError('');
    setProgress({ status: 'init', overallPercent: 0, fileCount: 0, currentFile: '', overallLoaded: 0, overallTotal: 0 });

    // 다른 모델 → 기존 dispose (싱글톤 정책)
    if (activeSize && activeSize !== size) {
      try { disposePipe(); } catch {}
      pipeRef.current = null;
      setPipeReady(false);
    }

    try {
      const pipe = await loadPipe(size, (state) => setProgress(state));
      pipeRef.current = pipe;
      setActiveSize(size);
      setPipeReady(true);
      setProgress(prev => prev ? { ...prev, status: 'ready', overallPercent: 100 } : null);
      return true;
    } catch (e) {
      setError(`모델 로드 실패: ${e.message || e}`);
      setProgress(prev => prev ? { ...prev, status: 'error' } : { status: 'error', overallPercent: 0 });
      return false;
    } finally {
      setActivating(false);
    }
  }, [device?.supported, activeSize]);

  // 메모리에서 언로드 (디스크 캐시는 유지)
  const unload = useCallback(() => {
    try { disposePipe(); } catch {}
    pipeRef.current = null;
    setActiveSize(null);
    setPipeReady(false);
  }, []);

  // 해설 생성 — 외부 API 의 startStream 과 동등한 인터페이스
  // onToken 콜백으로 토큰 단위 스트리밍 (UI 측 그대로 표시)
  const generate = useCallback(async ({ question, onToken, maxTokens = 512, temperature = 0.3 } = {}) => {
    // pipeRef.current 는 컴포넌트 재마운트 시 null 로 초기화되지만
    // inference.js 의 모듈 전역 cached 는 살아있을 수 있음
    // → loadPipe 는 cached 일치 시 첫 줄에서 즉시 반환 (다운로드 0, 동기적)
    if (!pipeRef.current) {
      const sz = activeSize || getActiveModelSize();
      if (!sz) {
        throw new Error('디바이스 모델이 활성화되지 않았습니다.');
      }
      pipeRef.current = await loadPipe(sz, () => {});
    }
    setGenerating(true);
    setError('');
    let fullText = '';
    const t0 = Date.now();
    try {
      fullText = await explainQuestion(pipeRef.current, question, {
        maxTokens, temperature,
        onToken: (t) => {
          if (onToken) onToken(t);
        },
      });
      const latencyMs = Date.now() - t0;

      // 사용량 기록 (백엔드 — 실패해도 throw X, fire-and-forget)
      try {
        await fetch('/api/usage-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            provider: `local-${activeSize}`,
            model: MODEL_REGISTRY[activeSize]?.id || activeSize,
            action: 'card_explain',
            question_id: question.id || null,
            input_tokens: 0,        // 토큰 카운트 추정 안 함 (정확치 불명)
            output_tokens: 0,
            estimated_cost: 0,
            latency_ms: latencyMs,
          }),
        });
      } catch {}

      return fullText;
    } catch (e) {
      setError(`해설 생성 실패: ${e.message || e}`);
      throw e;
    } finally {
      setGenerating(false);
    }
  }, [activeSize]);

  // 다운로드 진행 중 (락 트리거용)
  const isDownloading = activating || (
    progress?.status === 'init' ||
    progress?.status === 'downloading' ||
    progress?.status === 'assembling' ||
    progress?.status === 'initializing'
  );

  // 모델별 적합성 (메모리 fit) — UI 가 추천 모델 선정에 사용
  const verdicts = mem
    ? Object.fromEntries(
        Object.entries(MODEL_REGISTRY).map(([k, m]) => [k, fitVerdict(mem, m)])
      )
    : {};

  return {
    device, mem,
    activeSize, pipeReady,
    progress, activating, generating, isDownloading, error,
    verdicts,
    MODEL_REGISTRY, MODEL_META,
    activate, unload, generate,
  };
}
