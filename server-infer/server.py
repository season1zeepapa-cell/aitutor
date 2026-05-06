"""aitutor-server-infer — Ollama 단일 엔진 추론 service (REBUILD32).

엔드포인트:
    GET  /healthz                       → Cloud Run 헬스체크 + Ollama reachability
    GET  /infer/models                  → Ollama 호환 모델 카탈로그 + 동적 가용성
    POST /infer                         → Ollama /api/chat 으로 forward (한국어 강제)
    GET  /memory                        → 메모리 상태 (Ollama 로드 + RAM + GPU VRAM) — UI 용
    POST /memory/unload-all             → 모든 Ollama 모델 즉시 unload (warm 컨테이너 유지)
    POST /memory/restart-container      → 컨테이너 자체 종료 → 다음 호출 cold start (REBUILD32 §15.5)

설계 결정:
    - 모델 카탈로그를 본 파일에 직접 정의 (격리 service 자급자족, REBUILD32 §15 R-3 독립 운영)
    - 메인 service (api/local-infer.js) 와 ollama 매핑 자체는 일치 (모델 key 충돌 방지)
    - 첫 호출 시 ollama pull 자동 (Cloud Run ephemeral 이라 콜드 스타트마다 재pull)
    - 동적 가용성: 자원 부족 모델은 클라이언트에 disabled 표시 (/infer/models 응답)
"""
import os
import re
import signal
import asyncio
import subprocess
import logging
import time
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

app = FastAPI(title="aitutor-server-infer", version="1.0.0")
log = logging.getLogger("uvicorn.error")

OLLAMA_URL = "http://127.0.0.1:11434"

# REBUILD32 — 격리 service 가 노출할 Ollama 호환 모델 (한국어 검증 통과만).
#
# REBUILD32 §15 R-3 — 통합/분리 서버 완전 독립 운영 원칙:
#   ⚠ 이 MODELS 는 격리 service (aitutor-server-infer) 의 단독 진실 소스이다.
#   통합 service (aitutor) 의 api/local-infer.js MODEL_MAP 과 의도적으로 다를 수 있다.
#   - 격리: Ollama 단일 엔진 + 단일 모델 정책 + 회사 자산 컨셉 (15 모델)
#   - 통합: Ollama 단일 엔진 + 단일 모델 정책 + 매장 로컬 AI 컨셉 (3 모델)
#   동기화 검증/공유 import 금지. 양쪽이 다른 것은 "버그"가 아니라 "의도된 차이"이다.
#
# 변경 이력:
#   1. DeepSeek R1 제거 (2026-05-04 23:11) — 한국어 응답 불안정 (당시 Qwen strict 이중 적용 환경)
#   2. 큰 모델 (4B+) 임시 제거 — region quota 40Gi 한계 (16Gi spec 으로 OOM 위험)
#   3. quota 상향 승인 (2026-05-05, 40→80GB) → 24Gi spec 복구 + 큰 모델 활성화 ✅
#   4. 동적 가용성 — /infer/models 응답에 available + reason 포함 (자원 부족 모델 자동 disabled)
#   5. REBUILD32 §15 I-1 — DeepSeek 복원: B-1 수정으로 Qwen strict 단일 경로 확보.
#      이전 불안정은 이중 적용 환경에서 테스트된 결과. 재발 시 재제거.
# UI 분류 메타 (REBUILD33 §33/§33.10 — 모델 15개 카테고리/티어 분류로 UI 인지 부담 ↓):
#   category : 'korean' (한국어 자격증 / 다국어 모델), 'english' (영어 자격증), 'code' (코드/SDK), 'translator' (번역 보조)
#   tier     : 'light' (~2GB 미만, cold start ~30초), 'balanced' (~2~5GB, 1분 내외),
#              'heavy' (~5GB 이상, 1~2분 / VRAM 압박)
#   recommended : 카테고리 내 1순위 추천 (UI 에서 ⭐ 표시)
# REBUILD33 §33.9 (2026-05-06) — 모델별 특성 메타 확장:
#   capabilities: think_supported/think_default/multimodal/context_k/tools/coder
#   params      : 권장 temperature / top_p / repeat_penalty (UI hint 용)
#   korean_strength : 1~5 (한국어 학습 데이터 + 응답 품질)
#   tips        : 한 줄 사용 팁 (UI 모델 정보 패널 노출)
def _qwen_thinking():
    """Qwen 3.5 reasoning capability (선택적). think:false 권장 (chat 시 빈 응답 방지)."""
    return {"think_supported": True, "think_default": False, "multimodal": True, "context_k": 256, "tools": True, "coder": False}

def _qwen_chat(ctx_k=32):
    """Qwen 2.5 일반 chat (reasoning 미지원)."""
    return {"think_supported": False, "think_default": False, "multimodal": False, "context_k": ctx_k, "tools": True, "coder": False}

