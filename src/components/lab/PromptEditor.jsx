// 프롬프트 섹션별 편집기 (lab 공용, Qwen 한국어 강제 4 섹션 포함)
//
// lab 의 추론 호출 직전 프롬프트 구조를 사용자에게 노출 + 편집 가능:
//   - 시스템 메시지 (편집 가능, default = STANDARD_SYSTEM_PROMPT)
//   - 사용자 메시지 (편집 가능, default = buildUserPrompt(question))
//   - Qwen 모델 시 추가 4 섹션:
//       · System tail KOREAN_FORCE_SYSTEM (편집 가능)
//       · User tail KOREAN_FORCE_USER (편집 가능)
//       · Assistant Seed KOREAN_ASSISTANT_SEED (편집 가능)
//       · /no_think 토큰 (토글)
//   - 최종 메시지 미리보기 (실제 모델 입력 그대로)
//   - "이 프롬프트로 전송" 버튼
//
// 백엔드 / 프론트의 applyQwenStrict 는 idempotent — PromptEditor 가 미리 적용된
// messages 를 보내도 키워드 검출(`includes('CRITICAL: 반드시 한국어')`) 로 중복 추가 차단.
//
// 사용:
//   <PromptEditor question={question} model={modelKey} running={running}
//                 onSubmit={(messages) => handleRun(messages)} />

import { useState, useEffect } from 'react';
import { STANDARD_SYSTEM_PROMPT, buildUserPrompt } from '../../lib/lab/promptBuilder';
import {
  isQwenModel,
  KOREAN_FORCE_SYSTEM, KOREAN_FORCE_USER, KOREAN_ASSISTANT_SEED, NO_THINK_TOKEN,
} from '../../lib/qwen';

