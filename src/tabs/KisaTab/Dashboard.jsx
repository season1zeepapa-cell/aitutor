// KISA 대시보드 (/kisa)
// 설계단계 / 구현단계 탭 기반으로 카테고리와 정답률을 분리 표시
// REBUILD16 R5 — 단계별 카테고리는 src/tracks/kisa.js 에서 가져옴 (단일 진실 공급원)
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKisaStats } from '../../hooks/useKisaSrs';
import { useTutorial } from '../../App';
import kisaTrack from '../../tracks/kisa';
import practiceData from '../../data/kisa-practice.json'; // 설계기준 실습 개수 표시용

// 학습 진입 카드 정의 (드래그 재배치 대상). id 로 순서를 localStorage 에 저장.
//   desc/highlight 가 동적인 카드(설계실습·복습)는 렌더 시 override 로 주입한다.
const DASH_CARDS = [
  { id: 'study',       emoji: '📖', title: '📖 학습 자료',      desc: '69개 챕터 개념·코드 예시',      to: '/kisa/study',              highlight: true },
  { id: 'theory',      emoji: '📚', title: '📚 이론교육',        desc: '원인·영향·대응·진단 49',        to: '/kisa/theory',             highlight: true },
  { id: 'blank',       emoji: '✍️', title: '단답형 드릴',        desc: '카테고리·순서 선택',            to: '/kisa/drill-config?type=blank' },
  { id: 'diagnosis4',  emoji: '🧪', title: '실기 드릴',          desc: '코드 진단 4단계',               to: '/kisa/drill?type=diagnosis4' },
  { id: 'composite',   emoji: '📋', title: '복합서술형 드릴',    desc: '산출물 검토→진단보고서',        to: '/kisa/drill?type=composite' },
  { id: 'objective',   emoji: '📝', title: '이론 객관식',        desc: '지문+4~5지선다 · 잘못된것',      to: '/kisa/drill-config?type=objective' },
  { id: 'shortessay',  emoji: '🖊️', title: '단순서술형',          desc: '정·오탐 분석 서술',             to: '/kisa/drill-config?type=shortessay' },
  { id: 'diagram',     emoji: '🖼️', title: '그림 약점퀴즈',      desc: '그림 보고 약점 식별',           to: '/kisa/diagram-quiz' },
  { id: 'codedrill',   emoji: '💻', title: '코드 약점드릴',      desc: '전수 학습 · 이어하기 · SRS',    to: '/kisa/code-drill' },
  { id: 'codelib',     emoji: '💾', title: '예시코드 라이브러리', desc: '5개 문서 취약/안전 코드 전수',  to: '/kisa/code-library' },
  { id: 'practice',    emoji: '📝', title: '설계기준 실습',      desc: `화면·산출물 진단 ${practiceData.count}`, to: '/kisa/study?tab=practice' },
  { id: 'exam',        emoji: '⏱️', title: '실전 모의',          desc: '이론 60분/실기 100분',          to: '/kisa/exam' },
  { id: 'stats',       emoji: '📊', title: '통계 보기',          desc: '진도·약점 분석',                to: '/kisa/stats' },
  { id: 'wrong',       emoji: '📝', title: '오답 노트',          desc: '틀린 문항 모음',                to: '/kisa/wrong-notes' },
  { id: 'review',      emoji: '🔁', title: '복습 (SRS)',         desc: '간격 반복 복습',                to: '/kisa/review' },
];
const DASH_ORDER_KEY = 'kisa-dash-order-v1';

