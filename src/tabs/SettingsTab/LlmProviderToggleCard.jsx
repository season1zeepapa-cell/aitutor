// REBUILD18 §11 후속 — LLM 프로바이더 활성화 토글 (관리자 전용)
//
// 4개 프로바이더 (Gemini / OpenAI / Claude / 온디바이스 AI) 를 글로벌하게 활성/비활성.
// 비활성 시 카드 학습의 AI 해설 탭에서 해당 버튼이 숨겨짐.
//
// 저장 위치: aitutor_settings DB 테이블 (signup_disabled 와 동일 패턴)
//   - api/admin.js 의 ALLOWED_SETTING_KEYS 화이트리스트로 보호
//   - api/config.js 가 공개 노출 → 모든 사용자 페이지에 30초 내 전파
//   - 관리자가 OFF 토글 → 즉시 DB 반영 → 사용자 화면 새로고침 시 버튼 사라짐

import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import { apiGet, apiPost } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

const PROVIDERS = [
  {
    key: 'provider_gemini_enabled',
    label: 'Gemini',
    color: '#4285f4',
    desc: 'Google Gemini API — 외부 호출 (사용량 비용 발생)',
  },
  {
    key: 'provider_openai_enabled',
    label: 'OpenAI',
    color: '#10a37f',
    desc: 'OpenAI API — 외부 호출 (사용량 비용 발생)',
  },
  {
    key: 'provider_claude_enabled',
    label: 'Claude',
    color: '#d97706',
    desc: 'Anthropic Claude API — 외부 호출 (사용량 비용 발생)',
  },
  {
    key: 'provider_local_enabled',
    label: '📱 온디바이스 AI',
    color: '#16a34a',
    desc: 'WebGPU 브라우저 추론 (Gemma 4 / Qwen 3.5) — 외부 전송 0, 비용 0',
  },
];

export default function LlmProviderToggleCard() {
  const toast = useToast();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    apiGet('/api/admin?action=get_settings')
      .then(data => setSettings(data.settings || []))
      .catch(err => toast('LLM 설정 로드 실패: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  // default true — DB 미설정 시 활성으로 간주 (외부 모델은 운영 중이라 안전한 기본값)
  const getBool = (key) => {
    const row = settings.find(s => s.key === key);
    if (!row) return true;
    return row.value === 'true';
  };

  const enabledCount = PROVIDERS.filter(p => getBool(p.key)).length;

  const toggle = async (key, label) => {
    const next = !getBool(key);
    // 마지막 1개 비활성화 차단 — AI 해설 자체 불가능해짐
    if (!next && enabledCount === 1) {
      toast('최소 1개 프로바이더는 활성 상태여야 합니다.', 'error');
      return;
    }
    setSaving(key);
    try {
      await apiPost('/api/admin', { action: 'set_setting', key, value: String(next) });
      setSettings(prev => {
        const idx = prev.findIndex(s => s.key === key);
        if (idx === -1) return [...prev, { key, value: String(next), updated_at: new Date().toISOString() }];
        const copy = [...prev];
        copy[idx] = { ...copy[idx], value: String(next), updated_at: new Date().toISOString() };
        return copy;
      });
      toast(`${label} ${next ? '활성화' : '비활성화'}`, 'success');
    } catch (err) {
      toast('변경 실패: ' + err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <p className="text-sm font-bold text-text mb-1">🎛 AI 해설 프로바이더 토글</p>
      <p className="text-xs text-text-secondary mb-3 leading-relaxed">
        카드 학습의 "AI 해설" 탭에 노출되는 프로바이더 버튼을 글로벌하게 켜고 끕니다.
        비활성 시 모든 사용자에게 즉시 적용 (캐시 30초 내).
        외부 3개 끄면 비용 절감, 온디바이스 AI 끄면 디바이스 추론 비활성.
      </p>

      {loading ? (
        <p className="text-xs text-text-secondary py-2">불러오는 중…</p>
      ) : (
        <div className="space-y-2">
          {PROVIDERS.map(p => {
            const enabled = getBool(p.key);
            const isSaving = saving === p.key;
            return (
              <div key={p.key} className="flex items-center justify-between px-3 py-2.5 bg-badge-bg rounded-xl">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-medium" style={{ color: enabled ? p.color : 'var(--text-secondary)' }}>
                    {p.label}
                    {enabled
                      ? <span className="ml-1.5 text-[10px] text-text-secondary">활성</span>
                      : <span className="ml-1.5 text-[10px] text-danger font-bold">비활성</span>}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
                <button
                  onClick={() => toggle(p.key, p.label)}
                  disabled={isSaving}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
                    enabled ? 'bg-primary' : 'bg-border'
                  }`}
                  aria-label={enabled ? `${p.label} 비활성화` : `${p.label} 활성화`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
        <p className="text-[11px] font-bold text-text">📌 사용 시나리오</p>
        <ul className="text-[10.5px] text-text-secondary space-y-0.5 list-disc pl-4 leading-relaxed">
          <li>외부 API 비용 임계 초과 시 — Gemini/OpenAI/Claude 끄고 온디바이스 AI 만 운영</li>
          <li>API 키 만료 / 장애 시 — 해당 프로바이더만 임시 비활성</li>
          <li>온디바이스 AI 검증 미완료 시 — 비활성 유지 후 사용자 노출 차단</li>
          <li>모든 프로바이더 끄기는 차단됨 (최소 1개 활성 강제)</li>
        </ul>
      </div>

      <p className="text-[10px] text-text-secondary mt-2 italic">
        ⚠️ 비활성 후 30초 동안 일부 사용자는 캐시된 구버전 노출 가능 (`/api/config` 30초 in-memory cache).
      </p>
    </Card>
  );
}
