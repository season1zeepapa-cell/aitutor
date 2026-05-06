# AI TutorTwo — 문제 DB화 파이프라인 종합 문서 (rebuild7)

> 최초 작성: 2026-03-19 (기출문제 대량 등록)
> 최종 업데이트: 2026-03-26 (통합 파이프라인 구축)
> 프로젝트: workspace/aitutor
> 배포: https://aitutor-six.vercel.app

---

## 1. 전체 현황

### 1-1. DB 규모

| 카테고리 | 시험 수 | 문제 수 | 정답 | 해설 | 이미지 | 연도 |
|----------|---------|---------|------|------|--------|------|
| 영상정보관리사 | 4개 | 240 | 240 | 240 | - | 기존 |
| 네트워크관리사2급 | 25개 | 1,250 | 1,250 | 1,250 | 13 | 2020~2026 |
| **합계** | **29개** | **1,490** | **1,490** | **1,490** | **13** | |

### 1-2. 작업 이력

| 날짜 | 작업 | 결과 |
|------|------|------|
| 03-19 | 네관2급 25개 시험 1,250문제 초기 등록 | hwp5txt → 정규식 파싱 → DB INSERT |
| 03-19 | 정답 판별 + HTML 해설 작성 (클로드 직접) | 1,250문제 100% 완료 |
| 03-26 | pool-import.js 표/그림 Vision 감지 추가 | `--force-vision`, 시각자료 메타데이터 |
| 03-26 | pool-import-v2.js 고품질 파이프라인 신규 | HWP→PDF→이미지→Vision 체인 |
| 03-26 | pool-repatch.js 통합 재처리 파이프라인 | hwp5html→표보존+이미지추출→Vision→DB |
| 03-26 | 표 누락 210문제 복원 (25개 시험 일괄) | `<표>` → 실제 텍스트 복원 |
| 03-26 | 이미지 13문제 복원 + 정적 서빙 | public/q-images/ + image_url |
| 03-26 | 웹 업로드 UI (PoolUpload.jsx) | 소량 등록용 웹 인터페이스 |
| 03-26 | **`<표>`/`<그림>` 미복원: 0건** | 전체 복원 완료 |

---

## 2. 파이프라인 아키텍처

### 2-1. 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                    문제 DB화 파이프라인                            │
├─────────────────────┬───────────────────────────────────────────┤
│   대량 (배치 CLI)     │   소량 (웹 UI)                            │
│                     │                                           │
│  pool/ 폴더에 파일    │  브라우저에서 파일 업로드                    │
│       ↓             │       ↓                                   │
│  pool-import.js     │  api/pool-upload.js                       │
│  pool-import-v2.js  │  PoolUpload.jsx                           │
│       ↓             │       ↓                                   │
├─────────────────────┴───────────────────────────────────────────┤
│                                                                 │
│  [1차] 텍스트 추출 ─→ body + choices + answer                    │
│  [2차] 표/수식 보강 ─→ body에 표 내용 텍스트 포함                   │
│  [3차] 이미지 처리  ─→ image_url + body에 텍스트 설명              │
│                                                                 │
│  각 단계는 독립 실행 가능 (--only-visual 등 옵션)                   │
│  표/수식도 상태에 따라 이미지 모드로 재작업 가능                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [후처리] pool-explain.js ─→ AI 해설 생성                         │
│  [검증]   pool-patch-visual.js --scan ─→ 미복원 마커 검출          │
└─────────────────────────────────────────────────────────────────┘
```

### 2-2. 3단계 추출 전략

문제 유형에 따라 최적 전략을 자동 선택하거나, 옵션으로 강제 지정:

```
                    ┌──────────────┐
                    │  원본 파일     │
                    │ HWP/PDF/IMG  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
        [1차 텍스트]   [2차 표/수식]  [3차 이미지]
        ──────────    ──────────    ──────────
        hwp5txt       hwp5html     hwp5html
        pdf-parse     → <table>    → bindata/
        Gemini Text     보존         이미지 추출
              ↓            ↓            ↓
        body에 텍스트  body에 표     public/q-images/
        choices 파싱   텍스트 포함   image_url 연결
        answer 추출                 body에 텍스트 설명
