# IMP-EH-02 · 오류상황 대응 부재

> **단계** 구현 · **분류** 에러처리 · **CWE** CWE-390
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제4절 에러처리 §2 오류상황 대응 부재 (p.425–428)

## 가. 개요

오류가 발생할 수 있는 부분을 확인하였으나 예외 처리를 하지 않으면, 공격자는 오류 상황을 악용하여 개발자가 의도하지 않은 방향으로 프로그램이 동작하도록 할 수 있다.

## 나. 보안대책

- 오류가 발생할 수 있는 부분에 **제어문으로 적절한 예외 처리** (C/C++의 if·switch, Java의 try-catch 등)

## 다. 코드예제

### Java
PASSWORD 파라미터가 없으면 NullPointerException이 발생하는데, catch 블록이 비어 있어 인증이 된 것으로 처리된다.

```java
// ❌ 취약: catch 블록 비어 있음 → 인증 우회
} catch (NullPointerException e) {
  // 대응 없음 → 인증이 된 것으로 처리
}
```
```java
// ✅ 안전: 예외에 대해 적절한 조치
} catch (NullPointerException e) {
  s.setMessage(e.getMessage());
  return (makeLogin(s));
}
```

### C#
```csharp
// ❌ 취약: 예외 상황 대응 부재
} catch (CustomException e) {
}
// ✅ 안전: 적절한 조치 수행
} catch (CustomException e) {
  logger.Debug("log message");
}
```

## 라. 진단방법

1. 오류 발생 가능 부분에 예외처리를 수행했는지 확인
2. 제어문으로 예외 처리하는 **루틴이 비어있는지** 확인

> catch 로 오류를 포착하지만 아무 조치가 없으면 프로그램이 계속 실행되어 무슨 일이 일어났는지 알 수 없게 되므로 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// SQLException / NamingException catch 블록이 비어 있음 → 취약
} catch (SQLException e) {
  // catch 블록이 비어있음
} catch (NamingException e) {
  // catch 블록이 비어있음
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

(원문에 해당 오탐 예제 없음)

## 마. 참고자료

- CWE-390 Detection of Error Condition Without Action, MITRE — http://cwe.mitre.org/data/definitions/390.html
- Do not suppress or ignore checked exceptions (ERR00-J), CERT

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 빈 catch 블록 · 예외 처리 부재 · try-catch · NullPointerException · 오류 상황 악용 · 적절한 예외 조치 · 제어문 예외 처리
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "오류상황 대응 부재 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
