# AI TutorTwo — 보안·리팩토링·프로덕션 배포 종합 개선안 (rebuild8)

> 작성일: 2026-03-26
> 프로젝트: workspace/aitutor
> 배포: https://aitutor-six.vercel.app
> 기반 문서: rebuild6.md (코드베이스 분석), rebuild7-pool-import.md (기출문제 대량 등록)

---

## 1. 분석 범위 및 현황 요약

| 영역 | 파일 수 | 분석 결과 |
|------|---------|-----------|
| 프론트엔드 (src/) | 28개 | 성능·상태관리·접근성 개선 필요 |
| 백엔드 API (api/) | 17개 | 보안 취약점 25건 식별 |
| 배치 스크립트 | 2개 | 감사 로깅·검증 부재 |
| Playwright 테스트 | 6개 | 커버리지 부족 |
| 배포 설정 | vercel.json | 보안 헤더 미흡 |

### 현재 DB 규모

| 카테고리 | 시험 수 | 문제 수 | 비고 |
|----------|---------|---------|------|
| 영상정보관리사 | (기존) | (기존) | rebuild6 기준 |
| 네트워크관리사2급 | 25개 | 1,250 | rebuild7에서 등록 |
| **합계** | — | **1,500+** | 지속 증가 중 |

---

## 2. 보안 취약점 (총 25건)

### 2-1. CRITICAL (즉시 수정 필요)

#### C-1. questions.js GET 요청 로직 오류

**파일:** `api/questions.js` 라인 44
**문제:** `if (req.method === 'GET' || action === 'list')` — OR 조건이므로 action 없는 GET 요청도 list로 처리됨. 관리자 전용 action(create/update/delete)에 도달하기 전에 빠져나가므로 직접적 위험은 낮지만, 예상치 못한 데이터 노출 가능.

```javascript
// 현재 (위험)
if (req.method === 'GET' || action === 'list') { ... }

// 수정
if ((req.method === 'GET' && !action) || action === 'list') { ... }
```

#### C-2. ids 배열 미검증 SQL 실행

**파일:** `api/questions.js` 라인 145-147
**문제:** `assignSubject` action에서 `ids` 배열을 검증 없이 `ANY($2)`로 전달. 비정수 요소가 포함되면 예외 발생 또는 예상치 못한 동작.

```javascript
// 수정
const validIds = ids.filter(id => Number.isInteger(Number(id))).map(Number);
if (validIds.length === 0) return res.status(400).json({ error: '유효한 ID가 없습니다.' });
await query('UPDATE questions SET subject_id = $1 WHERE id = ANY($2)', [subject_id || null, validIds]);
```

---

### 2-2. HIGH (1주 내 수정)

#### H-1. AI API 엔드포인트 Rate Limiting 부재

**파일:** `api/gemini.js`, `api/openai.js`, `api/claude.js`
**문제:** 인증된 사용자가 무제한 AI API 호출 가능 → 과다 비용 발생 위험

```
제안: 사용자별 일일 호출 한도
─────────────────────────────
gemini:  100회/일
openai:   50회/일
claude:   30회/일
```

**구현 방안:**
```javascript
// api/rate-limit.js (신규)
const LIMITS = { gemini: 100, openai: 50, claude: 30 };

async function checkAiRateLimit(userId, provider) {
  const { rows } = await query(
    `SELECT COUNT(*) FROM ai_usage_log
     WHERE user_id = $1 AND provider = $2
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId, provider]
  );
  return parseInt(rows[0].count) < LIMITS[provider];
}
```

#### H-2. Gemini API 키가 URL에 노출

**파일:** `api/gemini.js` 라인 76, 124
**문제:** `?key=${apiKey}`가 URL 쿼리 파라미터에 포함 → 서버 로그, 프록시, CDN에 기록됨

```javascript
// 현재 (위험)
const url = `https://...?alt=sse&key=${apiKey}`;

// 수정 — Authorization 헤더 사용
const url = `https://...?alt=sse`;
const headers = {
  'Content-Type': 'application/json',
  'x-goog-api-key': apiKey  // Gemini 권장 헤더
};
```

#### H-3. 비밀번호 정책 약함

**파일:** `api/signup.js` 라인 39-41
**문제:** 최소 4자 → 무차별 대입 공격에 매우 취약

```javascript
// 현재
if (password.length < 4) { ... }

// 수정 — 최소 8자 + 복잡성 검증
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
if (!PASSWORD_REGEX.test(password)) {
  return res.status(400).json({
    error: '비밀번호는 8자 이상, 영문+숫자를 포함해야 합니다.'
  });
}
```

#### H-4. 메모/북마크 사용자 격리 없음

**파일:** `api/memos.js`, `api/bookmarks.js`
**문제:** question_id만으로 조회 → 다른 사용자의 메모/북마크 노출 가능

```javascript
// 현재
WHERE question_id = $1

