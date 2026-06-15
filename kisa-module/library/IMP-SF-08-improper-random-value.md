# IMP-SF-08 · 적절하지 않은 난수 값 사용

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-330
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §8 적절하지 않은 난수 값 사용 (p.364–369)

## 가. 개요

예측 가능한 난수를 사용하면 보안약점이 발생한다. 예측 불가능한 숫자가 필요한 상황에서 **예측 가능한 난수**를 사용하면, 공격자는 다음 생성될 숫자를 예상하여 시스템을 공격할 수 있다.

## 나. 보안대책

- 시드(Seed)값이 고정되면 매번 동일한 난수값이 발생 → Java는 `Random()`·`Math.random()`이 현재시간 기반으로 매번 변경되는 시드를 사용, C는 `srand()`로 현재시간 기반 시드를 설정
- **세션 ID, 암호화키 등 보안결정용 값**에는 Java의 `Random()`·`Math.random()`을 쓰지 말고, 암호학적으로 보호된 **`java.security.SecureRandom`** 사용

## 다. 코드예제

### Java
```java
// ❌ 취약: 고정 시드 → 동일 난수 / Random 은 보안결정에 부적합
Random random = new Random(100);
Random random = new Random();   // 보안결정용으로는 안전하지 않음
```
```java
// ✅ 안전: 일반 난수는 Random, 보안결정에는 SecureRandom
SecureRandom secureRandom = SecureRandom.getInstance("SHA1PRNG");
secureRandom.setSeed(secureRandom.generateSeed(128));
```

### C#
```csharp
// ❌ 취약: Random 은 보안결정용으로 부적합
Random rng = new Random();
return rng.Next(10);
```
```csharp
// ✅ 안전: RNGCryptoServiceProvider 사용
new System.Security.Cryptography.RNGCryptoServiceProvider().GetBytes(b);
```

### C
```c
// ❌ 취약: seeding 없는 rand() → 실행 시 동일 결과, 범위 작음
printf("%d", rand());
```
```c
// ✅ 안전: srandom() 시드 + random()
srandom(time(NULL));
printf("%ld", random());
```

## 라. 진단방법

1. **①** `Math.random()` 메소드 사용 여부 확인 → 사용 시 취약
2. **②** 난수값을 세션ID로 설정하여 보안결정에 사용하는지 확인 → 보안결정인 경우 `java.security.SecureRandom`을 사용하면 안전

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// Math.random() 으로 난수 발생 → 취약
int ran = (int) (Math.random() * scope) - 1;
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// Date 요소들로 자체 보완 → 안전
long rand = ((r.nextLong()>>>1)%(endDate.getTimeInMillis()-beginDate.getTimeInMillis() + 1)) + beginDate.getTimeInMillis();
```
```java
// SecureRandom 사용 → 복잡도 높음 → 안전
SecureRandom r = new SecureRandom();
long rand = ((r.nextLong()>>>1)%(endDate.getTimeInMillis()-beginDate.getTimeInMillis() + 1)) + beginDate.getTimeInMillis();
```

## 마. 참고자료

- CWE-330 Use of Insufficiently Random Values, MITRE — http://cwe.mitre.org/data/definitions/330.html
- CERT (MSC02-J / MSC30-C) / OWASP (Insecure Randomness)

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 예측 가능한 난수 · 시드(Seed) · 고정 시드 · `Math.random()` · `java.util.Random` · `java.security.SecureRandom` · `RNGCryptoServiceProvider` · `srand()`/`srandom()` · 세션 ID/암호화키 · 보안결정
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