```

| 단계 | 대상 | 도구 | DB 컬럼 | 재작업 |
|------|------|------|---------|--------|
| **1차: 텍스트** | 모든 문제 | hwp5txt, pdf-parse, Gemini | body, choices, answer | - |
| **2차: 표/수식** | `<표>` 마커 문제 | hwp5html → `<table>` 보존 | body (표 텍스트 추가) | `--only-visual` |
| **3차: 이미지** | `<그림>` 마커 문제 | hwp5html → bindata/ + Vision | image_url, body | `--only-visual` |

**재작업 옵션**: 표/수식이 텍스트로 충분하지 않으면 이미지 모드로 전환 가능

```bash
# 1차만 실행 (텍스트 추출)
node pool-import.js --exam-id=160

# 2차: 표/수식 보강 (원본 HWP 필요)
node pool-repatch.js --exam-id=160 --file="파일.hwp" --only-visual

# 3차: 이미지까지 포함 (원본 HWP 필요)
node pool-repatch.js --exam-id=160 --file="파일.hwp"

# 표/수식을 이미지로 재작업 (텍스트 변환이 불완전할 때)
node pool-repatch.js --exam-id=160 --file="파일.hwp" --only-visual
# → Vision이 이미지를 직접 보고 텍스트 설명 + 이미지 파일 저장
```

---

## 3. 스크립트 상세

### 3-1. pool-import.js — 기본 배치 임포트

```
역할: pool/ 폴더 파일 → Gemini 추출 → DB INSERT (신규 등록)
입력: PDF, HWP, PNG, JPG, TXT
```

**CLI 옵션**:
```bash
node pool-import.js --exam-id=4 [--category-id=1] [--dry-run]
node pool-import.js --exam-title="2026년 1회차" --category-id=1
node pool-import.js --exam-id=4 --force-vision   # Vision 강제
```

**파이프라인**:
1. pool/ 폴더 스캔 (지원 확장자 필터)
2. 파일별 `extractQuestionsFromFile()` 호출
   - **Vision 자동 판단**: 이미지/HWP → Vision, TXT → 텍스트, PDF → 텍스트 길이 기준
   - `--force-vision`: 강제 Vision 모드
   - 시각자료 마커 감지 (`<표>`, `<그림>`, `토폴로지` 등) → 프롬프트 강화
3. 시험 자동 생성 (`getOrCreateExam`)
4. 중복 체크 (`exam_id + original_number`)
5. DB INSERT + 시각자료 메타데이터 (`has_table`, `has_image`, `table_description`)
6. 처리 완료 파일 → `pool/done/` 이동

**Gemini 프롬프트 출력 형식**:
```json
{
  "original_number": 1,
  "body": "문제 본문",
  "choices": [{"num": 1, "text": "..."}, ...],
  "answer": 0,
  "has_table": false,
  "has_image": false,
  "table_description": "",
  "image_description": "",
  "needs_visual": false
}
```

---

### 3-2. pool-import-v2.js — 고품질 파이프라인

```
역할: 파일 형식별 최적 전략 자동 선택 → 페이지별 Vision → DB INSERT
입력: PDF, HWP, PNG, JPG (TXT 제외)
```

**CLI 옵션**:
```bash
node pool-import-v2.js --exam-id=4 [--dry-run]
node pool-import-v2.js --exam-title="2026년 1회차" --category-id=1
node pool-import-v2.js --exam-id=4 --hwp-vision   # HWP 직접 Vision
```

**6가지 전략 (자동 선택)**:

| # | 조건 | 파이프라인 | 품질 |
|---|------|-----------|------|
| 1 | 이미지 파일 | 직접 Vision | ★★★ |
| 2 | HWP + LibreOffice + poppler | HWP→PDF→페이지PNG→Vision | ★★★★★ |
| 3 | PDF + poppler | PDF→페이지PNG→Vision | ★★★★ |
| 4 | PDF 단독 | Gemini Vision 직접 전송 | ★★★ |
| 5 | HWP + `--hwp-vision` | Gemini Vision 직접 전송 | ★★ (실험) |
| 6 | HWP + hwp5txt | 텍스트 + 강화 프롬프트 | ★★ (폴백) |

**시스템 도구 확인**: 실행 시 자동 검출
```
LibreOffice: ✅/❌    brew install --cask libreoffice
poppler:     ✅/❌    brew install poppler
hwp5txt:     ✅/❌    pip install hwp5
```

**핵심 기능**:
- `hwpToPdf()`: `soffice --headless --convert-to pdf`
- `pdfToImages()`: `pdftoppm -png -r 200`
- `deduplicateQuestions()`: 페이지 경계 중복 제거 (같은 번호 → body 긴 것 유지)

---

### 3-3. pool-repatch.js — 통합 재처리 파이프라인 (핵심)

```
역할: 원본 HWP → 표 보존 + 이미지 추출 → Gemini Vision → DB UPDATE + 이미지 서빙
입력: pool/ 폴더의 HWP 파일 + DB exam_id
출력: DB body 업데이트 + public/q-images/ 이미지 파일
```

**CLI 옵션**:
```bash
node pool-repatch.js --exam-id=136 --file="파일명.hwp" --dry-run
node pool-repatch.js --exam-id=136 --file="파일명.hwp"
node pool-repatch.js --exam-id=136 --file="파일명.hwp" --only-visual
```

**5단계 파이프라인**:

```
[1] HWP → hwp5html → HTML
    ├── index.xhtml  (표 <table> 보존)
    └── bindata/     (이미지 JPG/BMP 추출)
              ↓
