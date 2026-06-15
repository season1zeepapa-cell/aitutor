# IMP-EN-04 · Private 배열에 Public 데이터 할당

> **단계** 구현 · **분류** 캡슐화 · **CWE** CWE-496
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제6절 §4 (p.487–490)

## 가. 개요

public 메소드의 인자가 private 배열에 저장되면, **외부에서 private 배열에 접근**하여 배열 수정과 객체 속성 변경이 가능해진다(사실상 public 필드가 된다).

## 나. 보안대책

- public 메서드의 인자를 private 배열에 **직접 할당하지 않는다**
- 인자 배열의 **복사본을 생성**해 할당한다. 원소가 일반 객체이면 `clone()` 으로 원소까지 복사
- 원소가 String 등 불변 타입이면 인자 배열의 복사본만 생성해 할당

## 다. 코드예제

### Java (배열 원소가 일반객체)
```java
// ❌ 취약: public 인자를 private 필드에 직접 할당
private UserRole[] userRoles;
public void setUserRoles(UserRole[] userRoles) {
  this.userRoles = userRoles;
}
```
```java
// ✅ 안전: 배열 복사 + 원소 clone()
public void setUserRoles(UserRole[] userRoles) {
  this.userRoles = new UserRole[userRoles.length];
  for (int i = 0; i < userRoles.length; ++i)
    this.userRoles[i] = userRoles[i].clone();
}
```

### Java (배열 원소가 String 등 불변 타입)
```java
// ❌ 취약: 직접 할당
private String[] userRoles;
public void setUserRoles(String[] userRoles) {
  this.userRoles = userRoles;
}
```
```java
// ✅ 안전: 불변 원소는 배열 복사본만 할당해도 됨
public void setUserRoles(String[] userRoles) {
  this.userRoles = new String[userRoles.length];
  for (int i = 0; i < userRoles.length; ++i)
    this.userRoles[i] = userRoles[i];
}
```

### C#
```csharp
// ❌ 취약: 직접 할당
private String[] userRoles;
public void SetUserRoles(String[] userRoles) {
  this.userRoles = userRoles;
}
```
```csharp
// ✅ 안전: 배열 복사본 생성 후 할당
public void SetUserRoles(String[] userRoles) {
  int length = userRoles.Length;
  this.userRoles = new String[length];
  for(int i = 0; i < length; i++) {
    this.userRoles[i] = userRoles[i];
  }
}
```

## 라. 진단방법

1. **①** private 배열이 선언되어 있는지 확인
2. **②** public 메소드의 인자로 받은 배열을 private 배열 필드에 직접 할당하면 취약 판정
3. 원소가 일반 객체이면 원소별로 객체를 생성하고 내부 값을 복사하는지 추가 확인

> private이라도 public 세터로 외부 배열이 할당되면 사실상 public 필드가 된다.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// public 인자를 private 필드에 직접 할당 → 사실상 public 필드 → 취약
public class U496 {
  private String[] userRoles;
  public void setUserRoles(String[] userRoles) {
    this.userRoles = userRoles;
  }
}
```
```java
// 배열 새로 생성·복사했으나 원소가 일반 객체(UserRole) → 주소값만 복사 → 취약
private UserRole[] userRoles;
public void setUserRoles(UserRole[] userRoles) {
  this.userRoles = new UserRole[userRoles.length];
  for(int i =0; i < userRoles.length; i++) {
    this.userRoles[i] = userRoles[i]; // 일반 객체일 경우 주소값만 복사된다.
  }
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_원문에 오탐 코드 예시 없음._

## 마. 참고자료

- CWE-496 Public Data Assigned to Private Array-Typed Field, MITRE — http://cwe.mitre.org/data/definitions/496.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: private 배열 · public 인자 할당 · 사실상 public 필드 · 복사본 생성 · clone() · 주소값만 복사 · 일반객체 vs 불변타입
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
