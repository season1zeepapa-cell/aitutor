# IMP-SF-07 · 충분하지 않은 키 길이 사용

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-326
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §7 충분하지 않은 키 길이 사용 (p.360–363)

## 가. 개요

길이가 짧은 키를 사용하면 암호화 알고리즘이 취약해진다. **검증된 암호화 알고리즘을 사용하더라도** 키 길이가 충분하지 않으면 짧은 시간 안에 키를 찾아낼 수 있고, 공격자가 암호화된 데이터·비밀번호를 복호화할 수 있다.

## 나. 보안대책

- **RSA**: 적어도 **2,048비트 이상**
- **대칭암호화 알고리즘**: 적어도 **128비트 이상**

## 다. 코드예제

### Java (RSA 키 길이)
```java
// ❌ 취약: RSA 키 길이 1024비트
keyGen.initialize(1024);
```
```java
// ✅ 안전: RSA 키 길이 2048비트 이상
keyGen.initialize(2048);
```

### C# (RSA 키 길이)
```csharp
// ❌ 취약: 1024비트
var rsa = new RSACryptoServiceProvider(1024);
```
```csharp
// ✅ 안전: 2048비트 이상
var rsa = new RSACryptoServiceProvider(2048);
```

### C (RSA 키 길이)
```c
// ❌ 취약: 512비트
rsa = RSA_generate_key(512, 35, NULL, NULL);
```
```c
// ✅ 안전: 2048비트 이상
rsa = RSA_generate_key(2048, 35, NULL, NULL);
```

## 라. 진단방법

알고리즘별 최소 키 길이 사용 여부를 확인한다.

| 알고리즘 | 예시 | 최소 키 길이 |
|---|---|---|
| 대칭키 | AES, ARIA, SEED | 128bit 이상 |
| 해시 함수 | SHA | 128bit 이상 |
| 공개키 | RSA, DSA | 2,048bit 이상 |
| 공개키 (ECC) | ECC | 256 이상 |

> 보안성이 강한 RSA를 사용하더라도 키 사이즈를 작게 설정하면 취약점이 된다.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// RSA Key generator 키 크기 512비트 → 취약
KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
keyGen.initialize(512);
KeyPair myKeys = keyGen.generateKeyPair();
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_원문에 해당 항목 없음._

## 마. 참고자료

- CWE-326 Inadequate Encryption Strength, MITRE — http://cwe.mitre.org/data/definitions/326.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 키 길이 · RSA 2048비트 · 대칭키 128비트 · 해시 128비트 · ECC 256비트 · `KeyPairGenerator.initialize` · `RSACryptoServiceProvider` · `RSA_generate_key`
- **객관형 시드**: 취약/안전 코드쌍 또는 알고리즘별 최소 키 길이 기준 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
