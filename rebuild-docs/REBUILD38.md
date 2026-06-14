# REBUILD38 — Ollama Bridge 실험실 페이지 "문제 해결 팁" 카드 추가

> **작성**: 2026-05-07 KST
> **범위**: `workspace/aitutor/src/labs/ollama-bridge/OllamaBridgeTester.jsx` (UI 전용 변경, 인프라/엔진 무영향)
> **목적**: 사용자가 데스크톱 Ollama 셋업 중 자주 부딪히는 6가지 함정에 대한 인-페이지 자가 진단 가이드 + 복사 가능한 해결 명령어 제공
> **트리거**: 실 사용자 보고 케이스 — `brew services restart ollama` → "Formula `ollama` is not installed" 에러 (= ollama.com 데스크톱 앱 설치자가 brew 명령을 잘못 시도한 케이스)

---

## §0. 결론 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 셋업 가이드 카드 | 1개 (6단계: 설치→모델→CORS→재시작→검증→Mixed Content) | 동일 (변경 없음) |
| 문제 해결 카드 | **없음** | **신설 — 6 Tip + 7개 에러 매핑 표** |
| 복사 가능 코드 블록 | 셋업 가이드에 7개 | 셋업 가이드 7개 + **문제 해결 13개** |
| 동적 origin 자동 삽입 | 일부 (CORS 검증 1개) | **전 코드 블록** (CORS / plist / 일괄 점검) |
| 사용자 자가 진단 흐름 | 부재 (6단계 가이드만 단방향) | **에러 → 원인 → 해결 매핑 표** 1개 (Tip 6) |

**핵심 효과**:
1. 사용자가 외부 검색 / 챗봇 도움 없이 페이지 내에서 셋업 + 문제 해결 완결
2. 실 보고 케이스(`Formula ollama is not installed`)가 페이지 내 표 한 줄로 즉시 해결
3. CORS 보안 권장 (`*` 대신 특정 origin) + plist 영구 저장 명령이 페이지 내 복사 한 번으로 적용 가능

---

## §1. 변경 사항 — 코드 단위

### 1.1 신규 state 추가 (1줄)

**파일**: `workspace/aitutor/src/labs/ollama-bridge/OllamaBridgeTester.jsx` (74:75)

```diff
  const [showHelp, setShowHelp] = useState(false);
+ const [showTroubleshoot, setShowTroubleshoot] = useState(false);  // 🛠️ 문제 해결 팁 카드 펼침 토글
  const t0Ref = useRef(0);
```

기존 `showHelp` 와 동일 패턴 — 접이식 카드(▼/▲)의 펼침/접힘 상태 관리.

### 1.2 신규 JSX 카드 추가 (~180줄)

**위치**: 기존 "❓ 데스크톱 셋업 가이드" 카드(line ~423-535) **바로 다음**, "⚙️ Ollama 연결 설정" 카드 **이전**.

**카드 헤더**:
```
🛠️ 문제 해결 팁 — 자주 막히는 곳 (CORS / 재시작 / 영구 저장 / 에러 해석)
```

기존 도움말 카드와 동일 스타일 (`rounded-xl border border-border bg-card-bg` + 접이식 토글 버튼).

### 1.3 사용한 컴포넌트 (재사용 / 신규 없음)

기존 `CodeBlock` 컴포넌트(line 32-56) 그대로 재사용:
- 우상단 📋 복사 버튼 자동 포함
- 클릭 시 `navigator.clipboard.writeText()` → ✓ 복사됨 1.5초 표시
- 다크모드 대응 색상

신규 컴포넌트 도입 없음 (기존 자산 재사용).

---

## §2. 추가된 6개 Tip — 내용 요약

### Tip 1 — CORS 보안 강화 (`*` 대신 특정 origin)

**문제 의식**: 기존 셋업 가이드는 `OLLAMA_ORIGINS=*` 만 안내 → 모든 사이트에서 사용자 PC Ollama 호출 가능 (보안 위험).

**가이드 내용**:
- `*` 위험성 비유 (현관문 열어둠)
- 권장 — 콤마로 특정 origin 만 허용
- 동적 삽입: 사용자가 보는 페이지 origin (`window.location.origin`) + 로컬 개발 포트 (5173, 3000) 자동 채워짐
- Origin 형식 규칙 (프로토콜+호스트+포트 까지만, 경로/끝 슬래시 ❌)

**복사 가능 코드 블록 2개**: `*` 위험 예시 + 안전 권장 예시.

### Tip 2 — 데스크톱 앱 vs Homebrew 설치 차이 (재시작 명령 구분)

**문제 의식**: 사용자 보고 — `brew services restart ollama` → "Formula `ollama` is not installed" 에러.

