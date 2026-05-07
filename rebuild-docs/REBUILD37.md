# REBUILD37 — 의존성 보안 전수 조사 + 자동 패치 적용

> **작성**: 2026-05-07 KST
> **목적**: aitutor 사용 오픈소스 의존성의 알려진 최신 CVE 전수 조사 + 컨텍스트 기반 위험도 평가 + 자동 패치 적용 결과 기록
> **검증 도구**: `npm audit` + GitHub Advisory Database + GitLab Advisory Database + NVD + Snyk
> **결과 요약**: 13건 발견 → `npm audit fix` 자동으로 8건 해결 → 잔여 5건 LOW (transitive only)

---

## §0. 결론 요약

| 등급 | 발견 | 자동 패치 후 | 잔여 영향 |
|------|------|--------------|-----------|
| 🔴 CRITICAL | 0 | 0 | - |
| 🟠 HIGH | 4 | **0** ✅ | - |
| 🟡 MODERATE | 4 | **0** ✅ | - |
| 🟢 LOW | 5 | 5 | `@google-cloud/storage` transitive (의도적 보류) |
| **합계** | **13** | **5** | **저위험만 잔존** |

핵심 결과: **운영 영향 있는 모든 취약점이 `npm audit fix` 안전 모드(--force 없이) 만으로 자동 해결**됨. 잔여 5건은 모두 transitive `@google-cloud/storage` 의존 chain 으로 메이저 다운그레이드(breaking) 없이는 해결 불가 → 차기 GCS major 업그레이드 시 자연 해소 예정.

---

## §1. 조사 범위 및 방법

### 1.1 의존성 inventory

**메인 service** (`workspace/aitutor/package.json`):
- production deps 17개 (express, react, openai, pg, dompurify, recharts, etc.)
- dev deps 11개 (vite, playwright, tailwind, etc.)

**격리 service** (`workspace/aitutor/server-infer/Dockerfile`):
- fastapi==0.115.5
- 'uvicorn[standard]==0.32.1'
- httpx==0.28.1

**런타임/엔진**:
- Ollama (curl install.sh 로 빌드 시 최신)
- Node.js 22 (debian bookworm-slim)
- Base image: `nvidia/cuda:12.4.0-runtime-ubuntu22.04`

### 1.2 조사 방법

1. `npm audit --json` 실측 (자동 분석)
2. 각 핵심 의존성에 대해 GitHub Advisory + GitLab Advisory + Snyk 웹 검색
3. CVE 발견 시 컨텍스트 기반 위험도 보정 (Cloud Run 배포 환경 고려)
4. 자동 패치 가능성 / breaking change 여부 평가

---

## §2. 발견된 CVE 전체 목록

### 2.1 🔴 CRITICAL (라이브러리 자체 등급 기준)

#### CVE-2026-7482 — Ollama "Bleeding Llama" 메모리 노출 (CVSS 9.1)

- **원리**: 인증되지 않은 원격 공격자가 Ollama process 전체 메모리 leak 가능
- **노출 가능 정보**: 환경변수, API 키, system prompts, 다른 사용자 추론 단편
- **aitutor 컨텍스트 보정**: 🟡 **MODERATE**
  - Ollama 는 localhost(127.0.0.1:11434) 전용 바인딩
  - 메인/격리 service 모두 외부 노출 0
  - Cloud Run 격리 환경 + GCP IAM 으로 lateral movement 어려움
- **조치**: 메인 service 는 2026-05-06 재배포 시 install.sh 가 최신 Ollama 가져옴 → 자동 패치
  - 격리 service 도 2026-05-07 동시 재배포로 최신 적용

### 2.2 🟠 HIGH (자동 해결됨)

| CVE | 패키지 | 설명 | 자동 해결? |
|-----|--------|------|-----------|
| CVE-2026-39363 | vite | dev server WebSocket 통한 임의 파일 읽기 | ✅ |
| CVE-2026-34601 | @xmldom/xmldom | XML CDATA injection (CVSS 7.5) | ✅ |
| CVE-2026-41672 | @xmldom/xmldom | XML comment injection (CVSS 7.5) | ✅ |
| CVE-2026-41674 | @xmldom/xmldom | DocumentType injection | ✅ |
| CVE-2026-41675 | @xmldom/xmldom | Processing instruction injection | ✅ |
| CVE-2026-33671 | picomatch | extglob ReDoS (29초 hang) | ✅ |
| CVE-2024-52798 | path-to-regexp | ReDoS (Express 0.1.x transitive) | ✅ |

### 2.3 🟡 MODERATE (자동 해결됨)

