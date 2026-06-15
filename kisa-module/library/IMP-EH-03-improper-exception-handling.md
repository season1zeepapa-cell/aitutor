# IMP-EH-03 · 부적절한 예외 처리

> **단계** 구현 · **분류** 에러처리 · **CWE** CWE-754
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §3 부적절한 예외 처리 (p.429–432)

## 가. 개요

프로그램 수행 중에 함수의 결과값에 대한 적절한 처리 또는 예외상황에 대한 조건을 적절하게 검사하지 않으면 예기치 않은 문제를 야기할 수 있다.

## 나. 보안대책

- 값을 반환하는 **모든 함수의 결과값을 검사**하여 의도했던 값인지 확인
- 예외 처리 시 **광범위한 예외 처리 대신 구체적인 예외 처리**를 수행

## 다. 코드예제

### Java
```java
// ❌ 취약: 광범위한 Exception 으로만 처리
try {
    ...
    Date date = format.parse(line);
} catch (Exception e) {
    System.err.println("Exception : " + e.getMessage());
}
```
```java
// ✅ 안전: 발생 가능한 예외를 세분화하고 순서에 맞춰 처리
try {
    ...
    Date date = format.parse(line);
} catch (MalformedURLException e) {
    System.err.println("MalformedURLException : " + e.getMessage());
} catch (IOException e) {
    System.err.println("IOException : " + e.getMessage());
} catch (ParseException e) {
    System.err.println("ParseException : " + e.getMessage());
}
```

### C#
```csharp
// ❌ 취약: 광범위한 Exception 으로만 처리
try {
    InvokeMtd();
} catch (Exception e) {
}
```
```csharp
// ✅ 안전: 발생 가능한 오류 종류·순서에 맞춰 처리
try {
    InvokeMtd();
} catch (IOException e) {
    logger.Debug("IOException log here");
} catch (SQLException e){
    logger.Debug("SQLException log here");
}
```

## 라. 진단방법

1. **①** 함수·메소드에서 반환값을 검사하고 예외를 발생시키는 경우, **구체적인 예외처리**를 수행하는지 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 광범위한 Exception 으로만 예외를 잡음 → 취약
public void readFromFile(String fileName) {
  try {
    File myFile = new File(fileName);
    FileReader fr = new FileReader(myFile);
  } catch(Exception ex){…} //①
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_원문에 별도 오탐 예제 없음._

## 마. 참고자료

- CWE-754 Improper Check for Unusual or Exceptional Conditions, MITRE — http://cwe.mitre.org/data/definitions/754.html
- Do not complete abruptly from a finally block (ERR04-J), CERT
- Exception Handling in Spring MVC, Spring

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 구체적인 예외 처리 · 광범위한 예외 처리 · Exception · 반환값 검사 · 예외 세분화 · 발생 순서
- **객관형 시드**: vulnerable/safe 코드쌍 제시 → "광범위한 Exception 처리의 문제점" / "안전한 예외 처리 방식"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
