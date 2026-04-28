# KISA 문항 생성 가이드 (Claude Code 전용)

> **Claude Code가 `kisa-pool/` PDF를 분석하여 문항을 생성할 때 반드시 이 가이드를 따를 것.**
> INDEX.md의 chapter_code와 1:1 매핑 필수.

---

## 📌 생성 절차

```
1. INDEX.md 로드 → 항목 목록 파악
2. kisa-pool/*.pdf 에서 해당 항목 관련 페이지 Read
3. 중복 확인: 기존 seed.json + seed/**/*.json 읽어 weakness_code 수집
4. 문항 생성 (아래 스키마 엄수)
5. kisa-module/seed/<stage>/<NN>-<chapter>.json 에 저장
6. scripts/kisa-validate.js 로 검증
7. DB UPSERT는 BELL 승인 후
```

---

## 📐 필수 JSON 스키마

```json
{
  "version": "1.0.0",
  "stage": "design" 또는 "implementation",
  "chapter_code": "DSG-IV-01" 등 INDEX.md 기준,
  "description": "이 파일이 커버하는 범위 한 줄 설명",
  "generated_at": "YYYY-MM-DD",
  "questions": [
    {
      "stage": "design" | "implementation",
      "chapter_code": "DSG-IV-01" | "IMP-IV-01" 등,
      "weakness_code": "CWE-89" 등 (INDEX.md 참조),
      "question_type": "mcq" | "diagnosis4",
      "weakness_category": "input_validation" | "security_feature" | "time_state" | "error_handling" | "code_error" | "encapsulation" | "api_abuse" | "session_control",
      "weakness_name_ko": "SQL 삽입" 등,
      "language": "java" | "python" | "javascript" | "kotlin" | "swift" | "etc",
      "difficulty": "하" | "중" | "상",
      "body": "문제 본문 (마크다운 가능)",

      // ── MCQ 전용 ──
      "choices": [{"num": 1, "text": "..."}, {"num": 2, "text": "..."}, ...],
      "answer_index": 0 (0-based),

      // ── diagnosis4 전용 ──
      "vulnerable_code": "1  ...\n2  ...\n... (라인번호 포함 원문)",
      "code_language": "java" | "python" | "javascript",
      "vulnerable_lines": [3, 4, 5],
      "rationale_keywords": ["키워드1", "키워드2", ...],  // 3~5개 권장
      "fix_keywords": ["PreparedStatement", "바인딩", ...],  // 2~4개 권장
      "safe_code": "1  ...\n2  ... (수정된 안전 코드)",
      "model_answer": {
        "verdict": true,
        "rationale": "왜 취약한지 기술적 근거",
        "fix_description": "어떻게 수정하는지 구체적 방법"
      },

      // ── 공통 메타 ──
      "reference": "참조한 PDF 섹션 (예: 진단가이드 §1.1.1 SQL 삽입)",
      "tags": ["sql", "injection", ...]
    }
  ]
}
```

---

## ✅ 품질 체크리스트 (생성 후 자기검증)

### MCQ
- [ ] 4~5지 선택지 (FEATURE_SPEC 준수)
- [ ] 정답이 명확히 하나 (중복 정답 금지)
- [ ] 오답도 그럴듯해야 함 (명백히 엉뚱한 선택지 X)
- [ ] answer_index 범위 확인 (0-based)

### diagnosis4
- [ ] `vulnerable_code` 에 실제 라인 번호가 들어가 있음 (`1  code\n2  code\n...`)
- [ ] `vulnerable_lines` 는 **실제 라인 번호 배열** (code 내용의 실제 line 번호)
- [ ] `rationale_keywords` 는 3~5개 (너무 많으면 채점 불리)
- [ ] `fix_keywords` 는 2~4개 (핵심 기술 용어 위주)
- [ ] `safe_code` 는 취약점이 해결된 버전 (다시 취약하면 안 됨)
- [ ] `model_answer.verdict` 는 거의 항상 `true` (취약 코드가 정답)
- [ ] `safe_code`를 비교 코드로 제시할 경우 `verdict: false`도 가능 (주의)

### 공통
- [ ] `chapter_code` 가 INDEX.md에 존재
- [ ] `weakness_category` 가 해당 chapter_code의 분류와 일치
- [ ] `stage` 가 chapter_code 접두어와 일치 (DSG→design, IMP→implementation)
- [ ] `language` 가 allowed 값
- [ ] `difficulty` 가 '하'/'중'/'상' 중 하나
- [ ] 저작권: KISA 가이드 원문을 그대로 복제하지 말고 **변형·재구성** (sample code 변수명/구조 변경)

---

## 🎯 난이도 기준

| 난이도 | 특성 | 예시 |
|-------|------|-----|
| **하** | 교과서적 취약점, 코드가 짧고 명확 | SQL 문자열 연결, 고정 key 사용 |
| **중** | 실무 흔한 패턴, 부분 취약 | 부분 sanitize 누락, 권한 체크 빠뜨림 |
| **상** | 2차 원인 필요, 여러 기법 결합 | Race condition, JSON injection, 시그니처 비교 |

