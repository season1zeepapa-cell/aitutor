# IMP-IV-16 · 메모리 버퍼 오버플로우 (Memory Buffer Overflow)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-120
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §16 메모리 버퍼 오버플로우 (p.303–308)

## 가. 개요

메모리 버퍼 오버플로우는 연속된 메모리 공간을 사용하는 프로그램에서 **할당된 메모리 범위를 넘어선 위치**에 자료를 읽거나 쓰려고 할 때 발생한다. 프로그램의 오동작을 유발하거나 악의적인 코드를 실행시켜 공격자가 프로그램 통제 권한을 획득하게 한다. **스택**·**힙** 메모리 버퍼 오버플로우가 있으며, `gets()` 같은 함수는 크기와 상관없이 문자열을 저장하므로 공격자가 공격코드와 스택 시작주소를 입력해 정상 복귀주소 대신 공격코드로 복귀시킬 수 있다.

## 나. 보안대책

- 적절한 **버퍼 크기**를 설정하고 설정된 범위 내에서만 읽기/쓰기하도록 통제
- 문자열 저장 시 **널(Null) 문자**를 버퍼 범위 내에 삽입하여 널 문자로 종료되도록 처리

## 다. 코드예제

### C
잘못 계산된 `sizeof(cv_struct)`로 연속 메모리(포인터 y)를 덮어쓰는 오버플로우 발생.

```c
// ❌ 취약: sizeof(cv_struct) 로 복사 → 포인터 y 덮어쓰기, 널 종료 없음
memcpy(cv_struct.x, SRC_STR, sizeof(cv_struct));
```
```c
// ✅ 안전: 복사 범위를 sizeof(cv_struct.x) 로 한정 + 널 문자 패딩
memcpy(cv_struct.x, SRC_STR, sizeof(cv_struct.x));
cv_struct.x[(sizeof(cv_struct.x)/sizeof(char))-1] = '\0';
```

## 라. 진단방법

1. 버퍼에 값을 기록 시 값의 크기가 **대상 버퍼보다 작은지** 확인
2. 버퍼/데이터 크기가 외부 입력에 의해 결정되면 입력 크기가 대상을 충분히 포함하는지 확인
3. 인덱싱 접근 시 크기 비교 외에 **음수가 아닌지(0보다 큰지)** 확인
4. 반복문으로 버퍼 접근 시 **경계값 확인**, 문자열 처리 시 마지막 **널 문자 포함** 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```c
// 16 byte 버퍼에 입력 크기 검사 없이 strcpy → 취약
void foo(char* string){
    char buf[16];
    strcpy(buf, string);
}
```
```c
// 외부 입력을 64 byte hostname 에 strcpy, 길이 보장 없음 → 취약
char hostname[64];
strcpy(hostname, hp->h_name);
```
```c
// 공백 제거 루프에서 len 이 0보다 작아지는지 검사 안 함 → 음수 인덱스 참조 → 취약
int len = index-1;
while (isspace(message[len])) {
    message[len] = '\0';
    len--;
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문에 오탐 예제 없음.

## 마. 참고자료

- CWE-120 Buffer Copy without Checking Size of Input, MITRE — http://cwe.mitre.org/data/definitions/120.html
- CWE-119 Improper Restriction of Operations within the Bounds of a Memory Buffer, MITRE
- Buffer overflow attack, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 메모리 버퍼 오버플로우 · 스택/힙 오버플로우 · 버퍼 크기 검증 · 널(Null) 문자 종료 · 경계값 확인 · strcpy/gets · sizeof 오용
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