[2] HTML 파싱
    ├── <table> → "| 열1 | 열2 | 열3" 텍스트
    ├── <img src="bindata/BIN0001.jpg"> → [이미지1] 플레이스홀더
    └── BMP → JPEG 자동 변환 (macOS sips, Gemini BMP 미지원)
              ↓
[3] Gemini Vision 호출
    ├── parts[0]: 텍스트 프롬프트 (표 내용 포함)
    ├── parts[1]: [이미지1] 설명 라벨
    ├── parts[2]: inlineData (JPEG base64)
    └── ... (이미지 N개)
    → JSON 추출 (50문제) + image_index 매핑
              ↓
[4] 이미지 저장
    └── public/q-images/exam{id}_q{num}.jpg
              ↓
[5] DB UPDATE
    ├── questions.body     ← 표/이미지 텍스트 포함
    ├── questions.choices  ← 재파싱된 선택지
    ├── questions.image_url ← /q-images/exam{id}_q{num}.jpg
    └── questions.updated_at
```

**변경 감지 로직**:
- `<표>`/`<그림>` 마커가 있던 문제 → 무조건 업데이트
- 새 body가 기존보다 10% 이상 길면 → 업데이트
- 새 image_url이 있으면 → 업데이트
- 그 외 → 건너뜀

**JSON 파싱 복구**:
- 제어문자 제거, trailing comma 수정
- 잘린 JSON → 마지막 완전한 객체까지 잘라서 파싱

---

### 3-4. pool-repatch-batch.js — 배치 재처리

```
역할: 25개 HWP 파일 → pool-repatch.js 순차 실행
```

```bash
node pool-repatch-batch.js
```

**파일-시험 매핑**:
```
2020년정기제01회...hwp → exam_id=136
2020년정기제02회...hwp → exam_id=137
...
2026년정기제01회...hwp → exam_id=160
```

- 파일 간 2초 대기 (Gemini API 속도 제한)
- 총 업데이트/건너뜀/실패 건수 집계

---

### 3-5. pool-patch-visual.js — DB 마커 보완

```
역할: 원본 파일 없이 DB 데이터만으로 표/그림 재구성 (폴백)
대상: <표>, <그림>, 토폴로지, 구성도 마커가 있는 문제
```

**CLI 옵션**:
```bash
node pool-patch-visual.js --scan                 # 대상 조회만
node pool-patch-visual.js --patch                # AI 재구성 실행
node pool-patch-visual.js --patch --exam-id=136  # 특정 시험
node pool-patch-visual.js --patch --limit=10     # 최대 10개
node pool-patch-visual.js --dry-run --patch      # 미리보기
```

**방식**: Gemini에게 문제 본문 + 선택지 + 정답 + 카테고리를 주고, 원래 있었을 표 내용을 추론 요청

**확신도 필터**: `confidence: low` → 자동 건너뜀

> **권장**: 원본 HWP가 있으면 `pool-repatch.js`를 사용할 것. 이 스크립트는 원본이 없을 때의 폴백용.

---

### 3-6. pool-explain.js — AI 해설 생성

```
역할: 해설(explanation)이 없는 문제에 Gemini로 해설 생성
```

```bash
node pool-explain.js --exam-id=4 [--limit=10] [--dry-run]
node pool-explain.js --all [--limit=10]
```

**해설 형식** (HTML):
```html
<p class="exp-answer">✅ 정답: <strong>② 선택지</strong></p>
<div class="exp-section">
  <div class="exp-section-title">📖 해설</div>
  <p>정답 근거 상세 설명</p>
