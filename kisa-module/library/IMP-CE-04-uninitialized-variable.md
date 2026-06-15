# IMP-CE-04 · 초기화되지 않은 변수 사용

> **단계** 구현 · **분류** 코드오류 · **CWE** CWE-457
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제5절 §4 초기화되지 않은 변수 사용 (p.459–461)

## 가. 개요

C 언어의 경우 스택 메모리에 저장되는 **지역변수는 생성될 때 자동으로 초기화되지 않는다.** 초기화되지 않은 변수를 사용하면 임의 값을 사용하게 되어 의도하지 않은 결과를 출력하거나 예상치 못한 동작을 수행할 수 있다.

## 나. 보안대책

- 초기화되지 않은 스택 메모리 영역의 변수는 임의값처럼 보이지만 **이전 함수에서 사용되었던 내용을 포함**한다. 공격자는 이를 이용해 메모리 값을 읽거나 특정 코드를 실행할 수 있다.
- **모든 변수를 사용 전에 반드시 올바른 초기값을 할당**한다.

## 다. 코드예제

### C
커서의 위치를 정하는 프로그램. `switch` 의 `default` 에서 `x` 만 초기화하고 `y` 는 초기화되지 않아, 공격자가 사전에 `y` 에 값을 심으면 서비스 거부 공격이 가능하다.

```c
// ❌ 취약: 초기값 미지정
int x, y;
switch(position) {
    case 0: x = base_position y = base_position beak;
    case 1: x = base_position + i y = base_position - i break;
    default: x=1; break;
}
setCursorPosition(x,y);
```
```c
// ✅ 안전: 선언과 동시에 초기화
int x=1, y=1;
switch(position) {
    case 0: x = base_position y = base_position beak;
    case 1: x = base_position + i y = base_position - i break;
    default: x=1; break;
}
setCursorPosition(x,y);
```

## 라. 진단방법

1. 변수의 **선언과 동시에 초기화**가 이루어지는지 확인
2. C++ 처럼 객체의 필드가 초기값을 가지지 않으면 **생성자에서 필드 초기화**가 이루어지는지 확인
3. 위 작업이 없으면 기본적으로 취약 판정

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```cpp
// 디폴트 생성자가 a_ 를 초기화하지 않음 → 임의값 접근 → 취약
class Foo {
public:
    Foo() {} // default constructor, doesn't initialize a_
    Foo(int a) : a_(a) {} // constructor
    int get_a() const {return a_;}
private:
    int a_;
};

int main(void) {
    Foo foo1; // calls default constructor
    std::cout << foo1.get_a() << std::endl;
    return 0;
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

*(원문에 해당 사례 없음)*

## 마. 참고자료

- CWE-457, Use of Uninitialized Variable, MITRE — http://cwe.mitre.org/data/definitions/457.html
- Do not read uninitialized memory, CERT (EXP33-C)
- Uninitialized Variable, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 변수 초기화 · 스택 메모리 · 지역변수 · 디폴트 생성자 · 필드 초기화 · 임의값
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
