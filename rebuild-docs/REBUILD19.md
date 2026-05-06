# REBUILD19 — 코드베이스 점검 보고서 + 클라우드 자격증 확장 검토

작성일: 2026-04-27
범위: workspace/aitutor — 보안 취약점 / Dead Code / 리팩토링 후보 / 의존성 검토 / **AWS·GCP 자격증 학습 모듈 확장 가능성**
선행 문서: REBUILD17 (로컬 모델 시범), REBUILD18 (정답 해설 통합 + 관리자 토글)

---

## 0. TL;DR

본 라운드는 **분석·제안만**, 실제 코드 변경 없음. 작업 우선순위 결정 후 별도 라운드(REBUILD20+)로 진행.

### 핵심 발견

| 카테고리 | 발견 | 우선순위 |
|---|---|---|
| 🔴 보안 | Rate limit 부재 (AI 프록시) — API 비용 폭증 위험 | **P0** |
| 🟠 보안 | XSS 미보호 (CodeBlock의 `dangerouslySetInnerHTML`) | P1 |
| 🟠 보안 | 민감 정보 로깅 (이메일 평문) — CloudWatch 노출 | P1 |
| 🟡 보안 | CSRF (SameSite 쿠키 정책 미명시) | P2 |
| 🟢 Dead Code | `@mediapipe/tasks-genai` 76MB — 사용 0건, 즉시 제거 가능 | P0 |
| 🟢 Dead Code | Legacy 1회성 스크립트 6개 (pool-import, generate-answers 등) | P2 |
| 🟢 Dead Code | rebuild1~9.md 옛 문서 (현재 REBUILD18까지 진행) | P3 |
| 🟡 리팩토링 | SettingsTab/index.jsx 698줄 + LoginPage.jsx 678줄 | P2 |
| 🟡 리팩토링 | API 호출 raw fetch / apiPost 혼용 | P2 |
| 🆕 확장 | **AWS SAA-C03 / GCP ACE 학습 모듈** — 시장 수요 ↑, 현재 인프라 호환성 90% | **검토 권장** |

### 단계별 진행 권고

```
P0 (즉시):    @mediapipe 제거 + AI Rate limit 구현
P1 (1주 내):  XSS 패치 + 민감 정보 로깅 마스킹
P2 (1개월):   CSRF 강화 + 거대 컴포넌트 분리 + API 패턴 통일
P3 (분기):    옛 문서 정리 + Legacy 스크립트 archive
🆕 신규:      클라우드 자격증 모듈은 별도 RFC 문서 + 사용자 결정
```

---

## 1. 보안 취약점

### 1.1 🔴 [P0] Rate Limit 부재 — AI 프록시 비용 폭증 위험

**파일**: `api/gemini.js`, `api/openai.js`, `api/claude.js`, `api/pool-upload.js`

**현황**:
- 인증된 사용자가 무제한 AI 호출 가능
- pool-upload 의 Gemini Vision 도 `withAdmin` 으로만 보호 — 동일 관리자 계정에서 자동 루프 시 API 비용 폭증
- 외부 API 단가:
  - Claude Opus 4: $0.015/1K 입력 + $0.075/1K 출력 = **1만 회 호출 시 약 $750**
  - GPT-5: $0.005/1K + $0.020/1K = **1만 회 호출 시 약 $250**

**재현 시나리오**:
- 악의적 사용자가 카드 학습 페이지에서 "AI 해설" 버튼을 1초당 1회 자동 클릭
- 시간당 3,600건 → 일당 86,400건 → 월 250만건
- Claude 기준 **월 청구액 $187,500** 가능

**영향도**: ★★★★★ (Critical — 비용 + 평판)

**수정 방향**:
1. **Redis 또는 in-memory rate limiter 도입** — 사용자별 분당/시간당 제한
   ```js
   // 예: api/_llm/rate-limit.js (신규)
   const limits = new Map();   // userId → { count, resetAt }
   export function checkRate(userId, action) {
     const now = Date.now();
     const key = `${userId}:${action}`;
     const cur = limits.get(key) || { count: 0, resetAt: now + 60_000 };
     if (now > cur.resetAt) { cur.count = 0; cur.resetAt = now + 60_000; }
     cur.count++;
     limits.set(key, cur);
     return cur.count <= 10;   // 분당 10회 제한
   }
   ```
