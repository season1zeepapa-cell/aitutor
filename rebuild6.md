# AI TutorTwo — 코드베이스 분석 + 개선/확장 제안 (rebuild6)

> 작성일: 2026-03-19
> 프로젝트: workspace/aitutor
> 배포: https://aitutor-six.vercel.app

---

## 1. 현재 프로젝트 규모

| 영역 | 파일 수 | 코드 라인 |
|------|---------|-----------|
| 프론트엔드 (src/) | 28개 | ~4,400줄 |
| 백엔드 API (api/) | 17개 | ~1,840줄 |
| Playwright 테스트 | 6개 | ~475줄 |
| 배치 스크립트 | 2개 | ~400줄 |
| **합계** | **53개** | **~7,100줄** |

### 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + React Router 6 + Vite 6 + TailwindCSS 3 |
| 백엔드 | Express.js + Vercel Serverless Functions |
| DB | Supabase PostgreSQL (pg 직접 사용) |
| AI | Gemini + OpenAI + Claude (SSE 스트리밍) |
| 인증 | HMAC-SHA256 JWT + HttpOnly 쿠키 + scrypt 해싱 |
| 모바일 | Capacitor 8 (iOS/Android) |
| 테스트 | Playwright E2E |

---

## 2. 아키텍처 강점

### 잘 설계된 부분

1. **API 미들웨어 패턴** — `withCors → withAuth → withAdmin` 계층적 래핑으로 보일러플레이트 최소화
2. **SSE 스트리밍 + 자동 폴백** — 스트리밍 실패 시 `stream:false`로 자동 재시도
3. **Lazy Loading** — 모든 탭/페이지 React.lazy()로 초기 번들 최소화
4. **보안** — parameterized SQL, DOMPurify, HttpOnly 쿠키, timingSafeEqual, 로그인 Rate Limiting
5. **QuizCard 재사용** — 카테고리/랜덤/카드 3가지 학습 모드에서 동일 컴포넌트 사용
6. **AI 프로바이더 추상화** — 3개 프로바이더를 동일한 SSE 인터페이스로 통합

---

## 3. 개선 필요 사항 (버그/기술 부채)

### 3-1. 즉시 수정 (P0)

| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| 1 | **meta API 중복 호출** — LearnHub, RandomQuiz, CardStudy, QuizTab 각각에서 `/api/questions action:meta` 독립 호출 | 4개 페이지 | 불필요한 API 트래픽 |
| 2 | **RandomQuiz 전체 문제 로드** — `limit=500`으로 전체 로드 후 프론트 셔플. 문제 수 증가 시 느려짐 | RandomQuiz.jsx | 500문제 초과 시 누락 |
| 3 | **base64 파일 저장** — memo_files에 첨부파일을 base64로 DB 저장. DB 용량 급증 위험 | api/memo-files.js | DB 비용 증가 |

### 3-2. 중기 개선 (P1)

| # | 문제 | 제안 |
|---|------|------|
| 4 | `filteredExams` 매 렌더링마다 `.filter()` 재계산 | `useMemo` 래핑 |
| 5 | ImportTab 7개 setState 연쇄 호출 | `useReducer` 통합 |
| 6 | AiExplanation 스트리밍 함수 매 렌더링 재선언 | `useCallback` 래핑 |
| 7 | 검색/필터 입력에 디바운싱 없음 | `useDebounce` 훅 추가 |
| 8 | mdToHtml이 간단한 문자열 치환 — 복잡한 마크다운 미지원 | `marked` 라이브러리 도입 검토 |

---

## 4. 성능 최적화 제안

### 4-1. 프론트엔드

