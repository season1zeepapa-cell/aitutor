# REBUILD35 — Local LLM 실험실 육각형 평가 · 벤치마크 설계 · 최종 활용 계획

> **작성**: 2026-05-06 KST
> **요청**: 현재 구현된 로컬 LLM 사용 아키텍처(실험실 기능)를 육각형으로 평가하고, 실제 서비스 제공을 가정한 벤치마크 측정 방법과 최종 활용 계획을 제안.
> **범위**: 평가 설계 문서. 코드 변경 없음. 본 문서는 후속 구현 작업의 입력이 된다.
> **비현실 항목 배제**: 학술용 MMLU/HellaSwag/HumanEval 같은 일반 LLM benchmark 는 본 서비스 도메인(자격증 학습 보조)과 직접 상관이 약하므로 1차 측정에서는 제외한다.

---

## §0. 결론 요약

현재 `workspace/aitutor` 의 실험실은 **모델 비교 도구**까지는 도달했지만 **모델 선정 근거**는 없다. `/lab/local-gcp`, `/lab/server-infer`, `/lab/local-ai`, `/lab/hf`, `/lab/ollama-bridge` 다섯 모듈은 “돌려볼 수 있다”는 단계이고, 어떤 모델을 어떤 시나리오에 default 로 둘지에 대한 객관적 근거는 비어 있다.

본 문서는 이 공백을 메우기 위해 다음 세 가지를 제안한다.

1. **육각형 평가 축 6개** — 정확도 / 설명 품질 / 한국어 자연스러움 / 응답 속도 / 자원 효율 / 안정성
2. **실제 서비스 기반 벤치마크 데이터셋** — 자격증 시험 유형 4종, 학습 보조 유형 6종, 도메인 3종(영상정보관리사 / KISA 정보보안 / 운전면허) 으로 교차 구성
3. **최종 활용 계획** — 시나리오별 default 모델, fallback 정책, 사용자 노출 정책, 상시 회귀 테스트

핵심 전제: **벤치마크는 서비스 본업의 실제 prompt 분포를 재현해야 한다.** 본업에서 GPT/Gemini 가 처리하던 prompt 들을 그대로 로컬 LLM 에 흘려 보내고, 그 결과를 본업 정답/사람 평가/외부 LLM judge 와 비교한다. 이렇게 해야 “벤치마크는 좋은데 서비스에서는 별로다” 가 발생하지 않는다.

---

## §1. 평가 대상 및 평가 목적

### 1.1 평가 대상

| 서비스 | 모델 수 | 모델 예시 |
|--------|---------|-----------|
| 메인 통합 (`/api/local-infer`) | 3 | qwen25-3b, gemma2-2b, qwen35-4b |
| 격리 분리 (`/api/iso-infer`) | 15 | Qwen 3.5 2B/4B, Qwen 2.5 3B/7B, Gemma 2 2B, Gemma 4 E2B/E4B, DeepSeek R1 7B, Phi 3.5 Mini, Phi 4 14B, Llama 3.1 8B, Llama 3.2 3B, Qwen 2.5 Coder 7B, Mistral 7B, Qwen 2.5 1.5B(번역 보조) |

총 **18개 모델** 을 동일한 평가 protocol 로 비교한다. 메인/격리 catalog 는 독립이지만, 평가 프레임워크는 공유한다.

비교 기준선(baseline)으로 본업이 이미 사용 중인 외부 모델도 같은 프레임에 넣는다.

| Baseline | 호출 경로 | 역할 |
|----------|-----------|------|
| Gemini 1.5 Flash / 2.0 Flash | `/api/gemini` | 기존 본업 해설 생성 기준선 |
| GPT-4o-mini | `/api/openai` | 빠른 외부 baseline |
| Claude Haiku 3.5 / Sonnet 4 | `/api/claude` | 품질 상한선 |

baseline 은 “로컬 LLM 이 이만큼 따라잡으면 default 채택해도 좋은가” 의 기준선 역할이다.

### 1.2 평가 목적

본 평가의 결과는 다음 의사결정에 직접 쓰인다.

1. 메인 통합 service 의 default 모델 선정 (현재는 `qwen25-3b` 인데 근거가 약하다)
2. 격리 service 카드에 표시되는 “권장 모델 뱃지”의 객관적 근거 부여
3. 시나리오별 라우팅 정책 (예: 객관식 정답 → 빠른 모델, 해설 생성 → 큰 모델)
4. 외부 API 비용 절감 전략 (어떤 본업 prompt 를 로컬로 보낼 수 있는가)
5. 상시 회귀 테스트 (모델 교체/Ollama 업데이트 후 회귀 확인)

