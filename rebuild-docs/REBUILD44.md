# REBUILD44 — KISA 진단원 양성과정 교재 라이브러리 구축 (course/)

> **작성**: 2026-06-15 KST
> **트리거**: 사용자 요청 — "2025년 SW보안약점 진단원 양성과정 교재를 별도 교육자료로 라이브러리화 (시험 연관성 높음)"
> **범위**: 암호화 PDF(528쪽, 비번 `kisasw2025`)를 대단원/항목 단위 교육 카드로 변환
> **결과**: `kisa-module/course/` 에 **73개 카드 × (json+md) = 146개 파일**, 기존 `library/`(진단가이드)와 상호 연결

---

## §0. 결론 요약

| 산출물 | 내용 |
|--------|------|
| 교재 라이브러리 | 단원 카드 4 + 설계 20 + 구현 49 = **73개** |
| 통계 | 섹션 317 · 시험 출제 포인트 379 |
| 연결 | `related_library`/`chapter_code_ref` 로 `library/` 의 IMP/DSG 와 1:1 매핑 |

**핵심**: 진단가이드(`library/`, 69개)와 양성과정 교재(`course/`, 73개)를 **이중 자료 체계**로 구축. 같은 보안약점을 "진단 상세(정탐/오탐·코드)" + "교재 시험 관점(슬라이드 흐름·출제 포인트)" 양쪽으로 학습 가능.

---

## §1. 교재 구조 (6 대단원)

| 대단원 | 내용 | 처리 |
|--------|------|------|
| Ⅰ SW개발보안 최신 동향 | 사고사례·위협트렌드·SRM(보안위험관리) | 단원 카드 |
| Ⅱ SW개발 법률과 제도 | 공공/민간 법규·진단 제도 | 단원 카드 |
| Ⅲ SW보안약점 진단의 이해 | 진단원 역할·자격·절차·법규 | 단원 카드 |
| Ⅳ 분석·설계단계 진단 | 설계 20개 항목 | 항목 카드 (DSG 연결) |
| Ⅴ 구현단계 진단 | 구현 49개 약점 | 항목 카드 (IMP 연결) |
| Ⅵ 소스코드 진단 실습 | SpotBugs+FindSecurityBugs 실습 | 단원 카드 |

- 원본: 암호화 PDF 528쪽 (`pdftotext -upw kisasw2025` 로 추출).

---

## §2. 교육자료 포맷 (보안약점 포맷과 별개)

### 2.1 단원 카드 (Ⅰ·Ⅱ·Ⅲ·Ⅵ)

`unit_code, unit, title, type:"course", source, summary, sections[{title, key_points[], exam_relevance}], key_concepts[{term, definition}], exam_points[], keywords[], related_library[], tags[]`

### 2.2 항목 카드 (Ⅳ·Ⅴ, 보안약점)

단원 카드 + `chapter_code_ref`, `category`, `related_library`(기존 DSG/IMP 코드). 코드 상세는 `library/` 에 위임하고, 교재 카드는 슬라이드 흐름·시험 포인트 중심.

---

## §3. 변환 결과

| 카드 | 범위 | 수 |
|------|------|-----|
| COURSE-01/02/03/06 | 단원 Ⅰ·Ⅱ·Ⅲ·Ⅵ | 4 |
| COURSE-DSG-* | 설계 IV·SF·EH·SC | 20 |
| COURSE-IMP-* | 구현 IV·SF·TS·EH·CE·EN·AA | 49 |

- 병렬 에이전트 배치 변환 → `node` json 유효성 일괄 검증 (파싱실패 0, 누락 0).
- 품질 원칙: 교재 원문 기준(지어내기 없음), OCR 노이즈 제거, 교재 페이지번호 매핑.

**시험 핵심 예**: 진단원 자격(개발 6년/진단 3년)·교육(기본 40h), 제53·54조, EAL2, STRIDE↔CIA, 위험=자산×위협×취약성.

---

## §4. 두 라이브러리 연결

```
library/IMP-IV-01-sql-injection.json   ←─ chapter_code_ref ─→  course/COURSE-IMP-IV-01-sql-injection.json
   (진단가이드: 정탐/오탐·코드예제)                              (교재: 슬라이드 흐름·시험포인트)
```

→ 학습화면에서 한 보안약점을 두 관점으로 교차 제공 가능.

---

## §5. 영향 범위 / 다음 단계

| 항목 | 영향 |
|------|------|
| 앱 런타임/배포 | ❌ 무영향 (`kisa-module` 은 `.gcloudignore` 배포 제외) |
| `library/` | 🟢 연결만, 변경 없음 |

**후속 (REBUILD45+ 검토)**:
1. 앱 연결 — chapter 학습화면에 library/course 카드 표시 + 검색(Lunr)
2. 문제 자동 생성 — 교재 exam_points + 진단가이드 정탐/오탐 결합
3. 원본 교재 PDF는 암호화 자료라 git 미포함 (kisa-pool 배포·추적 제외 유지)

---

**완료 일시**: 2026-06-15 KST
**연관 문서**: REBUILD43(진단가이드 라이브러리 library/), `kisa-module/course/` (교재 라이브러리 본체)