def _gemma_chat(multimodal=False, ctx_k=8):
    return {"think_supported": False, "think_default": False, "multimodal": multimodal, "context_k": ctx_k, "tools": False, "coder": False}

def _deepseek_r1():
    """DeepSeek R1 reasoning 모델. think:true 권장 (false 시 degeneration)."""
    return {"think_supported": True, "think_default": True, "multimodal": False, "context_k": 128, "tools": False, "coder": False}

def _phi(ctx_k=128):
    return {"think_supported": False, "think_default": False, "multimodal": False, "context_k": ctx_k, "tools": False, "coder": False}

def _llama(ctx_k=128):
    return {"think_supported": False, "think_default": False, "multimodal": False, "context_k": ctx_k, "tools": True, "coder": False}

def _coder():
    return {"think_supported": False, "think_default": False, "multimodal": False, "context_k": 128, "tools": True, "coder": True}

def _mistral():
    return {"think_supported": False, "think_default": False, "multimodal": False, "context_k": 32, "tools": True, "coder": False}

def _translator():
    """번역 보조 전용 모델 (REBUILD33 §33.10) — translator: True 표시.

    번역 task 는 일반 추론과 다른 system prompt + low temperature 사용.
    capability 의 translator: True 가 클라이언트 측 파이프라인 매칭에 사용됨.
    """
    return {"think_supported": False, "think_default": False, "multimodal": False, "context_k": 32, "tools": False, "coder": False, "translator": True}

