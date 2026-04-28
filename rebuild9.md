# AI TutorTwo — 코드베이스 분석 + 개선/리팩토링/확장 제안 (rebuild9)

> 작성일: 2026-03-26
> 기반: rebuild8.md + PIPELINE.md + 코드베이스 심층 분석
> 프로젝트: workspace/aitutor
> 배포: https://aitutor-six.vercel.app
> 규모: 프론트엔드 6,053줄 + 백엔드 2,478줄 + 파이프라인 1,995줄

---

## 목차

1. [현재 상태 정량 분석](#1-현재-상태-정량-분석)
2. [보안 개선 (P0 — 즉시)](#2-보안-개선-p0--즉시)
3. [DB 성능 최적화 (P0)](#3-db-성능-최적화-p0)
4. [프론트엔드 리팩토링 (P1)](#4-프론트엔드-리팩토링-p1)
5. [백엔드 리팩토링 (P1)](#5-백엔드-리팩토링-p1)
6. [파이프라인 리팩토링 (P1)](#6-파이프라인-리팩토링-p1)
7. [기능 확장 제안 (P2)](#7-기능-확장-제안-p2)
8. [테스트 강화 (P2)](#8-테스트-강화-p2)
9. [인프라/배포 개선 (P2)](#9-인프라배포-개선-p2)
10. [장기 비전 (P3)](#10-장기-비전-p3)
11. [실행 로드맵](#11-실행-로드맵)

---

## 1. 현재 상태 정량 분석

### 1.1 코드 규모

| 영역 | 파일 수 | 줄 수 | 비고 |
|------|---------|-------|------|
| 프론트엔드 (src/) | 28 | 6,053 | React 18 + Vite + TailwindCSS |
| 백엔드 API (api/) | 23 | 2,478 | Vercel 서버리스 |
| 파이프라인 (pool-*.js) | 6 | 1,995 | 문제 DB화 배치 |
| 테스트 (tests/) | 6 | ~500 | Playwright E2E |
| 문서 (*.md) | 4 | 3,000+ | rebuild7/8, PIPELINE |
| **합계** | **67** | **~14,000** | |

### 1.2 주요 컴포넌트 복잡도

| 파일 | 줄 수 | 복잡도 | 개선 필요 |
|------|-------|--------|----------|
| LoginPage.jsx | 628 | 높음 | 3개 모드 + 3단계 → 분할 권장 |
| QuizCard.jsx | 383 | 높음 | 메모/해설/북마크 통합 → 분할 권장 |
| ExamMode.jsx | 413 | 높음 | 13개 useState → useReducer |
| SettingsTab/index.jsx | 459 | 높음 | 5개 섹션 → 파일 분할 |
| pool-repatch.js | 656 | 최고 | 5단계 파이프라인 → 클래스화 |

### 1.3 데이터 현황

| 항목 | 수치 |
|------|------|
| 카테고리 | 2개 (영상정보관리사, 네트워크관리사2급) |
| 시험 | 29개 |
| 문제 | 1,490개 |
| 이미지 | 243개 (영상정보 230 + 네관 13) |
| 사용자 | 1명 |

---

## 2. 보안 개선 (P0 — 즉시)

### 2.1 이메일 인증코드 무차별 대입 방지

**현재**: 인증코드 6자리 = 100만 조합, Rate limit 1분 2회 (인메모리)

```javascript
// 개선: DB 기반 실패 횟수 추적 + 잠금
// api/send-verification.js에 추가

// 1. 인증코드 검증 실패 5회 → 30분 잠금
const checkVerifyFailures = async (email) => {
  const r = await query(`
    SELECT COUNT(*) as cnt FROM email_verifications
    WHERE email = $1 AND used = false AND expires_at > NOW()
  `);
  // 미사용 코드가 5개 이상 = 반복 발송 남용
};

// 2. 인증코드 유효시간 10분 → 5분 단축
expires_at = "NOW() + INTERVAL '5 minutes'"

// 3. Rate limit DB 기반 전환 (서버리스 재시작 시 초기화 방지)
```

### 2.2 questions.js GET 요청 로직 수정

```javascript
// 현재 (rebuild8 C-1에서 식별)
if (req.method === 'GET' || action === 'list') { ... }

// 수정
if ((req.method === 'GET' && !action) || action === 'list') { ... }
```

### 2.3 ids 배열 검증 추가

```javascript
// 현재 (rebuild8 C-2)
await query('UPDATE questions SET subject_id = $1 WHERE id = ANY($2)', [subject_id, ids]);

// 수정
const validIds = ids.filter(id => Number.isInteger(Number(id))).map(Number);
if (validIds.length === 0) return res.status(400).json({ error: '유효한 ID가 없습니다.' });
```

### 2.4 보안 헤더 추가

```json
// vercel.json headers 섹션
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### 2.5 CORS 환경변수화

```javascript
// 현재: 하드코딩
const ALLOWED_ORIGINS = ['https://aitutor-six.vercel.app', ...];

// 개선: 환경변수
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://aitutor-six.vercel.app')
  .split(',').map(s => s.trim());
```

---

## 3. DB 성능 최적화 (P0)

### 3.1 누락 인덱스 추가

```sql
-- 문제 조회 성능 (가장 빈번한 쿼리)
CREATE INDEX idx_questions_exam_id ON questions(exam_id);
CREATE INDEX idx_questions_subject_id ON questions(subject_id);
CREATE INDEX idx_questions_exam_orig ON questions(exam_id, original_number);

-- 메모/해설 조회
CREATE INDEX idx_question_memos_question_id ON question_memos(question_id);
CREATE INDEX idx_question_explanations_question_id ON question_explanations(question_id);

-- 북마크/시험결과
CREATE INDEX idx_bookmarks_user_question ON bookmarks(user_id, question_id);
CREATE INDEX idx_exam_results_user_exam ON exam_results(user_id, exam_id);

-- 인증코드 만료 정리
CREATE INDEX idx_email_verifications_expires ON email_verifications(expires_at);
```

### 3.2 DB 커넥션 풀 최적화

```javascript
// 현재 (서버리스 최소)
max: 2, idleTimeoutMillis: 30000

// VPS 전환 시
max: 20, idleTimeoutMillis: 60000
// + statement_timeout: 30000 (30초 쿼리 타임아웃)
```

### 3.3 만료 데이터 정리

```sql
-- cron 또는 주기적 실행
DELETE FROM email_verifications WHERE expires_at < NOW() - INTERVAL '1 day';
DELETE FROM login_attempts WHERE reset_at < NOW();
```

---

## 4. 프론트엔드 리팩토링 (P1)

### 4.1 거대 컴포넌트 분할

#### LoginPage.jsx (628줄 → 4개 파일)

```
pages/LoginPage.jsx (80줄, 모드 전환 + 공통 레이아웃)
├── components/auth/LoginForm.jsx (100줄, 이메일+인증코드 2단계)
├── components/auth/SignupForm.jsx (120줄, 3단계 회원가입)
└── components/auth/VerifyCodeInput.jsx (60줄, 6자리 코드 입력 + 타이머)
```

#### QuizCard.jsx (383줄 → 4개 파일)

```
tabs/QuizTab/QuizCard.jsx (120줄, 상태 관리)
├── components/quiz/QuizCardHeader.jsx (50줄, 번호·북마크)
├── components/quiz/QuizCardBody.jsx (80줄, 문제·선택지)
└── components/quiz/QuizCardFeedback.jsx (50줄, 정답 표시)
```

#### ExamMode.jsx (413줄 → useReducer)

```javascript
// 현재: 13개 useState
const [phase, setPhase] = useState('setup');
const [categoryIds, setCategoryIds] = useState([]);
const [examIds, setExamIds] = useState([]);
// ... 10개 더

// 개선: useReducer
const initialState = {
  phase: 'setup', meta: {}, categoryIds: [], examIds: [],
  timeLimit: 60, questionCount: 50, questions: [],
  answers: {}, currentIdx: 0, timeLeft: 0, result: null,
};

function examReducer(state, action) {
  switch (action.type) {
    case 'SET_META': return { ...state, meta: action.payload };
    case 'START_EXAM': return { ...state, phase: 'exam', ...action.payload };
    case 'ANSWER': return { ...state, answers: { ...state.answers, ...action.payload } };
    case 'SUBMIT': return { ...state, phase: 'result', result: action.payload };
    case 'RESET': return { ...initialState, meta: state.meta };
    default: return state;
  }
}
```

### 4.2 공유 컴포넌트 추출

#### ChoiceButton (3곳에서 중복)

```
현재 중복: QuizCard.jsx, ExamMode.jsx, CardStudy.jsx

→ components/shared/ChoiceButton.jsx
  props: index, text, selected, correct, disabled, onClick
```

#### CategoryExamSelector → MultiSelect로 통합 완료 ✓

### 4.3 전역 상태 관리 (Zustand 도입)

```javascript
// stores/metaStore.js
import { create } from 'zustand';

const useMetaStore = create((set) => ({
  categories: [],
  exams: [],
  subjects: [],
  loading: true,
  fetchMeta: async () => {
    const data = await apiPost('/api/questions', { action: 'meta' });
    set({ ...data, loading: false });
  },
}));

// 사용: 4곳에서 중복되는 meta API 호출 → 1회로 통합
// QuizTab, RandomQuiz, CardStudy, ExamMode
```

**효과**: meta API 호출 75% 감소 (4회 → 1회)

### 4.4 성능 최적화

| 항목 | 현재 | 개선 |
|------|------|------|
| QuizCard 리렌더링 | 매번 전체 | `React.memo` 래핑 |
| 문제 목록 무한 스크롤 | 페이지 누적 | `react-window` 가상 스크롤 |
| meta API 중복 호출 | 페이지마다 | Zustand 전역 캐시 |
| 이미지 로딩 | `loading="lazy"` ✓ | 이미 적용됨 |

### 4.5 접근성 (A11y)

| 문제 | 위치 | 수정 |
|------|------|------|
| 선택지 aria-label 없음 | QuizCard, ExamMode | `aria-label={선택지 N: 텍스트}` |
| Modal role 없음 | Modal.jsx | `role="dialog" aria-modal="true"` |
| 포커스 트래핑 없음 | Modal.jsx | Tab 키 순환 |
| label-input 미연결 | LoginPage | `htmlFor` + `id` ✓ (이미 적용) |

---

## 5. 백엔드 리팩토링 (P1)

### 5.1 API 응답 형식 통일

```javascript
// 현재: 엔드포인트마다 다름
{ error: 'message' }
{ message: 'success' }
{ success: true }
{ questions: [...] }

// 통일 제안
// 성공
{ success: true, data: { ... } }

// 에러
{ success: false, error: { code: 'ERR_CODE', message: '메시지' } }
```

### 5.2 AI 프록시 개선

```javascript
// 1. 토큰 사용량 로깅
CREATE TABLE ai_usage_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  provider VARCHAR(20),
  model VARCHAR(50),
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

// 2. 공통 SSE 파싱 유틸
// lib/sse-parser.js
function parseSSELine(line) {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6);
  if (data === '[DONE]') return { done: true };
  return { done: false, data: JSON.parse(data) };
}

// 3. 재시도 로직 (exponential backoff)
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 5.3 입력 검증 체계화

```javascript
// lib/validate.js
function validateInt(value, { min = 1, max = 100000, name = 'value' } = {}) {
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new ValidationError(`${name}은(는) ${min}~${max} 범위여야 합니다.`);
  }
  return num;
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('올바른 이메일 형식이 아닙니다.');
  }
  return email.trim().toLowerCase();
}
```

### 5.4 감사 로깅

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(50),       -- 'login', 'admin_toggle', 'question_create', ...
  target_type VARCHAR(30),  -- 'user', 'question', 'exam'
  target_id INTEGER,
  detail JSONB,
  ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. 파이프라인 리팩토링 (P1)

### 6.1 공유 유틸 모듈

```javascript
// lib/pipeline-utils.js — 6개 스크립트에서 공통 사용
module.exports = {
  fileToBase64(filePath) { ... },
  parseCliArgs() { ... },
  callGeminiVision(genAI, parts) { ... },
  parseJsonResponse(text) { ... },  // JSON 추출 + 복구 로직 통합
  getOrCreateExam(title, categoryId) { ... },
  isDuplicate(examId, originalNumber) { ... },
};
```

**효과**: 6개 파일에서 ~300줄 중복 제거

### 6.2 QuestionExtractor 클래스

```javascript
// lib/question-extractor.js
class QuestionExtractor {
  constructor(examId, options = {}) {
    this.examId = examId;
    this.dryRun = options.dryRun || false;
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async extract(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.hwp') return this.extractHwp(filePath);
    if (ext === '.pdf') return this.extractPdf(filePath);
    return this.extractImage(filePath);
  }

  async extractHwp(hwpPath) { /* hwp5html 파이프라인 */ }
  async extractPdf(pdfPath) { /* poppler 파이프라인 */ }
  async extractImage(imgPath) { /* Vision 직접 */ }

  async saveToDb(questions, imageMap) { /* DB INSERT/UPDATE */ }
  async generateExplanations() { /* AI 해설 생성 */ }
  async verify() { /* 마커 검증 */ }
}

// 사용
const extractor = new QuestionExtractor(161, { dryRun: true });
const questions = await extractor.extract('시험.hwp');
await extractor.saveToDb(questions);
await extractor.generateExplanations();
await extractor.verify();
```

### 6.3 진행률 추적 (중단 후 재개)

```javascript
// DB 기반 작업 상태 추적
CREATE TABLE pipeline_jobs (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER,
  file_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, extracting, saving, explaining, done, failed
  total_questions INTEGER,
  processed INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. 기능 확장 제안 (P2)

### 7.1 학습 이력 추적 (최우선 기능)

```sql
CREATE TABLE study_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  question_id INTEGER REFERENCES questions(id),
  selected_choice INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  study_mode VARCHAR(20),  -- 'category', 'random', 'card', 'exam', 'bookmark'
  time_spent_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_study_results_user ON study_results(user_id, created_at);
```

**UI 확장**:
```
대시보드
  ├── 오늘 풀이 15/20문제 | 정답률 72% | 🔥 5일 연속
  ├── 과목별 정답률 바 차트
  │   ┃████████████ 네트워크 기초  85%
  │   ┃████████     TCP/IP         64%
  │   ┃██████       보안           48% ← 취약!
  └── 최근 오답 문제 (빠른 복습 버튼)
```

### 7.2 오답 노트

```
학습 허브에 "오답 노트" 메뉴 추가
  → study_results에서 is_correct=false인 문제만 조회
  → 카테고리별, 시험별 필터
  → 틀린 횟수 표시
  → "다시 풀기" 버튼
```

### 7.3 문제 검색

```javascript
// PostgreSQL 전문 검색
SELECT q.*, ts_rank(to_tsvector('simple', q.body), query) as rank
FROM questions q, to_tsquery('simple', $1) query
WHERE to_tsvector('simple', q.body) @@ query
ORDER BY rank DESC
LIMIT 20;

// UI: 검색바 + 실시간 결과
```

### 7.4 학습 통계 API

```javascript
// GET /api/stats?user_id=N
{
  total_solved: 500,
  correct_rate: 72.5,
  streak_days: 5,
  by_category: [
    { name: '네트워크 기초', solved: 100, correct: 85 },
    { name: 'TCP/IP', solved: 80, correct: 51 },
  ],
  recent_wrong: [ /* 최근 오답 문제 10개 */ ],
  daily_history: [ /* 최근 30일 풀이 수 */ ],
}
```

### 7.5 오프라인 모드

```
Service Worker + IndexedDB
  → 최근 본 문제 100개 캐시
  → 오프라인 상태에서도 문제 풀이 가능
  → 온라인 복귀 시 결과 동기화
```

---

## 8. 테스트 강화 (P2)

### 8.1 현재 상태

| 테스트 유형 | 파일 수 | 커버리지 |
|------------|---------|----------|
| E2E (Playwright) | 6 | 주요 흐름만 |
| 단위 테스트 | 0 | 없음 |
| 통합 테스트 | 0 | 없음 |

### 8.2 추가할 테스트

#### 백엔드 단위 테스트 (Vitest)

```javascript
// api/__tests__/login.test.js
test('이메일 인증코드 로그인 성공', async () => { ... });
test('만료된 인증코드 거부', async () => { ... });
test('미가입 이메일 거부', async () => { ... });
test('Rate limit 초과 시 429', async () => { ... });
```

#### 프론트엔드 컴포넌트 테스트

```javascript
// src/__tests__/QuizCard.test.jsx
test('선택지 클릭 시 정답/오답 표시', async () => { ... });
test('북마크 토글', async () => { ... });
test('전체 펼치기 시 모든 카드 열림', async () => { ... });
```

#### E2E 테스트 확대

```
현재 6개 → 목표 20개
추가:
  - 이메일 인증 회원가입 전체 플로우
  - 인증코드 로그인 플로우
  - 다중 선택 필터링
  - 시험 모드 전체 (설정→시험→채점→결과)
  - 관리자: 문제 CRUD
  - 관리자: 회원 관리
  - AI 해설 SSE 스트리밍
```

---

## 9. 인프라/배포 개선 (P2)

### 9.1 CI/CD 파이프라인

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    paths: ['workspace/aitutor/**']
  push:
    branches: [main]
    paths: ['workspace/aitutor/**']

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: workspace/aitutor
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build:fe
      - run: npx vitest run          # 단위 테스트
      - run: npx playwright test     # E2E 테스트
```

### 9.2 모니터링

```javascript
// Sentry 에러 추적
import * as Sentry from '@sentry/react';
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// Web Vitals 추적
import { onCLS, onLCP, onFID } from 'web-vitals';
onCLS(console.log); onLCP(console.log); onFID(console.log);
```

### 9.3 구조화된 로깅

```javascript
// lib/logger.js
const logger = {
  info: (msg, meta = {}) => console.log(JSON.stringify({
    level: 'info', msg, ts: new Date().toISOString(), ...meta
  })),
  error: (msg, err, meta = {}) => console.error(JSON.stringify({
    level: 'error', msg, error: err.message, stack: err.stack, ts: new Date().toISOString(), ...meta
  })),
};
```

### 9.4 네이버 클라우드 전환 (PIPELINE.md 섹션 12 참조)

```
VPS (Compact 2vCPU/4GB) + Cloud DB for PostgreSQL
→ HWP 웹 업로드 가능
→ 시간 제한 없음
→ 동적 이미지 서빙
→ 월 ~₩60,000
```

---

## 10. 장기 비전 (P3)

### 10.1 인증 확장

| 기능 | 우선순위 | 구현 난이도 |
|------|----------|------------|
| Google OAuth | 높음 | 중 |
| Apple 로그인 (앱 심사 필수) | 높음 | 높 |
| WebAuthn/FIDO2 (생체 인증) | 중 | 높 |
| 이중 인증 (이메일 + TOTP) | 중 | 중 |

### 10.2 확장 기능

| 기능 | 설명 |
|------|------|
| **다중 테넌트** | 학교/학원별 독립 인스턴스 |
| **푸시 알림** | 학습 리마인더 (FCM/APNs) |
| **실시간 랭킹** | 사용자 간 정답률 경쟁 |
| **AI 튜터 채팅** | 문제 관련 질의응답 (RAG) |
| **문제 공유** | 사용자가 문제 생성 + 공유 |
| **게이미피케이션** | 뱃지, 레벨, 연속 학습 보상 |

### 10.3 앱 스토어 배포

```
iOS: Capacitor → Xcode → TestFlight → App Store
Android: Capacitor → Android Studio → Play Store
필수: 개인정보 처리방침, 이용약관, Apple 로그인
```

---

## 11. 실행 로드맵

### Phase 0: 즉시 (1~2일)

```
[ ] 보안: 이메일 인증코드 실패 횟수 제한
[ ] 보안: questions.js GET 로직 수정 (C-1)
[ ] 보안: ids 배열 검증 (C-2)
[ ] 보안: vercel.json 보안 헤더 추가
[ ] DB: 인덱스 7개 추가
[ ] DB: 만료 데이터 정리 쿼리
```

### Phase 1: 1~2주

```
[ ] 프론트: LoginPage 분할 (628줄 → 4파일)
[ ] 프론트: QuizCard 분할 (383줄 → 4파일)
[ ] 프론트: ExamMode useReducer
[ ] 프론트: Zustand 전역 메타 캐시
[ ] 백엔드: API 응답 형식 통일
[ ] 백엔드: AI 토큰 사용량 로깅
[ ] 파이프라인: 공유 유틸 모듈 (pipeline-utils.js)
```

### Phase 2: 1~2개월

```
[ ] 기능: study_results + 학습 이력 추적
[ ] 기능: 오답 노트
[ ] 기능: 문제 검색 (PostgreSQL 전문 검색)
[ ] 기능: 학습 통계 대시보드
[ ] 테스트: Vitest 단위 테스트 도입
[ ] 테스트: E2E 20개로 확대
[ ] 인프라: CI/CD (GitHub Actions)
[ ] 인프라: Sentry 에러 추적
```

### Phase 3: 3~6개월

```
[ ] 인증: Google OAuth
[ ] 인증: Apple 로그인
[ ] 기능: 오프라인 모드 (Service Worker)
[ ] 기능: 푸시 알림
[ ] 인프라: 네이버 클라우드 VPS 전환
[ ] 배포: iOS/Android 앱 스토어
```

---

## 12. rebuild8 → rebuild9 변경 사항

| 항목 | rebuild8 (03-26) | rebuild9 (03-26) |
|------|-----------------|-----------------|
| 문제 수 | 1,490 | 1,490 (동일) |
| 인증 방식 | username+password | **이메일+인증코드 (Resend)** |
| 파이프라인 | pool-import.js만 | **5단계 통합 (HWP/PDF/이미지)** |
| 표/그림 복원 | 230개 미복원 | **0개 (완전 복원)** |
| 이미지 서빙 | 없음 | **243개 (정적 서빙)** |
| 다중 선택 | 단일 선택만 | **MultiSelect 5개 페이지** |
| 권한 관리 | 전체 노출 | **일반/관리자 메뉴 분리** |
| 보안 분석 | 25건 식별 | 25건 + **8건 트러블슈팅 해결** |
| 문서 | rebuild7/8 | rebuild7/8 + **PIPELINE.md (1,236줄)** |
| 코드 분석 | 정성적 | **정량적 (줄 수, 복잡도, 인덱스)** |
