// LLM 사용량/비용 관리 패널 — REBUILD16 §12.2-C 후속 (UI 신설)
//
// 위치: 설정 → AI 설정 탭 (관리자만 볼 수 있음)
// API : GET /api/admin?action=llm_usage&days=N (withAdmin 보호됨)
//
// 표시 항목:
//   1) 기간 선택(7/30/90일) + 수동 새로고침
//   2) 요약 3개(총 비용 USD, 총 호출, 에러율)
//   3) 일일 비용 LineChart
//   4) Provider 별 BarChart (anthropic/openai/gemini)
//   5) Action 별 BarChart (card_explain / kisa_grade 등)
//   6) 최근 50건 테이블

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { apiGet, getAuthUser } from '../../lib/api';
import Card from '../../components/ui/Card';

// Provider → 색상 (LlmSettingsPanel 의 색상 체계와 동일, 단 DB 는 'anthropic' 사용)
const PROVIDER_COLOR = {
  anthropic: '#d97706',  // Claude
  openai:    '#10a37f',  // OpenAI
  gemini:    '#4285f4',  // Gemini
};
const PROVIDER_LABEL = {
  anthropic: 'Claude (anthropic)',
  openai:    'OpenAI',
  gemini:    'Gemini',
};

// 기간 선택지
const RANGES = [
  { days: 7,  label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
];

// 비용 포맷 — 매우 작은 값(<$0.01)은 ¢ 로 표시
function fmtCost(usd) {
  const n = Number(usd) || 0;
  if (n === 0) return '$0';
  if (n < 0.01) return `¢${(n * 100).toFixed(2)}`;
  if (n < 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

// 토큰 수 포맷 (1,234 → "1.2K")
function fmtTokens(n) {
  const x = Number(n) || 0;
  if (x < 1000) return String(x);
  if (x < 1_000_000) return `${(x / 1000).toFixed(1)}K`;
  return `${(x / 1_000_000).toFixed(1)}M`;
}

// 시간 포맷 (KST)
function fmtTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso; }
}

export default function LlmUsagePanel() {
  const user = getAuthUser();
  const isAdmin = user?.admin;

  const [days, setDays] = useState(7);
  const [refreshKey, setRefreshKey] = useState(0);    // 같은 days 로 새로고침 트리거용
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── 데이터 로드 ───
  // days 가 바뀔 때마다 새로 호출. 로딩 중에는 기존 데이터 유지(깜빡임 방지).
  useEffect(() => {
    if (!isAdmin) return;       // 관리자가 아니면 호출 자체를 스킵
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiGet(`/api/admin?action=llm_usage&days=${days}`);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e.message || '불러오기 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };  // 언마운트/days 변경 시 race condition 방지
  }, [days, refreshKey, isAdmin]);

  // 비관리자는 패널 자체를 숨김(설정탭이 이미 막지만, 컴포넌트 단독 가드)
  if (!isAdmin) return null;

  // ─── 요약 계산 ───
  // daily 행은 (날짜·provider·model) 별이므로 모두 합산해야 일일 총합이 됨
  const summary = useMemo(() => {
    if (!data) return { totalCost: 0, totalCalls: 0, totalErrors: 0 };
    let totalCost = 0, totalCalls = 0, totalErrors = 0;
    (data.byProvider || []).forEach(r => {
      totalCost  += Number(r.cost_usd || 0);
      totalCalls += Number(r.calls    || 0);
      totalErrors += Number(r.errors  || 0);
    });
    return { totalCost, totalCalls, totalErrors };
  }, [data]);

  // 일일 비용 차트용 데이터 — 같은 날짜의 provider 별 행을 하나로 합쳐 라인 차트로
  const dailySeries = useMemo(() => {
    if (!data?.daily) return [];
    const map = new Map();
    data.daily.forEach(r => {
      const key = String(r.usage_date).slice(5, 10); // MM-DD
      const prev = map.get(key) || { date: key, cost: 0, calls: 0 };
      prev.cost  += Number(r.total_cost_usd || 0);
      prev.calls += Number(r.calls          || 0);
      map.set(key, prev);
    });
    // 오래된 → 최근 순으로 정렬
    return Array.from(map.values()).reverse();
  }, [data]);

  // Provider/Action 차트용 데이터
  const providerSeries = useMemo(() => {
    if (!data?.byProvider) return [];
    return data.byProvider.map(r => ({
      provider: r.provider,
      label:    PROVIDER_LABEL[r.provider] || r.provider,
      cost:     Number(r.cost_usd || 0),
      calls:    Number(r.calls    || 0),
      errors:   Number(r.errors   || 0),
    }));
  }, [data]);

  const actionSeries = useMemo(() => {
    if (!data?.byAction) return [];
    return data.byAction.map(r => ({
      action: r.action || '(미분류)',
      cost:   Number(r.cost_usd || 0),
      calls:  Number(r.calls    || 0),
    }));
  }, [data]);

  return (
    <div className="space-y-4">
      {/* ─── 헤더: 기간 선택 + 새로고침 ─── */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-text">LLM 사용량 / 비용</p>
            <p className="text-xs text-text-secondary mt-0.5">
              관리자 전용 — `llm_usage_log` 자동 로깅 기반
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 기간 선택 칩 */}
            <div className="flex gap-1 bg-badge-bg rounded-xl p-1">
              {RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    days === r.days
                      ? 'bg-card-bg text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {/* 새로고침 — refreshKey 증분으로 useEffect 재실행 트리거 */}
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loading}
              title="새로고침"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-text-secondary hover:text-primary hover:border-primary disabled:opacity-50 transition-all"
            >
              {loading ? '⏳' : '↻'}
            </button>
          </div>
        </div>

        {/* 로딩 / 에러 표시 */}
        {loading && (
          <p className="text-xs text-text-secondary mt-3">불러오는 중…</p>
        )}
        {error && (
          <p className="text-xs text-danger mt-3">에러: {error}</p>
        )}
      </Card>

      {/* ─── 요약 3개 카드 (총 비용 / 총 호출 / 에러율) ─── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="총 비용" value={fmtCost(summary.totalCost)} sub={`${days}일 합계`} />
        <SummaryCard label="총 호출" value={summary.totalCalls.toLocaleString('ko-KR')} sub="건" />
        <SummaryCard
          label="에러율"
          value={
            summary.totalCalls > 0
              ? `${((summary.totalErrors / summary.totalCalls) * 100).toFixed(1)}%`
              : '0%'
          }
          sub={`${summary.totalErrors}건 실패`}
          danger={summary.totalErrors > 0}
        />
      </div>

      {/* ─── 일일 비용 LineChart ─── */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">📈 일일 비용 (USD)</p>
        {dailySeries.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-8">데이터가 없습니다.</p>
        ) : (
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={dailySeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v, name) => name === 'cost' ? [fmtCost(v), '비용'] : [v, '호출']}
                  contentStyle={{ fontSize: 11 }}
                />
                <Line type="monotone" dataKey="cost" stroke="#4255ff" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ─── Provider 별 비용 ─── */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">🔌 Provider 별</p>
        {providerSeries.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-8">데이터가 없습니다.</p>
        ) : (
          <>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={providerSeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="provider" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(v, name) => name === 'cost' ? [fmtCost(v), '비용'] : [v, name]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                    {/* recharts 는 <Bar> 자식으로 <Cell> 만 인식 — provider 별 색상 칠하기 */}
                    {providerSeries.map((entry, i) => (
                      <Cell key={i} fill={PROVIDER_COLOR[entry.provider] || '#999'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Provider 별 상세 표 */}
            <div className="mt-3 space-y-1.5">
              {providerSeries.map(p => (
                <div key={p.provider} className="flex items-center justify-between text-xs px-2 py-1.5 bg-badge-bg rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLOR[p.provider] || '#999' }} />
                    <span className="font-medium text-text">{p.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-text-secondary">
                    <span>{p.calls.toLocaleString('ko-KR')}건</span>
                    {p.errors > 0 && <span className="text-danger">{p.errors}실패</span>}
                    <span className="font-semibold text-text">{fmtCost(p.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ─── Action 별 비용 ─── */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">🎯 Action 별</p>
        {actionSeries.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-8">데이터가 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {actionSeries.map(a => (
              <div key={a.action} className="flex items-center justify-between text-xs px-2 py-1.5 bg-badge-bg rounded-lg">
                <span className="font-medium text-text">{a.action}</span>
                <div className="flex items-center gap-3 text-text-secondary">
                  <span>{a.calls.toLocaleString('ko-KR')}건</span>
                  <span className="font-semibold text-text">{fmtCost(a.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── 최근 50건 테이블 ─── */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">🕘 최근 50건</p>
        {(!data?.recent || data.recent.length === 0) ? (
          <p className="text-xs text-text-secondary text-center py-8">데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary border-b border-border">
                  <th className="text-left py-2 px-1 font-semibold">시간</th>
                  <th className="text-left py-2 px-1 font-semibold">Provider</th>
                  <th className="text-left py-2 px-1 font-semibold">Action</th>
                  <th className="text-right py-2 px-1 font-semibold">In/Out</th>
                  <th className="text-right py-2 px-1 font-semibold">비용</th>
                  <th className="text-right py-2 px-1 font-semibold">속도</th>
                  <th className="text-center py-2 px-1 font-semibold">결과</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map(r => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-badge-bg/40">
                    <td className="py-1.5 px-1 text-text whitespace-nowrap">{fmtTime(r.created_at)}</td>
                    <td className="py-1.5 px-1">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ backgroundColor: PROVIDER_COLOR[r.provider] || '#999' }}
                        title={r.model}
                      >
                        {r.provider}
                      </span>
                    </td>
                    <td className="py-1.5 px-1 text-text-secondary">{r.action || '-'}</td>
                    <td className="py-1.5 px-1 text-right text-text-secondary whitespace-nowrap">
                      {fmtTokens(r.input_tokens)}/{fmtTokens(r.output_tokens)}
                    </td>
                    <td className="py-1.5 px-1 text-right font-semibold text-text">{fmtCost(r.estimated_cost)}</td>
                    <td className="py-1.5 px-1 text-right text-text-secondary">
                      {r.latency_ms ? `${r.latency_ms}ms` : '-'}
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      {r.success ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-danger" title={r.error_message || ''}>✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── 작은 컴포넌트들 ───

function SummaryCard({ label, value, sub, danger }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-text-secondary mb-1">{label}</p>
      <p className={`text-lg font-bold ${danger ? 'text-danger' : 'text-text'}`}>{value}</p>
      <p className="text-[10px] text-text-secondary mt-0.5">{sub}</p>
    </Card>
  );
}