// 수정 — user_id 필터 추가
WHERE question_id = $1 AND user_id = $2
```

#### H-5. 파일 업로드 검증 부재

**파일:** `api/memo-files.js` 라인 54-77
**문제:** 파일명 경로 순회 공격, MIME 타입 스푸핑 가능

```javascript
// 파일명 검증 추가
const SAFE_FILENAME = /^[a-zA-Z0-9가-힣._\-\s]+$/;
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

for (const f of files) {
  if (!SAFE_FILENAME.test(f.filename)) continue;
  if (!ALLOWED_MIMES.includes(f.mime_type)) continue;
  if (Buffer.byteLength(f.data, 'base64') > MAX_FILE_SIZE) continue;
  // ... 저장
}
```

---

### 2-3. MEDIUM (2주 내 수정)

| # | 문제 | 파일 | 수정 방안 |
|---|------|------|-----------|
| M-1 | SSL 인증서 검증 비활성화 (`rejectUnauthorized: false`) | `api/db.js:11` | 프로덕션에서는 `true`로 전환 또는 Supabase 인증서 체인 사용 |
| M-2 | CORS 헤더 무조건 설정 (Allow-Methods/Headers) | `api/cors.js:14-15` | 허용 Origin일 때만 헤더 설정 |
| M-3 | Rate Limit DB 오류 시 우회 | `api/login.js:21-43` | Redis 기반 Rate Limiting 또는 인메모리 폴백 |
| M-4 | `x-forwarded-for` 스푸핑 | `api/login.js:22` | Vercel의 `x-real-ip` 헤더 우선 사용 |
| M-5 | 에러 응답에 `err.message` 노출 | `api/categories.js:139`, `api/openai.js:139` | 클라이언트에는 일반 메시지, 서버 로그에만 상세 |
| M-6 | 관리자 인증 불일치 (withAdmin vs 수동 체크) | `api/categories.js:29-33` | 모든 관리자 엔드포인트 `withAdmin` 래퍼 통일 |
| M-7 | 감사 로깅 없음 (관리자 작업) | `api/admin.js` | `audit_logs` 테이블 생성 후 기록 |
| M-8 | DB 쿼리 타임아웃 없음 | `api/db.js:21-29` | `statement_timeout` 30초 설정 |
| M-9 | `page`/`limit` 범위 미검증 | `api/questions.js:45-46` | `Math.min(Math.max(...))` 바운드 처리 |

---

### 2-4. LOW (점진 개선)

| # | 문제 | 수정 방안 |
|---|------|-----------|
| L-1 | 보안 헤더 부족 (HSTS, CSP 등) | vercel.json에 추가 (아래 참조) |
| L-2 | 에러 응답 형식 불일치 | 표준 응답 포맷 통일 |
| L-3 | 입력 검증 라이브러리 미사용 | `zod` 또는 `joi` 도입 |
| L-4 | 배치 스크립트 직접 DB 접근 | dry-run 기본 + 확인 프롬프트 |

### 보안 헤더 추가 (vercel.json)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

---

## 3. 프론트엔드 리팩토링

### 3-1. 거대 컴포넌트 분할 (P0)

#### ExamMode.jsx (413줄 → 4개 파일)

```
pages/ExamMode.jsx (80줄, 상태 관리 + 라우팅)
├── components/exam/ExamSetup.jsx   (100줄, 설정 화면)
├── components/exam/ExamProgress.jsx (130줄, 시험 진행)
└── components/exam/ExamResult.jsx   (100줄, 결과 화면)
```

**현재 문제:**
- 13개 useState → `useReducer`로 통합
- 3개 phase가 한 파일에 혼재
- 테스트 불가능한 구조

```javascript
// 개선: useReducer 도입
const initialState = {
  phase: 'setup',          // setup | exam | result
  meta: { categories: [], exams: [] },
  categoryId: '', examId: '',
  timeLimit: 60, questionCount: 50,
  questions: [], answers: {},
  currentIdx: 0, timeLeft: 0,
  result: null,
  loading: false, error: null,
};

function examReducer(state, action) {
  switch (action.type) {
    case 'SET_META':      return { ...state, meta: action.payload, metaLoading: false };
    case 'START_EXAM':    return { ...state, phase: 'exam', ...action.payload };
    case 'ANSWER':        return { ...state, answers: { ...state.answers, ...action.payload } };
    case 'SUBMIT':        return { ...state, phase: 'result', result: action.payload };
    case 'RESET':         return { ...initialState, meta: state.meta };
    default:              return state;
  }
}
```

#### QuizCard.jsx (383줄 → 4개 파일)

```
tabs/QuizTab/QuizCard.jsx (120줄, 상태 관리)
├── components/quiz/QuizCardHeader.jsx   (50줄, 번호·북마크)
├── components/quiz/QuizCardBody.jsx     (80줄, 문제·선택지)
└── components/quiz/QuizCardFeedback.jsx (50줄, 정답 표시)
```

### 3-2. 공유 컴포넌트 추출 (P1)

#### ChoiceButton (3곳에서 중복)

```javascript
// 현재 중복 위치:
// 1) QuizCard.jsx 라인 265-282
// 2) ExamMode.jsx 라인 280-298
// 3) CardStudy.jsx (유사 패턴)