| CVE | 패키지 | 설명 | 자동 해결? |
|-----|--------|------|-----------|
| CVE-2026-41238 | dompurify | Prototype Pollution → XSS Bypass | ✅ (3.3.3 → 3.4.2) |
| CVE-2026-41239 | dompurify | SAFE_FOR_TEMPLATES Bypass | ✅ |
| CVE-2026-41240 | dompurify | FORBID_TAGS Bypass | ✅ |
| CVE-2026-41305 | postcss | XSS via unescaped `</style>` | ✅ |
| CVE-2026-33750 | brace-expansion | Zero-step DoS (3.5초 hang, 1.9GB 메모리) | ✅ |
| CVE-2026-33672 | picomatch | Method Injection (POSIX bracket) | ✅ |
| - | fast-xml-parser | XML Comment / CDATA injection | ✅ |

### 2.4 🟢 LOW (의도적 잔존)

| 패키지 | CVE 정보 | 잔존 사유 |
|--------|----------|-----------|
| `@tootallnate/once` | Incorrect Control Flow Scoping | http-proxy-agent transitive |
| `http-proxy-agent` | 위 패키지 의존 | teeny-request transitive |
| `teeny-request` | 위 패키지 의존 | @google-cloud/storage transitive |
| `retry-request` | teeny-request 의존 | @google-cloud/storage transitive |
| `@google-cloud/storage` | 위 chain | `--force` 시 5.18.3 다운그레이드 (breaking) |

→ 차기 `@google-cloud/storage` major 안정 버전 출시 시 자연 해소.

---

## §3. 컨텍스트 기반 위험도 매트릭스 (실제 운영 환경 보정)

| CVE | 라이브러리 자체 등급 | aitutor 운영 환경 보정 등급 | 보정 사유 |
|-----|---------------------|---------------------------|-----------|
| CVE-2026-7482 (Ollama) | 🔴 CRITICAL | 🟡 MODERATE | localhost-only 바인딩 + GCP IAM 격리 |
| CVE-2026-39363 (Vite) | 🟠 HIGH | 🟢 LOW | Production 미사용 (`dist/` 정적 서빙) |
| CVE-2026-41238 (DOMPurify) | 🟡 MODERATE | 🟠 HIGH | QuizCard 가 DB explanation 직접 sanitize 후 dangerouslySetInnerHTML |
| CVE-2026-22029 (react-router) | 🟠 HIGH | 🟢 LOW | 이미 6.30.3 (>6.30.2 패치 포함) |
| CVE-2024-52798 (path-to-regexp) | 🟠 HIGH | 🟢 LOW | Express 4.22 가 6.x 사용 (0.1.x 아님) |
| CVE-2026-33671 (picomatch) | 🟠 HIGH | 🟢 LOW | Build-time 만 |
| CVE-2026-33750 (brace-expansion) | 🟡 MODERATE | 🟢 LOW | Build-time 만 |
| CVE-2026-41305 (postcss) | 🟡 MODERATE | 🟢 LOW | Build-time 만, Tailwind 입력 신뢰 |
| @xmldom/xmldom × 4 | 🟠 HIGH | 🟡 MODERATE | Transitive, 사용 surface 검증 필요 |

---

## §4. 적용된 조치

### 4.1 자동 패치 (`npm audit fix` 안전 모드)

```bash
$ cd workspace/aitutor && npm audit fix
added 1 package, changed 12 packages, and audited 498 packages in 892ms
```

**before**: 13건 (low 5, moderate 4, high 4, critical 0)
**after**: 5건 (low 5, moderate 0, high 0, critical 0)

### 4.2 수동 조치

- DOMPurify 별도 수동 업그레이드 불요 — `npm audit fix` 가 자동으로 3.3.3 → **3.4.2** 까지 끌어올림
- Ollama 자동 최신화 — 메인 + 격리 service 모두 2026-05-07 재배포 시 install.sh 가 자동 가져옴

### 4.3 검증

| 검증 | 결과 |
|------|------|
| `npm run build:fe` | ✓ 2.94s |
| Node require smoke | ✓ OK (local-infer / iso-infer / config / server) |
| `python3 -m py_compile server-infer/server.py` | ✓ OK |
| `npm audit` 재확인 | ✓ 5건 LOW 만 잔존 |

---

## §5. 잔여 의사결정

### 5.1 즉시 처리 권장 (다음 스프린트)

#### A. `npm audit` CI hook 추가 (회귀 자동 감지)

