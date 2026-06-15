# IMP-IV-12 · 서버사이드 요청 위조 (SSRF)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-918
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §12 서버사이드 요청 위조 (p.276–283)

## 가. 개요

적절한 검증절차를 거치지 않은 사용자 입력 값을 **서버간의 요청**에 사용하여 악의적인 행위가 발생할 수 있는 보안약점이다. 외부에 노출된 웹 서버에 취약한 애플리케이션이 있으면 공격자는 URL·요청문을 위조하여 접근통제를 우회하고 비정상적인 동작을 유도하거나 신뢰된 네트워크의 데이터를 획득할 수 있다.

## 나. 보안대책

- 사용자 입력 값을 다른 시스템 서비스 호출에 쓸 경우 **화이트리스트** 방식 필터링
- 무작위 URL을 받아야 한다면 내부 URL을 **블랙리스트**로 필터링
- 동일 내부 네트워크라도 **기기 인증·접근권한 확인** 후 요청

## 다. 코드예제

### Java
공격 예: `?url=http://192.168.0.45/member/list.json`(내부망 정보), 외부 차단된 admin 접근, `user:x@사설IP`(도메인 체크 우회), 단축 URL(필터 우회) 등.

```java
// ❌ 취약: 사용자 입력값(url)을 검증 없이 사용
URL url = new URL(req.getParameter("url"));
HttpURLConnection conn = (HttpURLConnection) url.openConnection();
```
```java
// ✅ 안전: 사전 정의된 urlMap 에서 key 로만 URL 참조 (임의 조작 불가)
private Map<String, URL> urlMap;
URL url = urlMap.get(req.getParameter("url"));
HttpURLConnection conn = (HttpURLConnection) url.openConnection();
```

## 라. 진단방법

1. **①** 다른 시스템의 서비스를 호출하는 함수 존재 여부 확인
2. **②** 호출에 사용되는 입력 값이 신뢰할 수 있는 값인지 확인

> 입력 값이 신뢰할 수 없고 별도 검증절차가 없으면 안전하지 않다고 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// openConnection URL 을 properties 에서 참조 → properties 위변조 가능 → 취약
URL url = new URL(properties.getProperty("connectUrl"));
HttpURLConnection conn = (HttpURLConnection) url.openConnection();
```
```java
// inURL 을 검증 없이 new URL(url).openStream() 에 전달 → 취약
String str = getRemoteContent(inUrl); // 내부: new URL(url).openStream()
```
```java
// host 파라미터를 검증 없이 "http://"+host+"/favicon.ico" 로 요청 → 내부 데이터 유출 → 취약
// 공격: /getFavicon?host=192.168.176.1:8080/secrets.txt?
String host = request.getParameter("host");
byte[] bytes = getImage("http://" + host + "/favicon.ico");
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```php
// 메타데이터 서비스 IP(169.254.169.254) 블랙리스트 + HTTP(S) 스킴 체크 → 안전
$ip = gethostbyname($host);
if ($ip === "169.254.169.254") { die("Invalid host"); }
elseif ($scheme !== 'http' && $scheme !== 'https') { die("Invalid scheme"); }
```
```java
// 내부 대역 IP를 isPrivateIP() 블랙리스트로 필터링 → 안전
// 단, 블랙리스트 우회 공격 가능 여부 검토 후 판단 필요
if ( isPrivateIP(url) == true ) { return "invalid url"; }
```

> **참고(인코딩/파서 우회)**: 오버플로 IP(`425.510.425.510`), 10진수(`2852039166`), 16진수(`0xA9FEA9FE`), 8진수(`0251.0376.0251.0376`), IDNA2003(`ⓖⓞⓞⓖⓛⓔ.com`, `wordpreß.com`), Broken Parser(`evil-host#expected-host`, `expected-host@evil-host`), LFI(`file:///etc/passwd`, `ldap://...`) 등으로 블랙리스트 우회 가능.

## 마. 참고자료

- CWE-918: Server-Side Request Forgery (SSRF), MITRE — https://cwe.mitre.org/data/definitions/918.html
- Server Side Request Forgery, OWASP — https://owasp.org/www-community/attacks/Server_Side_Request_Forgery

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: URL 화이트리스트 · 내부 URL 블랙리스트 · 메타데이터 서비스(169.254.169.254) · 사설IP(isPrivateIP) · 도메인 체크 우회 · URL Map 키 참조 · 블랙리스트 우회
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
