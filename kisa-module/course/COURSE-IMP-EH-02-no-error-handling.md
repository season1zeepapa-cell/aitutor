# 오류 상황 대응 부재

- **unit_code**: COURSE-IMP-EH-02
- **단원**: Ⅴ. 구현 단계 보안약점 진단 > 에러처리에 대한 고려
- **분류**: error_handling
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, pp.445-448
- **관련 라이브러리**: IMP-EH-02

## 요약

프로그램에서 발생된 오류에 대해 아무런 조치를 하지 않아 프로그램이 의도하지 않은 비정상적인 상태로 실행되는 보안약점이다. 예외 발생 시 연결 해제 등이 수행되지 않거나 로깅 정보가 없어 사후 처리가 어려울 수 있다.

## 개요 — 정의와 영향

- 프로그램에서 발생된 오류에 대해 아무런 조치를 하지 않아, 프로그램이 의도하지 않은 비정상적인 상태로 실행되는 경우 발생한다.
- DB 연결 상태에서 예외가 발생한 경우, 예외처리에서 연결해제 작업이 제대로 수행되지 않는다면 시스템은 DB 연결을 할 수 없게 될 수 있다.
- 예외 상태에 대한 로깅 정보가 존재하지 않아 오류 상황에 대한 사후 처리가 어려울 수 있다.

## 대응 방안

- 프로그램 오류가 발생한 경우 정확한 처리 절차에 따라 프로그램이 운영될 수 있도록 프로그램이 작성되어야 한다.
- 예외 발생 시 특별히 수행해야 하는 작업이 없는 경우에도 `logger.error("에러상황에 대한 간단한 메시지 또는 에러코드")`가 수행될 수 있어야 한다.

## 진단 흐름

1. 오류 발생 가능 기능 확인 → 예외처리 존재 여부 — 없음이면 위험.
2. 예외처리 루틴이 비어있는지 확인 — 비어있음이면 위험, 예외처리(내용 존재)이면 안전.

## 코드 비교 — 예제 1 (로그인 인증)

### 안전하지 않은 코드

```java
try {
    username = s.getParser().getRawParameter(USERNAME);
    password = s.getParser().getRawParameter(PASSWORD);
    if (!"webgoat".equals(username) || !password.equals("webgoat")) {
        s.setMessage("Invalid username and password entered.");
        return (makeLogin(s));
    }
}
catch (Exception e) {
    // 예외 사항에 대해 적절한 조치를 수행하지 않음
    // do nothing
}
```

### 안전한 코드

```java
catch (Exception e) {
    // 예외 사항에 대해 적절한 조치를 수행함.
    s.setMessage(e.getMessage());
    return (makeLogin(s));
}
```

## 코드 비교 — 예제 2 (권한 레벨)

### 안전하지 않은 코드

```java
try {
    if (data.equals("admin")) { level = "S"; }
    else { level = "G"; }
} catch(Exception e) {
    // 예외 처리가 없어 예외 시 적절한 대응이 되지 않음
}
```

### 안전한 코드

```java
try {
    if (data.equals("admin")) { level = "S"; }
    else { level = "G"; }
} catch(Exception e) {
    // 적절한 예외 처리 코드 삽입
    logger.error("ERROR-01: 권한 정보가 입력되지 않음");
}
```

## 시험 포인트

- 오류에 아무 조치를 하지 않아 프로그램이 비정상 상태로 실행되는 에러처리 분류 보안약점
- 영향: DB 연결 해제 누락으로 연결 불능, 로깅 부재로 사후 처리 곤란
- 대응: 정확한 처리 절차로 운영, 특별 작업이 없어도 `logger.error`로 최소 로깅
- 진단: 예외처리 존재 여부 → 예외처리 루틴이 비어있는지 확인 (비어있으면 위험)
- 위험 코드: catch 블록의 `// do nothing`, 빈 catch
- 오류메시지 정보 노출(4-1)에서 출력을 주석처리하면 본 약점(4-2)이 됨