MODELS = [
    {"key": "qwen35-2b", "name": "Qwen 3.5 2B", "ollama": "qwen3.5:2b", "org": "Alibaba", "size": "~1.4GB", "note": "경량 / 한국어 강",
     "category": "korean", "tier": "light", "recommended": False,
     "capabilities": _qwen_thinking(), "params": {"temperature": 0.7, "top_p": 0.95}, "korean_strength": 5,
     "tips": "Qwen 3.5 — multimodal + reasoning capability. thinking:off 권장 (chat 시 빈 응답 방지). thinking:on 시 수학·논리 추론 강화."},

    {"key": "qwen35-4b", "name": "Qwen 3.5 4B", "ollama": "qwen3.5:4b", "org": "Alibaba", "size": "~2.5GB", "note": "균형 / 한국어 강 / 추천",
     "category": "korean", "tier": "balanced", "recommended": True,
     "capabilities": _qwen_thinking(), "params": {"temperature": 0.7, "top_p": 0.95}, "korean_strength": 5,
     "tips": "Qwen 3.5 — multimodal + reasoning. thinking:off 권장 (빈 응답 방지). 한국어 자격증 학습에 균형 잡힌 선택."},

    {"key": "qwen25-3b", "name": "Qwen 2.5 3B", "ollama": "qwen2.5:3b", "org": "Alibaba", "size": "~1.9GB", "note": "범용 / 한국어 강",
     "category": "korean", "tier": "light", "recommended": True,
     "capabilities": _qwen_chat(ctx_k=32), "params": {"temperature": 0.7, "top_p": 0.8}, "korean_strength": 5,
     "tips": "Qwen 2.5 — 한국어 학습 강. tools 호출 지원. 자격증 객관식에 충분."},

    {"key": "qwen25-7b", "name": "Qwen 2.5 7B", "ollama": "qwen2.5:7b", "org": "Alibaba", "size": "~4.4GB", "note": "고성능 / 한국어 강 (큰 모델)",
     "category": "korean", "tier": "heavy", "recommended": False,
     "capabilities": _qwen_chat(ctx_k=128), "params": {"temperature": 0.7, "top_p": 0.8}, "korean_strength": 5,
     "tips": "Qwen 2.5 7B — 고품질 한국어 응답. 큰 모델 (cold start 1~2분)."},

    {"key": "gemma2-2b", "name": "Gemma 2 2B", "ollama": "gemma2:2b", "org": "Google", "size": "~1.6GB", "note": "Gemma 안정",
     "category": "korean", "tier": "light", "recommended": False,
     "capabilities": _gemma_chat(multimodal=False, ctx_k=8), "params": {"temperature": 1.0, "top_p": 0.95}, "korean_strength": 4,
     "tips": "Gemma 2 — Google 공식 권장 temperature 1.0. 8K context (제한적)."},

    {"key": "gemma4-e2b", "name": "Gemma 4 E2B", "ollama": "gemma4:e2b", "org": "Google", "size": "~7.2GB", "note": "Gemma 신형 / 멀티모달",
     "category": "korean", "tier": "heavy", "recommended": False,
     "capabilities": _gemma_chat(multimodal=True, ctx_k=32), "params": {"temperature": 0.7, "top_p": 0.95}, "korean_strength": 4,
     "tips": "Gemma 4 — multimodal (vision). 7.2GB 큰 모델 (cold start 1~2분)."},

    {"key": "gemma4-e4b", "name": "Gemma 4 E4B", "ollama": "gemma4:e4b", "org": "Google", "size": "~9.6GB", "note": "Gemma 신형 / 멀티모달 / 큰 모델",
     "category": "korean", "tier": "heavy", "recommended": True,
     "capabilities": _gemma_chat(multimodal=True, ctx_k=32), "params": {"temperature": 0.7, "top_p": 0.95}, "korean_strength": 4,
     "tips": "Gemma 4 E4B — default 모델. multimodal (vision) + 32K. 9.6GB (cold start 1~2분)."},

    {"key": "deepseek-r1-qwen-7b", "name": "DeepSeek R1 Distill 7B", "ollama": "deepseek-r1:7b", "org": "DeepSeek", "size": "~4.5GB",
     "note": "Reasoning 특화 / Qwen 베이스 (한국어 강제 적용)",
     "category": "korean", "tier": "heavy", "recommended": False,
     "capabilities": _deepseek_r1(), "params": {"temperature": 0.6, "top_p": 0.95, "repeat_penalty": 1.15}, "korean_strength": 2,
     "tips": "DeepSeek R1 — reasoning 모델. thinking:on 권장 (off 시 degeneration). 한국어 약 (영어 단어 혼재 가능). DeepSeek 공식 temperature 0.6."},

    # ─── 영어 자격증 (TOEIC + GCP/AWS) — REBUILD33 §13.2 신규 6 모델 ──────
    # 사용자 결정 (2026-05-05 15:00 KST, Q7-a 채택): 격리 = 회사 전체 자산
    # 통합 service 와 의도된 차이 (REBUILD32 §15 R-3, REBUILD33 §20)
    {"key": "phi35-mini", "name": "Phi-3.5 Mini", "ollama": "phi3.5", "org": "Microsoft", "size": "~2.3GB", "note": "TOEIC RC / 가벼운 영어 추론",
     "category": "english", "tier": "balanced", "recommended": True,
     "capabilities": _phi(ctx_k=128), "params": {"temperature": 0.0, "top_p": 1.0}, "korean_strength": 2,
     "tips": "Phi 3.5 — Microsoft SLM. 영어 위주 + 정확성 강 (low temperature 권장). 128K context."},

    {"key": "phi4-14b", "name": "Phi-4 (14B)", "ollama": "phi4", "org": "Microsoft", "size": "~9GB", "note": "GCP/AWS 시나리오 추론 최강 (영어)",
     "category": "english", "tier": "heavy", "recommended": True,
     "capabilities": _phi(ctx_k=16), "params": {"temperature": 0.0, "top_p": 0.95}, "korean_strength": 2,
     "tips": "Phi 4 — Microsoft 최신 reasoning 강세. GCP/AWS 시나리오 영어 추론에 강. 9GB (cold start 1~2분)."},

    {"key": "llama31-8b", "name": "Llama 3.1 8B", "ollama": "llama3.1:8b", "org": "Meta", "size": "~4.7GB", "note": "TOEIC LC / 영어 일반",
     "category": "english", "tier": "heavy", "recommended": False,
     "capabilities": _llama(ctx_k=128), "params": {"temperature": 0.7, "top_p": 0.9}, "korean_strength": 3,
     "tips": "Llama 3.1 — Meta 표준 영어 chat. tools 호출 지원. 128K context."},

    {"key": "llama32-3b", "name": "Llama 3.2 3B", "ollama": "llama3.2:3b", "org": "Meta", "size": "~2.0GB", "note": "가벼운 영어 (응답 속도 우선)",
     "category": "english", "tier": "light", "recommended": False,
     "capabilities": _llama(ctx_k=128), "params": {"temperature": 0.7, "top_p": 0.9}, "korean_strength": 3,
     "tips": "Llama 3.2 — 가벼운 영어 chat. tools 호출 지원. 응답 속도 우선."},

    {"key": "qwen25-coder-7b", "name": "Qwen 2.5 Coder 7B", "ollama": "qwen2.5-coder:7b", "org": "Alibaba", "size": "~4.7GB", "note": "GCP/AWS 코드/SDK 예제",
     "category": "code", "tier": "heavy", "recommended": True,
     "capabilities": _coder(), "params": {"temperature": 0.0, "top_p": 0.9}, "korean_strength": 4,
     "tips": "Qwen 2.5 Coder — 코드/SDK 특화. low temperature (0.0~0.3) 권장. 한국어 주석 OK."},

    {"key": "mistral-7b", "name": "Mistral 7B", "ollama": "mistral", "org": "Mistral", "size": "~4.4GB", "note": "영어 다양성 (백업)",
     "category": "english", "tier": "heavy", "recommended": False,
     "capabilities": _mistral(), "params": {"temperature": 0.7, "top_p": 0.9}, "korean_strength": 2,
     "tips": "Mistral 7B — 영어 다양성 백업. function calling 지원. 32K context."},

    # ─── 번역 보조 모델 (REBUILD33 §33.10, 2026-05-06) — 한↔영 양방향 번역 파이프라인용 ──
    # 사용처: ServerInferTester 의 번역 토글 ON 시 한국어 강도 ≤2 모델 호출 전후로
    #          (1/3) 한→영 (3/3) 영→한 변환에 사용. 일반 추론은 비추천 (다른 모델 사용 권장).
    # Qwen 2.5 1.5B 가 다국어 29개 + 한국어 명시 + 986MB 가벼움으로 번역 보조에 최적.
    # category="translator" 신규 카테고리 — UI 카테고리 필터에 별도 칩으로 노출 (선택).
    {"key": "qwen25-1.5b", "name": "Qwen 2.5 1.5B", "ollama": "qwen2.5:1.5b", "org": "Alibaba", "size": "~1.0GB",
     "note": "번역 보조 (한↔영) / 다국어 29개",
     "category": "translator", "tier": "light", "recommended": False,
     "capabilities": _translator(), "params": {"temperature": 0.0, "top_p": 0.9}, "korean_strength": 5,
     "tips": "Qwen 2.5 1.5B — 번역 보조 전용. 다국어 29개 + 한국어 명시. 가벼움(~1GB) cold start ~20초. 영어 자격증 모델(Phi/Llama/Mistral) 선택 시 번역 토글 ON 으로 자동 호출됨."},
]