export default function PromptEditor({ question, model, running, onSubmit, disabled }) {
  // ─── 기본 2 섹션 (모든 모델) ───────────────────────────
  const [system, setSystem] = useState(STANDARD_SYSTEM_PROMPT);
  const [user, setUser] = useState('');
  const [open, setOpen] = useState(true);  // 기본 펼침 (사용자 발견성 ↑)

  // ─── Qwen 추가 4 섹션 (Qwen 모델만 노출) ────────────────
  const [qSysTail, setQSysTail] = useState(KOREAN_FORCE_SYSTEM);
  const [qUserTail, setQUserTail] = useState(KOREAN_FORCE_USER);
  const [qSeed, setQSeed] = useState(KOREAN_ASSISTANT_SEED);
  const [qNoThink, setQNoThink] = useState(true);

  const isQwen = isQwenModel(model);

  // question 바뀌면 user prompt 자동 갱신 (단 사용자 수정 후엔 자동 갱신 X)
  const [userTouched, setUserTouched] = useState(false);
  useEffect(() => {
    if (!userTouched && question) {
      setUser(buildUserPrompt(question));
    }
  }, [question, userTouched]);

  // ─── 최종 messages 조립 ─────────────────────────────────
  // Qwen 모델: 사용자 편집된 강제 텍스트를 미리 합쳐 보냄. 백엔드 idempotent guard 가
  //          중복 검출하면 다시 추가하지 않음 (qSysTail 비우면 영어 응답 실험 가능).
  function buildFinalMessages() {
    const sysContent = isQwen ? (system + qSysTail) : system;
    const userContent = isQwen
      ? (user + qUserTail + (qNoThink ? `\n\n${NO_THINK_TOKEN}` : ''))
      : user;
    const msgs = [
      { role: 'system', content: sysContent },
      { role: 'user',   content: userContent },
    ];
    if (isQwen && qSeed.trim()) {
      msgs.push({ role: 'assistant', content: qSeed });
    }
    return msgs;
  }

  const finalMessages = buildFinalMessages();

  const handleSubmit = () => {
    if (!question || !user.trim() || running) return;
    onSubmit?.(finalMessages);
  };

  const handleResetSystem = () => setSystem(STANDARD_SYSTEM_PROMPT);
  const handleResetUser = () => {
    setUser(buildUserPrompt(question));
    setUserTouched(false);
  };
  const handleResetQwen = () => {
    setQSysTail(KOREAN_FORCE_SYSTEM);
    setQUserTail(KOREAN_FORCE_USER);
    setQSeed(KOREAN_ASSISTANT_SEED);
    setQNoThink(true);
  };

  return (
    <div className="rounded-xl border border-border bg-card-bg">
      {/* 헤더 — 펼침 토글 */}
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-text"
      >
        <span>🎯 프롬프트 편집기 {open && <span className="text-text-secondary font-normal">— 시스템 / 사용자 / {isQwen ? 'Qwen 강제 (4)' : '기본'}</span>}</span>
        <span className="text-text-secondary">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-border space-y-3">

          {/* 1) 시스템 메시지 / 페르소나 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-text">1️⃣ 시스템 메시지 (페르소나)</p>
              <button
                type="button"
                onClick={handleResetSystem}
                className="text-[10px] text-primary hover:underline"
              >
                기본값으로
              </button>
            </div>
            <textarea
              value={system}
              onChange={e => setSystem(e.target.value)}
              rows={6}
              className="w-full rounded px-2 py-1.5 border border-border bg-bg text-text text-[11px] font-mono leading-relaxed"
            />
            <p className="text-[10px] text-text-secondary opacity-70 mt-0.5">
              모델 역할/제약 정의. {isQwen && '아래 Qwen System tail 이 자동으로 뒤에 붙음.'}
            </p>
          </div>

          {/* 2) 사용자 메시지 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-text">2️⃣ 사용자 메시지 (문제 + 보기 + 정답)</p>
              <button
                type="button"
                onClick={handleResetUser}
                disabled={!question}
                className="text-[10px] text-primary hover:underline disabled:opacity-40"
              >
                문제로부터 재생성
              </button>
            </div>
            <textarea
              value={user}
              onChange={e => { setUser(e.target.value); setUserTouched(true); }}
              rows={8}
              placeholder={question ? '문제 자동 삽입됨' : '먼저 위에서 문항을 선택하세요'}
              className="w-full rounded px-2 py-1.5 border border-border bg-bg text-text text-[11px] font-mono leading-relaxed"
            />
          </div>

          {/* 3) Qwen 강제 4 섹션 (Qwen 모델만) */}
          {isQwen && (
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                  🔶 Qwen 한국어 강제 + 추론 모드 (편집 가능)
                </p>
                <button
                  type="button"
                  onClick={handleResetQwen}
                  className="text-[10px] text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  Qwen 기본값으로
                </button>
              </div>
              <p className="text-[10px] text-emerald-800 dark:text-emerald-300 opacity-80">
                비우면 한국어 강제 해제됨 (영어 응답 실험 등). 백엔드 자동 주입은 idempotent.
              </p>

              {/* 3-1) System tail */}
              <div>
                <p className="text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200 mb-0.5">3️⃣ System tail (KOREAN_FORCE_SYSTEM)</p>
                <textarea
                  value={qSysTail}
                  onChange={e => setQSysTail(e.target.value)}
                  rows={2}
                  className="w-full rounded px-2 py-1 border border-emerald-200 dark:border-emerald-800 bg-bg text-text text-[10.5px] font-mono leading-relaxed"
                />
              </div>

              {/* 3-2) User tail */}
              <div>
                <p className="text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200 mb-0.5">4️⃣ User tail (KOREAN_FORCE_USER)</p>
                <textarea
                  value={qUserTail}
                  onChange={e => setQUserTail(e.target.value)}
                  rows={2}
                  className="w-full rounded px-2 py-1 border border-emerald-200 dark:border-emerald-800 bg-bg text-text text-[10.5px] font-mono leading-relaxed"
                />
              </div>

              {/* 3-3) Assistant Seed */}
              <div>
                <p className="text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200 mb-0.5">5️⃣ Assistant Seed (KOREAN_ASSISTANT_SEED)</p>
                <textarea
                  value={qSeed}
                  onChange={e => setQSeed(e.target.value)}
                  rows={2}
                  className="w-full rounded px-2 py-1 border border-emerald-200 dark:border-emerald-800 bg-bg text-text text-[10.5px] font-mono leading-relaxed"
                />
              </div>

              {/* 3-4) /no_think 토글 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qNoThink}
                  onChange={e => setQNoThink(e.target.checked)}
                />
                <span className="text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200">
                  6️⃣ /no_think 토큰 활성화 ({qNoThink ? 'thinking 차단' : 'thinking 허용'})
                </span>
              </label>
            </div>
          )}

          {/* 4) 최종 메시지 미리보기 */}
          <div>
            <p className="text-[11px] font-bold text-text mb-1">📨 최종 메시지 (실제 모델 입력)</p>
            <div className="rounded border border-border bg-bg p-2 text-[10px] font-mono text-text leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
              {finalMessages.map((m, i) => (
                <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-border/50' : ''}>
                  <span className="text-primary font-bold">[{m.role}]</span>
                  {'\n'}{m.content}
                </div>
              ))}
            </div>
          </div>

          {/* 5) 전송 버튼 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={running || disabled || !question || !user.trim()}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold"
          >
            {running ? '✨ 생성 중…' : '✨ 이 프롬프트로 전송'}
          </button>
        </div>
      )}
    </div>
  );
}
