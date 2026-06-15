# IMP-TS-01 · 경쟁조건: 검사 시점과 사용 시점 (TOCTOU)

> **단계** 구현 · **분류** 시간 및 상태 · **CWE** CWE-367
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제3절 §1 경쟁조건: 검사 시점과 사용 시점(TOCTOU) (p.406–414)

## 가. 개요

병렬시스템(멀티프로세스 응용프로그램)에서는 자원(파일, 소켓 등)을 사용하기에 앞서 상태를 검사한다. 그러나 **검사 시점(Time Of Check)** 과 **사용 시점(Time Of Use)** 이 달라, 검사 시점에 존재하던 자원이 사용 시점에 사라지는 등 자원 상태가 변할 수 있다. 이로 인해 동기화 오류뿐 아니라 교착상태 등의 문제가 발생한다.

## 나. 보안대책

- 공유자원(예: 파일)을 여러 프로세스가 접근할 경우 **동기화 구문(synchronized, mutex 등)** 으로 한 번에 하나의 프로세스만 접근하도록 제한
- 성능 영향을 최소화하기 위해 **임계코드 주변만** 동기화 구문 적용

## 다. 코드예제

### Java
파일 읽기/삭제가 두 스레드에서 동작하여 이미 삭제된 파일을 읽으려는 레이스컨디션이 발생할 수 있다.

```java
// ❌ 취약: 동기화 없이 공유자원 동시 접근
public void run() {
  if (manageType.equals("READ")) {
    File f = new File("Test_367.txt");
    if (f.exists()) { /* read */ }
  } else if (manageType.equals("DELETE")) {
    File f = new File("Test_367.txt");
    if (f.exists()) { f.delete(); }
  }
}
```
```java
// ✅ 안전: synchronized 로 동시 접근 차단
private static final String SYNC = "SYNC";
public void run() {
  synchronized(SYNC) {
    // READ / DELETE 처리
  }
}
```

### C#
```csharp
// ❌ 취약: 동기화 없이 파일 접근
public void ReadFile(String f) {
  if(File.Exists(f)) { File.ReadAllLines(f); }
}
// ✅ 안전: MethodImplOptions.Synchronized
[MethodImpl(MethodImplOptions.Synchronized)]
public void ReadFile(String f) {
  if(File.Exists(f)) { File.ReadAllLines(f); }
}
```

### C
입금/출금이 빈번하면 lock 없는 공유 자원 `account` 값이 달라진다(예: 0 vs -100).

```c
// ❌ 취약: lock 없이 공유 자원 접근
void deposit(int amount) { account += amount; }
void withdraw(int amount) { account -= amount; }
// ✅ 안전: mutex_lock / mutex_unlock
void deposit(int amount) {
  mutex_lock(&account_lock);
  account += amount;
  mutex_unlock(&account_lock);
}
```

## 라. 진단방법

1. **①** 공유자원(파일/폴더, 소켓, 드라이버 등)을 여러 프로세스가 사용하는지 확인
2. **②** 하나의 공유자원을 동시에 접근할 가능성이 있으면 취약 판정

> 동기화 구문 또는 공유자원 억세스를 관리하는 pool 형태의 자체 모듈을 사용하면 안전 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 파일 읽기/삭제를 두 스레드가 동기화 없이 동시 수행 → 취약
FileAccessThread fileAccessThread = new FileAccessThread();
FileDeleteThread fileDeleteThread = new FileDeleteThread();
fileAccessThread.start();
fileDeleteThread.start();
```
```c
// access() 검사 후 fopen() 사용 → 검사·사용 시점 분리 → 취약
if (!access(file,W_OK)) {
  f = fopen(file,"w+");
  operate(f);
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 스트림 생성 시 IOException 으로 예외 처리 가능 → 문제 없음
File f = new File("toctou.txt");
if (!f.exists()) {
  try { fos = new FileOutputStream("toctou.txt") }
  catch (IOException e) { /* 처리 */ } finally { /* 해제 */ }
}
```
```java
// 디렉터리 목록·메타정보 조회, 실제 경쟁 조건 없음 → 안전
File[] fList = file.listFiles();
for (int i = 0; i < fList.length; i++) {
  currentList.add(fList[i].getAbsolutePath() + "$" + getLastModifiedTime(fList[i]) + ...);
}
```

## 마. 참고자료

- CWE-367 Time-of-check Time-of-use(TOCTOU) Race Condition, MITRE — http://cwe.mitre.org/data/definitions/367.html
- Avoid TOCTOU race conditions while accessing files (FIO45-C), CERT

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 검사시점(TOC) · 사용시점(TOU) · 레이스컨디션 · 공유자원 · synchronized · mutex_lock/unlock · 임계코드 · 동기화 구문 · 교착상태
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "TOCTOU 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
