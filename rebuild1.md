# AI Tutor v1 — 신규 개발 보고서

> 작성일: 2026-03-18
> 프로젝트: workspace/aitutor (workspace/error 대체)
> 개발 소요: 약 15분 (AI 보조)

---

## 1. 기존 사이트(error) vs 신규(aitutor) 비교

### 기술스택 비교

| 항목 | error (기존) | aitutor (신규) | 개선 효과 |
|------|-------------|---------------|----------|
| **프론트엔드** | Vanilla JS 단일 파일 | React 18 + JSX | 컴포넌트 재사용, 상태관리 |
| **파일 구조** | index.html 1개 (5,069줄) | 30+ 파일 (평균 120줄) | 유지보수성 대폭 향상 |
| **CSS** | 인라인 `<style>` 1,340줄 | Tailwind CSS 3.4 | 유틸리티 클래스, 일관성 |
| **빌드도구** | 없음 (번들링 없음) | Vite 6 | 트리쉐이킹, 코드스플리팅, HMR |
| **라우팅** | JS 함수 기반 수동 전환 | React Router v6 | URL 기반, 뒤로가기 지원 |
| **상태관리** | 전역 변수 (let) | React useState/useEffect | 사이드이펙트 제어, 예측 가능 |
| **테스트** | Playwright 1개 | Playwright 24개 | 5단계 커버리지 |
| **번들 크기** | 5,069줄 전체 로드 | 178KB JS (gzip ~63KB) | Lazy Loading으로 초기 로딩 최소화 |
| **디자인** | 수작업 CSS + 이모지 | Quizlet 톤앤매너 + SVG 아이콘 | 모던하고 트렌디한 UI |
| **다크모드** | CSS 변수 기반 | CSS 변수 + Tailwind + 전환 애니메이션 | 더 부드러운 전환 |
| **모바일** | 반응형 CSS만 | 하단 네비 + Safe Area 준비 | 네이티브 앱 수준 UX |

### 디자인 비교

