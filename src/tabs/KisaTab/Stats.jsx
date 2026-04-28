// KISA 통계 대시보드 — /kisa/stats
// FEATURE_SPEC §5.4:
//   - 7대분류별 누적 정답률 (bar)
//   - 주간 학습 문항 수 (line)
//   - 복습 예정 히트맵 (간단 bar)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useKisaStats } from '../../hooks/useKisaSrs';
import { apiPost } from '../../lib/api';
import kisaTrack from '../../tracks/kisa';

// REBUILD16 R5 — 트랙 메타에서 카테고리 라벨 가져옴
const CATEGORY_LABEL = Object.fromEntries(
  Object.entries(kisaTrack.weaknessCategories).map(([k, v]) => [k, v.label])
);

export default function Stats() {
  const navigate = useNavigate();
  const { stats, loading, error } = useKisaStats();
  const [resetModal, setResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleReset = async () => {
    setResetting(true);
    setResetError('');
    try {
      const res = await apiPost('/api/kisa-review?action=reset', { scope: 'all' });
      console.info('[KISA 초기화]', res?.deleted);
      setResetModal(false);
      // 통계 재조회를 위해 페이지 새로고침
      window.location.reload();
    } catch (e) {
      setResetError(e.message || '초기화 실패');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
        <p className="font-bold text-red-700 dark:text-red-300">통계를 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  const { summary = {}, by_category = [], weekly = [], upcoming = [] } = stats || {};

  // 카테고리 데이터 — 7개 전부 표시 (미학습이면 0)
  const categoryData = Object.keys(CATEGORY_LABEL).map(key => {
    const row = by_category.find(r => r.weakness_category === key);
    return {
      name: CATEGORY_LABEL[key],
      score: row ? row.avg_score : 0,
      attempted: row ? row.attempted : 0,
    };
  });

  // 주간 데이터 — 최근 7일, 비어있는 날은 0으로 채움
  const weeklyData = fillLastNDays(7, weekly);

  // 복습 예정 — 향후 7일
  const upcomingData = fillNextNDays(7, upcoming);

  return (
    <div className="space-y-4">
      {/* 상단 요약 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <h2 className="text-base font-bold text-primary mb-2">📊 학습 통계</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatMini label="총 응시" value={summary.total_attempts || 0} unit="회" />
          <StatMini label="고유 문항" value={summary.unique_questions || 0} unit="개" />
          <StatMini label="평균 점수" value={summary.avg_score ?? 0} unit="점" />
          <StatMini label="오늘 복습" value={summary.due_today || 0} unit="개" highlight />
        </div>
      </div>

      {/* 1) 7대 분류 정답률 */}
      <ChartCard title="7대 분류별 평균 점수" height={220}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={categoryData} margin={{ top: 8, right: 8, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip content={<CategoryTooltip />} />
            <Bar dataKey="score" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2) 최근 7일 학습량 */}
      <ChartCard title="최근 7일 학습량" height={200}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <LineChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<WeeklyTooltip />} />
            <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3) 향후 7일 복습 예정 */}
      <ChartCard title="향후 7일 복습 예정" height={200}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={upcomingData} margin={{ top: 8, right: 8, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={shortDate} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<UpcomingTooltip />} />
            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 복습 바로가기 */}
      {summary.due_today > 0 && (
        <button
          onClick={() => navigate('/kisa/drill?srs=true')}
          className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          🔔 오늘 복습 {summary.due_today}개 바로 시작 →
        </button>
      )}

      <button
        onClick={() => navigate('/kisa')}
        className="w-full py-2 rounded-lg border border-border text-sm text-text-secondary"
      >
        ← 대시보드로
      </button>

      {/* ⚠ 위험 영역 — 통계 초기화 */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-3">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1 text-xs">
              <div className="font-bold text-red-700 dark:text-red-300 mb-0.5">학습 통계 초기화</div>
              <div className="text-text-secondary leading-relaxed">
                응시 기록, SRS 복습 큐, 모의고사 세션을 모두 삭제합니다. 문제 데이터와 사전 해설은 영향 없습니다. 복구 불가능.
              </div>
            </div>
          </div>
          <button
            onClick={() => { setResetModal(true); setResetError(''); }}
            className="w-full py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.98] transition-all"
          >
            🧹 모든 학습 기록 초기화
          </button>
        </div>
      </div>

      {/* 초기화 확인 모달 */}
      {resetModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card-bg rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="text-base font-bold mb-1">통계를 초기화할까요?</h3>
              <p className="text-xs text-text-secondary">
                응시 기록, 복습 큐, 모의고사 기록이 모두 삭제됩니다.<br/>
                <span className="font-bold text-red-600 dark:text-red-400">되돌릴 수 없습니다.</span>
              </p>
            </div>
            {summary && (
              <div className="text-xs text-text-secondary bg-neutral-100 dark:bg-neutral-800 rounded-lg p-2 space-y-0.5">
                <div>• 총 응시 <span className="font-bold text-text">{summary.total_attempts || 0}회</span></div>
                <div>• 고유 문항 <span className="font-bold text-text">{summary.unique_questions || 0}개</span></div>
                <div>• 오늘 복습 <span className="font-bold text-text">{summary.due_today || 0}개</span></div>
              </div>
            )}
            {resetError && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                {resetError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setResetModal(false)}
                disabled={resetting}
                className="flex-1 py-2 rounded-lg border border-border text-sm font-semibold"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {resetting ? '초기화 중...' : '초기화 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 헬퍼 컴포넌트
// ============================================================================
function StatMini({ label, value, unit, highlight }) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? 'bg-white/50 dark:bg-white/10' : 'bg-white/30 dark:bg-white/5'}`}>
      <div className="text-[10px] text-text-secondary">{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>{value}</span>
        <span className="text-[9px] text-text-secondary">{unit}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, height, children }) {
  return (
    <div className="rounded-xl bg-card-bg border border-border p-3">
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      {/* ResponsiveContainer가 초기 렌더 시 부모 width를 측정하려면
          명시적 width:100% + minWidth:0 (flex children 기본값 auto 방지) 필수 */}
      <div style={{ width: '100%', height, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, score, attempted } = payload[0].payload;
  return (
    <div className="rounded-lg bg-card-bg border border-border p-2 text-xs shadow-lg">
      <div className="font-bold">{name}</div>
      <div>평균 {score}점 · {attempted}회 응시</div>
    </div>
  );
}

function WeeklyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const { count, avg_score } = payload[0].payload;
  return (
    <div className="rounded-lg bg-card-bg border border-border p-2 text-xs shadow-lg">
      <div className="font-bold">{label}</div>
      <div>문항 {count}개</div>
      {avg_score != null && <div>평균 {avg_score}점</div>}
    </div>
  );
}

function UpcomingTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const { count } = payload[0].payload;
  return (
    <div className="rounded-lg bg-card-bg border border-border p-2 text-xs shadow-lg">
      <div className="font-bold">{label}</div>
      <div>복습 예정 {count}개</div>
    </div>
  );
}

// ============================================================================
// 날짜 유틸
// ============================================================================
function shortDate(d) {
  if (!d) return '';
  const [_, m, dd] = d.split('-');
  return `${parseInt(m)}/${parseInt(dd)}`;
}

function fillLastNDays(n, data) {
  const dataMap = new Map(data.map(r => [r.date, r]));
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    result.push(dataMap.get(key) || { date: key, count: 0, avg_score: null });
  }
  return result;
}

function fillNextNDays(n, data) {
  const dataMap = new Map(data.map(r => [r.date, r]));
  const result = [];
  for (let i = 0; i < n; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    result.push(dataMap.get(key) || { date: key, count: 0 });
  }
  return result;
}
