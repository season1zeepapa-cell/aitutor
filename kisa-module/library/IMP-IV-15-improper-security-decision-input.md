# IMP-IV-15 · 보안기능 결정에 사용되는 부적절한 입력값

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-807
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §15 보안기능 결정에 사용되는 부적절한 입력값 (p.297–302)

## 가. 개요

응용프로그램이 외부입력값에 대한 신뢰를 전제로 보호메커니즘을 사용하면 공격자가 입력값을 조작하여 보호메커니즘을 우회할 수 있다. 개발자들은 흔히 **쿠키·환경변수·히든필드** 같은 입력값이 조작될 수 없다고 가정하지만, 공격자는 이를 변경할 수 있고 조작은 탐지되지 않을 수 있다. 인증·인가와 같은 보안결정이 이런 입력값에 기반하면 보안을 우회할 수 있으므로, 충분한 **암호화·무결성 체크**를 수행하고 그런 메커니즘이 없으면 외부 입력값을 신뢰해서는 안 된다.

## 나. 보안대책

- 상태정보·민감 데이터(특히 **사용자 세션정보**)는 **서버에 저장**하고 보안확인 절차도 서버에서 실행
- 신뢰할 수 없는 입력값이 들어오는 지점과 보안결정에 쓰이는 입력값을 식별하고, **입력값에 의존하지 않는 구조**로 변경 가능한지 검토

## 다. 코드예제

### Java
사용자 브라우저의 가격(단가)을 그대로 처리하면 사용자가 임의로 변경할 수 있다.

```java
// ❌ 취약: 히든필드 price 를 그대로 결제에 사용
price = request.getParameter("price");
total = Integer.parseInt(quantity) * Float.parseFloat(price);
```
```java
// ✅ 안전: item 으로 서버 보유 가격을 조회하여 계산
item = request.getParameter("item");
price = productService.getPrice(item);
total = Integer.parseInt(quantity) * price;
```

### C#
```csharp
// ❌ 취약: 평문 인증정보를 쿠키에 저장
HttpCookie cookie = new HttpCookie("Authentificated", "1");
Response.Cookies.Add(cookie);
```
```csharp
// ✅ 안전: 인증정보를 서버 세션에 저장
Session["Authentificated"] = "1";
```

### C
```c
// ❌ 취약: 환경변수의 서버 주소를 그대로 사용 → 라이선스 검증 우회 가능
char* server_info = getenv("server_addr");
connect( sockfd, (struct sockaddr *)server_addr, sizeof(struct socketaddr) );
```
```c
// ✅ 안전: 고정된 서버 주소를 사용
server_info.sin_addr.s_addr = inet_addr("127.0.0.1");
connect( sockfd, (struct sockaddr *)server_addr, sizeof(struct socketaddr) );
```

## 라. 진단방법

1. **①** 인증여부 확인에 사용하는 변수 확인
2. **②** 그 변수가 세션정보 등 서버내부에서 검증된 값인지 확인
3. 인증결정 기준으로 **외부 입력값을 그대로 사용**하면 취약

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```jsp
<%
// 평문으로 인증정보 "authenticated" 를 쿠키에 저장 → 공격자 변경 가능 → 취약
Cookie authCookie = new Cookie("authenticated", "1");
response.addCookie(authCookie);
%>
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 히든필드 price 가 아닌 서버가 정한 가격(1000) 사용 → 안전
price = 1000;
quantity = request.getParameter("quantity");
total = quantity * Float.parseFloat(price);
```

## 마. 참고자료

- CWE-807 Reliance on Untrusted Inputs in a Security Decision, MITRE — http://cwe.mitre.org/data/definitions/807.html
- ENV02-J, CERT · Session Management Cheat Sheet, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 쿠키 조작 · 히든필드 · 환경변수 · 서버 세션 저장 · 보안결정 입력값 · 무결성 체크 · 암호화
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