// 제안: components/shared/ChoiceButton.jsx
const CIRCLE = ['①', '②', '③', '④', '⑤'];

export default function ChoiceButton({ index, text, selected, correct, disabled, onClick }) {
  return (
    <button
      onClick={() => onClick(index)}
      disabled={disabled}
      aria-label={`선택지 ${CIRCLE[index]}: ${text}`}
      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border
        text-left text-sm transition-all duration-200 ${getStyle(index, selected, correct, disabled)}`}
    >
      <span className="flex-shrink-0 font-bold mt-0.5">{CIRCLE[index]}</span>
      <span className="flex-1">{text}</span>
    </button>
  );
}
```

#### CategoryExamSelector (3곳에서 중복)

```javascript
// 현재 중복 위치: RandomQuiz, CardStudy, ExamMode
// 제안: components/shared/CategoryExamSelector.jsx
export default function CategoryExamSelector({
  categories, exams, categoryId, examId,
  onCategoryChange, onExamChange
}) {
  const filteredExams = useMemo(
    () => categoryId ? exams.filter(e => e.category_id == categoryId) : exams,
    [exams, categoryId]
  );
  // ... 렌더링
}
```

### 3-3. 성능 최적화 (P1)

| 항목 | 현재 | 개선 | 위치 |
|------|------|------|------|
| 필터 재계산 | 매 렌더링 `.filter()` | `useMemo` 래핑 | QuizTab, RandomQuiz, CardStudy |
| 핸들러 재선언 | 매 렌더링 새 함수 | `useCallback` + loadingRef | RandomQuiz, AiExplanation |
| API 중복 호출 | 페이지별 `/api/questions?action=meta` | **MetaContext** 전역 캐시 | LearnHub 등 4곳 |
| API 캐싱 | 매번 fetch | SWR 패턴 (stale-while-revalidate) | 전체 |
| 이벤트 리스너 | LawLink마다 개별 등록 | 부모 이벤트 위임 | LawLink.jsx |

#### MetaContext 도입 (API 호출 75% 감소)

```javascript
// src/contexts/MetaContext.jsx (신규)
const MetaContext = createContext();

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState({ categories: [], exams: [], totalQuestions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiPost('/api/questions', { action: 'meta' })
      .then(data => setMeta(data))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    apiPost('/api/questions', { action: 'meta' }).then(setMeta);
  }, []);

  return (
    <MetaContext.Provider value={{ meta, loading, refresh }}>
      {children}
    </MetaContext.Provider>
  );
}

export const useMeta = () => useContext(MetaContext);
```

### 3-4. 상태 관리 개선 (P2)

| 현재 | 문제 | 개선 |
|------|------|------|
| Context 2개 (Image, Category) | 공유 상태 부족 | MetaContext + StudyContext 추가 |
| ExamMode 13개 useState | 추적 어려움 | `useReducer` 통합 |
| ImportTab 7개 setState 연쇄 | 불필요한 리렌더링 | `useReducer` 통합 |
| 각 컴포넌트 URL 하드코딩 | 유지보수 어려움 | API 클라이언트 모듈 분리 |

### 3-5. 접근성(A11y) 개선 (P2)

| 문제 | 위치 | 수정 |
|------|------|------|
| 선택지 aria-label 없음 | QuizCard, ExamMode | `aria-label={선택지 N: 텍스트}` |
| Modal role/aria-modal 없음 | Modal.jsx | `role="dialog" aria-modal="true"` |
| 포커스 트래핑 없음 | Modal.jsx | Tab 키 순환 처리 |
| label-input 연결 없음 | LoginPage | `htmlFor` + `id` 추가 |
| 아이콘 버튼 설명 없음 | BottomNav 등 | `aria-label` 추가 |

---

## 4. 백엔드 리팩토링

### 4-1. API 응답 형식 표준화

```javascript
// 현재: 엔드포인트마다 다른 형식
{ error: 'message' }
{ error: 'message', detail: '...' }
{ message: 'success' }
{ success: true }

// 통일 제안
// 성공
{ success: true, data: { ... } }

// 에러
{ success: false, error: { code: 'ERR_CODE', message: '사용자 친화적 메시지' } }
```

### 4-2. 미들웨어 사용 일관성

```javascript
// 현재: categories.js — 수동 인증
if (req.method === 'POST') {
  const token = extractToken(req);
  const payload = verifyToken(token);
  if (!payload || !payload.admin) { return res.status(403)... }
}

// 개선: 모든 관리자 엔드포인트를 withAdmin 래핑
module.exports = withCors(async (req, res) => {
  if (req.method === 'GET') { /* 공개 조회 */ }
  if (req.method === 'POST') { return withAdmin(handlePost)(req, res); }
});
```

### 4-3. API 클라이언트 모듈 (프론트엔드)

```javascript
// src/lib/api/questionApi.js (신규)
import { apiGet, apiPost } from '../api';

export const questionApi = {
  meta:   ()           => apiPost('/api/questions', { action: 'meta' }),
  list:   (params)     => apiGet(`/api/questions?${new URLSearchParams(params)}`),
  create: (data)       => apiPost('/api/questions', { action: 'create', ...data }),
  update: (id, data)   => apiPost('/api/questions', { action: 'update', id, ...data }),
  delete: (id)         => apiPost('/api/questions', { action: 'delete', id }),
  assign: (ids, subId) => apiPost('/api/questions', { action: 'assignSubject', ids, subject_id: subId }),
};

// src/lib/api/memoApi.js (신규)
export const memoApi = {
  list:   (questionId) => apiGet(`/api/memos?action=list&question_id=${questionId}`),
  create: (data)       => apiPost('/api/memos', { action: 'create', ...data }),
  update: (id, data)   => apiPost('/api/memos', { action: 'update', id, ...data }),
  delete: (id)         => apiPost('/api/memos', { action: 'delete', id }),
};
```

### 4-4. 입력 검증 체계화

```javascript
// api/lib/validate.js (신규)
function validateInt(value, { min = 1, max = 100000, name = 'value' } = {}) {
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new ValidationError(`${name}은(는) ${min}~${max} 범위여야 합니다.`);
  }
  return num;
}

function validateString(value, { minLen = 1, maxLen = 10000, name = 'value' } = {}) {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${name}을(를) 입력해주세요.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minLen || trimmed.length > maxLen) {
    throw new ValidationError(`${name}은(는) ${minLen}~${maxLen}자 범위여야 합니다.`);
  }
  return trimmed;
}
```

---

## 5. 프로덕션 앱 배포 시 보완사항

### 5-1. Capacitor 네이티브 앱 (iOS/Android) 배포 체크리스트

| 항목 | 현재 상태 | 프로덕션 요구사항 |
|------|-----------|-------------------|
| SSL Pinning | 없음 | MITM 방지를 위한 인증서 고정 필수 |
| 딥링크 | 미구현 | Universal Links (iOS) / App Links (Android) |
| 푸시 알림 | 미구현 | FCM/APNs 연동 (학습 리마인더) |
| 앱 업데이트 | 수동 | 강제 업데이트 체크 API |
| 오프라인 | 빨간 배너만 | Service Worker + IndexedDB 캐싱 |
| Crash Reporting | 없음 | Sentry 또는 Firebase Crashlytics |
| Analytics | 없음 | Firebase Analytics 또는 자체 이벤트 로깅 |
| 앱스토어 심사 | — | 개인정보 처리방침, 이용약관 필수 |

#### SSL Pinning 구현 (Capacitor)

```javascript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aitutor.app',
  server: {
    hostname: 'aitutor-six.vercel.app',
    androidScheme: 'https',
    // iOS: Info.plist에서 ATS 설정
  },
};
```

```xml
<!-- iOS: Info.plist — App Transport Security -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>aitutor-six.vercel.app</key>
    <dict>
      <key>NSExceptionRequiresForwardSecrecy</key>
      <true/>
      <key>NSExceptionMinimumTLSVersion</key>
      <string>TLSv1.3</string>
    </dict>
  </dict>
</dict>
```

### 5-2. 환경 분리

```
현재: Production 1개
  └─ DB: Supabase 프로덕션 직접 사용
  └─ API 키: 동일 키 공유

개선:
  ├─ Development  (localhost:5173)
  │   └─ DB: Supabase 개발용 프로젝트
  │   └─ API 키: 개발용 키 (사용량 제한)
  │
  ├─ Preview  (Vercel Preview)
  │   └─ DB: Supabase 스테이징 프로젝트
  │   └─ API 키: 스테이징 키
  │
  └─ Production  (aitutor-six.vercel.app)
      └─ DB: Supabase 프로덕션
      └─ API 키: 프로덕션 키 (모니터링)
```

### 5-3. CI/CD 파이프라인

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
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: workspace/aitutor
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - name: Deploy Preview
        if: github.event_name == 'pull_request'
        run: npx vercel --yes
      - name: Deploy Production
        if: github.ref == 'refs/heads/main'
        run: npx vercel --prod --yes
```

### 5-4. 모니터링 (프로덕션 필수)

| 영역 | 도구 | 설정 |
|------|------|------|
| 에러 추적 | **Sentry** | `@sentry/react` + Vercel Integration |
| API 응답시간 | **Vercel Analytics** | Speed Insights 활성화 |
| 사용자 행동 | **자체 이벤트 로깅** | `ai_usage_log`, `study_results` 테이블 |
| 서버 상태 | **Vercel Functions 로그** | 콜드스타트, 타임아웃 모니터링 |
| DB 성능 | **Supabase Dashboard** | 슬로우 쿼리, 연결 수 모니터링 |

#### Sentry 연동

```javascript
// src/main.jsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,  // 프로덕션 10%만 추적
  replaysSessionSampleRate: 0.01,
});
```

### 5-5. 데이터 보호 및 컴플라이언스

| 항목 | 현재 | 프로덕션 필수 |
|------|------|---------------|
| 개인정보 처리방침 | 없음 | 법적 필수 (앱스토어 심사 요건) |
| 이용약관 | 없음 | 서비스 이용 조건 명시 |
| 회원 탈퇴 | 미구현 | GDPR/개인정보보호법 필수 |
| 데이터 내보내기 | 미구현 | 학습 이력 CSV 다운로드 |
| 쿠키 동의 | 없음 | HttpOnly 쿠키 사용 고지 |
| DB 백업 | Supabase 자동 | 일간 백업 + 복원 테스트 |

---

## 6. 기능 확장 (rebuild6 대비 업데이트)

### 6-1. rebuild6에서 제안 → 현재 구현 상태

| 기능 | rebuild6 상태 | 현재 상태 | 비고 |
|------|---------------|-----------|------|
| 시험 모드 (ExamMode) | 제안 | ✅ 구현 완료 | 타이머 + 채점 + 결과 |
| 북마크/즐겨찾기 | 제안 | ✅ 구현 완료 | BookmarkStudy 페이지 |
| 법령 링크 (LawLink) | 미언급 | ✅ 구현 완료 | 해설 내 법령 참조 |
| 학습 이력 저장 | 제안 | ❌ 미구현 | 최우선 과제 |
| 오답 노트 | 제안 | ❌ 미구현 | study_results 필요 |
| 문제 검색 | 제안 | ❌ 미구현 | PostgreSQL 전문 검색 |
| 오프라인 학습 | 제안 | ❌ 미구현 | Service Worker 필요 |
| MetaContext | 제안 | ❌ 미구현 | API 중복 해소 핵심 |

### 6-2. 신규 확장 제안

#### 학습 이력 추적 (최우선)

```sql
-- DB 테이블 추가
CREATE TABLE study_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  question_id INTEGER REFERENCES questions(id),
  selected_choice INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  study_mode VARCHAR(20) NOT NULL,  -- 'category' | 'random' | 'card' | 'exam' | 'bookmark'
  time_spent_ms INTEGER,            -- 문제 풀이 소요 시간
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_results_user ON study_results(user_id, created_at);
CREATE INDEX idx_study_results_question ON study_results(question_id);
```

#### 대시보드 확장

```
┌──────────────────────────────────────────────┐
│  카테고리 3 │ 시험 35+ │ 문제 1,500+          │
├──────────────────────────────────────────────┤
│  오늘 풀이 15/20 │ 정답률 72% │ 🔥 5일 연속   │
├──────────────────────────────────────────────┤
│  과목별 정답률 (바 차트)                       │
│  ┃████████████ 네트워크 기초  85%              │
│  ┃████████     TCP/IP         64%              │
│  ┃██████       보안           48% ← 취약!      │
├──────────────────────────────────────────────┤
│  최근 오답 문제 (빠른 복습 버튼)               │
└──────────────────────────────────────────────┘
```

#### 감사 로깅 시스템

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(50) NOT NULL,      -- 'login' | 'admin_toggle' | 'question_create' ...
  target_type VARCHAR(30),          -- 'user' | 'question' | 'exam' | 'category'
  target_id INTEGER,
  detail JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);
```

