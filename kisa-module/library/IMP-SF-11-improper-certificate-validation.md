# IMP-SF-11 · 부적절한 인증서 유효성 검증

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-295
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §11 부적절한 인증서 유효성 검증 (p.379–381)

## 가. 개요

인증서를 확인하지 않거나 인증서 확인 절차를 적절하게 수행하지 않아, 악의적인 호스트에 연결되거나 신뢰할 수 없는 호스트에서 생성된 데이터를 수신하게 되는 보안약점이다.

## 나. 보안대책

인증서를 사용하기 전에 유효성을 확인한다.
- **Common Name**과 실제 호스트가 일치하는지
- 신뢰된 발급기관(**CA, RootCA**)의 서명 여부
- 인증서의 **유효기간**, **해지여부**
- 안전한 암호화 알고리즘 사용 여부

## 다. 코드예제

### C
```c
// ❌ 취약: X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN(자체 서명) 인증서 허용
foo=SSL_get_verify_result(ssl);
if ((X509_V_OK==foo) ||X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN==foo))
```
```c
// ❌ 취약: 검증결과 X509_V_OK여도 Common Name 미확인 → 중간자 공격 탐지 불가
cert = SSL_get_peer_certificate(ssl);
if (cert && (SSL_get_verify_result(ssl)==X509_V_OK)) {
  /* CN을 확인하지 않았지만 신뢰하고 진행 */
}
```

### Java
인증서 DN 일치여부와 유효기간 등을 검증한다. 유효기간이 남은 인증서의 해지여부는 **CRL** 또는 **OCSP**로 확인한다.

```java
// ✅ 안전: DN 일치 + CA 서명 검증 + 유효기간 확인
private boolean verifySignature(X509Certificate toVerify, X509Certificate signingCert) {
  if (!toVerify.getIssuerDN().equals(signingCert.getSubjectDN())) return false;
  try {
    toVerify.verify(signingCert.getPublicKey()); // CA 서명 확인
    toVerify.checkValidity();                     // 유효기간 확인
    return true;
  } catch (GeneralSecurityException verifyFailed) {
    return false;
  }
}
```

## 라. 진단방법

1. **①** 인증서를 확인하는지
2. **②** 검증결과 값이 `X509_V_OK` 이외의 값을 허용하는지 (신뢰되지 않은 발급기관·만료 인증서 허용 시 위험)
3. **③** 인증서의 **Common Name**을 확인하는지

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```c
// 유효성 확인 없이 인증서 사용 → 취약
cert = SSL_get_peer_certificate(ssl);
if (cert) {
  // 인증서를 확인하지 않고 작업 수행
  ...
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```c
// X509_V_OK 확인 + SSL_set1_host(CN) + SSL_set_verify(피어 확인) → 안전
if (cert && (SSL_get_verify_result(ssl)==X509_V_OK)) {
  if (!SSL_set1_host(ssl, "www.securecoding_example.com")) { error("Invalid Common Name"); return -1; }
  SSL_set_verify(ssl, SSL_VERIFY_PEER, NULL);
  ...
}
```

## 마. 참고자료

- CWE-295 Improper Certificate Validation, MITRE — http://cwe.mitre.org/data/definitions/295.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 인증서 유효성 검증 · Common Name 확인 · `X509_V_OK` · 자체 서명 인증서 · 유효기간/해지여부 · CRL/OCSP · 중간자 공격(MITM)
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
