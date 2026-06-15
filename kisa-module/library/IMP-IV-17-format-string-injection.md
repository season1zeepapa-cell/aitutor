# IMP-IV-17 · 포맷 스트링 삽입 (Format String Injection)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-134
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §17 포맷 스트링 삽입 (p.309–313)

## 가. 개요

외부로부터 입력된 값을 검증하지 않고 입·출력 함수의 **포맷 문자열로 그대로 사용**할 때 발생하는 보안약점이다. 공격자는 포맷 문자열을 이용하여 취약한 프로세스를 공격하거나 메모리 내용을 읽거나 쓸 수 있고, 그 결과 취약한 프로세스의 권한을 취득하여 임의의 코드를 실행할 수 있다.

## 나. 보안대책

- `printf()`, `snprintf()` 등 포맷 함수에 **사용자 입력값을 직접 포맷 문자열로 쓰거나 생성에 포함**시키지 않음
- 사용자가 포맷 스트링을 변경할 수 있는 구조로 쓰지 않음
- 특히 `%n`, `%hn`은 특정 메모리 위치에 값을 변경할 수 있으므로 **매개변수로 사용 금지**
- 가능하면 `%s` 포맷을 지정하고 사용자 입력값은 **2번째 이후 파라미터**로 사용

## 다. 코드예제

### Java
공격자가 `%1$tY-%1$tm-%1$te`를 입력하면 시스템 날짜 정보가 노출된다.

```java
// ❌ 취약: 외부 입력 args[0] 을 포맷 문자열에 직접 결합
System.out.printf( args[0] + " did not match! HINT: It was issued on %1$terd of some month", validate);
```
```java
// ✅ 안전: %s 포맷 지정 + 입력값을 두 번째 파라미터로 전달
System.out.printf("%s did not match! HINT: It was issued on %2$terd of some month", args[0], validate);
```

### C
```c
// ❌ 취약: 사용자 입력 포함 msg 를 fprintf 포맷 인자로 전달
fprintf(stderr, msg);
```
```c
// ✅ 안전: fputs 로 msg 를 포맷 문자열로 취급하지 않고 그대로 출력
if (fputs(msg, stderr) == EOF) {
    /* 오류 처리 */
}
```

## 라. 진단방법

1. 포맷 함수 사용 시 **인자로 포맷 스트링이 포함**되어 있는지 확인
2. **외부 입력 값이 포맷 스트링 생성에 사용**되는지 확인
3. 포맷 스트링이 인자로 존재 + 외부 입력이 생성에 미사용 + 포맷 인자 개수와 매개변수 개수 일치 + 출력 데이터 길이 한정 → **안전**, 그 외 모두 취약

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 포맷 스트링은 있으나 사용자 입력 args[0] 를 포맷 생성에 결합 → 취약
System.out.printf(args[0] + " did not match! HINT: It was issued on %1$terd of some month", c);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문에 오탐 예제 없음.

## 마. 참고자료

- CWE-134 Uncontrolled Format String, MITRE — http://cwe.mitre.org/data/definitions/134.html
- FIO30-C / FIO47-C, CERT · Format string attack, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 포맷 스트링 · printf/snprintf · `%n` `%hn` · `%s` 포맷 지정 · 사용자 입력 직접 결합 금지 · fputs 대체 · 포맷 문자열 인자 개수
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
