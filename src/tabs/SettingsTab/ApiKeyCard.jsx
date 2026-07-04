// AI API 키 설정 카드 — DB 기반 BYOK (REBUILD67)
//
// 역할·모드에 따라 자동으로 다르게 렌더링:
//   · 관리자        → [전체/개인] 토글 + 3개 프로바이더 키 입력(공용/본인 키)
//   · 회원 + 전체모드 → "관리자 공용 키 사용 중" 안내 (입력칸 없음)
//   · 회원 + 개인모드 → 3개 프로바이더 키 입력 (본인 키)
//
// 보안: 서버는 키 원문을 절대 돌려주지 않는다. 존재 여부(hasKey)와 마스킹(masked)만 표시.

import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import { apiGet, apiPost } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

// 프로바이더 메타 — 라벨/색상/입력 힌트(키 접두사)
const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4', placeholder: 'AIza… (Google AI Studio 키)' },
  { key: 'openai', label: 'OpenAI', color: '#10a37f', placeholder: 'sk-… (OpenAI API 키)' },
  { key: 'claude', label: 'Claude', color: '#d97706', placeholder: 'sk-ant-… (Anthropic API 키)' },
];

export default function ApiKeyCard() {
  const toast = useToast();
  const [data, setData] = useState(null);            // { mode, isAdmin, providers, encReady }
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({ gemini: '', openai: '', claude: '' });
  const [busy, setBusy] = useState(null);            // 작업 중인 키(provider) 또는 'mode'

  // ── 1단계: 서버에서 현재 상태 로드 ──
  const load = () => {
    setLoading(true);
    apiGet('/api/ai-keys')
      .then(d => setData(d))
      .catch(err => toast('AI 키 설정 로드 실패: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return <Card><p className="text-xs text-text-secondary py-2">불러오는 중…</p></Card>;
  }
  if (!data) return null;

  const { mode, isAdmin, providers, encReady } = data;

  // ── 2단계: 관리자 전용 — 전체/개인 모드 전환 ──
  const changeMode = async (next) => {
    if (next === mode) return;
    if (next === 'individual' &&
        !confirm('개인 모드로 바꾸면 모든 회원의 저장된 키가 초기화되고, 회원들이 각자 키를 다시 입력해야 합니다.\n계속할까요?')) {
      return;
    }
    setBusy('mode');
    try {
      const res = await apiPost('/api/ai-keys', { action: 'set_mode', mode: next });
      setData(prev => ({ ...prev, ...res }));
      toast(next === 'shared' ? '전체(공용) 모드로 전환됨' : '개인 모드로 전환됨 (회원 키 초기화)', 'success');
    } catch (err) {
      toast('모드 변경 실패: ' + err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  // ── 3단계: 키 저장 / 삭제 ──
  const saveKey = async (provider) => {
    const key = (inputs[provider] || '').trim();
    if (!key) { toast('키를 입력해 주세요.', 'error'); return; }
    setBusy(provider);
    try {
      const res = await apiPost('/api/ai-keys', { action: 'set_key', provider, key });
      setData(prev => ({ ...prev, ...res }));
      setInputs(prev => ({ ...prev, [provider]: '' }));   // 입력칸 비움 (원문 화면 잔류 방지)
      toast('키가 저장되었습니다.', 'success');
    } catch (err) {
      toast('저장 실패: ' + err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const clearKey = async (provider) => {
    if (!confirm('저장된 키를 삭제할까요?')) return;
    setBusy(provider);
    try {
      const res = await apiPost('/api/ai-keys', { action: 'clear_key', provider });
      setData(prev => ({ ...prev, ...res }));
      toast('키가 삭제되었습니다.', 'success');
    } catch (err) {
      toast('삭제 실패: ' + err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  // 회원 + 전체모드 → 입력 불필요 (공용 키 사용 안내만)
  const showInputs = isAdmin || mode === 'individual';

  const inputClass = 'flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all';

  return (
    <Card>
      <p className="text-sm font-bold text-text mb-1">🔑 AI API 키</p>
      <p className="text-xs text-text-secondary mb-3 leading-relaxed">
        {isAdmin
          ? '외부 LLM(Gemini·OpenAI·Claude) 호출에 쓰이는 API 키를 관리합니다. 키는 암호화되어 서버에 저장되며 화면에는 마스킹만 표시됩니다.'
          : '내가 사용할 AI API 키를 입력합니다. 키는 암호화되어 서버에 저장되고, 화면에는 마스킹만 표시됩니다.'}
      </p>

      {/* 암호화 비밀키 미설정 경고 (관리자에게만) */}
      {isAdmin && !encReady && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-danger/30">
          <p className="text-[11px] text-danger leading-relaxed">
            ⚠️ 서버에 <code>API_KEY_ENC_SECRET</code>(또는 <code>AUTH_TOKEN_SECRET</code>)가 설정되지 않아
            키를 암호화할 수 없습니다. 배포 환경 변수에 비밀키를 먼저 설정해 주세요.
          </p>
        </div>
      )}

      {/* ── 관리자 전용: 전체/개인 토글 ── */}
      {isAdmin && (
        <div className="mb-4">
          <div className="flex gap-1 bg-badge-bg rounded-xl p-1">
            {[
              { v: 'shared', label: '전체 (공용 키)' },
              { v: 'individual', label: '개인 (각자 입력)' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => changeMode(opt.v)}
                disabled={busy === 'mode'}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                  mode === opt.v ? 'bg-card-bg text-primary shadow-sm' : 'text-text-secondary hover:text-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-secondary mt-2 leading-relaxed">
            {mode === 'shared'
              ? '🟢 전체 모드 — 아래 관리자 키가 모든 회원에게 일괄 적용됩니다.'
              : '🔵 개인 모드 — 아래 키는 관리자 본인만 사용하고, 다른 회원은 각자 키를 입력합니다.'}
          </p>
        </div>
      )}

      {/* ── 회원 + 전체모드: 공용 키 사용 안내 ── */}
      {!showInputs && (
        <div className="px-3 py-3 rounded-xl bg-badge-bg">
          <p className="text-xs text-text-secondary leading-relaxed">
            현재 <strong className="text-text">공용 키 모드</strong>입니다. 관리자가 설정한 키가 자동 적용되므로
            별도로 입력할 필요가 없습니다.
          </p>
        </div>
      )}

      {/* ── 키 입력 목록 ── */}
      {showInputs && (
        <div className="space-y-3">
          {PROVIDERS.map(p => {
            const st = providers[p.key] || {};
            const isBusy = busy === p.key;
            return (
              <div key={p.key} className="px-3 py-3 bg-badge-bg rounded-xl">
                {/* 상태 줄: 라벨 + 등록 여부 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: p.color }}>{p.label}</span>
                  {st.hasKey ? (
                    <span className="text-[11px] font-mono text-text-secondary">
                      ✅ {st.masked}
                    </span>
                  ) : (
                    <span className="text-[11px] text-danger font-semibold">미설정</span>
                  )}
                </div>
                {/* 입력 줄 */}
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={inputs[p.key]}
                    onChange={e => setInputs(prev => ({ ...prev, [p.key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveKey(p.key)}
                    placeholder={st.hasKey ? '새 키로 교체하려면 입력' : p.placeholder}
                    disabled={isBusy}
                    className={inputClass}
                  />
                  <button
                    onClick={() => saveKey(p.key)}
                    disabled={isBusy || !inputs[p.key].trim()}
                    className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    저장
                  </button>
                  {st.hasKey && (
                    <button
                      onClick={() => clearKey(p.key)}
                      disabled={isBusy}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-danger border border-danger/20 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[10.5px] text-text-secondary leading-relaxed">
            💡 키가 없는 LLM은 사용 시 "키가 설정되지 않았습니다" 안내가 표시됩니다. 키가 있으면 해당 키로 정상 동작합니다.
          </p>
        </div>
      )}
    </Card>
  );
}
