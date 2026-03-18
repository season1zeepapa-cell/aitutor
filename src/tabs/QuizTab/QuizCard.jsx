// 문제 카드 — Quizlet 스타일 플래시카드
import { useState } from 'react';
import { useImageModal } from '../../App';
import { useToast } from '../../components/ui/Toast';
import AiExplanation from './AiExplanation';
import MemoPanel from './MemoPanel';

const CIRCLE = ['①', '②', '③', '④', '⑤'];

export default function QuizCard({ question, index, isExpanded, onToggle }) {
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const openImage = useImageModal();
  const toast = useToast();

  const q = question;
  // 이미지 URL: 상대경로면 기존 error 사이트를 참조
  const imageUrl = q.image_url
    ? (q.image_url.startsWith('http') ? q.image_url : `https://error-liart.vercel.app${q.image_url.startsWith('/') ? '' : '/'}${q.image_url}`)
    : null;
  const rawChoices = typeof q.choices === 'string' ? JSON.parse(q.choices) : (q.choices || []);
  // choices가 객체 배열({num, text})일 수 있으므로 텍스트만 추출
  const choices = rawChoices.map(c => (typeof c === 'object' && c !== null) ? (c.text || c.label || JSON.stringify(c)) : c);
  const correctAnswer = q.answer;

  // 선택지 클릭
  const handleChoice = (choiceIdx) => {
    if (showAnswer) return;
    const num = choiceIdx + 1;
    setSelectedChoice(num);
    setShowAnswer(true);
  };

  // 카드 리셋
  const resetCard = () => {
    setSelectedChoice(null);
    setShowAnswer(false);
  };

  // 선택지 스타일 결정
  const getChoiceStyle = (choiceIdx) => {
    const num = choiceIdx + 1;
    if (!showAnswer) {
      return 'bg-badge-bg hover:bg-primary-light hover:border-primary/30 border-transparent cursor-pointer';
    }
    if (num === correctAnswer) {
      return 'bg-green-50 border-green-200 text-success';
    }
    if (num === selectedChoice && num !== correctAnswer) {
      return 'bg-red-50 border-red-200 text-danger';
    }
    return 'bg-badge-bg border-transparent opacity-60';
  };

  return (
    <div className={`bg-card-bg border rounded-2xl overflow-hidden transition-all duration-300 shadow-card
      ${isExpanded ? 'border-primary/30 shadow-md' : 'border-border'}`}>

      {/* 카드 헤더 — 클릭으로 펼치기/접기 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-card-bg-hover transition-colors"
      >
        {/* 번호 배지 */}
        <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
          bg-primary-light text-primary">
          {q.question_number || index}
        </span>

        {/* 문제 미리보기 */}
        <span className="flex-1 text-sm text-text truncate">
          {(q.body || '').substring(0, 60)}{(q.body || '').length > 60 ? '...' : ''}
        </span>

        {/* 상태 배지 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(question.memo_count > 0) && (
            <span className="text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded-md">
              메모 {question.memo_count}
            </span>
          )}
          {showAnswer && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              selectedChoice === correctAnswer
                ? 'text-success bg-success/10'
                : 'text-danger bg-danger/10'
            }`}>
              {selectedChoice === correctAnswer ? '정답' : '오답'}
            </span>
          )}
          <svg className={`w-4 h-4 text-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 카드 본문 — 펼침 시 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 fade-in">
          {/* 구분선 */}
          <div className="border-t border-border" />

          {/* 문제 이미지 (클릭 시 확대) */}
          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-border cursor-pointer" onClick={() => openImage(imageUrl)}>
              <img src={imageUrl} alt={`문제 ${q.question_number}`}
                className="w-full max-h-80 object-contain bg-badge-bg hover:opacity-90 transition-opacity" loading="lazy" />
            </div>
          )}

          {/* 문제 본문 + 복사 버튼 */}
          <div className="relative group">
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{q.body}</p>
            <button onClick={() => {
              const text = `#${q.question_number || index}\n${q.body}\n${choices.map((c,i) => `${CIRCLE[i]} ${c}`).join('\n')}\n정답: ${CIRCLE[correctAnswer-1]}`;
              navigator.clipboard.writeText(text).then(() => toast('문제가 복사되었습니다.', 'info'));
            }}
              className="absolute top-0 right-0 p-1 text-text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
              title="문제 복사">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* 선택지 */}
          <div className="space-y-2">
            {choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => handleChoice(i)}
                disabled={showAnswer}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left text-sm
                  transition-all duration-200 ${getChoiceStyle(i)}`}
              >
                <span className="flex-shrink-0 font-bold text-sm mt-0.5">{CIRCLE[i]}</span>
                <span className="flex-1">{choice}</span>
                {showAnswer && (i + 1) === correctAnswer && (
                  <svg className="w-5 h-5 text-success flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* 정답 결과 + 액션 버튼 */}
          {showAnswer && (
            <div className="flex items-center justify-between pt-2 slide-up">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${selectedChoice === correctAnswer ? 'text-success' : 'text-danger'}`}>
                  {selectedChoice === correctAnswer ? '정답입니다!' : `오답 — 정답: ${CIRCLE[correctAnswer - 1]}`}
                </span>
              </div>
              <button
                onClick={resetCard}
                className="text-xs text-primary font-semibold hover:text-primary-hover transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-light"
              >
                다시 풀기
              </button>
            </div>
          )}

          {/* AI 해설 + 메모 토글 */}
          <AiSubPanels questionId={q.id} questionBody={q.body} choices={q.choices} answer={correctAnswer} />
        </div>
      )}
    </div>
  );
}

// 하위 패널 — AI 해설 / 메모 탭 전환
function AiSubPanels({ questionId, questionBody, choices, answer }) {
  const [activePanel, setActivePanel] = useState(null);

  const panels = [
    { key: 'ai', label: 'AI 해설', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )},
    { key: 'memo', label: '메모', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )},
  ];

  return (
    <div className="space-y-3">
      {/* 탭 버튼 */}
      <div className="flex gap-2">
        {panels.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePanel(prev => prev === p.key ? null : p.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all
              ${activePanel === p.key
                ? 'bg-primary text-white'
                : 'bg-badge-bg text-text-secondary hover:bg-card-bg-hover hover:text-text'
              }`}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      {/* 패널 내용 */}
      {activePanel === 'ai' && (
        <div className="fade-in">
          <AiExplanation questionId={questionId} questionBody={questionBody} choices={choices} answer={answer} />
        </div>
      )}
      {activePanel === 'memo' && (
        <div className="fade-in">
          <MemoPanel questionId={questionId} />
        </div>
      )}
    </div>
  );
}
