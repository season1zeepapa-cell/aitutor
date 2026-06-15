# IMP-SF-09 · 취약한 비밀번호 허용

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-521
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §9 취약한 비밀번호 허용 (p.370–374)

## 가. 개요

사용자에게 강한 비밀번호 조합규칙을 요구하지 않으면 사용자 계정이 취약하게 된다. 안전한 비밀번호를 생성하기 위해서는 한국인터넷진흥원 「암호이용안내서」의 비밀번호 설정규칙을 적용해야 한다.

## 나. 보안대책

- 비밀번호 생성 시 **강한 조건 검증** 수행
- 비밀번호는 **숫자·영문자·특수문자** 등을 혼합하여 사용
- **주기적으로 변경**하여 사용

## 다. 코드예제

### Java
가입 시 비밀번호 복잡도(자릿수·영문자·숫자·특수문자 혼합) 검증 후 가입 승인처리.

```java
// ❌ 취약: 복잡도 체크 없이 등록
String pass = request.getParameter("pass");
UserVo userVO = new UserVo(id, pass);
String result = registerDAO.register(userVO);
```
```java
// ✅ 안전: 정규식으로 복잡도 검증 후 등록
Pattern pattern = Pattern.compile("((?=.*[a-zA-Z])(?=.*[0-9@#$%]). {9, })");
Matcher matcher = pattern.matcher(pass);
if (!matcher.matches()) {
  return "비밀번호 조합규칙 오류";
}
UserVo userVO = new UserVo(id, pass);
String result = registerDAO.register(userVO);
```

### C#
```csharp
// ❌ 취약: 빈 비밀번호 허용
NetworkCredential myCred = new NetworkCredential(UserName, "");
// ✅ 안전: 빈 비밀번호 사용하지 않음
NetworkCredential secure_myCred = new NetworkCredential(UserName, Password);
```

### C
```c
// ❌ 취약: 비밀번호 값에 대한 검증 없이 사용
mysql_real_connect(connectInstance, "192.168.100.211", id, pwd, "database", 0, NULL, 0);

// ✅ 안전: 적절한 검증 후 사용
if(checkValidationId( id ) == true && checkValidationPwd( pwd ) == true ) {
  mysql_real_connect(connectInstance, "192.168.100.211", id, pwd, "database", 0, NULL, 0);
}
```

## 라. 진단방법

1. 비밀번호 생성·변경 때 입력값을 **안전한 비밀번호 조합규칙**으로 검사하는 모듈이 존재하는지 확인
2. 널(Null) 체크, 자릿수, 특수문자 포함 등 비밀번호 요구 조건이 없거나 약하면 취약 진단

> **(참고) 안전한 비밀번호 조합규칙**: 영문자(대·소 구별)·숫자·특수문자 조합, 길이 8~10자리 이상, 특정 패턴 및 사용자 ID 등을 비밀번호로 사용 금지.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 널 체크·자릿수·특수문자 등 요구 조건 없이 사용자 등록 → 취약
UserVo userVO = new UserVo(id, pass);
String result = registDAO.regist(userVO);
```
```java
// 가입자 비밀번호 복잡도 검증 없이 가입 승인 처리 → 취약
String passwd = request.getParameter("passwd");
// 비밀번호 복잡도 검증 없이 가입 승인 처리
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 로그인 시 비밀번호 확인 (저장 아님) → 취약하지 않음
String pass = request.getParameter("pass");
```
```java
// 비밀번호 확인 목적 (저장 아님) → 취약하지 않음
password = (String)props.getProperty("password");
if (authenticate(userName, password)) { … }
```

## 마. 참고자료

- CWE-521 Weak Password Requirements, MITRE — http://cwe.mitre.org/data/definitions/521.html
- Password Complexity, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 비밀번호 복잡도 · 조합규칙 · 영문자/숫자/특수문자 혼합 · 8~10자리 이상 · 널(Null) 체크 · 빈 비밀번호 금지 · 암호이용안내서
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
