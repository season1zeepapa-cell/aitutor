# IMP-TS-02 · 종료되지 않는 반복문 또는 재귀 함수

> **단계** 구현 · **분류** 시간 및 상태 · **CWE** CWE-835
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제3절 §2 종료되지 않는 반복문 또는 재귀 함수 (p.415–418)

## 가. 개요

재귀의 순환횟수를 제어하지 못하여 메모리·프로그램 스택 등의 자원을 과다하게 사용하면 위험하다. **귀납 조건(Base Case)** 이 없는 재귀함수는 무한 루프에 빠져 자원고갈을 유발하고 시스템이 정상 서비스를 제공할 수 없게 만든다.

## 나. 보안대책

- 모든 재귀 호출 시 **재귀 호출 횟수를 제한** 하거나 **초기값(상수)을 설정** 하여 재귀 호출을 제한

## 다. 코드예제

### C
factorial 함수에 탈출 조건이 없으면 무한 재귀에 빠진다.

```c
// ❌ 취약: 탈출 조건(Base Case) 없음 → 무한 재귀
int factorial(int i) {
  return i * factorial(i - 1);
}
```
```c
// ✅ 안전: 귀납조건으로 탈출
int factorial(int i) {
  if (i <= 1) {
    return 1;
  }
  return i * factorial(i - 1);
}
```

## 라. 진단방법

1. **①** 자신을 호출하는 재귀함수/메소드가 존재하는지 식별
2. 함수 내에 제어문으로 리턴(탈출)될 수 있는지 확인 — 빠져나올 수 있으면 안전

> 함수명·파라미터 개수·파라미터 자료형이 일치하는 자기 호출이면 취약. 시그니처가 다르면 재귀가 아닌 다른 함수 호출.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// func(String a) 가 동일 시그니처 func(a) 재귀 호출, 탈출 조건 없음 → 취약
public void func(String a) {
  func(a);
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// func(String a) → func(int a): 자료형이 달라 recursive call 아님 → 안전
public void func(int a) { this.a = a; }
public void func(String a) { func(Integer.parseInt(a)); }
```
```java
// 자식 메뉴 없으면 리턴하는 제어조건 존재 → 제어되는 재귀 → 안전
public MenuVO getFirstLeafChildMenu(int menuSeq) {
  List<MenuVO> childMenuList = menuMap.get(menuSeq).getChildMenuList();
  if (CollectionUtils.isEmpty(childMenuList)) {
    return menuMap.get(menuSeq);
  }
  return getFirstLeafChildMenu(childMenuList.get(0).getMenuSeq());
}
```

## 마. 참고자료

- CWE-674 Uncontrolled Recursion, MITRE — http://cwe.mitre.org/data/definitions/674.html
- CWE-835 Loop with Unreachable Exit Condition ('Infinite Loop'), MITRE — http://cwe.mitre.org/data/definitions/835.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 재귀함수 · 귀납조건(Base Case) · 탈출 조건 · 무한 재귀 · 자원고갈 · 재귀 호출 횟수 제한 · 함수 시그니처 일치 · 제어문 리턴
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "무한 재귀 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