</div>
<div class="exp-section">
  <div class="exp-section-title">❌ 오답 분석</div>
  <p>① — 틀린 이유 / ③ — 틀린 이유 / ④ — 틀린 이유</p>
</div>
```

---

### 3-7. api/pool-upload.js + PoolUpload.jsx — 웹 UI

```
역할: 소량 문제를 웹에서 직접 업로드 → 추출 → 등록
지원: PDF, PNG, JPG (최대 20MB)
```

**2단계 플로우**:
1. `action: 'extract'` — 파일 base64 전송 → Gemini Vision → 문제 미리보기
2. `action: 'register'` — 카테고리/시험 선택 → DB INSERT

**UI 구성** (ImportTab):
- 서브탭 1: DocStore 연동 (기존 시스템에서 이관)
- 서브탭 2: 파일 업로드 (PoolUpload.jsx)

---

## 4. DB 스키마

### questions 테이블

```sql
questions
├── id              SERIAL PRIMARY KEY
├── exam_id         INTEGER → exams.id
├── subject_id      INTEGER → subjects.id
├── question_number INTEGER          -- DB 내 순번
├── original_number VARCHAR(50)      -- 원본 문제 번호
├── body            TEXT             -- 문제 본문 (표/이미지 텍스트 포함)
├── choices         JSONB            -- [{"num":1,"text":"..."},...]
├── answer          VARCHAR(10)      -- 정답 번호
├── explanation     TEXT             -- AI 해설 (HTML)
├── image_url       VARCHAR(500)     -- /q-images/exam{id}_q{num}.jpg
├── created_at      TIMESTAMP
└── updated_at      TIMESTAMP
```

### 이미지 서빙

```
public/q-images/
├── exam140_q13.jpg    (IP 충돌 화면 스크린샷)
├── exam140_q44.jpg    (named.zone 설정 파일)
├── exam141_q9.jpg     (tracert 출력 결과)
├── exam141_q11.jpg    (IP 검색 화면)
├── exam141_q14.jpg    (방화벽 로그)
├── exam143_q31.jpg    (DNS 관리자 UI)
├── exam145_q15.jpg    (3Way-Handshake 다이어그램)
├── exam146_q32.jpg    (named.zone 설정)
├── exam148_q7.jpg     (IP 검색 화면)
├── exam148_q11.jpg    (netstat 출력)
├── exam148_q29.jpg    (DNS 관리자 UI)
├── exam155_q12.jpg    (방화벽 로그)
└── exam157_q43.jpg    (DNS 오류 화면)
```

Vite `publicDir` 설정으로 빌드 시 dist/에 복사 → Vercel 정적 서빙

---

## 5. 실전 워크플로우

### 5-1. 신규 시험 대량 등록 (배치)

```bash
# ① HWP 파일을 pool/ 폴더에 넣기
cp *.hwp workspace/aitutor/pool/

