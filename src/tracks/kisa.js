// KISA 진단원 이수시험 트랙 메타 — REBUILD16 §10 Stage 2 (R5)
//
// 트랙 단독 운영 단계에서는 이 파일이 KISA 의 모든 메타(라벨, 색상, 시험 구성, 카테고리)
// 를 한 곳에 정의. 신규 트랙 추가 시 동일 형태의 파일을 만들면 됨.

const kisa = {
  id: 'kisa',
  name: 'KISA 진단원 이수시험',
  shortName: 'KISA',
  description: 'KISA 소프트웨어 보안약점 진단원 이수시험 (이론 60분 + 실기 100분)',
  color: '#4255ff',
  basePath: '/kisa',                      // 라우트 prefix
  apiPrefix: '/api/kisa',                 // API 엔드포인트 prefix

  // 시험 구성 — api/kisa-exam.js 의 EXAM_CONFIG 와 동기화 필요
  examConfig: {
    theory60:     { label: '이론 60분',     mcq: 20, blank: 10, practical: 0,  time: 60 * 60 },
    practical100: { label: '실기 100분',    mcq: 0,  blank: 0,  practical: 15, time: 100 * 60 },
    full3h:       { label: '전체 3시간',    mcq: 20, blank: 10, practical: 15, time: 180 * 60 },
  },

  // 7대 약점 분류 (시험 출제 영역) — 단일 진실 공급원
  weaknessCategories: {
    input_validation: { label: '입력검증',   emoji: '🔐' },
    security_feature: { label: '보안기능',   emoji: '🛡️' },
    time_state:       { label: '시간·상태',  emoji: '⏱️' },
    error_handling:   { label: '에러처리',   emoji: '⚠️' },
    code_error:       { label: '코드오류',   emoji: '🐛' },
    encapsulation:    { label: '캡슐화',     emoji: '📦' },
    api_abuse:        { label: 'API오용',    emoji: '🔌' },
  },

  // 단계 — 설계/구현 + 단계별 카테고리 (Dashboard 가 사용)
  stages: {
    design: {
      label: '📐 설계단계',
      subtitle: '20개 항목',
      total: 20,
      categories: [
        { key: 'input_validation', label: '입력데이터 검증', emoji: '🔍', count: 10 },
        { key: 'security_feature', label: '보안기능',        emoji: '🔐', count: 8  },
        { key: 'error_handling',   label: '에러처리',        emoji: '⚠️', count: 1  },
        { key: 'session_control',  label: '세션통제',        emoji: '🎫', count: 1  },
      ],
    },
    implementation: {
      label: '🔧 구현단계',
      subtitle: '49개 항목',
      total: 49,
      categories: [
        { key: 'input_validation', label: '입력데이터 검증', emoji: '🔍', count: 17 },
        { key: 'security_feature', label: '보안기능',        emoji: '🔐', count: 16 },
        { key: 'time_state',       label: '시간·상태',       emoji: '⏱️', count: 2  },
        { key: 'error_handling',   label: '에러처리',        emoji: '⚠️', count: 3  },
        { key: 'code_error',       label: '코드오류',        emoji: '🐛', count: 5  },
        { key: 'encapsulation',    label: '캡슐화',          emoji: '📦', count: 4  },
        { key: 'api_abuse',        label: 'API 오용',        emoji: '🔧', count: 2  },
      ],
    },
  },

  // 합격선
  passing: {
    overall: 70,
    theoryWeight: 0.5,
    practicalWeight: 0.5,
  },
};

export default kisa;

/** weakness_category → 한글 라벨 (헬퍼) */
export function getCategoryLabel(key) {
  return kisa.weaknessCategories[key]?.label || key;
}

/** stage → 라벨 */
export function getStageLabel(key) {
  return kisa.stages[key]?.label || key;
}