MODEL_BY_KEY = {m["key"]: m for m in MODELS}
# 사용자 결정 (2026-05-05 11:00 KST, quota 상향 승인 후) — 기본 모델 복구
#   gemma4-e4b (3.5GB) — Gemma 신형 멀티모달, 다국어(한국어) 안정성 우수
#   24Gi spec 으로 충분히 운영 가능. 첫 cold start 1~2분 (3.5GB pull + load).
DEFAULT_MODEL_KEY = "gemma4-e4b"

# REBUILD32 §15 I-3 — 직전 서빙 모델 캐시 (동일 모델 연속 호출 시 /api/ps 왕복 절약).
# Cloud Run uvicorn 단일 worker (--workers 1) + asyncio 단일 스레드 환경 안전.
# /memory/unload-all 시 None 으로 초기화 (모든 모델 정리됨 표시).
_last_served_model: Optional[str] = None


class InferRequest(BaseModel):
    """추론 요청 — 메인 service api/iso-infer.js 가 forward 하는 형식.

    REBUILD33 §33.9 (2026-05-06) — think 필드 신설 (사용자 토글 override).
        None  : 자동 판정 (모델별 think_default)
        True  : thinking 활성 (reasoning trace)
        False : thinking 비활성 (빠른 응답)

    REBUILD33 §33.10 (2026-05-06) — keep_warm 필드 신설 (번역 보조 파이프라인).
        False (default): 단일 모델 정책 유지 — 다른 모델 unload 후 추론 (기존 동작 100% 보존)
        True           : 번역 모드 — 다른 모델 unload skip → 번역 모델 + 추론 모델 동시 keep_alive
                         3단계 파이프라인 (번역→추론→번역) 사이 reload 비용 제거 (응답 시간 ↓)
                         메모리 누적 위험은 ♻️ 인스턴스 재시작 버튼으로 회수 가능
    """
    model_key: str
    messages: list
    max_tokens: int = 512
    temperature: float = 0.3
    think: Optional[bool] = None
    keep_warm: Optional[bool] = False


def apply_qwen_strict(messages, model_key):
    """REBUILD29 §13/§16 — Qwen / DeepSeek R1(Qwen base) 한국어 강제 + thinking 비활성.

    실험실 전체 공통 정책: thinking 모드 무조건 false.
    """
    lower = model_key.lower()
    if "qwen" not in lower and "deepseek" not in lower:
        return messages
    suffix = "\n\n반드시 한국어로 답변하세요. 사고 과정(thinking)을 표시하지 말고 바로 답변하세요."
    msgs = list(messages)
    if msgs and msgs[0].get("role") == "system":
        # 기존 system 에 정책 append
        msgs[0] = {**msgs[0], "content": msgs[0]["content"] + suffix}
    else:
        msgs = [{"role": "system", "content": suffix.strip()}] + msgs
    return msgs


