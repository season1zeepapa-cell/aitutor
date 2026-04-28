// KISA 대시보드 (/kisa)
// 설계단계 / 구현단계 탭 기반으로 카테고리와 정답률을 분리 표시
// REBUILD16 R5 — 단계별 카테고리는 src/tracks/kisa.js 에서 가져옴 (단일 진실 공급원)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKisaStats } from '../../hooks/useKisaSrs';
import { useTutorial } from '../../App';
import kisaTrack from '../../tracks/kisa';

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading } = useKisaStats();
  const { openGuide } = useTutorial();
  const [activeStage, setActiveStage] = useState('design');  // 'design' | 'implementation'

  const summary = stats?.summary || { weekly_count: 0, avg_score: 0, due_today: 0 };
  // by_category는 stage 구분 없이 합산되어 있음 — 실제로는 별도 API 필요하지만
  // 현재는 카테고리 정답률을 단계별 카테고리 정의 + stats 매핑으로 구성
  const byCategoryMap = new Map((stats?.by_category || []).map(r => [r.weakness_category, r]));

  const categories = kisaTrack.stages[activeStage]?.categories || [];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="rounded-xl bg-primary-light p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🛡️</span>
          <h2 className="text-base font-bold text-primary flex-1">KISA 진단원 이수시험</h2>
          <button
            onClick={() => openGuide('kisa')}
            className="text-[11px] px-2 py-1 rounded-full bg-card-bg border border-primary/40 text-primary font-semibold hover:bg-primary hover:text-white transition-colors"
            aria-label="KISA 학습 가이드 열기"
          >
            ❓ 가이드
          </button>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          이론 60분 30문항(설계+구현 MCQ) · 실기 100분 15문항(구현 서술형) · 종합 70점 합격
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="이번주 문항" value={summary.weekly_count || 0} unit="개" loading={loading} />
        <StatCard label="평균 점수"   value={summary.avg_score ?? 0}     unit="점" loading={loading} />
        <StatCard label="오늘 복습"   value={summary.due_today || 0}     unit="개" loading={loading} highlight />
      </div>

      {/* 시작 버튼 — 학습/MCQ/단답형/실기/실전/통계 */}
      <div className="grid grid-cols-2 gap-2">
        <StartButton
          title="📖 학습 자료"
          desc="69개 챕터 개념·코드 예시"
          emoji="📖"
          onClick={() => navigate('/kisa/study')}
          highlight
        />
        <StartButton
          title="이론 드릴 (MCQ)"
          desc="객관식 4지선다"
          emoji="🎯"
          onClick={() => navigate('/kisa/drill?type=mcq')}
        />
        <StartButton
          title="단답형 드릴"
          desc="빈칸 채우기 138문제"
          emoji="✍️"
          onClick={() => navigate('/kisa/drill?type=blank')}
        />
        <StartButton
          title="실기 드릴"
          desc="코드 진단 4단계"
          emoji="🧪"
          onClick={() => navigate('/kisa/drill?type=diagnosis4')}
        />
        <StartButton
          title="실전 모의"
          desc="이론 60분/실기 100분"
          emoji="⏱️"
          onClick={() => navigate('/kisa/exam')}
        />
        <StartButton
          title="통계 보기"
          desc="진도·약점 분석"
          emoji="📊"
          onClick={() => navigate('/kisa/stats')}
        />
        <StartButton
          title="오답 노트"
          desc="틀린 문항 모음"
          emoji="📝"
          onClick={() => navigate('/kisa/wrong-notes')}
        />
      </div>

      {/* SRS 복습 알림 */}
      {summary.due_today > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span>🔔</span>
            <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
              복습 예정 {summary.due_today}개
            </span>
          </div>
          <button
            onClick={() => navigate('/kisa/drill?srs=true')}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:opacity-90"
          >
            지금 복습하기 →
          </button>
        </div>
      )}

      {/* ⭐ 단계 탭 선택 */}
      <div className="rounded-xl bg-card-bg p-3 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-bold">📚 카테고리별 학습</h3>
          <span className="text-[10px] text-text-secondary">단계를 선택하세요</span>
        </div>

        {/* 단계 탭 */}
        <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 mb-3">
          <StageTab
            active={activeStage === 'design'}
            onClick={() => setActiveStage('design')}
            label="📐 설계단계"
            subtitle="20개 항목"
          />
          <StageTab
            active={activeStage === 'implementation'}
            onClick={() => setActiveStage('implementation')}
            label="🔧 구현단계"
            subtitle="49개 항목"
          />
        </div>

        {/* 단계 설명 */}
        <p className="text-[10px] text-text-secondary mb-2">
          {activeStage === 'design'
            ? '설계 요구사항·원칙 기반 MCQ 위주. 이론시험 대비.'
            : '취약 코드 진단 + 이론 MCQ. 실기·이론시험 둘 다 대비.'}
        </p>

        {/* 카테고리별 정답률 (현재 단계 기준) */}
        <div className="space-y-1.5 mb-3">
          {categories.map(c => {
            const row = byCategoryMap.get(c.key);
            const avg = row?.avg_score ?? 0;
            const attempted = row?.attempted ?? 0;
            return (
              <div key={c.key} className="flex items-center gap-2 text-xs">
                <span className="w-5">{c.emoji}</span>
                <span className="flex-1 text-text-secondary truncate">{c.label}</span>
                <div className="w-24 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: attempted > 0 ? `${avg}%` : '0%' }}
                  />
                </div>
                <span className="w-16 text-right text-text-secondary text-[10px]">
                  {attempted > 0 ? `${avg}점` : '미학습'}
                </span>
              </div>
            );
          })}
        </div>

        {/* 카테고리 바로 시작 (stage 필터 포함) */}
        <div className="pt-3 border-t border-border">
          <div className="text-[11px] font-bold text-text-secondary mb-1.5">
            {activeStage === 'design' ? '설계단계' : '구현단계'} 카테고리 바로 시작
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {categories.map(c => (
              <button
                key={c.key}
                onClick={() =>
                  navigate(`/kisa/drill?stage=${activeStage}&category=${c.key}&type=${activeStage === 'design' ? 'mcq' : 'diagnosis4'}`)
                }
                className="text-xs px-2 py-2 rounded-lg border border-border hover:bg-primary-light active:scale-95 transition-all"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{c.emoji}</span>
                  <span className="truncate">{c.label}</span>
                </div>
                <div className="text-[9px] text-text-secondary mt-0.5">{c.count}항목</div>
              </button>
            ))}
          </div>
        </div>
        {loading && <p className="mt-2 text-[10px] text-text-secondary">불러오는 중...</p>}
      </div>
    </div>
  );
}

