# REBUILD66 — 이론교육 상세에 "2026 교재 코드예시" 아코디언 추가

> **작성**: 2026-06-29 KST
> **범위**: `workspace/aitutor/src/tabs/KisaTab/TheoryDetail.jsx`
> **목적**: 새 2026 교재 기반 이론교육 상세 화면(구현 단계)에, 기존 학습자료 상세(StudyDetail)에만 있던 펼침/접힘 방식 코드예시 섹션을 동일하게 노출한다.

---

## §1. 배경

- 기존 학습자료 상세 `StudyDetail.jsx`에는 `kisec2026` 자료원의 `codeExamples`를 펼침/접힘 아코디언으로 보여주는 **"📘 2026 교재 코드예시"** 섹션이 있었다(`StudyDetail.jsx` §5.1).
- 새로 추가된 이론교육 상세 `TheoryDetail.jsx`는 같은 `kisec2026` 자료원을 직참조하지만, 구현 단계에 코드예시 섹션이 없었다(원인/영향/대응/진단방법 4박스만).
- 두 화면이 동일 데이터(`libData.sources[id=kisec2026].items[].codeExamples`)를 읽으므로, 데이터 추출 없이 UI 블록만 복제하면 된다.

## §2. 변경 내용 (`TheoryDetail.jsx`)

1. `CodeBlock` 컴포넌트 import 추가(`../../components/CodeBlock`).
2. 아코디언 state·토글 추가: `open2026` / `toggle2026` (StudyDetail의 `open2026` 패턴 그대로, 첫 예제 자동 펼침 `new Set([0])`).
3. 구현 단계 렌더링(`isDesign === false`)의 진단방법 박스 다음에 코드예시 아코디언 블록 삽입.
   - 데이터: `item.codeExamples`(현재 항목이 곧 kisec2026 항목이므로 직접 접근).
   - 필드 매핑: `lang`(헤더) / `vulnerable`(❌ 취약) / `safe`(✅ 안전) / `note`(설명).
   - 언어 파싱: `(ex.lang || '').toLowerCase().split(/[ (]/)[0] || 'java'`.

## §3. 적용 범위 / 제약

| 단계 | 코드예시 노출 | 비고 |
|---|---|---|
| 구현(IMP-*) | ✅ 노출 | 49개 항목 모두 `codeExamples` 보유(2~5개씩) |
| 설계(DSG-*) | ❌ 미노출 | `codeExamples` 데이터 자체가 없음 |
| 사고사례(K26-*) | ❌ 미노출 | theory/codeExamples 모두 없음 |

- DB/API 무변경. 번들(`kisa-library.json`) 직참조만 사용.
- 빌드: `npm run build:fe` 정상(코드 0 에러), `CodeBlock` 청크 포함 확인.