async def ensure_ollama_model(ollama_tag: str):
    """모델 로컬 디스크 미존재 시 자동 pull (Cloud Run ephemeral 이라 cold start 마다 발생).

    주의: 이 함수는 디스크 캐시(/api/tags) 기준이지 메모리 로드 여부가 아님.
    실제 메모리 로드/unload 는 unload_other_models() + /api/chat 의 keep_alive 로 관리.
    """
    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            r = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
            r.raise_for_status()
            present = {m["name"] for m in r.json().get("models", [])}
        except Exception as e:
            raise RuntimeError(f"Ollama /api/tags 실패: {e}")
        if ollama_tag in present:
            return

        log.info(f"pulling ollama model: {ollama_tag} (이전 캐시 없음)")
        async with client.stream("POST", f"{OLLAMA_URL}/api/pull", json={"name": ollama_tag}) as r:
            r.raise_for_status()
            async for _ in r.aiter_lines():
                pass


async def unload_other_models(client: httpx.AsyncClient, keep_model: str):
    """REBUILD32 — 단일 모델 정책: keep_model 외 모든 모델 즉시 unload.

    배경:
        Ollama default 는 마지막 호출 후 5분 idle 시 자동 unload 인데,
        그 사이 사용자가 다른 모델 호출하면 둘 다 메모리에 누적됨 (VRAM 24GB 안에서).
        단일 모델 정책으로 누적 차단 + 의도 명확.

    구현:
        /api/ps 로 현재 메모리 로드 모델 조회 → keep_model 외 모두에
        /api/generate {keep_alive: 0, prompt: ""} 보내 즉시 unload (Ollama 표준 패턴).

    실패 무시:
        unload 가 실패해도 추론은 계속 (단지 메모리 누적될 뿐 정확성 영향 0).
    """
    try:
        ps = await client.get(f"{OLLAMA_URL}/api/ps", timeout=5.0)
        ps.raise_for_status()
        loaded = ps.json().get("models", [])
        for m in loaded:
            name = m.get("name") or m.get("model")
            if not name or name == keep_model:
                continue
            try:
                await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={"model": name, "keep_alive": 0, "prompt": ""},
                    timeout=10.0,
                )
                log.info(f"unloaded previous model: {name} (keep={keep_model})")
            except Exception as e:
                log.warning(f"unload {name} 실패 (무시): {e}")
    except Exception as e:
        log.warning(f"unload_other_models 조회 실패 (무시): {e}")


@app.get("/healthz")
async def healthz():
    """Cloud Run health check + Ollama reachability."""
    ollama_ok = False
    err = None
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
        ollama_ok = r.status_code == 200
    except Exception as e:
        err = str(e)[:120]
    return {
        "ok": True,
        "ollama_reachable": ollama_ok,
        "engine": "ollama",
        "models_count": len(MODELS),
        "default_model": DEFAULT_MODEL_KEY,
        **({"ollama_error": err} if err else {}),
    }


# REBUILD32 §X (2026-05-05) — 모델 size 파싱 + 동적 가용성 헬퍼

def _model_size_gb(size_str: str) -> float:
    """'~4.4GB' / '4.4 GiB' / '500 MB' → GB float.

    REBUILD32 §15 I-4 — 견고화:
        - GiB 가 GB 부분 매칭으로 잘못 인식되던 문제
        - GiB / MiB / MB 단위 지원 + GiB↔GB 환산 (1 GiB = 1.073741824 GB)
        - 미매칭 시 0.0 반환 (가용성 체크 skip — 보수적)
    """
    if not size_str:
        return 0.0
    s = str(size_str).upper().replace("~", "").strip()
    # GIB / MIB 를 먼저 매칭 (alternation 우선순위)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(GIB|MIB|GB|MB)\b", s)
    if not m:
        return 0.0
    val = float(m.group(1))
    unit = m.group(2)
    if unit == "GIB":
        return val * 1.073741824
    if unit == "MIB":
        return val * 1.073741824 / 1024
    if unit == "MB":
        return val / 1024
    return val  # GB


def _check_model_available(model: dict, container: dict, gpu: dict) -> tuple:
    """모델 size 와 현재 가용 자원 비교.

    Returns: (available: bool, reason: str | None)

    안전 마진:
      - RAM: 모델 size + 2GB (Ollama daemon + ollama pull 임시 버퍼)
      - VRAM: 모델 size × 1.3 (KV cache 30% overhead)
    """
    size_gb = _model_size_gb(model.get("size", ""))
    if size_gb <= 0:
        return True, None

    # RAM 확인 (가용)
    required_ram_mb = (size_gb + 2) * 1024
    avail_ram_mb = container.get("available_mb", 0) or 0
    if avail_ram_mb and avail_ram_mb < required_ram_mb:
        return False, f"RAM 부족 (필요 ~{required_ram_mb/1024:.1f}GB, 가용 {avail_ram_mb/1024:.1f}GB)"

    # GPU VRAM 확인 (free = total - used)
    required_vram_mb = size_gb * 1024 * 1.3
    if gpu.get("total_mb"):
        free_vram_mb = (gpu.get("total_mb", 0) - gpu.get("used_mb", 0))
        if free_vram_mb < required_vram_mb:
            return False, f"VRAM 부족 (필요 ~{required_vram_mb/1024:.1f}GB, 가용 {free_vram_mb/1024:.1f}GB)"

    return True, None


