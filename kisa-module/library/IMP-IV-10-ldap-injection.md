# IMP-IV-10 · LDAP 삽입 (LDAP Injection)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-90
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §10 LDAP 삽입 (p.264–271)

## 가. 개요

공격자가 외부 입력으로 의도하지 않은 **LDAP(Lightweight Directory Access Protocol)** 명령어를 수행할 수 있다. 웹 응용프로그램이 사용자가 제공한 입력을 올바르게 처리하지 못하면 공격자가 LDAP 명령문의 구성을 바꿀 수 있고, 프로세스가 명령을 실행한 컴포넌트와 동일한 권한으로 동작한다. 외부입력값을 적절한 처리 없이 LDAP 쿼리문·결과의 일부로 사용하면 공격자가 쿼리문 내용을 마음대로 변경할 수 있다.

## 나. 보안대책

- DN(Distinguished Name)·필터에 사용되는 사용자 입력값에서 **특수문자 제거**
- 특수문자를 써야 하면 특수문자( `= + < > # ; \` 등)가 실행명령이 아닌 **일반문자로 인식**되도록 처리

## 다. 코드예제

### Java
공격 예: `userSN`·`userPassword` 에 `*` 전달 시 필터가 `(&(sn=S*)(userPassword=*))` 가 되어 항상 참 → 의도하지 않은 동작.

```java
// ❌ 취약: 입력값 검증 없이 필터 결합
String filter = "(&(sn=" + userSN + ")(userPassword=" + userPassword + "))";
NamingEnumeration<?> results = dctx.search(base, filter, sc);
```
```java
// ✅ 안전: 정규식 화이트리스트 검증 후 필터 결합
if (!userSN.matches("[\\w\\s]*") || !userPassword.matches("[\\w]*")) {
  throw new IllegalArgumentException("Invalid input");
}
String filter = "(&(sn=" + userSN + ")(userPassword=" + userPassword + "))";
NamingEnumeration<?> results = dctx.search(base, filter, sc);
```

### C#
```csharp
// ❌ 취약: 인증하지 않은 익명 바인딩으로 LDAP 쿼리 실행
oDE = new DirectoryEntry(GetStrPath());

// ✅ 안전: userSN/userPW 로 인증 후 LDAP 쿼리 실행
oDE = new DirectoryEntry(GetStrPath(), userSN, userPW);
```

### C
```c
// ❌ 취약: 외부에서 불러온 filter 를 검증 없이 사용
char *filter = getenv("Filter");
error_code = ldap_search_ext_s(ld, FIND_DN, LDAP_SCOPE_BASE, filter, ...);

// ✅ 안전: 공격 가능한 특수문자(* ( ) ...) 검사 후 사용
for(i = 0; *(filter + i) != 0; i++) {
  switch(*(filter + i)) {
    case '*': case '(': case ')': … return;
  }
}
error_code = ldap_search_ext_s(ld, FIND_DN, LDAP_SCOPE_BASE, filter, ...);
```

## 라. 진단방법

1. **①** LDAP 조회 쿼리가 실행됨을 확인
2. **②** LDAP 조회문의 필터에 사용되는 변수가 외부 입력값인지 확인
3. **③** 해당 변수에 대한 필터링 모듈 존재 여부 확인

> 필터링 모듈이 존재하거나 프레임워크가 적절히 조치할 때 안전 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 외부 입력 name 이 필터 문자열로 사용. name="*" → "(name=*)" 항상 참 → 취약
String name = props.getProperty("name");
String filter = "(name =" + name + ")";
NamingEnumeration answer = ctx.search("ou=NewHires", filter, new SearchControls());
```
```java
// 외부 입력 name 이 검색 base/인자로 사용 → 임의 루트 디렉터리 접근 가능 → 취약
String name = props.getProperty("ldap.properties");
BasicAttribute attr = new BasicAttribute("name", name);
NamingEnumeration answer = ctx.search("ou=NewHires", attr.getID(), new SearchControls());
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_(원문에 해당 사례 없음)_

## 마. 참고자료

- CWE-90 LDAP Injection, MITRE — http://cwe.mitre.org/data/definitions/90.html
- Prevent LDAP injection (IDS54-J), CERT / OWASP LDAP Injection Prevention Cheat Sheet / LDAP Resources(ldapman.org)

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: LDAP 필터 조작 · 특수문자 제거 · DN · 와일드카드(*) 항상 참 · 익명 바인딩 · 화이트리스트 검증 · 고정 쿼리문
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
