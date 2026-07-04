# REBUILD67 — AI API 키 UI 입력 + 관리자 전체/개인 토글 (DB 기반 BYOK)

> **작성**: 2026-07-01 KST
> **범위**: `api/_llm/crypto.js`(신규), `api/_llm/apikeys.js`(신규), `api/ai-keys.js`(신규), `api/gemini.js`, `api/openai.js`, `api/claude.js`, `api/_kisa/llmGrader.js`, `api/kisa-attempt.js`, `api/pool-upload.js`, `api/import-docstore.js`, `server.js`, `src/tabs/SettingsTab/ApiKeyCard.jsx`(신규), `src/tabs/SettingsTab/index.jsx`, `src/hooks/useSSE.js`
> **목적**: 외부 LLM(Gemini·OpenAI·Claude) API 키를 `.env` 대신 **AI 설정 화면에서 직접 입력**하도록 전환한다. 관리자는 **전체(공용)/개인** 모드를 토글해, 공용 키를 전 회원에 일괄 적용하거나 회원별 개인 키(BYOK)를 강제할 수 있다.

---

## §1. 배경 / 요구사항

기존에는 3개 프로바이더 키가 서버 `.env`(`GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`)에 고정돼 있었고, 모든 LLM 호출이 서버 프록시에서 `process.env`를 읽어 사용했다. 요구사항:

1. 키를 **AI 설정 UI에서 입력**하는 방식으로 변경.
2. **관리자 전용** 토글로 **전체/개인** 선택.
   - **전체(shared)**: 관리자가 저장한 키를 **모든 회원이 동일하게 사용**.
   - **개인(individual)**: 관리자는 본인 키, **다른 모든 회원은 리셋**되어 각자 키를 입력·저장.
3. 키가 없는 LLM은 **안내 메시지**, 있으면 그 키로 동작.

## §2. 보안 설계 (황금 규칙)

- **키는 브라우저로 절대 내려보내지 않는다(쓰기 전용).** GET 응답은 존재 여부(`hasKey`) + 마스킹(`masked`, 앞4·뒤4)만 반환. `localStorage` 저장 금지 유지.
- **DB 저장 시 AES-256-GCM 암호화**(`api/_llm/crypto.js`). 비밀키는 `API_KEY_ENC_SECRET`(없으면 기존 `AUTH_TOKEN_SECRET` 재사용)에서 scrypt로 32B 파생. 저장 포맷 `v1:<iv>:<tag>:<cipher>`(base64). DB 덤프 유출돼도 복호화 불가.
- **전체 모드 남용 주의**: 공용 키를 전 회원이 쓰면 비용이 관리자 계정으로 집중 → 기존 `llm_usage_log` + 관리자 대시보드로 감시.

## §3. 데이터 모델

| 저장소 | 키 | 값 |
|---|---|---|
| `aitutor_settings` | `api_key_mode` | `'shared'`(기본) / `'individual'` |
| `aitutor_settings` | `shared_api_key_<provider>` | 관리자/공용 키(암호문) |
| `aitutor_settings` | `api_key_seeded` | `.env` 이관 완료 플래그(`'true'`) |
| `aitutor_user_api_keys`(신규) | `(user_id, provider)` PK, `key_enc` | 회원 개인 키(암호문) |

- provider = `gemini` / `openai` / `claude`. (키는 **프로바이더 단위** — 모델별 아님.)
- 테이블은 `ensureTable()`로 최초 접근 시 자동 생성(기존 `user_lab_settings` 패턴).

## §4. 키 해석 로직 — `resolveApiKey(provider, user)`

모든 LLM 호출 **직전**에 호출. 반환 없으면(`null`) 호출 중단 + 안내.

```
mode = getMode()
if mode === 'shared'      → shared_api_key_<provider>          (전원 공용)
else (individual):
   user.admin             → shared_api_key_<provider>          (관리자 = 본인/공용 슬롯)
   그 외 회원             → aitutor_user_api_keys[user.uid]     (개인 키)
```