# ② 1차: 텍스트 기반 문제 추출 + DB 등록
node pool-import.js --exam-title="2027년 정기 1회" --category-id=3

# ③ 2차+3차: 원본 HWP로 표/이미지 보강
node pool-repatch.js --exam-id=161 --file="파일.hwp" --dry-run   # 미리보기
node pool-repatch.js --exam-id=161 --file="파일.hwp"             # 실제 적용

# ④ AI 해설 생성
node pool-explain.js --exam-id=161

# ⑤ 검증
node pool-patch-visual.js --scan --exam-id=161
# → "0개" 면 OK

# ⑥ 배포
cd workspace/aitutor && npx vercel --prod --yes
```

### 5-2. 소량 문제 등록 (웹)

```
1. 사이트 접속 → 문제등록 탭 → 파일 업로드
2. PDF/이미지 선택 → "문제 추출 시작"
3. 추출 결과 미리보기 (표/그림 태그 확인)
4. 카테고리 + 시험 선택 → "DB 등록"
```

### 5-3. 기존 문제 표/이미지 재작업

```bash
# 상황 1: 원본 HWP가 있을 때 (최고 품질)
node pool-repatch.js --exam-id=136 --file="원본.hwp" --only-visual

# 상황 2: 원본 없이 DB만으로 보완 (폴백)
node pool-patch-visual.js --patch --exam-id=136

# 상황 3: 특정 문제만 확인
node pool-patch-visual.js --scan --exam-id=136
```

### 5-4. 표/수식을 이미지로 재작업

텍스트 변환이 불완전한 표/수식 → 이미지 모드로 전환:

```bash
# pool-repatch.js는 이미지를 자동 감지하여:
# - body에 텍스트 설명 포함 (접근성)
# - public/q-images/에 원본 이미지 저장 (정확성)
# - image_url에 경로 연결 (프론트엔드 표시)