| 항목 | 현재 | 제안 | 효과 |
|------|------|------|------|
| 메타 데이터 | 페이지별 개별 호출 | **MetaContext** 전역 1회 로드 + 캐시 | API 호출 75% 감소 |
| 문제 목록 | 매번 fetch | **SWR/React Query** 패턴 도입 | 캐시 + 재검증 |
| 이미지 로딩 | `loading="lazy"` | **IntersectionObserver** 지연 로드 | 초기 로딩 개선 |
| 큰 컴포넌트 | ImportTab 354줄 | **하위 컴포넌트 분리** | 유지보수성 |
| 번들 크기 | QuizCard 63KB gzip 21KB | **AiExplanation 분리 chunk** | 초기 로딩 개선 |

### 4-2. 백엔드

| 항목 | 현재 | 제안 | 효과 |
|------|------|------|------|
| DB 연결 | 매 요청 pool.query | **연결 재사용** 최적화 | 콜드스타트 감소 |
| 문제 목록 | 매번 전체 조회 | **커서 기반 페이지네이션** | 대량 데이터 대응 |
| 첨부파일 | base64 DB 저장 | **Supabase Storage** 또는 S3 | DB 용량 절감 |
| AI 프록시 | 타임아웃 없음 | **AbortController** + 30초 제한 | 비용 제어 |

---

## 5. 기능 확장 제안

### 5-1. 학습 효과 측정 (우선순위: 높음)

**현재**: 문제를 풀지만 결과가 저장되지 않음

**제안**: 학습 이력 추적 시스템

```
DB 추가 테이블: study_results
─────────────────────────
id | user_id | question_id | selected_choice | is_correct
study_mode (category/random/card) | created_at
```

**기능 목록:**

| 기능 | 설명 | 구현 난이도 |
|------|------|-------------|
| 정답률 기록 | 문제별/카테고리별/시험별 정답률 | 낮음 |
| 오답 노트 | 틀린 문제만 모아서 복습 모드 | 중간 |
| 학습 진도 | 전체 대비 풀어본 문제 비율 | 낮음 |
| 취약 과목 분석 | 과목별 정답률 차트 | 중간 |
| 일일 학습 목표 | 하루 N문제 목표 + 달성률 | 중간 |
| 연속 학습 스트릭 | 매일 학습 시 연속일 카운트 | 낮음 |

**LearnHub 대시보드 확장:**
```
┌─────────────────────────────────────┐
│  카테고리 3 │ 시험 10 │ 문제 280    │
├─────────────────────────────────────┤
│  오늘 풀이 15/20 │ 정답률 72% │ 🔥5일 │
├─────────────────────────────────────┤
│  과목별 정답률 차트 (바 차트)        │
└─────────────────────────────────────┘
```

### 5-2. 시험 모드 (우선순위: 높음)

실제 시험과 동일한 환경으로 모의고사 제공

| 항목 | 설명 |
|------|------|
| 제한 시간 | 과목당 N분 타이머 |
| 자동 채점 | 시간 종료 또는 제출 시 즉시 채점 |
| 결과 화면 | 점수 + 과목별 분석 + 오답 목록 |
| 이력 저장 | 모의고사 결과 DB 저장 |
| 랭킹 | 사용자 간 점수 비교 (선택) |

### 5-3. 북마크/즐겨찾기 (우선순위: 중간)

| 기능 | 설명 |
|------|------|
| 문제 북마크 | QuizCard에 별표 버튼 추가 |
| 북마크 학습 모드 | 북마크한 문제만 풀기 |
| 폴더 분류 | "어려운 문제", "다시 봐야 할 문제" 등 사용자 태그 |

```
DB: question_bookmarks
─────────────────────
id | user_id | question_id | tag | created_at
```

### 5-4. 문제 검색 (우선순위: 중간)

| 기능 | 설명 |
|------|------|
| 키워드 검색 | 문제 본문 + 선택지 전문 검색 |
| 필터 조합 | 카테고리 × 시험 × 과목 × 정답여부 |
| 검색 결과 하이라이트 | 키워드 매칭 부분 강조 |

```sql
-- PostgreSQL 전문 검색
SELECT * FROM questions
WHERE to_tsvector('korean', body || ' ' || choices::text) @@ plainto_tsquery('korean', '키워드');
```