@app.get("/infer/models")
async def list_models():
    """Ollama 호환 모델 카탈로그 + 동적 가용성 (REBUILD32 §X).

    각 모델에 `available: bool` + `unavailable_reason: str|null` 포함.
    클라이언트는 disabled UI 표시.
    """
    # 현재 자원 상태 (RAM + GPU VRAM) 1회 조회
    container = _read_meminfo()
    gpu = _read_gpu_info()

    models_with_status = []
    for m in MODELS:
        avail, reason = _check_model_available(m, container, gpu)
        models_with_status.append({
            **m,
            "available": avail,
            "unavailable_reason": reason,
        })

    return {
        "engine": "ollama",
        "default_model": DEFAULT_MODEL_KEY,
        "default_model_key": DEFAULT_MODEL_KEY,
        "engines": [
            {"key": "ollama", "label": "Ollama", "status": "active", "note": "단일 엔진 격리 service (REBUILD32)"},
        ],
        "models": models_with_status,
        # 클라이언트 디버그용 (현재 자원 상태)
        "_resources": {
            "container_available_mb": container.get("available_mb"),
            "gpu_free_mb": (gpu.get("total_mb", 0) - gpu.get("used_mb", 0)) if gpu.get("total_mb") else None,
        },
    }


@app.post("/infer")
async def infer(req: InferRequest):
    """Ollama /api/chat 으로 추론 요청 forward."""
    # B-2: 핸들러 전체 시간 측정 시작 (pull + unload + 추론 포함)
    t_total = time.perf_counter()

    meta = MODEL_BY_KEY.get(req.model_key)
    if not meta:
        raise HTTPException(
            400,
            detail={
                "error": "unknown_model_key",
                "message": f"unknown model_key: {req.model_key}",
                "available": list(MODEL_BY_KEY.keys()),
            },
        )

    final_messages = apply_qwen_strict(list(req.messages), req.model_key)

    # 모델 자동 pull (없으면)
    try:
        await ensure_ollama_model(meta["ollama"])
    except Exception as e:
        raise HTTPException(
            503,
            detail={
                "error": "ollama_pull_failed",
                "message": f"Ollama 모델 다운로드 실패: {e}",
                "model_key": req.model_key,
                "ollama_tag": meta["ollama"],
            },
        )

    # /api/chat 호출 — REBUILD32 단일 모델 정책 적용
    global _last_served_model
    infer_ms = 0

    # REBUILD33 §33.9 (2026-05-06) — thinking 모드 결정 흐름:
    #   1) 클라이언트가 req.think 명시 → 그대로 적용 (사용자 UI 토글 우선)
    #   2) 미명시 (None) → 모델별 capabilities.think_default 자동 적용
    #     - Qwen 3.5 (qwen3.5:2b/4b)        : think_default False (빈 응답 방지)
    #     - DeepSeek R1 (deepseek-r1:7b)    : think_default True  (degeneration 방지)
    #     - 기타 thinking 미지원 모델       : 옵션 미전송 (Ollama 가 무시)
    #
    # 이전 §33.8 hotfix 는 모든 Qwen+DeepSeek 에 think:false 강제 → DeepSeek degeneration 사례 발생.
    # §33.9 에서 capabilities.think_default 로 모델별 분기 + 사용자 토글 override 추가.
    capabilities = meta.get("capabilities", {}) or {}
    think_supported = bool(capabilities.get("think_supported"))
    think_default = bool(capabilities.get("think_default"))

    if req.think is not None:
        # 클라이언트 명시값 우선 (UI 토글)
        effective_think = bool(req.think)
        think_should_send = think_supported  # 미지원 모델에는 보내지 않음
    else:
        # 자동 판정 — 모델별 권장값
        effective_think = think_default
        think_should_send = think_supported

    # 권장 옵션 — 모델별 params 가 우선, 클라이언트 요청값(temperature)은 그대로 존중
    params = meta.get("params", {}) or {}
    options = {
        "num_predict": req.max_tokens,
        "temperature": req.temperature,
        "repeat_penalty": params.get("repeat_penalty", 1.15),  # degeneration 안전장치
    }
    if "top_p" in params:
        options["top_p"] = params["top_p"]

    body = {
        "model": meta["ollama"],
        "messages": final_messages,
        "stream": False,
        "options": options,
        "keep_alive": "10m",
    }
    if think_should_send:
        body["think"] = effective_think

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            # 1) 단일 모델 정책 (REBUILD32 §15 I-3) — 직전 서빙 모델과 다를 때 unload 호출.
            #    REBUILD33 §33.10 — keep_warm=True (번역 모드) 시 unload skip → 두 모델 동시 keep_alive.
            #    keep_warm=False (default) 는 기존 동작 100% 보존 (사용자 메시지 보장).
            if not req.keep_warm and _last_served_model != meta["ollama"]:
                await unload_other_models(client, keep_model=meta["ollama"])
            # 2) 추론 — keep_alive=10m 명시 (warm 호출 빠름, 10분 idle 후 자동 unload)
            # B-2: /api/chat 순수 추론 시간만 별도 측정
            t_infer = time.perf_counter()
            r = await client.post(f"{OLLAMA_URL}/api/chat", json=body)
            infer_ms = int((time.perf_counter() - t_infer) * 1000)
    except Exception as e:
        raise HTTPException(
            502,
            detail={
                "error": "ollama_chat_network",
                "message": f"Ollama 호출 실패: {e}",
                "model_key": req.model_key,
            },
        )

    if not r.is_success:
        raise HTTPException(
            r.status_code,
            detail={
                "error": "ollama_chat_failed",
                "message": f"Ollama HTTP {r.status_code}: {r.text[:300]}",
                "model_key": req.model_key,
            },
        )

    data = r.json()
    total_ms = int((time.perf_counter() - t_total) * 1000)
    # REBUILD32 §15 I-3 — 추론 성공 시 직전 모델 갱신 (다음 동일 모델 호출 시 unload skip)
    _last_served_model = meta["ollama"]
    return {
        "answer": data.get("message", {}).get("content", ""),
        "meta": {
            "model_key": req.model_key,
            "model_name": meta["name"],
            "engine": "ollama",
            "ollama_tag": meta["ollama"],
            "infer_ms": infer_ms,   # /api/chat 순수 추론 시간
            "total_ms": total_ms,   # pull + unload + 추론 전체 시간
        },
    }


