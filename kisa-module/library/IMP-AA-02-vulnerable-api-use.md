# IMP-AA-02 · 취약한 API 사용

> **단계** 구현 · **분류** API 오용 · **CWE** CWE-676
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제7절 §2 (p.497–501)

## 가. 개요

취약한 API는 보안상 **금지된(banned) 함수**이거나, 부주의하게 사용될 가능성이 많은 API다. 확인 없이 사용하면 보안 문제가 발생한다. 대표 예: `strcat()`, `strcpy()`, `strncat()`, `strncpy()`, `sprintf()`. 보안상 문제 없는 함수라도 **잘못된 방식으로 사용**하면 보안 문제가 생긴다.

## 나. 보안대책

- 금지된 함수는 안전한 대체 함수 사용: `strcat_s()`, `strcpy_s()`, `strncat_s()`, `strncpy_s()`, `sprintf_s()` 등
- 금지은 아니나 취약한 API 예: `strtol()` — int/short/char 등 작은 부호 있는 정수형 변환에 쓰면 범위 제한 없이 값을 평가
- 개발 조직이 취약한 API 분류를 명시했다면 반드시 준수

## 다. 코드예제

### C (gets)
```c
// ❌ 취약: gets() 는 길이 제한 불가 → 버퍼 오버플로우
char str[100];
gets(str);
```
```c
// ✅ 안전: gets_s() 로 크기 제한 (fgets() 도 가능)
char str[100];
gets_s(str, sizeof(str));
```

### Java (소켓 직접 사용)
```java
// ❌ 취약: 소켓 직접 사용 → 프레임워크 보안기능 미제공
socket = new Socket("kisa.or.kr", 8080);
```
```java
// ✅ 안전: 프레임워크 메소드(URLConnection) 사용
URL url = new URL("http://127.0.0.1:8080/DataServlet");
URLConnection urlConn = url.openConnection();
urlConn.setDoOutput(true);
```

### Java (System.exit)
```java
// ❌ 취약: System.exit() 가 WAS 컨테이너를 종료
catch (IOException ase) {
  logger.info("ERROR");
  System.exit(1);
}
```
```java
// ✅ 안전: System.exit() 미사용
catch (IOException ase) {
  logger.info("ERROR");
}
```

### C# (Application.Exit)
```csharp
// ❌ 취약: 즉시 종료 → Form.Closed/Form.Closing 이벤트 미처리
Application.Exit();
```
```csharp
// ✅ 안전: this.Close() 로 이벤트 처리 보장
this.Close();
```

## 라. 진단방법

1. 취약한 API 리스트를 작성하고 프로그램이 해당 API를 사용하는지 확인
2. 사용 시 예기치 않은 문제가 발생할 수 있으므로 취약 판정
3. 대체 API가 없으면 해당 API의 **인자·반환 값 검사**가 이루어지는지 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```c
// strcpy() 사용 → 매개변수 길이가 buf[24] 보다 크면 버퍼 오버플로우 → 취약
void manipulate_string(char * string)
{
  char buf[24];
  strcpy(buf, string);
}
```
```java
// J2EE 에서 System.exit() 사용 → 컨테이너 종료 가능 → 취약
public class U382 extends HttpServlet {
  public void doPost(...) ... {
    try { do_something(logger); }
    catch (IOException ase) {
      System.exit(1); /* J2EE 프로그램에서 System.exit()을 사용하고 있음 */
    }
  }
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_원문에 오탐 코드 예시 없음._

## 마. 참고자료

- CWE-676 Use of Potentially Dangerous Function, MITRE — http://cwe.mitre.org/data/definitions/676.html
- CWE-242 Use of Inherently Dangerous Function, MITRE — http://cwe.mitre.org/data/definitions/242.html
- CWE-246 J2EE Bad Practices: Direct Use of Sockets, MITRE — http://cwe.mitre.org/data/definitions/246.html
- CWE-382 J2EE Bad Practices: Use of System.exit(), MITRE — http://cwe.mitre.org/data/definitions/382.html
- Do not use deprecated or obsolescent functions (MSC24-C), CERT

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 금지된(banned) 함수 · strcpy/strcat/sprintf/gets · 안전한 대체 함수(_s) · 버퍼 오버플로우 · System.exit()/Application.Exit() · 소켓 직접 사용 · 인자·반환값 검사
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
