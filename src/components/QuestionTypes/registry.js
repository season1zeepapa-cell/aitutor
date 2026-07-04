// 문제 유형 레지스트리 — REBUILD16 §10 Stage 1 (R3)
//
// 신규 question_type 을 추가할 때 여기 한 곳만 수정하면 됨.
// 기존: DrillSession/ExamMode/ResultOverlay 가 각자 if (mcq/blank/diag) 분기
// 변경: components/QuestionTypes/registry 를 import 해 통일된 메타로 분기
//
// Card  : DrillSession 에서 사용하는 단일 문제 풀이 컴포넌트
// label : UI 표시용 한글 라벨
// icon  : 이모지 아이콘 (헤더 배지 등)
// resultLabel: ResultOverlay 헤더 라벨 (예: "📝 이론 객관식")

import McqCard from '../../tabs/KisaTab/McqCard';
import BlankCard from '../../tabs/KisaTab/BlankCard';
import DiagnosisCard from '../../tabs/KisaTab/DiagnosisCard';
import CompositeCard from '../../tabs/KisaTab/CompositeCard';
import CodeidCard from '../../tabs/KisaTab/CodeidCard';
import McqResult, { McqHeaderExtra } from './results/McqResult';
import BlankResult, { BlankHeaderExtra } from './results/BlankResult';
import DiagnosisResult, { DiagnosisHeaderExtra } from './results/DiagnosisResult';
import CompositeResult, { CompositeHeaderExtra } from './results/CompositeResult';
import CodeidResult, { CodeidHeaderExtra } from './results/CodeidResult';
import McqExamBody from './exam/McqExamBody';
import BlankExamBody from './exam/BlankExamBody';
import DiagnosisExamBody from './exam/DiagnosisExamBody';
import CompositeExamBody from './exam/CompositeExamBody';
import CodeidExamBody from './exam/CodeidExamBody';

export const QUESTION_TYPES = {
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
  composite: {
    Card: CompositeCard,
    Result: CompositeResult,
    HeaderExtra: CompositeHeaderExtra,
    ExamBody: CompositeExamBody,
    label: '복합실기',
    icon: '📋',
    resultLabel: '📋 복합실기',
    showLlmGrade: true,
    needsCodeBlockInteraction: false,
    hasAnswer: (ans) => (ans?.report_text || '').trim().length > 0,
  },
  codeid: {
    Card: CodeidCard,
    Result: CodeidResult,
    HeaderExtra: CodeidHeaderExtra,
    ExamBody: CodeidExamBody,
    label: '코드식별',
    icon: '💻',
    resultLabel: '💻 코드식별',
    showLlmGrade: false,
    needsCodeBlockInteraction: false,
    // 약점(mcq_selected)·안전여부(verdict_yn) 둘 다 있어야 응답으로 간주
    hasAnswer: (ans) => typeof ans?.mcq_selected === 'number' && typeof ans?.verdict_yn === 'boolean',
  },
  // REBUILD81 — 이론 객관식형(코드/설명 지문 + 4~5지선다). McqCard 계열 인프라 사용 (구 mcq 유형은 REBUILD84 에서 제거).
  objective: {
    Card: McqCard,
    Result: McqResult,
    HeaderExtra: McqHeaderExtra,
    ExamBody: McqExamBody,
    label: '이론 객관식',
    icon: '📝',
    resultLabel: '📝 이론 객관식',
    showLlmGrade: false,
    needsCodeBlockInteraction: false,
    hasAnswer: (ans) => typeof ans?.mcq_selected === 'number',
  },
  // REBUILD81 — 실습 단순서술형(정·오탐 분석 서술). composite 인프라(rubric 키워드) 재사용.
  shortessay: {
    Card: CompositeCard,
    Result: CompositeResult,
    HeaderExtra: CompositeHeaderExtra,
    ExamBody: CompositeExamBody,
    label: '단순서술형',
    icon: '🖊️',
    resultLabel: '🖊️ 단순서술형',
    showLlmGrade: false,
    needsCodeBlockInteraction: false,
    hasAnswer: (ans) => (ans?.report_text || '').trim().length > 0,
  },
};

/** 안전한 lookup — 미지원 유형은 null 반환 */
export function getQuestionType(type) {
  return QUESTION_TYPES[type] || null;
}

/** 등록된 모든 question_type 키 (DB 검증·관리자 UI 등에서 사용 가능) */
export const QUESTION_TYPE_KEYS = Object.keys(QUESTION_TYPES);