#### AI 사용량 모니터링

```sql
CREATE TABLE ai_usage_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  provider VARCHAR(20) NOT NULL,    -- 'gemini' | 'openai' | 'claude'
  model VARCHAR(50),
  token_count INTEGER,
  question_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user ON ai_usage_log(user_id, created_at);
```

---

## 7. 테스트 보강

### 7-1. 현재 커버리지 (부족)

| 영역 | 테스트 여부 | 설명 |
|------|-------------|------|
| 로그인 | 부분적 | 기본 렌더링만 |
| 문제 풀이 | 부분적 | UI 렌더링만 |
| AI 해설 | ❌ | SSE 모킹 필요 |
| 시험 모드 | ❌ | 타이머·채점 미검증 |
| 북마크 | ❌ | 생성/삭제 미검증 |
| 관리자 기능 | ❌ | CRUD 미검증 |

### 7-2. 추가 테스트 계획

```javascript
// tests/exam-mode.spec.js (예시)
test('시험 모드 전체 플로우', async ({ page }) => {
  await login(page);
  await page.click('[data-tab="learn"]');
  await page.click('text=시험 모드');

  // 설정
  await page.selectOption('#category', { index: 1 });
  await page.fill('#timeLimit', '30');
  await page.click('text=시험 시작');

  // 문제 풀기
  await expect(page.locator('.timer')).toBeVisible();
  await page.click('.choice-btn:first-child');
  await page.click('text=다음');

  // 제출
  await page.click('text=시험 종료');
  await expect(page.locator('.result-score')).toBeVisible();
});
```

