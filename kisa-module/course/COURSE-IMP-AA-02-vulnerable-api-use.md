# 취약한 API 사용

- **코드**: COURSE-IMP-AA-02 (chapter ref: IMP-AA-02)
- **단계**: Ⅴ. 구현 단계 보안약점 진단
- **분류**: API 오용(api_abuse)
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, 497-499쪽

## 요약

보안상 금지된 함수이거나 부주의하게 사용될 가능성이 많은 API를 사용하는 경우 발생하는 API 오용 보안약점이다. J2EE 환경에서 컨테이너의 연결 관리를 직접 제작하거나, 소켓을 직접 사용하거나, System.exit()를 호출하면 에러·서비스 종료 등 문제가 발생할 수 있다. 컨테이너·프레임워크가 제공하는 안전한 기능을 사용해야 한다.

## 개요 — 약점 정의와 사례

- 보안상 금지된 함수이거나, 부주의하게 사용될 가능성이 많은 API를 사용하는 경우 발생한다.
- J2EE 애플리케이션이 컨테이너에서 제공하는 자원 연결 관리를 사용하지 않고 직접 제작하면 에러를 유발할 수 있어 J2EE 표준에서 금지한다.
- J2EE 애플리케이션이 프레임워크 메소드 호출 대신 소켓을 직접 사용하면 채널 보안·에러 처리·세션 관리 등 다양한 고려가 필요하다.
- J2EE 응용프로그램에서 `System.exit()`의 사용은 컨테이너까지 종료시킨다.

## 보안대책

- J2EE 애플리케이션이 컨테이너에서 제공하는 연결 관리 기능을 사용한다.
- 소켓을 직접 사용하는 대신 프레임워크에서 제공하는 메소드 호출을 사용한다.
- J2EE 프로그램에서 `System.exit()`를 사용하지 않는다.

## 진단 흐름도

1. 취약한 API 사용 여부 확인 → 사용하지 않으면(아니오) 종료.
2. 취약한 API를 사용하는 경우(예), 대체 가능한 안전한 API가 없으면 → API 인자와 반환값 검사 실시 여부 확인.
3. 인자·반환값 검사 **실시** → 안전, **미실시** → 위험.

## 코드 예시 ① — 소켓 직접 사용 vs 프레임워크 메소드

**안전하지 않은 코드**
```java
public class S246 extends javax.servlet.http.HttpServlet {
  private Socket socket;
  protected void doGet(HttpServletRequest request,
      HttpServletResponse response) throws ServletException {
      try {
          // 프레임워크의 메소드 호출 대신 소켓을 직접 사용하고 있어 프레임워크에서 제공하는
          // 보안기능을 제공 받지 못해 안전하지 않다.
          socket = new Socket("kisa.or.kr", 8080);
      } catch (UnknownHostException e) {
          :
```

**안전한 코드**
```java
public class S246 extends javax.servlet.http.HttpServlet {
  protected void doGet(HttpServletRequest request,
      HttpServletResponse response) throws ServletException {
      ObjectOutputStream oos = null;
      ObjectInputStream ois = null;
      try {
          // 보안기능을 제공하는 프레임워크의 메소드를 사용하여야한다.
          URL url = new URL("http://127.0.0.1:8080/DataServlet");
          URLConnection urlConn = url.openConnection();
          urlConn.setDoOutput(true);
          :
```

## 코드 예시 ② — System.exit() vs 로깅

**안전하지 않은 코드**
```java
public class U382 extends HttpServlet {
  public void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
      try {
          do_something(logger);
      } catch (IOException ase) {
          // J2EE 프로그램에서 System.exit()을 사용하여 서비스가 종료 될 수 있다.
          System.exit(1);
      }
```

**안전한 코드**
```java
public class U382 extends HttpServlet {
  public void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
      try {
          do_something(logger);
      } catch (IOException ase) {
          logger.info("ERROR");
      }
```

## 시험 포인트

- 원인: 보안상 금지되거나 부주의하게 사용될 가능성이 큰 API 사용.
- J2EE 3대 사례: ① 컨테이너 연결 관리 직접 제작(표준 금지), ② 소켓 직접 사용, ③ `System.exit()` 호출(컨테이너까지 종료).
- 보안대책: 컨테이너 연결 관리 사용, 소켓 대신 프레임워크 메소드, `System.exit()` 미사용.
- 안전한 코드: Socket → URL/URLConnection, `System.exit(1)` → `logger.info("ERROR")`.
- 진단 흐름: 취약 API 사용 + 대체 API 없음 + 인자·반환값 검사 미실시 → 위험 / 검사 실시 → 안전.

## 관련 라이브러리 항목
- IMP-AA-02