2. **DB 기반 일일 quota** — `llm_usage_log` 활용해 일일 합계 체크
3. **관리자 화이트리스트** — 자동 임포트 등 의도된 대량 호출 예외

**기존 서비스 영향**:
- 정상 사용자(분당 1~2회 해설 요청)는 영향 없음
- pool-upload 같은 관리자 배치는 화이트리스트 또는 별도 limit
- **회귀 위험 0** (기존 동작 유지)

---

### 1.2 🟠 [P1] XSS — CodeBlock 의 `dangerouslySetInnerHTML` 미보호

**파일**: `src/components/CodeBlock.jsx:94`
```jsx
<span dangerouslySetInnerHTML={{ __html: highlighted }} />
```

**현황**:
- Prism.js 의 `highlight()` 결과를 sanitize 없이 직접 렌더링
- 같은 파일에 DOMPurify import 없음

**위험도**: ★★★★☆ (High)
- Prism 자체가 안전하다고 알려져 있어 실제 익스플로잇 가능성 ↓
- 그러나 사용자가 코드 블록 안에 임의 HTML 입력 가능한 페이지(노트, 댓글 등)에서 사용 시 위험

**재현 시나리오**:
```js
// 사용자가 코드 블록에 다음 입력:
<img src=x onerror="fetch('/api/auth?action=logout')">
```

**수정 방향**:
```jsx
import DOMPurify from 'dompurify';   // 이미 의존성에 있음

// CodeBlock.jsx
const sanitized = DOMPurify.sanitize(highlighted, {
  ALLOWED_TAGS: ['span'],   // Prism 출력은 span 만 사용
  ALLOWED_ATTR: ['class'],
});
<span dangerouslySetInnerHTML={{ __html: sanitized }} />
```

**기존 서비스 영향**:
- DOMPurify 가 Prism 의 `<span class="...">` 만 허용 → 시각적으로 동일
- 추가 패키지 설치 0 (이미 의존성에 있음)
- **회귀 위험 0**

---

### 1.3 🟠 [P1] 민감 정보 로깅 — CloudWatch 평문 이메일 노출

**파일**:
- `api/login.js:144` — `console.log('[Auth] 로그인 성공: ${user.username} ...')`
- `api/signup.js:103` — `console.log('[Auth] 회원가입 성공: ${email} ...')`
- `api/send-verification.js`

**현황**: 이메일 + 사용자명 + 관리자 여부가 평문으로 CloudWatch 에 저장

**위험도**: ★★★☆☆ (Medium)
- 권한 있는 운영자라도 사용자 식별자 직접 열람 가능
- GDPR / 개인정보보호법 관점 부적절
- CloudWatch 보존 기간 동안 누적

**수정 방향**:
```js
// api/_utils/log.js (신규)
export function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

// 사용:
console.log(`[Auth] 로그인 성공: ${maskEmail(user.username)} (uid=${user.id})`);
```

**기존 서비스 영향**:
- 디버깅 시 user.id 로 추적 가능
- **회귀 위험 0**

---

### 1.4 🟡 [P2] CSRF — SameSite 쿠키 정책 미명시

**파일**: `api/auth.js`, `server.js`

**현황**:
- HttpOnly 쿠키 기반 인증
- `SameSite=Strict` 또는 `SameSite=Lax` 명시 없음 → 브라우저 default(`Lax`) 적용
- CSRF 토큰 없음

**위험도**: ★★★☆☆ (Medium)
- 브라우저 default Lax 가 GET 요청은 허용 → 일반적 CSRF 방어는 됨
- POST 요청에 추가 보호 권장