### 1.3 평가 원칙

- **현실 prompt 우선** — 본업 실제 prompt 분포를 재현. 학술 benchmark 는 1차에서 제외
- **자동화 우선** — 사람 평가는 표본만. 대다수는 자동 채점 + LLM-as-Judge
- **재현성** — 모든 실행은 seed/parameter 고정, 결과 DB 적재
- **상한·하한 명시** — baseline(GPT/Gemini/Claude) 와 함께 비교
- **운영 비용 포함** — 정확도뿐 아니라 latency, VRAM, fail rate 도 동등 가중

---

## §2. 육각형 평가 축 (6-axis)

레이더 차트의 6축은 다음과 같이 정의한다. 각 축은 0–10 점 정규화한다.

```
                정확도 (10)
                 ▲
                 │
   안정성 ◀─────┼─────▶ 설명 품질
                 │
                 ●
                 │
   자원 효율 ◀──┼──▶ 한국어 자연스러움
                 │
                 ▼
              응답 속도 (10)
```

### 2.1 정확도 (Accuracy)

- **무엇을 측정**: 객관식·단답형 정답 일치율
- **데이터**: §3.1 의 시험 유형 데이터셋
- **점수 산정**:
  - 객관식 정답률 × 5
  - 단답형 정답률 × 5
  - 합 0–10 정규화
- **자동 채점**: 가능 (정답 키 매칭)
- **목표 baseline**: Gemini 1.5 Flash 와 ±5%p 이내면 6점 이상

### 2.2 설명 품질 (Explanation Quality)

- **무엇을 측정**: 해설·개념 설명·비교 설명의 정확성, 구조, 깊이
- **데이터**: §3.2 의 학습 보조 유형 데이터셋
- **점수 산정**:
  - LLM-as-Judge (Claude Sonnet 4) 1–5점 채점 × 0.7
  - 본업 기존 정답 해설과 의미 일치율 × 0.3
- **세부 rubric**:
  - 사실 정확성 (1–5)
  - 학습자 친화 구조 (1–5, 단계 / 비유 / 핵심 강조)
  - 형식 준수 (1–5, 마크다운/번호/길이)
- **인간 표본 검증**: 도메인당 20문항 × 18모델 = 1080건 중 100건 샘플링

### 2.3 한국어 자연스러움 (Korean Fluency)

- **무엇을 측정**: 어법, 종결 어미 일관성, 전문용어 표기, 한국어→한국어 응답률
- **점수 산정**:
  - 한국어 응답률 (영어/중국어 혼입 없음) × 4
  - LLM-as-Judge fluency 점수 × 4
  - 전문용어 표기 일치율 × 2
- **자동 휴리스틱**:
  - 한자/한글/영자 비율 측정
  - 종결어미 분포 (`-다 / -요 / -습니다`)
  - 길이 분포 vs 기대 길이
- **이 축이 중요한 이유**: Qwen 계열은 think 모드/chain-of-thought 시 중국어 누출, Phi/Llama 는 영어 응답 폴백 가능

### 2.4 응답 속도 (Speed / Latency)

- **무엇을 측정**: 사용자 체감 속도
- **세부 지표**:
  - TTFT (time to first token, ms) — 스트리밍 시 핵심
  - Total latency (ms) — 비스트리밍 호출
  - Tokens/sec (생성 단계)
  - Cold-start latency (Ollama 모델 로드 시간)
- **점수 산정**:
  - TTFT 800ms 이하 → 10점, 5000ms 이상 → 0점 선형 보간
  - Tokens/sec 30 이상 → 10점, 5 이하 → 0점 선형 보간
  - 두 값의 평균
- **측정 환경 고정**: Cloud Run L4, concurrency=1, 동일 prompt set, 5회 평균

### 2.5 자원 효율 (Resource Efficiency)

- **무엇을 측정**: 정확도/응답품질 대비 자원 비용
- **세부 지표**:
  - 모델 디스크 크기 (GB)
  - 로드 시 VRAM 점유 (GB)
  - 정확도 점수 / VRAM (정규화)
- **점수 산정**:
  - VRAM 8GB 이하 + 정확도 6점 이상 → 10점
  - VRAM 16GB 이상 → 최대 5점 cap
  - 모델 크기 별 weight 부여
