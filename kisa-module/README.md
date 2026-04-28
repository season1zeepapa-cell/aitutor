# kisa-module/ — AI TutorTwo KISA 이식 패키지

이 디렉터리는 **AI TutorTwo 앱**에 **KISA 2025 소프트웨어 보안약점 진단원 이수시험** 학습 모듈을 이식하기 위한 사양·데이터·지시문 세트다. Claude Code가 이 디렉터리 통째로 AI TutorTwo 저장소 루트에 복사된 상태에서 `HANDOFF_PROMPT.md`의 지시를 따라 구현을 수행한다.

## 파일 목록

| 파일 | 역할 | 읽는 순서 |
|---|---|---|
| `README.md` | 본 안내 (지금 이 파일) | 1 |
| `HANDOFF_PROMPT.md` | Claude Code에 넘길 지시문. 저장소 루트에서 Claude Code 기동 후 첫 메시지로 사용 | 2 |
| `FEATURE_SPEC.md` | KISA 모듈 기능 사양서 | 3 |
| `INTEGRATION_GUIDE.md` | 이식 시 가드레일·사전 조사 체크리스트·기존 규약 준수 사항 | 4 |
| `migrations/001_kisa_module.sql` | 신규 테이블 5종(kisa_*)과 인덱스·트리거 | 5 |
| `migrations/001_kisa_module_rollback.sql` | 위 마이그레이션 롤백 | (필요 시) |
| `seed.json` | 초기 드릴 문항 33개 (Java 23 / Python 6 / JS 4, 7대 분류 커버, diagnosis4 24 + mcq 9) | 6 |
| `report-template.json` | 진단보고서 양식(단순서술형·복합서술형) 구조 정의 | 7 |

## 사용 방법

### 1) AI TutorTwo 저장소에 복사

이 디렉터리를 통째로 AI TutorTwo 저장소 루트에 `kisa-module/`로 복사한다.

```bash
cp -r kisa-module/ /path/to/aitutor/
cd /path/to/aitutor
```

필요 시 `.gitignore`에 `kisa-module/`을 추가해 임시 참고용으로만 사용할 수도 있고, 저장소에 함께 커밋해도 무방하다(문서·시드·마이그레이션은 재현성에 유용).

### 2) Claude Code 기동 + 지시문 전달

AI TutorTwo 저장소 루트에서 Claude Code를 실행하고, 첫 메시지로 다음과 같이 말한다:

```
kisa-module/HANDOFF_PROMPT.md 의 지시를 그대로 따라 작업을 시작해줘.
```

또는 `HANDOFF_PROMPT.md` 내용을 그대로 복사해 붙여넣어도 된다.

### 3) 사전 조사 결과 승인

Claude Code가 `INTEGRATION_GUIDE.md` §1의 17개 항목을 조사하여 표로 보고해오면, 내용을 검토하고 다음 중 하나로 응답한다.

- **"진행해도 좋다"** — 승인. 구현 착수.
- **질문** — 명확치 않은 항목 재조사 요청.
- **"보류"** — 계획 수정 필요.

### 4) 구현 단계 진행

Claude Code는 `HANDOFF_PROMPT.md` §3의 8단계를 feat 커밋 단위로 순차 수행한다.

### 5) DB 마이그레이션

로컬은 Claude Code가 검증하되, 운영/스테이징 Supabase는 본인(BELL)이 **SQL Editor에서 수동 실행**한다.

```
# Supabase 콘솔 → SQL Editor → migrations/001_kisa_module.sql 내용 붙여넣고 실행
# 문제 시 migrations/001_kisa_module_rollback.sql 로 롤백
```

### 6) BottomNav 노출 (최종)

모든 기능이 완성되고 테스트가 통과하면, 마지막으로 `BottomNav.jsx`에 KISA 탭 링크 한 줄을 추가하는 별도 PR을 승인한다. 이전까지는 `/kisa` 직접 URL로만 접근 가능해 기존 사용자 경험에 전혀 영향이 없다.