| 요소 | error (기존) | aitutor (신규) |
|------|-------------|---------------|
| **컬러** | 인디고 단색 (#4f46e5) | Quizlet 보라 (#4255ff) + 그라디언트 |
| **카드** | 기본 border + 작은 라운딩 | 둥근 카드 (16px) + 부드러운 그림자 |
| **버튼** | 단순 배경색 | 그라디언트 + hover 리프트 효과 |
| **네비게이션** | 상단 버튼 나열 | 하단 탭 바 (앱 스타일) |
| **아이콘** | 이모지 | SVG 아이콘 (Heroicons 스타일) |
| **로딩** | 없음 | 스켈레톤 + 스피너 |
| **애니메이션** | 최소한 transition | fadeIn, slideUp, shimmer |
| **입력 필드** | 기본 스타일 | 둥근 모서리 + focus 링 |
| **폰트** | 시스템 폰트 | Noto Sans KR (Google Fonts) |

---

## 2. 구현 완료 항목

### 1단계: 프로젝트 셋업 + 인증 + 레이아웃 ✅

- [x] Vite 6 + React 18 + Tailwind CSS 3.4 프로젝트 구조
- [x] 로그인/회원가입 페이지 (Quizlet 스타일)
- [x] 상단 헤더 (로고 + 다크모드 토글 + 로그아웃)
- [x] 하단 네비게이션 바 (4탭: 학습/관리/연동/설정)
- [x] 다크모드 토글 (localStorage 저장 + 시스템 기본설정 폴백)
- [x] CSS 변수 기반 테마 시스템 (라이트/다크)
- [x] Safe Area CSS 준비 (Capacitor 대응)
- [x] Playwright 테스트 8개

### 2단계: 문제풀이 탭 ✅

- [x] 카테고리/시험 필터 셀렉트
- [x] 문제 카드 목록 (페이지네이션 + 더보기)
- [x] 카드 펼치기/접기 (아코디언)
- [x] 문제 본문 + 이미지 표시
- [x] 선택지 UI (정답/오답 시각 피드백)
- [x] 정답 결과 표시 + 다시 풀기 버튼
- [x] 스켈레톤 로딩 + 빈 상태
- [x] Playwright 테스트 4개

### 3단계: AI 해설 + 메모 기능 ✅

- [x] SSE 스트리밍 공통 훅 (useSSE) — Gemini/OpenAI/Claude 통합
- [x] AI 해설 패널 (3개 프로바이더 탭)
- [x] 스트리밍 실패 시 일반 모드 자동 폴백
- [x] 해설 DB 저장/조회
- [x] 생성 중지 버튼
- [x] 메모 CRUD (추가/수정/삭제)
- [x] 메모 입력 Enter 키 지원
- [x] 메모 호버 시 액션 버튼 표시
- [x] AI 해설 / 메모 탭 전환 UI
- [x] Playwright 테스트 3개

### 4단계: 문제관리 + DocStore 연동 ✅

- [x] 문제 관리 테이블 (카테고리/시험 필터)
- [x] 문제 삭제 기능
- [x] 문항 수 표시
- [x] DocStore 연동 칸반 보드 (3단계: 대상조회 → 문제이관 → 해설생성 및 완료)
- [x] 소스 시험 셀렉트
- [x] 칸반 컬럼 접기/펼치기
- [x] 전체 접기/펼치기 토글
- [x] 칸반 카드 (번호 + 본문 미리보기 + 정답 배지)
- [x] Playwright 테스트 4개

### 5단계: 설정 + 최종 마무리 ✅

- [x] 설정 탭 서브탭 (카테고리 / AI 설정 / 회원관리)
- [x] 카테고리 CRUD (추가/삭제)
- [x] 과목 관리 (카테고리별 과목 추가)
- [x] AI 모델 설정 표시 (Gemini/OpenAI/Claude)
- [x] 회원관리 (목록 + 권한 표시)
- [x] 전체 앱 빌드 검증
- [x] Playwright 테스트 5개

---

## 3. 미구현 / 후속 개발 필요 항목

### 프론트엔드

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| 문제 등록/수정 모달 | 높 | ManageTab에서 문제 추가/편집 |
| 칸반 문제이관 액션 | 높 | ImportTab에서 실제 이관/해설생성 버튼 동작 |
| 소스 삭제 기능 | 중 | ImportTab 대상조회에서 삭제 |
| 법령 조회 연동 | 중 | 문제 본문의 법령명 링크화 |
| 이미지 확대 모달 | 낮 | 문제 이미지 클릭 시 확대 |
| TOC 사이드바 | 낮 | 데스크톱에서 좌측 문제 목록 |
| 키보드 단축키 | 낮 | N(다음), P(이전), Space(펼치기) |
| 첨부파일 업로드 | 중 | 메모에 이미지/파일 첨부 |

### 인프라

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| Vercel 배포 설정 | 높 | 별도 Vercel 프로젝트 연결 |
| 환경변수 설정 | 높 | DATABASE_URL, API 키 등 |
| Capacitor iOS/Android | 중 | MOBILE.md 계획 참조 |
| PWA manifest + SW | 중 | 오프라인 지원 |

### DB/인프라 (사용자 별도 진행 예정)

| 항목 | 상태 |
|------|------|
| DB 테이블 변경 | 미정 (사용자 별도 계획) |
| DB 마이그레이션 | 미정 |
| 인프라 변경 | 미정 |

---

## 4. 프로젝트 구조

```
workspace/aitutor/
├── src/
│   ├── main.jsx                    # Vite 진입점
│   ├── App.jsx                     # 루트 레이아웃 + React Router
│   ├── global.css                  # Tailwind + CSS 변수 + 애니메이션
│   ├── index.html                  # HTML 템플릿
│   ├── pages/
│   │   └── LoginPage.jsx           # 로그인/회원가입
│   ├── tabs/
│   │   ├── QuizTab/
│   │   │   ├── index.jsx           # 문제풀이 목록 + 필터
│   │   │   ├── QuizCard.jsx        # 문제 카드 (선택지 + 정답)
│   │   │   ├── AiExplanation.jsx   # AI 해설 (3 프로바이더)
│   │   │   └── MemoPanel.jsx       # 메모 CRUD
│   │   ├── ManageTab/
│   │   │   └── index.jsx           # 문제 관리 테이블
│   │   ├── ImportTab/
│   │   │   └── index.jsx           # DocStore 연동 칸반
│   │   └── SettingsTab/
│   │       └── index.jsx           # 설정 (카테고리/AI/회원)
│   ├── components/
│   │   ├── Header.jsx              # 상단 헤더
│   │   ├── BottomNav.jsx           # 하단 네비게이션
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Card.jsx
│   │       ├── Modal.jsx
│   │       └── Skeleton.jsx
│   ├── hooks/
│   │   ├── useTheme.js             # 다크모드
│   │   └── useSSE.js               # SSE 스트리밍 (AI 공통)
│   └── lib/
│       └── api.js                  # fetch 래퍼 + 토큰 관리
├── api/                             # 기존 error/api/ 복사 (15개, 변경 없음)
├── tests/                           # Playwright E2E (24개)
├── server.js                        # Express 개발 서버
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
└── package.json
```

---

## 5. 테스트 결과

```
Running 24 tests using 1 worker

✓  1~8   1단계: 레이아웃 및 인증 (8 passed)
✓  9~12  2단계: 문제풀이 탭 (4 passed)
✓  13~15 3단계: AI 해설 + 메모 (3 passed)
✓  16~19 4단계: 문제관리 + DocStore 연동 (4 passed)
✓  20~24 5단계: 설정 + 최종 (5 passed)

24 passed (28.4s)
```

---

## 6. 빌드 결과

```
vite v6.4.1 building for production...
✓ 42 modules transformed.

dist/index.html                      1.16 kB │ gzip:  0.71 kB
dist/assets/index-*.css             16.84 kB │ gzip:  4.46 kB
dist/assets/index-*.js (5 chunks)   17.24 kB │ gzip:  6.71 kB
dist/assets/vendor-react-*.js      161.15 kB │ gzip: 52.73 kB

Total: ~196 KB │ gzip: ~64 KB
Built in 452ms
```