**가이드 내용** (테이블):

| 설치 방법 | 확인 명령 | 재시작 방법 |
|-----------|-----------|-------------|
| 데스크톱 앱 (`ollama.com .dmg`) | `ls /Applications/Ollama.app` | AppleScript / `open -a` |
| Homebrew (`brew install`) | `brew list ollama` | `brew services restart ollama` |

**핵심 메시지**: "Formula not installed" 에러는 데스크톱 앱 설치 신호 → 정상. AppleScript 방식 사용.

### Tip 3 — Ollama 재시작 명령 3가지 (상황별)

**가이드 내용**:

1. **⭐ 권장 — 정중한 종료 (AppleScript)**
   ```bash
   osascript -e 'quit app "Ollama"' && sleep 2 && open -a Ollama
   ```
   - 앱이 정리(임시 파일, 진행 중 다운로드) 후 종료 → 안전
   - 평소 사용

2. **🚨 강제 종료 — 앱 응답 없을 때만**
   ```bash
   pkill -x Ollama && sleep 2 && open -a Ollama
   ```
   - `-x` = 정확히 'Ollama' 이름 (안전)
   - 응답 없으면 `pkill -9 -x Ollama` (SIGKILL)

3. **🖱️ 수동 — 메뉴바**
   - 🦙 클릭 → Quit Ollama → Launchpad / Spotlight 재실행

각 명령 별도 `CodeBlock` (복사 버튼 개별).

### Tip 4 — 환경변수 적용 검증 (2단계)

**문제 의식**: 사용자가 setenv 했는데 안 된다고 호소하는 케이스 → 대부분 Ollama 미재시작 또는 옛 값 잔존.

**가이드 내용**:

A) 시스템 환경변수 등록 확인
```bash
launchctl getenv OLLAMA_ORIGINS
```

B) Ollama 가 실제 CORS 헤더 내려주는지 (가장 중요!)
```bash
curl -H "Origin: ${window.location.origin}" -I http://localhost:11434/api/version
```
응답에 `Access-Control-Allow-Origin: ...` 헤더가 있어야 OK.

📋 일괄 점검 스크립트 (한 번 실행으로 1+2+3 다 확인):
```bash
echo "=== 1) 환경변수 ===" && launchctl getenv OLLAMA_ORIGINS
echo "=== 2) Ollama 응답 ===" && curl -s http://localhost:11434/api/version
echo "=== 3) CORS 헤더 ===" && curl -s -H "Origin: ..." -I http://localhost:11434/api/version | grep -i "access-control"
```

### Tip 5 — LaunchAgent plist 영구 저장

**문제 의식**: `launchctl setenv` 는 재부팅 시 사라짐 → 매번 다시 입력 귀찮음 → 사용자가 setenv 안 하고 페이지 열어서 또 막히는 악순환.

**가이드 내용**:

1. **셋업 스크립트** (한 번 실행)
   - `~/Library/LaunchAgents/com.ollama.origins.plist` 생성 (heredoc)
   - `chmod 644`
   - `plutil -lint` 로 XML 문법 검증
   - `launchctl bootstrap gui/$(id -u)` 로 등록
   - `launchctl getenv OLLAMA_ORIGINS` 로 확인
   - 모두 한 블록(15줄)에 들어가 복사 한 번으로 완성

2. **값 변경 시** (unload → 수정 → load)
   ```bash
   launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ollama.origins.plist
   nano ~/Library/LaunchAgents/com.ollama.origins.plist
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ollama.origins.plist
   osascript -e 'quit app "Ollama"' && sleep 2 && open -a Ollama
   ```

3. **완전 제거**
   ```bash
   launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ollama.origins.plist
   rm ~/Library/LaunchAgents/com.ollama.origins.plist
   ```

⚠️ 주의 함정: Ollama 자동시작 + plist 로드 race condition → 시스템 설정 → 일반 → 로그인 항목에서 Ollama 제거 권장.

### Tip 6 — 자주 보는 에러 메시지 해석 (7개)

**테이블 형식** — 사용자가 콘솔/터미널에서 본 에러 메시지로 즉시 검색 가능:

| 에러 메시지 | 원인 | 해결 |
|-------------|------|------|
| `Formula \`ollama\` is not installed` | 데스크톱 앱 설치 (brew 아님) | Tip 3 의 osascript 방식 |
| `Application isn't running` | Ollama 가 이미 꺼져있음 | `open -a Ollama` 만 |
| `Can't get application "Ollama"` | 앱 이름이 다름 | `ls /Applications \| grep -i ollama` |
| `No 'Access-Control-Allow-Origin' header` | CORS 환경변수 미적용 | setenv 후 **Ollama 재시작 필수** |
| `net::ERR_FAILED 403` | CORS 또는 mixed content | Tip 1 + 6단계 가이드 6️⃣ |
| `net::ERR_CONNECTION_REFUSED` | Ollama 가 안 켜져 있음 | `open -a Ollama` + curl 확인 |
| `Bootstrap failed: 5: Input/output error` | plist 이미 등록됨 (중복) | `launchctl bootout` 먼저 |

