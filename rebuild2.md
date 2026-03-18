# AI Tutor v2 — 누락 기능 식별 및 구현 보고서

> 작성일: 2026-03-18
> 기준: workspace/error (기존) vs workspace/aitutor (신규)
> 최종 점검: 2026-03-18

---

## 누락 기능 목록 — 구현 상태

### 1. 공통 (P0)

- [x] 토스트 알림 시스템 (ToastProvider + useToast) → `src/components/ui/Toast.jsx`
- [x] 이미지 확대 모달 (ImageModal + useImageModal) → `src/components/ui/ImageModal.jsx`
- [x] 에러 바운더리 (ErrorBoundary) → `src/components/ErrorBoundary.jsx`

### 2. 문제관리 탭 (P0)

- [x] 문제 추가 모달 (번호, 본문, 선택지 4개, 정답, 해설, 카테고리/시험/과목) → `src/tabs/ManageTab/QuestionForm.jsx`
- [x] 문제 수정 모달 (행 클릭으로 편집) → QuestionForm 재사용
- [x] 체크박스 전체선택 + 일괄 과목지정 → ManageTab/index.jsx
- [x] 일괄 삭제 → ManageTab/index.jsx

### 3. DocStore 연동 탭 (P0)

- [x] 카테고리 선택 + 시험이름 입력 (이관 대상 지정) → ImportTab 대상조회 툴바
- [x] 대상조회 체크박스 + 전체선택 → checkedWait + toggleAllWait
- [x] 문제이관 버튼 (선택/전체 이관) → importQuestions()
- [x] 이관완료 체크박스 + 전체선택 → checkedImported + toggleAllImported
- [x] LLM 프로바이더/모델 선택 → llmProvider select (Gemini/OpenAI/Claude)
- [x] 해설생성 버튼 (선택/전체 해설 생성) → generateExplanations()
- [x] 소스삭제 버튼 → deleteFromSource()
- [x] 진행 상태 표시 바 → progress state + 퍼센트 바
- [x] 처리 로그 (info/success/error + 복사/초기화) → logs + 접기/펼치기 UI

### 4. 설정 탭

- [x] 카테고리 수정 (이름) → 인라인 편집 UI
- [x] 과목 수정/삭제 → 인라인 편집 + 삭제 버튼
- [x] 시험별 카테고리 지정 → 드롭다운으로 카테고리 변경
- [x] 회원 권한 토글 (관리자 부여/해제) → toggleAdmin()
- [x] 회원 삭제 → deleteUser()

### 5. 문제풀이 탭

- [x] 메모 첨부파일 (업로드/다운로드/삭제) → MemoPanel 파일 첨부 UI
- [x] 문제 이미지 클릭 시 확대 모달 → openImage(q.image_url)
- [x] 내용 복사 버튼 → clipboard API + 토스트
- [x] 헤더 카테고리 선택 (전체 앱 범위 필터) → Header categoryId + localStorage 저장

---

## 구현 파일 목록

| 파일 | 신규/수정 | 내용 |
|------|----------|------|
| `src/components/ui/Toast.jsx` | 신규 | 토스트 알림 (ToastProvider + useToast) |
| `src/components/ui/ImageModal.jsx` | 신규 | 이미지 확대 모달 |
| `src/components/ErrorBoundary.jsx` | 신규 | 에러 바운더리 |
| `src/tabs/ManageTab/QuestionForm.jsx` | 신규 | 문제 추가/수정 폼 |
| `src/tabs/ManageTab/index.jsx` | 수정 | 체크박스 + 일괄작업 + 모달 연동 |
| `src/tabs/ImportTab/index.jsx` | 수정 | 전체 이관/해설/삭제 + 진행바 + 로그 |
| `src/tabs/SettingsTab/index.jsx` | 수정 | 카테고리/과목 수정삭제 + 회원관리 |
| `src/tabs/QuizTab/QuizCard.jsx` | 수정 | 이미지 확대 + 복사 버튼 |
| `src/tabs/QuizTab/MemoPanel.jsx` | 수정 | 첨부파일 업로드/다운로드/삭제 |
| `src/components/Header.jsx` | 수정 | 카테고리 선택 추가 |
| `src/App.jsx` | 수정 | ErrorBoundary + Toast + ImageModal + CategoryContext |

---

## 테스트 결과

```
24 passed (26.3s)
```

## 빌드 결과

```
✓ 54 modules transformed
✓ built in 589ms
```
