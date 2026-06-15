# IMP-EH-01 · 오류 메시지 정보노출

> **단계** 구현 · **분류** 에러처리 · **CWE** CWE-209
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제4절 에러처리 §1 오류 메시지 정보노출 (p.419–424)

## 가. 개요

응용프로그램이 실행환경·사용자 등 민감한 정보를 포함하는 오류 메시지를 생성하여 외부에 제공하면 공격자의 악성 행위를 도울 수 있다. 예외발생 시 **예외이름이나 스택 트레이스** 를 출력하면 프로그램 내부구조를 쉽게 파악할 수 있기 때문이다.

## 나. 보안대책

- 오류 메시지는 정해진 사용자에게 유용한 **최소한의 정보만** 포함
- 예외상황은 내부적으로 처리하고, **미리 정의된 메시지** 만 사용자에게 제공

## 다. 코드예제

### Java
```java
// ❌ 취약: 스택 트레이스 / 시스템 정보 노출
} catch(IOException e) {
  e.printStackTrace();
}
} catch(IOException e) {
  System.err.print(e.getMessage());
}
```
```java
// ✅ 안전: 에러 코드 정의 + 최소 정보만 로깅
} catch(IOException e) {
  logger.error("ERROR-01: 파일 열기 에러");
}
```

### C#
```csharp
// ❌ 취약: 예외 객체 그대로 출력
catch (CustomException e) {
  Console.WriteLine(e);
}
// ✅ 안전: 최소 정보만 출력
catch (CustomException e) {
  _log.Debug("ERROR-01 : error information");
}
```

## 라. 진단방법

1. **①** 오류메시지를 출력하는 부분 확인 (정적도구가 민감 정보 판단이 어려우므로 진단원이 확인)
2. 해당 오류에 시스템 환경·유저정보·데이터 등 **민감한 정보가 포함되어 외부로 유출되는지** 확인

> 오류 메시지로 환경·사용자·관련 데이터 등 내부 정보가 유출되면 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// e.printStackTrace() 로 스택 정보 외부 출력 → 취약
} catch (Exception e) {
  e.printStackTrace();  // ①
}
```
```jsp
<%-- JSP 에서 cmd 처리 중 예외를 printStackTrace 로 노출 → 취약 --%>
} catch(Exception e) {
  e.printStackTrace();
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 화면(외부)에 민감정보 미출력, logger 로깅 + finally 자원 정리 → 안전
} catch (IOException e) {
  logger.error(e, e);
} finally {
  if (br != null) {
    try { br.close(); } catch (IOException e) { logger.error(e, e); }
  }
}
```

## 마. 참고자료

- CWE-209 Information Exposure Through an Error Message, MITRE — http://cwe.mitre.org/data/definitions/209.html
- Do not allow exceptions to expose sensitive information (ERR01-J), CERT
- Error Handling, OWASP — https://www.owasp.org/index.php/Error_Handling

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 스택 트레이스 · printStackTrace · getMessage · 예외 이름 노출 · 민감 정보 · 최소 정보 로깅 · 미리 정의된 오류 메시지 · 내부 정보 유출
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "오류 메시지 정보노출 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