### 5-5. 오프라인 학습 (우선순위: 중간)

| 항목 | 현재 | 제안 |
|------|------|------|
| 오프라인 접속 | 빨간 배너만 표시 | **Service Worker** + 캐싱 |
| 문제 캐시 | 없음 | **IndexedDB**에 최근 학습 문제 저장 |
| 답안 동기화 | 없음 | 온라인 복귀 시 자동 업로드 |

### 5-6. 소셜/협업 (우선순위: 낮음)

| 기능 | 설명 |
|------|------|
| 문제 공유 | 딥링크로 특정 문제 공유 (`/quiz/q/237`) |
| 해설 토론 | 문제별 댓글/토론 기능 |
| 스터디 그룹 | 그룹 생성 + 공동 학습 진도 |

---

## 6. UX 개선 제안

### 6-1. 접근성 (a11y)

| 문제 | 위치 | 권장 |
|------|------|------|
| `<label>` 태그 누락 | LoginPage 입력 필드 | `htmlFor` + `id` 연결 |
| `aria-label` 부재 | 아이콘 버튼 전체 | 모든 아이콘 버튼에 추가 |
| `role="dialog"` 누락 | Modal.jsx | `role`, `aria-modal` 추가 |
| 포커스 트래핑 없음 | Modal.jsx | Tab 키 순환 처리 |
| 색상만으로 상태 표현 | 정답/오답 | 아이콘 + 텍스트 병행 (이미 적용됨 ✅) |
| 모바일 터치 타겟 | 편집/삭제 버튼 | 최소 44×44px 보장 |

### 6-2. UX 개선

| 항목 | 현재 | 제안 |
|------|------|------|
| 스켈레톤 로딩 | 일부 적용 | 모든 데이터 로딩에 일관적 스켈레톤 |
| 에러 상태 UI | console.error만 | 사용자 친화적 에러 카드 + 재시도 버튼 |
| 풀스크린 카드 학습 | 일반 레이아웃 | 헤더/네비 숨기고 몰입 모드 |
| 스와이프 제스처 | 이전/다음 버튼만 | 카드 학습에서 좌우 스와이프 |
| 진동 피드백 | 없음 | Capacitor Haptics로 정답/오답 시 진동 |
| 다크모드 자동 전환 | 수동 토글만 | `prefers-color-scheme` 미디어 쿼리 감지 |

---

## 7. 코드 품질 개선

### 7-1. 리팩토링 제안

| 항목 | 현재 | 제안 | 효과 |
|------|------|------|------|
| API 클라이언트 | 각 컴포넌트에서 URL 하드코딩 | **도메인별 API 함수** 정리 | 유지보수성 |
| 전역 상태 | Context 2개 (Image, Category) | **MetaContext 추가** | API 중복 제거 |
| 폼 검증 | 각 컴포넌트 개별 처리 | **공통 useForm 훅** | 코드 재사용 |
| 에러 처리 | try/catch + console.error | **중앙 에러 핸들러** + Toast 연동 | 일관성 |

```javascript
// 제안: src/lib/questionApi.js
export const questionApi = {
  list: (params) => apiGet(`/api/questions?${new URLSearchParams(params)}`),
  meta: () => apiPost('/api/questions', { action: 'meta' }),
  create: (data) => apiPost('/api/questions', { action: 'create', ...data }),
  update: (id, data) => apiPost('/api/questions', { action: 'update', id, ...data }),
  delete: (id) => apiPost('/api/questions', { action: 'delete', id }),
};
```

### 7-2. 테스트 보강

| 영역 | 현재 테스트 | 추가 필요 |
|------|-------------|-----------|
| 로그인 플로우 | 기본 렌더링만 | 실제 로그인 성공/실패 |
| AI 해설 | 없음 | SSE 모킹 + 저장/삭제 |
| 랜덤 학습 | UI 렌더링만 | 실제 문제 로드 + 셔플 검증 |
| 카드 학습 | UI 렌더링만 | 이전/다음 네비게이션 |
| 정답 애니메이션 | 없음 | 효과 on/off 토글 |
| 설정 변경 | 카테고리 탭만 | 일반/AI/회원관리 전체 |