- **이 축이 중요한 이유**: L4 GPU 24GB 한 대에서 동시에 로드할 수 있는 모델 수가 정해지고, 본업이 함께 돌아야 하므로 자원 효율은 단순 정확도보다 운영적으로 중요할 수 있다.

### 2.6 안정성 (Reliability)

- **무엇을 측정**: 운영 환경에서 “예상대로” 동작하는지
- **세부 지표**:
  - JSON/형식 강제 prompt 의 형식 준수율
  - 거부(refusal) 비율 (한국어 자격증 콘텐츠를 거부하는가)
  - 빈 응답 / 0자 응답 비율
  - 무한 루프 / 토큰 한계 도달 비율
  - hallucination 비율 (본업 정답과 사실 충돌)
  - 100회 동일 prompt 반복 시 분산 (variance)
- **점수 산정**:
  - 형식 준수율 × 3
  - 1 - 빈응답률 × 2
  - 1 - hallucination률 × 3
  - 1 - 거부률 × 2
- **이 축이 중요한 이유**: 본업은 학습 화면에 직접 LLM 응답을 노출한다. 한 번이라도 “죄송합니다, 답변할 수 없습니다” 가 나오면 학습 흐름이 끊긴다.

### 2.7 점수 합산과 시나리오 가중치

육각형 차트는 6축을 동등 표시하되, **시나리오별 가중치**를 따로 둬서 시나리오별 챔피언을 산출한다.

| 시나리오 | 정확도 | 설명품질 | 한국어 | 속도 | 자원 | 안정성 |
|----------|--------|----------|--------|------|------|--------|
| 객관식 정답 보조 | 0.4 | 0.05 | 0.1 | 0.25 | 0.1 | 0.1 |
| 오답 해설 생성 | 0.2 | 0.4 | 0.15 | 0.05 | 0.1 | 0.1 |
| 개념 정의 / 용어 설명 | 0.15 | 0.3 | 0.2 | 0.15 | 0.1 | 0.1 |
| 학습자 자유 질문 | 0.1 | 0.25 | 0.25 | 0.15 | 0.1 | 0.15 |
| 영어 자격증 보조 | 0.3 | 0.2 | 0.1 | 0.15 | 0.15 | 0.1 |
| 코드/스크립트 보조 | 0.4 | 0.2 | 0.05 | 0.15 | 0.1 | 0.1 |

이 가중치 × 6축 점수 = 시나리오별 종합 점수. 종합 점수 1위가 “시나리오 챔피언” 이 된다.

---

## §3. 벤치마크 데이터셋 설계

### 3.1 시험 유형 데이터셋 (출제 패턴 재현)

본업이 다루는 자격증 도메인의 **실제 출제 형태**를 그대로 재현한다.

| 유형 | 도메인당 문항 | 출처 | 채점 방식 |
|------|---------------|------|-----------|
| 4지선다 객관식 | 100 | `workspace/error/qNNN.png` 기출 + DB | 정답 키 매칭 |
| 5지선다 객관식 | 100 | KISA 기출 + 변형 | 정답 키 매칭 |
| 단답형 (한 단어) | 50 | 핵심 용어 정의 거꾸로 | 사전 표준어 사전 + 동의어 사전 |
| 단답형 (한 문장) | 30 | 정의/원리 답변 | 의미 일치율 (LLM-as-Judge) |

**도메인은 3개**: 영상정보관리사, KISA 정보보안 산업기사, 운전면허(필기). 도메인당 280문항 × 3 = **840문항**.

**실제 데이터 위치**:
- 영상정보관리사: `workspace/error/qNNN.png` + Supabase `questions` (q001~q230) — 그대로 활용
- KISA: `workspace/aitutor/kisa-module/seed.json`, `chapters/`, `migrations/` — 그대로 활용
- 운전면허: `workspace/aitutor/driver-module/data/` + `source/` — 그대로 활용

추가로 **변형 문항** 30%를 만들어 “기출 그대로 학습된 가중치” 효과를 차감한다 (객관식 선택지 셔플, 부정형↔긍정형 변형, 보기 문구 패러프레이즈).

### 3.2 학습 보조 유형 데이터셋 (사용자 행동 재현)

본업에서 사용자가 LLM 에 실제로 던지는 prompt 패턴을 분류한다.

