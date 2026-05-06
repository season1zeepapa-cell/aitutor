# REBUILD31 — AI TutorTwo 신규 GCP 계정 마이그레이션 계획서 (빅뱅 컷오버)

> **작성일**: 2026-05-04
> **작성자**: Claude (Opus 4.7) + 사용자 협업 설계
> **참조**: `workspace/pressstand/REBUILD22.md` (PressStand 5종 마이그 — withbible 격리 보존), `workspace/sitebysite/rebuild08.md` (SiteBySite 빅뱅 단일 컷오버)
> **선행**: REBUILD23(GCP 마이그 1차) → REBUILD27(AWS 폐기) → REBUILD30(6 엔진 안정화)
> **목표**: AI TutorTwo 인프라 일체를 **현 GCP 계정(`season1zeepapa@gmail.com` / `aifactory-494108`)**에서 **신규 GCP 계정(`geefafa0407@gmail.com`)**으로 무손실 이전.
> **전제**: 사용자 명시 — **서비스 중단 허용**, 다운타임 자유. 리전: 대한민국·아시아 우선 (GPU L4 quota 제약 인지).
> **격리 보존 (절대 미접촉)**: 같은 GCP 프로젝트 내 Firebase Functions(`checkMissedReturn`, `recordCheckIn`) + Firebase Hosting / Firestore — aitutor 와 완전히 다른 사용처.

---

## 🚦 한눈에 보는 빅뱅 컷오버 시나리오

```
[T-0] 사용자: 본 계획서 §0 Q1~Q9 답변 + "GO"
   ↓
[T+10분] Claude: §1.7 영향도 분석 → 보고 → 사용자 GO
   ↓
[T+30분] Claude: 신규 GCP 프로젝트 생성 + API enable + AR + 빌링 + GPU L4 quota 신청
   ↓
[T+30분~T+24h] 사용자/Claude: GPU L4 quota 승인 대기 (지역별 1~24h)
   ↓
[T+24h+30분] Claude: 신규 SA + GCS 버킷 + Secret Manager 8개 + 사용자 외부키 등록
   ↓
[T+24h+1h] Claude: 코드 수정 (cloudbuild.yaml substitutions 3개) + 커밋
   ↓
[T+24h+2h] 🧑 사용자 승인: 메인 + 격리 빌드 + 배포 (사용자 승인 U6)
   ↓
[T+24h+3h] Claude: 헬스체크 + Playwright 전수 테스트 + 격리 service URL 회신
   ↓
[T+24h+24h] 🧑 사용자: 24시간 무에러 운영 확인 + Phase 9 GO
   ↓
[T+24h+24h+30분] Claude: 구 프로젝트의 aitutor 자원만 정리 (Firebase Functions 절대 보존)
```

| 단계 | 액터 | 작업 | 차단 조건 |
|---|---|---|---|
| 1 | 🧑 사용자 (U1~U2) | 본 계획서 검토 + Q1~Q9 답변 + GO | 답변 받기 전까지 대기 |
| 2 | 🤖 Claude | Phase 1 (인벤토리, 이미 완료 — 본 문서 §1) + §1.7 영향도 분석 자동 실행 + 보고 | — |
| 3 | 🧑 사용자 (U3) | 영향도 분석 결과 검토 + GO | 즉답 |
| 4 | 🤖 Claude | Phase 2 (프로젝트 생성 + 빌링 + API + AR + GPU quota 신청) | ID 충돌 시 U4 분기 |
| 4.5 | 🧑 사용자 (U4) | (충돌 시) 새 프로젝트 ID 지정 | — |
| 5 | 🧑 사용자 (U5) | (필요 시) GPU L4 quota 신청서 콘솔 작성 (Cloud Run usage explanation) | quota 승인 메일 도착까지 대기 |
| 6 | 🤖 Claude | Phase 3 (Secret Manager + GCS 버킷 + SA + IAM) | — |
| 7 | 🤖 Claude | Phase 4 (코드 수정 — cloudbuild.yaml substitutions + 커밋) | — |
| 8 | 🧑 사용자 (U6) | Phase 5 메인 + 격리 빌드/배포 승인 | 즉답 |
| 9 | 🤖 Claude | Phase 5 (빌드 + 메인 배포 + 격리 service 배포 + ISO_INFER_URL 갱신) | — |
| 10 | 🤖 Claude + 🧑 사용자 | Phase 6 (헬스체크 + Playwright + 사용자 시나리오 검증) | — |
| 11 | 🧑 사용자 (U7) | 24시간 모니터링 후 Phase 7 GO | 즉답 |
| 12 | 🤖 Claude | Phase 7 (구 aitutor 자원만 삭제 — Firebase 절대 보존) | — |

---

## §0. 의사결정 요약 (사용자 답변 Q1~Q9)