**수정 방향**:
1. **Set-Cookie 에 SameSite=Strict 명시**:
   ```js
   res.setHeader('Set-Cookie',
     `token=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=...`);
   ```
2. **CSRF 토큰 (별도 라운드)** — Double Submit Cookie 패턴

**기존 서비스 영향**:
- SameSite=Strict 적용 시 외부 사이트에서 링크 클릭 → 자동 로그아웃 효과 (Lax 보다 엄격)
- 사용자가 외부에서 우리 사이트 진입할 때 **다시 로그인 필요** → UX 약간 저하
- 권장: Lax 명시 (기본값과 동일하지만 명시)

---

### 1.5 🟢 [Low] 경로 트래버설 — pool-upload S3 경로 검증

**파일**: `api/pool-upload.js:30`
```js
if (!s3_key.startsWith('uploads/pool/')) { ... }
```

**현황**: `startsWith` 만으로 `uploads/pool/../../../sensitive` 같은 상대 경로 통과 가능 (이론상)

**위험도**: ★★☆☆☆ (Low)
- S3 는 `/` 기준 절대 경로라 실제 익스플로잇 어려움
- 그러나 정규식 검증이 안전

**수정**:
```js
if (!/^uploads\/pool\/[a-zA-Z0-9._-]+\.(pdf|png|jpg|jpeg)$/i.test(s3_key)) {
  return res.status(400).json({ error: '유효하지 않은 s3_key' });
}
```

---

### 1.6 ✅ 검증 통과 — 안전한 구현 항목

| 항목 | 결과 |
|---|---|
| SQL Injection | ✅ 모든 query() 가 `$1, $2` parameterized 사용 |
| JWT 검증 | ✅ `crypto.timingSafeEqual()` 으로 타이밍 공격 방어 |
| HTTPS 강제 | ✅ `Strict-Transport-Security` 헤더 (server.js:17) |
| Clickjacking | ✅ `X-Frame-Options: DENY` |
| MIME sniffing | ✅ `X-Content-Type-Options: nosniff` |
| Referrer 누출 | ✅ `Referrer-Policy: strict-origin-when-cross-origin` |

---

## 2. Dead Code / 미사용 자산

### 2.1 🔴 [P0] `@mediapipe/tasks-genai` 76MB — 즉시 제거 가능

**파일**: `package.json:30`
```json
"@mediapipe/tasks-genai": "^0.10.27",
```

**현황**:
- REBUILD17 §12.1 에서 **deprecated 결정** (LiteRT-Community 의 web 버전 quality 이슈)
- 코드 검색: 사용 0건 (`import` 없음)
- node_modules 76MB 점유

**제거 영향**:
- npm install 시간 단축
- Lambda 컨테이너 이미지 사이즈 감소
- **회귀 위험 0**

**조치**:
```bash
npm uninstall @mediapipe/tasks-genai
```

---

### 2.2 🟢 [P2] Legacy 1회성 스크립트 6개

| 파일 | 사이즈 | 용도 |
|---|---|---|
| `pool-import.js` | 13KB | REBUILD7 단계 일회성 임포트 |
| `pool-import-v2.js` | 20KB | REBUILD8 단계 |
| `pool-explain.js` | 5.6KB | 동일 |
| `pool-patch-visual.js` | 8KB | 시각 자료 패치 |
| `pool-repatch.js` | 27KB | 재패치 |
| `pool-repatch-batch.js` | 3KB | 배치 |
| `generate-answers.js` | 76KB | 정답 자동 생성 |
| `register-network-questions.js` | 5KB | 네트워크 문항 등록 |

**현황**: 모두 데이터 마이그레이션용 1회성. 현재 API/UI 로 대체. `npm scripts` 에 일부 잔존.

**조치 옵션**:
- A. 즉시 삭제 (git history 보존)
- B. `scripts/archive/` 폴더로 이동 (필요 시 참조 가능)

**권장**: B (한 달 미사용 시 A)

---

### 2.3 🟢 [P3] 옛 REBUILD 문서 9개

`rebuild1.md` ~ `rebuild9.md` (총 130KB) — 초기 프로토타입 단계 문서.