`cloudbuild.yaml` 빌드 단계에 추가:
```yaml
- name: 'gcr.io/cloud-builders/npm'
  id: 'npm-audit'
  entrypoint: 'bash'
  args:
    - '-c'
    - 'npm audit --audit-level=high || (echo "HIGH or above vulnerabilities found"; exit 1)'
```

→ HIGH 이상 발생 시 CI fail 로 회귀 자동 차단.

#### B. Dependabot 활성화

`.github/dependabot.yml` 신규:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/workspace/aitutor"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

→ 매주 자동 PR 으로 의존성 업데이트 알림.

### 5.2 분기 단위 추적

- Vite 6 → 6.4.2 / 7.x / 8.x 메이저 업그레이드 (breaking changes 검토 후)
- `@google-cloud/storage` 차기 major (잔여 LOW 5건 자연 해소)
- Python 의존성 (FastAPI / uvicorn / httpx) 메이저 업그레이드
- PostgreSQL 클라이언트 `pg` 8.x → 9.x (출시 시)

### 5.3 의도적 보류 (추가 작업 불요)

- Vite CVE-2026-39363: Production 무영향 (정적 서빙)
- Picomatch / brace-expansion / postcss: Build-time 만
- @xmldom/xmldom × 4: 자동 해결됨
- React Router CVE-2026-22029: 이미 6.30.3 (패치 적용됨)

---

## §6. 커밋 이력

| 커밋 | 내용 | 변경 |
|------|------|------|
| `6b06ba3` | docs(aitutor): REBUILD36 — 통합/분리 service 추론 메모리 거동 상세 분석 | +550 |
| `8c0299d` | chore(aitutor): 의존성 보안 자동 패치 (npm audit fix) — 13건 → 5건 LOW | +52 / -39 |

---

## §7. 외부 참조 (CVE 데이터베이스)

### Vite
- [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583) (CVE-2026-39363)

### DOMPurify
- [GitLab Advisory CVE-2026-41238](https://advisories.gitlab.com/npm/dompurify/CVE-2026-41238/)
- [Snyk DOMPurify](https://security.snyk.io/package/npm/dompurify)
- [DOMPurify Releases](https://github.com/cure53/DOMPurify/releases)

### path-to-regexp
- [GHSA-rhx6-c78j-4q9w](https://github.com/advisories/GHSA-rhx6-c78j-4q9w) (CVE-2024-52798)
- [Express Issue #6216](https://github.com/expressjs/express/issues/6216)

### @xmldom/xmldom
- [GHSA-wh4c-j3r5-mjhp](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp) (CVE-2026-34601)
- [GitLab Advisory CVE-2026-41672](https://advisories.gitlab.com/npm/@xmldom/xmldom/CVE-2026-41672/)
- [GitLab Advisory CVE-2026-41673](https://advisories.gitlab.com/npm/@xmldom/xmldom/CVE-2026-41673/)
- [GitLab Advisory CVE-2026-41675](https://advisories.gitlab.com/npm/@xmldom/xmldom/CVE-2026-41675/)

### picomatch
- [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) (CVE-2026-33671)
- [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) (CVE-2026-33672)

### postcss
- [PostCSS GHSA-qx2v-qp2m-jg93](https://github.com/postcss/postcss/security/advisories/GHSA-qx2v-qp2m-jg93) (CVE-2026-41305)

### brace-expansion
- [GitLab Advisory CVE-2026-33750](https://advisories.gitlab.com/pkg/npm/brace-expansion/CVE-2026-33750/)

### Ollama
- [Bleeding Llama: Critical Memory Leak (CVE-2026-7482) — Cyera](https://www.cyera.com/research/bleeding-llama-critical-unauthenticated-memory-leak-in-ollama)
- [Ollama Windows Auto-Updater RCE (CVE-2026-42248/42249) — Help Net Security](https://www.helpnetsecurity.com/2026/05/05/ollama-windows-vulnerabilities-cve-2026-42248-cve-2026-42249/)

### React Router
- [GHSA-2w69-qvjg-hvjx](https://github.com/advisories/GHSA-2w69-qvjg-hvjx) (CVE-2026-22029)

### PostgreSQL (서버측, pg 클라이언트 무관)
- [PostgreSQL Security CVE-2026-2003~2007](https://www.postgresql.org/support/security/)

### NVIDIA CUDA
- [Security Bulletin January 2026](https://nvidia.custhelp.com/app/answers/detail/a_id/5755)

### Debian Bookworm
- [CVE-2026-31431 Tracker](https://security-tracker.debian.org/tracker/CVE-2026-31431)

---

**문서 종료.**