---

## 8. 인프라 개선

### 8-1. 모니터링

| 항목 | 현재 | 제안 |
|------|------|------|
| 에러 추적 | console.error | **Sentry** 연동 |
| API 응답시간 | 없음 | **Vercel Analytics** 활성화 |
| 사용자 행동 | 없음 | **간단한 이벤트 로깅** (학습 시작/완료/정답률) |

### 8-2. CI/CD

| 항목 | 현재 | 제안 |
|------|------|------|
| 자동 테스트 | 수동 실행 | **GitHub Actions** — PR 시 Playwright 자동 실행 |
| 자동 배포 | 수동 vercel CLI | **Vercel Git Integration** 또는 GitHub Actions 배포 |
| 빌드 검증 | 수동 | **PR 체크** — build + lint + test 통과 필수 |

### 8-3. 환경 분리

| 항목 | 현재 | 제안 |
|------|------|------|
| 환경 | Production 1개 | **Preview + Production** 분리 |
| DB | 프로덕션 DB 직접 | **개발용 DB** 별도 운영 |
| API 키 | 동일 키 공유 | **환경별 키** 분리 |

---

## 9. 우선순위 로드맵

### Phase 1: 핵심 개선 (1주)

- [ ] MetaContext 도입 — API 중복 호출 제거
- [ ] 학습 이력 저장 (study_results 테이블 + QuizCard 연동)
- [ ] LearnHub 대시보드에 정답률/진도 표시
- [ ] useMemo/useCallback 최적화

### Phase 2: 학습 모드 확장 (1~2주)

- [ ] 오답 노트 모드 (틀린 문제만 재학습)
- [ ] 시험 모드 (타이머 + 자동 채점 + 결과 화면)
- [ ] 문제 북마크 기능
- [ ] 카드 학습 스와이프 제스처

### Phase 3: UX/접근성 (1주)

- [ ] aria 속성 전면 추가
- [ ] 모달 포커스 트래핑
- [ ] 에러 상태 UI 통일
- [ ] 다크모드 자동 감지
- [ ] Capacitor Haptics (진동 피드백)

### Phase 4: 인프라 (1주)

- [ ] GitHub Actions CI (빌드 + 테스트 자동화)
- [ ] Sentry 에러 추적
- [ ] Vercel Preview 환경 분리
- [ ] 첨부파일 Supabase Storage 이관

### Phase 5: 고급 기능 (2~4주)

- [ ] 문제 키워드 검색 (PostgreSQL 전문 검색)
- [ ] 과목별 정답률 차트 (Chart.js)
- [ ] 오프라인 학습 (Service Worker + IndexedDB)
- [ ] 일일 학습 목표 + 스트릭
- [ ] 문제 공유 딥링크

---

## 10. 현재 빌드 산출물

```
dist/ (Vite 빌드, ~537ms)
├── vendor-react     161 KB (53 KB gzip)   — React + Router
├── QuizCard          63 KB (21 KB gzip)   — 핵심 카드 컴포넌트
├── index (settings)  20 KB ( 5 KB gzip)   — 설정 탭
├── index (quiz)      12 KB ( 4 KB gzip)   — 퀴즈 탭
├── RandomQuiz         7 KB ( 3 KB gzip)   — 랜덤 학습
├── CardStudy          5 KB ( 2 KB gzip)   — 카드 학습
├── LearnHub           4 KB ( 2 KB gzip)   — 학습 허브
├── CSS               29 KB ( 6 KB gzip)   — 전체 스타일
└── 기타 유틸/청크     ~15 KB               — shuffle, skeleton 등

총 gzip 전송량: ~96 KB (매우 가벼움)
```