현재 활용 문서: REBUILD10~18, PIPELINE.md.

**조치**: `docs/archive/` 로 이동 (역사 보존 + 메인 디렉토리 정리)

---

### 2.4 🟢 [Low] 백업 파일

- `vercel.json.bak` — Vercel 마이그레이션 잔존
- `kisa-module-v1.zip` (44KB) — 모듈 백업

**조치**: 삭제 (git history 로 복구 가능)

---

### 2.5 ⚠️ 조건부 — Capacitor 의존성

**파일**: `package.json`
```json
"@capacitor/core": "^8.2.0",
"@capacitor/network": "^8.0.1",
"@capacitor/android": "^8.2.0",   // devDep
"@capacitor/ios": "^8.2.0",       // devDep
"@capacitor/cli": "^8.2.0"
```

**현황**: REBUILD17 §0 에서 "Capacitor 유지" 결정 (App Store 진출 대비). 현재 미사용.

**조치**: **유지** — 6개월 후 App Store 계획 재검토. 현재 제거 시 향후 Capacitor 재설정 비용 ↑

---

## 3. 리팩토링 후보

### 3.1 🟡 [P2] 거대 컴포넌트 — `SettingsTab/index.jsx` 698줄

**문제**:
- 단일 파일에 6개 섹션 (Account / General / Category / AI / Users / SystemSettings) 혼합
- AccountSection 내부에 회원 탈퇴 모달 + 캐시 삭제 + 로그아웃 + ...

**리팩토링 안**:
```
src/tabs/SettingsTab/
├── index.jsx                       # 라우터만 (50줄)
├── sections/
│   ├── AccountSection.jsx          # 분리 (200줄)
│   ├── GeneralSection.jsx          # 분리 (50줄)
│   ├── CategorySection.jsx         # 분리 (300줄)
│   ├── UsersSection.jsx            # 분리 (100줄)
│   └── SystemSettingsCard.jsx      # 분리 (130줄)
└── (기존 LlmSettingsPanel, LlmUsagePanel, LlmProviderToggleCard 그대로)
```

**기존 서비스 영향**:
- 동작 동일 (코드 이동만)
- import 경로 변경 한 곳 (index.jsx)
- 회귀 위험 ★ (낮음 — 단순 이동)

---

### 3.2 🟡 [P2] 거대 컴포넌트 — `LoginPage.jsx` 678줄

**문제**: 로그인 / 회원가입 / 비밀번호 재설정 3가지 모드 단일 컴포넌트

**리팩토링 안**:
```
src/pages/LoginPage/
├── index.jsx              # 모드 라우터 (80줄)
├── LoginForm.jsx          # 200줄
├── SignupForm.jsx         # 250줄
└── ForgotPasswordForm.jsx # 150줄
```

---

### 3.3 🟡 [P2] API 호출 패턴 일관성 — raw fetch / apiPost 혼용

**현황**:
- `src/lib/api.js` 에 `apiFetch / apiGet / apiPost` 정의 (인증 자동, 에러 통일)
- 그러나 일부 컴포넌트가 raw `fetch()` 직접 사용:
  - `src/tabs/QuizTab/AiExplanation.jsx` (이미지 fetch)
  - `src/tabs/QuizTab/MemoPanel.jsx`
  - `src/tabs/KisaTab/ResultOverlay.jsx`
  - `src/labs/local-ai/lib/inference.js` (`/api/usage-log` POST)
  - `src/hooks/useSSE.js` (SSE 라 raw 필요 — 예외)

**조치**:
1. apiPost 로 통일 가능한 곳 마이그레이션
2. SSE/스트리밍 등 raw 필요한 경우는 주석 명시

---

### 3.4 🟢 [Low] 반복 패턴 — 토글 버튼 / fetch+toast / 모델 카드

이미 `EffectToggle` 컴포넌트가 추출됨. 추가 후보:

- `useApiAction(endpoint, action)` — 공통 try/catch + toast + 로딩
- `<Toggle>` 컴포넌트 — 현재 인라인 JSX 가 4~5곳 중복

---

### 3.5 🟢 [Low] 에러 핸들링 통일

**현황**: `try/catch { toast(...) }` 패턴이 곳곳에 다른 형태로 작성

**조치**: 별도 라운드 — 우선순위 낮음

---

## 4. 의존성 검토

### 4.1 무거운 패키지 — 정당성 평가

| 패키지 | 사이즈 | 정당성 |
|---|---|---|
| `onnxruntime-web` | 130MB | ✅ REBUILD17 로컬 모델 추론 — 의도된 추가 |
| `onnxruntime-node` | 210MB | ⚠️ Lambda 컨테이너에서 사용 X (브라우저 전용 ORT) — **확인 필요** |
| `@mediapipe/tasks-genai` | 76MB | ❌ Deprecated, 즉시 제거 (§2.1) |
| `recharts` | 8.5MB | ✅ LlmUsagePanel + Stats — lazy 로드됨 |
| `@huggingface/transformers` | 50MB+ | ✅ 로컬 모델 핵심 |
| `react-router-dom` | 작음 | ✅ |
| `dompurify` | 30KB | ✅ 보안 필수 |
| `prismjs` | 200KB | ✅ 코드 하이라이트 |

**조치**:
1. `@mediapipe/tasks-genai` 제거 (§2.1)
2. `onnxruntime-node` 사용 여부 확인 — 미사용 시 제거 (210MB 절감!)

```bash
grep -rn "onnxruntime-node" src/ api/ server.js
```
> 2026-04-29 갱신: lambda.js 폐기 (REBUILD23 Cloud Run 마이그). grep 대상에서 제거.

### 4.2 보안 권고

`npm audit` 직접 실행은 안 했지만 package.json 기준:
- `pg ^8.20.0` — 최신 (안전)
- `express ^4.18.2` — 최신 (안전)
- `react ^18.3.0` — LTS (안전)
- `@aws-sdk/* ^3.1034.0` — 최신 (안전)

**권장**: 분기당 1회 `npm audit` + `npm outdated` 실행

---

## 5. 🆕 클라우드 자격증 학습 모듈 확장 검토 (AWS / GCP)

### 5.1 시장 조사 결과 (2026-04 기준)