## 핵심 설계 원칙 요약

1. **기존 서비스 무영향**: 기존 테이블·API·컴포넌트 수정 금지. 전부 신규 파일로만 추가.
2. **기존 인프라 재사용**: Postgres Pool, S3 presigned 업로드, 3종 LLM 스트리밍, 커스텀 JWT 인증, Playwright 테스트 러너 모두 그대로 활용.
3. **규약 준수**: REBUILD1~12에서 확립된 14개 규약(API 핸들러 시그니처, 에러 응답 포맷, 파라미터화 SQL, Tailwind 전용, React Context 한정 등).
4. **증분 구현**: 백엔드 → 프론트 스켈레톤 → SM-2 → LLM 채점 → 보고서 → 통계 → 네비게이션 노출 순.
5. **롤백 용이성**: 신규 테이블만 drop 하면 초기 상태로 완전 복귀. BottomNav 한 줄만 제거하면 UI에서도 깔끔히 숨김.

## 시드 문항 구성 (seed.json)

| 카테고리 | 개수 | 대표 약점 |
|---|---|---|
| 입력데이터 검증 및 표현 | 11 | SQL 삽입, XSS, 경로 조작, OS 명령어 삽입, XXE, CSRF, 파일 업로드, HTTP 응답분할, 자동접속 연결, 정수형 오버플로우, SSRF |
| 보안기능 | 12 | 하드코딩, 취약한 암호, 쿠키 노출, 인증 없는 중요기능, 취약한 난수, 솔트 없는 해시, 키 길이, 비밀번호 정책, 평문 전송, 부적절한 인가, 반복 인증 제한 부재, 중요정보 평문 저장 |
| 시간 및 상태 | 2 | TOCTOU, 종료되지 않는 반복문 |
| 에러처리 | 3 | 오류 메시지 정보노출, 오류상황 대응 부재, 부적절한 예외 처리 |
| 코드오류 | 3 | Null 역참조, 부적절한 자원 해제, 신뢰할 수 없는 역직렬화 |
| 캡슐화 | 1 | Private 배열 반환 |
| API 오용 | 1 | 취약한 API (yaml.load) |
| **합계** | **33** | |

**유형 구성**: diagnosis4(실기 서술형) 24 / mcq(이론 객관식) 9. 문항별로 취약 코드·취약 라인·근거 키워드·수정 키워드·안전 코드·모범답안이 모두 포함되어 있어 결정론적 채점이 즉시 가능하다.

**난이도 분포**: 하 12 / 중 16 / 상 5.

## 운영 이후의 확장 가이드

- 시드는 언제든 재임포트 가능. 기존 문항은 ID 기준 UPSERT 구현을 권장.
- 47개 약점을 전부 커버하려면 추가 문항이 필요하다(현재 33). `kisa-module/` 밖에 `kisa-seed-v2.json` 형태로 증분 추가.
- LLM 보조채점은 사용자별 설정 토글로 on/off. 비용 통제를 위해 일일 호출 상한(예: 50회) 강제.
- DOCX 보고서에 첨부파일(증적자료 스크린샷)을 포함하려면 S3 presigned 다운로드 링크를 표에 삽입.

## 문제 발생 시

- 이식 중 회귀가 발견되면 즉시 해당 feat 커밋을 revert. 신규 테이블은 유지해도 무방.
- 운영에서만 재현되는 이슈가 있으면 `BottomNav`의 KISA 링크만 제거해 UI에서 완전히 숨긴 뒤 디버깅.
- 완전 롤백: `migrations/001_kisa_module_rollback.sql` 실행 + KISA 관련 feat 커밋 revert 또는 feature branch 폐기.

---

**작성**: 2026-04-23 / BELL 요청에 따른 이식 설계
**기반 앱 버전**: AI TutorTwo REBUILD12 (2026-04-23 PROD)
**대상 시험**: KISA 2025 SW 보안약점 진단원 이수시험 (이론 30문항 60분 + 실기 15문항 100분)
