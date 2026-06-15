# IMP-SF-14 · 솔트 없이 일방향 해쉬 함수 사용

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-759
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §14 솔트 없이 일방향 해쉬 함수 사용 (p.390–393)

## 가. 개요

비밀번호를 저장시 일방향 해시함수의 성질을 이용하여 비밀번호의 해시값을 저장한다. 만약 비밀번호를 솔트(Salt)없이 해시하여 저장한다면, 공격자는 레인보우 테이블과 같이 해시값을 미리 계산하여 비밀번호를 찾을 수 있게 된다.

## 나. 보안대책

- 비밀번호를 저장시 비밀번호와 솔트를 해시함수에 함께 입력하여 얻은 해시값을 저장한다.

## 다. 코드예제

### Java
```java
// ❌ 취약: 해시에 솔트를 적용하지 않아 안전하지 않다.
public String getPasswordHash(String password) throws Exception {
  MessageDigest md = MessageDigest.getInstance("SHA-256");
  md.update(password.getBytes());
  byte byteData[] = md.digest();
  StringBuffer hexString = new StringBuffer();
  for (int i=0; i<byteData.length i++) {
    String hex=Integer.toHexString(0xff & byteData[i]);
    if (hex.length() == 1) {
      hexString.append('0');
    }
    hexString.append(hex);
  }
  return hexString.toString();
}
```
```java
// ✅ 안전: 원문을 찾을 수 없도록 솔트를 사용
public String getPasswordHash(String password, byte[] salt) throws Exception {
  MessageDigest md = MessageDigest.getInstance("SHA-256");
  md.update(password.getBytes());
  md.update(salt);
  byte byteData[] = md.digest();
  StringBuffer hexString = new StringBuffer();
  for (int i=0; i<byteData.length i++) {
    String hex=Integer.toHexString(0xff & byteData[i]);
    if (hex.length() == 1) {
      hexString.append('0');
    }
    hexString.append(hex);
  }
  return hexString.toString();
}
```
> 비밀번호만을 해시함수의 입력으로 사용하기에 레인보우 테이블을 이용한 사전 공격이 가능하며, 이를 방지하기 위해 비밀번호와 솔트를 함께 해시함수에 적용하여 사용한다.

### C#
```csharp
// ❌ 취약: 해시에 솔트를 적용하지 않아 안전하지 않다.
static void HashWithoutSalt()
{
  var bytes = new byte[100];
  (new Random()).NextBytes(bytes);
  var source = bytes;
  var sha256 = new SHA256CryptoServiceProvider();
  sha256.ComputeHash(source);
}
```
```csharp
// ✅ 안전: 해시에 솔트를 적용하여 원문을 찾을 수 없게 한다.
static void HashWithSalt(int saltLength)
{
  var bytes = new byte[100];
  (new Random()).NextBytes(bytes);
  var source = bytes;
  var sha256 = new SHA256CryptoServiceProvider();
  byte[] saltBytes = GenerateRandomCryptographicBytes(saltLength);
  List<byte> sourceWithSaltBytes = new List<byte>();
  sourceWithSaltBytes.AddRange(source);
  sourceWithSaltBytes.AddRange(sourceWithSaltBytes);
  sha256.ComputeHash(sourceWithSaltBytes.ToArray());
}
```

### C
```c
// ❌ 취약: 솔트 값 부분이 NULL 로 되어있어 들어가지 않는다.
void GenerateHash(char* data)
{
  char[512] hashedData = {0};
  MD5HashAlgorithm( data, hashedData, NULL );
  ...
```
```c
// ✅ 안전: 솔트 값을 인자로 넘겨줘야 한다.
void GenerateHash(char* data, char* salt)
{
  char hashedData[512] = {0};
  MD5HashAlgorithm( data, hashedData, salt );
  ...
}
```

## 라. 진단방법

1. **①** getInstance 함수로 안전한 해시 알고리즘을 인자로 하여 MessageDigest 객체를 생성하는지 확인
2. **②** 해시 값을 반환하기 전에 update 함수에 솔트를 사용하여 데이터를 해시하는지 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// MessageDigest 객체를 생성하고 솔트 없이 해시 값을 반환 → 취약
MessageDigest digest = MessageDigest.getInstance("SHA-512"); // ①
digest.reset();
return digest.digest(password.getBytes("UTF-8")); // ②
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문에 별도 오탐 예제 없음.

## 마. 참고자료

- CWE-759 Use of a One-Way Hash without a Salt, MITRE — http://cwe.mitre.org/data/definitions/759.html
- Store passwords using a hash function, CERT (MSC62-J)
- Use a cryptographically strong credential-specific salt, OWASP — Password Storage Cheat Sheet

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 솔트 · 일방향 해시 · 레인보우 테이블 · 사전 공격 · MessageDigest · update · 비밀번호 저장
- **객관형 시드**: 솔트 없이 해시하는 코드와 솔트를 함께 적용하는 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: MessageDigest로 비밀번호를 해시하는 코드 제시 → update에 솔트 적용 여부로 정탐·오탐 판정
