# 운전면허 학과시험 모듈 (driver-module)

aitutor 의 일반 기출문제 트랙(`questions` 테이블)에 운전면허 학과시험 콘텐츠를 적재하기 위한 1회성 작업 패키지.

## 1차 출시 범위

- **2종 자동변속 학과시험** (라벨)
- 출처: 도로교통공단 공식 1·2종 보통 + 1종 대형·특수 통합 문제은행 (1,000문제)
- 동영상 문항 포함
- 배경: 2종 자동 학과시험은 2종 보통과 동일 문제은행 사용 (실기 단계만 자동/수동 차이)

## 향후 확장

같은 PDF 콘텐츠를 활용해 회차만 별도 등록:

- 1종 보통 학과시험
- 1종 대형·특수 학과시험
- (별도 PDF) 이륜자동차, 원동기장치자전거, 2종 소형

## 디렉토리

```
source/        ← 다운로드한 원본 PDF
migrations/    ← DB 마이그레이션 (video_url 컬럼 추가 등)
scripts/       ← 추출/적재 파이프라인
  01_download.sh
  02_extract.js
  03_explain.js  (또는 Claude Code 직접 사용)
  04_import.js
  05_verify.js
data/          ← 중간 산출물
  raw-extracted.json   추출 직후 (해설 빈 상태)
  final.json           해설 채운 후 (DB 적재 직전)
  images/              추출된 이미지 임시
  videos/              추출된 동영상 임시
```

## 미디어 배치 (운영)

DB 적재 시 미디어 파일은 `public/q-images/driver/` 로 복사:

- 그림 문항: `/q-images/driver/q{NNN}.{ext}` (예: `/q-images/driver/q047.png`)
- 동영상 문항: `/q-images/driver/v{NNN}.mp4`

## 라이선스

- 공공데이터포털 등록: 이용허락범위 제한 없음 (상업 가능)
- safedriving.or.kr 공지: 상업적 이용 금지 (공식 라이선스 모순 — 1차는 개인 학습용 무료로 진행)
- 향후 유료화 시점에 도로교통공단에 공문 발송 권장

## 진행 절차

1. `source/` 에 PDF 다운로드 (수동 또는 `01_download.sh`)
2. `migrations/001_questions_media.sql` 적용 (video_url 컬럼 추가)
3. `02_extract.js` 실행 → `data/raw-extracted.json` 생성
4. Claude Code CLI 로 해설 생성 → `data/final.json`
5. 검수 (랜덤 50개)
6. `04_import.js` 실행 → questions 테이블 INSERT + 미디어 파일 복사
7. 라이브 검증 → CloudFront 무효화
