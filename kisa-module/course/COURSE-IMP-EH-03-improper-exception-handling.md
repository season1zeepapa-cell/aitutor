# 부적절한 예외 처리

- **unit_code**: COURSE-IMP-EH-03
- **단원**: Ⅴ. 구현 단계 보안약점 진단 > 에러처리에 대한 고려
- **분류**: error_handling
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, pp.449-454
- **관련 라이브러리**: IMP-EH-03

## 요약

여러 개의 명령문에 대해 하나의 try 블록을 설정하고 모든 예외를 하나의 방식으로 처리하는 보안약점이다. 각 상황에 적절히 대응할 수 없어 부적절한 리소스 관리로 시스템이 중지될 수 있고, 정확한 정보가 로깅되지 않아 사후 처리가 어렵다.

## 개요 — 정의와 영향

- 여러 개의 명령문에 대해 하나의 try 블록을 설정하고, 모든 예외에 대해 하나의 방식으로 예외를 처리하는 경우 발생한다.
- 각각의 상황에 대해 적절한 대응을 할 수 없어, 부적절한 리소스 관리로 시스템이 중지될 수 있다.
- 예외 상황에 대한 정확한 정보가 로깅되지 않아 사후 처리에 어려움이 발생할 수 있다.

## 대응 방안

- 각각의 예외 상황에 대해 적절한 예외 처리를 수행할 수 있도록 코드를 작성한다.

## 진단 흐름

1. 반환값/예외 발생 기능 확인 → 반환값/예외 검사 — 없음이면 위험.
2. 구체적인 반환값/예외처리 — 있음이면 안전, 없음이면 위험.

## 코드 비교 — 예제 1 (URL 읽기·날짜 파싱)

### 안전하지 않은 코드

```java
try {
    URL url = new URL("http://openeg.co.kr/");
    reader = new BufferedReader(new InputStreamReader(url.openStream()));
    String line = reader.readLine();
    SimpleDateFormat format = new SimpleDateFormat("MM/DD/YY");
    Date date = format.parse(line);
// 예외처리를 세분화 할 수 있음에도 광범위하게 사용하여 예기치 않은 문제가 발생할 수 있다.
} catch (Exception e) {
    System.err.println("Exception : " + e.getMessage());
} finally {
    if (reader != null) { try { reader.close(); } catch (IOException ex) { … } }
}
```

### 안전한 코드

```java
// 발생할 수 있는 오류의 종류와 순서에 맞춰서 예외 처리 한다.
} catch (MalformedURLException e) {
    System.err.println("MalformedURLException : " + e.getMessage());
} catch (IOException e) {
    System.err.println("IOException : " + e.getMessage());
} catch (ParseException e) {
    System.err.println("ParseException : " + e.getMessage());
} finally {
    if (reader != null) { try { reader.close(); } catch (IOException ex) { … } }
}
```

## 코드 비교 — 예제 2 (파일 쓰기)

### 안전하지 않은 코드

```java
try {
    File file = new File(data);
    FileWriter out = new FileWriter(file);
    out.write("write test");
    out.close();
// IOException 예상 가능하나 적절한 예외처리를 하지 않음
} catch(Exception e) {
    logger.error("파일처리오류가 발생함");
}
```

### 안전한 코드

```java
File file = new File(data);
FileWriter out = null;
try {
    out = new FileWriter(file);
// 발생할 수 있는 오류의 종류와 순서에 맞춰서 예외 처리 한다.
} catch (IOException e) {
    logger.error("ERROR-001: 파일열기 오류");
}
try {
    out.write("write test");
} catch (IOException e) {
    logger.error("ERROR-002: 파일쓰기 오류");
} finally {
    try {
        out.close();
    } catch (IOException e) {
        logger.error("ERROR-003: 파일닫기 오류");
    }
}
```

## 참고 — 예외 클래스 종류

교재는 예외 클래스 종류와 런타임 예외 클래스 계층을 함께 제시한다.

## 시험 포인트

- 여러 명령문을 하나의 try로 묶어 모든 예외를 단일 방식으로 처리하는 에러처리 분류 보안약점
- 영향: 부적절한 리소스 관리로 시스템 중지, 정확한 정보 미로깅으로 사후 처리 곤란
- 대응: 각 예외 상황에 맞춰 적절한 예외 처리(세분화)를 수행
- 안전 코드 핵심: `MalformedURLException → IOException → ParseException`처럼 종류·순서에 맞춘 다중 catch
- 파일 처리는 열기/쓰기/닫기를 단계별 try-catch로 분리(ERROR-001~003)
- 진단: 반환값/예외 검사 → 구체적인 반환값/예외처리 존재 여부
