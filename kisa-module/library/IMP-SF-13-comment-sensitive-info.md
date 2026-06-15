# IMP-SF-13 · 주석문 안에 포함된 시스템 주요정보

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-615
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §13 주석문 안에 포함된 시스템 주요정보 (p.386–389)

## 가. 개요

비밀번호를 주석문에 넣어두면 시스템 보안이 훼손될 수 있다. 소프트웨어 개발자가 편의를 위해서 주석문에 비밀번호를 적어둔 경우, 소프트웨어가 완성된 후에는 제거하는 것이 어렵게 된다. 또한, 공격자가 소스코드에 접근할 수 있다면, 아주 쉽게 시스템에 침입할 수 있다.

## 나. 보안대책

- 주석에는 ID, 비밀번호 등 보안과 관련된 내용을 기입하지 않는다.

## 다. 코드예제

### Java
```java
// ❌ 취약: 주석문으로 DB연결 ID, 비밀번호의 중요한 정보를 노출시켜 안전하지 않다.
// DB연결 root / a1q2w3r3f2!@
con = DriverManager.getConnection(URL, USER, PASS);
```
```java
// ✅ 안전: ID, 비밀번호등의 중요 정보는 주석에 포함해서는 안된다.
con = DriverManager.getConnection(URL, USER, PASS);
```
> 프로그램 개발 시에 주석문 등에 남겨놓은 사용자 계정이나 비밀번호 등의 정보는 개발 완료 시에 확실하게 삭제하여야 한다.

### C#
```csharp
// ❌ 취약: 주석문으로 DB연결 ID, 비밀번호의 중요한 정보를 노출시켜 안전하지 않다.
//DB연결 root / a1q2w3r3f2!@
conn = customGetConnection(USER, PASS);
```
```csharp
// ✅ 안전: ID, 비밀번호등의 중요 정보는 주석에 포함해서는 안된다.
conn = customGetConnection(USER, PASS);
```

### C
```c
/* ❌ 취약: password is "admin" */
/* passwd is "admin" */
int verfiyAuth(char *ipasswd, char *orgpasswd){
  char *admin = "admin";
  if(strncmp(ipasswd, oprgpasswd, sizeof(ipasswd)) != 0){
    printf("Authentication Fail!\n");
  }
  return admin;
```
```c
// ✅ 안전: 불필요한 주석은 삭제해야 한다.
int verfiyAuth(char *ipasswd, char *orgpasswd){
  char *admin = "admin";
  if(strncmp(ipasswd, oprgpasswd, sizeof(ipasswd)) != 0){
    printf("Authentication Fail!\n");
  }
  return admin;
}
```

## 라. 진단방법

1. **①** DB접속, 관리자 로그인 등이 구현된 코드를 확인
2. **②** 주석을 확인하여 암호 포함여부 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 주석문 안에 비밀번호를 적어 놓고 있으므로 취약
public void daoTest() throws Exception {
  // db sample : 84d5d0a08a3ec5e2d91a
  // 암호화 전, 후 : 1365ADMIN_01, aa84c40031d808196537ad3dcf81f9af
  String pwd= "46c165a343fd6841273ae04655af24dd";
  String pwd1= ARIAEngine.decARIA(pwd);
  System.out.println(pwd1);
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 주석에 password/passwd/비밀번호 텍스트가 있어도 실제 비밀번호가 아니면 안전
// 암호화
String Sid = getSessionValue(session, "ihidnum");
Sid = AEScryptWithSaltKey.encode(StrTool.sNN(Sid));
String sIhidnum = Sid;
```

## 마. 참고자료

- CWE-615 Information Exposure Through Comments, MITRE — http://cwe.mitre.org/data/definitions/615.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 주석문 · 비밀번호 · 정보 노출 · 소스코드 접근 · 계정 정보 삭제
- **객관형 시드**: 주석에 비밀번호/계정을 남긴 코드와 제거한 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 주석에 password/passwd 텍스트가 등장하는 코드 제시 → 실제 비밀번호 노출 여부로 정탐·오탐 판정
