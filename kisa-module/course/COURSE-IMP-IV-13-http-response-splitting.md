# HTTP 응답 분할

- **unit_code**: COURSE-IMP-IV-13
- **단원**: Ⅴ. 구현 단계 보안약점 진단 > 입력데이터 검증 및 표현
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정 (pp. 357-359)
- **관련 보안약점**: 입력 데이터 검증 및 표현 > HTTP 응답 분할

## 요약

CR(carriage return), LF(line feed)와 같은 개행문자를 포함한 사용자 입력값이 응답헤더(response header)에 쓰여지는 경우 발생한다.

## 공격 영향

- 공격자가 개행문자를 이용하여 첫 번째 응답을 종료시키고, 두 번째 응답에 악의적인 코드를 주입한다.
- **XSS 공격**, **캐시 훼손(cache poisoning)** 공격을 수행한다.

## 보안대책

- 외부입력값을 HTTP 응답 헤더에 포함시킬 경우 **CR·LF 개행문자의 포함여부를 확인하고 제거**한다.

## 진단 흐름도

- 응답 헤더 변수에 외부입력값을 사용하지 않으면 → **안전**
- 외부입력값을 사용하는 경우, 개행문자 제거·필터링 → 안전, 아니면 **위험**

## 안전한 코드 (개행문자 제거)

```java
String lastLogin = request.getParameter("last_login");
if (lastLogin == null || "".equals(lastLogin)) {
    return;
}
// 외부 입력값에서 개행문자(\r\n)를 제거한 후 쿠키의 값으로 설정
lastLogin = lastLogin.replaceAll("[\\r\\n]", "");
Cookie c = new Cookie("LASTLOGIN", lastLogin);
c.setMaxAge(1000);
c.setSecure(true);
c.setHttpOnly(true);
response.addCookie(c);
```

> 쿠키는 Set-Cookie 응답헤더로 전달되므로 개행문자열 포함 여부 검증이 필요하다.

## 시험 포인트

- HTTP 응답 분할은 CR·LF 개행문자 포함 입력값이 응답헤더에 쓰일 때 발생
- 공격: 첫 응답 종료 후 둘째 응답에 악성 코드 주입 → XSS, 캐시 훼손(cache poisoning)
- 보안대책: 응답헤더에 외부입력값 포함 시 CR·LF 개행문자 확인·제거
- 쿠키는 Set-Cookie 응답헤더로 전달되므로 개행문자 검증 필요 — `replaceAll("[\\r\\n]", "")`