- **무중단 전환**: 관리자가 AI설정 GET 최초 진입 시 `seedFromEnv()`가 `.env` 키를 `shared_api_key_*`로 1회 이관(이후 `.env` 무시). → "DB만 사용" 결정을 지키면서 전환 순간에도 서비스 지속.
- **개인 모드 전환 시** `DELETE FROM aitutor_user_api_keys`로 전 회원 개인키 리셋(요구사항).

## §5. 엔드포인트 — `api/ai-keys.js` (`withAuth`)

- `GET  /api/ai-keys` → `{ mode, isAdmin, providers:{<p>:{label,hasKey,masked}}, encReady }`. 관리자는 진입 시 seed 실행.
- `POST { action:'set_mode', mode }` — 관리자 전용. individual 전환 시 회원 키 리셋.
- `POST { action:'set_key', provider, key }` — 관리자→공용 슬롯 / 회원→개인 슬롯(개인 모드일 때만, 아니면 403).
- `POST { action:'clear_key', provider }` — 위와 동일 라우팅.
- `server.js` `apiFiles`에 `'ai-keys'` 등록.

## §6. 호출부 배선 (env 직접참조 → resolver)

전 프로바이더 호출 지점을 `resolveApiKey`로 교체하고, 키 없으면 표준 에러 `{ code:'no_api_key', provider, error }` 반환:

| 파일 | 대상 | 비고 |
|---|---|---|
| `api/gemini.js` / `openai.js` / `claude.js` | 카드 학습 AI 해설 프록시(스트림+일반) | 400 JSON 반환 |
| `api/_kisa/llmGrader.js` | KISA 보조 채점 3종 | `gradeWithLlm(…, user)` 4번째 인자로 user 전달 |
| `api/kisa-attempt.js` | KISA 해설 스트리밍(streamGemini/OpenAI/Claude) | SSE `error` 이벤트로 안내 |
| `api/pool-upload.js` | 기출 OCR(Gemini Vision) | 관리자 컨텍스트 |
| `api/import-docstore.js` | 해설 자동생성(3종) | 관리자 컨텍스트 |

- `_llm/{gemini,openai-chat,anthropic}.js`의 `apiKey = process.env.*` **기본 매개변수는 유지**하되, 모든 호출부가 명시적으로 `apiKey`를 전달하므로 실제 도달하지 않음(안전망).

## §7. 프론트 — `ApiKeyCard.jsx`

역할·모드 자동 분기 단일 카드:
- **관리자**: `[전체/개인]` 세그먼트 토글 + 3개 프로바이더 키 입력(공용/본인). 개인 전환 시 확인 다이얼로그(회원 키 초기화 경고).
- **회원 + 전체모드**: "공용 키 사용 중" 안내(입력 없음).
- **회원 + 개인모드**: 3개 프로바이더 개인 키 입력.
- 입력은 `type=password` + 저장 후 입력칸 비움. 상태는 `✅ 마스킹` 또는 `미설정`.
- 배치: 관리자 = 설정 > **AI 설정** 탭 상단, 회원 = 설정 > **내 계정** 상단(중복 방지 `!isAdmin` 가드).
- `useSSE.js`: 응답 `code==='no_api_key'`면 폴백 재요청 없이 즉시 안내 표시.

## §8. 배포 전제 / 검증

- **환경변수**: 운영에 `AUTH_TOKEN_SECRET`이 이미 있으므로 암호화는 별도 설정 없이 동작(fallback). 전용 키를 원하면 `API_KEY_ENC_SECRET` 추가 권장. ⚠️ 비밀키가 바뀌면 기존 암호문은 복호화 불가 → 키 재입력 필요.
- 백엔드 11개 파일 `node --check` 통과, 프론트 `npm run build:fe` 정상.
- `.env` 키는 seed 이후 무시되지만 파일 자체는 보존(롤백 안전망).