### 7-3. 유닛 테스트 도입

```bash
# Vitest + React Testing Library 설치
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```javascript
// vite.config.js에 추가
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
  },
});
```

---

## 8. 우선순위 로드맵 (업데이트)

### Phase 1: 보안 강화 (3~5일) ← 최우선

- [ ] C-1: questions.js GET 요청 로직 수정
- [ ] C-2: ids 배열 검증 추가
- [ ] H-1: AI API Rate Limiting 구현 (ai_usage_log 테이블)
- [ ] H-2: Gemini API 키 헤더 전환
- [ ] H-3: 비밀번호 정책 강화 (8자+영문+숫자)
- [ ] H-4: 메모/북마크 user_id 격리
- [ ] H-5: 파일 업로드 검증 (파일명, MIME, 크기)
- [ ] L-1: 보안 헤더 추가 (vercel.json)

### Phase 2: 리팩토링 (1주)

- [ ] ExamMode 컴포넌트 분할 (3→4개)
- [ ] QuizCard 컴포넌트 분할 (1→4개)
- [ ] ChoiceButton, CategoryExamSelector 공유 컴포넌트
- [ ] MetaContext 도입 (API 호출 75% 감소)
- [ ] useReducer 도입 (ExamMode, ImportTab)
- [ ] API 클라이언트 모듈 분리

### Phase 3: 핵심 기능 (1~2주)

- [ ] study_results 테이블 + 풀이 기록 저장
- [ ] 대시보드 정답률/진도 표시
- [ ] 오답 노트 (틀린 문제만 복습)
- [ ] audit_logs 테이블 + 관리자 감사 로깅
- [ ] 에러 처리 통일 (표준 응답 + Toast)

### Phase 4: 프로덕션 준비 (1주)

- [ ] Sentry 에러 추적 연동
- [ ] 환경 분리 (Dev/Preview/Prod)
- [ ] CI/CD 파이프라인 (GitHub Actions)
- [ ] E2E 테스트 확대 (시험 모드, 북마크, AI 해설)
- [ ] 개인정보 처리방침 + 이용약관 페이지

### Phase 5: 앱스토어 배포 (2~3주)

- [ ] SSL Pinning (Capacitor)
- [ ] 딥링크 구현
- [ ] 오프라인 모드 (Service Worker + IndexedDB)
- [ ] 푸시 알림 (학습 리마인더)
- [ ] 앱스토어 심사 대응 (스크린샷, 설명, 법적 문서)
- [ ] 강제 업데이트 체크 API

---

## 9. 보안 취약점 요약 매트릭스

| 심각도 | 건수 | 핵심 이슈 |
|--------|------|-----------|
| **CRITICAL** | 2건 | GET 로직 오류, ids 배열 미검증 |
| **HIGH** | 5건 | AI Rate Limit 없음, API 키 URL 노출, 약한 비밀번호, 사용자 격리 없음, 파일 검증 없음 |
| **MEDIUM** | 9건 | SSL 검증 비활성, CORS 설정, IP 스푸핑, 에러 노출, 인증 불일치, 감사 없음, 쿼리 타임아웃, 파라미터 범위 |
| **LOW** | 4건 | 보안 헤더, 응답 형식, 검증 라이브러리, 배치 스크립트 |
| **합계** | **20건** | |

---

## 10. rebuild6 → rebuild8 변경 사항 요약

| 항목 | rebuild6 (2026-03-19) | rebuild8 (2026-03-26) |
|------|----------------------|----------------------|
| 문제 수 | ~280문제 | 1,500+ (네관2급 1,250 추가) |
| 시험 모드 | 제안 | ✅ 구현 완료 |
| 북마크 | 제안 | ✅ 구현 완료 |
| 법령 링크 | 미언급 | ✅ 구현 완료 |
| 보안 분석 | 미실시 | 25건 취약점 식별 |
| 프로덕션 배포 가이드 | 미포함 | Capacitor/앱스토어 체크리스트 |
| CI/CD | 제안 | GitHub Actions 워크플로우 포함 |
| 데이터 보호 | 미언급 | 컴플라이언스 체크리스트 포함 |

---

## 11. 2026-03-26 작업 내역 + 트러블슈팅

### 11.1 문제 DB화 파이프라인 구축

| 커밋 | 내용 |
|------|------|
| `2eebdc4` | pool 임포트 표/그림 Vision 보존 + 웹 업로드 UI (PoolUpload.jsx) |
| `914e36b` | 원본 HWP 기반 표/그림 누락 210문제 DB 복원 (25개 시험 일괄) |
| `a76c7ec` | 통합 파이프라인 — 이미지 직접 서빙 + Vision 텍스트 변환 (13문제) |
| `e347dce` | pool-repatch.js PDF/이미지 지원 확장 |
| `9ef8561` | PDF 2단계 파이프라인 — poppler 기반 텍스트+표+이미지 분리 추출 |

**결과**: `<표>`/`<그림>` 미복원 0건, 이미지 13개 정적 서빙

### 11.2 이메일 인증 로그인 (Resend)

| 커밋 | 내용 |
|------|------|
| `3da3e60` | 이메일 인증 기반 회원가입/로그인 전환 (send-verification + forgot-password) |
| `b40c3b9` | 인증코드 단일 로그인으로 전환 — 비밀번호 완전 제거 |

**변경**: username+password 방식 → email+인증코드(Resend) 방식으로 단일화

### 11.3 UI/UX 개선

| 커밋 | 내용 |
|------|------|
| `c2b97e6` | 카테고리/시험 다중 선택 (MultiSelect 컴포넌트 신규, 5개 페이지 적용) |
| `c41fc9a` | 문제풀이 전체 펼치기/접기 토글 |
| `129e3bc` | 카테고리/시험 선택 상태 localStorage 저장 (useFilterState 훅) |
| `9741f3d` | 헤더 응원 문구 — 페이지 이동마다 랜덤 변경 (18종) |
| `42abfc8` | 헤더 2줄 레이아웃 — 1줄 로고+문구+이름 / 2줄 다크모드+로그아웃 |
| `7c64a7f` | 플로팅 최상단 이동 버튼 (스크롤 300px 이상 시 표시) |

### 11.4 권한 관리

| 커밋 | 내용 |
|------|------|
| `135cb02` | 일반 사용자 관리/연동 탭 숨김 — 하단 네비 2탭(학습+설정) |
| `cfb0b54` | 일반 사용자 설정 → 내 계정 탭만 (계정 정보+캐시 삭제+로그아웃+탈퇴) |
| `029fb33` | 내 계정에 캐시 삭제 기능 추가 |
| `aea486d` | 회원관리 2줄 레이아웃 + 버튼 항상 노출 |

### 11.5 기타

| 커밋 | 내용 |
|------|------|
| `e75906c` | 3개 프로젝트 AI 모델 크로스 최신화 (Gemini 2.0 폐기, 3.x thinkingLevel) |
| `05e0e92` | 영상정보관리사 이미지 230개 추가 + DB 경로 수정 |

### 11.6 트러블슈팅 (8건)

#### TS-1: 표/그림 마커 `<표>` 복원 안 됨

```
증상: 기존 1,250문제 중 230개에 <표>/<그림> 마커만 있고 실제 내용 없음
원인: 초기 등록 시 hwp5txt가 표/그림을 텍스트로 변환하지 못함
해결: hwp5html로 HTML 변환 → <table> 태그 보존 → Gemini 재파싱 → DB UPDATE
커밋: 914e36b (210문제), a76c7ec (13문제 이미지)
```

#### TS-2: 이미지 깨짐 (error-liart.vercel.app 참조)

```
증상: 문제 이미지가 다른 프로젝트(error) URL을 참조하여 깨짐
원인: QuizCard/ExamMode/QuestionForm에서 상대경로를 error-liart.vercel.app으로 변환
해결: 외부 URL 참조 제거 → 상대경로(/q-images/...) 그대로 사용
커밋: a55680d
```

#### TS-3: BMP 이미지 Gemini Vision 전송 실패

```
증상: HWP 내장 BMP 이미지를 Gemini에 전송 시 400 Bad Request
원인: Gemini가 image/bmp MIME 미지원
해결: macOS sips로 BMP → JPEG 자동 변환 후 전송
커밋: a76c7ec
```

#### TS-4: 로그인 안 됨 (email 컬럼 없음)

```
증상: 이메일 로그인 전환 후 500 Server Error
원인: public.users 테이블에 email 컬럼이 존재하지 않음
해결: ALTER TABLE ADD COLUMN email + OR 조건 쿼리
커밋: 4eb25f7 (코드) + DB 스키마 수정
```

#### TS-5: 회원가입 500 에러 (password_hash NOT NULL)

```
증상: 인증코드 방식 회원가입 시 500 에러
원인: password_hash 컬럼이 NOT NULL 제약인데 비밀번호 없이 INSERT
해결: ALTER TABLE ALTER COLUMN password_hash DROP NOT NULL
커밋: DB 스키마 수정
```

#### TS-6: 로그인 후 즉시 튕김 (meta API 403)

```
증상: 로그인 성공 후 메인 화면 진입 시 바로 로그아웃됨
원인: questions.js의 action='meta'가 관리자 전용 블록 안에 위치
      → 일반 사용자 403 → apiFetch에서 clearAuth() → 튕김
