// 튜토리얼 반투명 오버레이 — 2개 트랙 (일반 기출 / KISA)
//
// 동작:
//   - localStorage['aitutor-tutorial-seen'] === 현재 VERSION 이면 자동 표시 안 함
//   - open prop으로 외부에서 강제 오픈
//   - 초기 화면: 트랙 선택 (일반 기출 / KISA / 둘 다)
//   - 트랙별 스텝 진행
//   - 건너뛰기 / 이전 / 다음 / 완료
//
// v4 변경점 (2026-04-25):
//   - KISA 트랙에 단답형(blank) 문제 유형 추가 반영
//   - "3종 드릴 모드" 단계 신설, "단답형 풀이 방법" 단계 추가
//   - 모의고사 구성을 MCQ 20 + 단답형 10 + 실기 15 로 업데이트
//   - 정답 해설 모달의 유형별 차별화(선택 번호/빈칸 카드/4단계 진단) 설명 포함
//   - 버전 키 v3 → v4 로 업데이트 (기존 KISA 사용자에게 다시 한 번 안내)
//
// v2 (2026-04-24): 일반 기출 트랙 추가 + 트랙 선택 초기 화면
// v3: 트랙명 '기출문제 학습' 으로 일반화 (3개 자격증 지원)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'aitutor-tutorial-seen';
const VERSION = 'v4';  // v4 — KISA 단답형 문제 유형 반영 (2026-04-25)

// 📚 기출문제 학습 트랙 (다중 자격시험 공용)
// 현재 지원: 3개 자격증 (영상정보관리사 등). 추후 신규 자격증도 동일 UI로 확장 가능.
const GENERAL_STEPS = [
  {
    emoji: '📚',
    title: '기출문제 학습',
    body: '여러 자격증의 기출 문항을 카테고리·시험 회차·랜덤·카드·북마크·모의고사 6가지 방식으로 학습할 수 있어요. 학습 허브에서 자격증과 카테고리를 선택해 시작합니다.',
    highlight: '하단 [학습] 탭 또는 /quiz',
    cta: { label: '학습 허브 열기', path: '/quiz' },
  },
  {
    emoji: '🗂️',
    title: '카테고리 학습',
    body: '자격증별 카테고리와 시험 회차를 골라 문제를 순서대로 풀 수 있어요. 기초부터 체계적으로 학습하고 싶을 때 추천.',
    highlight: '학습 허브 → 카테고리 학습',
    cta: { label: '카테고리 열기', path: '/quiz/category' },
  },
  {
    emoji: '🔀',
    title: '랜덤 학습',
    body: '전체 또는 특정 카테고리에서 문제를 무작위로 섞어 출제합니다. 실제 시험처럼 연습하고 싶을 때 사용하세요.',
    highlight: '학습 허브 → 랜덤 학습',
    cta: { label: '랜덤 퀴즈 시작', path: '/quiz/random' },
  },
  {
    emoji: '📇',
    title: '카드 학습 (플래시카드)',
    body: '한 문제씩 집중해서 푸는 방식. 답을 보고 외운 뒤, 자가평가에 따라 어려운 문제만 자동 반복됩니다.',
    highlight: '학습 허브 → 카드 학습',
    cta: { label: '카드 스터디 열기', path: '/quiz/card' },
  },
  {
    emoji: '⭐',
    title: '북마크 학습',
    body: '문제 풀이 중 ⭐ 버튼을 누르면 즐겨찾기됩니다. 북마크만 모아 집중 복습이 가능해요.',
    highlight: '학습 허브 → 북마크 학습',
    cta: { label: '즐겨찾기 열기', path: '/quiz/bookmark' },
  },
  {
    emoji: '⏱️',
    title: '모의고사',
    body: '실제 시험처럼 제한 시간 내에 풀고 자동 채점을 받습니다. 시험 직전 실전 감각 점검용.',
    highlight: '학습 허브 → 모의고사',
    cta: { label: '모의고사 시작', path: '/quiz/exam' },
  },
  {
    emoji: '📝',
    title: '메모 + 🤖 AI 해설',
    body: '문제별로 개인 메모(첨부파일 포함)를 남길 수 있고, Gemini / OpenAI / Claude 3종 중 원하는 AI로 해설을 받을 수 있어요. 생성된 해설은 저장해 재사용합니다.',
    highlight: '문제 풀이 중 하단 패널',
    cta: null,
  },
  {
    emoji: '🎉',
    title: '준비 완료!',
    body: '언제든 학습 허브 우상단 [❓ 가이드]로 다시 볼 수 있어요.\n\nKISA 진단원 이수시험(SW 보안약점 진단) 대비도 필요하다면 하단 [KISA] 탭을 확인하세요.',
    cta: { label: '학습 시작', path: '/quiz' },
  },
];

