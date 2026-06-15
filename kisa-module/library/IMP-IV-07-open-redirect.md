# IMP-IV-07 · 신뢰되지 않는 URL 주소로 자동접속 연결 (Open Redirect)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-601
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §7 신뢰되지 않는 URL 주소로 자동접속 연결 (p.239–243)

## 가. 개요

사용자로부터 입력되는 값을 외부사이트의 주소로 사용하여 자동으로 연결하는 서버 프로그램은 **피싱(Phishing) 공격**에 노출될 수 있다. 클라이언트에서 전송된 URL이라 안전하다고 생각할 수 있으나, 공격자는 폼 요청을 변조하여 사용자가 위험한 URL로 접속하도록 공격할 수 있다.

## 나. 보안대책

- 자동 연결할 외부 사이트의 URL·도메인을 **화이트 리스트**로 관리
- 사용자 입력값을 연결 주소로 쓸 때 **화이트 리스트에 존재하는지 확인**

## 다. 코드예제

### Java
공격 예: `<a href="http://bank.example.com/redirect?url=http://attacker.example.net">Click</a>` 로 희생자를 피싱 사이트로 유도.

```java
// ❌ 취약: 외부 입력 URL을 검증 없이 리다이렉트
String rd = request.getParameter("redirect");
...
response.sendRedirect(rd);
```
```java
// ✅ 안전: 허용 URL 배열(화이트 리스트) 인덱스로만 선택
String allowedUrl[] = { "/main.do", "/login.jsp", "list.do" };
String rd = request.getParameter("redirect");
try {
  rd = allowedUrl[Integer.parseInt(rd)];
} catch(NumberFormatException e) { return "잘못된 접근입니다."; }
  catch(ArrayIndexOutOfBoundsException e) { return "잘못된 입력입니다."; }
response.sendRedirect(rd);
```

### C#
```csharp
// ❌ 취약: 외부 입력 URL을 검증 없이 연결
string url = Request["dest"];
Response.Redirect(url);
```
```csharp
// ✅ 안전: 로컬 URL 여부 검증 후 리다이렉트
string url = Request["dest"];
if(isLocalUri(url)) Response.Redirect(url);
// IsLocalUrl: 절대 URI는 Host 동일성 비교, 그 외 http(s) 로 시작하지 않는 상대 URI만 허용
```

## 라. 진단방법

1. **①** 리다이렉션 함수/메소드(`response.sendRedirect` 등) 존재 확인
2. **②** 인자값(url)이 외부 입력값인지 확인

> 외부 입력 변수가 아니면 안전. 외부 입력 변수면 유효값 검사·화이트 리스트로 관리할 때 안전 판정. 외부 입력값을 `sendRedirect(String url)` 에 그대로 사용하면 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```jsp
// request 의 code, action 을 이동 URL 조립에 사용 → 취약
String code = nvl(request.getAttribute("redirectCode"));
String action = nvl(request.getAttribute("action"));
se.sendRedirect(CP + action + "?redirectCode=" + code);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// getContextPath() 는 내장함수로 context path 를 리턴 → 안전한 URL
response.sendRedirect(request.getContextPath() + "/login.do");
```

## 마. 참고자료

- CWE-601 URL Redirection to Untrusted Site, MITRE — http://cwe.mitre.org/data/definitions/601.html
- Unvalidated Redirects and Forwards Cheat Sheet, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: sendRedirect · 화이트 리스트 URL · 피싱(Phishing) · 로컬 URL 검증(isLocalUrl) · 도메인 비교 · getContextPath · 유효값 검사
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
