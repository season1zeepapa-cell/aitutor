# REBUILD55 — 드릴 문항 응답 보강(chapter_code/composite) + 복합서술형 드릴 진입

> **작성**: 2026-06-16 KST
> **트리거**: 사용자 피드백 — 풀이 중 "📚 관련 지식" 버튼이 안 뜸. 원인 추적 → 드릴 API 응답 누락 + composite 드릴 미노출 발견 후 보완.
> **결과**: 관련 지식 모달 정상 동작(운영 API 직접 검증), 복합서술형(composite)을 드릴에서 직접 연습 가능

---

## §0. 결론 요약

| 작업 | 파일 | 결과 |
|------|------|------|
| chapter_code 응답 노출 | `api/kisa-drill.js` | 관련 지식 버튼/모달 정상화 |
| composite 산출물 응답 노출 | `api/kisa-drill.js` | 드릴 composite 빈 화면 방지 |
| composite 드릴 허용 | `api/kisa-drill.js` ALLOWED_TYPES | `?type=composite` 출제 가능 |
| 복합서술형 진입 버튼 | `src/tabs/KisaTab/Dashboard.jsx` | 드릴에서 직접 연습 |

---

## §1. 증상 / 원인

- **증상**: 문제 풀이 화면에서 "📚 관련 지식" 버튼이 보이지 않음.
- **원인**: `api/kisa-drill.js`의 `publicQuestion` 화이트리스트에 **`chapter_code` 누락**. 프론트는 `{question.chapter_code && (...)}` 조건으로 버튼을 렌더하므로, 값이 항상 `undefined` → 버튼 미노출.
- **부수 발견**: composite 문항이 드릴에 나올 때 `artifacts`/`report_template`도 화이트리스트에 없어 빈 화면. 또한 `ALLOWED_TYPES`에 `composite`가 없어 `?type=composite` 필터가 무시됨(랜덤 시에만 간헐 출제) + Dashboard에 진입 버튼 없음 → 사실상 드릴에서 풀 수 없었음.

## §2. 수정

1. `publicQuestion`에 **`chapter_code`** 추가 → 관련 지식 모달이 해당 문제 자료를 매칭.
2. composite일 때 **`artifacts`/`report_template`** 노출(채점 기준 `rubric`은 컨닝 방지로 계속 숨김).
3. `ALLOWED_TYPES = ['mcq','diagnosis4','blank','composite']` — composite 필터 허용.
4. Dashboard에 **"복합서술형 드릴"** 버튼 추가 → `/kisa/drill?type=composite`.

## §3. 운영 검증 (실제 배포 API)

운영 토큰으로 배포 서버를 직접 호출해 응답 확인:

```
GET /api/kisa-drill?action=next
 → chapter_code: "DSG-SF-08" / "DSG-IV-07" / "IMP-IV-01"   ✓ (이전: undefined)
GET /api/kisa-drill?action=count → { total: 509 }            ✓
```

composite 풀이 경로(드릴):
`Dashboard 복합서술형 버튼 → drill ?type=composite → CompositeCard(artifacts/report_template) → onSubmit({report_text}) → kisa-attempt(scoreComposite, rubric_hits) → CompositeResult`. 전 구간 정상.

## §4. 영향 / 검증

| 항목 | 결과 |
|------|------|
| 관련 지식 버튼 | ✅ 운영 API chapter_code 반환 확인 |
| composite 드릴 | ✅ 출제·채점·결과 경로 정상 |
| api 구문 / build:fe | ✅ 통과 |
| 배포 | Cloud Run 재배포(aitutortwo-prod) |

## §5. 참고
- 시험 모드(`kisa-exam.js`)는 이전부터 `artifacts/report_template`을 SELECT하므로 영향 없음. 시험에는 라이브러리 버튼을 두지 않음(컨닝 방지).
- 드릴 인증은 정수형 `uid`(JWT payload). 검증 시 가짜 UUID는 타입 불일치로 500 → 실제 정수 uid로 정상 응답.

---

**완료 일시**: 2026-06-16 KST
**연관 문서**: REBUILD54(QA·composite 확대·라이브러리 모달), `api/kisa-drill.js`, `Dashboard.jsx`