| 유형 | 도메인당 prompt | 평가 방식 |
|------|-----------------|-----------|
| 1. 오답 해설 생성 | 30 | rubric 기반 LLM-as-Judge + 본업 기존 해설과 의미 일치율 |
| 2. 개념 정의 (“X 가 뭐야?”) | 20 | 정답 정의 사전과 의미 일치 + LLM judge |
| 3. 비교 설명 (“X 와 Y 차이”) | 20 | rubric 기반 LLM judge |
| 4. 단계별 풀이 (“이 문제 풀이 순서대로”) | 20 | 정답 도달 + 단계 명확성 |
| 5. 자유 질문 (“시험 직전 한 줄 요약”) | 15 | 사람 평가 + LLM judge |
| 6. 핵심 정리 (긴 텍스트 → 요약) | 15 | rouge-style + LLM judge |

도메인당 120 prompt × 3 도메인 = **360 prompt**. 모델 18개 × 360 = **6,480 응답**. LLM judge 1회당 약 0.2초 가정 시 약 22분 (Sonnet 4 batch 사용 시 더 빠름).

**prompt 출처**:
- 본업 로그가 있다면 1차 우선
- 없다면 도메인 SME 가 페어링해서 30분 안에 도메인당 120개 작성 가능 (실제 운영 prompt 의 8 분류 × 15개씩)

### 3.3 도메인 비특이 평가셋 (안정성 / 한국어 / 거부 관련)

도메인을 안 타고 모든 모델 공통으로 측정해야 하는 지표들.

| 셋 | 문항 수 | 목적 |
|----|---------|------|
| 한국어 fluency | 50 | 일반 한국어 질의 → 한국어 응답률, 어미 분포, 영어/한자 누출률 |
| 형식 강제 | 30 | “JSON 으로만 답해라”, “3개의 bullet 로 답해라” 형식 준수율 |
| 거부 회피 | 20 | 자격증 답안인데 “법률/의료 자문 거부” 로 잘못 거부하는지 |
| 길이 통제 | 20 | “100자 이내로”, “3문장” 같은 길이 통제 prompt 준수율 |
| 일관성 | 10 prompt × 100회 | 동일 prompt 100회 반복 시 응답 분산 |

총 **약 1,130 prompt** (반복 측정 포함).

### 3.4 번역 보조 평가셋 (격리 service 전용)

`Qwen 2.5 1.5B` 번역 보조 모델은 영어 모델 사용 전후의 한↔영 변환을 담당한다.

| 셋 | 문항 수 | 목적 |
|----|---------|------|
| 한→영 (자격증 영어 지문) | 50 | KISA 영어 지문 / 운전면허 영어 표지판 |
| 영→한 (응답 한국어화) | 50 | Phi/Llama 영어 응답을 한국어로 |
| Round-trip (한→영→한 의미 보존) | 50 | BLEU + LLM judge (의미 동등성) |

번역 보조 ON 시 “영어 모델 + 번역” 파이프라인 vs “한국어 모델 단독” 비교가 가능해진다. 본 평가의 결정적 결과 중 하나는 **“번역 보조 파이프라인이 한국어 모델 단독보다 의미 있는 이점이 있는가?”** 의 답이다.

### 3.5 데이터셋 합계

| 셋 | prompt 수 | 모델당 호출 | 18 모델 합 |
|----|-----------|-------------|------------|
| 시험 유형 (3.1) | 840 | 840 | 15,120 |
| 학습 보조 (3.2) | 360 | 360 | 6,480 |
| 비특이 (3.3) | 1,130 | 1,130 | 20,340 |
| 번역 (3.4, 격리만) | 150 | 150 | 2,250 (격리 15모델) |
| **합계** | **2,480** | — | **약 44,000 응답** |

L4 GPU 단일 인스턴스 기준 응답당 평균 5초 가정 시 **약 60시간**. 분할 실행으로 야간 1주일 안에 완료 가능.

---

## §4. 평가 측정 방법

### 4.1 자동 채점 (정답 키 매칭)

대상: §3.1 시험 유형 객관식 / 단답형(한 단어).

```
응답 텍스트 → 후처리 (공백/문장부호 제거) → 정답 키와 정확 일치 / 동의어 사전 매칭
```

후처리 규칙:
- 객관식: `①②③④⑤`, `1234`, `가나다라마` 모두 동치 처리
- 단답형: 띄어쓰기·괄호·따옴표 정규화. 동의어는 도메인 사전(예: “CCTV = 영상정보처리기기”)으로 보정.

거짓 음성을 줄이기 위해 **응답 첫 줄 + 마지막 줄** 양쪽에서 정답 패턴 검색.

### 4.2 LLM-as-Judge

대상: 단답형(문장), 해설 생성, 개념 설명, 비교 설명 등 자유 응답.

