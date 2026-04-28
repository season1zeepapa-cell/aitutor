# AI TutorTwo — 문제 DB화 파이프라인 명세서

> 작성일: 2026-03-26
> 프로젝트: workspace/aitutor
> 배포: https://aitutor-six.vercel.app
> 용도: skill/agent 구현 참조 문서

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [파일 형식별 파이프라인 상세](#2-파일-형식별-파이프라인-상세)
3. [3단계 추출 전략](#3-3단계-추출-전략)
4. [스크립트 명세](#4-스크립트-명세)
5. [Gemini 프롬프트 명세](#5-gemini-프롬프트-명세)
6. [DB 스키마](#6-db-스키마)
7. [프론트엔드 연동](#7-프론트엔드-연동)
8. [에러 처리 명세](#8-에러-처리-명세)
9. [실전 운영 시나리오](#9-실전-운영-시나리오)
10. [환경 설정](#10-환경-설정)
11. [현재 데이터 현황](#11-현재-데이터-현황)

---

## 1. 아키텍처 개요

### 1-1. 전체 흐름도

```
                        ┌─────────────────┐
                        │  시험문제 원본 파일  │
                        │  HWP / PDF / IMG │
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                                     │
     ┌────────▼──────────┐              ┌───────────▼──────────────┐
     │  대량 등록 (배치 CLI) │              │  소량 등록 (웹 UI)          │
     │  pool/ 폴더에 파일    │              │  브라우저에서 업로드          │
     │  넣고 CLI 실행       │              │  관리자 권한 필요            │
     └────────┬──────────┘              └───────────┬──────────────┘
              │                                     │
     ┌────────▼──────────┐              ┌───────────▼──────────────┐
     │  STEP 1            │              │  api/pool-upload.js       │
     │  pool-import.js    │              │  action: extract          │
     │  1차 텍스트 추출     │              │  Gemini Vision 추출        │
     │  → DB INSERT       │              │  → 미리보기 JSON 반환       │
     └────────┬──────────┘              └───────────┬──────────────┘
              │                                     │
     ┌────────▼──────────┐              ┌───────────▼──────────────┐
     │  STEP 2            │              │  api/pool-upload.js       │
     │  pool-repatch.js   │              │  action: register         │
     │  2차 표/수식 보강    │              │  → DB INSERT              │
     │  3차 이미지 처리     │              └──────────────────────────┘
     │  → DB UPDATE       │
     │  → 이미지 파일 저장  │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  STEP 3            │
     │  pool-explain.js   │
     │  AI 해설 생성       │
     │  → DB UPDATE       │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  STEP 4            │
     │  pool-patch-visual │
     │  --scan            │
     │  미복원 마커 검증    │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  STEP 5            │
     │  Vercel 배포        │
     └────────────────────┘
```

### 1-2. 스크립트-역할 매핑

| 스크립트 | 역할 | 입력 | 출력 | DB 작업 |
|---------|------|------|------|---------|
| **pool-import.js** | 1차 텍스트 추출+등록 | pool/*.{hwp,pdf,png,jpg,txt} | questions INSERT | INSERT |
| **pool-repatch.js** | 2차 표+3차 이미지 보강 | pool/*.{hwp,pdf,png,jpg} + exam_id | questions UPDATE + 이미지 파일 | UPDATE |
| **pool-explain.js** | AI 해설 생성 | DB (explanation IS NULL) | questions.explanation UPDATE | UPDATE |
| **pool-patch-visual.js** | 검증/폴백 보완 | DB (<표>/<그림> 마커) | questions.body UPDATE | UPDATE |
| **pool-repatch-batch.js** | 다중 파일 일괄 | (내장 매핑 배열) | pool-repatch.js 순차 호출 | - |
| **api/pool-upload.js** | 웹 업로드 API | base64 파일 (POST) | JSON → DB INSERT | INSERT |
| **PoolUpload.jsx** | 웹 업로드 UI | 파일 선택 (브라우저) | API 호출 | - |

---

## 2. 파일 형식별 파이프라인 상세

### 2-1. HWP 파이프라인 (최고 품질 ★★★★★)

```
pool/시험.hwp
  │
  ├─ [1단계: extractHwp()]
  │   hwp5html "시험.hwp" --output "temp/html_{ts}/"
  │   ├── index.xhtml ─── 표 <table> 태그 보존
  │   └── bindata/
  │       ├── BIN0001.jpg ─── 내장 이미지 1
  │       ├── BIN0002.bmp ─── BMP는 sips로 JPEG 변환
  │       └── ...
  │
  ├─ [2단계: htmlTableToText()]
  │   <table> 정규식 매칭
  │   ├── <tr>/<td> → 셀 텍스트 추출
  │   ├── 셀 구분: " | " (공백+파이프+공백)
  │   ├── 행 구분: "\n"
  │   └── 엔티티 디코딩: &lt; &gt; &amp; &#13;
  │
  ├─ [2단계: img 플레이스홀더]
  │   <img src="bindata/BIN0001.jpg">
  │   → [이미지1]
  │   → imageRefs[] 배열에 {placeholder, src, data, buffer, mimeType, ext} 저장
  │
  ├─ [3단계: extractFromHtml()]
  │   Gemini Vision API 호출
  │   parts[0]: 텍스트 프롬프트 (표 텍스트 포함)
  │   parts[1]: "[이미지1] ---" 라벨
  │   parts[2]: inlineData {mimeType: "image/jpeg", data: base64}
  │   parts[3]: "[이미지2] ---" 라벨
  │   parts[4]: inlineData ...
  │   → JSON 배열 응답 → 파싱 (오류 시 자동 복구)
  │
  ├─ [4단계: saveImages()]
  │   questions[i].image_index → imageRefs[idx]
  │   파일명: exam{examId}_q{originalNumber}.jpg
  │   저장: public/q-images/exam140_q13.jpg
  │   imageMap: {"13": "/q-images/exam140_q13.jpg"}
  │
  └─ [5단계: updateQuestions()]
      기존 DB questions와 original_number로 매칭
      변경 감지:
        ├── <표>/<그림> 마커 있으면 → 무조건 UPDATE
        ├── 새 body > 기존 body × 1.1 → UPDATE
        ├── 새 image_url 있으면 → UPDATE
        └── 그 외 → 건너뜀
      UPDATE questions SET body=$1, choices=$2, image_url=$3, updated_at=NOW()
```

**hwp5html 명령어**:
```bash
/Users/2team/Library/Python/3.9/bin/hwp5html "input.hwp" --output "output_dir/"
# 결과:
#   output_dir/index.xhtml  — HTML (표 <table> 보존)
#   output_dir/styles.css   — 스타일
#   output_dir/bindata/     — 내장 이미지 (JPG/BMP/PNG)
```

**BMP → JPEG 변환** (Gemini는 BMP 미지원):
```bash
sips -s format jpeg "input.bmp" --out "output.jpg"
# macOS 내장 명령어, 다른 OS에서는 ImageMagick 사용
```

**HTML 표 → 텍스트 변환 로직**:
```javascript
// 정규식: /<table[^>]*>([\s\S]*?)<\/table>/gi
// 각 <tr> 내의 <td>/<th> 텍스트 추출
// 결과 예시:
//   "특징 | 내용\n연결 방식 | 비연결형\n신뢰성 | 비신뢰성"
```

**img 플레이스홀더 교체 로직**:
```javascript
// <img src="bindata/BIN0001.jpg" style="...">
// → "\n[이미지1]\n"
// images["bindata/BIN0001.jpg"] 에서 base64 데이터 참조
```

---

### 2-2. PDF 파이프라인 (★★★★)

```
pool/시험.pdf
  │
  ├─ [1단계: extractPdf()]
  │   poppler 도구 자동 감지 (pdftotext, pdftohtml, pdfimages)
  │
  │   ┌─ poppler 설치됨 → 2단계 파이프라인 ─────────────┐
  │   │                                                │
  │   │  ① pdftotext -layout "시험.pdf" "output.txt"    │
  │   │     → 레이아웃 보존 텍스트 추출                     │
  │   │     → textContent (문자열)                       │
  │   │                                                │
  │   │  ② pdftohtml -noframes -enc UTF-8 "시험.pdf"    │
  │   │     → HTML 출력 (표 구조 <table> 보존)             │
  │   │     → htmlContent (문자열)                       │
  │   │                                                │
  │   │  ③ pdfimages -png "시험.pdf" "prefix"            │
  │   │     → 내장 이미지 추출 (PNG 형식)                  │
  │   │     → 5KB 미만 이미지 자동 필터 (아이콘 등 제거)     │
  │   │     → images 맵 {"pdfimg/file.png": {...}}      │
  │   │                                                │
  │   │  모드 결정:                                      │
  │   │    htmlContent 있음 → mode: 'pdf-html'          │
  │   │    textContent만 → mode: 'pdf-text'             │
  │   │    둘 다 실패 → mode: 'vision-direct' (폴백)     │
  │   └────────────────────────────────────────────────┘
  │
  │   ┌─ poppler 미설치 → Vision 직접 전송 ──────────────┐
  │   │  PDF 파일을 base64로 읽어 Gemini에 직접 전송       │
  │   │  mode: 'vision-direct'                          │
  │   │  mimeType: 'application/pdf'                    │
  │   └────────────────────────────────────────────────┘
  │
  ├─ [2~3단계: 모드별 분기]
  │   pdf-html  → extractFromHtml() ← HWP와 동일 경로
  │   pdf-text  → extractFromVision() ← PDF Vision 직접
  │   vision-direct → extractFromVision()
  │
  ├─ [4단계: saveImages()] ← HWP와 동일
  │
  └─ [5단계: updateQuestions()] ← HWP와 동일
```

**poppler 명령어**:
```bash
# 텍스트 추출 (레이아웃 보존)
pdftotext -layout "input.pdf" "output.txt"

# HTML 변환 (표 구조 보존, 단일 파일)
pdftohtml -noframes -enc UTF-8 "input.pdf" "output_dir/output"
# → output_dir/output.html

# 내장 이미지 추출 (PNG 형식)
pdfimages -png "input.pdf" "prefix"
# → prefix-000.png, prefix-001.png, ...

# 페이지별 이미지 변환 (고해상도)
pdftoppm -png -r 200 "input.pdf" "prefix"
# → prefix-1.png, prefix-2.png, ...
```

**PDF 모드 결정 로직**:
```javascript
// pdftohtml 성공 → 'pdf-html' (HWP와 동일한 HTML 파싱 경로)
// pdftotext만 성공 → 'pdf-text' (텍스트 + Vision 병행)
// 둘 다 실패 → 'vision-direct' (PDF 통째로 Vision 전송)
// poppler 미설치 → 'vision-direct'
```

---

### 2-3. 이미지 파이프라인 (★★★)

```
pool/시험_스캔.jpg
  │
  ├─ [1단계: extractImage()]
  │   파일을 base64로 읽기
  │   mimeType 결정 (.jpg→image/jpeg, .png→image/png)
  │   mode: 'vision-direct'
  │
  ├─ [2~3단계: extractFromVision()]
  │   Gemini Vision에 이미지 직접 전송
  │   parts[0]: 텍스트 프롬프트
  │   parts[1]: inlineData {mimeType, data}
  │   → JSON 배열 응답
  │
  ├─ [4단계] 이미지 저장 없음 (원본이 이미 이미지)
  │
  └─ [5단계: updateQuestions()] ← 동일
```

---

### 2-4. 파이프라인 비교표

| 기능 | HWP (hwp5html) | PDF (poppler) | 이미지 (Vision) |
|------|----------------|---------------|----------------|
| **텍스트 추출** | HTML→태그 제거 | pdftotext -layout | Vision 직접 |
| **표 보존 방식** | `<table>` 태그→텍스트 | pdftohtml→HTML | Vision 인식 |
| **표 품질** | ★★★★★ (구조 완벽 보존) | ★★★★ (대부분 보존) | ★★★ (인식 의존) |
| **이미지 추출** | bindata/ 원본 분리 | pdfimages PNG 분리 | 분리 불가 |
| **이미지 저장** | public/q-images/ | public/q-images/ | 저장 안 됨 |
| **image_url** | 설정됨 | 설정됨 | 설정 안 됨 |
| **수식 처리** | 텍스트/이미지로 추출 | 텍스트/이미지로 추출 | Vision 인식 |
| **필요 도구** | hwp5 (Python) | poppler (brew) | 없음 |
| **폴백** | - | Vision 직접 전송 | - |
| **처리 속도** | 중 (변환+API) | 중 (변환+API) | 빠름 (API만) |

---

## 3. 3단계 추출 전략

### 3-1. 단계 정의

```
┌───────────────────────────────────────────────────┐
│  1차: 텍스트 추출                                    │
│  ─────────────                                     │
│  대상: 모든 문제                                     │
│  도구: pool-import.js                               │
│  결과: body, choices, answer → DB INSERT             │
│  특징: 텍스트만 추출, 표는 <표> 마커로 남을 수 있음      │
├───────────────────────────────────────────────────┤
│  2차: 표/수식 보강                                    │
│  ─────────────                                     │
│  대상: <표> 마커 문제, 수식이 깨진 문제                 │
│  도구: pool-repatch.js (--only-visual 또는 전체)      │
│  결과: body UPDATE (표 내용 "| 열1 | 열2" 텍스트 포함) │
│  특징: 원본 파일 필요 (HWP/PDF)                       │
├───────────────────────────────────────────────────┤
│  3차: 이미지 처리                                     │
│  ─────────────                                     │
│  대상: <그림> 마커 문제, 스크린샷/다이어그램 필요 문제    │
│  도구: pool-repatch.js (이미지 자동 감지)              │
│  결과: body UPDATE (텍스트 설명)                      │
│        + image_url UPDATE (/q-images/...)            │
│        + 파일 저장 (public/q-images/)                 │
│  특징: HWP/PDF만 이미지 분리 가능                     │
└───────────────────────────────────────────────────┘
```

### 3-2. 단계별 실행 명령어

```bash
# ── 1차만 (신규 등록) ──
node pool-import.js --exam-title="시험명" --category-id=3

# ── 2차만 (표/그림 마커 문제만 보강) ──
node pool-repatch.js --exam-id=N --file="파일" --only-visual

# ── 2차+3차 통합 (표 + 이미지 전부) ──
node pool-repatch.js --exam-id=N --file="파일"

# ── 1차+2차+3차 전체 (신규 등록 + 보강) ──
node pool-import.js --exam-title="..." --category-id=3
node pool-repatch.js --exam-id=N --file="파일"
```

### 3-3. 재작업 옵션

표나 수식이 텍스트로 불충분할 때 이미지 모드로 전환:

```bash
# 케이스 1: 1차에서 <표> 마커만 남은 문제
#   → 2차 pool-repatch.js가 hwp5html로 표 텍스트 복원
node pool-repatch.js --exam-id=N --file="원본.hwp" --only-visual

# 케이스 2: 2차에서도 표가 불완전 (복잡한 병합 셀 등)
#   → pool-repatch.js가 자동으로 이미지도 함께 처리
#   → body에 텍스트 설명 + image_url에 이미지 경로
node pool-repatch.js --exam-id=N --file="원본.hwp"

# 케이스 3: 원본 파일 없이 DB만으로 보완 (폴백)
#   → Gemini가 문맥+선택지로 표 내용 추론
node pool-patch-visual.js --patch --exam-id=N

# 케이스 4: PDF만 있을 때
#   → poppler로 텍스트+표+이미지 분리 추출
node pool-repatch.js --exam-id=N --file="시험.pdf"
```

---

## 4. 스크립트 명세

### 4-1. pool-import.js

```
파일: workspace/aitutor/pool-import.js
역할: pool/ 폴더 파일 → Gemini 추출 → questions INSERT
동작: 신규 등록 전용 (중복 건너뜀)
```

**CLI**:
```bash
node pool-import.js --exam-id=N [--category-id=N] [--dry-run]
node pool-import.js --exam-title="제목" --category-id=N [--dry-run]
node pool-import.js --exam-id=N --force-vision
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--exam-id=N` | 택1 | 기존 시험에 추가 |
| `--exam-title="제목"` | 택1 | 새 시험 자동 생성 |
| `--category-id=N` | title 시 필수 | 카테고리 ID |
| `--force-vision` | 선택 | 모든 파일 Vision 모드 강제 |
| `--dry-run` | 선택 | 미리보기만 (DB 변경 없음) |

**지원 파일**: `.pdf`, `.hwp`, `.hwpx`, `.png`, `.jpg`, `.jpeg`, `.txt`

**함수 상세**:

| 함수 | 역할 | 입력 | 출력 |
|------|------|------|------|
| `extractQuestionsFromFile(filePath)` | 파일에서 문제 추출 | 파일 경로 | questions JSON 배열 |
| `fileToBase64(filePath)` | 파일→base64+MIME | 파일 경로 | {data, mimeType} |
| `extractPdfText(filePath)` | PDF→텍스트 | PDF 경로 | 문자열 |
| `getOrCreateExam()` | 시험 조회/생성 | CLI args | exam_id |
| `isDuplicate(examId, origNum)` | 중복 체크 | exam_id, original_number | boolean |

**Vision 자동 판단 로직**:
```javascript
const isImageFile = /\.(png|jpg|jpeg)$/i.test(ext);     // → Vision
const isBinaryDoc = /\.(hwp|hwpx)$/i.test(ext);         // → Vision
const isTxt = ext === '.txt';                             // → 텍스트만
const useVision = !isTxt && (FORCE_VISION || isImageFile || isBinaryDoc || textContent.length < 200);
const enhancedTextMode = isTxt && (hasVisualMarker || FORCE_VISION);
```

**시각자료 마커 감지**:
```javascript
const hasVisualMarker = /(<표>|<그림>|다음\s*표|구성도|토폴로지|헤더\s*구조|다이어그램)/.test(textContent);
```

**시각자료 메타데이터 (Vision 모드)**:
```
프롬프트에 추가 필드 요청:
  has_table: boolean        — 표 포함 여부
  has_image: boolean        — 그림 포함 여부
  table_description: string — 표 내용 텍스트
  image_description: string — 그림 내용 설명
  needs_visual: boolean     — 시각자료 없이 풀 수 없는지
```

**DB 쿼리**:
```sql
-- 시험 조회
SELECT id FROM exams WHERE title = $1 AND category_id = $2

-- 시험 생성
SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM exams
INSERT INTO exams (title, category_id, sort_order) VALUES ($1, $2, $3) RETURNING id

-- 다음 문제 번호
SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE exam_id = $1

-- 중복 체크
SELECT id FROM questions WHERE exam_id = $1 AND original_number = $2

-- 문제 등록
INSERT INTO questions (exam_id, question_number, original_number, body, choices, answer)
VALUES ($1, $2, $3, $4, $5, $6)
```

**표 내용 body 추가 로직**:
```javascript
// 표가 감지되었지만 body에 표 내용이 없으면 자동 추가
if (q.has_table && q.table_description && !bodyText.includes(q.table_description.substring(0, 20))) {
  bodyText += '\n\n[표]\n' + q.table_description;
}
```

**처리 완료 후**: 파일 → `pool/done/` 이동 (`fs.renameSync`)

---

### 4-2. pool-repatch.js (핵심 — 2차/3차 통합 재처리)

```
파일: workspace/aitutor/pool-repatch.js
역할: 원본 파일(HWP/PDF/이미지) → 표 보존 + 이미지 추출 → DB UPDATE
동작: 기존 문제 body/image_url 업데이트
```

**CLI**:
```bash
node pool-repatch.js --exam-id=N --file="파일명" [--dry-run] [--only-visual]
```

| 옵션 | 필수 | 설명 |
|------|------|------|
| `--exam-id=N` | 필수 | 대상 시험 DB ID |
| `--file="파일명"` | 필수 | pool/ 폴더 내 파일명 |
| `--only-visual` | 선택 | `<표>`/`<그림>` 마커 문제만 업데이트 |
| `--dry-run` | 선택 | 미리보기만 (DB/파일 변경 없음) |

**지원 파일**: `.hwp`, `.hwpx`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`

**함수 상세**:

| 함수 | 역할 | 모드 |
|------|------|------|
| `extractFile(filePath)` | 확장자별 자동 분기 | 전체 |
| `extractHwp(hwpPath)` | HWP→HTML+이미지 | hwp |
| `extractPdf(pdfPath)` | PDF→텍스트+HTML+이미지 | pdf-html/pdf-text/vision-direct |
| `extractImage(imgPath)` | 이미지→base64 | vision-direct |
| `htmlTableToText(html)` | `<table>`→텍스트 | hwp, pdf-html |
| `extractFromHtml(html, images)` | HTML+이미지→Gemini→JSON | hwp, pdf-html |
| `extractFromVision(fileData)` | 파일→Gemini Vision→JSON | pdf-text, vision-direct |
| `saveImages(examId, questions, imageRefs)` | 이미지 파일 저장 | hwp, pdf |
| `updateQuestions(examId, questions, imageMap)` | DB UPDATE | 전체 |

**파일 형식별 모드 분기**:
```javascript
function extractFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.hwp' || ext === '.hwpx') return extractHwp(filePath);   // → mode: 'hwp'
  if (ext === '.pdf') return extractPdf(filePath);                       // → mode: 'pdf-html'|'pdf-text'|'vision-direct'
  if (['.png','.jpg','.jpeg','.gif'].includes(ext)) return extractImage(filePath); // → mode: 'vision-direct'
}
```

**메인 함수 모드별 분기**:
```javascript
switch (extracted.mode) {
  case 'hwp':        extractFromHtml(extracted.html, extracted.images);      break;
  case 'pdf-html':   extractFromHtml(extracted.html, extracted.images);      break;
  case 'pdf-text':   extractFromVision(extracted.fileData);                  break;
  default:           extractFromVision(extracted.fileData);                  break;
}
```

**PDF extractPdf() 상세 로직**:
```javascript
// 1. poppler 도구 감지
hasPdftotext = which('pdftotext');
hasPdftohtml = which('pdftohtml');
hasPdfimages = which('pdfimages');

// 2. poppler 없으면 → Vision 직접 (폴백)
if (!hasPoppler) return { mode: 'vision-direct', fileData: {...} };

// 3. 단계별 추출
// 3-A: pdftotext -layout → textContent
// 3-B: pdftohtml -noframes -enc UTF-8 → htmlContent
// 3-C: pdfimages -png → images (5KB+ 필터)

// 4. 모드 결정
if (htmlContent) return { mode: 'pdf-html', html: htmlContent, images };
if (textContent) return { mode: 'pdf-text', textContent, fileData, images };
return { mode: 'vision-direct', fileData };
```

**변경 감지 로직 (updateQuestions)**:
```javascript
const oldHasMarker = /<표>|<그림>/.test(oldBody);        // 마커 있으면 무조건 UPDATE
const bodyImproved = newBody.length > oldBody.length * 1.1; // 10% 이상 증가
const hasNewImage = newImageUrl && newImageUrl !== dbQ.image_url;

if (!oldHasMarker && !bodyImproved && !hasNewImage) {
  if (Math.abs(newBody.length - oldBody.length) < 20) {
    skipped++; continue; // 건너뜀
  }
}
```

**--only-visual 필터**:
```javascript
const hasVisualMarker = /(<표>|<그림>|다음\s*표|다음\s*그림|구성도|토폴로지)/.test(dbQ.body);
if (ONLY_VISUAL && !hasVisualMarker && !nq.has_table && !nq.has_image) {
  skipped++; continue;
}
```

**이미지 저장 로직 (saveImages)**:
```javascript
// Gemini 응답의 image_index로 imageRefs 매핑
const imgIdx = q.image_index - 1;  // 1-based → 0-based
const img = imageRefs[imgIdx];
const fileName = `exam${examId}_q${q.original_number}${img.ext || '.jpg'}`;
const imageUrl = `/q-images/${fileName}`;
fs.writeFileSync(path.join(IMAGE_DIR, fileName), img.buffer);
imageMap[String(q.original_number)] = imageUrl;
```

**DB 쿼리**:
```sql
-- 기존 문제 조회
SELECT id, question_number, original_number, body, choices, answer, image_url
FROM questions WHERE exam_id = $1 ORDER BY question_number

-- body + image_url 업데이트
UPDATE questions SET body=$1, choices=$2, image_url=$3, updated_at=NOW() WHERE id=$4

-- body만 업데이트 (이미지 없을 때)
UPDATE questions SET body=$1, choices=$2, updated_at=NOW() WHERE id=$3
```

---

### 4-3. pool-explain.js

```
파일: workspace/aitutor/pool-explain.js
역할: explanation이 NULL인 문제에 Gemini로 해설 생성
```

**CLI**:
```bash
node pool-explain.js --exam-id=N [--limit=N] [--dry-run]
node pool-explain.js --all [--limit=N] [--dry-run]
```

| 옵션 | 설명 |
|------|------|
| `--exam-id=N` | 특정 시험만 |
| `--all` | 전체 미해설 문제 |
| `--limit=N` | 최대 N개 |
| `--dry-run` | 미리보기 |

**해설 프롬프트 구조**:
```
당신은 {categoryName} 전문 강사입니다.
[문제] {body}
[선택지] ① ... ② ... ③ ... ④ ...
[정답] {answer}

**정답**: 번호 및 선택지 내용
**해설**: 정답 근거 상세 설명
**오답 분석**: 각 선택지별 분석
**핵심 키워드**: 관련 법령, 용어
```

**DB 쿼리**:
```sql
-- 해설 없는 문제 조회
SELECT q.*, e.title, c.name FROM questions q
LEFT JOIN exams e ON q.exam_id = e.id
LEFT JOIN categories c ON e.category_id = c.id
WHERE q.explanation IS NULL [AND q.exam_id = $1]

-- 해설 저장
UPDATE questions SET explanation = $1, updated_at = NOW() WHERE id = $2

-- 해설 이력
INSERT INTO question_explanations (question_id, provider, model, content) VALUES ($1, $2, $3, $4)
```

**속도 제한**: 문제 간 1초 대기

---

### 4-4. pool-patch-visual.js

```
파일: workspace/aitutor/pool-patch-visual.js
역할: DB에서 <표>/<그림> 마커 문제 검출 + AI 보완 (원본 없을 때 폴백)
```

**CLI**:
```bash
node pool-patch-visual.js --scan [--exam-id=N]
node pool-patch-visual.js --patch [--exam-id=N] [--limit=N] [--dry-run]
```

| 옵션 | 설명 |
|------|------|
| `--scan` | 마커 문제 목록 조회만 |
| `--patch` | Gemini로 표 내용 재구성 |
| `--exam-id=N` | 특정 시험만 |
| `--limit=N` | 최대 N개 |
| `--dry-run` | 미리보기 |

**마커 감지 SQL**:
```sql
WHERE q.body LIKE '%<표>%' OR q.body LIKE '%<그림>%'
   OR q.body LIKE '%다음 표%' OR q.body LIKE '%아래 표%'
   OR q.body LIKE '%구성도%' OR q.body LIKE '%다이어그램%'
   OR q.body LIKE '%토폴로지%' OR q.body LIKE '%[표]%'
```

**재구성 프롬프트**:
```
문제의 맥락과 선택지를 분석하여, 원래 있어야 할 표의 내용을 추론하여 텍스트 형태로 재구성해주세요.

[문제] {body}
[선택지] {choices}
[정답] {answer}
[카테고리] {category / exam}

JSON 형식:
{
  "table_description": "표 내용 (| 구분자)",
  "reconstructed_body": "표 포함된 문제 본문 전체",
  "confidence": "high/medium/low",
  "note": "재구성 근거"
}
```

**확신도 필터**: `confidence === 'low'` → 자동 건너뜀
**속도 제한**: 문제 간 1.5초 대기

---

### 4-5. pool-repatch-batch.js

```
파일: workspace/aitutor/pool-repatch-batch.js
역할: 여러 파일을 순차적으로 pool-repatch.js 호출
```

```bash
node pool-repatch-batch.js
```

**구조**:
```javascript
const files = [
  ['2020년정기제01회네트워크관리사2급필기.hwp', 136],
  ['2020년정기제02회네트워크관리사2급필기.hwp', 137],
  // ... 25개
];

for (const [file, examId] of files) {
  execSync(`node pool-repatch.js --exam-id=${examId} --file="${file}"`);
  await sleep(2000); // API 속도 제한
}
```

> 새 시험 추가 시 `files` 배열에 매핑 추가

---

### 4-6. api/pool-upload.js + PoolUpload.jsx (웹 UI)

```
파일: workspace/aitutor/api/pool-upload.js (서버리스 API)
파일: workspace/aitutor/src/tabs/ImportTab/PoolUpload.jsx (React UI)
역할: 웹에서 소량 문제 업로드 → 추출 → 등록
권한: 관리자 전용 (withAdmin 미들웨어)
```

**API 액션**:

| 액션 | HTTP | 입력 | 출력 |
|------|------|------|------|
| `extract` | POST | `{file_data, file_name, mime_type}` | `{success, questions[], visual_count}` |
| `register` | POST | `{exam_id\|exam_title+category_id, questions[]}` | `{success, exam_id, inserted, skipped}` |

**제한**:
- MIME: `application/pdf`, `image/png`, `image/jpeg`, `image/gif`
- 크기: 20MB (base64 기준 `Buffer.byteLength`)
- HWP: 미지원 (바이너리 → 배치 CLI만)

**UI 상태 흐름**:
```
파일 선택 (handleFileSelect)
  → 형식/크기 검증
  → 이미지면 미리보기 표시
  → 카테고리/시험 메타 로드
  ↓
문제 추출 (handleExtract)
  → fileToBase64(file) → base64
  → POST /api/pool-upload {action:'extract', file_data, mime_type}
  → questions 배열 수신
  → 미리보기 카드 렌더 (표/그림 태그 표시)
  ↓
DB 등록 (handleRegister)
  → POST /api/pool-upload {action:'register', exam_id, questions}
  → 결과: {inserted, skipped}
  ↓
초기화 (handleReset)
```

**fileToBase64 유틸**:
```javascript
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // data:...;base64,{여기}
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

---

## 5. Gemini 프롬프트 명세

### 5-1. 문제 추출 프롬프트 (pool-import.js, pool-repatch.js, api/pool-upload.js 공통)

**모델**: `gemini-2.5-flash`

**출력 형식**:
```json
[
  {
    "original_number": 1,
    "body": "문제 본문 (표 '| 열1 | 열2' 포함, 선택지 제외)",
    "choices": [
      {"num": 1, "text": "선택지 텍스트"},
      {"num": 2, "text": "선택지 텍스트"},
      {"num": 3, "text": "선택지 텍스트"},
      {"num": 4, "text": "선택지 텍스트"}
    ],
    "answer": 0,
    "has_table": false,
    "has_image": false,
    "image_index": null
  }
]
```

**핵심 지시**:
```
- 표(table) 데이터 → body에 "| 열1 | 열2" 형식으로 포함
- 선택지(①②③④) → choices에만 넣기, body에서 제거
- 법률명의 「」 괄호는 그대로 유지
- answer는 정답 표시 있으면 번호, 없으면 0
- 5지선다도 있으면 5번째 선택지 포함
- 문제를 하나도 빠뜨리지 마세요
```

**이미지 포함 시 추가 지시** (pool-repatch.js):
```
- [이미지N]이 있는 문제: has_image를 true, image_index에 이미지 번호
- 이미지 내용을 body에 텍스트로 완전히 기술:
  - 명령어 출력 → 실제 출력 텍스트 그대로
  - 설정 파일 → 파일 내용 그대로
  - 다이어그램 → 구성 요소와 흐름을 텍스트로
  - 스크린샷 → 화면에 보이는 내용을 상세히
```

**Vision 호출 방식**:
```javascript
const parts = [
  { text: promptText },                    // 프롬프트
  { text: '\n--- [이미지1] ---' },           // 이미지 라벨
  { inlineData: { mimeType, data } },       // 이미지 base64
  { text: '\n--- [이미지2] ---' },
  { inlineData: { mimeType, data } },
  // ...
];
const result = await model.generateContent(parts);
```

### 5-2. 해설 생성 프롬프트 (pool-explain.js)

```
당신은 {카테고리명} 전문 강사입니다.

[문제] {body}
[선택지]
① {choices[0]}
② {choices[1]}
③ {choices[2]}
④ {choices[3]}
[정답] {answer}

답변 형식:
**정답**: 번호 및 선택지 내용
**해설**: 정답 근거 상세 설명
**오답 분석**: 각 선택지별 분석
**핵심 키워드**: 관련 법령, 용어, 개념
```

### 5-3. 표 재구성 프롬프트 (pool-patch-visual.js)

```
문제의 맥락과 선택지를 분석하여, 원래 있어야 할 표의 내용을 추론

[문제] {body}
[선택지] {formatted choices}
[정답] {answer}
[카테고리] {category / exam_title}

JSON:
{
  "table_description": "표 내용 (| 구분자)",
  "reconstructed_body": "표 포함 문제 본문 전체",
  "confidence": "high/medium/low",
  "note": "재구성 근거"
}
```

---

## 6. DB 스키마

### 6-1. questions (핵심 테이블)

```sql
CREATE TABLE questions (
  id              SERIAL PRIMARY KEY,
  exam_id         INTEGER REFERENCES exams(id),
  subject_id      INTEGER REFERENCES subjects(id),
  question_number INTEGER,              -- DB 내 순번 (시험별 auto-increment)
  original_number VARCHAR(50),          -- 원본 문제 번호 ("1", "2", ...)
  body            TEXT,                 -- 문제 본문 (표/이미지 텍스트 포함)
  choices         JSONB,                -- [{"num":1,"text":"..."},...]
  answer          VARCHAR(10),          -- 정답 번호 문자열
  explanation     TEXT,                 -- AI 해설 (HTML/Markdown)
  image_url       VARCHAR(500),         -- 이미지 경로 (/q-images/exam{id}_q{num}.jpg)
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

**중복 체크 기준**: `exam_id + original_number` (유니크 조합)
**question_number**: 시험 내 순번 (MAX+1로 자동 증가)

### 6-2. exams

```sql
CREATE TABLE exams (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200),             -- "2020년 정기 1회"
  category_id INTEGER REFERENCES categories(id),
  exam_date   DATE,
  sort_order  INTEGER,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

### 6-3. categories

```sql
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),              -- "네트워크관리사2급"
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 6-4. question_explanations (해설 이력)

```sql
CREATE TABLE question_explanations (
  id           SERIAL PRIMARY KEY,
  question_id  INTEGER REFERENCES questions(id),
  provider     VARCHAR(50),             -- 'gemini', 'openai', 'claude'
  model        VARCHAR(100),            -- 'gemini-2.5-flash'
  content      TEXT,                    -- 해설 내용
  extra_prompt TEXT,                    -- 추가 프롬프트
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);
```

### 6-5. 이미지 서빙

```
소스 경로:   public/q-images/exam{id}_q{originalNumber}.jpg
빌드 경로:   dist/q-images/ (Vite publicDir → 자동 복사)
Vercel URL:  /q-images/exam140_q13.jpg (상대경로)
DB 컬럼:     questions.image_url = '/q-images/exam140_q13.jpg'
```

**Vite 설정** (`vite.config.js`):
```javascript
publicDir: path.resolve(__dirname, 'public'),
// → public/ 하위 파일이 빌드 시 dist/로 복사
```

---

## 7. 프론트엔드 연동

### 7-1. 이미지 렌더링 (QuizCard.jsx:89-93)

```javascript
const imageUrl = q.image_url
  ? (q.image_url.startsWith('http') ? q.image_url : q.image_url)
  : null;
// 상대경로 → 현재 사이트 기준 (/q-images/...)
// 절대경로 → 그대로 사용 (https://...)
```

**같은 패턴 사용하는 파일**:
- `src/tabs/QuizTab/QuizCard.jsx` — 문제 풀이 카드
- `src/pages/ExamMode.jsx` — 시험 모드
- `src/tabs/ManageTab/QuestionForm.jsx` — 관리자 문제 편집

### 7-2. ImportTab 서브탭 구조 (index.jsx)

```javascript
const SUB_TABS = [
  { key: 'docstore', label: 'DocStore 연동', icon: '📥' },
  { key: 'upload', label: '파일 업로드', icon: '📄' },
];

// subTab === 'docstore' → <DocStoreImport />
// subTab === 'upload' → <PoolUpload />
```

---

## 8. 에러 처리 명세

### 8-1. JSON 파싱 실패

**위치**: pool-repatch.js `extractFromHtml()`, `extractFromVision()`

```javascript
// 1단계: 제어문자 제거
jsonStr.replace(/[\x00-\x1f]/g, (ch) => '\n\r\t'.includes(ch) ? ch : '');

// 2단계: trailing comma 수정
jsonStr.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');

// 3단계: 파싱 시도
try {
  questions = JSON.parse(jsonStr);
} catch (e) {
  // 4단계: 마지막 완전한 객체까지 잘라서 재파싱
  const lastBrace = jsonStr.lastIndexOf('}');
  if (lastBrace > 0) {
    questions = JSON.parse(jsonStr.substring(0, lastBrace + 1) + ']');
  } else {
    throw e;
  }
}
```

### 8-2. BMP 이미지

**위치**: pool-repatch.js `extractHwp()`

```javascript
if (ext === '.bmp') {
  execSync(`sips -s format jpeg "${imgPath}" --out "${jpgPath}"`);
  // 실패 시: continue (해당 이미지 건너뜀)
}
```

### 8-3. poppler 도구 미설치

**위치**: pool-repatch.js `extractPdf()`

```javascript
if (!hasPoppler) {
  // Vision 직접 전송으로 자동 폴백
  return { mode: 'vision-direct', fileData: {...} };
}
```

### 8-4. 중복 문제

```
pool-import.js: exam_id + original_number 중복 → 건너뜀 (INSERT 안 함)
pool-repatch.js: original_number로 매칭 → UPDATE (덮어쓰기)
api/pool-upload.js: exam_id + original_number 중복 → 건너뜀
```

### 8-5. API 속도 제한

| 스크립트 | 대기 시간 | 위치 |
|---------|----------|------|
| pool-repatch-batch.js | 2초 (파일 간) | 파일 루프 끝 |
| pool-explain.js | 1초 (문제 간) | 문제 루프 끝 |
| pool-patch-visual.js | 1.5초 (문제 간) | 문제 루프 끝 |

### 8-6. 파일 크기 제한

```
api/pool-upload.js: 20MB (base64 기준)
pool-repatch.js: 제한 없음 (로컬 실행)
pdfimages 필터: 5KB 미만 이미지 자동 제외 (아이콘 등)
```

---

## 9. 실전 운영 시나리오

### 시나리오 A: 새 회차 HWP 등록 (가장 일반적)

```bash
cd workspace/aitutor

# 1. pool에 파일 넣기
cp 2027년정기제01회네트워크관리사2급필기.hwp pool/

# 2. 1차 텍스트 추출 + DB 등록
node pool-import.js --exam-title="2027년 정기 1회" --category-id=3 --dry-run  # 미리보기
node pool-import.js --exam-title="2027년 정기 1회" --category-id=3            # 실제 등록
# → 출력: "시험 생성 id=161", "등록 50개"

# 3. 2차+3차 표/이미지 보강
node pool-repatch.js --exam-id=161 --file="2027년정기제01회네트워크관리사2급필기.hwp" --dry-run
node pool-repatch.js --exam-id=161 --file="2027년정기제01회네트워크관리사2급필기.hwp"

# 4. AI 해설 생성
node pool-explain.js --exam-id=161

# 5. 검증
node pool-patch-visual.js --scan --exam-id=161
# → "0개" 면 OK

# 6. 배포
npx vercel --prod --yes
```

### 시나리오 B: PDF 시험지 등록

```bash
# 1. pool에 PDF 넣기
cp 시험지.pdf pool/

# 2. 1차 등록
node pool-import.js --exam-title="정보처리기사 2027-1" --category-id=4

# 3. 2차+3차 보강 (poppler 자동 사용)
node pool-repatch.js --exam-id=162 --file="시험지.pdf" --dry-run
node pool-repatch.js --exam-id=162 --file="시험지.pdf"
# → pdftotext + pdftohtml + pdfimages 자동 실행

# 4~6. 해설 → 검증 → 배포 (동일)
```

### 시나리오 C: 스캔본 이미지 등록

```bash
# 이미지 여러 장인 경우 각각 실행
node pool-import.js --exam-id=162 --force-vision
# pool/에 있는 이미지 파일들을 Vision으로 추출

# 보강은 Vision 재분석
node pool-repatch.js --exam-id=162 --file="scan_p1.jpg"
```

### 시나리오 D: 기존 문제 표 재작업

```bash
# 원본 HWP 있을 때 (권장)
node pool-repatch.js --exam-id=140 --file="원본.hwp" --only-visual

# 원본 PDF만 있을 때
node pool-repatch.js --exam-id=140 --file="원본.pdf" --only-visual

# 원본 없을 때 (AI 추론 폴백)
node pool-patch-visual.js --patch --exam-id=140 --dry-run
node pool-patch-visual.js --patch --exam-id=140
```

### 시나리오 E: 여러 시험 일괄 처리

```bash
# pool-repatch-batch.js 파일 내 files 배열 수정
# → [파일명, exam_id] 쌍 추가
node pool-repatch-batch.js
```

### 시나리오 F: 웹에서 소량 추가

```
사이트 접속 (관리자 로그인)
  → 문제등록 탭 → "파일 업로드" 서브탭
  → PDF/이미지 선택 (최대 20MB)
  → "문제 추출 시작" 클릭
  → 추출 결과 확인 (표/그림 태그 표시)
  → 카테고리 + 시험 선택
  → "DB 등록" 클릭
  → 필요 시 배치 CLI로 표/이미지 보강
```

---

## 10. 환경 설정

### 10-1. 필수 환경변수

```bash
GEMINI_API_KEY=...    # Gemini Vision API 키
DATABASE_URL=...      # Supabase PostgreSQL 연결 문자열
```

### 10-2. 시스템 도구

| 도구 | 설치 | 용도 | 사용 스크립트 | 없으면 |
|------|------|------|-------------|--------|
| **hwp5** | `pip install hwp5` | HWP→HTML (표 보존+이미지) | pool-repatch.js | HWP 처리 불가 |
| **poppler** | `brew install poppler` | PDF→텍스트+HTML+이미지 | pool-repatch.js | Vision 직접 전송 |
| **sips** | macOS 내장 | BMP→JPEG 변환 | pool-repatch.js | BMP 건너뜀 |
| **pdf-parse** | `npm install pdf-parse` | PDF 텍스트 추출 | pool-import.js | Vision 사용 |
| Node.js 20+ | - | 스크립트 실행 | 전체 | - |

**최소 설치**:
```bash
pip install hwp5           # HWP 처리
brew install poppler        # PDF 처리
npm install pdf-parse       # PDF 텍스트
```

### 10-3. 경로 상수

```
작업 디렉토리:     workspace/aitutor/
pool 폴더:        workspace/aitutor/pool/
처리 완료:        workspace/aitutor/pool/done/
임시 폴더:        workspace/aitutor/pool/temp/
이미지 저장:      workspace/aitutor/public/q-images/
이미지 빌드:      workspace/aitutor/dist/q-images/ (Vite 빌드 시)
hwp5html:        /Users/2team/Library/Python/3.9/bin/hwp5html
Gemini 모델:     gemini-2.5-flash
DB:              Supabase PostgreSQL (DATABASE_URL)
```

### 10-4. NPM 의존성

```json
{
  "@google/generative-ai": "Gemini Vision API",
  "pdf-parse": "PDF 텍스트 추출",
  "pg": "PostgreSQL 드라이버",
  "dotenv": "환경변수 로드"
}
```

---

## 11. 현재 데이터 현황

| 항목 | 수치 |
|------|------|
| 카테고리 | 2개 (영상정보관리사, 네트워크관리사2급) |
| 시험 | 29개 (exam_id: 1~4, 136~160) |
| 문제 | 1,490개 |
| 정답 완료 | 1,490개 (100%) |
| 해설 완료 | 1,490개 (100%) |
| 이미지 저장 | 13개 (public/q-images/) |
| 표/그림 미복원 | **0개** (완전 복원) |

### 이미지 파일 목록

```
public/q-images/
├── exam140_q13.jpg    (2021-1 #13: IP 충돌 화면)
├── exam140_q44.jpg    (2021-1 #44: named.zone 설정)
├── exam141_q9.jpg     (2021-2 #9:  tracert 출력)
├── exam141_q11.jpg    (2021-2 #11: IP 검색 화면)
├── exam141_q14.jpg    (2021-2 #14: 방화벽 로그)
├── exam143_q31.jpg    (2021-4 #31: DNS 관리자 UI)
├── exam145_q15.jpg    (2022-2 #15: 3Way-Handshake)
├── exam146_q32.jpg    (2022-3 #32: named.zone 설정)
├── exam148_q7.jpg     (2023-1 #7:  IP 검색 화면)
├── exam148_q11.jpg    (2023-1 #11: netstat 출력)
├── exam148_q29.jpg    (2023-1 #29: DNS 관리자 UI)
├── exam155_q12.jpg    (2024-4 #12: 방화벽 로그)
└── exam157_q43.jpg    (2025-2 #43: DNS 오류 화면)
```

---

## 12. 네이버 클라우드 VPS + DB 전환 계획

### 12-1. 전환 목표

```
현재 (Vercel + Supabase)              전환 후 (네이버 클라우드 VPS + DB)
━━━━━━━━━━━━━━━━━━━━                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vercel 서버리스 (api/*.js)       →    Express 상시 서버 (server.js)
Supabase PostgreSQL              →    네이버 Cloud DB for PostgreSQL
Vercel CDN (정적 파일)            →    Nginx + Express 정적 서빙
로컬에서만 CLI 실행              →    서버에서 CLI + 웹 UI 통합
HWP 웹 업로드 불가               →    HWP 웹 업로드 가능 (hwp5html 서버 설치)
300초 함수 제한                  →    시간 제한 없음
이미지 빌드 시점에만 포함         →    동적 업로드 + 서빙
```

### 12-2. 네이버 클라우드 서비스 구성

```
┌───────────────────────────────────────────────────────────────┐
│  네이버 클라우드 플랫폼 (NCP)                                     │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │  VPS (Server)        │    │  Cloud DB for PostgreSQL     │ │
│  │  Ubuntu 22.04        │    │  Stand Alone (개발)          │ │
│  │  Compact 2vCPU/4GB   │    │  또는 HA (운영)              │ │
│  │                      │    │                              │ │
│  │  Node.js 20+         │◄──►│  DB명: aitutor               │ │
│  │  Python 3 (hwp5)     │    │  스키마: 기존 Supabase와 동일  │ │
│  │  poppler (PDF 처리)   │    │  포트: 5432                  │ │
│  │  Nginx (리버스 프록시) │    │  SSL: VPC 내부 통신           │ │
│  │  PM2 (프로세스 관리)   │    │                              │ │
│  │                      │    └──────────────────────────────┘ │
│  │  포트:                │                                     │
│  │    80/443 → Nginx    │    ┌──────────────────────────────┐ │
│  │    3002 → Express    │    │  Object Storage (선택)        │ │
│  │    5174 → Vite (dev) │    │  이미지/파일 저장              │ │
│  └─────────────────────┘    │  CDN 연동 가능                 │ │
│                              └──────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  도메인 + SSL                                             │ │
│  │  aitutor.example.com → VPS 공인 IP                       │ │
│  │  Let's Encrypt 무료 SSL 또는 NCP 인증서                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 12-3. 서버 스펙 권장

| 항목 | 최소 | 권장 | 비고 |
|------|------|------|------|
| **VPS** | Compact (2vCPU/4GB) | Standard (2vCPU/8GB) | hwp5html + Gemini 응답 파싱 |
| **DB** | Stand Alone | HA (이중화) | 운영 시 HA 권장 |
| **디스크** | 50GB SSD | 100GB SSD | HWP/이미지 저장 |
| **OS** | Ubuntu 22.04 | Ubuntu 22.04 LTS | Node.js + Python 호환 |
| **월 비용(예상)** | ~₩30,000 | ~₩60,000 | VPS+DB 합산 |

### 12-4. 전환 단계

#### Phase 1: 인프라 준비

```
① NCP 콘솔에서 VPC 생성
② VPS 서버 생성 (Ubuntu 22.04, Compact)
③ Cloud DB for PostgreSQL 생성
④ ACG(보안 그룹) 설정
   - 인바운드: 80, 443, 22(SSH)
   - DB: 5432 (VPC 내부만)
⑤ 공인 IP 할당
⑥ 도메인 연결 + SSL 설정
```

#### Phase 2: 서버 환경 설치

```bash
# ── 시스템 업데이트 ──
sudo apt update && sudo apt upgrade -y

# ── Node.js 20 설치 ──
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# ── Python 3 + hwp5 설치 ──
sudo apt install -y python3 python3-pip
pip3 install hwp5

# ── poppler (PDF 처리) 설치 ──
sudo apt install -y poppler-utils

# ── Nginx 설치 ──
sudo apt install -y nginx

# ── PM2 설치 (프로세스 관리) ──
sudo npm install -g pm2

# ── Git 설치 ──
sudo apt install -y git

# ── 설치 확인 ──
node -v          # v20.x
python3 -m hwp5  # hwp5 도구 확인
pdftotext -v     # poppler 확인
nginx -v         # nginx 확인
pm2 -v           # pm2 확인
```

#### Phase 3: DB 마이그레이션

```bash
# ── Supabase에서 데이터 덤프 ──
# 로컬에서 실행
pg_dump "$SUPABASE_DATABASE_URL" \
  --no-owner --no-acl \
  --format=custom \
  -f aitutor_backup.dump

# ── 네이버 Cloud DB에 복원 ──
pg_restore \
  -h {NCP_DB_HOST} -p 5432 -U {DB_USER} -d aitutor \
  --no-owner --no-acl \
  aitutor_backup.dump

# ── 데이터 검증 ──
psql -h {NCP_DB_HOST} -U {DB_USER} -d aitutor \
  -c "SELECT COUNT(*) FROM questions;"
# → 1,490 확인
```

**DB 연결 변경 (.env)**:
```bash
# 기존 (Supabase)
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# 변경 (네이버 Cloud DB)
DATABASE_URL=postgresql://{DB_USER}:{DB_PASSWORD}@{NCP_DB_PRIVATE_IP}:5432/aitutor
```

**api/db.js 변경**:
```javascript
// 기존 (Supabase — SSL 필수, 외부 연결)
ssl: { rejectUnauthorized: false },
max: 2,  // 서버리스 최소

// 변경 (VPC 내부 — SSL 불필요, 풀 확대)
ssl: false,  // VPC 내부 통신
max: 10,     // 상시 서버 → 풀 확대
idleTimeoutMillis: 60000,     // 60초
connectionTimeoutMillis: 5000, // 5초
```

#### Phase 4: 프로젝트 배포

```bash
# ── 프로젝트 클론 ──
cd /home/ubuntu
git clone https://github.com/season1zeepapa-cell/aifac.git
cd aifac/workspace/aitutor

# ── 의존성 설치 ──
npm install

# ── 환경변수 설정 ──
cat > .env << 'EOF'
PORT=3002
DATABASE_URL=postgresql://{USER}:{PASS}@{NCP_DB_IP}:5432/aitutor
GEMINI_API_KEY={키}
OPENAI_API_KEY={키}
ANTHROPIC_API_KEY={키}
AUTH_TOKEN_SECRET={32자 이상 시크릿}
EOF

# ── 프론트엔드 빌드 ──
npm run build:fe

# ── 이미지 폴더 생성 (동적 업로드용) ──
mkdir -p uploads/q-images
# 기존 public/q-images/ 내용 복사
cp public/q-images/* uploads/q-images/

# ── PM2로 서버 시작 ──
pm2 start server.js --name aitutor
pm2 save
pm2 startup  # 부팅 시 자동 시작
```

#### Phase 5: Nginx 설정

```nginx
# /etc/nginx/sites-available/aitutor
server {
    listen 80;
    server_name aitutor.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name aitutor.example.com;

    ssl_certificate /etc/letsencrypt/live/aitutor.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aitutor.example.com/privkey.pem;

    # 파일 업로드 크기 (HWP 대량 업로드 대응)
    client_max_body_size 100M;

    # 정적 파일 (빌드 산출물)
    location / {
        root /home/ubuntu/aifac/workspace/aitutor/dist;
        try_files $uri $uri/ /index.html;

        # 캐시 설정
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }

    # 이미지 서빙 (동적 업로드)
    location /q-images/ {
        alias /home/ubuntu/aifac/workspace/aitutor/uploads/q-images/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # API 프록시
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 스트리밍 지원 (AI 해설)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;  # AI 응답 대기 (10분)
    }
}
```

```bash
# Nginx 활성화
sudo ln -s /etc/nginx/sites-available/aitutor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL 인증서 (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d aitutor.example.com
```

#### Phase 6: server.js 수정 (VPS 대응)

```javascript
// ── 변경 1: 이미지 동적 서빙 추가 ──
const UPLOAD_DIR = path.join(__dirname, 'uploads');
app.use('/q-images', express.static(path.join(UPLOAD_DIR, 'q-images')));

// ── 변경 2: 파일 업로드 크기 확대 ──
app.use(express.json({ limit: '50mb' }));  // 기존 10mb → 50mb

// ── 변경 3: pool-repatch API 추가 (웹에서 대량 처리) ──
// api/pool-repatch.js 신규 생성 필요
```

#### Phase 7: CORS 설정 변경

```javascript
// api/cors.js
const ALLOWED_ORIGINS = [
  'https://aitutor.example.com',       // 네이버 클라우드 도메인
  'https://aitutor-six.vercel.app',    // Vercel (전환 기간 유지)
  'http://localhost:5174',              // 로컬 개발
  'http://localhost:3002',
];
```

#### Phase 8: Capacitor 설정 변경

```json
// capacitor.config.json
{
  "server": {
    "url": "https://aitutor.example.com"  // Vercel → NCP 도메인
  }
}
```

### 12-5. server.js 변경 상세

현재 server.js는 Vercel 서버리스와 로컬 개발 겸용입니다. VPS 전환 시 추가할 내용:

```javascript
// ═══ 추가할 내용 ═══

// ── 이미지 업로드 디렉토리 (동적 서빙) ──
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(path.join(UPLOAD_DIR, 'q-images'))) {
  fs.mkdirSync(path.join(UPLOAD_DIR, 'q-images'), { recursive: true });
}
app.use('/q-images', express.static(path.join(UPLOAD_DIR, 'q-images')));

// ── 파일 업로드 크기 확대 (HWP 대량) ──
app.use(express.json({ limit: '50mb' }));

// ── pool-repatch API (웹에서 대량 처리) ──
// POST /api/pool-repatch
// { action: 'list-pool' }     → pool/ 폴더 파일 목록
// { action: 'repatch', exam_id, file }  → pool-repatch 실행
// { action: 'status' }        → 진행 상태 조회
// { action: 'explain', exam_id } → 해설 생성
// { action: 'scan', exam_id }    → 마커 검증

// ── pool 파일 업로드 API ──
// POST /api/pool-files (multipart/form-data)
// HWP/PDF 파일을 pool/ 폴더에 저장
// multer 미들웨어 사용

// ── SSE 진행률 스트리밍 ──
// GET /api/pool-progress?job_id=xxx
// 대량 처리 시 진행률 실시간 전송
```

### 12-6. 웹 UI 변경 (PoolUpload.jsx 확장)

```
현재 UI                             VPS 전환 후 UI
━━━━━━                             ━━━━━━━━━━━━
파일 선택 (PDF/PNG/JPG만)     →    파일 선택 (HWP/PDF/PNG/JPG)
1개만 업로드                  →    여러 개 드래그&드롭
추출 → 등록 (2단계)           →    업로드 → 추출 → 보강 → 해설 → 검증 (5단계)
진행률 없음                   →    SSE 실시간 진행률
표/이미지 보강 불가            →    자동 보강 (서버에서 hwp5html)
```

**확장 UI 플로우**:
```
┌─────────────────────────────────────────────┐
│  1. 파일 업로드                               │
│     ┌──────────────────────────────────┐    │
│     │  HWP/PDF/이미지 드래그 & 드롭       │    │
│     │  또는 파일 선택                     │    │
│     │  (여러 개 동시 가능)                │    │
│     └──────────────────────────────────┘    │
│     카테고리: [네트워크관리사2급 ▼]           │
│     시험명: [2027년 정기 1회     ]           │
│     [📤 업로드 + 처리 시작]                  │
├─────────────────────────────────────────────┤
│  2. 처리 진행률                              │
│     ┌──────────────────────────────────┐    │
│     │ ████████░░░░░░░░░░ 45%           │    │
│     │                                  │    │
│     │ ✅ 1차 텍스트 추출: 50문제         │    │
│     │ ⏳ 2차 표/이미지 보강 중... (3/50)  │    │
│     │ ⬜ 3차 AI 해설 생성               │    │
│     │ ⬜ 4차 검증                       │    │
│     └──────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  3. 결과                                    │
│     등록: 50문제 | 표 보강: 8문제            │
│     이미지: 2문제 | 해설: 50문제             │
│     미복원 마커: 0건 ✅                      │
│     [사이트에서 확인하기]                     │
└─────────────────────────────────────────────┘
```

### 12-7. DB 전환 상세 (Supabase → 네이버 Cloud DB)

#### 네이버 Cloud DB for PostgreSQL 설정

```
서비스: Cloud DB for PostgreSQL
타입: Stand Alone (개발/소규모) 또는 HA (운영)
버전: PostgreSQL 15 또는 16
스펙: 2vCPU / 4GB RAM / 50GB SSD
VPC: VPS와 같은 VPC
```

#### 테이블 생성 (마이그레이션 없이 새로 만들 경우)

```sql
-- categories
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- exams
CREATE TABLE exams (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  exam_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- subjects
CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- questions (핵심)
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER REFERENCES exams(id),
  subject_id INTEGER REFERENCES subjects(id),
  question_number INTEGER,
  original_number VARCHAR(50),
  body TEXT,
  choices JSONB,
  answer VARCHAR(10),
  explanation TEXT,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- question_explanations
CREATE TABLE question_explanations (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id),
  provider VARCHAR(50),
  model VARCHAR(100),
  content TEXT,
  extra_prompt TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- question_memos
CREATE TABLE question_memos (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id),
  user_id INTEGER,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- memo_files
CREATE TABLE memo_files (
  id SERIAL PRIMARY KEY,
  memo_id INTEGER REFERENCES question_memos(id),
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- bookmarks
CREATE TABLE bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  question_id INTEGER REFERENCES questions(id),
  label VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW()
);

-- exam_results
CREATE TABLE exam_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  exam_id INTEGER REFERENCES exams(id),
  score INTEGER,
  total INTEGER,
  answers JSONB,
  time_spent INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- users (하드코딩 계정 → DB 계정으로 전환 시)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(64),
  name VARCHAR(100),
  admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- login_attempts (브루트포스 방어)
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  ip INET,
  attempt_count INTEGER DEFAULT 1,
  reset_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 minute'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_questions_subject ON questions(subject_id);
CREATE INDEX idx_questions_exam_orig ON questions(exam_id, original_number);
CREATE INDEX idx_explanations_question ON question_explanations(question_id);
CREATE INDEX idx_memos_question ON question_memos(question_id);
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_exam_results_user ON exam_results(user_id);
```

#### api/db.js 변경

```javascript
// ── 기존 (Supabase) ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },  // Supabase 외부 연결
  max: 2,                              // 서버리스 최소
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ── 변경 (네이버 Cloud DB — VPC 내부) ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,                          // VPC 내부 → SSL 불필요
  max: 20,                             // 상시 서버 → 풀 확대
  idleTimeoutMillis: 60000,            // 60초 유휴
  connectionTimeoutMillis: 5000,       // 5초 연결
});
```

### 12-8. 전환 체크리스트

```
인프라 준비
  [ ] NCP 계정 생성 + VPC 설정
  [ ] VPS 생성 (Compact 2vCPU/4GB, Ubuntu 22.04)
  [ ] Cloud DB for PostgreSQL 생성
  [ ] ACG 보안 그룹 (80, 443, 22, 5432)
  [ ] 공인 IP 할당
  [ ] 도메인 DNS 설정

서버 환경
  [ ] Node.js 20 설치
  [ ] Python 3 + hwp5 설치
  [ ] poppler 설치
  [ ] Nginx 설치 + 설정
  [ ] PM2 설치
  [ ] Let's Encrypt SSL

DB 마이그레이션
  [ ] Supabase pg_dump
  [ ] NCP Cloud DB pg_restore
  [ ] 데이터 검증 (1,490문제)
  [ ] .env DATABASE_URL 변경
  [ ] api/db.js SSL/풀 설정 변경

프로젝트 배포
  [ ] git clone + npm install
  [ ] .env 환경변수 설정
  [ ] npm run build:fe
  [ ] uploads/q-images/ 이미지 복사
  [ ] PM2 시작

코드 변경
  [ ] server.js: 이미지 동적 서빙 + 업로드 크기 확대
  [ ] api/cors.js: 도메인 추가
  [ ] api/db.js: SSL off + 풀 확대
  [ ] pool-repatch.js: IMAGE_DIR 경로 변경 (public/ → uploads/)
  [ ] capacitor.config.json: 서버 URL 변경
  [ ] api/pool-upload.js: HWP MIME 추가

테스트
  [ ] 웹 접속 확인 (https://도메인)
  [ ] 로그인/문제 풀이 정상
  [ ] AI 해설 SSE 스트리밍 정상
  [ ] HWP 웹 업로드 → 추출 → 등록 확인
  [ ] 이미지 서빙 확인 (/q-images/)
  [ ] 모바일 앱 (Capacitor) 연결 확인

전환 완료
  [ ] Vercel 배포 중단 (또는 유지 후 점진 전환)
  [ ] DNS 완전 전환
  [ ] Supabase 데이터 최종 동기화 후 해지
```

### 12-9. 전환 후 아키텍처

```
사용자 브라우저 / 모바일 앱
       │
       ▼
  ┌─────────┐
  │  Nginx   │  (443/80)
  │  SSL     │
  │  정적파일 │─→ dist/ (프론트엔드)
  │  이미지   │─→ uploads/q-images/ (문제 이미지)
  └────┬─────┘
       │ /api/* 프록시
       ▼
  ┌──────────┐
  │  Express  │  (3002)
  │  PM2 관리 │
  │           │
  │  API 18개 │─→ 인증, 문제, AI, 메모, 북마크 ...
  │           │
  │  파이프라인│─→ hwp5html + poppler + Gemini
  │  HWP 처리 │   (서버에서 직접 실행)
  │           │
  └────┬──────┘
       │
       ▼
  ┌──────────┐
  │ Cloud DB  │  (5432, VPC 내부)
  │ PostgreSQL│
  │           │
  │ questions │  1,490+ 문제
  │ exams     │  29+ 시험
  │ users     │  사용자
  └───────────┘
```

### 12-10. 전환 후 파이프라인 변화

```
현재 파이프라인 (로컬 CLI)
━━━━━━━━━━━━━━━━━━━━━━
로컬 PC에서 CLI 수동 실행
  node pool-import.js ...
  node pool-repatch.js ...
  node pool-explain.js ...
  npx vercel --prod --yes

전환 후 파이프라인 (웹 UI + 서버 CLI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
방법 1: 웹 UI (관리자)
  HWP/PDF 업로드 → 서버에서 전체 파이프라인 자동 실행
  → 진행률 SSE 실시간 표시
  → 완료 알림

방법 2: SSH CLI (기존 방식 그대로)
  ssh ubuntu@서버IP
  cd aifac/workspace/aitutor
  node pool-import.js ...
  node pool-repatch.js ...
```

### 12-11. 비용 예상 (월)

| 서비스 | 스펙 | 예상 비용 |
|--------|------|----------|
| VPS (Server) | Compact 2vCPU/4GB | ~₩26,000 |
| Cloud DB PostgreSQL | Stand Alone, 최소 스펙 | ~₩30,000 |
| 공인 IP | 1개 | ~₩3,000 |
| 도메인 | .com 기준 | ~₩15,000/년 |
| **월 합계** | | **~₩60,000** |

> Supabase 무료 티어 → NCP 유료 전환이므로 비용 증가
> 대신: HWP 웹 업로드, 시간 제한 없음, DB 완전 제어, 한국 리전 저지연
