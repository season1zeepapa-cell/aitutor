# 경쟁조건: 검사 시점과 사용 시점 (TOCTOU)

- **unit_code**: COURSE-IMP-TS-01
- **단원**: Ⅴ. 구현 단계 보안약점 진단 > 시간 및 상태 항목에 대한 고려
- **분류**: time_state
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, pp.434-436
- **관련 라이브러리**: IMP-TS-01

## 요약

병렬 실행 환경의 응용 프로그램에서 자원을 검사하는 시점(Time of Check)과 사용하는 시점(Time of Use)의 상태가 달라 오동작을 일으키는 보안약점이다. 교착 상태, 경쟁(공유) 자원의 변조·삭제, 동기화 오류 등이 발생할 수 있다.

## 개요 — 정의와 영향

- 병렬 실행 환경에서 자원을 검사하는 시점과 사용하는 시점의 상태가 달라 오동작을 일으키는 경우 발생한다.
- 프로그램이 교착 상태에 빠지거나 경쟁(공유) 자원의 변조나 삭제 및 기타 동기화 오류 등이 발생할 수 있다.

## 대응 방안

- 경쟁(공유) 자원(예: 파일)을 여러 스레드가 접근하여 사용할 경우, 동기화 구문(synchronized)을 이용하여 한번에 하나의 스레드만 접근할 수 있도록 프로그램을 작성한다.
- 동기화 구문은 성능에 미치는 영향을 최소화하기 위해 임계코드 주변에만 적용한다.

## 진단 흐름

1. 공유 자원 사용 확인 — 여러 프로세스가 사용하는지 확인. 아니오이면 안전.
2. 하나의 자원을 동시에 접근할 가능성 존재 — 없음이면 안전.
3. 동기화 구문 또는 풀(pool) 형태의 관리 모듈 사용 — 사용하면 안전, 미사용이면 위험.

## 코드 비교 (CWE367)

### 안전하지 않은 코드

멀티쓰레드 환경에서 `FileMgmtThread`가 `READ`와 `DELETE`를 각각 수행하며 동일 파일(`Test_367.txt`)의 읽기와 삭제가 동시에 수행되어 안전하지 않다. `f.exists()` 검사 후 사용 사이에 다른 스레드가 개입할 수 있다.

```java
class FileMgmtThread extends Thread {
  private String manageType = "";
  public FileMgmtThread (String type) { manageType = type; }
  public void run() {
    try {
      if (manageType.equals("READ")) {
        File f = new File("Test_367.txt");
        if (f.exists()) {
          BufferedReader br = new BufferedReader(new FileReader(f));
          br.close();
        }
      } else if (manageType.equals("DELETE")) {
        File f = new File("Test_367.txt");
        if (f.exists()) { f.delete(); } else { … }
      }
    } catch (IOException e) { … }
  }
}
// 파일의 읽기와 삭제가 동시에 수행되어 안전하지 않다.
fileAccessThread.start();
fileDeleteThread.start();
```

### 안전한 코드

`run()` 내부를 `synchronized(SYNC)` 블록으로 감싸 멀티쓰레드 환경에서 동시에 접근할 수 없도록 하여 검사~사용 구간을 보호한다.

```java
class FileMgmtThread extends Thread {
  private static final String SYNC = "SYNC";
  private String manageType = "";
  public void run() {
    // synchronized를 사용하여 동시에 접근할 수 없도록 한다.
    synchronized(SYNC) {
      try {
        if (manageType.equals("READ")) { … }
        else if (manageType.equals("DELETE")) { … }
      } catch (IOException e) { … }
    }
  }
}
```

- 핵심 개념: 경쟁 조건(Race Condition), 데이터 일관성(Data Consistency)

## 시험 포인트

- TOCTOU는 자원 검사 시점과 사용 시점의 상태 불일치로 발생하는 시간 및 상태 분류 경쟁조건 보안약점
- 영향: 교착 상태, 공유 자원의 변조·삭제, 동기화 오류
- 대응: 공유 자원 접근 시 synchronized로 한 번에 하나의 스레드만 접근
- 동기화 구문은 성능 영향 최소화를 위해 임계코드 주변에만 적용
- 진단 흐름: 공유 자원 여부 → 동시 접근 가능성 → 동기화 구문·풀 관리 모듈 사용 여부
- 예제 CWE367: 동일 파일에 대한 READ와 DELETE 스레드 동시 실행이 위험
