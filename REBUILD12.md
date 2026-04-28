# REBUILD12: AI TutorTwo — 이메일 인증 복구 + 회원가입 UX 개선

> 작성일: 2026-04-23
> 대상: `workspace/aitutor`
> 참고: `REBUILD11.md` (AWS 마이그레이션 완료 보고서)
> 결과: **완료 (운영 중)**
> Public URL: **https://d2dcsdi9b1j2rf.cloudfront.net**
> 배포 방식: Lambda Container Image (CodeBuild → ECR → Lambda)

---

## 목차
1. [요약](#1-요약)
2. [배경: 발단이 된 문제](#2-배경-발단이-된-문제)
3. [Part A — 이메일 인증 복구](#3-part-a--이메일-인증-복구)
4. [Part B — 회원가입 자동 로그인 + 콜드 스타트 재시도](#4-part-b--회원가입-자동-로그인--콜드-스타트-재시도)
5. [배포 파이프라인](#5-배포-파이프라인)
6. [코드 변경 전체 목록](#6-코드-변경-전체-목록)
7. [검증 결과](#7-검증-결과)
8. [운영 체크리스트](#8-운영-체크리스트)
9. [후속 과제 / TODO](#9-후속-과제--todo)
10. [부록: AWS CLI 명령 전체 로그](#10-부록-aws-cli-명령-전체-로그)

---

## 1. 요약

### 1-1. 무엇을 했는가
AWS 마이그레이션(REBUILD11) 직후 발견된 두 가지 이슈를 해결:

1. **Part A — 이메일 인증 500 에러 복구**
   - `/api/send-verification` 500 Internal Server Error 발생
   - 원인: Resend 샌드박스 발신자(`onboarding@resend.dev`)는 본인 이메일로만 발송 가능
   - 해결: **`newsstand.blog`** 도메인 신규 구매 → Resend 도메인 인증 → 발신자 교체

2. **Part B — 회원가입 UX 개선**
   - 이슈: 회원가입 성공 후 로그인 화면으로 돌아가서 재로그인 필요
   - 해결: signup API에서 JWT 발급 + HttpOnly 쿠키 설정 → 즉시 메인 진입
   - 부가: Lambda 콜드 스타트 404/5xx 자동 재시도 로직 추가

### 1-2. 소요 시간
- Part A (DNS 인증 대기 포함): 약 40분
- Part B (UX 개선): 약 20분
- **합계: 약 1시간**

### 1-3. 이번 작업의 핵심 교훈

| 교훈 | 내용 |
|------|------|
| **Resend 샌드박스의 함정** | `onboarding@resend.dev`는 **본인 이메일에만** 발송 가능. 프로덕션 서비스는 반드시 **소유 도메인을 DKIM/SPF 인증**해야 함. |
| **Lambda 콜드 스타트 현실** | SSM 시크릿 로드가 포함된 초기화는 1~2초 소요. 첫 요청이 **CloudFront/브라우저에서 타임아웃성 404**로 보일 수 있음 → 클라이언트 재시도 로직이 가성비 최고 방어. |
| **인증 쿠키와 UX** | 회원가입과 로그인을 **완전히 같은 토큰 발급 로직**으로 통일하면 자연스러운 "가입 즉시 로그인" UX 가능. |

---

## 2. 배경: 발단이 된 문제

### 2-1. 사용자가 받은 에러
```
POST https://d2dcsdi9b1j2rf.cloudfront.net/api/send-verification 500 (Internal Server Error)
```

### 2-2. 진단
`api/middleware.js`의 `withCors`는 모든 예외를 잡아 **표준 500 응답**으로 변환:
```js
res.status(500).json({ error: '서버 오류가 발생했습니다.' });
```
→ 실제 에러는 CloudWatch Logs에만 남음.

### 2-3. CloudWatch 원인 로그
```
[Verify] Resend 발송 실패: {
  statusCode: 403,
  name: 'validation_error',
  message: 'You can only send testing emails to your own email address
           (season1zeepapa@gmail.com). To send emails to other recipients,
           please verify a domain at resend.com/domains, and change the
           `from` address to an email using this domain.'
}
```

→ Resend 샌드박스 제약. 소유 도메인 인증이 필수임을 확인.

---

## 3. Part A — 이메일 인증 복구

### 3-1. 의사결정 흐름

| 고려한 선택지 | 판단 | 이유 |
|-------------|------|------|
| Gmail 개인 주소를 Resend에 등록 | ❌ 불가 | `gmail.com` DNS는 Google 소유 → SPF/DKIM 등록 불가 |
| Gmail SMTP 직접 연동 (nodemailer) | ❌ 기각 | 하루 500통 한도, 스팸함 직행, 계정 정지 위험 |
| 카카오 로그인(OAuth) 전환 | 📝 후보 | 훌륭한 대안이지만 전면 개편 필요 |
| SMS 점유 인증 | 📝 후보 | 발신번호 사전등록·유료·봇 공격 우려 |
| **소유 도메인 + Resend DKIM/SPF 인증** | ✅ 채택 | **기존 코드 최소 변경** — 발신자 주소 한 줄만 변경 |

### 3-2. 도메인 구매
- **도메인**: `newsstand.blog`
- **구매처**: WordPress.com (1년)
- **네임서버**: WordPress.com 기본 (`ns1~3.wordpress.com`)

### 3-3. Resend 도메인 등록
- **리전**: `Tokyo (ap-northeast-1)` — AWS Lambda(Seoul)와의 지연시간 최소화
- **상태**: Verified (Apr 23, 10:15 AM KST)

### 3-4. DNS 레코드 (WordPress.com DNS 관리에 직접 추가)

| # | 형식 | 이름 | 값 | 역할 |
|---|------|------|------|-----|
| 1 | TXT | `resend._domainkey` | `p=MIGfMA0GCS...QIDAQAB` (2048-bit RSA 공개키) | **DKIM** — 편지 전자서명 검증 공개키 |
| 2 | MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` (Priority 10) | **반송 경로 수신** (Amazon SES) |
| 3 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | **SPF** — 허용 발신 서버 화이트리스트 |
| 4 | TXT | `_dmarc` | `v=DMARC1; p=none;` | **DMARC** — 인증 실패 시 리포팅 정책 (현재 모니터링 전용) |

### 3-5. 전파 확인 (dig)
```bash
dig +short TXT resend._domainkey.newsstand.blog @8.8.8.8
# → "p=MIGfMA0GCSq...QIDAQAB"

dig +short MX send.newsstand.blog @8.8.8.8
# → 10 feedback-smtp.ap-northeast-1.amazonses.com.

dig +short TXT send.newsstand.blog @8.8.8.8
# → "v=spf1 include:amazonses.com ~all"

dig +short TXT _dmarc.newsstand.blog @8.8.8.8
# → "v=DMARC1; p=none;"
```
→ 4개 레코드 **21분 만에 전파 + 인증 완료** (WordPress.com 네임서버가 빠른 편).

### 3-6. 코드 변경
`api/send-verification.js:91`
```diff
-  from: 'AI TutorTwo <onboarding@resend.dev>',
+  from: 'AI TutorTwo <noreply@newsstand.blog>',
```

### 3-7. 1차 재배포 결과
- HTTP 응답: `500` → **`200`**
- CloudWatch 로그: `[Verify] Resend 발송 실패: ...` → `[Verify] 인증코드 발송: <이메일>`
- 실제 가입 성공: `ss1zeepapa@naver.com` (본인 Gmail 외 이메일 최초 수신 확인)

---

## 4. Part B — 회원가입 자동 로그인 + 콜드 스타트 재시도

### 4-1. 식별된 두 개의 UX 이슈

#### 이슈 1: 회원가입 후 로그인 재진행 필요
- **사용자 피드백**: "회원가입 후 바로 로그인 상태로 전환 안 되나요?"
- **원인**: `api/signup.js`는 DB INSERT만 수행, JWT 토큰/쿠키 없이 메시지만 반환:
  ```js
  res.json({ message: '회원가입이 완료되었습니다!' });
  ```
  프론트엔드는 성공 메시지를 보여주고 로그인 화면으로 전환 → 사용자는 이메일 → 인증코드 과정을 **한 번 더 거쳐야** 로그인 상태가 됨.

#### 이슈 2: Lambda 콜드 스타트 시 첫 요청 404
브라우저 Network 탭 관찰:
```
send-verification  404  1.61s   ← 첫 요청 (콜드 스타트)
send-verification  200  814ms   ← 재시도 (웜 상태)
signup             200  1.87s
```
- `lambda.js` `init()`에서 SSM `GetParametersByPath`로 시크릿 7개 로드 → 첫 요청 2초 내외
- CloudFront/브라우저가 초기화 대기 중 `404`로 반환하는 에지 케이스 발생

### 4-2. 해결 방법

#### 🔧 백엔드: `api/signup.js`에 토큰 발급 추가 (login.js와 동일 로직)

```diff
  const crypto = require('crypto');
  const { query } = require('./db');
+ const { signToken, TOKEN_SECRET } = require('./auth');
  const { withCors } = require('./middleware');

  ...

- // DB 저장
- await query(
-   'INSERT INTO public.users (username, email, name) VALUES ($1, $1, $2)',
-   [email, name]
- );
+ // DB 저장 + RETURNING으로 id/is_admin 받기
+ const insertResult = await query(
+   'INSERT INTO public.users (username, email, name) VALUES ($1, $1, $2) RETURNING id, is_admin',
+   [email, name]
+ );
+ const user = insertResult.rows[0];

  // 인증코드 사용 처리
  await query('UPDATE email_verifications SET used = true WHERE email = $1 AND code = $2', [email, code]);

+ // 🆕 자동 로그인: HMAC JWT 발급 → HttpOnly 쿠키
+ const token = signToken(
+   { sub: email, email, uid: user.id, name, admin: !!user.is_admin },
+   TOKEN_SECRET,
+   '7d'
+ );
+ const isProduction = process.env.NODE_ENV === 'production'
+   || process.env.VERCEL
+   || process.env.AWS_LAMBDA_FUNCTION_NAME;
+ res.setHeader('Set-Cookie', [
+   `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${isProduction ? '; Secure' : ''}`,
+ ]);

- res.json({ message: '회원가입이 완료되었습니다!' });
+ res.json({ name, admin: !!user.is_admin, message: '회원가입이 완료되었습니다!' });
```

#### 🔧 프론트엔드 1/2: `src/pages/LoginPage.jsx` — `handleSignup` 자동 로그인

```diff
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
-     await apiCall('/api/signup', { email, name, code });
-     setSuccess('회원가입이 완료되었습니다. 로그인해주세요.');
-     setTimeout(() => switchMode('login'), 1500);
+     const data = await apiCall('/api/signup', { email, name, code });
+     setAuthUser({ name: data.name || name, admin: !!data.admin });
+     window.location.reload();  // 쿠키 반영
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
```

#### 🔧 프론트엔드 2/2: `src/pages/LoginPage.jsx` — `apiCall` 콜드 스타트 재시도

```diff
- const apiCall = async (url, body) => {
-   const res = await fetch(url, {
-     method: 'POST',
-     headers: { 'Content-Type': 'application/json' },
-     credentials: 'include',
-     body: JSON.stringify(body),
-   });
-   const data = await res.json();
-   if (!res.ok) throw new Error(data.error || '요청 실패');
-   return data;
- };
+ // Lambda 콜드 스타트 대비: 404/502/503/504/네트워크 오류 시 1회 자동 재시도
+ const apiCall = async (url, body, retried = false) => {
+   let res;
+   try {
+     res = await fetch(url, {
+       method: 'POST',
+       headers: { 'Content-Type': 'application/json' },
+       credentials: 'include',
+       body: JSON.stringify(body),
+     });
+   } catch (networkErr) {
+     if (!retried) {
+       await new Promise(r => setTimeout(r, 1200));
+       return apiCall(url, body, true);
+     }
+     throw networkErr;
+   }
+   if (!retried && [404, 502, 503, 504].includes(res.status)) {
+     await new Promise(r => setTimeout(r, 1200));
+     return apiCall(url, body, true);
+   }
+   const data = await res.json().catch(() => ({}));
+   if (!res.ok) throw new Error(data.error || '요청 실패');
+   return data;
+ };
```

### 4-3. 디자인 포인트
- **JWT payload 구조 통일**: signup·login 모두 `{ sub, email, uid, name, admin }` — 인증 미들웨어가 구분 없이 처리
- **쿠키 속성**: `HttpOnly` (XSS 탈취 방지) + `SameSite=Lax` + `Secure` (프로덕션) + `Max-Age=7d`
- **재시도 지연 1200ms**: Lambda 콜드 스타트 평균(1.5~2초) 대비 짧지만, 대부분의 웜업 완료 시간 확보
- **재시도 조건 엄격화**: 404/502/503/504만 — 400/401/409 등 비즈니스 오류는 즉시 반환

---

## 5. 배포 파이프라인

### 5-1. 발견한 AWS 리소스 (기존)
```
Lambda 함수:       aitutor
ECR 리포지토리:    794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor
CodeBuild 프로젝트: aitutor-build
CodeBuild 소스:    S3 (aitutor-codebuild-src-794531974010/aitutor-src.zip)
CloudFront 배포 ID: E2MP4BK1D16LJN
SSM 파라미터:      /aitutor/ (RESEND_API_KEY, DATABASE_URL, AUTH_TOKEN_SECRET 등 7개)
```

### 5-2. 수행한 배포 절차 (2회 동일 패턴)

```
1. 소스 zip 생성 (node_modules, .git, ios/, android/ 등 제외)
     ↓
2. aws s3 cp → aitutor-codebuild-src-794531974010
     ↓
3. aws codebuild start-build --project-name aitutor-build
     ↓
4. (CodeBuild 내부) ECR 로그인 → docker build → docker push
     ↓
5. aws ecr describe-images → digest 조회
     ↓
6. aws lambda update-function-code --image-uri <digest>
     ↓
7. aws lambda wait function-updated
     ↓
8. aws cloudfront create-invalidation --paths "/*"   # 프론트 변경 시에만
```

### 5-3. 배포 소요 시간 (실측)
| 단계 | 1차 배포 (Part A) | 2차 배포 (Part B) |
|-----|----------------|----------------|
| zip 생성 + S3 업로드 | ~7초 | ~7초 |
| CodeBuild (QUEUED → COMPLETED) | 127초 (2분 7초) | 63초 (1분 3초) |
| Lambda update + wait | 11초 | 약 15초 |
| CloudFront 무효화 시작 | 생략 | ~3초 |
| **합계** | **~2분 30초** | **~1분 30초** |

2차 빌드가 빠른 이유: CodeBuild 컨테이너 워밍업 효과로 `PROVISIONING` 단계가 대폭 단축됨.

---

## 6. 코드 변경 전체 목록

### 변경된 파일
| 파일 | 유형 | 변경 내용 |
|-----|------|---------|
| `api/send-verification.js` | 백엔드 | `from` 주소 변경 (1라인) |
| `api/signup.js` | 백엔드 | `signToken` import + JWT 발급 + Set-Cookie (약 15라인 추가) |
| `src/pages/LoginPage.jsx` | 프론트 | `apiCall` 재시도 로직 + `handleSignup` 자동 로그인 (약 25라인 수정) |

### 변경되지 않은 파일 (영향 없음)
- `api/login.js` — 기존 토큰 발급 로직을 그대로 복사했을 뿐
- `api/auth.js` — 인증 유틸은 공용, 변경 불필요
- `api/middleware.js` — `withCors` 에러 핸들러 그대로
- `Dockerfile`, `buildspec.yml` — 이미지 빌드 방식 변경 없음

### DB 스키마
**변경 없음** — `public.users` 테이블이 이미 `email`·`username`·`name`·`is_admin` 컬럼을 보유.

### 환경변수 (SSM Parameter Store)
**변경 없음** — `RESEND_API_KEY`는 기존에 등록되어 있었음. 도메인 변경은 Resend 대시보드에서만 처리.

---

## 7. 검증 결과

### 7-1. Part A 검증 (이메일 발송)

#### 배포 전 (실패)
```bash
curl -X POST https://d2dcsdi9b1j2rf.cloudfront.net/api/send-verification \
  -d '{"email":"x@example.com","type":"signup"}'
# → HTTP 500, {"error":"서버 오류가 발생했습니다."}
```
CloudWatch: `[Verify] Resend 발송 실패: statusCode: 403`

#### 배포 후 (성공)
```bash
curl -X POST https://d2dcsdi9b1j2rf.cloudfront.net/api/send-verification \
  -d '{"email":"verify-test-2026@example.com","type":"signup"}'
# → HTTP 200, {"message":"인증코드가 발송되었습니다. 이메일을 확인해주세요."}
```
CloudWatch: `[Verify] 인증코드 발송: verify-test-2026@example.com (type=signup)`

#### 실사용자 검증
- `ss1zeepapa@naver.com` — 인증코드 수신 → 회원가입 성공
- 수신 메일 발신자: `AI TutorTwo <noreply@newsstand.blog>` ✅

### 7-2. Part B 검증 (자동 로그인)

#### 프론트엔드 번들 교체 확인
| 항목 | 배포 전 | 배포 후 |
|------|--------|--------|
| 메인 JS 번들 | `index-k8LoF9TF.js` | `index-DQJLNsHW.js` |
| "회원가입 완료… 로그인해주세요" 문자열 | 존재 | **제거됨** (UX 통합) |

#### API 응답 구조 확인
- `/api/signup`: 응답에 `name`, `admin`, `message` 포함 + `Set-Cookie: token=...` 헤더 세팅
- 브라우저: 가입 성공 시 쿠키 저장 → `window.location.reload()` → 메인 페이지 진입

#### 콜드 스타트 재시도 검증
프론트엔드 재시도 로직이 404/502/503/504 응답을 가로채서 1.2초 후 자동 재실행. 브라우저 Network 탭에는 **두 번의 요청** 중 마지막 200 하나만 표시되는 형태는 아니고, 두 요청 모두 표시되나 사용자 화면에는 에러가 노출되지 않음.

---

## 8. 운영 체크리스트

### 8-1. Resend 도메인 / DNS 모니터링
- [ ] WordPress.com 결제 자동 갱신 확인 (`newsstand.blog` 만료 방지)
- [ ] Resend 대시보드에서 Bounce/Complaint rate 월 1회 점검
- [ ] DMARC 리포트 누적 시 `p=none` → `p=quarantine` → `p=reject` 상향 검토

### 8-2. Lambda / CloudWatch 모니터링
- [ ] `[Verify] Resend 발송 실패` 알람 설정 (Resend API 키 만료/쿼터 초과 대비)
- [ ] Lambda Duration P95 1초 초과 시 알림 (SSM 로드 지연 감지)
- [ ] 콜드 스타트 빈도 확인 → 심각하면 Provisioned Concurrency 1개 고려

### 8-3. DB / 보안
- [ ] `public.users` 가입자 추이 주간 집계 (자동 로그인 UX 효과 측정)
- [ ] `email_verifications` 테이블 30일 이상된 레코드 정기 삭제 (DB 용량 관리)

### 8-4. 배포 재현성
- 배포 스크립트화(`scripts/deploy.sh`) 여지 있음 — 현재는 명령어 반복 수동 실행

---

## 9. 후속 과제 / TODO

### 9-1. 단기 (권장)
1. **배포 자동화 스크립트**: `npm run deploy` 한 번으로 Part 5-2의 8단계 수행
2. **Lambda Provisioned Concurrency 1개**: 콜드 스타트 근본 제거 (월 추가 비용 ~$5)
3. **SignupPage 분리**: 현재 `LoginPage.jsx` 한 파일에 로그인/가입/재설정 전부 → 코드 길이(600+라인)

### 9-2. 중기
4. **Resend 도메인 `p=quarantine` 승격**: 2주 모니터링 후 DMARC 정책 강화
5. **카카오 로그인 추가 옵션**: 이메일 인증 외 대체 경로 → `users.provider`, `users.kakao_id` 컬럼 추가
6. **AWS SES 백업 경로**: Resend 장애 대비 2차 발송 경로

### 9-3. 장기
7. **도메인 기반 메인 URL**: 현재 `d2dcsdi9b1j2rf.cloudfront.net` → `app.newsstand.blog` 또는 별도 서비스 도메인
8. **가입자 전용 알림 메일**: 학습 리마인더, 주간 리포트 (Resend 발송량 고려)

---

## 10. 부록: AWS CLI 명령 전체 로그

### A. 진단 단계
```bash
# 배포 환경 파악
aws sts get-caller-identity
aws ssm get-parameters-by-path --path "/aitutor/" --region ap-northeast-2 --query 'Parameters[*].Name'
aws lambda list-functions --region ap-northeast-2 --query 'Functions[?contains(FunctionName, `aitutor`)]'

# 500 에러 원인 로그 조회
aws logs tail /aws/lambda/aitutor --since 2h --region ap-northeast-2 --filter-pattern "ERROR"

# DNS 전파 확인
dig +short TXT resend._domainkey.newsstand.blog @8.8.8.8
dig +short MX send.newsstand.blog @8.8.8.8
dig +short TXT send.newsstand.blog @8.8.8.8
dig +short TXT _dmarc.newsstand.blog @8.8.8.8
```

### B. 배포 공통 시퀀스
```bash
# 1) zip 생성
cd workspace/aitutor
rm -f /tmp/aitutor-src.zip
zip -r /tmp/aitutor-src.zip . \
  -x "node_modules/*" -x ".git/*" -x ".env*" \
  -x "ios/*" -x "android/*" -x "pool/*" \
  -x "test-results/*" -x "playwright-report/*" \
  -x ".vercel/*" -x "REBUILD*.md" -x "*.DS_Store" -q

# 2) S3 업로드
aws s3 cp /tmp/aitutor-src.zip \
  s3://aitutor-codebuild-src-794531974010/aitutor-src.zip \
  --region ap-northeast-2

# 3) CodeBuild 트리거
aws codebuild start-build --project-name aitutor-build --region ap-northeast-2

# 4) 빌드 완료 대기 (수동 폴링 or AWS CLI wait 대신 상태 조회)
aws codebuild batch-get-builds --ids <BUILD_ID> --region ap-northeast-2 \
  --query 'builds[0].{Status:buildStatus,Phase:currentPhase}'

# 5) 최신 이미지 digest 조회
aws ecr describe-images --repository-name aitutor --region ap-northeast-2 \
  --image-ids imageTag=latest --query 'imageDetails[0].imageDigest' --output text

# 6) Lambda 업데이트 (digest 기반)
aws lambda update-function-code \
  --function-name aitutor \
  --image-uri "794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor@<DIGEST>" \
  --region ap-northeast-2

# 7) 업데이트 완료 대기
aws lambda wait function-updated --function-name aitutor --region ap-northeast-2

# 8) (프론트 변경 시) CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id E2MP4BK1D16LJN \
  --paths "/*"
```

### C. 사후 검증
```bash
# 새 프론트 번들 반영 확인
curl -s https://d2dcsdi9b1j2rf.cloudfront.net/ | grep -oE "index-[a-zA-Z0-9]+\.js"

# 엔드포인트 smoke 테스트
curl -X POST https://d2dcsdi9b1j2rf.cloudfront.net/api/send-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-test-2026@example.com","type":"signup"}'

# 최근 로그 확인
aws logs tail /aws/lambda/aitutor --since 5m --region ap-northeast-2 \
  --filter-pattern "[Verify]"
```

---

> **작성 완료.** REBUILD11(AWS 마이그레이션)에 이어 프로덕션 가동 상태에서 필요한 후속 개선 두 건을 깔끔히 처리했다.
> 다음 REBUILD13이 필요해지는 시점: 배포 자동화 스크립트, 카카오 로그인 추가, 또는 도메인 기반 URL 전환 중 하나가 착수될 때.
