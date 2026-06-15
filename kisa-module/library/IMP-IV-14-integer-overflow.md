# IMP-IV-14 · 정수형 오버플로우 (Integer Overflow)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-190
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §14 정수형 오버플로우 (p.290–296)

## 가. 개요

정수형 오버플로우는 정수값이 증가하면서 허용된 가장 큰 값보다 커져서 실제 저장되는 값이 의도치 않게 아주 작은 수이거나 음수가 되어 발생한다. 특히 **반복문 제어·메모리 할당·메모리 복사** 등을 위한 조건으로 사용자가 제공하는 입력값을 사용하고 그 과정에서 정수형 오버플로우가 발생하는 경우 보안상 문제를 유발할 수 있다.

## 나. 보안대책

- 언어·플랫폼별 **정수타입의 범위**를 확인하여 사용
- 정수형 변수를 연산에 사용하는 경우 **결과값의 범위를 체크하는 모듈** 사용
- 외부입력 값을 동적 메모리 할당에 사용하는 경우 변수값이 **적절한 범위 내에 존재**하는지 확인

## 다. 코드예제

### Java
외부 입력으로 계산된 값(`param_ct`)이 오버플로우로 음수가 되면 배열 크기가 음수가 되어 시스템에 문제 발생.

```java
// ❌ 취약: 외부 입력값을 검증 없이 배열 크기로 사용
int param_ct = Integer.parseInt(tmp);
String[] strArr = new String[param_ct];
```
```java
// ✅ 안전: 음수 여부 검증 후 사용
int param_ct = Integer.parseInt(tmp);
if (param_ct < 0) {
    throw new Exception();
}
String[] strArr = new String[param_ct];
```

### C#
```csharp
// ❌ 취약: 입력 크기가 너무 클 경우 오버플로우
int usrNum = Int32.Parse(args[0]);
string num = array[usrNum];
```
```csharp
// ✅ 안전: checked 구문 + 범위 확인
int usrNum = checked(Int32.Parse(args[0]));
if(usrNum < 3) string num = array[usrNum];
```

### C
```c
// ❌ 취약: 입력값 범위 검사 없이 배열 인덱싱
usr_num = atoi(argv[1]);
num = num_array[usr_num];
```
```c
// ✅ 안전: 0 이상 & 범위 미만 경계 검사
usr_num = atoi(argv[1]);
if (usr_num >= 0 && usr_num < 4) {
    num = num_array[usr_num];
}
```

## 라. 진단방법

1. **①** 변수로 배열 크기를 동적으로 결정하는 부분 확인
2. **②** 해당 변수가 외부 입력값인지 확인
3. **③** 변수가 의도한 범위 내에 존재하는지 검증 절차가 있는지 확인 — 검증이 없으면 취약

> 정수형 변수가 한계값보다 커지면 아주 작은 값이나 음수가 될 수 있다. 이에 대한 검사 없이 진행하면 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 외부 입력 cnt 를 검증 없이 배열 크기로 사용 → 취약
int cntI = Integer.parseInt(cnt);
String[] arr = new String[cntI];
```
```java
// 입력 라인수 parLine 으로 음수 검사 없이 배열 생성 → 취약
String[] strArr = new String[parLine];
```
```java
// slf_msg_param_num 을 검증 없이 배열 크기로 사용 → 취약
int param_ct = Integer.parseInt(tmp);
String[] strArr = new String[param_ct];
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// pubKey.available() 은 int 반환 → 한계 초과 불가 → 안전
byte[] bytes = new byte[pubKey.available()];
```
```java
// HTTP 헤더(Referer)는 한계값 존재 → 정수 한계 초과 불가 → 안전
String[] referer_split = Util.split(request.getHeader("Referer").toString(),"/");
```
```java
// 인자 개수가 정수 한계 초과는 비현실적, 외부 값 아님 → 안전
String[] allArgs = new String[jsargs.length + args.length];
```

## 마. 참고자료

- CWE-190 Integer Overflow, MITRE — http://cwe.mitre.org/data/definitions/190.html
- INT04-C / INT08-C, CERT · Integer Overflow/Underflow, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 정수형 오버플로우 · 음수 배열 크기 · 범위 검증 · checked 구문 · 경계값 검사 · 동적 메모리 할당 · 정수 한계값
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
