# REBUILD86 — 예시코드 라이브러리 학습 레이어 3종 (읽기진도·블라인드 판별·드릴 연결)

> 2026-07-04. 선행: REBUILD85(현황 스냅샷). 사용자 요청: "예시코드 라이브러리에서 학습도 같이 하고싶다".

## §1. 설계 요지

`/kisa/code-library` 는 순수 열람 화면이었다(읽었는지·이해했는지 확인 장치 없음).
새 화면 없이 **한 화면에 학습 레이어 3장을 얹는다** — 재료는 전부 기존 것(codebank 1,049블록, codeid 문항 1,049, SRS 큐).

## §2. 1단계 — 읽기 진도 + 이어보기

- **DB**: `kisa_library_read(user_id INTEGER, source TEXT, item_id TEXT, read_at, PK(user_id,source,item_id))` 신규.
- **API**: `api/kisa-library.js` 신규 (server.js 화이트리스트 등록).
  - `GET ?action=read` → 읽음 목록 + 최근 항목(이어보기)
  - `POST ?action=read` → upsert / 해제(read:false 시 DELETE)
- **UI**: 항목을 펼치면 자동 읽음(낙관적 갱신), 펼침 영역에 "읽음 해제" 버튼.
  자료원 칩에 `읽음 n/m`, 문서 카드에 진도바, 헤더에 **▶ 이어보기**(자료원 전환+스크롤+자동 펼침 — `initialOpen` + jump key 리마운트).
- 비로그인 시 진도 UI 숨김(조회는 그대로 가능).

## §3. 2단계 — 🎓 블라인드 판별 모드 (BlindSession)

- 헤더 토글 [📖 조회 | 🎓 학습]. 학습 모드는 목록 대신 카드 세션.
- **데이터는 kisa-codebank.json 직접 사용** — 자료원 필터 후 CQ 발번순(=약점 그룹 순서) 진행.
  카드: 약점명(약점 내 i/n)·분류·CWE·언어 + **라벨 없는 코드** → [❌ 취약하다] [✅ 안전하다] 판정 → 정답·💡note 공개 → 다음.
- 위치(자료원별)·오늘 통계(판별 수·정답률)는 **localStorage** (`kisa-codelib-blind-pos-v1`, `kisa-codelib-blind-stats-v1`) — 즉석 학습이라 서버 채점 없음.
- **SRS 연동**: 판정 후 "🔁 헷갈림 — 복습에 추가" → `POST ?action=srs-add {chapter_code:'CQ-XXXX'}`.
  codebank 카드 id(CQ-XXXX) == codeid 문항 chapter_code 라 1:1 매핑. 신규는 SRS 초기값(ease 2.5·rep 0·오늘), 기존은 `next_review_at=LEAST(기존,NOW()) + suspended 해제`만.
- 이전/건너뛰기/조회 복귀 내비. 끝 도달 시 "처음부터 다시".

## §4. 3단계 — 약점별 원클릭 드릴 연결

- 항목 펼침 하단에 **"🎯 이 약점 코드식별 드릴 (전 문서 N문항)"** → `/kisa/drill?type=codeid&chapter_code=IMP-XX-NN`.
- **kisa-drill 챕터 필터 확장** (count·next 두 곳): `(chapter_code=$ OR LIKE 'OBJ-'||$||'%' OR (type='codeid' AND weakness_code=$))`
  — codeid 는 chapter_code 가 CQ-XXXX 라 weakness_code 로 약점 매칭.
- 약점ID 결정: 항목 id 가 정본(`IMP-XX-NN`)이면 그대로, 아니면(DEV-*/JS-*/PY-*) 제목 정규화 ↔ codebank 정본 제목 매칭. 매칭 실패·DSG(코드 없음) 항목은 버튼 미노출(자연 강등).

## §5. 검증

- `IMP-IV-01` codeid 드릴 count = **32** (전 문서 합산) / objective 챕터 드릴 회귀 = 8 유지 / `CQ-0001`→문항 매핑 OK — 운영 DB 직접 확인.
- `npm run build:fe` 통과, `api/kisa-library.js` 로드 통과.
- DrillSession 은 chapter_code 를 그대로 전달하므로 프론트 드릴 화면 변경 불필요.

## §6. 파일 변경

| 파일 | 내용 |
|------|------|
| `api/kisa-library.js` | 신규 — read 목록/upsert/해제 + srs-add |
| `server.js` | 화이트리스트 'kisa-library' 추가 |
| `api/kisa-drill.js` | 챕터 필터에 codeid weakness_code 매칭 추가 (2곳) |
| `src/tabs/KisaTab/CodeLibrary.jsx` | 모드 토글·읽기진도·이어보기·BlindSession·드릴 버튼 |
| DB | `kisa_library_read` 테이블 신규 (운영 반영 완료) |

## §7. 이후 확장 아이디어 (미구현)

- 블라인드 통계 서버 저장(기기 간 동기화), 약점 점프 셀렉터, 오답만 다시 돌기.
- 읽기 진도를 통계(/kisa/stats) 화면에 합류.
