# IMP-SF-10 · 부적절한 전자서명 확인

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-347
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §10 부적절한 전자서명 확인 (p.375–378)

## 가. 개요

전자서명이란 서명자의 신원을 확인하고 서명된 파일의 무결성을 보장할 수 있는 디지털 정보이다. 전자서명을 검증하지 않거나 검증절차가 부적절하면 위변조된 파일로 악성코드에 감염될 수 있으므로, 전자서명을 확인하여 위변조 여부를 판별하고 사용해야 한다.

## 나. 보안대책

- 전자서명을 포함하는 파일을 사용할 때는 **항상 전자서명을 확인**
- 전자서명 파일의 **출처를 확인**하여 신뢰할 수 없는 곳에서 생성된 파일을 사용하지 않음

## 다. 코드예제

### Java
신뢰할 수 없는 곳에서 다운로드한 JAR 파일의 서명을 확인하지 않으면 악성코드가 삽입되어 실행될 수 있다. `JarFile(f, true)`로 전자서명 여부를 확인하고, `getCodeSigners()`로 전자서명 주체를 검증해야 한다.

```java
// ❌ 취약: 서명 확인 없이 JAR 사용
File f = new File(downloadedFilePath);
JarFile jf = new JarFile(f);
```
```java
// ✅ 안전: boolean true 로 서명 확인 + getCodeSigners() 로 주체 검증
JarFile jf = new JarFile(f, true);
Enumeration<JarEntry> ens = jf.entries();
while (ens.hasMoreElements()) {
  JarEntry en = ens.nextElement();
  if (!en.isDirectory() && en.toString().equals(path)) {
    byte[] data = readAll(jar.getInputStream(en), en.getSize());
    CoeSigner[] signers = en.getCodeSigners();
    ...
  }
}
jf.close();
```

## 라. 진단방법

1. JarFile 생성 시 전자서명 여부를 확인하는 **Boolean형 파라미터 생성자**(`new JarFile(f, true)`) 사용 여부 확인
2. `JarEntry.getCodeSigners()` 메소드로 **전자서명 주체 검증** 여부 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 서명 확인 생성자는 썼으나 전자서명 주체(getCodeSigners) 미검증 → 취약
JarFile jf = new JarFile(f, true);
...
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 서명 확인 생성자 + getCodeSigners() 주체 검증까지 수행 → 안전
JarFile jf = new JarFile(f, true);
...
CodeSigner[] signers = en.getCodeSigners();
if (signers != null && signers.length != 0){ ... }
```

## 마. 참고자료

- CWE-347 Improper Verification of Cryptographic Signature, MITRE — http://cwe.mitre.org/data/definitions/347.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 전자서명 검증 · `JarFile(f, true)` · `getCodeSigners()` · 전자서명 주체 검증 · 위변조 판별 · 신뢰할 수 없는 출처
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
