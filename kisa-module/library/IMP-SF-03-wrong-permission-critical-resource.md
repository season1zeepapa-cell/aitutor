# IMP-SF-03 · 중요한 자원에 대한 잘못된 권한 설정

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-732
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §3 중요한 자원에 대한 잘못된 권한 설정 (p.325–329)

## 가. 개요

SW가 중요한 보안관련 자원에 대하여 읽기 또는 수정하기 권한을 의도하지 않게 허가할 경우, 권한을 갖지 않은 사용자가 해당자원을 사용하게 된다.

## 나. 보안대책

- 설정파일·실행파일·라이브러리 등은 **SW 관리자에 의해서만** 읽고 쓰기 가능하도록 설정
- 중요 자원 사용 시 **허가받지 않은 사용자의 접근 가능 여부를 검사**

## 다. 코드예제

### Java
`setReadable(p1, p2)` 등에서 두 번째 인자가 `false`이면 **모든 사용자**에게 권한이 부여된다. 최소권한 원칙에 따라 소유자에게만 권한을 부여(1개 인자 메소드)해야 한다.

```java
// ❌ 취약: 두 번째 인자 false → 모든 사용자에게 실행/읽기/쓰기 권한 허용
file.setExecutable(true, false);
file.setReadable(true, false);
file.setWritable(true, false);
```
```java
// ✅ 안전: 소유자 전용 권한 — 실행/쓰기 금지, 읽기만 허용
file.setExecutable(false);
file.setReadable(true);
file.setWritable(false);
```

### C#
```csharp
// ❌ 취약: "everyone" 에게 FullControl 부여
dSecurity.AddAccessRule(new FileSystemAccessRule("everyone",
  FileSystemRights.FullControl, ..., AccessControlType.Allow));

// ✅ 안전: 적절한 Account/Rights/ControlType 으로 설정
dSecurity.AddAccessRule(new FileSystemAccessRule(Account, Rights, ControlType));
```

### C
```c
// ❌ 취약: umask(0) → 모든 사용자 읽기/쓰기 권한
umask(0);
FILE *out = fopen("file_name", "w");

// ✅ 안전: umask(077) → 유저 외 권한 없음
umask(077);
FILE *out = fopen("file_name", "w");
```

## 라. 진단방법

1. SW가 생성하는 **중요자원(파일 등) 식별** — 업로드 파일, 설정파일 등
2. 읽기·쓰기·실행 권한을 **사전 정의했는지** 확인하고, 정의한 권한대로 접근권한을 허용하는지 확인
3. 설정파일·문서파일은 **실행 권한이 설정되지 않았는지** 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// umask 0 → 파일 rw-rw-rw-, 디렉토리 rwxrwxrwx → 모든 사용자 권한 → 취약
String cmd = "umask 0";
File file = new File("/home/report/report.txt");
Runtime.getRuntime().exec(cmd);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 실행/쓰기 제외, 읽기 권한만 부여 → 안전
File file = new File("/home/setup/system.ini");
file.setExecutable(false);
file.setReadable(true);
file.setWritable(false);
```

## 마. 참고자료

- CWE-732 Incorrect Permission Assignment for Critical Resource, MITRE — http://cwe.mitre.org/data/definitions/732.html
- Create files with appropriate access permissions (FIO06-C), CERT

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 최소권한 · setExecutable/setReadable/setWritable · umask(077) · everyone FullControl · 소유자 전용 권한 · 설정파일 실행권한 금지 · FileSystemAccessRule
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
