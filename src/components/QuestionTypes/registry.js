// 문제 유형 레지스트리 — REBUILD16 §10 Stage 1 (R3)
//
// 신규 question_type 을 추가할 때 여기 한 곳만 수정하면 됨.
// 기존: DrillSession/ExamMode/ResultOverlay 가 각자 if (mcq/blank/diag) 분기
// 변경: components/QuestionTypes/registry 를 import 해 통일된 메타로 분기
//
// Card  : DrillSession 에서 사용하는 단일 문제 풀이 컴포넌트
// label : UI 표시용 한글 라벨
// icon  : 이모지 아이콘 (헤더 배지 등)
// resultLabel: ResultOverlay 헤더 라벨 (예: "🎯 이론 (MCQ)")

import McqCard from '../../tabs/KisaTab/McqCard';
import BlankCard from '../../tabs/KisaTab/BlankCard';
import DiagnosisCard from '../../tabs/KisaTab/DiagnosisCard';
import McqResult, { McqHeaderExtra } from './results/McqResult';
import BlankResult, { BlankHeaderExtra } from './results/BlankResult';
import DiagnosisResult, { DiagnosisHeaderExtra } from './results/DiagnosisResult';
import McqExamBody from './exam/McqExamBody';
import BlankExamBody from './exam/BlankExamBody';
import DiagnosisExamBody from './exam/DiagnosisExamBody';

export const QUESTION_TYPES = {
  mcq: {
    Card: McqCard,
    Result: McqResult,
    HeaderExtra: McqHeaderExtra,
    ExamBody: McqExamBody,
    label: '이론',
    icon: '🎯',
    resultLabel: '🎯 이론 (MCQ)',
    showLlmGrade: false,
    needsCodeBlockInteraction: false,
    hasAnswer: (ans) => typeof ans?.mcq_selected === 'number',
  },
  blank: {
    Card: BlankCard,
    Result: BlankResult,
    HeaderExtra: BlankHeaderExtra,
    ExamBody: BlankExamBody,
    label: '단답형',
    icon: '✍️',
    resultLabel: '✍️ 단답형',
    showLlmGrade: false,
    needsCodeBlockInteraction: false,
    hasAnswer: (ans) => Array.isArray(ans?.blank_answers_user)
      && ans.blank_answers_user.some(b => (b.text || '').trim()),
  },
  diagnosis4: {
    Card: DiagnosisCard,
    Result: DiagnosisResult,
    HeaderExtra: DiagnosisHeaderExtra,
    ExamBody: DiagnosisExamBody,
    label: '실기',
    icon: '🧪',
    resultLabel: '🧪 실기 (진단)',
    showLlmGrade: true,
    needsCodeBlockInteraction: true,
    hasAnswer: (ans) => typeof ans?.verdict_yn === 'boolean'
      || (ans?.rationale_text?.length > 0)
      || (ans?.fix_text?.length > 0),
  },
};

/** 안전한 lookup — 미지원 유형은 null 반환 */
export function getQuestionType(type) {
  return QUESTION_TYPES[type] || null;
}

/** 등록된 모든 question_type 키 (DB 검증·관리자 UI 등에서 사용 가능) */
export const QUESTION_TYPE_KEYS = Object.keys(QUESTION_TYPES);