// 🛡️ KISA 학습 트랙
const KISA_STEPS = [
  {
    emoji: '🛡️',
    title: 'KISA 진단원 이수시험',
    body: 'SW 보안약점 진단원 이수시험은 이론 60분 30문항 + 실기 100분 15문항(종합 70점 합격)으로 구성됩니다. MCQ + 단답형 + 실기 진단 3유형, 286문항 + 69개 학습 챕터로 완전 대비 가능해요.',
    highlight: '하단 [KISA] 탭 또는 /kisa',
    cta: { label: 'KISA 대시보드', path: '/kisa' },
  },
  {
    emoji: '📐',
    title: '먼저, 단계를 구분하세요',
    body: '설계단계(설계 요구사항, 20항목)와 구현단계(취약 코드 진단, 49항목)로 구분됩니다. 대시보드 하단 탭으로 각 단계 카테고리를 확인하세요. 단답형은 양쪽 단계 모두 포함됩니다.',
    highlight: 'Dashboard 하단 [📐 설계단계] [🔧 구현단계] 탭',
    cta: null,
  },
  {
    emoji: '📖',
    title: '학습 자료부터 시작',
    body: '69개 챕터의 정의 · 원인 · 대응 원칙 · 취약/안전 코드 비교를 먼저 읽으세요. 설계↔구현 연관 챕터가 서로 연결돼 있어 KISA 기출 빈출 연관 문제 대응에 유리합니다.',
    highlight: '/kisa/study',
    cta: { label: '학습 자료 열기', path: '/kisa/study' },
  },
  {
    emoji: '🎯',
    title: '3종 드릴 모드',
    body: '대시보드에서 3가지 드릴을 선택할 수 있어요:\n\n🎯 이론 드릴 (MCQ) — 객관식 4지선다로 개념 확인 (96문제)\n✍️ 단답형 드릴 — 문장 속 빈칸 채우기로 핵심 용어·API 암기 (138문제, 69챕터 × 2)\n🧪 실기 드릴 — 취약 코드 4단계 진단 (52문제)',
    highlight: '대시보드 [이론/단답형/실기 드릴] 3개 버튼',
    cta: { label: '단답형 드릴 먼저', path: '/kisa/drill?type=blank' },
  },
  {
    emoji: '✍️',
    title: '단답형 풀이 방법',
    body: '문장 안 {{1}} {{2}} 같은 빈칸에 용어·API 이름을 직접 타이핑합니다. 대소문자·공백 차이는 자동 정규화되고, 유의어(예: "PreparedStatement" ↔ "prepared statement")도 정답으로 인정돼요. 모든 빈칸을 채워야 제출 버튼이 활성화됩니다.',
    highlight: '드릴 화면의 인라인 빈칸 입력 필드',
    cta: null,
  },
  {
    emoji: '📝',
    title: '정답 해설 + AI 추가 해설',
    body: '제출 후 문제 유형별 결과 모달이 나타납니다:\n\n🎯 MCQ: 선택 번호 vs 정답 번호 + 해설\n✍️ 단답형: 빈칸별 입력/정답 카드 + 정답률 배지\n🧪 실기: 취약여부·라인·근거·수정 4단계 채점\n\n🤖 Gemini / Claude / OpenAI 버튼으로 유형별 맞춤 AI 추가 해설을 받을 수 있어요. 저장된 해설은 ✓ 뱃지로 표시되며 즉시 불러옵니다.',
    highlight: '문제 제출 후 ResultOverlay',
    cta: null,
  },
  {
    emoji: '⏱️',
    title: '실전 모의고사',
    body: '이론 60분(MCQ 20 + 단답형 10 = 30문항) / 실기 100분(서술형 15) / 전체 180분(45문항) 모드를 선택할 수 있습니다. 단답형은 이론 영역에 포함되어 theory_score 로 합산됩니다. 30초마다 자동저장되므로 네트워크가 끊겨도 안전해요.',
    highlight: '대시보드 [실전 모의] 버튼',
    cta: { label: '실전 모의고사', path: '/kisa/exam' },
  },
  {
    emoji: '🔁',
    title: 'SRS 자동 반복',
    body: '자가평가 [다시/어려움/괜찮음/쉬움]에 따라 SM-2 알고리즘이 1·3·7·15·30일 간격으로 자동 재출제. 대시보드 "오늘 복습 N개"에서 확인하세요.',
    highlight: '대시보드 상단 요약 카드',
    cta: null,
  },
  {
    emoji: '📊',
    title: '통계 대시보드',
    body: '7대 분류 정답률 / 최근 7일 학습량 / 향후 7일 복습 예정을 차트로 확인할 수 있어요.',
    highlight: '대시보드 [통계 보기]',
    cta: { label: '통계 열기', path: '/kisa/stats' },
  },
  {
    emoji: '🎉',
    title: '준비 완료!',
    body: '언제든 KISA 대시보드 [❓ 가이드] 버튼으로 다시 볼 수 있어요.',
    cta: { label: 'KISA 대시보드', path: '/kisa' },
  },
];

export function hasSeenTutorial() {
  try { return localStorage.getItem(STORAGE_KEY) === VERSION; } catch { return false; }
}

export function markTutorialSeen() {
  try { localStorage.setItem(STORAGE_KEY, VERSION); } catch {}
}

