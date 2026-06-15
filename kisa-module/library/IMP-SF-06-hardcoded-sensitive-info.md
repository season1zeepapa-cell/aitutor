# IMP-SF-06 · 하드코드된 중요정보

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-259 (비밀번호) / CWE-321 (암호화 키)
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §6 하드코드된 중요정보 (p.350–359)

## 가. 개요

프로그램 코드 내부에 하드코드된 **비밀번호** 또는 **암호화키**를 포함하여 내부 인증에 사용하거나 암호화를 수행하면 중요정보(관리자 정보, 암호화된 정보 등)가 유출될 수 있다.

## 나. 보안대책

- 비밀번호는 **암호화하여 별도의 파일에 저장**하여 사용
- 중요정보 암호화 시 **상수가 아닌** 암호화 키 사용
- 소스코드 내부에 **상수형태의 암호화 키를 저장하지 않음**

## 다. 코드예제

### Java (하드코드된 비밀번호)
```java
// ❌ 취약: DB 비밀번호를 상수로 하드코딩
private static final String PASS = "SCOTT"; // DB PW;
con = DriverManager.getConnection(URL, USER, PASS);
```
```java
// ✅ 안전: 암호화된 비밀번호를 프로퍼티에서 읽어 복호화
String PASS = props.getProperty("EncryptedPswd");
byte[] decryptedPswd = cipher.doFinal(PASS.getBytes());
PASS = new String(decryptedPswd);
```

### C# (하드코드된 비밀번호)
```csharp
// ❌ 취약: 평문 비밀번호로 NetworkCredential 생성
NetworkCredential myCred = new NetworkCredential(UserName, Password);
```
```csharp
// ✅ 안전: SecureString 으로 처리
SecureString SecurelyStoredPassword = new SecureString();
NetworkCredential secure_myCred = new NetworkCredential(UserName, SecurelyStoredPassword);
```

### C (하드코드된 비밀번호)
```c
// ❌ 취약: 비밀번호 상수 하드코딩
char *password = "password";
```
```c
// ✅ 안전: 환경 변수에서 불러옴
char *password = getenv("password");
```

### Java (하드코드된 암호화 키)
```java
// ❌ 취약: 암호화 키를 소스에 상수로 사용
String key = "22df3023sf~2;asn!@#/>as";
```
```java
// ✅ 안전: 외부 파일에서 읽어 복호화
String key = getPassword("./password.ini");
key = decrypt(key);
```

### C# (하드코드된 암호화 키)
```csharp
// ❌ 취약: key/iv 를 소스에 상수로 정의
byte[] key = new byte[] { 0x43, 0x87, 0x23, 0x72 };
byte[] iv  = new byte[] { 0x43, 0x87, 0x23, 0x72 };
```
```csharp
// ✅ 안전: 외부 파일에서 읽어 복호화
byte[] key = GetKey(./password.ini);
byte[] iv  = GetIV(./password.ini);
```

### C (하드코드된 솔트/암호값)
```c
// ❌ 취약: 솔트·암호값을 소스에 하드코딩
cpasswd = crypt(passwd, "salt");
if (strcmp(cpasswd, "68af404b513073582b6c63e6b") != 0) { ... }
```
```c
// ✅ 안전: 외부에서 솔트·암호값을 불러와 비교
char* storedpasswd = getenv("password");
char* salt = getenv("salt");
cpasswd = crypt(passwd, salt);
if (strcmp(cpasswd, storedpasswd) != 0) { ... }
```

## 라. 진단방법

### 하드코드된 비밀번호
1. 사용자·관리자 로그인(식별·인증) 모듈·함수에서 비밀번호가 소스에 직접 코딩되어 있는지 확인
2. 내·외부 서버(업무서버·DB) 접속 모듈·함수에서 접속 비밀번호 하드코딩 여부 확인
3. 별도 파일에 저장하지 않고 소스에 하드코딩되어 있으면 **취약 판정**

### 하드코드된 암호화 키
1. **①** DB접속 등 비밀번호 사용 로직 확인
2. **②** 사용된 비밀번호의 암호화 여부 확인
3. **③** 암호화된 비밀번호가 소스 내에 존재하는지 확인 → 존재 시 취약. 암호화 키를 소스에 하드코딩하면 취약

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// private key 를 상수로 정의하고 보안키 생성에 사용 → 취약
byte[] privateKey = { '6', '8', 'a', 'f', '4', '0', '4', 'b', '5', '1', '3', '0', '7' };
javax.crypto.SecretKey myDesKey = new javax.crypto.spec.SecretKeySpec(privateKey, "DES");
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 암호화 키가 아닌 알고리즘명("DESede") 지정 → 안전
sKey = new SecretKeySpec( key, "DESede" );
```

## 마. 참고자료

- CWE-259 Use of Hard-coded Password, MITRE — http://cwe.mitre.org/data/definitions/259.html
- CWE-321 Use of Hard-coded Cryptographic Key, MITRE — http://cwe.mitre.org/data/definitions/321.html
- CERT (MSC18-C) / OWASP (Hardcoded Password / Use of hard-coded password)

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 하드코드된 비밀번호 · 하드코드된 암호화 키 · 상수 형태 · 별도 파일 저장 · 복호화 · 환경 변수(getenv) · SecureString · 알고리즘명 vs 키
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