**Judge 모델**: Claude Sonnet 4 (가성비 + 한국어 평가 우수). 분기 신뢰성 검증을 위해 도메인당 50건은 Gemini 1.5 Pro 와 cross-check.

**Judge prompt 표준 형식** (요지):

```
[원본 prompt]
[정답 또는 표준 해설]
[모델 응답]

다음 항목을 1~5점으로 채점하고 한 줄 사유를 함께 답하라:
- factual_accuracy
- explanation_clarity
- format_adherence
- korean_fluency
JSON 으로만 답하라.
```

Judge 결과는 DB 적재. 한 응답당 한 번만 채점. **prompt cache** 로 표준 시스템 prompt + 정답 키 부분을 캐시해 비용 절감.

비용 예상: Claude Sonnet 4 input 1M=$3, output 1M=$15. 응답 평균 input 1500 tok / output 200 tok 가정 시 약 **$0.005/응답**. 약 8,000 응답 judge → **약 $40**.

### 4.3 사람 평가 (소량 샘플)

대상: LLM judge 의 신뢰도 자체를 검증하기 위한 calibration.

- 도메인당 30건 × 3 도메인 = 90건 사람 평가
- 평가자: 도메인 SME 1–2명
- 평가 항목은 LLM judge 와 동일
- 사람 점수와 LLM judge 점수의 상관계수(Pearson) 측정. 0.7 미만이면 judge prompt 재설계.

### 4.4 시스템 메트릭 (자동 수집)

호출 단계에서 자동 수집:

| 메트릭 | 수집 위치 |
|--------|-----------|
| TTFT | `/infer` SSE 첫 chunk 수신 시각 |
| Total latency | `/infer` 응답 종료 시각 |
| Tokens/sec | 생성 토큰 수 / (Total - TTFT) |
| Cold-start | 첫 요청에서 Ollama load 까지 |
| VRAM peak | `/memory` 응답 |
| Empty response | 응답 길이 0 |
| HTTP status | 200/4xx/5xx |
| Refusal flag | “죄송합니다” / “I cannot” 등 패턴 매칭 |
| Format compliance | JSON 강제 prompt 의 JSON parse 성공 여부 |

이 메트릭들은 매 응답마다 한 row 로 DB 에 적재한다.

---

## §5. 측정 인프라 설계

### 5.1 벤치마크 러너 구조

```
workspace/aitutor/scripts/bench/
├─ run.js                          # CLI 진입점, 모델/데이터셋 선택
├─ datasets/
│  ├─ exam_videoinfo.jsonl         # 영상정보관리사 시험 유형
│  ├─ exam_kisa.jsonl              # KISA 시험 유형
│  ├─ exam_driver.jsonl            # 운전면허 시험 유형
│  ├─ learning_videoinfo.jsonl     # 영상정보관리사 학습 보조
│  ├─ learning_kisa.jsonl
│  ├─ learning_driver.jsonl
│  ├─ generic_korean.jsonl         # 한국어 fluency
│  ├─ generic_format.jsonl         # 형식 강제
│  ├─ generic_refusal.jsonl
│  ├─ generic_length.jsonl
│  └─ translator.jsonl
├─ judges/
│  ├─ exact_match.js               # 객관식/단답형
│  ├─ llm_judge.js                 # Claude Sonnet 4 judge
│  └─ heuristic_korean.js          # fluency 휴리스틱
├─ runners/
│  ├─ local_infer.js               # 메인 service /api/local-infer
│  ├─ iso_infer.js                 # 격리 service /api/iso-infer
│  └─ baseline.js                  # gemini/openai/claude
├─ collectors/
│  ├─ system_metrics.js            # TTFT/tokens/VRAM
│  └─ db_writer.js                 # Supabase bench_runs/bench_results
└─ reports/
   ├─ hexagon.js                   # 모델별 6축 점수 → JSON
   ├─ scenarios.js                 # 시나리오별 챔피언 산출
   └─ regression.js                # 이전 run 대비 회귀 검출
```

CLI 사용 예:

```bash
node scripts/bench/run.js \
  --models qwen25-3b,gemma2-2b,phi35-mini \
  --datasets exam_videoinfo,learning_videoinfo \
  --service main \
  --judge claude-sonnet-4 \
  --tag "v1-baseline"
```

### 5.2 결과 저장 schema

Supabase 테이블 2개 추가 (현재 `workspace/aitutor` 는 자체 Supabase 운영 중).

