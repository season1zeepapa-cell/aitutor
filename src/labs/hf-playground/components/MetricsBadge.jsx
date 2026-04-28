// 호출 메트릭 배지 — TTFT, 총시간, 토큰 수, 추정 비용, provider 라우팅
import { calcCost, usdToKrw, findModel } from '../lib/models';

function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export default function MetricsBadge({ result, modelId }) {
  if (!result) return null;
  const m = findModel(modelId);
  const cost = calcCost({
    model: modelId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
  const krw = usdToKrw(cost);

  // 토큰/초 (output tokens / latency)
  const tps = (result.outputTokens && result.serverLatencyMs)
    ? Math.round(result.outputTokens / (result.serverLatencyMs / 1000))
    : null;

  return (
    <div className="rounded-lg bg-card-bg border border-border p-3">
      <div className="text-xs font-semibold text-text-secondary mb-2">호출 메트릭</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Metric label="TTFT" value={fmtMs(result.ttftMs)} hint="첫 토큰까지 시간" />
        <Metric label="총 시간" value={fmtMs(result.totalMs)} hint="요청-응답 종료" />
        <Metric label="입력 토큰" value={fmtNum(result.inputTokens)} />
        <Metric label="출력 토큰" value={fmtNum(result.outputTokens)} />
        <Metric label="속도" value={tps ? `${tps} t/s` : '—'} hint="output tokens / sec" />
        <Metric label="비용 (추정)" value={`$${cost.toFixed(6)}`} hint={`≈ ${krw.toFixed(2)}원`} />
        <Metric
          label="Provider"
          value={result.meta?.id ? result.meta.id.slice(0, 12) + '…' : '—'}
          hint={result.meta?.model || ''}
          colSpan={2}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, hint, colSpan }) {
  return (
    <div className={colSpan ? `col-span-${colSpan}` : ''}>
      <div className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</div>
      <div className="text-sm font-mono text-text mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-text-secondary opacity-60 mt-0.5">{hint}</div>}
    </div>
  );
}
