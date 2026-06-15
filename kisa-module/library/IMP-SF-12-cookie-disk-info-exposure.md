# IMP-SF-12 · 사용자 하드디스크에 저장되는 쿠키를 통한 정보 노출

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-539
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §12 사용자 하드디스크에 저장되는 쿠키를 통한 정보 노출 (p.382–385)

## 가. 개요

대부분의 웹 응용프로그램에서 쿠키는 메모리에 상주하며 브라우저 종료 시 사라진다. 프로그래머가 원하면 쿠키를 디스크에 저장할 수 있으며, 다음 브라우저 세션 시작 시 메모리에 로드된다. 개인정보·인증정보 등이 이러한 **영속적인 쿠키(Persistent Cookie)**에 저장되면, 공격자가 쿠키에 접근할 기회가 많아져 시스템이 취약해진다.

## 나. 보안대책

- 쿠키의 **만료시간**은 세션 지속시간을 고려하여 **최소한으로 설정**
- 영속적인 쿠키에는 **사용자 권한 등급, 세션ID 등 중요정보가 포함되지 않도록** 함

## 다. 코드예제

### Java
쿠키의 유효기간이 길면 사용자 하드디스크에 저장되어 쉽게 도용될 수 있다.

```java
// ❌ 취약: 만료시간 1년으로 과도하게 길게 설정
Cookie loginCookie = new Cookie("rememberme", "YES");
loginCookie.setMaxAge(60*60*24*365);
response.addCookie(loginCookie);
```
```java
// ✅ 안전: 기능에 맞춰 최소(1일)로 설정
loginCookie.setMaxAge(60*60*24);
response.addCookie(loginCookie);
```

### C#
```csharp
// ❌ 취약: 만료시간 1년
cookie.Expires = DateTime.Now.AddMinutes(60.0*24.0*365.0);
// ✅ 안전: 만료시간 10분
cookie.Expires = DateTime.Now.AddMinutes(10d);
```

## 라. 진단방법

1. **①** 사용자 브라우저로 쿠키를 전송하는지 확인
2. **②** 쿠키 **유효기간** 확인
3. **③** 쿠키 설정 값에 **id 정보 등 중요 정보 포함 여부** 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 만료시간 1년(60*60*24*30*12)으로 과도하게 길게 설정 → 취약
if (rememberMe) {
  Cookie loginCookie = new Cookie("rememberme", "YES");
  loginCookie.setMaxAge(60*60*24*30*12);
  response.addCookie(loginCookie);
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 만료시간을 기능에 맞춰 최소(60*60*24)로 설정 → 안전
if (rememberMe) {
  Cookie loginCookie = new Cookie("rememberme", "YES");
  loginCookie.setMaxAge(60*60*24);
  response.addCookie(loginCookie);
}
Arrays.fill(password, ' ');
```

## 마. 참고자료

- CWE-539 Information Exposure Through Persistent Cookies, MITRE — http://cwe.mitre.org/data/definitions/539.html
- Do not store unencrypted sensitive information on the client side, CERT (FIO52-J)
- Expire and Max-Age Attributes, OWASP — Session Management Cheat Sheet

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 영속적인 쿠키(Persistent Cookie) · `setMaxAge` · 쿠키 만료시간 최소화 · 하드디스크 저장 · 중요정보 미포함 · 세션ID/권한등급
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
