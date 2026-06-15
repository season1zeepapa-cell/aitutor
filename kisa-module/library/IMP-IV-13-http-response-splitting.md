# IMP-IV-13 · HTTP 응답분할 (HTTP Response Splitting)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-113
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §13 HTTP 응답분할 (p.284–289)

## 가. 개요

HTTP 요청 파라미터가 HTTP 응답헤더에 포함되어 사용자에게 다시 전달될 때, 입력값에 **CR(Carriage Return)·LF(Line Feed)** 같은 개행문자가 있으면 HTTP 응답이 2개 이상으로 분리될 수 있다. 공격자는 개행문자로 첫 번째 응답을 종료시키고 두 번째 응답에 악의적 코드를 주입하여 **XSS·캐시 훼손(Cache Poisoning)** 공격 등을 수행할 수 있다.

## 나. 보안대책

- 요청 파라미터 값을 HTTP 응답헤더(예: Set-Cookie)에 포함시킬 경우 **CR, LF 개행문자 제거**

## 다. 코드예제

### Java
공격 예: `Wiley Hacker\r\nHTTP/1.1 200 OK\r\n` 를 `last_login` 값으로 설정 → 응답 분리 → 본문 임의 수정.

```java
// ❌ 취약: 개행문자 검증 없이 쿠키 값으로 사용
String lastLogin = request.getParameter("last_login");
Cookie c = new Cookie("LASTLOGIN", lastLogin);
response.addCookie(c);
```
```java
// ✅ 안전: 개행문자(\r\n) 제거 후 쿠키 값으로 설정
lastLogin = lastLogin.replaceAll("[\\r\\n]", "");
Cookie c = new Cookie("LASTLOGIN", lastLogin);
response.addCookie(c);
```

### C#
```csharp
// ❌ 취약: 외부 입력값을 검증 없이 헤더에 사용
string usrInput = Request.QueryString["ID"];
Response.AddHeader("foo", "bar" + usrInput);

// ✅ 안전: 개행문자 제거 후 사용
string validatedInput = usrInput.Replace("\n", "").Replace("\r","");
Response.AddHeader("foo", "bar" + validatedInput);
```

## 라. 진단방법

1. **①** Response 헤더에 변수가 사용되는 것을 확인
2. **②** 변수가 외부 입력값인지 확인
3. **③** 개행문자(`\r`, `\n`) 제거 필터링·검증절차 존재 여부 확인

> 외부 입력값에 대한 필터링 절차가 없으면 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// filename 을 개행문자 필터링 없이 Content-Disposition 헤더에 설정 → 취약
String filename = request.getParameter("file");
res.setHeader("Content-Disposition", "attachment;filename=" + filename);
```
```java
// last_login 값을 개행문자 필터링 없이 쿠키에 설정 → 취약
String lastLogin = request.getParameter("last_login");
Cookie c = new Cookie("LASTLOGIN", lastLogin);
response.addCookie(c);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 개행문자 제거 후 쿠키에 설정 → 안전
lastLogin = lastLogin.replaceAll("[\\r\\n]", "");
Cookie c = new Cookie("LASTLOGIN", lastLogin);
```
```java
// getContextPath() 는 내장함수로 context path 반환 → 응답 분할 없음 → 안전
response.sendRedirect(request.getContextPath() + "/login.do");
```
```java
// Numeric 값은 문자열 치환 시 \r\n 포함 불가 → 안전
response.setHeader("Content-Length", Long.toString(file.length()));
```

## 마. 참고자료

- CWE-113 HTTP Response Splitting, MITRE — http://cwe.mitre.org/data/definitions/113.html
- HTTP Response Splitting, OWASP — https://www.owasp.org/index.php/HTTP_Response_Splitting

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 개행문자(CR/LF) 제거 · 응답헤더 분할 · Set-Cookie · `replaceAll("[\r\n]","")` · 캐시 훼손(Cache Poisoning) · getContextPath() 내장함수 · Numeric 값 안전
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
