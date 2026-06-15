# 서버사이드 요청 위조 (SSRF)

- **unit_code**: COURSE-IMP-IV-12
- **단원**: Ⅴ. 구현 단계 보안약점 진단 > 입력데이터 검증 및 표현
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정 (pp. 346-356)
- **관련 보안약점**: 입력 데이터 검증 및 표현 > 서버사이드 요청 위조(SSRF)

## 요약

적절한 검증절차를 거치지 않은 사용자 입력 값을 서버 간의 요청에 사용하는 경우 발생한다. 외부에 노출된 웹 서버에 취약한 애플리케이션이 존재하면 공격자는 URL 또는 요청문을 위조하여 접근통제를 우회하는 방식으로 비정상적인 동작을 유도할 수 있다.

## 공격 구조

공격자 → (조작된 HTTP 요청) → **External 취약한 애플리케이션** → (HTTP·FTP 등 요청에 포함된 페이로드) → **Internal 공격 대상 애플리케이션** 공격 → 대상의 응답 결과를 공격자에게 반환. 결과적으로 외부에서 **내부 신뢰 네트워크의 데이터를 획득**한다.

## 보안대책

1. 사용자 입력 값을 다른 시스템 서비스 호출에 사용하는 경우, **화이트리스트 방식**으로 필터링한다.
2. 무작위 URL을 받아들여야 한다면 내부의 URL을 **블랙리스트**로 지정하여 필터링한다.
3. 동일한 내부 네트워크에 있더라도 **기기 인증, 접근권한**을 확인하여 요청이 이루어지도록 한다.

## 진단 흐름도

- URL을 파라미터로 입력할 수 있는 경우, **URL 필터링** → 안전
- 필터링 없음 → 동일 내부 네트워크 **기기 인증** → 안전
- 기기 인증 없음 → 내부 IP **접근권한 확인** → 확인 시 안전, 아니면 **위험**

## 안전한 코드 (URL 화이트리스트)

```java
// 안전하지 않은 코드: 사용자 입력값으로 URL을 직접 생성
URL url = new URL(req.getParameter("url"));
HttpURLConnection conn = (HttpURLConnection) url.openConnection();
// /connect?url=http://192.168.0.45/member/list.json

// 안전한 코드: urlMap의 key만 입력받아 허용된 URL을 참조
private Map<String, URL> urlMap;
URL url = urlMap.get(req.getParameter("url"));
HttpURLConnection conn = (HttpURLConnection) url.openConnection();
```

프로퍼티 값(connectUrl)·url·host 등을 검증 없이 사용하는 코드는 검증 메소드를 추가하여 보완한다.

## 안전한 코드 (PHP IP/스킴 검증)

```php
$urlinfo = parse_url($url);
$ip = gethostbyname($urlinfo['host']);
if ($ip === "169.254.169.254") {           // 퍼블릭 클라우드 메타데이터 IP 차단
    die("Invalid host");
} elseif ($scheme !== 'http' && $scheme !== 'https') {  // HTTP(S) 스킴 체크
    die("Invalid scheme");
}
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
```

## 필터링 우회 기법 (검증 강화 필요)

- **문자열 인코딩 IP**: 오버플로우 점 포함(425.510.425.510), 10진수(2852039166), 16진수(0xA9FEA9FE), 8진수(0251.0376.0251.0376), 패딩 8진수
- **IDNA2003 변환**: 원문자(ⓖⓞⓞⓖⓛⓔ.com → google.com), 독일어 ß → 'ss'(wordpreß.com → wordpress.com)
- **Broken Parser**: `#`(evil-host#expected-host), `@`(expected-host@evil-host)로 탐지룰 회피
- **SSRF를 이용한 LFI**: `file:///etc/passwd`(로컬 파일), `ldap://localhost:1337/...`(로컬 LDAP)

## 시험 포인트

- SSRF는 검증되지 않은 입력값을 서버 간 요청에 사용 — 접근통제 우회로 내부 신뢰 네트워크 데이터 획득
- 보안대책: 화이트리스트 필터링 / 무작위 URL은 내부 URL 블랙리스트 / 내부망이라도 기기 인증·접근권한 확인
- 안전한 코드는 urlMap에 허용 URL 등록 후 key만 입력받아 참조
- PHP: 169.254.169.254(클라우드 메타데이터) 차단, http/https 외 스킴 차단
- 우회 기법: 진수 인코딩 IP / IDNA2003 / Broken Parser(#·@) / file·ldap 스킴 LFI