### 마무리 안내 박스

파란색 안내 박스 — 그래도 안 풀릴 때 사용자가 보고할 3가지 데이터:
1. `launchctl getenv OLLAMA_ORIGINS` 출력
2. `curl -I http://localhost:11434/api/version` 응답 헤더 전체
3. 브라우저 콘솔 에러 메시지

---

## §3. 검증

### 3.1 빌드 통과

```bash
cd workspace/aitutor && npx vite build
```

결과: `✓ built in 2.94s` — 에러 0, 기존 청크 사이즈 경고 그대로(이번 변경분 무영향).

### 3.2 동적 origin 삽입 확인 패턴

기존 코드(line 504)에서 이미 사용 중인 패턴 그대로 재사용:
```jsx
${typeof window !== 'undefined' ? window.location.origin : 'https://your-site.run.app'}
```

이 패턴이 새 카드의 5개 코드 블록에 적용됨 (Tip 1, 4, 5).

### 3.3 디자인 일관성

기존 `showHelp` 도움말 카드의 모든 스타일 클래스 그대로 재사용:
- `rounded-xl border border-border bg-card-bg` (외곽)
- `text-[11px] text-text-secondary leading-relaxed` (본문 폰트)
- `text-[10.5px] font-semibold` (소제목)
- `text-[10px] opacity-80` (보조 설명)
- 다크모드: `dark:bg-emerald-900/20`, `dark:bg-blue-900/20` 등

신규 색상 토큰 / Tailwind 커스텀 도입 없음.

---

## §4. 영향 범위

| 항목 | 영향 |
|------|------|
| 백엔드 API | ❌ 무영향 |
| Ollama 엔진 / GPU | ❌ 무영향 |
| 다른 실험실 (`/lab/*`) | ❌ 무영향 (해당 페이지 단일 파일 수정) |
| Cloud Run 자원 / 비용 | ❌ 무영향 (UI 텍스트/JSX 추가만) |
| 빌드 사이즈 | 🟡 미미 — `index-Dmqvp-Vc.js` 6,081 kB (기존 6,071 kB 대비 +10 kB, gzip +2 kB) |
| 인프라 (cloudbuild.yaml, Dockerfile) | ❌ 무수정 |
| DB 스키마 / Supabase | ❌ 무영향 |

**롤백 비용**: 매우 낮음 — 이 커밋만 revert 하면 즉시 복구 (단일 파일).

---

## §5. 후속 액션 (선택)

이번 PR 의 직접 범위는 아니나, 같은 페이지 추가 개선 후보:

1. **자동 진단 버튼** — 페이지 진입 시 자동 ping + 실패 시 Tip 표 자동 펼침 + 해당 에러 행 하이라이트
2. **OS 자동 감지 분기** — 현재 detectOS() 함수 활용 → mac 외 사용자에게도 윈도우/리눅스 변형 표시
3. **Ollama 자동 시작 비활성화 매크로** — 사용자가 클릭 한 번으로 로그인 항목에서 Ollama 제거하는 매크로(외부 앱 호출 없이는 어려움 → 안내 텍스트만 가능)

위 3개는 별도 REBUILD 문서로 분리 (REBUILD39+) 검토.

---

## §6. 커밋 / 배포 흐름

```bash
# 1) 빌드 통과 확인
cd workspace/aitutor && npx vite build  # ✓ built in 2.94s

# 2) Cloud Run 재배포 (인프라 변경 없음 — 단순 코드 푸시)
gcloud builds submit --config cloudbuild.yaml --project=aitutortwo-prod

# 3) 검증
#    - 배포된 URL/lab/ollama-bridge 접속
#    - "🛠️ 문제 해결 팁" 카드 펼치기
#    - 6개 Tip 모두 표시되는지
#    - 코드 블록 📋 복사 버튼 동작 확인
#    - 동적 origin 부분이 실제 배포된 URL 로 자동 채워졌는지

# 4) 사용자 보고 케이스 재현 → Tip 2 / Tip 6 의 표 한 줄로 답변 가능한지 확인
```

---

**완료 일시**: 2026-05-07 KST
**다음 문서**: 후속 액션(§5) 진행 시 REBUILD39+
