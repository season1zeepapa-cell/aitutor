# IMP-CE-02 · 부적절한 자원 해제

> **단계** 구현 · **분류** 코드오류 · **CWE** CWE-404
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §2 부적절한 자원 해제 (p.445–452)

## 가. 개요

파일디스크립터, 힙 메모리, 소켓 등은 **유한한 자원**이다. 할당받아 사용한 후 더 이상 사용하지 않으면 적절히 반환해야 하는데, 프로그램 오류·에러로 사용이 끝난 자원을 반환하지 못하는 경우의 보안약점이다.

## 나. 보안대책

- 자원을 획득·사용한 다음에는 **반드시 해제하여 반환**
- 예외 발생 여부와 무관하게 항상 실행되는 **finally 블록**에서 모든 자원 반환 (C#은 **using 구문** 활용)

## 다. 코드예제

### Java
```java
// ❌ 취약: try 안에서 close → 중간 오류 시 자원 미반환
try {
  in = new FileInputStream(inputFile);
  out = new FileOutputStream(outputFile);
  FileCopyUtils.copy(fis, os);
  in.close();
  out.close();
} catch (IOException e) { logger.error(e); }
```
```java
// ✅ 안전: finally 에서 각 자원 null 검사 후 해제
} finally {
  if (in != null) { try { in.close(); } catch (IOException e) { logger.error(e); } }
  if (out != null) { try { out.close(); } catch (IOException e) { logger.error(e); } }
}
```

### C#
```csharp
// ❌ 취약: fsSource 가 해제되지 않음
FileStream fsSource = new FileStream(pathSource, FileMode.Open, FileAccess.Read);
```
```csharp
// ✅ 안전: using 으로 자동 해제
using(FileStream fsSource = new FileStream(pathSource, FileMode.Open, FileAccess.Read)){ ... }
```

### C
```c
// ❌ 취약: checkSomething() false 시 fclose 미실행 → 누수
FILE *f = fopen(filename, "r");
if(!checkSomething()) { printf("Something is wrong"); return; }
fclose(f);
```
```c
// ✅ 안전: 모든 분기에서 fclose
if(!checkSomething()) { printf("Something is wrong"); fclose(f); return; }
fclose(f);
```

## 라. 진단방법

1. 자원(파일기술자·힙메모리·소켓)이 선언·할당된 경우 해제되는지 확인
2. 제어문·예외처리문 등 **모든 제어 흐름(control flow)** 을 판단하여 자원해제 여부 체크
3. 해제되지 않는 분기가 존재하면 취약

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// finally 안 하나의 try로 묶음 → rs.close() 예외 시 이하 미해제 → 취약
} finally {
  try {
    rs.close();
    pstmt.close();
    pstmt1.close();
    conn.close();
  } catch(Exception e) { }
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 각 close()를 개별 try-catch 로 분리 → 한 자원 예외가 다른 해제를 막지 않음 → 안전
} finally {
  try { rs.close(); } catch (Exception e) { }
  try { pstmt.close(); } catch(Exception e) { }
  try { pstmt1.close(); } catch (Exception e) { }
  try { conn.close(); } catch (Exception e) { }
}
```
```java
// 함수가 자원(Connection)을 리턴 → 해제는 호출 측 책임 → 안전
public static Connection getConnection() {
  Connection conn = null;
  try { conn = DriverManager.getConnection(...); } catch (...) { }
  return conn;
}
```

## 마. 참고자료

- CWE-404 Improper Resource Shutdown or Release, MITRE — http://cwe.mitre.org/data/definitions/404.html
- Release resources when they are no longer needed (FIO04-J), CERT
- Unreleased Resource, OWASP — https://www.owasp.org/index.php/Unreleased_Resource

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 자원 해제 · finally 블록 · close() · using 구문 · fclose · 개별 try-catch · 제어 흐름(control flow) · 자원 누수
- **객관형 시드**: vulnerable/safe 또는 정탐/오탐 코드 제시 → "자원 해제 누락 여부" / "취약·안전 판정"
- **서술형 시드**: 정탐/오탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
