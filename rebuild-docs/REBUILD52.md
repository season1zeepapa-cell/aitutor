# REBUILD52 — 코드 구문강조 다크모드 테마 조정

> **작성**: 2026-06-16 KST
> **트리거**: 사용자 요청 — "코드 구문 강조 다크모드 테마 미세 조정"
> **범위**: `src/components/code-theme.css`(신규), `CodeBlock.jsx`(import)
> **결과**: 다크모드 코드 토큰 색을 VSCode Dark+ 계열로 가독성 개선

---

## §0. 문제 / 해결

- **문제**: `CodeBlock` 이 prism **라이트 테마**(`prism.css`)만 로드 → 다크모드(어두운 배경)에서 토큰 색이 어둡고 text-shadow로 흐림.
- **해결**: `code-theme.css` 신규로 `.kisa-code-block` 스코프에서만 다크 토큰 색 오버라이드. `:is(.dark, [data-theme="dark"])` 로 두 다크모드 방식(`darkMode: ['class','[data-theme="dark"]']`) 모두 커버. 라이트 모드 무영향.

## §1. 토큰 색 (VSCode Dark+)

| 토큰 | 색 |
|------|-----|
| 주석 | #6a9955 |
| 키워드·불리언·태그 | #569cd6 |
| 문자열·정규식 | #ce9178 |
| 함수·메소드 | #dcdcaa |
| 클래스명·타입·namespace | #4ec9b0 |
| 숫자 | #b5cea8 |
| 속성명·변수·어노테이션 | #9cdcfe |
| 기본 텍스트 | #d4d4d4 |

- `text-shadow: none` 로 흐림 제거. 토큰 배경 제거.

## §2. 검증 / 영향

| 항목 | 결과 |
|------|------|
| 빌드 | ✅ 통과 |
| 적용 범위 | `.kisa-code-block`(공통 CodeBlock) → 학습/라이브러리 코드 전체 |
| 라이트 모드 | 🟢 무영향 (다크 셀렉터 한정) |
| 배포 | 🟡 src 변경 → Cloud Run 재배포 |

---

**완료 일시**: 2026-06-16 KST
**연관 문서**: REBUILD46(LibraryFab Prism), REBUILD49(코드 복사), `CodeBlock.jsx`
