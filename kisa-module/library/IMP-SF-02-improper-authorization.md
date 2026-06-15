# IMP-SF-02 · 부적절한 인가

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-285
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §2 부적절한 인가 (p.319–324)

## 가. 개요

프로그램이 모든 가능한 실행경로에 대해서 접근제어를 검사하지 않거나 불완전하게 검사하는 경우, 공격자는 접근 가능한 실행경로 정보를 유출할 수 있다.

## 나. 보안대책

- 정보·기능을 **역할에 따라 배분**하여 공격노출면(Attack Surface) 최소화
- 사용자 권한에 따른 **ACL(Access Control List)** 관리
- JAAS Authorization Framework, OWASP ESAPI Access Control 등 프레임워크 사용

## 다. 코드예제

### Java
세션에 저장된 사용자 정보로 삭제작업 권한이 있는지 확인한 뒤 권한이 있는 경우에만 수행해야 한다.

```java
// ❌ 취약: delete 작업 권한 확인 없이 수행
if (action != null && action.equals("delete")) {
  boardDao.delete(contentId);
}
```
```java
// ✅ 안전: 세션 사용자 권한(checkAccessControlList) 확인 후 수행
User user = (User)session.getAttribute("user");
if (action != null && action.equals("delete") && checkAccessControlList(user,action)) {
  boardDao.delete(contentId);
}
```

### C#
```csharp
// ❌ 취약: 운영자 권한 검사 없이 컨트롤러/액션 접근 가능
public class AdministrationController : Controller { ... }

// ✅ 안전: [Authorize(Roles)] 로 운영자 권한 검사 후 접근
[Authorize(Roles = "Administrator")]
public class AdministrationController : Controller { ... }
```

### C
```c
// ❌ 취약: 사용자 인증 없이 LDAP 검색 시도
rc = ldap_search_ext_s(ld, FIND_DN, LDAP_SCOPE_BASE, filter, ...);

// ✅ 안전: bind 인증 + 로그인 정보 일치 검사 후 LDAP 검색
if (ldap_simple_bind_s(ld, username, password) != LDAP_SUCCESS) return(FAIL);
if (strcmp(username, getLoginName()) != 0) return(FAIL);
rc = ldap_search_ext_s(ld, FIND_DN, LDAP_SCOPE_BASE, filter, ...);
```

## 라. 진단방법

1. 중요정보를 저장하는 **외부시스템(웹/DB/LDAP 등)** 식별, 접근·변경 권한을 사전 정의했는지 확인
2. **①** 해당 정보·기능을 호출하는 함수에서 **사전 정의한 권한 소유여부를 검사**하는지 확인
3. 접근제어를 서버측이 아닌 **JavaScript 등 클라이언트측에서 제어하여 우회 가능**한지 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 익명(none) LDAP 인증 → anonymous binding 허용 → 임의 사용자 정보 접근 가능 → 취약
env.put(Context.SECURITY_AUTHENTICATION, "none");
env.put(Context.SECURITY_PRINCIPAL, sUid);
env.put(Context.SECURITY_CREDENTIALS, sPwd);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 세션 사용자 권한(checkAccessControlList) 확인 후 삭제 → 안전
User user = (User)session.getAttribute("user");
if (action != null && action.equals("delete") && checkAccessControlList(user,action)) {
  // 삭제작업을 수행한다.
}
```

## 마. 참고자료

- CWE-285 Improper Authorization, MITRE — http://cwe.mitre.org/data/definitions/285.html
- Access Control, OWASP — https://www.owasp.org/index.php/Access_Control_Cheat_Sheet

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 접근제어(Access Control) · ACL · 권한 검사 · checkAccessControlList · Authorize(Roles) · anonymous binding · 공격노출면(Attack Surface)
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
