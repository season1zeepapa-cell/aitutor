# IMP-EN-02 · 제거되지 않고 남은 디버그 코드

> **단계** 구현 · **분류** 캡슐화 · **CWE** CWE-489
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제6절 §2 제거되지 않고 남은 디버그 코드 (p.476–480)

## 가. 개요

디버깅 목적으로 삽입된 코드는 개발이 완료되면 제거해야 한다. 디버그 코드는 **설정 등 민감한 정보를 담거나 시스템을 제어**하게 허용하는 부분을 담고 있을 수 있다. 남겨진 채 배포되면 공격자가 **식별 과정을 우회**하거나 의도하지 않은 정보·제어 정보가 노출될 수 있다.

## 나. 보안대책

- 소프트웨어 **배포 전 반드시 디버그 코드를 확인·삭제**
- Java 개발자는 디버그 용도 코드를 `main()` 에 두고 삭제하지 않는 경우가 많음 → 디버깅이 끝나면 **`main()` 메서드를 삭제**

## 다. 코드예제

### Java
J2EE는 `main()` 메서드가 필요 없으며, 콘솔 출력용 디버깅 코드가 흔히 남는다. `main()` 을 삭제한다.

```java
// ❌ 취약: main()에 디버그 코드
class Base64 {
    public static void main(String[] args) {
        if (debug) {
            byte[] a = { (byte) 0xfc, (byte) 0x0f, (byte) 0xc0 };
            ……
        }
    }
    public void otherMethod() { … }
}
```
```java
// ✅ 안전: main() 삭제
class Base64 {
    public void otherMethod() { … }
}
```

### C#
```csharp
// ❌ 취약: Console.WriteLine 디버그 코드 잔존
class Example {
    public void Log() {
        Console.WriteLine("sensitive info");
    }
}
```
```csharp
// ✅ 안전: 디버그 코드 삭제(주석 처리)
class Example {
    public void Log() {
        //Console.WriteLine("sensitive info");
    }
}
```

### C
콜 스택 출력으로 공격자가 프로그램 구조를 유추할 수 있다.

```c
// ❌ 취약: 디버그 모드에서 콜스택 출력
void LeftoverDebugCode() {
    int i, ntprs;
    char **strings;
    nptrs = backtrace(buffer, 100);
    strings = backtrace_symbols(buffer, nptrs);
    if(debug) {
        for(i=0; i < nptr; i++) printf("%s\n", strings[j]);
    }
}
```
```c
// ✅ 안전: 릴리즈 시 디버그 코드 삭제
void LeftoverDebugCode() {
    … // 디버그 코드를 삭제하고 동작 코드만 남긴다.
}
```

## 라. 진단방법

- J2EE를 제외하면 디버그 코드를 **정적도구만으로 판단하기 어렵다**
1. **①** 테스트 목적으로 남은 디버그 코드 존재 여부 확인
2. J2EE Standard는 `main` 작성을 금하므로, `main` 메소드가 있으면 **디버그 코드인지 확인**

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// HttpServlet 하위클래스에 테스트용 main() + 디버그 로그 → 취약
public class U489 extends HttpServlet {
    protected void doGet(HttpServletRequest request, …) throws …{ …}
    protected void doPost(HttpServletRequest request, …) throws …{ …}
    // 테스트를 위한 main()함수나 디버깅용 로그 출력문 등이 남아 있다.
    public static void main(String args[]) {
        System.err.printf("Print debug code");
    }
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

*(원문에 해당 사례 없음)*

## 마. 참고자료

- CWE-489 Leftover Debug Code, MITRE — http://cwe.mitre.org/data/definitions/489.html
- Production code must not contain debugging entry points, CERT (ENV06-J)

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 디버그 코드 · main() 메소드 · J2EE · 콜스택 출력 · System.err.printf · Console.WriteLine · backtrace · 배포 전 삭제
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