---

## 🎨 문항 생성 전략

### 설계단계 (design)
- 주로 **서술형 MCQ** 또는 "설계 요구사항 중 틀린 것은?" 류
- diagnosis4도 가능하지만 **요구사항 정의서/아키텍처 설계서** 형식의 지문 활용
- 예: "비밀번호 관리 설계에서 잘못된 것은?" → 4지선다

### 구현단계 (implementation)
- 주로 **diagnosis4** (취약 코드 → 판정 → 수정)
- 일부는 MCQ로도 제작 (용어 이해 문항)
- **3개 언어(Java/Python/JavaScript) 순환**하여 언어 다양성 확보

---

## 📏 문항 분량 가이드

| 구분 | 권장 분량 |
|------|---------|
| `body` | 2~5줄 (문제 의도 명확히) |
| `vulnerable_code` | 5~15줄 (너무 길면 채점 어려움) |
| `safe_code` | 5~15줄 |
| `rationale` | 2~4줄 |
| `fix_description` | 1~3줄 |
| MCQ 선택지 | 각 15~40자 |

---

## 🔄 weakness_code 중복 방지

**한 chapter_code당 문항을 여러 개 만들어도 됨** (언어 변종). 단, 중복 확인:

```
기존 seed.json + seed/**/*.json 읽기
→ 각 문항의 { chapter_code, language, difficulty } 조합 리스트
→ 동일 조합은 스킵 (이미 존재)
→ 새 조합만 생성
```

---

## 🎓 모범 문항 예시 (참조용)

### 예시 1: MCQ (설계단계 - 비밀번호 관리)

```json
{
  "stage": "design",
  "chapter_code": "DSG-SF-03",
  "weakness_code": "KISA-DSG-SF-03",
  "question_type": "mcq",
  "weakness_category": "security_feature",
  "weakness_name_ko": "비밀번호 관리 설계",
  "language": "etc",
  "difficulty": "중",
  "body": "회원정보 관리 프로세스에서 비밀번호 관리 설계 요구사항 중 부적절한 것은?",
  "choices": [
    {"num": 1, "text": "비밀번호 저장 시 솔트를 적용한 해시함수를 사용한다"},
    {"num": 2, "text": "비밀번호 정책 위반 시 서버가 클라이언트에 에러코드만 응답한다"},
    {"num": 3, "text": "비밀번호 최소 길이는 6자로 설정한다"},
    {"num": 4, "text": "임시 비밀번호 로그인 시 즉시 변경하도록 강제한다"}
  ],
  "answer_index": 2,
  "reference": "KISA 개발보안 가이드 §2-3 비밀번호 관리",
  "tags": ["password", "design", "policy"]
}
```

### 예시 2: diagnosis4 (구현단계 - SQL 삽입)

```json
{
  "stage": "implementation",
  "chapter_code": "IMP-IV-01",
  "weakness_code": "CWE-89",
  "question_type": "diagnosis4",
  "weakness_category": "input_validation",
  "weakness_name_ko": "SQL 삽입",
  "language": "python",
  "difficulty": "하",
  "body": "아래 Python 코드의 보안 취약점을 진단하시오.",
  "vulnerable_code": "1  def find_user(user_id):\n2      conn = get_connection()\n3      query = \"SELECT * FROM users WHERE id = '\" + user_id + \"'\"\n4      cursor = conn.cursor()\n5      cursor.execute(query)\n6      return cursor.fetchone()",
  "code_language": "python",
  "vulnerable_lines": [3, 4, 5],
  "rationale_keywords": ["SQL 삽입", "문자열 연결", "외부입력 검증"],
  "fix_keywords": ["파라미터 바인딩", "?", "placeholder"],
  "safe_code": "1  def find_user(user_id):\n2      conn = get_connection()\n3      query = \"SELECT * FROM users WHERE id = ?\"\n4      cursor = conn.cursor()\n5      cursor.execute(query, (user_id,))\n6      return cursor.fetchone()",
  "model_answer": {
    "verdict": true,
    "rationale": "L3에서 외부입력 user_id를 검증·바인딩 없이 문자열 연결로 SQL을 구성하여 SQL 삽입이 가능하다.",
    "fix_description": "파라미터 바인딩(placeholder ?)을 사용하여 user_id가 데이터로만 처리되도록 수정한다."
  },
  "reference": "KISA 진단가이드 §1.1.1 SQL 삽입 / Python 시큐어코딩 가이드",
  "tags": ["sql", "injection", "python"]
}
```

---

## ⚙️ 저장 후 검증

```bash
# 스키마 검증
node scripts/kisa-validate.js kisa-module/seed/implementation/01-input-validation.json

# DB 업로드 (BELL 승인 후)
DATABASE_URL=... node scripts/kisa-seed-import.js kisa-module/seed/implementation/01-input-validation.json
```

---

**요약**: INDEX.md → chapter_code 결정 → PDF Read → 스키마 준수 JSON 생성 → validate → 업로드. 원문 저작권 주의, 라인번호 포함, 키워드 개수 엄수.