# ─── REBUILD32 — 메모리 상태 endpoint (UI 용) ─────────────────

def _read_meminfo() -> dict:
    """/proc/meminfo 파싱 → 컨테이너 RAM 사용량."""
    try:
        with open("/proc/meminfo") as f:
            mem = {}
            for line in f:
                key, _, rest = line.partition(":")
                value = rest.strip().split()[0]
                mem[key.strip()] = int(value)  # kB
        total_kb = mem.get("MemTotal", 0)
        avail_kb = mem.get("MemAvailable", 0)
        used_kb = max(0, total_kb - avail_kb)
        return {
            "total_mb": total_kb // 1024,
            "available_mb": avail_kb // 1024,
            "used_mb": used_kb // 1024,
            "percent": round(used_kb * 100 / total_kb, 1) if total_kb else 0,
        }
    except Exception as e:
        return {"error": str(e)[:100]}


def _read_gpu_info() -> dict:
    """nvidia-smi 로 GPU 메모리/사용률/온도 조회."""
    try:
        out = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu",
                "--format=csv,noheader,nounits",
            ],
            timeout=3,
            text=True,
        ).strip()
        first = out.split("\n")[0]
        parts = [p.strip() for p in first.split(",")]
        used_mb = int(parts[0])
        total_mb = int(parts[1])
        return {
            "used_mb": used_mb,
            "total_mb": total_mb,
            "util_percent": int(parts[2]),
            "temp_c": int(parts[3]),
            "percent": round(used_mb * 100 / total_mb, 1) if total_mb else 0,
        }
    except FileNotFoundError:
        return {"error": "nvidia-smi not available (no GPU)"}
    except Exception as e:
        return {"error": str(e)[:100]}


@app.get("/memory")
async def memory_status():
    """REBUILD32 — UI 용 메모리 상태 종합 (아코디언 펼침 시 호출).

    Returns:
        {
          "service": "aitutor-server-infer",
          "engine": "ollama",
          "ollama": {"reachable": bool, "loaded": [{name, size_total, size_vram, expires_at}]},
          "container": {"total_mb", "used_mb", "percent"},
          "gpu": {"used_mb", "total_mb", "percent", "util_percent", "temp_c"},
        }
    """
    result = {
        "service": "aitutor-server-infer",
        "engine": "ollama",
        "ollama": {"reachable": False, "loaded": []},
        "container": {},
        "gpu": {},
    }
    # Ollama loaded models (/api/ps)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{OLLAMA_URL}/api/ps")
            if r.status_code == 200:
                result["ollama"]["reachable"] = True
                d = r.json()
                result["ollama"]["loaded"] = [
                    {
                        "name": m.get("name") or m.get("model"),
                        "size_total": m.get("size", 0),
                        "size_vram": m.get("size_vram", 0),
                        "expires_at": m.get("expires_at"),
                    }
                    for m in d.get("models", [])
                ]
    except Exception as e:
        result["ollama"]["error"] = str(e)[:100]
    # Container RAM
    result["container"] = _read_meminfo()
    # GPU L4 VRAM + util + temp
    result["gpu"] = _read_gpu_info()
    return result