export function resetTutorial() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export default function TutorialOverlay({ open, onClose, initialTrack = null }) {
  const navigate = useNavigate();
  // track: null(선택 화면) | 'general' | 'kisa'
  const [track, setTrack] = useState(initialTrack);
  const [step, setStep] = useState(0);

  // 열릴 때마다 리셋
  useEffect(() => {
    if (open) {
      setTrack(initialTrack);
      setStep(0);
    }
  }, [open, initialTrack]);

  if (!open) return null;

  const handleSkip = () => {
    markTutorialSeen();
    onClose?.();
  };
  const handleFinish = () => {
    markTutorialSeen();
    onClose?.();
  };

  // ========================================================================
  // 트랙 선택 화면
  // ========================================================================
  if (!track) {
    return (
      <Backdrop onDismiss={handleSkip}>
        <div className="w-full max-w-md rounded-2xl bg-card-bg shadow-2xl border border-border overflow-hidden">
          <div className="flex justify-end px-4 pt-3">
            <button onClick={handleSkip} className="text-[11px] text-text-secondary hover:text-text">
              건너뛰기 ×
            </button>
          </div>

          <div className="px-6 pb-5 text-center">
            <div className="text-5xl mb-3">👋</div>
            <h2 className="text-lg font-bold mb-2">어떤 시험을 준비하시나요?</h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-5">
              학습 목적에 맞는 가이드를 보여드릴게요.
              나중에 다른 가이드도 볼 수 있어요.
            </p>

            <div className="space-y-2">
              <TrackButton
                emoji="📚"
                title="기출문제 학습"
                desc="여러 자격증 기출 · 카테고리·랜덤·카드·북마크·모의고사"
                color="bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                onClick={() => { setTrack('general'); setStep(0); }}
              />
              <TrackButton
                emoji="🛡️"
                title="KISA 진단원 이수시험"
                desc="SW 보안약점 148문항 + 69챕터"
                color="bg-primary-light border-primary/40 text-primary"
                onClick={() => { setTrack('kisa'); setStep(0); }}
              />
            </div>

            <p className="mt-4 text-[10px] text-text-secondary">
              💡 두 시험 모두 준비한다면 한 쪽부터 둘러보세요.
            </p>
          </div>
        </div>
      </Backdrop>
    );
  }

  // ========================================================================
  // 스텝 진행 화면
  // ========================================================================
  const steps = track === 'general' ? GENERAL_STEPS : KISA_STEPS;
  const trackLabel = track === 'general' ? '📚 기출문제 학습' : '🛡️ KISA 진단원';
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const handleCta = () => {
    markTutorialSeen();
    onClose?.();
    if (current.cta?.path) navigate(current.cta.path);
  };

  const switchTrack = () => {
    setTrack(null);
    setStep(0);
  };

  return (
    <Backdrop onDismiss={handleSkip}>
      <div className="w-full max-w-md rounded-2xl bg-card-bg shadow-2xl border border-border overflow-hidden">
        {/* 진행 인디케이터 */}
        <div className="flex items-center gap-1 px-4 pt-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i < step ? 'bg-primary/50' :
                i === step ? 'bg-primary' : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>

        {/* 트랙 라벨 + 건너뛰기 */}
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={switchTrack}
            className="text-[11px] text-text-secondary hover:text-text flex items-center gap-1"
          >
            ← {trackLabel}
          </button>
          <button onClick={handleSkip} className="text-[11px] text-text-secondary hover:text-text">
            건너뛰기 ×
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 text-center">
          <div className="text-6xl mb-3 select-none">{current.emoji}</div>
          <h2 className="text-lg font-bold mb-2 leading-tight">{current.title}</h2>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {current.body}
          </p>

          {current.highlight && (
            <div className="mt-3 mx-auto inline-block text-[11px] px-3 py-1.5 rounded-full bg-primary-light text-primary font-semibold">
              👉 {current.highlight}
            </div>
          )}

          {current.cta && (
            <button
              onClick={handleCta}
              className="mt-4 w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              {current.cta.label} →
            </button>
          )}
        </div>

        {/* 네비 */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-neutral-50 dark:bg-neutral-900/50">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-card-bg"
          >
            ← 이전
          </button>
          <span className="flex-1 text-center text-[11px] text-text-secondary">
            {step + 1} / {steps.length}
          </span>
          {!isLast ? (
            <button
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90"
            >
              다음 →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:opacity-90"
            >
              완료 ✓
            </button>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

// ============================================================================
// 공통 반투명 배경
// ============================================================================
function Backdrop({ children, onDismiss }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-6 animate-[fadeIn_0.2s]"
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onDismiss}
      role="dialog"
      aria-label="앱 사용 가이드"
    >
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function TrackButton({ emoji, title, desc, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border-2 text-left hover:scale-[1.02] active:scale-[0.98] transition-all ${color}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">{emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">{title}</div>
          <div className="text-[11px] opacity-80 mt-0.5">{desc}</div>
        </div>
        <div className="text-lg opacity-60">→</div>
      </div>
    </button>
  );
}