// 저장된 순서를 현재 카드 목록과 병합 — 새 카드는 뒤에 붙이고, 없어진 id 는 제거(카드 추가/삭제에 안전)
function loadCardOrder() {
  const ids = DASH_CARDS.map((c) => c.id);
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(DASH_ORDER_KEY) || '[]'); } catch { saved = []; }
  const valid = saved.filter((id) => ids.includes(id));
  const rest = ids.filter((id) => !valid.includes(id));
  return [...valid, ...rest];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading } = useKisaStats();
  const { openGuide } = useTutorial();
  const [activeStage, setActiveStage] = useState('design');  // 'design' | 'implementation'

  // 학습 카드 순서(드래그 재배치) — 기기별 localStorage 저장
  const [cardOrder, setCardOrder] = useState(loadCardOrder);
  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState(null);
  const dragIdRef = useRef(null);

  const persistOrder = (ids) => {
    try { localStorage.setItem(DASH_ORDER_KEY, JSON.stringify(ids)); } catch { /* 저장 실패 무시 */ }
  };
  // pointer 위치의 카드 id 로 순서를 재배열 (드래그 중 실시간 반영)
  const reorderTo = (overId) => {
    const from = dragIdRef.current;
    if (!from || from === overId) return;
    setCardOrder((prev) => {
      const a = [...prev];
      const fi = a.indexOf(from), ti = a.indexOf(overId);
      if (fi < 0 || ti < 0) return prev;
      a.splice(ti, 0, a.splice(fi, 1)[0]);
      return a;
    });
  };
  const onCardPointerDown = (e, id) => {
    if (!editMode) return;
    dragIdRef.current = id;
    setDragId(id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onCardPointerMove = (e) => {
    if (!editMode || !dragIdRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const card = el && el.closest('[data-card-id]');
    if (card) reorderTo(card.getAttribute('data-card-id'));
  };
  const onCardPointerUp = () => {
    if (!dragIdRef.current) return;
    dragIdRef.current = null;
    setDragId(null);
    setCardOrder((prev) => { persistOrder(prev); return prev; });
  };

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

      {/* 시작 버튼 — 학습 카드 (드래그로 순서 변경 가능) */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] text-text-secondary">
          {editMode ? '카드를 끌어 순서를 바꾸세요' : '학습 메뉴'}
        </span>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`text-[11px] px-2 py-1 rounded-full font-bold transition-colors ${
            editMode ? 'bg-primary text-white' : 'bg-card-bg border border-border text-text-secondary hover:text-text'
          }`}
        >
          {editMode ? '완료' : '↕️ 순서 편집'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2" style={{ touchAction: editMode ? 'none' : 'auto' }}>
        {cardOrder.map((id) => {
          const card = DASH_CARDS.find((c) => c.id === id);
          if (!card) return null;
          // 동적 desc/highlight 주입 (설계실습·복습)
          let { desc, highlight } = card;
          if (id === 'review') {
            desc = summary.due_today > 0 ? `오늘 복습 ${summary.due_today}개 · 유형·그룹별 선택` : card.desc;
            highlight = summary.due_today > 0;
          }
          return (
            <div
              key={id}
              data-card-id={id}
              onPointerDown={(e) => onCardPointerDown(e, id)}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              className={editMode && dragId === id ? 'opacity-60 scale-[0.97] transition-transform' : 'transition-transform'}
            >
              <StartButton
                title={card.title}
                desc={desc}
                emoji={card.emoji}
                highlight={highlight}
                editMode={editMode}
                onClick={() => navigate(card.to)}
              />
            </div>
          );
        })}
      </div>

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
            ? '설계 요구사항·원칙 기반 객관식 위주. 이론시험 대비.'
            : '취약 코드 진단 + 이론 객관식. 실기·이론시험 둘 다 대비.'}
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

        {/* 카테고리별 설정 열기 — 클릭 시 해당 단계·분류를 미리 선택한 설정 화면으로.
            (유형·순서/랜덤은 설정 화면에서 고르므로 신규 유형까지 모두 반영) */}
        <div className="pt-3 border-t border-border">
          <div className="text-[11px] font-bold text-text-secondary mb-1.5">
            {activeStage === 'design' ? '설계단계' : '구현단계'} 카테고리별 학습 시작
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {categories.map(c => (
              <button
                key={c.key}
                onClick={() =>
                  navigate(`/kisa/drill-config?type=objective&stage=${activeStage}&categories=${c.key}`)
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
          <p className="text-[10px] text-text-secondary mt-1.5 leading-relaxed">
            분류를 고르면 설정 화면에서 <b>문제유형·순서(순서대로/랜덤)</b>를 선택해 시작합니다.
          </p>
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

function StartButton({ title, desc, emoji, onClick, disabled, disabledText, highlight, editMode }) {
  return (
    <button
      // 편집 모드에서는 클릭(이동) 비활성 — 드래그만. 그 외엔 기존처럼 navigate.
      onClick={disabled || editMode ? undefined : onClick}
      disabled={disabled}
      className={`w-full rounded-xl p-3 border text-left transition-all ${
        editMode ? 'cursor-grab active:cursor-grabbing ring-1 ring-primary/30 select-none' : ''
      } ${
        disabled
          ? 'bg-neutral-100 dark:bg-neutral-800 border-border opacity-60 cursor-not-allowed'
          : highlight
            ? 'bg-primary-light border-primary/40 hover:bg-primary/10 active:scale-[0.98]'
            : 'bg-card-bg border-border hover:bg-primary-light hover:border-primary/40 active:scale-[0.98]'
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <div className="text-xl">{emoji}</div>
        {editMode && <span className="ml-auto text-text-secondary text-sm">⋮⋮</span>}
      </div>
      <div className="text-xs font-bold">{title}</div>
      <div className="text-[10px] text-text-secondary">
        {disabled ? disabledText : desc}
      </div>
    </button>
  );
}