```sql
-- 한 번의 bench 실행 단위
CREATE TABLE bench_runs (
  id            BIGSERIAL PRIMARY KEY,
  tag           TEXT NOT NULL,
  service       TEXT NOT NULL,        -- 'main' | 'iso' | 'baseline'
  model_key     TEXT NOT NULL,
  dataset       TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  finished_at   TIMESTAMPTZ,
  ollama_image  TEXT,
  cloud_run_rev TEXT,
  notes         TEXT
);

-- 응답 단위 raw 결과
CREATE TABLE bench_results (
  id              BIGSERIAL PRIMARY KEY,
  run_id          BIGINT REFERENCES bench_runs(id) ON DELETE CASCADE,
  prompt_id       TEXT NOT NULL,      -- 데이터셋 내 prompt ID
  prompt_text     TEXT NOT NULL,
  expected        TEXT,               -- 정답 키 (있을 때)
  response        TEXT,
  ttft_ms         INTEGER,
  total_ms        INTEGER,
  tokens_out      INTEGER,
  empty           BOOLEAN DEFAULT FALSE,
  refused         BOOLEAN DEFAULT FALSE,
  format_ok       BOOLEAN,
  exact_match     BOOLEAN,            -- 객관식/단답형
  judge_score     JSONB,              -- {factual:5, clarity:4, ...}
  judge_model     TEXT,
  vram_peak_mb    INTEGER,
  http_status     INTEGER,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX bench_results_run_idx ON bench_results(run_id);
CREATE INDEX bench_results_model_idx ON bench_results(run_id, prompt_id);
```

### 5.3 대시보드 UI

`/lab/bench` 신규 모듈.

| 화면 | 내용 |
|------|------|
| 모델 비교 (육각형) | 동시에 최대 5개 모델 선택, 6축 레이더 차트 겹쳐 표시 |
| 시나리오별 챔피언 | §2.7 시나리오 6개 × 종합 점수 1~3위 표 |
| 데이터셋 드릴다운 | 모델 × 데이터셋 × 정확도/속도/자원 매트릭스 |
| Judge 분포 | 모델별 LLM judge 점수 히스토그램 (편향 확인) |
| 응답 샘플 | 임의 prompt 의 모델 간 응답 나란히 비교 |
| 회귀 알림 | 직전 run 대비 -10% 이상 하락한 항목 빨간 배지 |

기술 스택은 기존 `src/labs/` 패턴 그대로 React + Tailwind + Recharts (이미 의존성 있을 것). Recharts `RadarChart` 로 6축 차트 직접 그릴 수 있다.

### 5.4 측정 환경 통제

“어떤 환경에서 측정했는가” 가 결과의 신뢰도를 결정한다.

| 항목 | 통제 |
|------|------|
| Cloud Run revision | 측정 시작 시점 revision 고정. revision 바뀌면 새 run |
| concurrency | 측정 중 `--concurrency=1` 강제 (REBUILD34 P0-1 방향과 동일) |
| temperature/top_p | 모델 default 와 권장값 두 개로 각각 측정 |
| seed | 가능한 모델은 고정 seed (Ollama option) |
| keep_warm | 측정 중 강제 OFF. 매 prompt 직전 `unload-all` 한 번 → 모델 load → 추론 |
| 워밍업 | 각 모델당 warmup prompt 3개 실행 후 본 측정 시작 |
| 캐시 회피 | system prompt 에 timestamp 미포함 (judge 캐시는 유지하되 모델 자체 캐시 우회 위해 prompt id 셔플) |

---

## §6. 최종 활용 계획

평가 결과가 나오기 전에도 “결과를 어떻게 쓸 것인가” 는 미리 정의해 둔다.

### 6.1 시나리오 → default 모델 매트릭스 (목표 양식)

평가 후 다음 표를 채운다. 빈칸은 측정 결과로 결정한다.

| 시나리오 | service | default 모델 | fallback | 근거 |
|----------|---------|--------------|----------|------|
| 매장 로컬 객관식 보조 | main | TBD | TBD | 시나리오 1 챔피언 |
| 매장 로컬 해설 생성 | main | TBD | TBD | 시나리오 2 챔피언 |
| 회사 자산 한국어 풀세트 | iso | TBD | TBD | 시나리오 1+2 종합 |
| 회사 자산 영어 자격증 | iso | TBD | TBD | 시나리오 5 챔피언, 번역 보조 정책 결정 |
| 회사 자산 코드 보조 | iso | TBD | TBD | 시나리오 6 챔피언 |
| 외부 API 대체 후보 (비용 절감) | iso | TBD | gemini-flash | baseline 와 ±5%p 이내인 시나리오만 |

