// HF Inference Providers — 비교 모드 (REBUILD22 §x Phase 4a)
//
// 같은 프롬프트로 2~6개 모델 동시 호출 → 응답 컬럼 + 자동 분석
// Stack 레이아웃 (모바일 친화) — 컬럼 세로로 쌓임

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PROMPT_PRESETS, CIRCLE,
  buildExamMessages, calcCost, usdToKrw, fmtCtx, fmtPrice, CAPABILITY_META,
} from './lib/models';
import { chat as hfChat, fetchModelCatalog } from './lib/hfClient';
import { COMPARE_PRESETS, resolvePreset, extractAnswer } from './lib/comparePresets';
import ModelCatalog from './components/ModelCatalog';
import QuestionPicker from '../../components/lab/QuestionPicker';
import ParamSliders from '../../components/lab/ParamSliders';
import PromptEditor from '../../components/lab/PromptEditor';

const TABS = [
  { id: 'exam', label: '🎓 시험' },
  { id: 'prompt', label: '💬 자유' },
];
const MAX_SLOTS = 6;

export default function HfCompare() {
  // 카탈로그
  const [catalog, setCatalog] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 입력
  const [tab, setTab] = useState('exam');
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [systemMsg, setSystemMsg] = useState('');
  const [userMsg, setUserMsg] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);  // REBUILD29 — 외부 API (HF Inference) 토큰당 과금 → 보수적 유지

  // 호출 상태 (모델별 컬럼)
  const [columns, setColumns] = useState({});  // { [modelId]: { stream, meta, done, error, status, t0, firstTokenAt } }
  const [running, setRunning] = useState(false);
  const abortsRef = useRef({});

  // 카탈로그 fetch
  useEffect(() => {
    setLoadingCatalog(true);
    fetchModelCatalog()
      .then(data => {
        setCatalog(data.models || []);
        setCacheInfo({ cacheHit: data.cacheHit, cacheAgeMs: data.cacheAgeMs, total: data.total });
      })
      .catch(e => setCatalogError(e.message || String(e)))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const selectedModels = useMemo(
    () => Array.from(selectedIds).map(id => catalog.find(m => m.id === id)).filter(Boolean),
    [selectedIds, catalog]
  );

  // REBUILD29 §19 — QuestionPicker 가 문항 로딩 담당
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setShowAnswer(false);
    setColumns({});  // 문항 바뀌면 응답 초기화
  };

  // 슬롯 토글
  const toggleSlot = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SLOTS) next.add(id);
      return next;
    });
  };
  const removeSlot = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const applyPresetGroup = (preset) => {
    const ids = resolvePreset(preset, catalog);
    setSelectedIds(new Set(ids.slice(0, MAX_SLOTS)));
  };

  function applyPromptPreset(preset) {
    setSystemMsg(preset.system);
    setUserMsg(preset.user);
  }

  // ─── 동시 호출 ───
  // REBUILD30 §18 — handleRun 이 customMessages 받게 변경 (PromptEditor 호환).
  const handleRun = async (customMessages = null) => {
    if (selectedIds.size === 0) return;

    // 메시지 구성
    let messages;
    if (customMessages) {
      messages = customMessages;
    } else if (tab === 'exam') {
      if (!question) return;
      const built = buildExamMessages(question);
      messages = [
        { role: 'system', content: built.system },
        { role: 'user',   content: built.user },
      ];
    } else {
      if (!userMsg.trim()) return;
      messages = [];
      if (systemMsg.trim()) messages.push({ role: 'system', content: systemMsg });
      messages.push({ role: 'user', content: userMsg });
    }

    // 컬럼 초기화
    const initialColumns = {};
    for (const id of selectedIds) {
      initialColumns[id] = {
        stream: '',
        meta: null,
        done: null,
        error: null,
        status: 'pending',  // pending | streaming | done | error
        t0: 0,
        firstTokenAt: 0,
      };
    }
    setColumns(initialColumns);
    setRunning(true);
    abortsRef.current = {};

    // 컬럼 갱신 헬퍼
    const updateCol = (id, patch) => {
      setColumns(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
    };

    // 모델별 promise 생성 (병렬)
    const promises = Array.from(selectedIds).map(async (modelId) => {
      const ac = new AbortController();
      abortsRef.current[modelId] = ac;
      const t0 = Date.now();
      let firstTokenAt = 0;

      updateCol(modelId, { status: 'streaming', t0 });

      try {
        const r = await hfChat({
          model: modelId,
          messages,
          temperature,
          maxTokens,
          action: 'lab_hf_chat',
          signal: ac.signal,
          onMeta: (m) => updateCol(modelId, { meta: m }),
          onText: (t) => {
            if (!firstTokenAt) firstTokenAt = Date.now() - t0;
            setColumns(prev => {
              const cur = prev[modelId] || {};
              return {
                ...prev,
                [modelId]: { ...cur, stream: (cur.stream || '') + t, firstTokenAt },
              };
            });
          },
        });
        const m = catalog.find(mm => mm.id === modelId);
        const cost = calcCost({ model: m, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
        updateCol(modelId, {
          status: 'done',
          done: {
            first_token_ms: firstTokenAt,
            latency_ms: r.serverLatencyMs || r.totalMs,
            total_ms: r.totalMs,
            input_tokens: r.inputTokens,
            output_tokens: r.outputTokens,
            output_chars: r.fullText.length,
            cost,
          },
        });
      } catch (e) {
        if (e.name !== 'AbortError') {
          updateCol(modelId, { status: 'error', error: e.message || String(e) });
        } else {
          updateCol(modelId, { status: 'error', error: '사용자 중지' });
        }
      }
    });

    await Promise.allSettled(promises);
    setRunning(false);
  };

  const handleStopAll = () => {
    Object.values(abortsRef.current).forEach(ac => { try { ac.abort(); } catch {} });
  };

  // ─── 자동 분석 ───
  const analysis = useMemo(() => {
    const dones = Object.entries(columns)
      .filter(([_, c]) => c.status === 'done')
      .map(([id, c]) => ({ id, name: catalog.find(m => m.id === id)?.name || id, ...c.done, stream: c.stream }));
    if (dones.length === 0) return null;

    const minBy = (key) => dones.reduce((a, b) => (b[key] != null && (a[key] == null || b[key] < a[key])) ? b : a, dones[0]);
    const maxBy = (key) => dones.reduce((a, b) => (b[key] != null && (a[key] == null || b[key] > a[key])) ? b : a, dones[0]);

    const fastestTtft = minBy('first_token_ms');
    const fastestTotal = minBy('latency_ms');
    const cheapest = minBy('cost');
    const longest = maxBy('output_chars');

    // 시험 모드 — 정답 일치
    const correctAnswer = tab === 'exam' && question ? question.answer : null;
    const answerMatches = correctAnswer != null
      ? dones.map(d => ({ ...d, picked: extractAnswer(d.stream), correct: extractAnswer(d.stream) === correctAnswer }))
      : null;
    const correctCount = answerMatches ? answerMatches.filter(a => a.correct).length : null;

    return {
      totalCost: dones.reduce((s, d) => s + (d.cost || 0), 0),
      count: dones.length,
      fastestTtft, fastestTotal, cheapest, longest,
      answerMatches, correctCount,
    };
  }, [columns, catalog, tab, question]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">⚖️ 비교 모드</h1>
        <div className="flex items-center gap-2">
          <Link to="/lab/hf" className="text-xs text-primary hover:underline">단일 모드</Link>
          <span className="text-text-secondary">·</span>
          <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
        </div>
      </header>

      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
        ⚖️ <b>같은 프롬프트로 2~6개 모델 동시 호출</b>해서 응답/속도/비용/정답 비교.
      </div>

      {/* 1. 추천 프리셋 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">💡 추천 프리셋</p>
        <div className="flex flex-wrap gap-1.5">
          {COMPARE_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPresetGroup(p)}
              disabled={running || loadingCatalog}
              title={p.desc}
              className="text-[11px] px-2.5 py-1 rounded-full bg-bg border border-border text-text hover:border-primary/40 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={running}
              className="text-[11px] px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 disabled:opacity-50"
            >
              ✕ 모두 해제
            </button>
          )}
        </div>
      </div>

      {/* 2. 선택된 모델 슬롯 */}
      <div className="rounded-xl border-2 border-primary/40 bg-primary-light p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-bold text-text">
            🎯 비교 슬롯 ({selectedIds.size}/{MAX_SLOTS})
          </p>
          <button
            onClick={() => setShowCatalog(s => !s)}
            disabled={running || loadingCatalog}
            className="text-[11px] px-2.5 py-1 rounded-full bg-card-bg border border-primary/40 text-primary font-semibold hover:bg-primary hover:text-white transition-colors disabled:opacity-40"
          >
            {showCatalog ? '✕ 카탈로그 닫기' : '📚 카탈로그에서 선택'}
          </button>
        </div>
        {selectedIds.size === 0 ? (
          <p className="text-[11px] text-text-secondary py-1">
            프리셋을 누르거나 카탈로그에서 모델을 선택하세요. 최대 {MAX_SLOTS}개.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedModels.map(m => (
              <span key={m.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-bg border border-primary/40">
                <span className="font-bold text-text">{m.name}</span>
                <span className="text-text-secondary opacity-60">{m.org}</span>
                <button
                  onClick={() => removeSlot(m.id)}
                  disabled={running}
                  className="text-text-secondary hover:text-red-400 ml-1 disabled:opacity-40"
                >✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. 카탈로그 (multi) */}
      {showCatalog && !loadingCatalog && catalog.length > 0 && (
        <ModelCatalog
          catalog={catalog}
          mode="multi"
          selectedIds={selectedIds}
          maxMulti={MAX_SLOTS}
          onToggle={toggleSlot}
          cacheInfo={cacheInfo}
          disabled={running}
        />
      )}
      {loadingCatalog && (
        <div className="text-center text-xs text-text-secondary py-4">📚 카탈로그 로드 중…</div>
      )}
      {catalogError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">⚠ {catalogError}</div>
      )}

      {/* 4. 모드 탭 + 입력 */}
      <div className="flex gap-1.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={running}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? 'bg-primary text-white' : 'bg-card-bg border border-border text-text hover:border-primary/40'
            } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* REBUILD29 §19 — 시험 모드: 통합 QuestionPicker */}
      {tab === 'exam' && (
        <QuestionPicker question={question} onChange={handleQuestionChange} />
      )}

      {/* REBUILD30 §18 — 비교 모드 PromptEditor.
          여러 모델 호출이지만 messages 는 1개 → 첫 선택 모델 ID 로 isQwen 판정.
          비-Qwen 모델도 한국어 강제 system 받지만 무해. */}
      {tab === 'exam' && question && selectedIds.size > 0 && (
        <PromptEditor
          question={question}
          model={Array.from(selectedIds)[0]}
          running={running}
          onSubmit={(messages) => handleRun(messages)}
        />
      )}

      {tab === 'prompt' && (
        <div className="rounded-xl border border-border bg-card-bg p-3 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-text-secondary mb-1">프리셋</label>
            <select
              onChange={e => {
                const sel = e.target.value;
                if (!sel) return;
                const [gi, pi] = sel.split(':').map(Number);
                const p = PROMPT_PRESETS[gi]?.items[pi];
                if (p) applyPromptPreset(p);
              }}
              disabled={running}
              defaultValue=""
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50"
            >
              <option value="">— 프리셋 선택 / 직접 입력 —</option>
              {PROMPT_PRESETS.map((g, gi) => (
                <optgroup key={gi} label={g.group}>
                  {g.items.map((p, pi) => <option key={pi} value={`${gi}:${pi}`}>{p.title}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-secondary mb-1">시스템 메시지 (선택)</label>
            <textarea value={systemMsg} onChange={e => setSystemMsg(e.target.value)} disabled={running} rows={2}
              placeholder="모델 역할/태도 정의…"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50 resize-y font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-secondary mb-1">사용자 메시지 *</label>
            <textarea value={userMsg} onChange={e => setUserMsg(e.target.value)} disabled={running} rows={5}
              placeholder="질문 / 지시문…"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50 resize-y font-mono" />
          </div>
        </div>
      )}

      {/* 5. 파라미터 — REBUILD30 §0.4 #4 ParamSliders 통합 */}
      <ParamSliders
        temperature={temperature}
        onTemperatureChange={setTemperature}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        disabled={running}
      />

      {/* 6. 실행 / 중지 */}
      {running ? (
        <button onClick={handleStopAll}
          className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-sm font-bold">
          ⏹ 모두 중지
        </button>
      ) : (
        <button onClick={handleRun}
          disabled={selectedIds.size === 0 || (tab === 'exam' ? !question : !userMsg.trim())}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold">
          ⚖️ {selectedIds.size}개 모델 동시 호출 (병렬)
        </button>
      )}

      {/* 7. 진행 상태 요약 */}
      {Object.keys(columns).length > 0 && (
        <div className="rounded-xl border border-border bg-card-bg p-3 space-y-1.5">
          <p className="text-xs font-bold text-text">📡 진행 상태</p>
          {Array.from(selectedIds).map(id => {
            const c = columns[id];
            const m = catalog.find(mm => mm.id === id);
            if (!c) return null;
            return (
              <div key={id} className="flex items-center gap-2 text-[11px] flex-wrap">
                <span className="w-4">{ICONS[c.status]}</span>
                <span className="font-bold text-text flex-1 truncate">{m?.name || id}</span>
                {c.done && (
                  <span className="text-text-secondary">
                    TTFT {c.done.first_token_ms}ms · 전체 {c.done.latency_ms}ms · ${c.done.cost.toFixed(6)}
                  </span>
                )}
                {c.status === 'streaming' && c.firstTokenAt > 0 && (
                  <span className="text-amber-500">스트리밍… ({c.firstTokenAt}ms 첫 토큰)</span>
                )}
                {c.status === 'error' && <span className="text-red-400">{c.error}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* 8. 자동 분석 */}
      {analysis && analysis.count >= 2 && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-1.5 text-xs">
          <p className="font-bold text-emerald-900 dark:text-emerald-200">📊 자동 분석 ({analysis.count} 응답)</p>
          <div>⚡ 가장 빠른 첫 토큰: <b>{analysis.fastestTtft?.name}</b> ({analysis.fastestTtft?.first_token_ms}ms)</div>
          <div>🏁 가장 빠른 완료: <b>{analysis.fastestTotal?.name}</b> ({analysis.fastestTotal?.latency_ms}ms)</div>
          <div>💰 가장 저렴: <b>{analysis.cheapest?.name}</b> (${analysis.cheapest?.cost?.toFixed(6)})</div>
          <div>📏 가장 긴 응답: <b>{analysis.longest?.name}</b> ({analysis.longest?.output_chars}자)</div>
          <div>💵 총 비용: <b>${analysis.totalCost.toFixed(6)}</b> ≈ {usdToKrw(analysis.totalCost).toFixed(2)}원</div>
          {analysis.correctCount != null && (
            <div className="pt-1 border-t border-emerald-200 dark:border-emerald-800">
              🎯 정답 일치 <b>{analysis.correctCount}/{analysis.count}</b>
              <div className="mt-1 space-y-0.5">
                {analysis.answerMatches.map(a => (
                  <div key={a.id} className="text-[10px] flex items-center gap-2">
                    <span>{a.correct ? '✅' : '❌'}</span>
                    <span className="font-bold text-text">{a.name}</span>
                    <span className="text-text-secondary">
                      선택: {a.picked ? CIRCLE[a.picked - 1] : '미검출'} / 정답: {CIRCLE[(question?.answer || 1) - 1]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 9. 응답 컬럼 (Stack 레이아웃) */}
      {Object.keys(columns).length > 0 && (
        <div className="space-y-3">
          {Array.from(selectedIds).map(id => {
            const c = columns[id];
            const m = catalog.find(mm => mm.id === id);
            if (!c) return null;
            return <ResponseCard key={id} model={m} col={c} />;
          })}
        </div>
      )}

      <p className="text-[11px] text-text-secondary text-center pt-4">
        REBUILD22 §x — Phase 4a 비교 모드 (Stack 레이아웃)
      </p>
    </div>
  );
}

const ICONS = {
  pending: '⏳',
  streaming: '🔄',
  done: '✅',
  error: '❌',
};

function ResponseCard({ model, col }) {
  const m = model;
  const status = col.status;
  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      status === 'done' ? 'border-emerald-500/40' :
      status === 'streaming' ? 'border-amber-500/40' :
      status === 'error' ? 'border-red-500/40' :
      'border-border'
    }`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card-bg border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span>{ICONS[status]}</span>
          <span className="font-bold text-text truncate">{m?.name || '?'}</span>
          <span className="text-[10px] text-text-secondary">{m?.org}</span>
        </div>
        {col.done && (
          <div className="text-[10px] text-text-secondary flex items-center gap-2 flex-shrink-0">
            <span>TTFT <b className="text-text">{col.done.first_token_ms}ms</b></span>
            <span>전체 <b className="text-text">{col.done.latency_ms}ms</b></span>
            <span>${col.done.cost.toFixed(6)}</span>
          </div>
        )}
      </div>
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 max-h-[50vh] overflow-y-auto">
        {status === 'error' ? (
          <p className="text-xs text-red-400">⚠ {col.error}</p>
        ) : (
          <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap leading-relaxed">
            {col.stream || (status === 'streaming' ? '응답 대기 중…' : '대기 중…')}
            {status === 'streaming' && (
              <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        )}
      </div>
    </div>
  );
}
