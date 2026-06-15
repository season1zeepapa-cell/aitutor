# IMP-SF-04 · 취약한 암호화 알고리즘 사용

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-327
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §4 취약한 암호화 알고리즘 사용 (p.330–336)

## 가. 개요

base64와 같이 지나치게 간단한 인코딩 함수로는 비밀번호를 제대로 보호할 수 없다. 표준화되지 않은 암호화 알고리즘은 공격자가 분석·무력화시킬 가능성을 높이며, 컴퓨터 성능 향상에 따라 취약해진 **RC2, RC4, RC5, RC6, MD4, MD5, SHA1, DES** 알고리즘이 여기에 해당된다.

## 나. 보안대책

- 자체 암호화 알고리즘 개발 금지, **검증된 표준 알고리즘** 사용
- 취약한 DES, RC5 등을 **3DES, AES, SEED** 등 안전한 알고리즘으로 대체
- 업무·개인정보 암호화 시 IT보안인증 사무국의 **검증필 암호모듈** 사용

> **안전한 암호알고리즘(키 길이)**: 블록암호 ARIA(128/192/256)·SEED(128), 해시 SHA-224/256/384/512, MAC HMAC·CMAC·GMAC, 공개키 RSAES(2048/3072)·전자서명 RSA-PSS·KCDSA·ECDSA, 키설정 DH·ECDH (출처: 암호알고리즘 검증기준 Ver 2.0).

## 다. 코드예제

### Java
```java
// ❌ 취약: 키 길이가 짧은 DES 사용
Cipher c = Cipher.getInstance("DES");

// ✅ 안전: AES 사용
Cipher c = Cipher.getInstance("AES/CBC/PKCS5Padding");
```

### C#
```csharp
// ❌ 취약: DES
var des = new DESCryptoServiceProvider();

// ✅ 안전: AES
var des = new AesCryptoServiceProvider();
```

### C
```c
// ❌ 취약: DES
EVP_EncryptInit(&ctx, EVP_des_ecb(), NULL, NULL);

// ✅ 안전: AES
EVP_EncryptInit(&ctx, EVP_aes_128_cbc(), key, iv);
```

## 라. 진단방법

1. 각 언어에서 제공하는 **암호화 함수 호출**을 식별
2. **자체 구현 암호알고리즘** 사용 시 취약으로 판단(암호전문가가 있으면 적절성 보증 가능)
3. 취약 알고리즘: RC2, RC4, RC5, RC6, MD4, MD5, SHA1, DES 등 / 안전 알고리즘: SHA-256, AES, SEED, ARIA 등

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 암호화 목적으로 Base64 인코딩(암호화 아님)을 사용 → 취약
byte password[] = Base64.decode(prop.getProperty("password"));
con = DriverManager.getConnection(url, usr, password.toString());
```
```java
// MD5 등 낮은 보안 수준 알고리즘 사용 → 취약
md = MessageDigest.getInstance("MD5");
byte[] md5Bytes = md.digest(name);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문에 오탐 코드 예제 없음.

## 마. 참고자료

- CWE-327 Use of a Broken or Risky Cryptographic Algorithm, MITRE — http://cwe.mitre.org/data/definitions/327.html
- Do not use insecure or weak cryptographic algorithms (MSC61-J), CERT
- Cryptanalysis, OWASP — https://www.owasp.org/index.php/Cryptanalysis

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 취약 알고리즘(RC2/RC4/RC5/RC6/MD4/MD5/SHA1/DES) · 안전 알고리즘(AES/SEED/ARIA/SHA-256/3DES) · 검증필 암호모듈 · Base64는 인코딩(암호화 아님) · 자체 암호알고리즘 금지 · Cipher.getInstance
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