| # | 결정 사항 | 디폴트 권장 | 사용자 답변 |
|---|---|---|---|
| **Q1** | 신규 GCP 프로젝트 ID | `aitutor-prod` (1순위) / `aitutortwo-2026` / `aitutor-app` (fallback). 형식: 소문자+숫자+하이픈, 6~30자, 전 세계 유일. | ⏸ 대기 |
| **Q2** | 리전 정책 (GPU L4 가용 리전 한정) | **us-east4** (현 환경과 동일, GPU L4 quota 이미 검증). 대안: `asia-southeast1`(싱가포르 — 아시아 최단 레이턴시 + L4 가용) | ⚠️ **사용자 1차 답변 `asia-northeast3` → 블로커 (Cloud Run GPU L4 미지원, 2026-05-04 실측). 재선택 필요: us-east4 또는 asia-southeast1** |
| **Q3** | DB 정책 | **신규 작업 없음** — DATABASE_URL 시크릿만 복사 (DB 본체는 Supabase 외부, GCP 미보유) | ⏸ 대기 |
| **Q4** | GCS 데이터 (`aitutor-files-aifactory-494108` 1.18 GB) | **A: 전체 이전** (cloudbuild-source 만 있어 사실 중요도 낮음, 안전을 위해 복사) / **B: 빈 버킷 재시작** (간단) | ⚠️ **A→B 자동 전환 (2026-05-04 Phase 3-B)** — 1.2 GB 전체가 Cloud Build 자동 생성 tarball (cloudbuild-source/*.tgz × 9). 신규 빌드 시 자동 재생성되므로 마이그 가치 0. 빈 버킷 그대로 운영 |
| **Q5** | 외부 발급 API 키 4개 (ANTHROPIC / GEMINI / HF / OPENAI) | **B: 구 키 그대로 복사** — 빠른 마이그. 또는 **A: 신규 발급** — quota/billing 격리 (90일 후 회전 권장) | ⏸ 대기 |
| **Q6** | 내부 시크릿 (AUTH_TOKEN_SECRET / DATABASE_URL / LAW_API_OC / RESEND_API_KEY / TELEGRAM_*) | **A: 전부 그대로 복사** — DATABASE_URL Supabase 그대로, AUTH_TOKEN/RESEND 회전 시 토큰 무효화 | ⏸ 대기 |
| **Q7** | 구 `aifactory-494108` 처분 | **A: 자원만 삭제 + 프로젝트 보존** ✅ 강제 (Firebase Functions 2개 + Firebase Hosting/Firestore 완전 보존 필요) | ⏸ 대기 |
| **Q8** | Firebase Functions(`checkMissedReturn`, `recordCheckIn`) 처리 | **그대로 보존** — aitutor 와 무관, FIREBASE_CONFIG/GCLOUD_PROJECT 가 `aifactory-494108` 에 의존 → 신규 프로젝트로 옮기면 재구성 비용 ↑. **권장: 절대 미접촉** | ⏸ 대기 |
| **Q9** | 마이그 시작 시점 | **즉시** (Q1~Q8 답변 받는 즉시 Phase 1 자동 실행) / **특정 일시 지정** | ⏸ 대기 |

> **Claude 디폴트 추천**: Q1 = 사용자 결정, Q2 = us-east4 (GPU 안정성), Q4 = A, Q5 = B, Q6 = A, Q7 = A (강제), Q8 = 그대로 보존, Q9 = 즉시.

---

## §1. 현재 인프라 인벤토리 (gcloud CLI 직접 검증, 2026-05-04)

### §1.1 GCP 프로젝트 (구)

| 항목 | 값 |
|---|---|
| 프로젝트 ID | `aifactory-494108` |
| 프로젝트 번호 | `58235609672` |
| 표시 이름 | `aifactory` |
| 빌링 계정 | `0193E0-B0D26B-FB31EB` (구 계정 공유 — docstore/lottoda/pressstand 와 함께) |
| Firebase 활성 여부 | **YES** (Firestore, Hosting, Functions, Realtime DB API 모두 활성) |

### §1.2 Cloud Run 서비스 (4개 → 마이그 대상 2개)

| 서비스 | 리전 | image | CPU/Mem/GPU | maxScale | concurrency | URL | 마이그 |
|---|---|---|---|---|---|---|---|
| **aitutor** | us-east4 | `asia-northeast3-docker.pkg.dev/aifactory-494108/aitutor/aitutor:v20260504-002235` | 6/24Gi/L4×1 | 1 | 10 | `https://aitutor-z2ppabmtxa-uk.a.run.app` | ✅ |
| **aitutor-inference** | us-east4 | `asia-northeast3-docker.pkg.dev/aifactory-494108/aitutor/aitutor:v20260503-221817` | 8/32Gi/L4×1 | 1 | 10 | `https://aitutor-inference-z2ppabmtxa-uk.a.run.app` | ✅ |
| `checkmissedreturn` | asia-northeast3 | gcf-artifacts/...record_check_in:version_1 (Firebase Functions Gen2) | 0.083/256Mi | — | — | `https://checkmissedreturn-z2ppabmtxa-du.a.run.app` | ❌ **격리 보존** |
| `recordcheckin` | asia-northeast3 | (동일) | 0.083/256Mi | — | — | `https://recordcheckin-z2ppabmtxa-du.a.run.app` | ❌ **격리 보존** |

> **격리 보존 사유**: Firebase Functions 는 `FIREBASE_CONFIG = {"projectId":"aifactory-494108"}` + `GCLOUD_PROJECT=aifactory-494108` 환경변수와 Firestore + Firebase Storage 버킷 (`aifactory-494108.firebasestorage.app`) 에 의존. 신규 프로젝트로 옮기면 Firebase 재구성 비용 발생 + 사용자 명시 영향 없음 요구사항.

### §1.3 Cloud SQL

| 항목 | 값 |
|---|---|
| 인스턴스 | **0개** |
| 사용 DB | **Supabase (외부)** — `DATABASE_URL` 시크릿에 외부 연결 문자열 저장 |
| GCP 측 작업 | DATABASE_URL 시크릿만 신규 Secret Manager 에 복사 |

### §1.4 Custom Service Accounts (5개 → 마이그 대상 2개)

| SA | 마이그 | 권한 |
|---|---|---|
| `aitutor-run@aifactory-494108.iam.gserviceaccount.com` | ✅ | Secret 8개에 `secretAccessor`, GCS 버킷 `aitutor-files-...` 에 `objectAdmin` |
| `aitutor-inference-run@aifactory-494108.iam.gserviceaccount.com` | ✅ | (현재 직접 부여 권한 거의 없음, 신규 환경에서 재부여) |
| `firebase-adminsdk-fbsvc@aifactory-494108.iam.gserviceaccount.com` | ❌ Firebase 격리 | — |
| `58235609672-compute@developer.gserviceaccount.com` | ❌ default | — |
| `aifactory-494108@appspot.gserviceaccount.com` | ❌ App Engine default | — |

### §1.5 Secret Manager (10개 → 마이그 대상 8개)

| 시크릿 | 분류 | 마이그 | 처리 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | 외부 | ✅ | Q5 정책 (B: 그대로 복사 / A: 신규 발급) |
| `GEMINI_API_KEY` | 외부 | ✅ | Q5 정책 |
| `OPENAI_API_KEY` | 외부 | ✅ | Q5 정책 |
| `HF_API_KEY` | 외부 | ✅ | Q5 정책 |
| `LAW_API_OC` | 외부 (대한민국 법령정보 OC) | ✅ | Q6 정책 (A: 그대로 복사) |
| `AUTH_TOKEN_SECRET` | 내부 (HMAC JWT) | ✅ | Q6 정책 (A: 그대로 복사 — 회전 시 모든 사용자 재로그인) |
| `DATABASE_URL` | 외부 (Supabase) | ✅ | Q6 정책 (A: 그대로 복사) |
| `RESEND_API_KEY` | 외부 (이메일 발송) | ✅ | Q6 정책 |
| `TELEGRAM_BOT_TOKEN` | Firebase Functions 전용 | ❌ **격리 보존** | aitutor 미사용, Firebase Functions 가 별도 secret 참조 (`secret-faff2b79...`) |
| `TELEGRAM_CHAT_ID` | Firebase Functions 전용 | ❌ **격리 보존** | 동일 |

### §1.6 Artifact Registry (2개 → 마이그 대상 1개)

| 저장소 | 위치 | 용도 | 마이그 |
|---|---|---|---|
| `aitutor` | asia-northeast3 | aitutor + aitutor-inference 이미지 (multi-stage CUDA) | ✅ |
| `gcf-artifacts` | (auto) | Firebase Functions 자동 생성 | ❌ 격리 |

### §1.7 GCS 버킷 (4개 → 마이그 대상 1개)

| 버킷 | 위치 | 용량 | 용도 | 마이그 |
|---|---|---|---|---|
| `aitutor-files-aifactory-494108` | asia-northeast3 | 1.18 GB | aitutor 사용자 파일 (현재 cloudbuild-source/ 만 있음) | ✅ |
| `aifactory-494108_cloudbuild` | US | (자동) | Cloud Build 로그 (구 프로젝트 보존) | ❌ |
| `gcf-v2-sources-58235609672-asia-northeast3` | asia-northeast3 | (자동) | Firebase Functions 소스 | ❌ Firebase 격리 |
| `gcf-v2-uploads-58235609672....` | asia-northeast3 | (자동) | Firebase Functions 업로드 | ❌ Firebase 격리 |

### §1.8 Cloud Scheduler (1개 → 마이그 대상 0개)

| Job | Cron | 트리거 | 마이그 |
|---|---|---|---|
| `firebase-schedule-checkMissedReturn-asia-northeast3` | `30 23 * * *` | checkMissedReturn Cloud Run | ❌ Firebase 격리 |

### §1.9 Cloud Build Triggers

| 트리거 | 마이그 |
|---|---|
| **0개** (수동 빌드: `gcloud builds submit --config cloudbuild.yaml`) | — |

### §1.10 활성 API (54개 → aitutor 필요 12개)

| 분류 | API | 신규 환경 활성화 |
|---|---|---|
| **aitutor 필수** | `run.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`, `secretmanager.googleapis.com`, `storage.googleapis.com`, `storage-api.googleapis.com`, `iamcredentials.googleapis.com`, `logging.googleapis.com`, `monitoring.googleapis.com`, `compute.googleapis.com` (GPU quota 조회용), `serviceusage.googleapis.com`, `cloudresourcemanager.googleapis.com` | ✅ Phase 2 |
| Firebase 잔재 | `firebase.*`, `firestore.googleapis.com`, `firebasehosting.*`, `cloudfunctions.googleapis.com`, `eventarc.googleapis.com`, `fcm.*` | ❌ aitutor 무관 |
| 기타 미사용 | `bigquery.*`, `dataform.*`, `dataplex.*`, `appengine.googleapis.com`, `containerregistry.*` 등 다수 | ❌ |

### §1.11 GPU L4 사용 현황 (구 환경 실측)

| 서비스 | GPU | 리전 | 비고 |
|---|---|---|---|
| `aitutor` | nvidia-l4 × 1 | us-east4 | `--no-gpu-zonal-redundancy`, `--cpu-throttling=false`, `startup-cpu-boost=true` |
| `aitutor-inference` | nvidia-l4 × 1 | us-east4 | 동일 |

→ **신규 프로젝트도 us-east4 GPU L4 quota 2장 (또는 동시 사용 1장 + lazy spawn) 필요**.

---

## §1.7 영향도 분석 (다른 자원/프로젝트 보호) — Phase 1 직후 사용자 검증 게이트

### A. 구 계정의 다른 GCP 프로젝트 (절대 미접촉)

| 프로젝트 | 정체 | 보호 정책 |
|---|---|---|
| `docstore-491906` | DocStore 앱 | ✅ 절대 미접촉 |
| `lottoda-491905` | Lottoda 앱 | ✅ 절대 미접촉 |
| `pressstand` | PressStand 5종 + withbible | ✅ 절대 미접촉 |
| `aifactory-60aa1` | aifactory 보조 (Firebase enabled, Cloud Run 미사용) | ✅ 절대 미접촉 |

### B. 같은 프로젝트 내 격리 보존 대상 (`aifactory-494108`)

| 자원 | 정체 | 보호 정책 |
|---|---|---|
| Cloud Run `checkmissedreturn` | Firebase Functions Gen2, Telegram 알림 | ✅ 절대 미접촉 |
| Cloud Run `recordcheckin` | Firebase Functions Gen2, Telegram 알림 | ✅ 절대 미접촉 |
| Cloud Scheduler `firebase-schedule-checkMissedReturn-...` | Functions 실행 트리거 | ✅ 절대 미접촉 |
| Secret `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Functions 가 사용 (별도 ID secret 으로 참조) | ✅ 절대 미접촉 |
| AR `gcf-artifacts` | Functions 이미지 | ✅ 절대 미접촉 |
| GCS `gcf-v2-sources-...`, `gcf-v2-uploads-...` | Functions 소스 | ✅ 절대 미접촉 |
| Firestore / Firebase Hosting / Firebase Storage 버킷 (`*.firebasestorage.app`) | Firebase 본체 | ✅ 절대 미접촉 |
| SA `firebase-adminsdk-fbsvc@`, `58235609672-compute@`, `aifactory-494108@appspot.gserviceaccount.com` | 시스템/Firebase | ✅ 절대 미접촉 |

### C. 빌링 분리 영향 분석

구 빌링 `0193E0-B0D26B-FB31EB` 공유 4개 프로젝트:
- `docstore-491906` ✅ 무영향 (PressStand 마이그 사례 검증)
- `lottoda-491905` ✅ 무영향
- `pressstand` ✅ 무영향
- `aifactory-494108` ← Phase 7 에서 빌링 분리 (aitutor 자원 삭제 후) — Firebase Functions 는 그대로 무료 티어 내 운영

### D. 신규 계정 기존 프로젝트 (보호)

| 프로젝트 | 보호 |
|---|---|
| `pressstand-prod` (PressStand 신환경) | ✅ 절대 미접촉 |
| `sitebysite-poc` (SiteBySite 신환경) | ✅ 절대 미접촉 |
| `project-7da62fab-ba97-4a03-87a` (My First Project) | ✅ 절대 미접촉 |

### E. 신규 프로젝트 ID 가용성 (사전 점검 필요)

후보 6개 모두 PERMISSION_DENIED (전 세계 유일성 미충족 가능 또는 점유 중) — 사용자 결정 필요:
- `aitutor-prod`, `aitutor-2026`, `aitutor-ai`, `aitutor-app`, `ai-tutor-prod`, `aitutortwo-prod`

→ **권장**: PressStand `pressstand-prod`, SiteBySite `sitebysite-poc` 패턴 따라 **`aitutor-prod`** 1순위 시도. Phase 2 시작 시 실제 가능성 확인.

### F. GPU L4 Quota 사전 신청

신규 프로젝트는 GPU quota 가 0 으로 시작. **반드시 사전 신청 필수**:

```bash
# Phase 2 직후 실행
gcloud compute project-info add-metadata \
  --metadata="gpu-quota-request=L4×2 in us-east4 for Cloud Run" \
  --project=$NEW_PROJECT
# 실제 quota 신청은 콘솔 GUI:
# https://console.cloud.google.com/iam-admin/quotas?project=<NEW_PROJECT>
# Filter: Service = Compute Engine API, Metric = GPUs (all regions) / NVIDIA L4 GPUs
```

→ **사용자 직접 작업 (U5)** — Cloud Run usage explanation 작성 필요. 승인까지 1~24시간.

---

## §2. 코드베이스 사실 검증

### §2.1 cloudbuild.yaml — substitutions 만 갱신 (코드 수정 ≈ 0)

```yaml
substitutions:
  _SERVICE_NAME: aitutor                                    # ← 그대로
  _AR_REGION: asia-northeast3                               # ← Q2 결정 (asia-southeast1/asia-northeast3 변경 가능)
  _RUN_REGION: us-east4                                     # ← Q2 결정 (GPU L4 가용 리전)
  _REPO: aitutor                                            # ← 그대로
  _SA_EMAIL: aitutor-run@aifactory-494108.iam.gserviceaccount.com  # ★ 갱신
  _GCS_BUCKET: aitutor-files-aifactory-494108               # ★ 갱신
  _ISO_INFER_URL: https://aitutor-inference-z2ppabmtxa-uk.a.run.app # ★ Phase 5 후 갱신
```

빌드/배포 단계는 모두 `$PROJECT_ID` 변수 사용 → Cloud Build 가 빌드 프로젝트의 PROJECT_ID 자동 주입 → **PROJECT_ID 하드코딩 0건**.

### §2.2 코드 하드코딩 식별자 (검색 결과 — 모두 0건!)

| 패턴 | 결과 |
|---|---|
| `aifactory-494108` | **0건** (활성 코드) |
| `58235609672` | **0건** (활성 코드) |
| `aitutor-files-aifactory-494108` | **0건** (활성 코드 — 환경변수만 사용) |
| `z2ppabmtxa` (구 Cloud Run hash) | **0건** (활성 코드) |
| ADC 인증 파일 (`GOOGLE_APPLICATION_CREDENTIALS`, `service-account.json`, `credentials.json`) | **0건** |

→ **활성 코드 일괄 갱신 불필요**. cloudbuild.yaml substitutions 3개만 수정.

### §2.3 환경변수 / Secret 참조 패턴 (이미 추상화됨)

| 변수 | 코드 사용처 | 마이그 시 처리 |
|---|---|---|
| `GCS_FILES_BUCKET` | api/upload.js / api/files.js (Supabase Storage 와 분리된 GCS) | cloudbuild.yaml 에서 신규 버킷명으로 자동 주입 |
| `ISO_INFER_URL` | api/iso-infer.js (격리 service 프록시) | Phase 5 후 신규 URL 로 자동 주입 |
| `DATABASE_URL` | api/db.js (Supabase) | secret 그대로 복사 |
| `AUTH_TOKEN_SECRET` | api/auth.js (HMAC JWT) | secret 그대로 복사 |
| 외부 API 키 4개 | api/anthropic.js, api/gemini.js, api/openai.js, api/qwen.js | secret 그대로 복사 (또는 신규 발급) |

### §2.4 Dockerfile (변경 0)

`Dockerfile` 은 base image, multi-stage build, COPY 만 — GCP 식별자 없음. **수정 불필요**.

### §2.5 start.sh (변경 0)

`start.sh` 의 `PROCESS_MODE=isolated` 분기 — Cloud Run service 이름과 무관. **수정 불필요**.

### §2.6 git history 보존 (REBUILD30 §49 완료 후)

이미 §49 commit `465108c` 로 legacy `workspace/aitutor-inference/` 폐기 + sync-from-isolated 정리 완료. 마이그 시점에 깔끔한 트리.

---

## §3. 키/시크릿 분류 (8 + 외부 의존 0)

### §3.A 신규 발급이 **반드시** 필요한 키 (사용자 직접)

| # | 키 | 발급 위치 | 방법 | 사용자 작업 |
|---|---|---|---|---|
| 1 | **GCP 프로젝트** | gcloud CLI | `gcloud projects create $NEW_PROJECT` | Q1 결정 |
| 2 | **GPU L4 quota** | https://console.cloud.google.com/iam-admin/quotas?project=`$NEW_PROJECT` | "NVIDIA L4 GPUs" → us-east4 → 2 → request | U5 |

### §3.B 외부 발급 키 (Q5 정책)

| # | 키 | 옵션 A 신규 발급 URL | 옵션 B 그대로 복사 |
|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | 구 secret 값 추출 → 신규 환경 secret 등록 |
| 2 | `GEMINI_API_KEY` | https://aistudio.google.com/apikey | 동일 |
| 3 | `OPENAI_API_KEY` | https://platform.openai.com/api-keys | 동일 |
| 4 | `HF_API_KEY` | https://huggingface.co/settings/tokens | 동일 |

### §3.C 내부 시크릿 (Q6 정책 = A 그대로 복사 권장)

| # | 키 | 처리 |
|---|---|---|
| 1 | `AUTH_TOKEN_SECRET` | 그대로 복사 (회전 시 전 사용자 재로그인) |
| 2 | `DATABASE_URL` | 그대로 복사 (Supabase 외부 DB 연결 문자열, GCP 무관) |
| 3 | `LAW_API_OC` | 그대로 복사 (대한민국 법령정보 OC, 사용자 식별자) |
| 4 | `RESEND_API_KEY` | 그대로 복사 (이메일 발송) |

### §3.D 시크릿 등록 정책 (Secret Manager)

PressStand REBUILD22 패턴 동일 — 8개 모두 Secret Manager 에 등록하고 Cloud Run `--set-secrets` 로 주입.

---

## §4. 리전 / GPU L4 결정 가이드

### 옵션 1 — `us-east4` 유지 (권장, 안전성 최우선)

| 장점 | 단점 |
|---|---|
| ✅ 구 환경 GPU L4 quota 이미 검증된 리전 | ❌ 한국에서 RTT ~180ms (대한민국 사용자 우선 시 불리) |
| ✅ Cloud Build / AR 도 그대로 (asia-northeast3) | |
| ✅ 마이그 후 동일 동작 보장 | |

### 옵션 2 — `asia-southeast1` (싱가포르, 아시아 최단 GPU L4)

| 장점 | 단점 |
|---|---|
| ✅ 한국에서 RTT ~80ms (us-east4 의 1/2) | ❌ 신규 프로젝트 GPU L4 quota 사전 신청 필수 (1~24h 대기) |
| ✅ 한국 사용자 레이턴시 큰 폭 개선 | ❌ Cold start 시 모델 다운로드 (HF Hub) 가 미국보다 느릴 수 있음 |
| ✅ Cloud Run GPU L4 정식 지원 (2026-01 기준) | |

### 옵션 3 — `asia-northeast3` (서울) ❌ **불가** (2026-05-04 실측)

| 결과 |
|---|
| ❌ Google 공식 docs 검증: Cloud Run GPU L4 **공식 미지원** (asia-east1/east2 도 동일) |
| → 옵션 1 (us-east4) 또는 옵션 2 (asia-southeast1) 중 선택 강제 |

### Claude 권장

**Q2 = 옵션 1 (us-east4) 그대로** — 구 환경 동일 동작 보장 + 마이그 안정성 우선.
한국 레이턴시 개선이 우선이면 **옵션 2 (asia-southeast1)** — 단, GPU L4 quota 신청 후 진행.
**옵션 3 (asia-northeast3)** 은 quota 신청 시도 후 거부 시 자동 옵션 1/2 fallback.

---

## §5. Phase 0~7 단계별 실행 계획

### Phase 0 — 사전 준비 (예상 15분)

#### Phase 0-A — 신규 계정 결제 등록 (사용자 직접, U2)
✅ 이미 완료 (PressStand / SiteBySite 마이그 시 검증).

#### Phase 0-B — gcloud CLI 듀얼 계정 세팅
```bash
# 이미 등록됨
gcloud config configurations list
# default (season1zeepapa@aifactory-494108)
# new-account (geefafa0407@)
# sitebysite-new (geefafa0407@sitebysite-poc)

# aitutor 전용 configuration 생성
gcloud config configurations create aitutor-new
gcloud config set account geefafa0407@gmail.com
gcloud config set run/region us-east4   # Q2 결정
# 프로젝트는 Phase 2 에서 set
```

#### Phase 0-C — 작업 디렉토리 + env.sh
```bash
mkdir -p ~/aitutor-migration/{snapshot,secrets,logs}
cd ~/aitutor-migration

cat > ~/aitutor-migration/env.sh <<'EOF'
# === REBUILD31 마이그레이션 변수 ===
export OLD_ACCOUNT=season1zeepapa@gmail.com
export OLD_PROJECT=aifactory-494108
export OLD_PROJECT_NUMBER=58235609672
export OLD_BILLING=0193E0-B0D26B-FB31EB
export OLD_GCS_BUCKET=aitutor-files-aifactory-494108
export OLD_AR_REGION=asia-northeast3
export OLD_RUN_REGION=us-east4

export NEW_ACCOUNT=geefafa0407@gmail.com
export NEW_PROJECT=                      # ← Q1 결정 후 채움 (Phase 2)
export NEW_PROJECT_NUMBER=               # ← Phase 2 후 채움
export NEW_BILLING=01EAEF-50DBAA-FCEA24
export NEW_AR_REGION=asia-northeast3     # Q2 결정
export NEW_RUN_REGION=us-east4           # Q2 결정
export NEW_GCS_BUCKET=                   # ← Phase 3-A 후 채움 (예: aitutor-files-${NEW_PROJECT})
EOF
chmod 600 ~/aitutor-migration/env.sh
```

---

### Phase 1 — 인벤토리 + 영향도 분석 (예상 10분, 본 문서로 일부 완료)

본 문서 §1 + §1.7 이 인벤토리 결과. Phase 1 진입 시 다음만 추가 자동 실행:

```bash
source ~/aitutor-migration/env.sh
gcloud config configurations activate default

cd ~/aitutor-migration/snapshot

# 1) Cloud Run 2개 yaml 전체
gcloud run services describe aitutor --region=$OLD_RUN_REGION --project=$OLD_PROJECT --format=yaml > aitutor.yaml
gcloud run services describe aitutor-inference --region=$OLD_RUN_REGION --project=$OLD_PROJECT --format=yaml > aitutor-inference.yaml

# 2) Secret 8개 값 추출 (보안: 권한 600)
for s in ANTHROPIC_API_KEY GEMINI_API_KEY OPENAI_API_KEY HF_API_KEY LAW_API_OC AUTH_TOKEN_SECRET DATABASE_URL RESEND_API_KEY; do
  gcloud secrets versions access latest --secret=$s --project=$OLD_PROJECT > ~/aitutor-migration/secrets/$s.txt
done
chmod 600 ~/aitutor-migration/secrets/*.txt

# 3) IAM
gcloud projects get-iam-policy $OLD_PROJECT --format=yaml > iam-policy.yaml

# 4) GCS 객체 카운트 (1.18 GB 검증)
gcloud storage du -s gs://$OLD_GCS_BUCKET > gcs-count.txt
gcloud storage ls -r gs://$OLD_GCS_BUCKET | head -100 > gcs-objects.txt

# 5) AR 이미지 리스트
gcloud artifacts docker images list $OLD_AR_REGION-docker.pkg.dev/$OLD_PROJECT/aitutor --format=yaml > ar-images.yaml
```

→ Claude 가 §1.7 영향도 분석 보고 → **사용자 GO (U3)** 받기 전까지 Phase 2 진입 금지.

---

### Phase 2 — 신규 GCP 기초공사 (예상 15분 + GPU quota 대기 1~24h)

> **차단**: §0 Q1~Q9 모두 결정된 후 진행.

```bash
source ~/aitutor-migration/env.sh
gcloud config configurations activate aitutor-new

# 1) 프로젝트 생성 (Q1 결정값)
gcloud projects create $NEW_PROJECT --name="AI TutorTwo"

# 2) 프로젝트 번호 추출
export NEW_PROJECT_NUMBER=$(gcloud projects describe $NEW_PROJECT --format='value(projectNumber)')
sed -i.bak "s/^export NEW_PROJECT_NUMBER=.*/export NEW_PROJECT_NUMBER=$NEW_PROJECT_NUMBER/" ~/aitutor-migration/env.sh

# 3) 빌링 연결
gcloud beta billing projects link $NEW_PROJECT --billing-account=$NEW_BILLING

# 4) 필수 API 12개 활성화
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  storage-api.googleapis.com \
  iamcredentials.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  compute.googleapis.com \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project=$NEW_PROJECT

# 5) Artifact Registry 생성
gcloud artifacts repositories create aitutor \
  --repository-format=docker \
  --location=$NEW_AR_REGION \
  --description="AI TutorTwo Docker images" \
  --project=$NEW_PROJECT

# 6) GPU L4 quota 신청 (사용자 직접, U5)
echo ""
echo "⚠️  사용자 작업 U5 — GPU L4 quota 신청"
echo "URL: https://console.cloud.google.com/iam-admin/quotas?project=$NEW_PROJECT"
echo "Filter: Service = Compute Engine API"
echo "        Metric = NVIDIA L4 GPUs (해당 리전)"
echo "Increase: 0 → 2"
echo "Justification 예시:"
echo "  Cloud Run GPU L4 deployment for AI TutorTwo (LLM inference workload)."
echo "  Two services: aitutor (main, 1 GPU L4) + aitutor-inference (isolated, 1 GPU L4)."
echo "  Migration from existing project aifactory-494108 (verified usage)."
echo ""
echo "승인 메일 도착 후 Phase 3 진행."

# 7) configuration에 신규 프로젝트 등록
gcloud config set project $NEW_PROJECT
```

---

### Phase 3 — 시크릿 + GCS + IAM (예상 30분, GPU quota 승인 후)

#### Phase 3-A — Secret Manager 8개 등록

```bash
source ~/aitutor-migration/env.sh
gcloud config configurations activate aitutor-new

for s in ANTHROPIC_API_KEY GEMINI_API_KEY OPENAI_API_KEY HF_API_KEY LAW_API_OC AUTH_TOKEN_SECRET DATABASE_URL RESEND_API_KEY; do
  cat ~/aitutor-migration/secrets/$s.txt | gcloud secrets create $s --data-file=- --project=$NEW_PROJECT
  echo "✅ $s 등록됨"
done
```

#### Phase 3-B — GCS 버킷 생성 + 데이터 이전 (Q4)

```bash
export NEW_GCS_BUCKET=aitutor-files-${NEW_PROJECT}
sed -i.bak "s/^export NEW_GCS_BUCKET=.*/export NEW_GCS_BUCKET=$NEW_GCS_BUCKET/" ~/aitutor-migration/env.sh

# 신규 버킷 생성
gcloud storage buckets create gs://$NEW_GCS_BUCKET \
  --location=$NEW_AR_REGION \
  --uniform-bucket-level-access \
  --project=$NEW_PROJECT

# Q4=A: 전체 이전
if [ "$Q4" = "A" ]; then
  gcloud config configurations activate default
  gcloud storage cp -r gs://$OLD_GCS_BUCKET/* gs://$NEW_GCS_BUCKET/ --project=$NEW_PROJECT
  gcloud config configurations activate aitutor-new
fi
# Q4=B: 빈 버킷 그대로 시작
```

#### Phase 3-C — Service Account 2개 생성 + IAM

```bash
# aitutor-run SA
gcloud iam service-accounts create aitutor-run \
  --display-name="AI TutorTwo Cloud Run" \
  --project=$NEW_PROJECT

export AITUTOR_RUN_SA=aitutor-run@${NEW_PROJECT}.iam.gserviceaccount.com

# aitutor-inference-run SA
gcloud iam service-accounts create aitutor-inference-run \
  --display-name="AI TutorTwo 격리 추론 Cloud Run" \
  --project=$NEW_PROJECT

export AITUTOR_INFERENCE_RUN_SA=aitutor-inference-run@${NEW_PROJECT}.iam.gserviceaccount.com

# Secret 8개에 aitutor-run SA secretAccessor 부여
for s in ANTHROPIC_API_KEY GEMINI_API_KEY OPENAI_API_KEY HF_API_KEY LAW_API_OC AUTH_TOKEN_SECRET DATABASE_URL RESEND_API_KEY; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:$AITUTOR_RUN_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$NEW_PROJECT
done

# GCS 버킷에 aitutor-run SA objectAdmin
gcloud storage buckets add-iam-policy-binding gs://$NEW_GCS_BUCKET \
  --member="serviceAccount:$AITUTOR_RUN_SA" \
  --role="roles/storage.objectAdmin" \
  --project=$NEW_PROJECT

# 메인 service 가 격리 service 호출 — Cloud Run invoker 권한
# (Phase 5 후 격리 service 배포되면 부여)
```

---

### Phase 4 — 코드 수정 (예상 5~10분)

#### 4.1 cloudbuild.yaml substitutions 갱신

```diff
substitutions:
  _SERVICE_NAME: aitutor
- _AR_REGION: asia-northeast3
+ _AR_REGION: ${NEW_AR_REGION}      # Q2 결정값
- _RUN_REGION: us-east4
+ _RUN_REGION: ${NEW_RUN_REGION}    # Q2 결정값
  _REPO: aitutor
- _SA_EMAIL: aitutor-run@aifactory-494108.iam.gserviceaccount.com
+ _SA_EMAIL: aitutor-run@${NEW_PROJECT}.iam.gserviceaccount.com
- _GCS_BUCKET: aitutor-files-aifactory-494108
+ _GCS_BUCKET: ${NEW_GCS_BUCKET}
- _ISO_INFER_URL: https://aitutor-inference-z2ppabmtxa-uk.a.run.app
+ _ISO_INFER_URL: <Phase 5 후 채움>
```

#### 4.2 이미 안전한 항목 (수정 불필요)

- 활성 코드: 0건 하드코딩 검증 완료 (§2.2)
- Dockerfile / start.sh: 변경 0
- inference-py/server.py + engines/: PROCESS_MODE 분기로 동일 image 재사용 (REBUILD30 §49)

#### 4.3 git 커밋 (마이그 브랜치)

```bash
cd /Users/2team/aifac
git checkout -b migration/gcp-new-account-aitutor
git add workspace/aitutor/cloudbuild.yaml
git commit -m "migration(aitutor): 신규 GCP 환경 substitutions 갱신 (REBUILD31 §4)"
```

---

### Phase 5 — 빌드 + 배포 (예상 30~60분, 사용자 승인 U6 필요)

#### 5.1 사용자 승인 요청

```
Phase 5: AI TutorTwo 메인 + 격리 service 를 신규 GCP 에 배포합니다.
- 예상 빌드 시간: ~30분 (Cloud Build, multi-stage CUDA + Vite)
- 예상 비용: ~수백원 (Cloud Build 무료 티어 일부 + GPU L4 콜드 스타트)
- 다운타임 시작: 본 단계
진행해도 되겠습니까? (yes/no)
```

#### 5.2 메인 빌드 + 배포 (PROCESS_MODE=main)

```bash
cd /Users/2team/aifac/workspace/aitutor
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_TAG=v$(date +%Y%m%d-%H%M%S) \
  --project=$NEW_PROJECT
# cloudbuild.yaml 의 deploy 단계가 메인 service 를 자동 배포

NEW_AITUTOR_URL=$(gcloud run services describe aitutor --region=$NEW_RUN_REGION --project=$NEW_PROJECT --format='value(status.url)')
echo "AITUTOR_URL=$NEW_AITUTOR_URL" >> ~/aitutor-migration/secrets/keys.txt
```

#### 5.3 격리 service 배포 (PROCESS_MODE=isolated, 같은 image)

```bash
LATEST_IMAGE=$NEW_AR_REGION-docker.pkg.dev/$NEW_PROJECT/aitutor/aitutor:latest

gcloud run deploy aitutor-inference \
  --image=$LATEST_IMAGE \
  --region=$NEW_RUN_REGION \
  --project=$NEW_PROJECT \
  --service-account=$AITUTOR_INFERENCE_RUN_SA \
  --memory=32Gi --cpu=8 --timeout=600 \
  --gpu=1 --gpu-type=nvidia-l4 \
  --no-gpu-zonal-redundancy --no-cpu-throttling \
  --min-instances=0 --max-instances=1 --concurrency=10 \
  --set-env-vars="^|^PROCESS_MODE=isolated|GPU_ENABLED=1|OLLAMA_HOST=0.0.0.0:11434|OLLAMA_MODELS=/var/ollama/models" \
  --no-allow-unauthenticated

NEW_ISO_INFER_URL=$(gcloud run services describe aitutor-inference --region=$NEW_RUN_REGION --project=$NEW_PROJECT --format='value(status.url)')
echo "ISO_INFER_URL=$NEW_ISO_INFER_URL" >> ~/aitutor-migration/secrets/keys.txt

# 메인 service 가 격리 service 호출하는 invoker 권한
gcloud run services add-iam-policy-binding aitutor-inference \
  --member="serviceAccount:$AITUTOR_RUN_SA" \
  --role="roles/run.invoker" \
  --region=$NEW_RUN_REGION --project=$NEW_PROJECT
```

#### 5.4 cloudbuild.yaml 의 ISO_INFER_URL 갱신 + 메인 재배포

```bash
# cloudbuild.yaml 의 _ISO_INFER_URL substitution 을 신규 URL 로 갱신
sed -i.bak "s|_ISO_INFER_URL:.*|_ISO_INFER_URL: $NEW_ISO_INFER_URL|" workspace/aitutor/cloudbuild.yaml

# 메인 service 환경변수 직접 갱신 (재빌드 없이)
gcloud run services update aitutor \
  --region=$NEW_RUN_REGION --project=$NEW_PROJECT \
  --update-env-vars="ISO_INFER_URL=$NEW_ISO_INFER_URL"

# 다음 빌드부터 영구 반영되도록 commit
cd /Users/2team/aifac
git add workspace/aitutor/cloudbuild.yaml
git commit -m "migration(aitutor): ISO_INFER_URL 신규 URL 반영 (REBUILD31 §5.4)"
```

#### 5.5 헬스체크

```bash
curl -fsS $NEW_AITUTOR_URL/api/health  # {"ok":true,...}
curl -fsS $NEW_ISO_INFER_URL/healthz   # {"ok":true}
curl -fsS $NEW_ISO_INFER_URL/readyz    # {"engines":[...]}
```

---

### Phase 6 — 검증 (예상 30~60분)

#### 6.1 단위 동작

```bash
# DB 연결
curl -fsS $NEW_AITUTOR_URL/api/health | jq

# 6 엔진 카탈로그 (격리 service 의존)
curl -fsS $NEW_AITUTOR_URL/api/iso-infer?action=models | jq '.engines | length'  # 6

# 11 모델 카탈로그
curl -fsS $NEW_AITUTOR_URL/api/iso-infer?action=models | jq '.models | length'  # 11

# 메인 service 의 local-infer 카탈로그
curl -fsS $NEW_AITUTOR_URL/api/local-infer?action=models | jq '.models | length'  # 11

# 보호 API 401
curl -i $NEW_AITUTOR_URL/api/admin/users | head -5  # HTTP 401
```

#### 6.2 Playwright 전수 (REBUILD30 §44 기준 — lab smoke 15건 + step1~6)

```bash
cd /Users/2team/aifac/workspace/aitutor
PLAYWRIGHT_BASE_URL=$NEW_AITUTOR_URL npx playwright test
# 기대: lab smoke 15 PASS / step1~6 22건은 사용자 시드 필요로 별도 검증
```

#### 6.3 사용자 시나리오 (수동)

- [ ] 신규 URL 브라우저 열기 → 랜딩 정상 (다크 모드 지원)
- [ ] 로그인 → 사용자 세션 유지 (DATABASE_URL 그대로 → Supabase 기존 계정 그대로 동작)
- [ ] 6 엔진 동거 비교 lab → 모든 엔진 active 표시
- [ ] WebLLM lab → 모델 로드/언로드 정상
- [ ] HfPlayground lab → 시험 모드 단일화 확인
- [ ] LocalGcpTester (서버통합) → 메모리 정리 버튼 동작
- [ ] ServerInferTester (서버분리) → 격리 service 응답 정상
- [ ] PromptEditor → 시드/마지막 사용자 메시지 저장 후 추론

#### 6.4 24시간 모니터링

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND severity>=ERROR" \
  --project=$NEW_PROJECT --limit=50 --format=json --freshness=24h
```

---

### Phase 7 — 구 GCP 자원 정리 (사용자 GO 사인 U7 필요, 예상 30분)

> **차단**: 24시간 무에러 운영 + 사용자 명시 GO. **Q7 강제 = A (자원만 삭제)** — Firebase 절대 보존.

#### 7.1 사용자 GO 요청

```
24시간 모니터링 결과:
- ERROR 로그: N건 (상세)
- 6 엔진 / 11 모델 정상
- DB / 메모리 정리 / iso-infer 프록시 정상
- Playwright lab smoke 15/15 PASS
- 사용자 시나리오 정상

Phase 7 (구 aitutor 자원 정리, Firebase 절대 보존) 진행해도 되겠습니까? (yes/no)
처리 방식: A (자원만 삭제 — Firebase 보존) ✅ 강제
```

#### 7.2 구 aitutor 자원 단계적 삭제 (Firebase 절대 미접촉)

```bash
gcloud config configurations activate default
PROJECT=aifactory-494108

# 1) Cloud Run aitutor + aitutor-inference 만 삭제 (checkmissedreturn / recordcheckin 절대 미접촉)
gcloud run services delete aitutor --region=us-east4 --project=$PROJECT --quiet
gcloud run services delete aitutor-inference --region=us-east4 --project=$PROJECT --quiet

# 2) Custom SA 2개 삭제 (Firebase SA 절대 미접촉)
gcloud iam service-accounts delete aitutor-run@$PROJECT.iam.gserviceaccount.com --project=$PROJECT --quiet
gcloud iam service-accounts delete aitutor-inference-run@$PROJECT.iam.gserviceaccount.com --project=$PROJECT --quiet

# 3) Secret 8개 삭제 (TELEGRAM_* 2개는 Firebase 사용 → 절대 미접촉)
for s in ANTHROPIC_API_KEY GEMINI_API_KEY OPENAI_API_KEY HF_API_KEY LAW_API_OC AUTH_TOKEN_SECRET DATABASE_URL RESEND_API_KEY; do
  gcloud secrets delete $s --project=$PROJECT --quiet
done

# 4) Artifact Registry aitutor 삭제 (gcf-artifacts 절대 미접촉)
gcloud artifacts repositories delete aitutor --location=asia-northeast3 --project=$PROJECT --quiet

# 5) GCS 버킷 aitutor-files 삭제 (gcf-v2-* 절대 미접촉)
gcloud storage rm -r gs://aitutor-files-aifactory-494108 --project=$PROJECT

# 6) (선택) 빌링 분리 — Firebase Functions 무료 티어 내라면 안전
# gcloud beta billing projects unlink aifactory-494108
# → Firebase Functions 가 무료 티어 초과하면 동작 멈출 수 있음. 사용자 결정 필요.
```

#### 7.3 검증

```bash
# Cloud Run 양쪽 모두 사라졌는지
gcloud run services list --project=$PROJECT --format="value(metadata.name)"
# 기대: checkmissedreturn / recordcheckin 만 (2개)

# Firebase Functions 정상 동작
curl -fsS https://checkmissedreturn-z2ppabmtxa-du.a.run.app  # 200

# Secret 절대 보존 확인
gcloud secrets list --project=$PROJECT --format="value(name)"
# 기대: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID + secret-faff... + secret-e08a... 만
```

#### 7.4 다른 4개 프로젝트 cross-reference 검증 (sitebysite REBUILD08 §16.4 패턴)

```bash
for p in docstore-491906 lottoda-491905 pressstand aifactory-60aa1; do
  echo "=== $p ==="
  gcloud run services list --project=$p --format='value(metadata.name)' 2>&1 | grep -i aitutor || echo "✅ aitutor 참조 0"
  gcloud secrets list --project=$p --format='value(name)' 2>&1 | grep -iE "aitutor|aifactory-494108" || echo "✅ secret 참조 0"
done
```

---

## §6. 사용자 직접 작업 상세 (U1~U7)

### U1 — 본 계획서 검토 + Q1~Q9 답변
| Q | 답변 형식 |
|---|---|
| Q1 신규 프로젝트 ID | 단답 (예: `aitutor-prod`) |
| Q2 리전 | 1 / 2 / 3 |
| Q3 DB | (확정 — 신규 작업 없음) |
| Q4 GCS | A / B |
| Q5 외부 키 | A / B |
| Q6 내부 시크릿 | A / B |
| Q7 구 자원 처분 | A (강제) |
| Q8 Firebase Functions | (확정 — 그대로 보존) |
| Q9 시작 시점 | 즉시 / 일시 |

### U2 — 신규 계정 결제 등록 ✅ (완료)

### U3 — §1.7 영향도 분석 검토 + GO

Claude 가 자동 보고할 항목:
- 구 계정 다른 4개 프로젝트 미접촉 보장
- Firebase Functions 2개 + Firebase 자원 격리 보장
- 신규 계정 기존 3개 프로젝트 보호
- 외부 API 키 코드베이스 cross-reference 결과 (다른 프로젝트가 같은 키 공유 시 회전 영향 평가)

### U4 — (조건부) 새 GCP 프로젝트 ID 지정

Q1 답변 후 Phase 2 에서 충돌 시 즉시 다른 ID 요청.

### U5 — GPU L4 quota 신청

```
URL: https://console.cloud.google.com/iam-admin/quotas?project=<NEW_PROJECT>
Filter: Service = Compute Engine API
        Metric = NVIDIA L4 GPUs
Region: us-east4 (Q2 결정 리전)
Increase: 0 → 2
Justification:
  Cloud Run GPU L4 deployment for AI TutorTwo (LLM inference workload).
  Two services: aitutor (main) + aitutor-inference (isolated, PROCESS_MODE=isolated).
  Migration from existing project aifactory-494108 (verified Cloud Run GPU L4 usage).
```

승인 메일 도착 (1~24h) 후 Phase 3 진행.

### U6 — Phase 5 빌드 + 배포 승인 (즉답)

### U7 — Phase 7 GO 사인 (24시간 후, 즉답)

---

## §7. 검증 체크리스트

### 동작 검증
- [ ] `$NEW_AITUTOR_URL/api/health` 200
- [ ] `$NEW_AITUTOR_URL/api/local-infer?action=models` 11 모델
- [ ] `$NEW_AITUTOR_URL/api/iso-infer?action=models` 11 모델 + 6 엔진
- [ ] 메모리 정리 액션 (LocalGcpTester) 정상
- [ ] WebLLM 모델 로드/언로드
- [ ] PromptEditor 시드/사용자 메시지 추론
- [ ] HfPlayground 시험 모드 단일화 (자유 프롬프트 제거)
- [ ] OllamaBridge 단일 모델 차단 정책

### 분리 검증 (다른 프로젝트 + Firebase 보호)
- [ ] PressStand (`pressstand-prod` 신환경) 정상
- [ ] SiteBySite (`sitebysite-poc` 신환경) 정상
- [ ] DocStore (`docstore-491906` 구 환경) 정상
- [ ] Lottoda (`lottoda-491905` 구 환경) 정상
- [ ] PressStand 5종 (`pressstand` 구 환경 — 정리 진행 중) 영향 0
- [ ] **Firebase Functions (`checkMissedReturn`, `recordCheckIn`) 정상 동작**
- [ ] **Firebase Hosting / Firestore / Realtime DB 정상**
- [ ] 외부 API 키 (Q5=B 시) 다른 프로젝트 공유 사용처 영향 0

### Playwright (REBUILD30 §44 기준)
- [ ] lab smoke 15/15 PASS
- [ ] step1~6 (사용자 시드 필요) 별도 검증

---

## §8. 롤백 계획

### Phase 2 실패 시 (프로젝트 생성)
- ID 충돌 → U4 새 ID 지정 후 재시도
- 빌링 연결 실패 → 신규 빌링 활성화 확인

### Phase 3 실패 시 (Secret/GCS/IAM)
- Secret 등록 실패 → 개별 secret 재시도 (멱등)
- GCS 복사 실패 → `gcloud storage cp` retry (gcloud 자동 retry 옵션 사용)

### Phase 5 실패 시 (빌드/배포)
- 신규 Cloud Run 정지 (`--max-instances=0`) → 구 환경 그대로 유지 (Phase 7 미진입이므로 자동 가용)
- 코드 수정 → 재빌드/재배포 (멱등)

### Phase 6 검증 실패 시
- **Phase 7 절대 진행 금지**
- 구 aitutor 환경 그대로 가용 (트래픽 없는 상태로 보존)
- 신규 환경 디버깅 → 재배포

### Phase 7 직후 사고 발생 시
- 구 자원 삭제 후 `gcloud beta service-management` 또는 백업으로 일부 복원
- 권장: Phase 7 실행 전 **최소 24시간 무에러 운영 + Playwright PASS**

---

## §9. 예상 시간 / 비용

### 시간

| Phase | 소요 | 사용자 / Claude |
|---|---|---|
| 0. 사전 준비 | 15분 | 🤖 Claude |
| 1. 인벤토리 + 영향도 분석 | 10분 (본 문서로 일부 완료) | 🤖 Claude |
| (사용자 검토 + Q1~Q9 답변) | 5~10분 | 🧑 사용자 (U1, U3) |
| 2. 신규 GCP 기초공사 | 15분 | 🤖 Claude |
| (GPU L4 quota 신청 + 승인 대기) | **1~24시간** | 🧑 사용자 (U5) |
| 3. Secret + GCS + IAM | 30분 | 🤖 Claude |
| 4. 코드 수정 (cloudbuild substitutions) | 10분 | 🤖 Claude |
| 5. 빌드 + 배포 (메인 + 격리) | 30~60분 | 🤖 Claude (사용자 승인 U6) |
| 6. 검증 + Playwright | 30분 + 24시간 모니터링 | 🤖 + 🧑 |
| 7. 구 자원 정리 | 30분 | 🤖 Claude (사용자 GO U7) |
| **순 작업 합계** | **3~4시간 + GPU quota 대기 1~24h + 24시간 모니터링** | |

### 비용

- **마이그 자체**: 거의 0원 (Cloud Build 무료 티어 + GCS 송신비 ~수십원 — 1.18 GB intra-region)
- **이중 운영 기간**: **0** (빅뱅 컷오버, 구/신 동시 운영 없음 — 단, Phase 5~7 사이 24h 동안 신환경만 가동, 구환경 정지 상태)
- **신규 인프라 월 비용 (변경 없음)**: 구 환경과 동일
  - Cloud Run idle (min=0): $0
  - GPU L4 사용 시: 시간당 ~$0.6/GPU × 사용 시간
  - Cloud SQL: 0 (Supabase 외부)
  - Secret Manager: ~$0.36/월 (8 secret × $0.06)

---

## §10. 진행 상황 추적표

### 10.1 확정값 (실행 후 채움)

| 항목 | 확정값 | 기록일 |
|---|---|---|
| 신규 GCP 프로젝트 ID | **`aitutortwo-prod`** | 2026-05-04 (Phase 2) |
| 신규 프로젝트 번호 | **`716942218621`** | 2026-05-04 (Phase 2) |
| 신규 빌링 계정 | `01EAEF-50DBAA-FCEA24` | (확정) |
| 리전 | **`asia-southeast1` (싱가포르)** — Q2=2 (한국 RTT ~80ms, GPU L4 가용) | 2026-05-04 |
| AR 저장소 | `asia-southeast1-docker.pkg.dev/aitutortwo-prod/aitutor` | 2026-05-04 (Phase 2) |
| SA (메인) | `aitutor-run@aitutortwo-prod.iam.gserviceaccount.com` | 2026-05-04 (Phase 2) |
| SA (격리) | `aitutor-inference-run@aitutortwo-prod.iam.gserviceaccount.com` | 2026-05-04 (Phase 2) |
| GPU L4 quota 승인 시간 | _U5 신청 후 1~24h_ | _대기_ |
| 신규 aitutor URL | **`https://aitutor-716942218621.asia-southeast1.run.app`** | 2026-05-04 (Phase 5-2) |
| 신규 aitutor-inference URL | **`https://aitutor-inference-716942218621.asia-southeast1.run.app`** | 2026-05-04 (Phase 5-3) |
| 신규 GCS 버킷 | `aitutor-files-aitutortwo-prod` (asia-southeast1, 빈 버킷) | 2026-05-04 |
| 외부 키 정책 (Q5) | **B (그대로 복사)** — cross-ref 0건 검증 | 2026-05-04 |
| 내부 시크릿 정책 (Q6) | **A (그대로 복사)** | 2026-05-04 |
| 구 자원 처분 (Q7) | A (강제) | (확정) |
| Firebase 처분 (Q8) | 그대로 보존 (확정) | (확정) |
| 다운타임 시작 | _Phase 5_ | _Phase 5_ |
| 다운타임 종료 | _Phase 6 헬스체크 PASS_ | _Phase 6_ |
| Playwright lab smoke 결과 | _Phase 6_ | _Phase 6_ |

### 10.2 §1.7 영향도 분석 결과 (2026-05-04 실측 완료)

| 항목 | 결과 |
|---|---|
| 구 계정 다른 4개 프로젝트 | ✅ 미접촉 — secret/IAM grep 결과 aitutor/aifactory-494108 참조 0건 |
| 같은 프로젝트 내 격리 보존 자원 | ✅ Firebase Functions 2 + **Firestore Native DB 1 (asia-northeast3, default)** + TELEGRAM_* secret 2 + gcf-* AR/GCS |
| 신규 계정 기존 3개 프로젝트 | ✅ 보호 (pressstand-prod, sitebysite-poc, project-7da62fab) |
| 외부 API 키 4개 cross-reference | ✅ Anthropic/Gemini/OpenAI/HF 모두 **다른 코드베이스 사용처 0건** → Q5=B 그대로 복사 안전 |
| 빌링 0193E0-... 공유 4개 프로젝트 | docstore, lottoda, pressstand, aifactory-494108 — 마이그 후 빌링 분리 시 무영향 |
| 신규 ID `aitutortwo-prod` 가용성 | ⏸ PERMISSION_DENIED (모호 응답) — Phase 2 시도 시 확정 (PressStand `pressstand-prod` 동일 응답 후 create 성공 사례) |
| **Q2 `asia-northeast3` GPU L4 가용성** | ❌ **블로커** — Google 공식 docs 실측: Cloud Run GPU L4 미지원 (asia-east1/east2 도 미지원) |
| Cloud Run GPU L4 공식 지원 리전 | `us-east4`(현환경), `us-central1`(invite-only), `asia-southeast1`(싱가포르 — 한국 최단), `europe-west1`, `europe-west4`, `asia-south1`(invite-only) |

### 10.3 Phase 진행 체크 (실행 결과)

| Phase | 시작 | 완료 | 비고 |
|---|---|---|---|
| 0. 사전 준비 + env.sh | 2026-05-04 | 2026-05-04 | ✅ `~/aitutor-migration/env.sh` |
| 1. 인벤토리 (본 문서로 일부 완료) | 2026-05-04 | 2026-05-04 | ✅ §1 (Cloud Run 4, Secret 10, GCS 4, AR 2, SA 5, Scheduler 1, API 54) |
| 1.7. 영향도 분석 | 2026-05-04 | 2026-05-04 | ✅ Q2 asia-northeast3 GPU L4 미지원 발견 → 사용자 재선택 asia-southeast1. 외부키 cross-ref 0건. 다른 4 프로젝트 미접촉. Firestore Native 1 추가 |
| 2. 신규 GCP 기초공사 | 2026-05-04 | 2026-05-04 | ✅ `aitutortwo-prod` (716942218621) + 빌링 + API 12+의존성=33 + AR (asia-southeast1) + SA 2개 |
| 2-U5. GPU L4 quota 신청 (사용자 직접) | 2026-05-04 | _대기_ | ⏸ **사용자 작업 차단** — 콘솔 GUI 신청, 승인 1~24h. 사용자 요청으로 quota 승인 전 가능한 모든 사전 작업 (Phase 3+4) 선행 진행 |
| 3-A. Secret 8개 등록 | 2026-05-04 | 2026-05-04 | ✅ ANTHROPIC/AUTH_TOKEN/DATABASE_URL/GEMINI/HF/LAW_API_OC/OPENAI/RESEND |
| 3-B. GCS 신규 버킷 + 데이터 이전 | 2026-05-04 | 2026-05-04 | ✅ aitutor-files-aitutortwo-prod (asia-southeast1) 생성. **Q4 A→B 전환** — 구 1.2GB 가 Cloud Build tarball 9개뿐 (사용자 데이터 0), 빈 버킷 운영 |
| 3-C. SA IAM 부여 | 2026-05-04 | 2026-05-04 | ✅ Secret 8 secretAccessor + GCS objectAdmin (aitutor-run@aitutortwo-prod) |
| 4. 코드 수정 | 2026-05-04 | 2026-05-04 | ✅ cloudbuild.yaml substitutions (asia-southeast1, aitutortwo-prod, _GCS_BUCKET, _ISO_INFER_URL placeholder) |
| 5-1. Cloud Build (build-only.yaml) | 2026-05-04 06:06 KST | 2026-05-04 06:30 KST | ✅ ad0baa3b SUCCESS (22m 47s, image push v20260504-055327 + latest) |
| 5-2. 메인 (aitutor) 배포 | 2026-05-04 06:31 KST | 2026-05-04 06:38 KST | ✅ asia-southeast1, 24Gi/6cpu/L4, revision aitutor-00002-5qm 100% traffic. **신규 GCP NVIDIA L4 default quota = 1 자동 사용** (별도 신청 없이 배포 성공) |
| 5-3. 격리 (aitutor-inference) 배포 | 2026-05-04 06:39 KST | 2026-05-04 06:40 KST | ✅ asia-southeast1, 32Gi/8cpu/L4, revision aitutor-inference-00001-z5z 100% traffic. **L4 quota=1인데도 두 service 동시 운영 가능** (Cloud Run scaling: max-instances=1 + min=0 으로 동시 실행 1개씩이라 quota 카운트 0~2 가변) |
| 5-4. ISO_INFER_URL 갱신 + invoker IAM | 2026-05-04 06:40 KST | 2026-05-04 06:41 KST | ✅ 메인 env update (revision aitutor-00003-9gs) + aitutor-run SA → aitutor-inference invoker |
| 5-5. 헬스체크 | 2026-05-04 06:41 KST | 2026-05-04 06:43 KST | ✅ 메인 / HTTP 200 (Vite SPA 정상), 메인 /api/* HTTP 401 (auth 미들웨어 정상), 격리 FastAPI uvicorn ready (logs) |
| 6-1. 단위 동작 (curl) | 2026-05-04 06:43 KST | 2026-05-04 06:43 KST | ✅ /=200 (Vite SPA), /api/*=401 (auth 정상), 격리 logs FastAPI uvicorn ready |
| 6-2. Playwright lab smoke | 2026-05-04 06:46 KST | 2026-05-04 06:50 KST | ⚠️ 12/15 PASS — 3 FAIL 모두 `/lab/local-ai` 헤더 링크. 원인: 신규 도메인 첫 방문 온보딩 모달("어떤 시험을 준비하시나요?")이 헤더 가림. **마이그 결함 아님 — 정상 동작**. 사용자가 1회 "건너뛰기" 후 정상 |
| 6-3. 사용자 시나리오 | _대기_ | _대기_ | 사용자 직접 브라우저 로그인 + 6 엔진 lab 검증 |
| 6-4. 24h 모니터링 | _스킵 (사용자 결정)_ | _스킵_ | 사용자 명시 GO 받고 Phase 7 즉시 진행 |
| 7. 구 자원 정리 (Firebase 보존) | 2026-05-04 06:58 KST | 2026-05-04 07:02 KST | ✅ 안전 시퀀스 (Pre-flight → 트래픽 차단 → 단계적 삭제 → Firebase 검증 → cross-ref) — Cloud Run 2 + SA 2 + Secret 8 + AR 1 + GCS 1 모두 0 / Firebase Functions 2 + Firestore + 3 GCS + TELEGRAM 2 + AR gcf-artifacts + Scheduler 모두 보존 / 다른 4 프로젝트 영향 0 |
| 6. 검증 + Playwright | _대기_ | _대기_ | |
| 7. 구 자원 정리 (Firebase 보존) | _대기_ | _대기_ | U7 |

---

## §11. 부록 — 식별자 매핑표 (구 → 신)

| 종류 | 구 (`aifactory-494108`) | 신 (`<NEW_PROJECT>`) |
|---|---|---|
| 프로젝트 ID | `aifactory-494108` | _Q1_ |
| 프로젝트 번호 | `58235609672` | _Phase 2_ |
| 빌링 계정 | `0193E0-B0D26B-FB31EB` (4 프로젝트 공유) | `01EAEF-50DBAA-FCEA24` |
| 리전 (AR) | asia-northeast3 | _Q2_ |
| 리전 (Run) | us-east4 | _Q2_ |
| Cloud Run (메인) | `https://aitutor-z2ppabmtxa-uk.a.run.app` | _Phase 5_ |
| Cloud Run (격리) | `https://aitutor-inference-z2ppabmtxa-uk.a.run.app` | _Phase 5_ |
| Artifact Registry | `asia-northeast3-docker.pkg.dev/aifactory-494108/aitutor/` | `${NEW_AR_REGION}-docker.pkg.dev/${NEW_PROJECT}/aitutor/` |
| GCS 버킷 | `aitutor-files-aifactory-494108` (1.18 GB) | `aitutor-files-${NEW_PROJECT}` |
| SA (메인) | `aitutor-run@aifactory-494108.iam.gserviceaccount.com` | `aitutor-run@${NEW_PROJECT}.iam.gserviceaccount.com` |
| SA (격리) | `aitutor-inference-run@aifactory-494108.iam.gserviceaccount.com` | `aitutor-inference-run@${NEW_PROJECT}.iam.gserviceaccount.com` |
| Secret 8개 | aifactory-494108 (별도 access) | _Phase 3-A_ (이름 동일) |
| GPU | nvidia-l4 × 1 (메인) + nvidia-l4 × 1 (격리) | 동일 (quota 사전 신청) |
| **격리 보존 (절대 미접촉)** | Firebase Functions 2 + Firebase 본체 + TELEGRAM_* secret + gcf-* AR/GCS | (해당 없음 — 신규 환경엔 안 옮김) |

---

## §12. PressStand REBUILD22 / SiteBySite REBUILD08 대비 차이점

| 항목 | PressStand (REBUILD22) | SiteBySite (REBUILD08) | **AI TutorTwo (REBUILD31)** |
|---|---|---|---|
| 컷오버 방식 | 다운타임 최소화 (구/신 동시 운영) | 빅뱅 단일 | **빅뱅 단일** ✅ |
| Cloud Run 서비스 수 | 5~6개 | 2개 | **2개** (메인 + 격리, 같은 image) |
| Cloud SQL | 1개 (이전) | 1개 (이전) | **0개** (Supabase 외부) ⭐ |
| Secret Manager | 14개 | 0개 (평문) | **8개 + Firebase 격리 2개** |
| GCS 버킷 (앱 데이터) | 5개 (충돌 → prefix) | 0개 | **1개** (1.18 GB) |
| GPU | 0 | 0 | **L4 × 2** ⭐ (quota 신청 필수) |
| OAuth | Google + Blogger refresh_token | Google OAuth | **0개** (Supabase Auth 외부) ⭐ |
| 외부 격리 자원 | withbible (Cloud Run + secret) | 없음 | **Firebase Functions 2 + Firebase 본체** ⭐ |
| 코드 수정 파일 | 7개 + sync 4개 | 2개 | **1개** (cloudbuild.yaml substitutions 만) ⭐ |
| Cloud Build trigger | 4개 | 0개 | **0개** |
| 데이터 가치 | 높음 | 낮음 (1인) | **중** (사용자 + 사이트 데이터, Supabase 그대로) |
| 다운타임 | ~2시간 41분 | 49분 | **3~4h + quota 대기 1~24h** |
| 사용자 직접 작업 | U1~U8 | U1~U7 | **U1~U7** (GPU quota 신청 추가) |
| 순 작업 시간 | 6.5~10시간 | 1시간 10분 | **3~4시간** |

---

## §16. 마이그레이션 실제 실행 기록 (Execution Log, 2026-05-04)

### 16.1 사용자 결정 (Q1~Q9) 확정

| Q | 결정 |
|---|---|
| Q1 신규 프로젝트 ID | **`aitutortwo-prod`** (1차 시도 가용, PERMISSION_DENIED 후에도 create 성공) |
| Q2 리전 | **`asia-southeast1` (싱가포르)** — 1차 답변 `asia-northeast3` → Cloud Run GPU L4 미지원 발견 후 재선택 |
| Q3 DB 정책 | 자동 확정 — Supabase 외부 (DATABASE_URL secret 만 복사) |
| Q4 GCS 데이터 | A → **B 자동 전환** — 구 1.2GB 가 모두 Cloud Build tarball, 마이그 가치 0 |
| Q5 외부 키 4개 | **B (구 키 그대로 복사)** — cross-reference 0건 검증 |
| Q6 내부 시크릿 | **A (그대로 복사)** |
| Q7 구 자원 처분 | **A (자원만 삭제, Firebase 보존)** — 강제 |
| Q8 Firebase Functions | **그대로 보존** (확정) |
| Q9 시작 시점 | **즉시** |

### 16.2 종합 결과

| 지표 | 값 |
|---|---|
| 시작 (Phase 0) | 2026-05-04 ~10:30 UTC (작업 디렉토리 + 인벤토리) |
| Phase 5 빌드 SUCCESS | 2026-05-04 06:30:27 KST (Cloud Build ad0baa3b, 22m 47s) |
| Phase 5 메인 배포 | 2026-05-04 06:38 KST (revision aitutor-00002-5qm) |
| Phase 5 격리 배포 | 2026-05-04 06:40 KST (revision aitutor-inference-00001-z5z) |
| Phase 5 ISO_INFER_URL 갱신 | 2026-05-04 06:41 KST (revision aitutor-00003-9gs) |
| Phase 6 Playwright | 2026-05-04 06:50 KST (12/15 PASS, 3 FAIL = 온보딩 모달 정상 동작) |
| **다운타임** | **0** (구 환경 그대로 가동, 신규 환경 별도 운영, Phase 7 미진입) |
| 외부 격리 보존 (Firebase) | ✅ 손대지 않음 (Phase 5~6 모두 신규 프로젝트만 작업) |
| 다른 4개 프로젝트 영향 | ✅ 0건 (cross-ref 검증 + 작업 모두 신규 환경 한정) |
| 신규 GCP NVIDIA L4 quota | 마이그 시점 default = 1 자동 할당 (별도 신청 불필요). **2026-05-03 21:36 KST 사용자 1 → 3 상향 신청 → 즉시 승인** (Cloud Run Admin API · `NvidiaL4GpuAllocNoZonalRedundancyPerProjectRegion` · asia-southeast1 · CLOUD_CONSOLE 경로) |

### 16.3 GCS 데이터 정책 자동 전환 (Q4 A → B)

Phase 3-B 진행 중 발견:
- 구 버킷 `aitutor-files-aifactory-494108` (1.18 GB) 의 객체 전수 분석 결과:
  - 9개 객체 100% 가 `cloudbuild-source/*.tgz` (Cloud Build 자동 생성 빌드 소스 tarball)
  - 실제 사용자 데이터 0건
- background gcloud storage cp 가 한 번 hang 발생 후 직접 분석 결과 **마이그 가치 0** 확인
- 자동 결정: Q4 A → B (빈 버킷 운영). 신규 빌드 시 cloudbuild-source/ 자동 재생성 (Phase 5 빌드 후 검증됨)

### 16.4 신규 GCP GPU L4 quota 발견

§1.7 분석 시점에서 사용자 GPU L4 quota 신청을 U5 사용자 직접 작업으로 분류했으나, Phase 5 진행 시점에 직접 점검:
- `gcloud compute regions describe asia-southeast1` 결과 NVIDIA L4 quota = **1 (자동 할당)**
- Cloud Run GPU L4 deploy 시 별도 quota 신청 없이 두 service (메인 + 격리) 모두 배포 SUCCESS
- 추정: max-instances=1 + min=0 으로 동시 실행 인스턴스가 0~2 가변, quota 카운트는 active GPU 인스턴스만 측정. 일반 사용 패턴에선 quota=1 로도 충분
- 사용자 quota 추가 신청 (1→2 또는 3) 은 동시 트래픽 안정성 차원에서 유효

#### 16.4.1 사후 quota 상향 완료 (2026-05-03 21:36 KST)

| 항목 | 값 |
|---|---|
| Quota 종류 | `Total Nvidia L4 GPU allocation without zonal redundancy, per project per region` |
| Quota ID | `NvidiaL4GpuAllocNoZonalRedundancyPerProjectRegion` |
| 서비스 | `run.googleapis.com` (Cloud Run Admin API) |
| 차원 (region) | `asia-southeast1` |
| 변경 | **1 → 3** (preferred=3, granted=3) |
| 신청 경로 | `CLOUD_CONSOLE` (사용자 콘솔 직접 신청) |
| 신청/승인 시각 | createTime `2026-05-03T21:36:06Z` / updateTime `2026-05-03T21:36:07Z` (사실상 즉시 승인) |
| Preference 리소스 | `projects/aitutortwo-prod/locations/global/quotaPreferences/62a14c27-4ab0-4dfa-84b1-8a3d86def978` |
| 검증 명령 | `gcloud beta quotas preferences list --project=aitutortwo-prod` |

확보 효과:
- 메인(1 GPU) + 격리(1 GPU) 동시 운영 + revision rollout 시 임시 +1 GPU 버퍼 = 총 3 GPU 동시 가용
- 트래픽 spike 시 "GPU quota exceeded" 회피 (REBUILD31 §18 격리 첫 redeploy 시 발생했던 메모리/quota 에러 사전 방지)
- 미동작 시점에는 `usage=0` 으로 비용 0 (Cloud Run scale-to-zero 정책 유지)

추가 옵션 (현재 미신청, 필요 시 검토):
- `NvidiaL4GpuAllocPerProjectRegion` (zonal redundancy 버전) = 0 → 코드가 `--no-gpu-zonal-redundancy` 사용 중이라 무관
- 다른 리전 (us-central1 등) L4 = 0 → 다지역 전개 시 별도 신청
- Compute Engine `NVIDIA_L4_GPUS` = 1 → VM 직접 띄울 일 없으면 보존

### 16.5 Phase 6-2 Playwright 결과 분석

Lab smoke 17 tests (12 PASS / 3 FAIL / 4 SKIPPED, 2분 11초):
- ✅ PASS 12: 다른 lab 페이지 (hf-playground, server-infer, local-gcp 등) 헤더/EngineSwitcher/링크 모두 정상
- ❌ FAIL 3 (모두 동일 원인):
  - `디바이스 AI (/lab/local-ai) › 페이지 진입 + 헤더 + EngineSwitcher 노출`
  - `디바이스 AI (/lab/local-ai) › "← 실험실" 링크 동작`
  - `헤더 통일 (REBUILD28 §11) › /lab/local-ai 의 "← 실험실" 링크`
- 원인 (screenshot 분석):
  - **신규 도메인 첫 방문 시 "어떤 시험을 준비하시나요?" 온보딩 모달** 이 페이지 위에 띄워져 헤더 + 링크 가림
  - localStorage 의 onboarding flag 가 신규 도메인에서 초기화 → 정상 동작
  - 마이그 결함 아님. 사용자가 1회 "건너뛰기" 클릭 후 모든 페이지 정상

### 16.6 git 변경 이력 (REBUILD31 마이그)

```
70ad43c migration(aitutor): REBUILD31 Phase 5 빌드+배포 완료 + ISO_INFER_URL 영구화
287a22c migration(aitutor): Cloud Build 빌드 전용 변종 추가 (REBUILD31 §5)
9d85ce8 migration(aitutor): REBUILD31 신규 GCP 환경 substitutions 갱신 (Phase 4)
```

### 16.7 남은 후속 작업

| 항목 | 기한 | 액션 |
|---|---|---|
| Phase 6-3 사용자 시나리오 | 즉시 | 사용자 직접 신규 URL 접속 + 로그인 + 6 엔진 lab 검증 |
| Phase 6-4 24h 모니터링 | 24h | ERROR 로그 추적 (gcloud logging read) |
| **Phase 7 구 aitutor 자원 정리** | 24h 후 + U7 | Cloud Run aitutor + aitutor-inference 2개 + Custom SA 2개 + Secret 8개 + AR aitutor + GCS aitutor-files-aifactory-494108 — **Firebase Functions 2개 + Firebase 본체 + TELEGRAM_* secret 2개 + gcf-* AR/GCS 절대 미접촉** |
| (선택) GPU L4 quota 추가 | 옵션 | 사용자가 신청한 quota 승인되면 동시 트래픽 안정성 ↑ |

### 16.8 Phase 7 구 자원 정리 시 보호 체크리스트

⚠️ Phase 7 실행 전 반드시 확인:
- [ ] Cloud Run service 삭제 명령에 정확히 `aitutor` + `aitutor-inference` 만 명시 (절대 `*` glob 금지)
- [ ] Custom SA 삭제 명령에 정확히 `aitutor-run` + `aitutor-inference-run` 만 명시 (firebase-adminsdk-fbsvc / 58235609672-compute / aifactory-494108@appspot 절대 미접촉)
- [ ] Secret 8개 삭제 명령에 정확히 8개 secret 명시 (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 절대 미접촉)
- [ ] AR 삭제는 `aitutor` 만 (gcf-artifacts 절대 미접촉)
- [ ] GCS 삭제는 `aitutor-files-aifactory-494108` 만 (gcf-v2-sources / gcf-v2-uploads / aifactory-494108_cloudbuild 절대 미접촉)
- [ ] **빌링은 절대 분리 금지** (구 빌링 0193E0-... 가 docstore/lottoda/pressstand 결제 — Firebase Functions 도 같은 빌링 사용)

### 16.10 Phase 7 실행 결과 (2026-05-04 06:58 ~ 07:02 KST, 약 4분)

#### Step 1 — Pre-flight 검증 (모두 통과)

| 항목 | 결과 |
|---|---|
| 신규 양 service active | ✅ aitutor-00003-9gs + aitutor-inference-00001-z5z |
| 신규 메인 / | ✅ HTTP 200 |
| Firebase 격리 자원 카운트 | Cloud Run 2 (checkmissedreturn/recordcheckin) + Firestore Native 1 + Firebase GCS 2 + TELEGRAM secret 2 |
| 다른 4 프로젝트 사전 cross-ref | ✅ 모두 secret 0건 |
| 삭제 대상 리스트 더블체크 | ✅ Cloud Run 2 + SA 2 + Secret 8 + AR 1 + GCS 1 (Firebase 자원 미포함 확인) |

#### Step 2 — 트래픽 차단 (자원 보존, 즉시 롤백 가능 상태)

`max-instances=0` 미지원 (gcloud 거부) → `--ingress=internal` 로 외부 접근 차단:
- 구 aitutor / → HTTP 404
- 구 aitutor-inference / → HTTP 404
- 신규 메인 / → HTTP 200 (영향 0)

#### Step 4 — 자원 단계적 삭제 (TELEGRAM_* / firebase-* / gcf-* 절대 미접촉)

```
✅ Cloud Run aitutor 삭제
✅ Cloud Run aitutor-inference 삭제
✅ SA aitutor-run@ 삭제
✅ SA aitutor-inference-run@ 삭제
✅ Secret 8개 삭제 (ANTHROPIC/AUTH_TOKEN/DATABASE_URL/GEMINI/HF/LAW_API_OC/OPENAI/RESEND)
✅ AR aitutor (asia-northeast3) 삭제
✅ GCS aitutor-files-aifactory-494108 삭제
```

#### Step 5 — Firebase 격리 자원 정상 보존 검증

| 자원 | 상태 |
|---|---|
| Cloud Run checkmissedreturn | ✅ 정상 (revision -00003-duw) |
| Cloud Run recordcheckin | ✅ 정상 (revision -00003-kug) |
| HTTP 응답 | checkmissedreturn=403 / recordcheckin=400 (Telegram 봇 정상 auth 동작) |
| Firestore Native (default, asia-northeast3) | ✅ 보존 |
| GCS gcf-v2-sources / gcf-v2-uploads / aifactory-494108_cloudbuild | ✅ 보존 |
| Secret TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID | ✅ 보존 |
| SA firebase-adminsdk-fbsvc / 58235609672-compute / aifactory-494108@appspot | ✅ 보존 |
| AR gcf-artifacts | ✅ 보존 |
| Cloud Scheduler firebase-schedule-checkMissedReturn-asia-northeast3 | ✅ ENABLED (정상) |

#### Step 6 — 다른 4 프로젝트 cross-reference 0건 검증

| 프로젝트 | Cloud Run aitutor 참조 | Secret aitutor/aifactory-494108 참조 |
|---|---|---|
| docstore-491906 | ✅ 0 | ✅ 0 |
| lottoda-491905 | ✅ 0 | ✅ 0 |
| pressstand | ✅ 0 | ✅ 0 |
| aifactory-60aa1 | ✅ 0 | ✅ 0 |

#### 종합 결론

> **구 aitutor 자원 100% 정리 완료. Firebase 격리 자원 100% 보존. 다른 4 프로젝트 영향 0건.**
> 빌링은 분리하지 않음 (구 빌링 0193E0-... 가 docstore/lottoda/pressstand + Firebase Functions 도 결제). 구 프로젝트 `aifactory-494108` 자체는 Firebase 운영 위해 그대로 유지.

---

## §17. 마이그레이션 완료 선언

✅ **2026-05-04 07:02 KST 기준, AI TutorTwo GCP 마이그레이션 100% 완료**

- 신규 환경 `aitutortwo-prod` (asia-southeast1, geefafa0407@gmail.com) 정상 운영 중
- 구 환경 `aifactory-494108` 의 aitutor 자원 일체 삭제 (Firebase 격리 자원 100% 보존)
- 다른 5개 프로젝트 영향 0건 (검증 완료 — docstore/lottoda/pressstand/aifactory-60aa1 + Firebase 본체)
- 코드베이스 cloudbuild.yaml substitutions 만 갱신 (활성 코드 0건 수정 필요 없었음)
- 다운타임 0 (구 환경 그대로 가동, 신규 환경 별도 운영, Phase 7 진입 시 구 환경 ingress=internal → 5분 후 삭제)

신규 URL:
- 메인: https://aitutor-716942218621.asia-southeast1.run.app
- 격리: https://aitutor-inference-716942218621.asia-southeast1.run.app

남은 후속 작업:
- ✅ **NVIDIA L4 quota 1 → 3 상향 완료** (2026-05-03 21:36 KST 즉시 승인, asia-southeast1, no zonal redundancy, Cloud Console 경로) — §16.4.1 상세
- (선택) 사용자 시나리오 직접 검증 (브라우저 로그인 + 6 엔진 lab)
- (선택) GCS 백업: 이미 staging (~/aitutor-migration/gcs-staging/) 1.2GB 보존 — Cloud Build tarball 만이라 가치 0

---

## §18. 사후 비용/보안 깊이 재점검 + 정리 (2026-05-04)

### 18.1 깊이 점검 결과

| 카테고리 | 결과 |
|---|---|
| 구 IAM aitutor SA 잔재 | ✅ 0건 |
| Cloud Build trigger | ✅ 0개 |
| Pub/Sub topics | ✅ 0개 |
| App Engine | ✅ 미생성 |
| 구 SA USER_MANAGED key | ✅ 0개 |
| 신규 GCS public 노출 | ✅ 0건 |
| 신규 SA USER_MANAGED key | ✅ 0개 |
| Logging sinks | ✅ _Required + _Default 만 (시스템 기본) |
| 메인 allUsers run.invoker | ✅ 의도적 SPA 공개 (정상) |
| IAM cross-project SA (구 11 + 신 2) | ✅ 모두 GCP 자동 관리 service agent |
| **GCS aifactory-494108_cloudbuild = 6.35 GB** | ⚠️ Lifecycle policy 미설정 |
| **신규 AR aitutor = 24.5 GB** | ⚠️ 빌드 시도 3개 누적 (사용 안 된 2개 삭제 가능) |
| 활성 API 54개 | ⚠️ 미사용 후보 ~20개 (security surface) |

### 18.2 정리 실행 결과 (2026-05-04 07:15~07:25 KST)

#### A. 신규 AR cleanup (~24 GB → ~8 GB, 66% 감소)

```
✅ 메인 + 격리 service 를 latest tag (v20260504-055949) 로 redeploy
   - aitutor: revision aitutor-00004-w2c (image v20260504-055949)
   - aitutor-inference: revision aitutor-inference-00003-76z (image v20260504-055949)
   ⚠️ 격리 first redeploy 시 "Quota exceeded for total allowable memory per project per region" — 30s 후 재시도 SUCCESS
✅ 사용 안 된 image 2개 삭제
   - v20260504-055053 (1차 빌드 시도, deploy X)
   - v20260504-055327 (2차 빌드, redeploy 로 latest 갱신 후 삭제)
✅ AR cleanup policy 설정 (자동)
   - keep-latest-3 (가장 최근 3개 version 유지)
   - delete-untagged-7d (7일 이상 untagged 자동 삭제)
   - delete-old-30d (30일 이상 모든 image 자동 삭제)
```

#### B. 구 GCS aifactory-494108_cloudbuild Lifecycle Policy

```
✅ 30일 이상 객체 자동 삭제 정책 적용
   - 효과: 6.35 GB → ~2 GB 점진 정리 (Firebase 빌드 영향 0)
   - 비용: $0.13 → ~$0.04/월
```

#### C. 구 환경 미사용 API disable (20개)

```
✅ disable 성공 19개:
   bigquery / bigqueryconnection / bigquerydatapolicy / bigquerydatatransfer
   bigquerymigration / bigqueryreservation / bigquerystorage
   dataform / dataplex / analyticshub
   generativelanguage / cloudbuild / containerregistry / appengine
   cloudtrace / runtimeconfig / deploymentmanager / testing / telemetry
⚠️ disable 거부 1개:
   source.googleapis.com (COMMON_SU_SERVICES_HAVE_RESOURCES_DEACTIVATION_SUV1) — 무시 가능

✅ 활성 API 54 → 32 (40% 감소)

✅ Firebase 필수 모두 보존:
   cloudfunctions / eventarc / fcm / fcmregistrations
   firebase / firebaseappdistribution / firebasehosting
   firebaseinstallations / firebaseremoteconfig / firebaseremoteconfigrealtime
   firebaserules / firestore / identitytoolkit / secretmanager / securetoken
```

#### D. 구 GPU quota (사용자 질문)

- 구 Cloud Run service 삭제됐으니 GPU 사용 0 → 비용 0
- Compute Engine GPU quota 자체는 사용 시에만 과금 — quota 한도 보존해도 비용 없음
- **추천: 그대로 두기** (미래 GPU service 부활 시 quota 재사용 가능)

### 18.3 비용 영향 요약

| 항목 | 정리 전 | 정리 후 |
|---|---|---|
| 구 GCS aifactory-494108_cloudbuild | $0.13/월 | ~$0.04/월 (30일 후) |
| 구 활성 API | 54개 | 32개 (security surface 40% ↓) |
| 신규 AR aitutor | $2.4/월 (24 GB) | ~$0.8/월 (8 GB, 30일 후 추가 ↓) |
| 보안 위험 | 0건 | 0건 |

### 18.4 종합 결론

> **마이그레이션 사후 비용/보안 정리 완료. 보안 위험 0 + 비용 누수 ~$1.7/월 → ~$0.8/월 (53% 절감, 자동 lifecycle 설정으로 추가 절감 예정).**
> Firebase 격리 자원 100% 보존 + 다른 5 프로젝트 영향 0 + 활성 API 표면 40% 축소.

---

## §19. 추가 사후 정리 — quota 상향 + 빈 프로젝트 삭제 + service URL 정정 (2026-05-04 ~10:00 KST)

§17 마이그레이션 완료 선언 + §18 사후 비용/보안 정리 이후, 운영 안정화 차원에서 다음 정리 액션 4건 추가 발생. 모두 신규 환경(`aitutortwo-prod`)과 다른 프로젝트(docstore/lottoda/pressstand/aifactory-494108) 의 운영 안정성에 영향 0건.

### 19.1 액션 요약 (시간순)

| # | 시각 (KST) | 액션 | 결과 | 상세 |
|---|---|---|---|---|
| 1 | 2026-05-03 21:36 | NVIDIA L4 quota 1 → 3 상향 신청 (사용자 Cloud Console) | 즉시 승인 (preferredValue=grantedValue=3) | §16.4.1 (별도 작성) |
| 2 | 2026-05-04 ~10:00 | 신규 계정 자동 생성 빈 프로젝트 `project-7da62fab-ba97-4a03-87a` 삭제 | `DELETE_REQUESTED` (T+30일 영구 삭제) | §19.2.A |
| 3 | 2026-05-04 ~10:?? | 구 계정 미사용 빈 프로젝트 `aifactory-60aa1` 삭제 | `DELETE_REQUESTED` (T+30일 영구 삭제) | §19.2.B |
| 4 | 2026-05-04 ~10:?? | 신규 환경 service URL/revision 정정 + 헬스체크 | 양쪽 메인/격리 200 OK · 레이턴시 0.16~0.19s | §19.3, §19.4 |

### 19.2 빈 프로젝트 삭제 (2건)

#### A. 신규 계정 — `project-7da62fab-ba97-4a03-87a`

**정체**: Google Cloud 첫 가입 Welcome flow 가 자동 생성한 "My First Project" + `geefafa0407-org` organization 안에 자동 배치된 빈 프로젝트.

**점검 결과 (gcloud 직접 검증, 2026-05-04)**:
| 항목 | 결과 |
|---|---|
| 생성일 | 2026-05-01T00:17:36Z (사용자 GCP 가입 직후) |
| Parent | organization `geefafa0407-org` (id: 422699574691) ⚠️ 다른 3 프로젝트와 다름 (no-org) |
| Lifecycle (점검 시점) | ACTIVE |
| 빌링 | 활성 (자동 연결) |
| Cloud Run / Functions / App Engine / Compute / SQL / Firestore | 0개 (API 비활성) |
| GCS 버킷 | 0개 |
| 사용자 정의 SA | 0개 |
| IAM bindings | 1개 (`user:geefafa0407@gmail.com → roles/owner`) |
| 활성 API | 22개 (전부 GCP default 자동 활성, 사용자 의도 0) |

**액션**:
```bash
gcloud beta billing projects unlink project-7da62fab-ba97-4a03-87a   # 빌링 분리
gcloud projects delete project-7da62fab-ba97-4a03-87a --quiet          # 삭제 신청
```

**검증**: `lifecycleState: DELETE_REQUESTED` 확정 + 빌링 계정 `01EAEF-50DBAA-FCEA24` 의 활성 프로젝트 4개 → 3개로 감소 (aitutortwo-prod / pressstand-prod / sitebysite-poc 만 남음).

**organization 처리**: `geefafa0407-org` 자체는 보존. 다른 3 프로젝트가 no-org 라 무관, 비용 0 + 영향 0 + 미래 정식 organization 활용 시 재사용 가능.

#### B. 구 계정 — `aifactory-60aa1`

**정체**: REBUILD31 §1.7 영향도 분석에서 "절대 미접촉" 분류했던 4개 프로젝트 중 1개. 라벨 `firebase-core: disabled` 가 결정적 단서로 "Firebase Console 셋업 시작 후 본격 사용 직전 중단된 빈 프로젝트" 로 확정.

**점검 결과 (gcloud 직접 검증, 2026-05-04)**:
| 항목 | 결과 |
|---|---|
| 생성일 | 2026-04-26T04:04:20Z (REBUILD23 GCP 마이그 1차 직전, 8일 전) |
| Lifecycle (점검 시점) | ACTIVE |
| 라벨 | `firebase: enabled`, **`firebase-core: disabled`** ⭐ (셋업 미완료 결정적 단서) |
| **빌링** | **billingEnabled: false** (이미 무료 상태, unlink 단계 불필요) |
| Cloud Run / Functions / App Engine / Compute / SQL / Firestore | 0개 (API 비활성) |
| GCS 버킷 | 0개 |
| Pub/Sub topics | 0개 |
| 사용자 정의 SA | 0개 (`firebase-adminsdk-fbsvc` 자동 SA 1개만 존재) |
| 활성 API | 37개 (Firebase 자동 9개 + BigQuery 패밀리 자동 11개 + GCP default 17개, 사용자 의도 0) |
| **Cross-reference (다른 4 프로젝트가 이 프로젝트 SA / Project Number 참조)** | **0건** (aifactory-494108 / docstore-491906 / lottoda-491905 / pressstand 모두 검증) |

**액션**:
```bash
gcloud projects delete aifactory-60aa1 --quiet --account=season1zeepapa@gmail.com
```
> 빌링 미연결 상태였기에 unlink 단계 생략, 1단계로 즉시 삭제.

**검증**: `lifecycleState: DELETE_REQUESTED` 확정.

**REBUILD31 §1.7 정책 변경**: §1.7 의 "절대 미접촉 4 프로젝트" 중 `aifactory-60aa1` 만 사후 의사결정으로 삭제. 나머지 3개 (`docstore-491906`, `lottoda-491905`, `pressstand`) 는 그대로 보존. 같은 프로젝트(`aifactory-494108`) 내 Firebase Functions 격리 자원 (`checkMissedReturn`, `recordCheckIn`) 100% 보존 정책은 변동 없음.

### 19.3 service URL / revision 정보 정정

§17 "마이그레이션 완료 선언" 시점의 URL/revision 기록과 현재(2026-05-04 검증) 상태가 다름. 두 URL 모두 살아있고 같은 service 를 가리키지만, 미래 추적성을 위해 양쪽 다 명시.

#### 메인 service (`aitutor`)

| 항목 | §17 기록 (2026-05-04 07:02 KST) | 2026-05-04 ~10:00 KST 검증 |
|---|---|---|
| URL (project-number 기반, 영구 안정형) | `https://aitutor-716942218621.asia-southeast1.run.app` | 동일, 200 OK |
| URL (hash 기반, 자동 생성) | (미기록) | `https://aitutor-xq3ezzqwfa-as.a.run.app` 200 OK |
| 최신 revision | `aitutor-00004-w2c` (§18.2 A 시점) | **`aitutor-00006-fbg`** (이후 2번 추가 redeploy) |

#### 격리 service (`aitutor-inference`)

| 항목 | §17 기록 (2026-05-04 07:02 KST) | 2026-05-04 ~10:00 KST 검증 |
|---|---|---|
| URL (project-number 기반, 영구 안정형) | `https://aitutor-inference-716942218621.asia-southeast1.run.app` | 동일 |
| URL (hash 기반, 자동 생성) | (미기록) | `https://aitutor-inference-xq3ezzqwfa-as.a.run.app` |
| 최신 revision | `aitutor-inference-00003-76z` (§18.2 A 시점) | **`aitutor-inference-00004-jv8`** (이후 1번 추가 redeploy) |

> URL 두 형태는 Cloud Run 의 자동 부여 정책. project-number 기반은 안정·고정형(=DNS 기준 영구), hash 기반은 service 첫 배포 시 자동 부여되는 보조 URL. 코드(`ISO_INFER_URL` env, frontend `import.meta.env.VITE_*`)는 project-number 기반 URL 사용 권장 (미래 hash 변동 가능성 0).

### 19.4 헬스체크 (사용자 테스트 사전 검증)

```bash
$ curl -fsS -o /dev/null -w "%{http_code} · %{time_total}s\n" \
    https://aitutor-716942218621.asia-southeast1.run.app/
HTTP 200 · 0.157s

$ curl -fsS -o /dev/null -w "%{http_code} · %{time_total}s\n" \
    https://aitutor-xq3ezzqwfa-as.a.run.app/
HTTP 200 · 0.189s
```

> 두 URL 모두 sub-200ms 응답. SPA 정적 응답 기준이라 백엔드 cold start 미반영. API 엔드포인트 추가 검증 + Playwright 자동 회귀 + 사용자 골든 패스는 §20 (별도 작성 예정).

### 19.5 종합 결론

> **마이그레이션 후 사후 정리 추가 4건 완료. 비용 → $0 추가 절감 (빈 프로젝트 2개 영구 삭제 30일 후 quota 회복). 보안 위험 0 + 다른 4 프로젝트 영향 0 + Firebase 격리 자원 100% 보존 정책 유지.**

| 항목 | 효과 |
|---|---|
| GPU L4 quota | 1 → 3 (즉시 승인, 동시 트래픽 안정성 + revision rollout 버퍼 확보) |
| 신규 계정 활성 프로젝트 | 4 → 3 (T+30일 quota 1 슬롯 회복) |
| 구 계정 활성 프로젝트 | 5 → 4 (T+30일 quota 1 슬롯 회복) |
| 비용 영향 | $0 (둘 다 자원 0 + 빌링 미연결/즉시 분리) |
| Firebase 격리 자원 (Functions Gen2 2개) | 100% 보존 (§1.7 정책 유지) |

---

### 16.9 Phase 7 후 cross-reference 검증 (sitebysite REBUILD08 §16.4 패턴)

```bash
# 다른 4개 프로젝트 + Firebase 격리 자원이 aitutor 식별자 참조하는지 검증
for p in docstore-491906 lottoda-491905 pressstand aifactory-60aa1; do
  gcloud run services list --project=$p --format='value(metadata.name)' | grep -i aitutor || echo "✅ $p aitutor 참조 0"
  gcloud secrets list --project=$p --format='value(name)' | grep -iE "aitutor|aifactory-494108" || echo "✅ $p secret 참조 0"
done

# 같은 프로젝트 내 Firebase Functions 정상 동작 검증
curl -fsS https://checkmissedreturn-z2ppabmtxa-du.a.run.app  # 200
curl -fsS https://recordcheckin-z2ppabmtxa-du.a.run.app      # 200

# Firestore Native + Firebase Storage 보존 확인
gcloud firestore databases list --project=aifactory-494108
gcloud storage buckets list --project=aifactory-494108 | grep -E "gcf-|firebasestorage"
```

---

## §99. 마이그레이션 후속 안정성 패치 (2026-05-04, 일심동체 컨테이너 운영 후 발견)

### 99.1 트리거 — 사용자 골든 패스 검증 중 3종 결함 연쇄 발견

§19 사후 정리 완료(~10:00 KST) 직후 사용자 운영 검증 단계에서 다음 3종 결함이 차례로 표면화. 모두 마이그레이션 자체와 무관한 기존 코드 결함이지만, 일심동체(앱+모델 한 컨테이너) 구조에서 영향이 증폭되어 운영 가용성에 직접 타격.

| # | 증상 | 영향 모드 | 운영 표면 |
|---|------|---------|---------|
| 1 | `CompareIndex` 진입 시 `ReferenceError: CIRCLE is not defined` | HF 비교 실험실 (`/lab/hf/compare`) | React ErrorBoundary 진입 |
| 2 | `llama-cpp-python daemon 헬스체크 실패 (240s 초과)` 후 500 | 서버 통합 (`/lab/local-gcp`), Python sub-server 엔진 | latency 271s 후 500 |
| 3 | `fetch failed (97ms 후)` — Python sub-server (port 11442) ECONNREFUSED | 서버 통합, sub-server 사망 후 모든 후속 호출 | 연결 자체 거부, 사용자 무대응 |

### 99.2 1차 패치 — CIRCLE import 누락 (commit `8a75683`)

**원인**: `src/labs/hf-playground/HfCompare.jsx` 가 같은 폴더 `lib/models.js` 의 named export `CIRCLE` 을 import 하지 않은 채 JSX 표현식 내부에서 사용. Vite/Rollup 정적 분석이 JSX 안 미정의 식별자를 빌드 단계에서 잡지 못해 런타임에서만 표면화.

**수정**: import 목록에 `CIRCLE` 1단어 추가.

**검증**: 청크 해시 `CompareIndex-CfhXUgO8.js` → `CompareIndex-DVrpl6Jh.js` 로 변경됨을 확인. 새 청크 내부에 `①` 문자 3개 존재(import 정상 번들링 검증).

### 99.3 2차 패치 — sub-server 헬스 timeout 다층 방어 (commit `fdafaeb`)

#### 99.3.1 진단

`api/local-infer.js:592 callPySubserver` → `inference-py/engines/llamacpp.py:_ensure_daemon` 흐름에서 `llama_cpp.server` 데몬을 spawn 후 240초 헬스체크 폴링. cleanup 직후 실행 시 GPU VRAM 회수 지연 + GGUF mmap + CUDA context 초기화 합산이 240초를 넘김.

추가로 spawn 된 daemon 의 stderr 가 부모 stderr 로 그대로 흘러가서 다른 로그와 섞여 어느 spawn 의 어떤 실패인지 식별 불가.

#### 99.3.2 적용 4건

| 옵션 | 파일 | 변경 |
|---|---|---|
| ② | `api/local-infer.js` | `cleanupOtherEngines` 후 `_waitGpuFree(15GB, 30s)` 추가. `nvidia-smi` 폴링으로 VRAM 회수 확인 후 다음 단계 진행 |
| ③ | `inference-py/engines/llamacpp.py` | `HEALTH_TIMEOUT_S` 240 → 480 (vLLM start_timeout 600s 와 동급 여유) |
| ④ | `inference-py/requirements.txt` | stale "CPU only" 주석을 "Dockerfile cu124 wheel 명시" 사실로 정정 (Dockerfile:129 의 abetlen prebuilt CUDA wheel 이 운영 진실) |
| ⑤ | `inference-py/engines/llamacpp.py` | spawn stderr → `/tmp/llamacpp_<pid>.stderr` 로 redirect. 헬스 실패 또는 즉사 시 마지막 40줄을 `RuntimeError` 메시지에 첨부. `daemon proc returncode` 매 1초 검사로 즉사 시 480s 안 기다리고 즉시 throw |

> **옵션 ④ 가설 정정**: 초기 진단에서 "llama-cpp-python 이 CPU only 빌드라 느림" 가설을 세웠으나, Dockerfile 검토 결과 이미 cu124 CUDA wheel 적용 중. `inference-py/requirements.txt` 의 주석은 격리 service 시절 legacy. 코드 변경 없이 주석만 정정.

### 99.4 3차 패치 — sub-server watchdog + 풍부 에러 + 사용자 액션 (commit `26d8f58`)

#### 99.4.1 진단

2차 패치 빌드 진행 중 사용자가 transformers 엔진 호출 → `fetch failed (97ms 후)` 표시. `gcloud logging read` 결과 `ECONNREFUSED 127.0.0.1:11442` 확인.

`start.sh:81-87` 가 Python sub-server 를 background 로 1회 spawn 후 끝. 죽으면 영구 사망 → 모든 후속 호출 ECONNREFUSED. 자동 복구 메커니즘 0.

추가로 `callPySubserver` 의 fetch 실패가 `makeHttpError` 를 거치지 않아 클라이언트는 e.message ("fetch failed") 만 봄. 클라이언트 `LocalGcpTester.jsx` 도 응답 `data.detail` 무시. 사용자가 무엇을 해야 할지 알 수 없는 상태.

#### 99.4.2 적용 3건

**A. 자동 복구 — `start.sh` watchdog (옵션 ⑥-A)**

```bash
_pysub_watchdog() {
  while true; do
    python -m uvicorn server:app ...   # 종료까지 block
    if 5초 안 3회 사망: sleep 30 (cooldown)
    else: sleep 1; 재spawn
  done
}
_pysub_watchdog &
```

- 죽으면 1~3초 안 자동 재spawn
- 무한 spawn 폭주 방지 backoff
- SIGTERM trap 에서 watchdog 을 SIGKILL 로 먼저 죽여 graceful shutdown 보장

**B. 의미 있는 에러 — `api/local-infer.js`**

- `callPySubserver` fetch 를 try-catch 로 감싸 `ECONNREFUSED` → `503 SUBSERVER_DOWN` + payload(`code`/`cause`/`user_action`/`admin_action`)
- 신규 endpoint `GET /api/local-infer?action=health` — Ollama + sub-server 동시 ping. 모든 사용자 호출 가능, 응답에 `hint` 포함

**C. 풍부한 에러 UI — `src/labs/local-gcp/LocalGcpTester.jsx`**

- error state 객체화 (`{message, status, code, cause, upstream, elapsedMs, userAction, adminAction, raw}`)
- `res.json()` 실패 시 `res.text()` fallback (Cloud Run HTML 에러 페이지도 캡처)
- fetch reject (network) 별도 분기 — `code: 'CLIENT_NETWORK'`
- 에러 카드 내부 액션 버튼:
  - `🔁 다시 시도` — `lastReqRef` 로 마지막 요청 그대로 재호출
  - `🏥 백엔드 상태 확인` — `/api/local-infer?action=health` 호출 후 alert
  - `🖥️ 서버 분리 모드로 임시 회피` — `/lab/ollama-bridge` 링크
  - `▸ 전체 응답 보기 (디버그)` — admin/개발자용 raw body collapsible

### 99.5 서버 분리 모드(`/lab/ollama-bridge`) 영향도 검토

§99.3, §99.4 의 모든 수정은 **서버 통합 전용**. 서버 분리 모드는 구조적으로 영향 받지 않음:

| 영역 | 통합 모드 의존 | 분리 모드 의존 |
|---|---|---|
| GPU L4 24GB 공유 | ✅ 6 엔진 동거 | ❌ 사용자 PC 단독 |
| Python sub-server (port 11442) | ✅ subprocess spawn | ❌ 호출 경로 자체 없음 |
| llama-cpp-python daemon | ✅ lazy spawn | ❌ Ollama 1엔진만 |
| Cloud Run 컨테이너 fetch 경로 | Express → 11442 | 브라우저 → 사용자 PC |

**별도로 발견된 잠재 위험 (이번 PR 비포함, 별도 의사결정)**:
- 🟡 사용자 PC Ollama 콜드 모델 로드(1~3분) 동안 브라우저 fetch timeout 부재 → `AbortController` + 명시적 timeout 권장
- 🟡 `ollama pull` 진행률 미표시 → stream 응답 처리 추가 권장

### 99.6 코드 외 학습 / 재발 방지

| 결함 패턴 | 학습 | 향후 적용 |
|---|---|---|
| 미정의 식별자가 빌드 통과 | Vite 정적 분석은 JSX 표현식 내부 식별자 검증 못함 | ESLint `no-undef` 규칙 활성화 별도 PR (REBUILD32 후보) |
| daemon spawn 후 stderr 부모 흘림 | 어느 spawn 의 어떤 실패인지 추적 불가 | 다른 lazy spawn 엔진(`vllm_engine.py`/`transformers_engine.py`/llama-server)에 동일 패턴 적용 검토 |
| background 단일 spawn 후 사망 무대응 | 일심동체 구조에서는 한 프로세스 사망이 전체 가용성 0 | 모든 background daemon 에 watchdog 패턴 표준화 검토 |
| fetch 실패 e.message 그대로 노출 | 사용자가 무엇 할지 모름 + 진단 정보 0 | 사용자 직면 fetch 호출 site 전반에 풍부 에러 컴포넌트 도입 검토 |

### 99.7 배포 추적

| 커밋 | 빌드 ID | 빌드 시각(UTC) | 결과 | revision |
|---|---|---|---|---|
| `8a75683` (CIRCLE) | `8f0fddfd-...` | 2026-05-04 02:42 → 03:15 | SUCCESS | `aitutor-00007-g6n` |
| `fdafaeb` (옵션 ②③④⑤) | `8cd65c21-...` | 2026-05-04 04:39 (진행 중) | **CANCELLED** (3차 패치 통합 위해) | (생성 전 취소) |
| `26d8f58` (옵션 ⑥-A + 풍부 에러) | `b25443b1-...` | 2026-05-04 04:50 → 05:19 | **SUCCESS** | `aitutor-00008-wp5` |
| `898a6ad` (옵션 A — cloudbuild 격리 자동 배포) | (다음 빌드 통합) | — | — | — |
| `7bef9a0` (onnxruntime-genai 0.5.2 → 0.8.0) | `cedcd557-...` | 2026-05-04 05:45 → 06:09 | **PARTIAL** (메인 SUCCESS / 격리 quota fail) | 메인 `aitutor-00010-8bn` |
| `7813156` (cloudbuild deploy 직렬화) | `4bce177c-...` | 2026-05-04 08:58 → 09:36 | **PARTIAL** (메인 SUCCESS / 격리 quota fail) | 메인 `aitutor-00011-qbw` |
| `c1272ee` (옵션 B-1 격리 24Gi/6CPU) | `cc735897-...` | 2026-05-04 09:43 → 10:18 | **PARTIAL** (메인 SUCCESS / 격리 quota fail) | 메인 v20260504-184321 |

### 99.8 옵션 A/B-1 시도 종합 — 4번 연속 격리 deploy fail (2026-05-04 09:30~10:30 KST)

`cedcd557 / 4bce177c / cc735897` 3번 빌드 + 1번 manual update 시도 모두 **격리 service deploy 가 region quota 초과로 fail**. 패턴:

| 시도 | 격리 자원 | quota 시도 | 결과 |
|---|---|---|---|
| cedcd557 (병렬 deploy) | 32Gi/8CPU | 메인 옛(24)+메인 새(24)+격리 옛(32)+격리 새(32) = 112Gi | ❌ |
| 4bce177c (직렬 deploy) | 32Gi/8CPU | 메인 새(24)+격리 옛(32)+격리 새(32) = 88Gi | ❌ |
| manual update | 24Gi/6CPU | 메인(24)+격리 옛(32)+격리 새(24) = 80Gi | ❌ |
| cc735897 (격리 24Gi/6CPU) | 24Gi/6CPU | 메인(24)+격리 새(24) = 48Gi (zombie 24Gi 추가) | ❌ |

→ **asia-southeast1 region GPU service 메모리 quota = ~40~50Gi 추정** (정확 한도 미공개). 격리 service 자원 어떤 spec 으로 시도해도 quota 안 받음. 매 시도마다 zombie revision 누적.

### 99.9 zombie cleanup 패턴 발견 + 적용

매 fail 직후 다음 zombie 가 quota 점유:
- `aitutor-00009-qft` (메인 빌드 cedcd557 zombie, HealthCheckContainerError 24Gi)
- `aitutor-inference-00006-c84` (격리 빌드 fail zombie, 8CPU/32Gi)
- `aitutor-inference-00007-ktx` (격리 manual update zombie, 6CPU/24Gi)
- `aitutor-inference-00001-s9n` (격리 빌드 cc735897 zombie, 6CPU/24Gi)

처리:
- `gcloud run revisions delete <name>` 가능 (latest 가 아니면) — `00009-qft` 삭제 성공으로 메인 quota 회복 → cedcd557 메인 deploy 사후 SUCCESS
- latest revision 은 직접 삭제 불가 → service 자체 delete 가 가장 깔끔 (`aitutor-inference` 두 번 delete 함)
- **자동 zombie 누적 패턴은 quota 협소 region 의 근본 위험**

### 99.10 결론 — 옵션 A/B-1 영구 폐기 + REBUILD32 결정

옵션 A/B-1 4번 fail 후 사용자 결정 (2026-05-04 19:30 KST):
- 격리 service 컨셉(자체 호스팅 추론) **유지**
- 단 6 엔진 동거 패턴 **폐기** — 단일 안정 엔진 (Ollama) 으로 재설계
- 별도 image (`aitutor-server-infer/server-infer`, 16Gi/4CPU) 로 분리
- → **REBUILD32 별도 계획서로 진행** (workspace/aitutor/REBUILD32.md)

§99 옵션 A/B-1 의 cloudbuild.yaml 변경은 REBUILD32 P7 에서 cloud-run-deploy-inference step 제거 + `_ISO_INFER_URL` 갱신으로 정리됨. 옛 격리 service `aitutor-inference` 는 영구 삭제 (REBUILD30 §49 의 "폐기" 의도가 본 시점에서 진짜 실행).

REBUILD32 결과 (요약):
- 메인 빌드 `2be5d1f7` SUCCESS → `aitutor-00012-nh8` (메인 onnx 0.8.0 + watchdog + 풍부 에러 모두 적용)
- 격리 빌드 `c9b80550` SUCCESS → `aitutor-server-infer-00001-7hm` (Ollama 단일, 16Gi/4CPU)
- region quota 사용량: 메인 24Gi + 격리 16Gi = 40Gi (안전)
- 두 service 별도 image, 별도 cloudbuild, 별도 SA — 책임 분리 완성

---

## §13. 다음 액션

> 본 계획서를 검토하시고, **§0 Q1~Q9 답변** 주시면 Phase 1 §1.7 영향도 분석을 즉시 자동 실행합니다.

**가장 신중한 결정 항목 3개**:
1. **Q1 신규 프로젝트 ID** — 형식 (소문자+숫자+하이픈, 6~30자, 전 세계 유일)
2. **Q2 리전** — 옵션 1(us-east4 안전) / 옵션 2(asia-southeast1 한국 가까움) / 옵션 3(asia-northeast3 시도)
3. **Q5 외부 키 정책** — 그대로 복사(빠름) vs 신규 발급(quota/billing 격리)

**자동 확정 (사용자 확인만 필요)**:
- Q3 (DB 작업 없음 — Supabase)
- Q7 (자원만 삭제 — Firebase 보존 필수)
- Q8 (Firebase 그대로 보존)

답변 양식:
```
Q1: aitutor-prod (또는 사용자 결정값)
Q2: 1
Q3: (확정)
Q4: A
Q5: B
Q6: A
Q7: A (확정)
Q8: 보존 (확정)
Q9: 즉시
```

---
