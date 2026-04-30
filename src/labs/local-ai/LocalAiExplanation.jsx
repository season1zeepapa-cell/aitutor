// 디바이스 AI 시범 화면 — Gemma 4 (E2B/E4B) WebGPU 추론
//
// 흐름:
//  1) /api/questions?action=public&exam_id=161 으로 운전면허 문항 1건 무작위 표시
//  2) 활성화 클릭 → 모델 다운로드 + WebGPU 적재 (첫 1회만)
//  3) 해설 생성 (TextStreamer 스트리밍)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBeforeUnload } from 'react-router-dom';
import DeviceCheckBadge from './components/DeviceCheckBadge';
import ModelDownloadCard from './components/ModelDownloadCard';
import ModelManagerPanel from './components/ModelManagerPanel';
import MemoryStatus from './components/MemoryStatus';
import MemoryHelpCard from './components/MemoryHelpCard';
import EngineSwitcher from './components/EngineSwitcher';
import WebllmPanel from './components/WebllmPanel';
import QuestionPicker from '../../components/lab/QuestionPicker';
import { checkDeviceAi, getMemoryInfo } from './lib/deviceCheck';
import { loadPipe, explainQuestion, disposePipe, getLastUsedDevice, MODEL_META } from './lib/inference';
import { buildSinglePrompt } from './lib/prompts';
import { activateWakeLock, releaseWakeLock, attachVisibilityRetry } from './lib/wakeLock';

const CIRCLE = ['①','②','③','④','⑤'];

