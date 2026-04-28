# AI Tutor v3 — 개발 현황 + 개선/리팩토링/보안 점검 보고서

> 작성일: 2026-03-18
> 프로젝트: workspace/aitutor
> 배포: [https://aitutor-six.vercel.app](https://aitutor-six.vercel.app)

---

## 1. 현재 개발 상태 요약

### 프로젝트 규모


| 항목              | 수량                            |
| --------------- | ----------------------------- |
| 프론트엔드 파일 (src/) | 25개                           |
| 백엔드 API (api/)  | 15개                           |
| Playwright 테스트  | 24개                           |
| 총 코드 라인         | ~4,500줄 (src) + ~1,850줄 (api) |


### 기능 구현 완료 목록

#### 학습 탭 (QuizTab) ✅

- 카테고리/시험 필터 + 페이지네이션
- 플래시카드 UI (펼치기/접기, 선택지, 정답/오답)
- 문제 이미지 토글 (원본 이미지 보기 버튼)
- 기본 해설 표시 (HTML 렌더링 지원)
- AI 해설 3개 프로바이더 (Gemini/OpenAI/Claude SSE 스트리밍)
- AI 해설 수동 저장/삭제/저장본 조회
- AI 해설 이미지 포함 옵션 + 추가 지시사항 입력
- AI 해설 트래킹 패널 (요청/프롬프트/응답/저장 추적)
- 메모 CRUD + 첨부파일 (업로드/다운로드/삭제)
- 법령 키워드 자동 링크 (「법령명」 클릭 → 법제처/AI법령정보)
- 법령검색 패널 + AI 법령정보 체크박스
- 내용 복사 버튼
- 이미지 확대 모달

#### 문제관리 탭 (ManageTab) ✅

- 문제 목록 + 카테고리/시험 필터
- 문제 추가/수정 모달 (QuestionForm)
- 문제 삭제
- 체크박스 전체선택 + 일괄 삭제
- 일괄 과목 지정

#### DocStore 연동 탭 (ImportTab) ✅

- 소스 시험 선택 + 문제 로드
- 칸반 3단계 (대상조회 → 문제이관 → 해설생성 및 완료)
- 카테고리 선택 + 시험이름 입력
- 체크박스 + 전체선택
- 문제이관 / 해설생성 / 소스삭제 버튼
- LLM 프로바이더 선택
- 진행 상태 바 + 처리 로그 (복사/초기화)

#### 설정 탭 (SettingsTab) ✅

- 카테고리 CRUD (추가/수정/삭제)
- 과목 CRUD (추가/수정/삭제)
- 시험별 카테고리 지정
- LLM 설정 패널 (모델 선택, Temperature, MaxTokens, Thinking, Reasoning)
- 회원관리 (목록/권한 토글/삭제)

#### 공통 ✅

- 토스트 알림 (ToastProvider + useToast)
- 이미지 확대 모달 (ImageModal)
- 에러 바운더리 (ErrorBoundary)
- 다크모드 (useTheme + CSS 변수)
- 하단 네비게이션 (BottomNav)
- 인증 (로그인/회원가입/로그아웃)
- SSE 스트리밍 공통 훅 (useSSE)

---

## 2. 버그 — 즉시 수정 필요 (P0)

### 2-1. ManageTab 일괄 과목지정 action 불일치


| 항목     | 프론트 (현재)            | API (기대)        |
| ------ | ------------------- | --------------- |
| action | `bulkAssignSubject` | `assignSubject` |
| 문제 ID  | `questionIds`       | `ids`           |
| 과목 ID  | `subjectId`         | `subject_id`    |


**파일:** `src/tabs/ManageTab/index.jsx` 라인 70

### 2-2. ImportTab check-status action 불일치


| 항목     | 프론트 (현재)       | API (기대) |
| ------ | -------------- | -------- |
| action | `check-status` | `status` |


**파일:** `src/tabs/ImportTab/index.jsx` 라인 88

### 2-3. MemoPanel 저장 응답 구조 불일치

API 응답이 `{ id, created_at, message }`인데 프론트에서 `data.memo`를 참조함.

**파일:** `src/tabs/QuizTab/MemoPanel.jsx` 라인 42

---

## 3. 보안 취약점

### 심각도: 높음


| #   | 취약점                    | 현재 상태                            | 권장 조치          |
| --- | ---------------------- | -------------------------------- | -------------- |
| 1   | **localStorage 토큰 저장** | XSS 시 탈취 가능                      | HttpOnly 쿠키 전환 |
| 2   | **CORS 와일드카드**         | `Access-Control-Allow-Origin: `* | 특정 도메인 제한      |
| 3   | **API 키 존재 여부 노출**     | 에러 메시지에 "~KEY가 설정되지 않았습니다"       | 일반 에러 메시지로 변경  |


### 심각도: 중간


| #   | 취약점                  | 현재 상태                                | 권장 조치                 |
| --- | -------------------- | ------------------------------------ | --------------------- |
| 4   | **Rate Limiting 미흡** | 로그인만 메모리 기반 (서버리스 무효)                | Vercel KV/Redis 기반 제한 |
| 5   | **AI 응답 HTML 미검증**   | dangerouslySetInnerHTML 미사용이지만 DB 저장 | DOMPurify 도입 검토       |
| 6   | **외부 CDN 의존**        | 로그인 일러스트 unDraw CDN                  | 로컬 에셋으로 전환            |


### 양호한 부분 ✅

- SQL Injection 방어: 파라미터화 쿼리 전면 사용
- 비밀번호 해싱: scrypt (N=16384, r=8, p=1)
- JWT 서명: HMAC-SHA256 + timingSafeEqual
- 환경변수: Vercel 서버리스 런타임에서만 접근

---

## 4. 성능 최적화 제안

### 4-1. React 렌더링 최적화


| 문제                               | 위치                         | 해결               |
| -------------------------------- | -------------------------- | ---------------- |
| `filteredExams` 매 렌더링마다 filter() | QuizTab, ManageTab         | `useMemo` 래핑     |
| `generateExplanation` 매 렌더링 재선언  | AiExplanation              | `useCallback` 래핑 |
| ImportTab 7개 setState 연쇄 호출      | onExamChange               | `useReducer` 통합  |
| 카테고리 목록 매번 API 호출                | Header, QuizTab, ManageTab | Context로 공유 캐시   |


### 4-2. 네트워크 최적화


| 항목        | 현재           | 제안                            |
| --------- | ------------ | ----------------------------- |
| API 타임아웃  | 없음           | AbortController + 30초 타임아웃    |
| 메타 데이터 캐싱 | 매 탭 전환 시 재호출 | SWR 패턴 또는 Context 캐시          |
| 이미지 프리로딩  | 없음           | IntersectionObserver 기반 지연 로드 |


### 4-3. 번들 최적화


| 항목           | 현재                | 제안                                            |
| ------------ | ----------------- | --------------------------------------------- |
| vendor-react | 161KB (52KB gzip) | React 18.3 경량화 빌드 검토                          |
| 코드 스플리팅      | 탭 단위 lazy         | 무거운 컴포넌트 추가 분리 (LlmSettingsPanel, TracePanel) |
| CSS purge    | Tailwind 기본       | safelist 점검                                   |


---

## 5. 리팩토링 제안

### 5-1. API 미들웨어 통합 (코드 중복 제거)

```javascript
// lib/middleware.js — CORS + 인증 + 에러 핸들링 통합
function withAuth(handler) {
  return async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    // 인증
    const payload = verifyToken(extractToken(req));
    if (!payload) return res.status(401).json({ error: '인증 필요' });
    req.user = payload;
    // 핸들러 실행
    try { await handler(req, res); }
    catch (err) { res.status(500).json({ error: '서버 오류' }); }
  };
}
```

**영향:** 15개 API 파일에서 반복 코드 30줄+ 제거

### 5-2. 전역 상태 관리 개선

```
현재: 각 탭에서 독립적으로 meta 조회
제안: MetaContext 생성 → categories, exams, subjects 1회 로드 + 공유
```

### 5-3. API 호출 레이어 정리

```
현재: 각 컴포넌트에서 직접 URL + action 하드코딩
제안: api/client.js에 도메인별 함수 정리

예:
  memoApi.list(questionId)
  memoApi.save(questionId, content)
  explanationApi.list(questionId)
  explanationApi.save({ questionId, provider, model, content })
```

---

## 6. 기능 확장 제안

### 6-1. 학습 통계 대시보드


| 기능        | 설명                | 우선순위 |
| --------- | ----------------- | ---- |
| 정답률 차트    | 카테고리/시험별 정답률 시각화  | 높    |
| 학습 진도     | 풀은 문제 수 / 전체 문제 수 | 높    |
| 오답 노트     | 틀린 문제만 모아서 복습     | 높    |
| 연속 정답 스트릭 | 동기부여 UI           | 중    |


### 6-2. 학습 모드 다양화


| 모드    | 설명            | 우선순위 |
| ----- | ------------- | ---- |
| 랜덤 모드 | 문제를 셔플하여 풀기   | 높    |
| 시험 모드 | 제한 시간 + 점수 계산 | 중    |
| 오답 모드 | 이전에 틀린 문제만 출제 | 중    |
| 즐겨찾기  | 북마크한 문제만 풀기   | 낮    |


### 6-3. 모바일/PWA


| 기능           | 설명                  | 우선순위 |
| ------------ | ------------------- | ---- |
| PWA manifest | 홈 화면 추가, 오프라인       | 높    |
| Capacitor    | iOS/Android 네이티브 래퍼 | 중    |
| Push 알림      | 학습 리마인더             | 낮    |


### 6-4. 협업/소셜


| 기능    | 설명            | 우선순위 |
| ----- | ------------- | ---- |
| 문제 공유 | 딥링크로 특정 문제 공유 | 중    |
| 해설 공유 | AI 해설 결과 공유   | 낮    |
| 랭킹    | 사용자 간 정답률 비교  | 낮    |


---

## 7. 접근성(a11y) 개선


| 문제                 | 위치              | 권장                      |
| ------------------ | --------------- | ----------------------- |
| `<label>` 태그 누락    | LoginPage 입력 필드 | `htmlFor` + `id` 연결     |
| `aria-label` 부재    | 아이콘 버튼 전체       | 모든 아이콘 버튼에 추가           |
| `role="dialog"` 누락 | Modal.jsx       | `role`, `aria-modal` 추가 |
| 포커스 트래핑 없음         | Modal.jsx       | Tab 키 순환 처리             |
| 색상만으로 상태 표현        | 칸반 단계, 정답/오답    | 아이콘 + 텍스트 병행            |
| 모바일 터치 타겟          | 편집/삭제 버튼        | 최소 44x44px 보장           |


---

## 8. 개선 우선순위 로드맵

### Phase 1: 버그 수정 (즉시)

- ManageTab bulkAssignSubject action/파라미터 수정
- ImportTab check-status → status 수정
- MemoPanel 응답 구조 수정

### Phase 2: 보안 강화 (1주)

- CORS 와일드카드 → 도메인 제한
- API 에러 메시지 일반화 (키 존재 여부 미노출)
- API 타임아웃 추가 (AbortController)

### Phase 3: 성능 최적화 (1주)

- useMemo/useCallback 적용
- MetaContext 공유 캐시
- API 클라이언트 레이어 정리

### Phase 4: 접근성 (1주)

- aria 속성 전면 추가
- 모달 포커스 트래핑
- 터치 타겟 44px 보장

### Phase 5: 기능 확장 (2~4주)

- 학습 통계 대시보드
- 오답 노트 / 랜덤 모드
- PWA manifest + 오프라인 지원

