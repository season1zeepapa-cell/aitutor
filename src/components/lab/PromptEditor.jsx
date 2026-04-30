// 프롬프트 섹션별 편집기 (REBUILD29 §26 — 사용자 요청 2026-04-30)
//
// lab 의 추론 호출 직전 프롬프트 구조를 사용자에게 노출 + 편집 가능:
//   - 시스템 / 페르소나 (편집 가능, default = STANDARD_SYSTEM_PROMPT)
//   - 사용자 메시지 (편집 가능, default = buildUserPrompt(question))
//   - Assistant Seed (Qwen 한국어 강제, 자동 적용 안내)
//   - 최종 메시지 미리보기 (read-only)
//   - "이 프롬프트로 전송" 버튼 → 부모 콜백
//
// 사용:
//   <PromptEditor
//     question={question}
//     model={modelKey}
//     running={running}
//     onSubmit={(messages) => handleRun(messages)}
//   />

import { useState, useEffect } from 'react';
import { STANDARD_SYSTEM_PROMPT, buildUserPrompt } from '../../lib/lab/promptBuilder';
import { isQwenModel } from '../../lib/qwen';

export default function PromptEditor({ question, model, running, onSubmit, disabled }) {
  const [system, setSystem] = useState(STANDARD_SYSTEM_PROMPT);
  const [user, setUser] = useState('');
  const [open, setOpen] = useState(false);  // 기본 접힘 — 사용자가 펼침 클릭 시 노출

  const isQwen = isQwenModel(model);

  // question 바뀌면 user prompt 자동 갱신 (단 사용자 수정 후엔 자동 갱신 X)
  const [userTouched, setUserTouched] = useState(false);
  useEffect(() => {
    if (!userTouched && question) {
      setUser(buildUserPrompt(question));
    }
  }, [question, userTouched]);

  // ─── 최종 messages 조립 ──────────────────
  const finalMessages = [
    { role: 'system', content: system },
    { role: 'user',   content: user },
  ];
  // Assistant seed 는 applyQwenStrict 가 호출처에서 자동 추가 (이중 안전망)

  const handleSubmit = () => {
    if (!question || !user.trim() || running) return;
    onSubmit?.(finalMessages);
  };

  const handleResetSystem = () => setSystem(STANDARD_SYSTEM_PROMPT);
  const handleResetUser = () => {
    setUser(buildUserPrompt(question));
    setUserTouched(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card-bg">
      {/* 헤더 — 펼침 토글 */}
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-text"
      >
        <span>🎯 프롬프트 편집기 {open && <span className="text-text-secondary font-normal">— 섹션별 수정 가능</span>}</span>
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
              모델의 역할/제약 정의. Qwen 호출 시 한국어 강제 자동 추가됨.
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

          {/* 3) Assistant Seed (Qwen 자동) */}
          {isQwen && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-2 text-[10.5px] text-emerald-900 dark:text-emerald-200">
              <p className="font-bold">3️⃣ Assistant Seed (자동 적용)</p>
              <p className="font-mono mt-0.5">"네, 한국어로 답변드리겠습니다."</p>
              <p className="opacity-80 mt-0.5">Qwen 모델 한국어 강제 + thinking false (`/no_think`) 자동 추가됨.</p>
            </div>
          )}

          {/* 4) 최종 메시지 미리보기 */}
          <div>
            <p className="text-[11px] font-bold text-text mb-1">📨 최종 메시지 (조합 미리보기)</p>
            <div className="rounded border border-border bg-bg p-2 text-[10px] font-mono text-text leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
              {finalMessages.map((m, i) => (
                <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-border/50' : ''}>
                  <span className="text-primary font-bold">[{m.role}]</span>
                  {'\n'}{m.content}
                </div>
              ))}
              {isQwen && (
                <div className="mt-2 pt-2 border-t border-border/50 opacity-60">
                  <span className="text-emerald-600 font-bold">[assistant]</span>
                  {'\n'}네, 한국어로 답변드리겠습니다.
                  {'\n'}<span className="text-text-secondary opacity-70">(Qwen 자동 추가)</span>
                </div>
              )}
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