export default function LocalAiExplanation() {
  const [engine, setEngine] = useState('transformers'); // REBUILD28 §11 — 엔진 선택 (transformers / webllm)
  const [mem, setMem] = useState(null);                 // 메모리 정보 — WebLLM 적합성 판정용
  const [device, setDevice] = useState(null);     // {supported, recommendedSize, reason}
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [pipeReady, setPipeReady] = useState(false);
  const [progress, setProgress] = useState(null);  // { status, overallPercent, currentFile, ... }
  const [activating, setActivating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [isHidden, setIsHidden] = useState(false);     // 페이지 백그라운드 진입 감지
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [activeSize, setActiveSize] = useState(null);  // 사용자 수동 선택한 모델 size
  const [showPrompt, setShowPrompt] = useState(false); // 최종 입력 프롬프트 미리보기 토글
  const [refreshKey, setRefreshKey] = useState(0);     // 모델 관리 패널 새로고침
  const pipeRef = useRef(null);

  // device 결과 들어오면 활성 모델을 device.recommendedSize 로 초기화
  useEffect(() => {
    if (device?.recommendedSize && !activeSize) {
      setActiveSize(device.recommendedSize);
    }
  }, [device, activeSize]);

  // 디바이스 점검
  useEffect(() => {
    checkDeviceAi().then(setDevice);
    getMemoryInfo().then(setMem);
  }, []);

  // WebLLM 적합성 — 데스크톱 + WebGPU + RAM 8GB+ (REBUILD28 §11)
  const webllmEligible = !!(
    device?.supported &&
    mem?.gpu?.adapter === 'requested' &&
    (typeof mem?.ram?.total !== 'number' || mem.ram.total >= 8)
  );

  // 페이지 visibility 감지 — 백그라운드 진입 시 사용자 경고 표시
  useEffect(() => {
    const handler = () => setIsHidden(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ─── 다운로드 중 락 ──────────────────────────────────────────────────
  // 백그라운드 다운로드는 transformers.js + 브라우저 제약상 미지원이라
  // 다운로드 진행 중엔 사용자가 페이지 떠나지 못하게 보호.
  //   1) beforeunload    — 새로고침 / 탭 닫기 / 브라우저 종료 시 경고
  //   2) popstate guard  — 브라우저 뒤로가기 차단 (현재 페이지 한 번 더 push)
  //   3) UI disabled     — 자식 컴포넌트의 액션 버튼 props.disabled 강제
  // ※ useBlocker 는 데이터 라우터(createBrowserRouter) 전용 — 우리는 BrowserRouter 라 미사용
  const isDownloading = activating || (
    progress?.status === 'init' ||
    progress?.status === 'downloading' ||
    progress?.status === 'assembling' ||
    progress?.status === 'initializing'
  );

  // (1) beforeunload — 브라우저 표준 경고 다이얼로그
  useBeforeUnload(
    useCallback((e) => {
      if (isDownloading) {
        e.preventDefault();
        e.returnValue = '';   // Chrome/Edge 호환
        return '';
      }
    }, [isDownloading])
  );

  // (2) popstate guard — 브라우저 뒤로가기 / 다른 SPA 이동 시 confirm
  useEffect(() => {
    if (!isDownloading) return;
    // 현재 위치를 history 에 한 번 더 push → buffer 만들어 popstate 가로채기 가능
    window.history.pushState(null, '', window.location.href);
    const handler = () => {
      const ok = window.confirm(
        '⚠️ 모델 다운로드가 진행 중입니다.\n페이지를 이동하면 다운로드가 중단됩니다.\n\n계속 이동하시겠습니까?'
      );
      if (ok) {
        // 사용자 OK → 한 번 더 뒤로가기로 진짜 이동
        window.history.back();
      } else {
        // 취소 → 다시 push 해서 현재 위치 유지
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isDownloading]);

  // REBUILD29 §19 — QuestionPicker 가 문항 로딩 담당
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setError('');
    setExplanation('');
    setShowAnswer(false);
  };

  // 모델 활성화 (다운로드 + 로드) — sizeOverride 지정 시 그 모델 사용
  const activate = async (sizeOverride) => {
    if (!device?.supported) return;
    const useSize = sizeOverride || activeSize || device.recommendedSize;
    setActivating(true);
    setError('');
    setProgress({ status: 'init', overallPercent: 0, fileCount: 0, currentFile: '', overallLoaded: 0, overallTotal: 0 });

    // 모델 변경 시 기존 pipe 해제
    if (sizeOverride && sizeOverride !== activeSize) {
      try { disposePipe(); } catch { /* 무시 */ }
      pipeRef.current = null;
      setPipeReady(false);
      setActiveSize(sizeOverride);
    }

    // 다운로드 동안 화면 꺼짐 방지 (Wake Lock API)
    const lockResult = await activateWakeLock();
    setWakeLockActive(lockResult.active);
    const detachVisibility = attachVisibilityRetry();

    try {
      const pipe = await loadPipe(useSize, (state) => {
        setProgress(state);
      });
      pipeRef.current = pipe;
      setPipeReady(true);
      setProgress(prev => prev ? { ...prev, status: 'ready', overallPercent: 100 } : null);
    } catch (e) {
      // catch 시 progress 를 null 로 만들지 않음 — 진행률 카드 안에 에러 상태로 통합 표시
      // 사용자가 "다 받은 뒤 처음 화면" 으로 보이는 증상 방지
      setError(`모델 로드 실패: ${e.message || e}`);
      setProgress(prev => prev
        ? { ...prev, status: 'error' }
        : { status: 'error', currentFile: '', currentPercent: 0, fileCount: 0, overallLoaded: 0, overallTotal: 0, overallPercent: 0 }
      );
    } finally {
      setActivating(false);
      detachVisibility();
      await releaseWakeLock();
      setWakeLockActive(false);
      setRefreshKey(k => k + 1);
    }
  };

  // 메모리에서 언로드
  const unload = () => {
    try { disposePipe(); } catch { /* 무시 */ }
    pipeRef.current = null;
    setPipeReady(false);
    setRefreshKey(k => k + 1);
  };

  // 해설 생성
  const generate = async () => {
    if (!pipeRef.current || !question) return;
    setGenerating(true);
    setExplanation('');
    setError('');
    try {
      const choices = Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices || '[]');
      await explainQuestion(pipeRef.current, {
        body: question.body,
        choices,
        answer: question.answer,
        answer_extra: question.answer_extra,
      }, {
        maxTokens: 2048,   // REBUILD29 — 사용자 디바이스 추론 (브라우저 WebGPU, 외부 비용 0). 잘림 방지
        temperature: 0.3,
        onToken: (t) => setExplanation(prev => prev + t),
      });
    } catch (e) {
      setError(`해설 생성 실패: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // 디바이스 미지원 시 안내 (메모리 현황 + 도움말은 그래도 표시 — 사용자가 자기 디바이스 능력 확인 + 액션)
  if (device && !device.supported) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold text-text">📱 온디바이스 모델</h1>
        <DeviceCheckBadge />
        <MemoryStatus />
        <MemoryHelpCard activeSize={null} onActivate={() => {}} onAfterChange={() => setRefreshKey(k => k + 1)} />
        <p className="text-xs text-text-secondary">
          WebGPU 지원 브라우저(Chrome, Edge 등)에서 동작합니다. Safari/Firefox 는 미지원.
        </p>
        <a href="/lab" className="block text-center py-2 rounded-xl border border-border text-sm text-text hover:bg-card-bg-hover">← 실험실로</a>
      </div>
    );
  }

  const choices = question
    ? (Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices || '[]'))
    : [];

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">📱 온디바이스 모델</h1>
        {isDownloading ? (
          <span className="text-xs text-text-secondary cursor-not-allowed" title="다운로드 중에는 이동할 수 없습니다">🔒 잠김</span>
        ) : (
          <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
        )}
      </header>

      {/* 다운로드 중 안내 배너 */}
      {isDownloading && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
          🔒 <b>모델 다운로드 진행 중</b> — 완료될 때까지 페이지를 이동하거나 새로고침하지 마세요.
          백그라운드 다운로드는 미지원이라 페이지를 떠나면 다운로드가 중단됩니다.
        </div>
      )}

      <DeviceCheckBadge />

      {/* 메모리 현황 — 항상 노출 (펼침 기본) */}
      <MemoryStatus />

      {/* REBUILD28 §11 — 엔진 선택 (transformers.js vs WebLLM) */}
      <EngineSwitcher
        engine={engine}
        onChange={setEngine}
        webllmEligible={webllmEligible}
        disabled={isDownloading || generating}
      />

      {/* 엔진 별 패널 분기 ─────────────────────────────────────── */}
      {engine === 'webllm' ? (
        <WebllmPanel question={question} />
      ) : (
        <>
          {/* 메모리 부족·주의 모델이 있을 때만 노출 — 액션 단축 + 디바이스별 가이드 */}
          <MemoryHelpCard
            activeSize={pipeReady ? activeSize : null}
            onActivate={(s) => activate(s)}
            onAfterChange={() => setRefreshKey(k => k + 1)}
            disabled={isDownloading}
          />

          {/* 모델 관리 패널 — 항상 노출 (접힘 상태가 기본) */}
          {device?.supported && (
            <ModelManagerPanel
              key={refreshKey}
              activeSize={pipeReady ? activeSize : null}
              pipeReady={pipeReady}
              onActivate={(s) => activate(s)}
              onUnload={unload}
              onAfterChange={() => setRefreshKey(k => k + 1)}
              disabled={isDownloading}
            />
          )}

          {/* 모델 활성화 / 진행률 / 에러 카드 — pipeReady 되기 전까지 표시 */}
          {!pipeReady && device?.supported && (
            <ModelDownloadCard
              size={activeSize || device.recommendedSize}
              progress={progress}
              onActivate={() => activate()}
              onSelectSize={(s) => setActiveSize(s)}
              onRetry={() => { setProgress(null); setError(''); activate(); }}
              errorMessage={error}
              isLoading={activating}
              isHidden={isHidden}
              wakeLockActive={wakeLockActive}
            />
          )}
        </>
      )}

      {/* REBUILD29 §19 — 문항 입력 (DB 선택 + 외부 붙여넣기 통합) */}
      <QuestionPicker question={question} onChange={handleQuestionChange} />


      {/* AI 해설 생성 버튼 — transformers.js 엔진일 때만 (WebLLM 은 WebllmPanel 자체 버튼 사용) */}
      {engine === 'transformers' && pipeReady && question && (
        <button onClick={generate} disabled={generating}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold">
          {generating ? '✨ 생성 중…' : `✨ ${MODEL_META[activeSize]?.label || '모델'} 로 해설 생성`}
        </button>
      )}

      {/* 최종 입력 프롬프트 미리보기 — 디버깅/투명성 (접힘 기본) */}
      {question && (
        <div className="rounded-xl border border-border bg-card-bg">
          <button
            type="button"
            onClick={() => setShowPrompt(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-text"
          >
            <span>🔍 최종 입력 프롬프트 보기</span>
            <span className="text-text-secondary">{showPrompt ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>
          {showPrompt && (() => {
            const previewQ = {
              body: question.body,
              choices: Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices || '[]'),
              answer: question.answer,
              answer_extra: question.answer_extra,
            };
            const promptText = buildSinglePrompt(previewQ);
            return (
              <div className="px-4 pb-3 border-t border-border">
                <div className="flex items-center justify-between mt-2 mb-1">
                  <span className="text-[10px] text-text-secondary">{promptText.length}자 — 모델에 그대로 전달됩니다</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(promptText)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    📋 복사
                  </button>
                </div>
                <pre className="text-[11px] bg-bg p-2 rounded whitespace-pre-wrap break-words leading-relaxed text-text max-h-72 overflow-y-auto border border-border">
{promptText}
                </pre>
              </div>
            );
          })()}
        </div>
      )}

      {/* 해설 출력 — transformers.js 엔진의 결과만 (WebLLM 은 WebllmPanel 안에서 자체 출력) */}
      {engine === 'transformers' && explanation && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4">
          <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-2">📝 온디바이스 해설</p>
          <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* 에러 — transformers.js 만 (WebLLM 은 WebllmPanel 안에서 표시) */}
      {engine === 'transformers' && error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-xs text-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {/* 안내 */}
      <p className="text-[11px] text-text-secondary text-center pt-4">
        REBUILD17 §5 / REBUILD28 §11 — WebGPU 디바이스 AI 시범 · 엔진 2종 (transformers.js + WebLLM)
      </p>
    </div>
  );
}