function StageTab({ active, onClick, label, subtitle }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all ${
        active
          ? 'bg-card-bg text-primary shadow-sm'
          : 'text-text-secondary hover:text-text'
      }`}
    >
      <div>{label}</div>
      <div className="text-[10px] opacity-70 font-normal mt-0.5">{subtitle}</div>
    </button>
  );
}

function StatCard({ label, value, unit, highlight, loading }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'bg-primary-light border-primary/30' : 'bg-card-bg border-border'}`}>
      <div className="text-[10px] text-text-secondary mb-0.5">{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-xl font-bold ${highlight ? 'text-primary' : ''}`}>
          {loading ? '—' : value}
        </span>
        <span className="text-[10px] text-text-secondary">{unit}</span>
      </div>
    </div>
  );
}

function StartButton({ title, desc, emoji, onClick, disabled, disabledText, highlight }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`rounded-xl p-3 border text-left transition-all ${
        disabled
          ? 'bg-neutral-100 dark:bg-neutral-800 border-border opacity-60 cursor-not-allowed'
          : highlight
            ? 'bg-primary-light border-primary/40 hover:bg-primary/10 active:scale-[0.98]'
            : 'bg-card-bg border-border hover:bg-primary-light hover:border-primary/40 active:scale-[0.98]'
      }`}
    >
      <div className="text-xl mb-0.5">{emoji}</div>
      <div className="text-xs font-bold">{title}</div>
      <div className="text-[10px] text-text-secondary">
        {disabled ? disabledText : desc}
      </div>
    </button>
  );
}
