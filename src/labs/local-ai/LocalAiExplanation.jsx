// 디바이스 AI(Gemma 4 E4B) 시범 화면 — Y 옵션 (REBUILD17 §8 결정)
//
// 흐름:
//  1) /api/questions?action=public&exam_id=161 으로 운전면허 문항 1건 무작위 표시
//  2) 사용자가 디바이스 AI 활성화 클릭 → 모델 다운로드 (첫 1회만, 1.5~2.7GB)
//  3) 다운로드 완료 → 자동으로 해설 생성 (스트리밍)
//  4) "다음 문항" 버튼으로 새 문항

import { useState, useEffect, useRef } from 'react';
import DeviceCheckBadge from './components/DeviceCheckBadge';
import ModelDownloadCard from './components/ModelDownloadCard';
import ModelManagerPanel from './components/ModelManagerPanel';
import { checkDeviceAi } from './lib/deviceCheck';
import { loadPipe, explainQuestion, disposePipe, getLastUsedDevice } from './lib/inference';
import { buildSinglePrompt } from './lib/prompts';
import { activateWakeLock, releaseWakeLock, attachVisibilityRetry } from './lib/wakeLock';

const CIRCLE = ['①','②','③','④','⑤'];

export default function LocalAiExplanation() {
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
  }, []);

  // 페이지 visibility 감지 — 백그라운드 진입 시 사용자 경고 표시
  useEffect(() => {
    const handler = () => setIsHidden(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // 운전면허 문항 무작위 1건 로드
  const fetchRandomQuestion = async () => {
    setLoadingQ(true);
    setError('');
    setExplanation('');
    setShowAnswer(false);
    try {
      const r = await fetch('/api/questions?action=public&exam_id=161');
      const data = await r.json();
      const list = data.questions || [];
      if (list.length === 0) throw new Error('문항이 없습니다.');
      const random = list[Math.floor(Math.random() * list.length)];
      setQuestion(random);
    } catch (e) {
      setError(`문항 로드 실패: ${e.message}`);
    } finally {
      setLoadingQ(false);
    }
  };

  useEffect(() => { fetchRandomQuestion(); }, []);

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
        maxTokens: 256,
        temperature: 0.3,
        onToken: (t) => setExplanation(prev => prev + t),
      });
    } catch (e) {
      setError(`해설 생성 실패: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // 디바이스 미지원 시 안내
  if (device && !device.supported) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold">🧪 디바이스 AI 시범</h1>
        <DeviceCheckBadge />
        <p className="text-xs text-gray-600">
          WebGPU 지원 브라우저(Chrome, Edge 등)에서 동작합니다. Safari/Firefox 는 미지원.
        </p>
        <a href="/" className="block text-center py-2 rounded-xl border border-gray-300 text-sm">홈으로</a>
      </div>
    );
  }

  const choices = question
    ? (Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices || '[]'))
    : [];

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">🧪 디바이스 AI 시범</h1>
        <a href="/" className="text-xs text-blue-600">← 홈</a>
      </header>

      <DeviceCheckBadge />

      {/* 모델 관리 패널 — 항상 노출 (접힘 상태가 기본) */}
      {device?.supported && (
        <ModelManagerPanel
          key={refreshKey}
          activeSize={pipeReady ? activeSize : null}
          pipeReady={pipeReady}
          onActivate={(s) => activate(s)}
          onUnload={unload}
          onAfterChange={() => setRefreshKey(k => k + 1)}
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

      {/* 문항 카드 */}
      {loadingQ ? (
        <p className="text-center text-sm text-gray-500 py-8">문항 로드 중…</p>
      ) : question ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">운전면허 #{question.question_number}</span>
            <button onClick={fetchRandomQuestion}
              className="text-xs text-blue-600 hover:underline">다음 문항 ↻</button>
          </div>
          <p className="text-sm font-medium leading-relaxed">{question.body}</p>
          <ul className="space-y-1.5">
            {choices.map((c, i) => (
              <li key={i} className={`flex gap-2 text-sm ${
                showAnswer && (i + 1 === question.answer || i + 1 === question.answer_extra)
                  ? 'text-green-700 font-bold' : 'text-gray-800'}`}>
                <span>{CIRCLE[i]}</span>
                <span className="flex-1">{c}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => setShowAnswer(s => !s)}
            className="text-xs text-blue-600 hover:underline">
            {showAnswer ? '정답 숨기기' : '정답 보기'}
          </button>
        </div>
      ) : null}

      {/* AI 해설 생성 버튼 */}
      {pipeReady && question && (
        <button onClick={generate} disabled={generating}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold">
          {generating ? '✨ 생성 중…' : '✨ Gemma 4 로 해설 생성'}
        </button>
      )}

      {/* 최종 입력 프롬프트 미리보기 — 디버깅/투명성 (접힘 기본) */}
      {question && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setShowPrompt(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-gray-700"
          >
            <span>🔍 최종 입력 프롬프트 보기</span>
            <span className="text-gray-500">{showPrompt ? '접기 ▲' : '펼치기 ▼'}</span>
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
              <div className="px-4 pb-3 border-t border-gray-100">
                <div className="flex items-center justify-between mt-2 mb-1">
                  <span className="text-[10px] text-gray-500">{promptText.length}자 — 모델에 그대로 전달됩니다</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(promptText)}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    📋 복사
                  </button>
                </div>
                <pre className="text-[11px] bg-gray-50 p-2 rounded whitespace-pre-wrap break-words leading-relaxed text-gray-800 max-h-72 overflow-y-auto">
{promptText}
                </pre>
              </div>
            );
          })()}
        </div>
      )}

      {/* 해설 출력 */}
      {explanation && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold text-blue-900 mb-2">📝 디바이스 AI 해설</p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      {/* 안내 */}
      <p className="text-[11px] text-gray-500 text-center pt-4">
        REBUILD17 §5 — 모바일 PWA + WebGPU + Gemma 4 시범 (격리 모듈)
      </p>
    </div>
  );
}