해결: meta를 관리자 체크 위로 이동 + 403에서 clearAuth 제거 (401만 로그아웃)
커밋: 4b3ce89
```

#### TS-7: MultiSelect 드롭다운 투명/다크모드 글자 안 보임

```
증상: 드롭다운 배경이 투명해서 뒤 글자 겹침 + 다크모드에서 글자 안 보임
원인: bg-card 클래스가 투명, text-text 클래스가 다크모드 미대응
해결: bg-white dark:bg-gray-900 + text-gray-900 dark:text-gray-100 명시
커밋: 96084be, 160f049
```

#### TS-8: 영상정보관리사 이미지 안 보임

```
증상: 영상정보관리사 문제의 이미지가 모두 깨짐
원인: image_url이 'q001.png' (파일명만) + 실제 파일이 aitutor에 없음
해결: error 프로젝트에서 230개 이미지 복사 + DB 경로 /q-images/ 접두사 추가
커밋: 05e0e92
```

### 11.7 전체 커밋 목록 (2026-03-26, 29건)

| # | 커밋 | 타입 | 내용 |
|---|------|------|------|
| 1 | `2eebdc4` | feat | pool 임포트 표/그림 보존 + 웹 업로드 UI |
| 2 | `914e36b` | fix | 원본 HWP 기반 표/그림 210문제 복원 |
| 3 | `d52f4c9` | docs | rebuild7 문서 업데이트 |
| 4 | `a55680d` | fix | 이미지 URL 자체 사이트 상대경로로 수정 |
| 5 | `a76c7ec` | feat | 통합 파이프라인 — 이미지 서빙 + Vision |
| 6 | `9016b2d` | docs | PIPELINE.md 신규 |
| 7 | `e347dce` | feat | pool-repatch.js PDF/이미지 지원 |
| 8 | `9ef8561` | feat | PDF poppler 파이프라인 |
| 9 | `cef0c50` | docs | PIPELINE.md 전면 재작성 |
| 10 | `f7c0270` | docs | PIPELINE.md 네이버 클라우드 전환 계획 |
| 11 | `c2b97e6` | feat | 카테고리/시험 다중 선택 |
| 12 | `e75906c` | feat | AI 모델 3개 프로젝트 크로스 최신화 |
| 13 | `c41fc9a` | feat | 문제풀이 전체 펼치기/접기 |
| 14 | `96084be` | fix | MultiSelect 드롭다운 배경 불투명 |
| 15 | `160f049` | fix | MultiSelect 다크모드 글자색 |
| 16 | `129e3bc` | feat | 필터 선택 상태 localStorage 저장 |
| 17 | `3da3e60` | feat | 이메일 인증 회원가입/로그인 (Resend) |
| 18 | `4eb25f7` | fix | DB 쿼리 username OR email 양쪽 검색 |
| 19 | `b40c3b9` | feat | 인증코드 단일 로그인 — 비밀번호 제거 |
| 20 | `0124e5c` | fix | 로그인 후 튕김 — 쿠키 reload + CORS |
| 21 | `4b3ce89` | fix | 로그인 후 튕김 — meta API 일반 사용자 허용 |
| 22 | `135cb02` | feat | 일반 사용자 관리/연동 탭 숨김 |
| 23 | `cfb0b54` | feat | 내 계정 탭 + 계정 탈퇴 기능 |
| 24 | `9741f3d` | feat | 헤더 응원 문구 |
| 25 | `42abfc8` | feat | 헤더 2줄 레이아웃 |
| 26 | `aea486d` | fix | 회원관리 2줄 + 버튼 항상 노출 |
| 27 | `029fb33` | feat | 캐시 삭제 기능 |
| 28 | `7c64a7f` | feat | 플로팅 최상단 이동 버튼 |
| 29 | `05e0e92` | fix | 영상정보관리사 이미지 230개 추가 |
