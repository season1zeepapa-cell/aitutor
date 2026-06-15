# DNS Lookup에 의존한 보안결정

- **코드**: COURSE-IMP-AA-01 (chapter ref: IMP-AA-01)
- **단계**: Ⅴ. 구현 단계 보안약점 진단
- **분류**: API 오용(api_abuse)
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, 493-496쪽

## 요약

프로그램 로직에서 도메인 명에 의존하여 보안을 결정하는 경우 발생하는 API 오용 보안약점이다. 공격자가 DNS 엔트리를 속일 수 있으므로 도메인 명에 의존한 보안 결정은 인증·접근통제 오류를 일으킬 수 있다. 보안 결정에 DNS 조회결과를 사용하지 않고 실제 IP 주소를 사용해야 한다.

## API 오용 보안약점 개요

- API 오용: 의도된 사용에 반하는 방법으로 API를 사용하거나, 보안에 취약한 API를 사용하여 발생할 수 있는 보안 약점.
- API 오용 보안약점 2종: ① DNS Lookup에 의존한 보안결정, ② 취약한 API 사용.

## 개요 — 약점 정의와 위협

- 프로그램 로직에서 도메인 명에 의존하여 보안을 결정하는 경우 발생한다.
- 공격자가 DNS 엔트리를 속일 수 있으므로 도메인 명에 의존해 보안 결정을 하면 인증 및 접근 통제 오류 등을 일으킬 수 있다.
- DNS 서버 캐쉬가 공격자에 의해 오염되면 사용자와 특정 서버 간 네트워크 트래픽이 공격자를 경유하도록 할 수 있다.
- 공격자가 마치 동일 도메인에 속한 서버인 것처럼 위장할 수도 있다.

## 보안대책

- 보안 결정에 DNS 조회결과를 사용하지 않는다.
- 도메인 명이 아닌 실제 서버의 IP 주소를 사용하여 DNS 변조에 방어한다.

## 진단 흐름도

1. DNS lookup 모듈 확인 → DNS lookup에 따른 보안 결정 여부 확인.
2. **미존재** → 안전.
3. **존재** → 위험.

## 코드 예시 — getCanonicalHostName vs IP 비교

**안전하지 않은 코드**
```java
public void doGet(HttpServletRequest req, HttpServletResponse res)
  throws ServletException, IOException {
  boolean trusted = false;
  String ip = req.getRemoteAddr();
  InetAddress addr = InetAddress.getByName(ip);
  // 도메인은 공격자에 의해 실행되는 서버의 DNS가 변경될 수 있으므로 안전하지 않다.
  if (addr.getCanonicalHostName().endsWith("trustme.com")) {
      do_something_for_Trust_System();
  }
}
```

**안전한 코드**
```java
public void doGet(HttpServletRequest req, HttpServletResponse res)
  throws ServletException, IOException {
  String ip = req.getRemoteAddr();
  if (ip == null || "".equals(ip)) return ;
  // 이용하려는 실제 서버의 IP 주소를 사용하여 DNS변조에 방어한다
  String trustedAddr = "127.0.0.1";
  if (ip.equals(trustedAddr)) {
      do_something_for_Trust_System();
  }
}
```

## 보충 — DNS Spoofing & DNS Cache Poisoning

- **DNS Spoofing**: 도메인 IP 요청 시 공격자가 잘못된 IP를 응답해 사용자를 위장된(악성) 웹사이트로 리다이렉트하는 공격.
- **DNS Cache Poisoning**: DNS 서버(로컬 DNS) 캐시에 위조된 도메인-IP 레코드를 주입(오염)하는 공격. DNS Spoofing을 일으키는 한 가지 방법 — 특정 DNS 서버를 "감염"시켜 그 서버를 쓰는 모든 사용자가 피해를 입게 한다.
- **대응 방안**:
  - DNSSEC: DNS 응답에 디지털 서명을 적용해 무결성·원본 검증 (가장 효과적인 방어책 중 하나).
  - DoH(DNS over HTTPS) / DoT(DNS over TLS): DNS 요청 암호화.
  - DNS 서버 설정 강화: 재귀쿼리 허용 범위 제한, 쿼리 ID·포트 무작위화, TTL 단축.
  - 정기적인 DNS 캐시 청소 (`ipconfig /flushdns` 등).
  - IDS/IPS 등 보안 솔루션으로 비정상 DNS 트래픽 탐지·차단.

## 시험 포인트

- API 오용 2종: ① DNS Lookup에 의존한 보안결정, ② 취약한 API 사용.
- 원인: 프로그램 로직이 도메인 명에 의존해 보안 결정 — DNS 엔트리 위조로 인증·접근통제 오류 발생.
- 보안대책: 보안 결정에 DNS 조회결과 미사용, 실제 IP 주소로 비교.
- 안전하지 않은 코드: `getCanonicalHostName().endsWith("trustme.com")` / 안전한 코드: `ip.equals(신뢰 IP)`.
- DNS Cache Poisoning은 DNS Spoofing을 일으키는 한 방법 — 대응책 1순위는 DNSSEC.
- 진단 흐름: DNS lookup에 따른 보안 결정이 존재하면 위험.

## 관련 라이브러리 항목
- IMP-AA-01