@app.post("/memory/unload-all")
async def unload_all_models():
    """REBUILD32 — 모든 Ollama 로드 모델 즉시 unload (keep_alive=0).

    학습 사용 후 메모리 회수 + 다음 호출은 cold start 보장.
    OllamaBridgeTester (사용자 PC 모드) 의 unloadAllModels() 패턴 동등.
    """
    global _last_served_model
    # REBUILD32 §15 I-3 — 모든 모델 정리되므로 직전 모델 캐시 초기화 (다음 /infer 시 강제 unload 1회 수행)
    _last_served_model = None
    unloaded: list[str] = []
    errors: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            ps = await client.get(f"{OLLAMA_URL}/api/ps", timeout=5.0)
            ps.raise_for_status()
            loaded = ps.json().get("models", [])
            for m in loaded:
                name = m.get("name") or m.get("model")
                if not name:
                    continue
                try:
                    await client.post(
                        f"{OLLAMA_URL}/api/generate",
                        json={"model": name, "keep_alive": 0, "prompt": ""},
                        timeout=10.0,
                    )
                    unloaded.append(name)
                except Exception as e:
                    errors.append(f"{name}: {e}")
    except Exception as e:
        errors.append(f"list_failed: {e}")
    log.info(f"unload_all: unloaded={unloaded}, errors={errors}")
    return {"ok": True, "unloaded": unloaded, "errors": errors}


# ─── REBUILD32 §15.5 (2026-05-05) — 컨테이너 강제 재시작 ─────────
#
# 배경 (Cloud Monitoring 데이터 기반 진단):
#   격리 service 에서 모델 4개 사이클 후 unload-all 했음에도 컨테이너 RAM 사용률
#   85% → 80% 로만 5%p 회수 (24Gi 중 19.2GB 잔재). 6분간 변화 없음.
#   원인: 모델 파일 디스크 캐시 (/var/ollama/models) + Linux 페이지 캐시 + Go runtime
#         메모리 OS 미반환. unload-all (keep_alive=0) 은 GPU VRAM + 모델 weights 만 회수.
#
# 해결:
#   uvicorn 자기 자신에 SIGTERM → graceful shutdown → start.sh wait $UVICORN_PID 깨어남
#   → start.sh 가 Ollama 정리 후 컨테이너 종료 (R-4 패턴) → Cloud Run 이 다음 호출 시
#   새 인스턴스 spawn (cold start) → 메모리 100% 회수.
#
# 사용:
#   사용자 명시 호출 (UI 의 ♻️ 인스턴스 재시작 버튼). 다음 호출은 cold start 감수.

async def _delayed_terminate(delay_sec: float = 0.6):
    """응답 flush 후 PID 자기 자신에 SIGTERM 보내 graceful shutdown 트리거."""
    try:
        await asyncio.sleep(delay_sec)
        log.info("restart-container: sending SIGTERM to self (PID %d)", os.getpid())
        os.kill(os.getpid(), signal.SIGTERM)
    except Exception as e:
        log.warning("restart-container: terminate 실패: %s", e)


@app.post("/memory/restart-container")
async def restart_container():
    """REBUILD32 §15.5 — 컨테이너 자체 종료로 메모리 100% 회수.

    동작 순서:
        1. 본 응답 즉시 반환 (200 OK)
        2. 백그라운드 task 가 0.6초 후 자기 PID 에 SIGTERM 발송
        3. uvicorn graceful shutdown → bash 의 wait $UVICORN_PID 깨어남
        4. bash 가 Ollama daemon kill + wait → 컨테이너 종료 (exit 0)
        5. Cloud Run 이 다음 호출 시 새 인스턴스 spawn (cold start)

    주의:
        - 다음 호출은 인증 통과 후 ~30초~2분 cold start (모델 lazy pull 포함).
        - min-instances=0, max-instances=1 환경에서만 의도대로 동작.
    """
    global _last_served_model
    _last_served_model = None  # 컨테이너 종료 예정이므로 캐시도 초기화

    asyncio.create_task(_delayed_terminate())
    log.info("restart-container 예약: 0.6초 후 SIGTERM 발송")
    return {
        "ok": True,
        "message": "컨테이너 재시작 예약됨 (다음 호출은 cold start)",
        "next_call_warning": "30초~2분 (모델 pull 포함) 소요 예상",
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
