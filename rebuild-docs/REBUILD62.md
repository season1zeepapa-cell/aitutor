# REBUILD62 — 이론교육 설계영역(DSG 20) 추가 : 요구사항·관련약점 링크

> **작성**: 2026-06-26 KST
> **트리거**: 사용자 요청 — 이론교육에 **설계영역** 추가. 교재(KISEC 2026) 설계단계는 구현과 **양식이 다름**(요구사항 설명/요구사항 내용/관련 보안약점). 교재 문구 동일, 이미지 없음. **관련 보안약점 항목은 해당 약점 페이지로 링크**(Image #5 양식).
> **결과**: 설계단계 20개(DSG)를 이론교육에 추가. 구현/설계 탭 구분, 설계 상세는 요구사항 설명·내용·관련약점(IMP 링크) 양식. **DB/API 무변경**(번들 직참조). [[REBUILD61]] 구현영역 패턴 계승.

---

## §0. 결론 요약

| 작업 | 파일 | 결과 |
|------|------|------|
| 설계 필드 번들화 | `scripts/build-kisa-library.mjs` | DSG 의 `design:{description,measures,related}` 추가 |
| 상세 양식 분기 | `TheoryDetail.jsx` | 설계=요구사항 설명/내용/관련약점(링크), 구현=원인/영향/대응/진단 |
| 목록 탭 | `TheoryList.jsx` | 🔧 구현단계 / 📐 설계단계 탭, 분류별 나열 |

---

## §1. 설계 데이터 (이미 완비)

DSG JSON(`library-kisec2026/DSG-*.json`)에 교재 양식 필드가 이미 존재 → 추출 워크플로우 불필요:
- `description` → **요구사항 설명**
- `security_measures[]` → **요구사항 내용**
- `related_weaknesses[{category,weakness,code}]` → **관련 보안약점**(IMP chapter_code 링크)

## §2. 빌드 (`build-kisa-library.mjs`)

`mapLibrary` 에 `design` 추가: `d.stage==='design'` 이고 description/security_measures 있을 때 `{ description, measures:security_measures, related:related_weaknesses }`. 구현(`theory`)·진단이미지(`diagnosisImage`)와 별도 필드라 충돌 없음.

## §3. 화면

- **목록**(`TheoryList`): 🔧 구현단계(theory 보유 IMP 49) / 📐 설계단계(design 보유 DSG 20) **탭**. 분류(입력검증/보안기능/에러처리/세션통제…)별 정렬. `?stage=design` 으로 탭 복원.
- **상세**(`TheoryDetail`): `item.design` 이면 설계 양식(Image #5) — 요구사항 설명(회색)·요구사항 내용(보라)·관련 보안약점(빨강). 아니면 기존 구현 4박스.
- **관련 보안약점 링크**: `related.code`(IMP) 우선, 없으면 **약점명으로 IMP theory 항목 매칭 보강**(`norm`=NFC·괄호·공백 제거) → `/kisa/theory/{IMP code}` 이동. (전체 41건 중 27건 code 보유, 14건 약점명 보강)

## §4. 검증

- 빌드 `build:lib`(265) + `build:fe` 에러 0 ✅
- DSG 20개 design 보유, 카테고리 4종(입력검증·보안기능·에러처리·세션통제) ✅
- 화면: dev + Playwright 로 `DSG-SF-02`(인증수행 제한) 3박스 + 관련약점 링크 → `IMP-SF-16` 이동 확인 ✅

## §5. 남은 작업

- 관련약점 14건(code 없는 항목) 약점명 보강 매칭 정확도 점검(대부분 IMP 매칭).
- 설계 `design_considerations`(설계 시 고려사항 상세)는 현재 상세에 미노출 — 필요 시 아코디언 추가.
