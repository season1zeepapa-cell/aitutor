# IMP-CE-03 · 해제된 자원 사용

> **단계** 구현 · **분류** 코드오류 · **CWE** CWE-416
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §3 해제된 자원 사용 (p.453–458)

## 가. 개요

C언어의 동적 메모리 관리는 보안 취약점을 유발하는 대표적인 결함 원인이다. **해제한 메모리를 참조**하면 예상치 못한 값 또는 코드를 실행하게 되어 의도하지 않은 결과가 발생한다.

## 나. 보안대책

- 해제된 메모리를 가리키던 포인터를 **참조 추적·형 변환·수식의 피연산자 등으로 사용하지 않기**
- 메모리 해제 후 포인터에 **NULL 또는 적절한 값을 저장**하여 의도하지 않은 코드 실행 방지

## 다. 코드예제

### C — 해제 후 사용 (Use After Free)
```c
// ❌ 취약: free 후 다시 사용
temp = (char *)malloc(BUFFER_SIZE);
free(temp);
stmcpy(temp, argv[1], BUFFER_SIZE-1);   // 해제된 자원 사용
```
```c
// ✅ 안전: 사용을 끝낸 뒤 해제
temp = (char *)malloc(BUFFER_SIZE);
stmcpy(temp, argv[1], BUFFER_SIZE-1);
free(temp);
```

### C — 이중 해제 (Double Free)
```c
// ❌ 취약: val_1, val_2 모두 같으면 이중 해제
if (data_type==val_1) { free(data); }
if (data_type==val_2) { free(data); }
```
```c
// ✅ 안전: 해제 후 NULL 할당 → 재해제 무시
if (data_type==val_1) { free(data); data = NULL; }
if (data_type==val_2) { free(data); data = NULL; }
```

## 라. 진단방법

1. 자원을 사용하는 코드 **앞에서 해제가 발생**하면 취약
2. 해제 후 **모든 제어 흐름이 사용 코드에 도달하지 않으면** 안전
3. 포인터 변수에 연산 작업 시 올바른 값을 참조하는지 정밀 검사
4. 사용 완료된 포인터 변수의 **초기화(NULL)** 여부 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```c
// 21라인 free(messageBody) 후 32라인 logError 에서 다시 접근 → 해제 후 사용 → 취약
if (success == ERROR) {
  result = ERROR;
  free(messageBody);          // 21
}
...
if (result == ERROR) {
  logError("Error processing message", messageBody);   // 32 — 해제된 변수 접근
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_원문에 별도 오탐 예제 없음._

## 마. 참고자료

- CWE-416 Use After Free, MITRE — http://cwe.mitre.org/data/definitions/416.html
- Do not access freed memory (MEM30-C), CERT
- Using freed memory, OWASP — https://www.owasp.org/index.php/Using_freed_memory

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 해제된 자원 사용 · use-after-free · 이중 해제(double free) · free 후 NULL 할당 · 동적 메모리 · 포인터 초기화 · 제어 흐름
- **객관형 시드**: vulnerable/safe 또는 정탐 코드 제시 → "해제 후 사용/이중 해제 발생 여부" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