### 6.2 사용자 노출 정책

평가 결과는 다음 UI 요소에 직접 반영한다.

| UI | 반영 내용 |
|----|-----------|
| `/lab/server-infer` 권장 뱃지 | 시나리오별 챔피언만 “권장” 표시. 현재의 임의 추천 폐기 |
| `/lab/local-gcp` default | 시나리오 1+2 종합 1위로 default 변경 |
| 모델 카드 부가 표시 | 6축 mini-radar 썸네일 (32×32) 표시 |
| 본업 학습 화면 LLM 선택 | “빠른 추론” / “깊은 해설” / “외부 API” 3가지 프리셋, 각각 매트릭스에서 결정된 모델 매핑 |

### 6.3 외부 API 대체 정책 (비용 절감)

본업의 외부 API 호출을 로컬로 옮길지 결정하는 단일 규칙:

> **로컬 모델이 baseline(현재 사용 중인 외부 모델) 의 정확도/설명 품질에서 5%p 이내이고, 응답 속도가 baseline 의 2배 이내일 때 로컬을 default 로 한다.**

이 규칙은 보수적이다. 처음 1~2달은 외부 API 를 fallback 으로 유지하고 (10% 트래픽 shadow 호출), 4주간 회귀 알림이 없을 때 외부 API 의존도를 줄인다.

### 6.4 상시 회귀 테스트

벤치마크는 1회성이 아니다.

| 트리거 | 데이터셋 |
|--------|----------|
| Ollama 버전 업데이트 | 전 데이터셋 (full run) |
| 모델 신규 추가 | 해당 카테고리만 |
| Cloud Run revision 변경 | 시나리오 1+2 smoke (각 모델 50 prompt) |
| 매주 정기 | 시나리오 1+2 smoke |

스케줄: Cloud Scheduler → Cloud Run job 으로 야간 실행. 결과는 Slack/Telegram 알림. 회귀 -10% 이상이면 빨간 알림.

---

## §7. 단계별 실행 로드맵

| Phase | 기간 | 산출물 | 주요 작업 |
|-------|------|--------|-----------|
| Phase 1 | 1주 | 데이터셋 v1 | 시험 유형 840 / 학습 360 / 비특이 1,130 / 번역 150 prompt 작성. 기출 자산 그대로 활용, 부족분만 SME 작성 |
| Phase 2 | 1주 | 벤치마크 러너 + DB schema | `scripts/bench/` 코드, Supabase 테이블 2개 추가, judge prompt 확정 |
| Phase 3 | 1주 | 1차 측정 결과 + 육각형 차트 | 18 모델 × 2,480 prompt 야간 실행, judge 비용 약 $40, 결과 DB 적재 |
| Phase 4 | 3일 | `/lab/bench` 대시보드 | Recharts 레이더 + 시나리오 매트릭스 + 응답 샘플 비교 |
| Phase 5 | 3일 | 최종 활용 계획 확정 | §6.1 매트릭스 채우기, default 모델 변경 PR, 권장 뱃지 갱신 |
| Phase 6 | 지속 | 회귀 테스트 | 주간 smoke + 트리거 기반 full run, 알림 채널 연결 |

총 사람-주(person-week): 약 4–5 주, 1인 풀타임 가정. SME 협업이 Phase 1 의 critical path.

---

## §8. 위험과 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| Cloud Run concurrency=10 + 모델 unload 경합 | 측정 중 latency 분산 폭증 | 측정 윈도우는 `--concurrency=1` 강제 (REBUILD34 P0-1 와 호환) |
| LLM judge 의 모델 편향 (Claude 가 Claude-style 응답 선호) | 점수 왜곡 | §4.3 사람 calibration + Gemini cross-check 동시 운영 |
| 데이터셋이 본업 prompt 분포를 못 따라감 | “벤치 좋은데 서비스 별로” 재발 | Phase 1 에 본업 로그 샘플링 적용. 로그가 없으면 Phase 5 까지의 임시 결과로 다루고 로그 도입 후 재측정 |
| 도메인 SME 가용성 | Phase 1 지연 | SME 1명 부재 시 변형/생성 prompt 비율을 일시적으로 70%까지 허용. 결과 신뢰 등급은 “예비”로 표기 |
| 측정 비용 (LLM judge $) | 예산 초과 | judge 대상 응답을 1차에서는 학습 보조 + 단답형 문장 만으로 한정 (약 8,000건). 객관식은 exact match 만 |
| Ollama 모델 신규 버전 | 결과의 수명 짧음 | bench_runs 에 `ollama_image` 기록, 동일 image 재현 가능. 회귀 테스트가 자동 감지 |