#### AWS Solutions Architect Associate (SAA-C03)
- **수요**: "**가장 수요 높은 클라우드 자격증** (2026 기준)" — 채용 공고 지속 증가 ([CertDemand 2026 가이드](https://certdemand.com/guides/aws-solutions-architect-guide/))
- **시험 구조**: 130분 / 65문항 / 객관식 + 다중선택
- **응시료**: $150 USD
- **평균 학습 기간**: 10~12주
- **한국 시장**: 한국 응시자 다수 (Medium 한국어 후기 다수 — [Han SangHyo 후기](https://medium.com/@tkdgy0801/대학생도-딸-수-있는-aws-solutions-architect-associate-시험-후기-baee6e8aec62))

#### Google Cloud Associate Cloud Engineer (ACE) / Professional Cloud Architect (PCA)
- **ACE**: 50~60문항 / 2시간 / $200 USD ([ExamCert ACE 가이드 2026](https://www.examcert.app/blog/gcp-ace-study-guide-2026/))
- **PCA**: 60문항 / 2시간 / **장문 시나리오 기반** — "서비스를 아는가?" 가 아니라 "제약 하에서 시스템을 설계할 수 있는가?"
- **수요**: AWS 보다 작지만 성장 중

#### LLM 으로 클라우드 자격증 해설 생성 사례
- 영문 시장 다수: SkillCertPro, ValidExamDumps 등
- **한국어 시장**: 거의 없음 — **블루오션**
- 우리 강점: 이미 운전면허/KISA/영상정보관리사로 검증된 한국어 해설 인프라

### 5.2 우리 인프라와의 호환성

| 차원 | 호환성 | 비고 |
|---|---|---|
| **객관식 4지선다 구조** | ✅ 100% | 운전면허/KISA 와 동일 (DB 스키마 그대로) |
| **카테고리 / 시험 / 과목 메타데이터** | ✅ 100% | `categories` / `exams` / `subjects` 테이블 |
| **AI 해설 (외부 + 온디바이스)** | ✅ 100% | REBUILD18 의 4개 프로바이더 그대로 |
| **북마크 / 메모 / 오답노트** | ✅ 100% | 기존 인프라 |
| **이미지 첨부 (AWS 아키텍처 다이어그램)** | ✅ 90% | KISA 의 q-images 패턴 그대로 |
| **법령 인용** | 🟡 N/A | 법령 대신 AWS 서비스 문서 인용 (프롬프트만 변경) |
| **시나리오 기반 (PCA 전문가 시험)** | 🟡 80% | 긴 문항 본문 처리 가능, UI 약간 조정 필요 |

### 5.3 도입 옵션

#### 옵션 A: 카테고리 추가만 (가장 작은 작업)
- `categories` 테이블에 "AWS 자격증" 카테고리 추가
- 기존 시험 등록 흐름 그대로 사용
- 운영자가 문항 직접 입력
- **작업량**: 0 (UI 그대로)
- **콘텐츠 작업**: 사용자 부담

#### 옵션 B: 영문 문항 + AI 한국어 해설 자동화 (권장)
- 영문 문항 배치 임포트 (영어 원문 그대로)
- 사용자 학습 시 AI 해설은 한국어로 자동 생성
- 우리 LLM 인프라가 영→한 번역 + 해설 동시 처리
- **작업량**: 프롬프트 추가 (1일)
- **콘텐츠**: 영문 공개 문제집 활용

#### 옵션 C: 한국어 자체 콘텐츠 + AI 검수 (장기)
- 영문 → 한국어 번역 + 전문가 검수
- 가장 고품질이지만 비용·시간 큼
- **작업량**: 큼 (2~3개월)

#### 옵션 D: AWS Skill Builder 공식 콘텐츠 라이선스 (탐색)
- AWS Educate / Skill Builder 의 공식 자료 활용
- 라이선스 협의 필요

### 5.4 도입 시 영향도

#### 긍정 영향
- **시장 확장** — 운전면허/KISA 외 신규 사용자층 (개발자/SI 종사자)
- **객단가 ↑** — 자격증 학습자는 학습 도구 지출 의지 ↑
- **온디바이스 AI 의 의미 ↑** — 영어 시험 콘텐츠는 외부 API 호출량 많아 비용 절감 효과 큼

#### 부정 영향 / 위험
- **콘텐츠 품질 책임** — 자격증 시험은 정확성 매우 중요 (오답 1건 = 신뢰도 ↓)
- **운영 복잡도 ↑** — 카테고리 관리, 해설 검수 인력 필요
- **온디바이스 AI 한계** — 영문 자격증은 한국어 모델(Qwen)보다 영어 모델 (Llama, Phi) 이 더 적합 → **모델 추가** 필요
- **UI/UX 영향** — PCA 같은 장문 시나리오는 모바일 가독성 도전

#### 기존 서비스 영향 (운전면허/KISA)
- **회귀 위험 0** — 카테고리 단위 격리
- 기존 사용자는 영향 없음 (카테고리 선택 안 하면 안 보임)

### 5.5 권장

**옵션 B (영문 문항 + AI 한국어 해설)** 부터 PoC 권장.

#### Phase 1 (PoC, 2~3주)
1. AWS SAA-C03 무료 공개 샘플 문항 50건 임포트
2. 한국어 해설 프롬프트 작성 (운전면허 프롬프트 변형)
3. 외부 API + 온디바이스 AI 양쪽으로 해설 품질 검증
4. 베타 사용자 5~10명 피드백

#### Phase 2 (정식 출시, 1~2개월)
- SAA-C03 / DVA-C02 / SOA-C02 (AWS Associate 3종) 콘텐츠 확장
- GCP ACE 추가
- 카테고리별 학습 통계 / 모의시험 기능

#### Phase 3 (확장)
- AWS Professional (SAP / DOP)
- GCP PCA / PDE
- Azure Fundamentals

### 5.6 의사결정 필요 항목

사용자 결정 필요:
1. ⏳ **클라우드 자격증 모듈 도입 여부** (Y/N)
2. ⏳ Y 시 **첫 자격증** (AWS SAA-C03 권장)
3. ⏳ **콘텐츠 출처** (영문 공개 자료 vs 자체 한국어 vs 라이선스)
4. ⏳ **온디바이스 AI 모델 확장** — 영어 특화 모델 (Phi-4, Llama 3.2) 추가 여부
5. ⏳ **출시 일정** — Phase 1 PoC 시점

---

## 6. 우선순위 매트릭스

### 작업 영향도 × 난이도

```
영향도 ↑
  │  [1.1 Rate Limit] ★★★★★      [5. 클라우드 자격증]
  │       P0                         별도 의사결정
  │
  │  [1.2 XSS]    [2.1 mediapipe 제거]
  │   P1               P0 (즉시)
  │
  │  [1.3 로깅 마스킹]   [3.1 SettingsTab 분리]
  │   P1                  P2
  │
  │  [1.4 SameSite]      [3.3 API 패턴 통일]
  │   P2                   P2
  │
  │  [2.4 백업 파일]    [2.2 Legacy 스크립트 archive]
  │   Low                 P2
  │
영향도 ↓ ←─────────────── 난이도 ↑─────────────────→
       (코드 변경 작음)              (큰 변경)
```

### 추천 실행 순서

1. **이번 주**:
   - `@mediapipe/tasks-genai` 제거 (5분, P0)
   - `onnxruntime-node` 사용 여부 확인 후 제거 (10분)
   - AI Rate limit 구현 (2시간, P0)

2. **다음 주**:
   - CodeBlock XSS 패치 (30분, P1)
   - 민감 정보 로깅 마스킹 (45분, P1)

3. **이번 달**:
   - SameSite=Lax 명시 (30분, P2)
   - SettingsTab / LoginPage 컴포넌트 분리 (3+3시간, P2)
   - API 패턴 통일 (2시간, P2)

4. **이번 분기**:
   - Legacy 스크립트 archive (1시간)
   - rebuild1~9.md docs/archive/ 이동 (30분)
   - **클라우드 자격증 PoC 결정 + 시작** (별도 RFC)

---

## 7. 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-04-27 | 최초 작성 — 보안/Dead Code/리팩토링 진단 + AWS·GCP 자격증 모듈 확장 검토 | Claude Code |

---

## 8. 참고 자료

### 8.1 보안 관련
- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify)

### 8.2 클라우드 자격증
- [AWS Certified Solutions Architect – Associate (공식)](https://aws.amazon.com/certification/certified-solutions-architect-associate/)
- [SAA-C03 Exam Guide (공식 PDF)](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html)
- [AWS-SAA Certification Guide 2026 (CertDemand)](https://certdemand.com/guides/aws-solutions-architect-guide/)
- [GCP ACE Study Guide 2026 (ExamCert)](https://www.examcert.app/blog/gcp-ace-study-guide-2026/)
- [GCP Professional Cloud Architect 2026 가이드 (FlashGenius)](https://flashgenius.net/blog-article/google-professional-cloud-architect-pca-certification-ultimate-2025-guide-8-week-study-plan)
- [한국어 AWS SAA 후기 (Medium)](https://medium.com/@tkdgy0801/대학생도-딸-수-있는-aws-solutions-architect-associate-시험-후기-baee6e8aec62)
- [Google Cloud Generative AI Leader 2026](https://www.whizlabs.com/blog/google-cloud-generative-ai-leader-guide/)
- [Alibaba Cloud Certified Professional LLM Engineer (참고)](https://certificationpractice.com/exam-overviews/alibaba-cloud-certified-professional-llm-engineer-quick-facts)
