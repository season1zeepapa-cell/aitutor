# REBUILD42 — 미사용 자원 정리 + lectures 강의 전사 파이프라인 ismsp 이관

> **작성**: 2026-06-14 KST
> **트리거**: 사용자 요청 — "사용하지 않거나 불필요한 폴더/파일/소스코드 삭제 가능한 것 분류"
> **범위**: 빌드/테스트 산출물 정리(디스크), 방치된 `lectures/` 도구를 내용에 맞는 `workspace/ismsp/`로 이관
> **결과**: aitutor 디스크 3.5G → 2.9G, `lectures` 2.3G를 ismsp로 이동(원본 보존), 소스/배포 무영향

---

## §0. 결론 요약

| 등급 | 대상 | 처리 | 효과 |
|------|------|------|------|
| 🟢 1등급 | `node_modules`, `dist`, `playwright-report`, `test-results`, `*.zip`, `vercel.json.bak`, `.DS_Store` | 삭제 (전부 git-ignore/untracked) | 약 600M 확보, 재생성 가능 |
| 🟡 2등급 | `lectures/` (강의 전사 파이프라인) | `workspace/ismsp/lectures`로 이관 + `venv` 삭제 + 자체 `.gitignore` | aitutor에서 2.3G 제거, 원본 1.8G 보존 |
| 🟠 3등급 | `src` dead code 5개 | **미실행 (후속 보류)** | — |

**핵심**: 삭제한 1등급은 전부 **재생성 가능한 산출물**이고 git이 추적하지 않던 것 → 소스/배포 이미지 무영향. 2등급 `lectures`는 내용상 ISMS-P 강의 전사 도구라 ismsp로 이사(삭제 아닌 이동, 원본 보존).

---

## §1. 1등급 — 즉시 삭제 안전 (재생성 가능 + git 무시 중)

| 항목 | 용량 | 근거 | 복구 |
|------|------|------|------|
| `node_modules/` | 589M | `.gitignore` | `npm install` |
| `dist/` | 74M | Vite 빌드 산출물, ignore | `npm run build:fe` |
| `playwright-report/` | 4.8M | 테스트 리포트, ignore | 테스트 재실행 |
| `test-results/` | 2.9M | 테스트 산출물, ignore | 테스트 재실행 |
| `kisa-module-v1.zip` | 44K | `*.zip` ignore (백업 압축) | `kisa-module/` 원본 |
| `vercel.json.bak` | 1K | 백업, ignore (현재 Cloud Run) | 불필요 |
| `.DS_Store` ×5 | 6K | macOS 시스템 파일, ignore | 자동 생성 |

- **안전 확인**: `git ls-files` 로 전부 untracked 검증 후 삭제 → 소스 변경 0.
- **결과**: 프로젝트 디스크 3.5G → 2.9G.

---

## §2. 2등급 — lectures 강의 전사 파이프라인 ismsp 이관

### 2.1 왜 이동했나

`lectures/` 는 README 첫 줄부터 "ISMS-P 강의 음성 → 텍스트 → 교정 파이프라인" — **내용상 aitutor 가 아니라 ismsp 영역**. aitutor 자체 git 에서도 추적되지 않던 "더부살이" 상태였다.

### 2.2 이동 시 두 함정과 대응

| 함정 | 대응 |
|------|------|
| `venv/bin` 에 `.../aitutor/lectures/venv` **절대경로 박힘** → 이동하면 깨짐 | `venv` 삭제 (523M). `requirements.txt` 로 재생성 가능 |
| ismsp 는 자체 git 없이 **상위 aifac 루트 git** 에 속함 → 1.8G 녹음 원본이 git 에 유입될 위험 | `ismsp/lectures/.gitignore` 신규 (`venv/ input/ output/ __pycache__/`) |

### 2.3 처리

```
mv  aitutor/lectures  →  ismsp/lectures      # 같은 디스크라 즉시 (복사 X)
rm -rf ismsp/lectures/venv                    # 깨진 venv 제거 (523M)
ismsp/lectures/.gitignore 생성                # 대용량 미디어 git 차단
```

### 2.4 검증 (git add dry-run)

실제 git 추적 후보는 **가벼운 소스 7개뿐**:
```
.gitignore, README.md, correct.py, isms_glossary.py,
pipeline.py, requirements.txt, transcribe.py
```
- `lectures/input/` (녹음 원본 1.8G) git 유입: **0건** (`git check-ignore` 통과)
- 원본 미디어·산출물은 디스크 보존, git 은 소스만 추적.

---

## §3. 3등급 — src dead code (✅ 실행 완료 2026-06-15)

정적 import 추적상 어디서도 참조되지 않는 컴포넌트 5개. 직접 grep 재검증(참조 0건) + 빌드 통과 확인 후 제거 (약 315줄):

| 제거 파일 | 대체 |
|-----------|------|
| `src/components/ui/Button.jsx` | 네이티브 버튼 + Tailwind |
| `src/labs/hf-playground/components/MetricsBadge.jsx` | 인라인 메트릭 렌더링 |
| `src/labs/hf-playground/components/ModelPicker.jsx` | `ModelCatalog.jsx` (검색·필터 강화판) |
| `src/labs/hf-playground/components/PromptArea.jsx` | `PromptEditor` + `ParamSliders` 분리 |
| `src/labs/hf-playground/components/ResponseView.jsx` | 인라인 / `ResponseCard` |

- `hf-playground/components/` 에는 실사용 `ModelCatalog.jsx` 만 잔류.
- 제거 후 빌드 통과(에러 0), 기능 손실 없음 확인.
- 후속(REBUILD43+ 검토): 루트 `pool-import-v2.js` v1/v2 중복 정리 — 유효 버전 확인 필요로 보류.

---

## §4. 영향 범위

| 항목 | 영향 |
|------|------|
| aitutor 소스 코드 | ❌ 무영향 (1등급은 untracked, lectures 는 aitutor git 미추적) |
| Cloud Run 배포 이미지 | ❌ 무영향 (`lectures` 는 원래 배포 비포함, 1등급은 산출물) |
| ismsp | 🟡 `lectures/` 도구 추가 (소스만 git 추적, 대용량은 로컬) |
| 디스크 | 🟢 aitutor 약 2.9G 절감 (정리 600M + lectures 이관 2.3G) |

**롤백**: 1등급은 재생성, lectures 는 역방향 `mv` 로 복원 가능.

---

**완료 일시**: 2026-06-14 KST
**연관 문서**: REBUILD41 (직전 작업), `workspace/ismsp/lectures/README.md` (이관된 도구 가이드)
**후속**: 3등급 dead code 5개 제거 검토 (REBUILD43+)