---

## §9. 본 문서가 다음에 만드는 것

본 문서가 channel 되면 다음 6개 산출물이 순차적으로 생성된다.

1. `workspace/aitutor/scripts/bench/datasets/*.jsonl` — 데이터셋 v1
2. `workspace/aitutor/scripts/bench/run.js` 외 러너 코드
3. Supabase `bench_runs`, `bench_results` 테이블 + 마이그레이션 스크립트
4. `src/labs/bench/BenchDashboard.jsx` 신규 lab 모듈
5. 1차 측정 결과 보고서 (`workspace/aitutor/rebuild-docs/REBUILD36-bench-v1.md` 예정)
6. §6.1 채워진 default 모델 매트릭스 + UI 권장 뱃지 갱신 PR

REBUILD32/33/34 가 “구조 재설계” 였다면, REBUILD35 부터는 **“만들어 둔 구조를 객관적 데이터로 운영 정책화”** 단계다.

---

## §10. 부록 — 시험 유형/학습 유형 prompt 예시

실제 데이터셋 작성 시 참고용 표준 prompt 형식.

### 10.1 4지선다 객관식 (자동 채점)

```
[도메인: 영상정보관리사]
[유형: 4지선다]

다음 중 영상정보처리기기 설치·운영 시 안내판에 반드시 포함해야 하는 사항이 아닌 것은?
1) 설치 목적
2) 촬영 범위 및 시간
3) 관리책임자 연락처
4) 촬영 영상의 화질 사양

다음 형식으로만 답하라:
정답: <번호>

설명은 적지 마라.
```

기대 응답 후처리: `정답:` 다음 숫자 추출.

### 10.2 단답형 한 단어 (자동 채점 + 동의어)

```
[도메인: KISA 정보보안]
[유형: 단답형]

다음 정의에 해당하는 용어를 한 단어로 답하라:
"송신자가 개인키로 서명하고 수신자가 송신자의 공개키로 검증하는 방식의 무결성 + 인증 메커니즘"

정답:
```

동의어 사전: `전자서명`, `디지털서명`, `digital signature` 모두 동치.

### 10.3 오답 해설 생성 (LLM-as-Judge)

```
[도메인: 영상정보관리사]
[유형: 해설 생성]

문제: <원문 문제>
정답: 3번
학습자가 고른 오답: 2번

위 문제에서 학습자가 2번을 선택한 이유를 추정하고, 왜 정답이 3번인지를 다음 형식으로 설명하라:

## 핵심 개념
(2~3문장)

## 오답 분석
(학습자가 왜 2번을 골랐을지 + 그 오해를 정정)

## 정답 근거
(법령/표준 인용 가능 시 인용)
```

Judge rubric 5점 만점:
- 핵심 개념의 사실 정확성
- 오답 분석의 학습자 친화성
- 정답 근거의 출처 명확성
- 형식 준수 (3개 섹션)
- 한국어 자연스러움

### 10.4 단계별 풀이 (자동 정답 도달 + LLM judge)

```
[도메인: 운전면허]
[유형: 단계별 풀이]

다음 상황에서 운전자가 취해야 할 행동의 순서를 1, 2, 3 번호로 답하라:
"고속도로 주행 중 타이어 펑크가 났을 때"

각 단계마다 한 줄 이유를 함께 적어라.
```

자동 채점: 단계 1 에 “핸들 직진 유지” 또는 동의어 포함 여부, 단계 2 에 “감속” 포함 여부 등 키워드 사전 매칭. LLM judge 는 단계 순서의 합리성을 5점 채점.

### 10.5 자유 질문 (LLM judge + 사람 calibration)

```
[도메인: KISA 정보보안]
[유형: 자유 질문]

질문: "내일이 시험인데, 5분 안에 가장 자주 출제되는 정보보안 위협 5가지만 외우고 싶어. 외우기 좋게 알려줘."
```

Judge rubric:
- 5가지인지
- 자격증 출제 빈도와 일치하는지
- 외우기 좋은 형식 (두문자/그룹화 등)
- 길이가 5분 내 학습 가능한지
- 한국어 자연스러움

이 prompt 유형은 사람 calibration 의 우선 대상이다.

---

**문서 종료.**
