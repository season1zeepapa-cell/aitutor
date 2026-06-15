# IMP-AA-01 · DNS lookup에 의존한 보안결정

> **단계** 구현 · **분류** API 오용 · **CWE** CWE-247
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제7절 §1 (p.492–495)

## 가. 개요

공격자가 DNS 엔트리를 속일 수 있으므로 **도메인명에 의존한 보안결정**(인증·접근통제 등)을 하면 안 된다. 로컬 DNS 캐시가 오염되면 트래픽이 공격자를 경유하거나, 공격자가 동일 도메인 서버인 것처럼 위장할 수 있다.

## 나. 보안대책

- 보안결정에서 도메인명 기반 DNS lookup을 하지 않는다
- 호스트 이름 비교 대신 **IP 주소를 직접 비교**한다

## 다. 코드예제

### Java
```java
// ❌ 취약: getCanonicalHostName() 도메인 검사로 신뢰 결정
InetAddress addr = InetAddress.getByName(ip);
if (addr.getCanonicalHostName().endsWith("trustme.com")) {
  do_something_for_Trust_System();
}
```
```java
// ✅ 안전: IP 주소 직접 비교
String ip = req.getRemoteAddr();
if (ip == null || "".equals(ip)) return ;
String trustedAddr = "127.0.0.1";
if (ip.equals(trustedAddr)) {
  do_something_for_Trust_System();
}
```

### C#
```csharp
// ❌ 취약: Dns.GetHostByAddress() 후 호스트명 검사
IPHostEntry hostInfo = Dns.GetHostByAddress(hostIPAddress);
string hostName = hostInfo.HostName;
if (hostName.EndsWith("trust.com")) { trusted = true; }
```
```csharp
// ✅ 안전: IP 주소 직접 비교
string remoteIpAddress = Request.ServerVariables["REMOTE_HOST"];
if (remoteIpAddress.Equals(trustedAddr)) {
  trusted = true;
  Do_something_for_Trust_System();
}
```

### C
```c
// ❌ 취약: gethostbyaddr 결과의 호스트 이름으로 신뢰 판별
char* tHost = "trustme.example.com";
hp = gethostbyaddr((char *) &myaddr, sizeof(struct in_addr), AF_INET);
if (hp && !strncmp(hp->h_name, tHost, sizeof(tHost))) { trusted = true; }
```
```c
// ✅ 안전: 비교 대상을 IP(127.0.0.1)로 바꿔 직접 비교
char* tHost = "127.0.0.1";
hp = gethostbyaddr((char *) &myaddr, sizeof(struct in_addr), AF_INET);
if (hp && !strncmp(hp->h_name, tHost, sizeof(tHost))) { trusted = true; }
```

## 라. 진단방법

1. **①** DNS lookup을 하는 모듈이 존재하는지 확인
2. **②** 보안결정을 하는 부분이 존재하는지 확인

> DNS 이름으로 요청의 신뢰를 검사하나, 공격자가 DNS 캐시를 조작하면 잘못된 신뢰 상태 정보를 얻을 수 있어 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// DNS lookup 후 도메인(trustme.com) 소속 여부로 신뢰 결정 → DNS 캐시 조작 우회 가능 → 취약
public class U247 extends HttpServlet {
  public void doGet(HttpServletRequest req, HttpServletResponse res) ... {
    String ip = req.getRemoteAddr();
    InetAddress addr = InetAddress.getByName(ip);             // ①
    if (addr.getCanonicalHostName().endsWith("trustme.com")) { // ②
      trusted = true;
    }
  }
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_원문에 오탐 코드 예시 없음._

## 마. 참고자료

- CWE-247 Reliance on DNS Lookups in a Security Decision, MITRE — http://cwe.mitre.org/data/definitions/247.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: DNS lookup · 도메인명 기반 보안결정 · DNS 캐시 오염 · getCanonicalHostName · IP 주소 직접 비교 · 위장(spoofing) · 인증·접근통제
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