node pool-repatch.js --exam-id=136 --file="원본.hwp"
# → has_image=true인 문제는 자동으로 이미지 저장 + 텍스트 설명 동시 처리
```

---

## 6. 환경 요구사항

### 필수

| 항목 | 용도 |
|------|------|
| `GEMINI_API_KEY` | Gemini Vision API |
| `DATABASE_URL` | Supabase PostgreSQL |
| Node.js 20+ | 스크립트 실행 |

### 시스템 도구 (품질 향상)

| 도구 | 설치 | 용도 | 없을 때 |
|------|------|------|---------|
| hwp5html | `pip install hwp5` | HWP→HTML (표 보존) | pool-repatch 사용 불가 |
| hwp5txt | (hwp5에 포함) | HWP→텍스트 (폴백) | Vision 모드로 대체 |
| LibreOffice | `brew install --cask libreoffice` | HWP→PDF 변환 | Vision 직접 전송 |
| poppler | `brew install poppler` | PDF→페이지 이미지 | Vision 직접 전송 |
| sips | macOS 내장 | BMP→JPEG 변환 | BMP 이미지 건너뜀 |

---

## 7. 초기 등록 이력 (2026-03-19)

### 7-1. 소스 파일

| 연도 | 파일 수 | 패턴 |
|------|---------|------|
| 2020~2025년 | 각 4개 | `{연도}년정기제{01~04}회네트워크관리사2급필기.hwp` |
| 2026년 | 1개 | `2026년정기제01회네트워크관리사2급필기.hwp` |
| **합계** | **25개** | |

### 7-2. 초기 파이프라인

```
HWP → hwp5txt → TXT → 정규식 파싱 → DB INSERT → 클로드 정답+해설 → DB UPDATE
```

- 파싱 이슈: 문제 번호 앞 공백, 마침표 누락 → 정규식 수정으로 해결
- 정답+해설: 클로드 3개 에이전트 병렬 실행, 에이전트당 15~30분

### 7-3. 재처리 (2026-03-26)

```
[표 복원] 25개 HWP → hwp5html → 표 텍스트 → Gemini 재파싱 → DB UPDATE 210문제
[이미지] 8개 HWP → hwp5html → 이미지 추출 → Vision → DB UPDATE + 파일 저장 13문제
```

| exam_id | 시험 | 초기 | 표 복원 | 이미지 | 최종 상태 |
|---------|------|------|---------|--------|-----------|
| 136 | 2020 정기1회 | 50 | +2 | - | ✅ |
| 137 | 2020 정기2회 | 50 | +8 | - | ✅ |
| 138 | 2020 정기3회 | 50 | +8 | - | ✅ |
| 139 | 2020 정기4회 | 50 | +2 | - | ✅ |
| 140 | 2021 정기1회 | 50 | +9 | +2 🖼️ | ✅ |
| 141 | 2021 정기2회 | 50 | +10 | +3 🖼️ | ✅ |
| 142 | 2021 정기3회 | 50 | +4 | - | ✅ |
| 143 | 2021 정기4회 | 50 | +7 | +1 🖼️ | ✅ |
| 144 | 2022 정기1회 | 50 | +9 | - | ✅ |
| 145 | 2022 정기2회 | 50 | +10 | +1 🖼️ | ✅ |
| 146 | 2022 정기3회 | 50 | +8 | +1 🖼️ | ✅ |
| 147 | 2022 정기4회 | 50 | +16 | - | ✅ |
| 148 | 2023 정기1회 | 50 | +6 | +3 🖼️ | ✅ |
| 149 | 2023 정기2회 | 50 | +8 | - | ✅ |
| 150 | 2023 정기3회 | 50 | +13 | - | ✅ |
| 151 | 2023 정기4회 | 50 | +10 | - | ✅ |
| 152 | 2024 정기1회 | 50 | +9 | - | ✅ |
| 153 | 2024 정기2회 | 50 | +12 | - | ✅ |
| 154 | 2024 정기3회 | 50 | +10 | - | ✅ |
| 155 | 2024 정기4회 | 50 | +8 | +1 🖼️ | ✅ |
| 156 | 2025 정기1회 | 50 | +9 | - | ✅ |
| 157 | 2025 정기2회 | 50 | +6 | +1 🖼️ | ✅ |
| 158 | 2025 정기3회 | 50 | +7 | - | ✅ |
| 159 | 2025 정기4회 | 50 | +7 | - | ✅ |
| 160 | 2026 정기1회 | 50 | +12 | - | ✅ |
| **합계** | | **1,250** | **+210** | **+13 🖼️** | **미복원 0** |

---

## 8. 스크립트 파일 목록

| 파일 | 용도 | 모드 |
|------|------|------|
| `pool-import.js` | 기본 배치 임포트 (신규 등록) | 배치 |
| `pool-import-v2.js` | 고품질 파이프라인 (신규 등록) | 배치 |
| `pool-repatch.js` | 통합 재처리 (표+이미지+DB UPDATE) | 배치 |
| `pool-repatch-batch.js` | 25개 파일 일괄 재처리 | 배치 |
| `pool-patch-visual.js` | DB 마커 보완 (원본 없을 때) | 배치 |
| `pool-explain.js` | AI 해설 생성 | 배치 |
| `api/pool-upload.js` | 웹 업로드 API | 웹 |
| `src/tabs/ImportTab/PoolUpload.jsx` | 웹 업로드 UI | 웹 |
| `register-network-questions.js` | 초기 1,250문제 등록 (레거시) | - |
| `scripts/update-answers-*.js` | 정답+해설 등록 (레거시) | - |
