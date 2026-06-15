# IMP-IV-11 · 크로스사이트 요청 위조 (CSRF)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-352
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §11 크로스사이트 요청 위조 (p.272–275)

## 가. 개요

사용자가 인지하지 못한 상황에서 의도와 무관하게 공격자가 의도한 행위(수정·삭제·등록 등)를 요청하게 하는 공격이다. 웹 응용프로그램이 받은 요청이 사용자가 의도한 대로 작성·전송된 것인지 확인하지 않으면 발생하며, 사용자가 관리자인 경우 권한관리·게시물 삭제·사용자 등록 등 관리자 기능을 공격자 의도대로 실행시킬 수 있다. 공격자는 인증된 세션이 계속 유지되어 정상/비정상 요청을 구분하지 못하는 점을 악용한다. 적법성 입증 값이 고정되어 있고 **GET 방식**으로 전달되면 공격자가 쉽게 알아내어 위험한 작업을 요청할 수 있다.

## 나. 보안대책

- 입력화면 폼은 GET 보다 **POST 방식** 사용
- 입력 폼과 처리 프로그램 사이에 **토큰** 사용 → 공격자의 직접 URL 사용 차단
- 중요 기능은 세션검증과 더불어 **재인증** 유도

## 다. 코드예제

### Java
정상 요청 판단을 위해 토큰 사용: 입력 페이지 요청 시 토큰 생성·세션 저장 → HIDDEN 필드로 전달 → 처리 페이지에서 파라미터 토큰과 세션 토큰 비교, 일치 시에만 처리.

```java
// ❌ 취약: 정상 요청 여부를 검증하지 않고 처리 (어떤 형태의 요청이든 CSRF 취약)
```
```java
// ✅ 안전: CSRF 토큰 생성·세션 저장 → HIDDEN 필드 → 비교 검증
session.setAttribute("SESSION_CSRF_TOKEN", UUID.randomUUID().toString());
// <input type="hidden" name="param_csrf_token" value="${SESSION_CSRF_TOKEN}" />
String pToken = request.getParameter("param_csrf_token");
String sToken = (String)session.getAttribute("SESSION_CSRF_TOKEN");
if (pToken != null && pToken.equals(sToken) {
  ......   // 일치 → 정상 처리
} else {
  ......   // 불일치/없음 → 오류
}
```

### C#
```csharp
// ✅ 안전: AntiForgeryToken() 으로 CSRF 방지
@using (Html.BeginForm("PostTest","Home",FormMethod.Post,null))
{
  @Html.AntiForgeryToken()
  <input type="submit" value="Html PsBk Click" />
}
```

## 라. 진단방법

1. **①** 사용자 권한변경·신규정보 등록 등 주요 기능 확인
2. **②** 해당 기능 수행 시 권한확인 절차 존재 여부 확인

> 권한확인 절차가 없거나, 세션쿠키·사용자 IP·SSL 인증처럼 **자동 제출되는 자격증명**에만 의존하면 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

_(원문에 별도 정탐 코드 사례 없음 — 일반적인 진단 예: level/group/id 를 받아 권한확인 없이 update 실행)_

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 토큰 생성·세션 저장 → HIDDEN 필드 → 파라미터 토큰과 세션 토큰 비교, 일치 시에만 처리 → 안전
session.setAttribute("SESSION_CSRF_TOKEN", UUID.randomUUID().toString());
// <input type="hidden" name="param_csrf_token" value="${SESSION_CSRF_TOKEN}" />
String pToken = request.getParameter("param_csrf_token");
String sToken = (String)session.getAttribute("SESSION_CSRF_TOKEN");
if (pToken != null && pToken.equals(sToken) { ...정상... } else { ...오류... }
```

## 마. 참고자료

- CWE-352 Cross-Site Request Forgery(CSRF), MITRE — http://cwe.mitre.org/data/definitions/352.html
- Security Corner: Cross-Site Request Forgeries, Chris Shiflett / OWASP CSRF

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: CSRF 토큰 · HIDDEN 필드 · 세션 토큰 비교 · POST 방식 · 재인증 · AntiForgeryToken() · 자동 제출 자격증명(세션쿠키/IP/SSL)
- **객관형 시드**: safe 코드 또는 오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 오탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
