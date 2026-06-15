# 잘못된 세션에 의한 데이터 정보 노출

- **코드**: COURSE-IMP-EN-01 (chapter ref: IMP-EN-01)
- **단계**: Ⅴ. 구현 단계 보안약점 진단
- **분류**: 캡슐화(encapsulation)
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, 480-482쪽

## 요약

다중 스레드 환경에서 싱글톤(singleton) 객체의 멤버변수를 사용하는 경우 발생하는 캡슐화 보안약점이다. Servlet·JSP·Controller 등 싱글톤으로 존재하는 객체의 멤버변수가 여러 스레드에 의해 공유되면서 다른 스레드에게 정보를 노출시킬 수 있다.

## 개요 — 약점 정의와 발생 원인

- 다중 스레드 환경에서 싱글톤 객체의 멤버변수를 사용하는 경우 발생한다.
- Servlet, JSP, Controller 등 싱글톤으로 존재하는 객체들의 멤버변수가 여러 스레드에 의해 공유되면서 다른 스레드에게 정보를 노출시킬 수 있다.

## 보안대책 — 변수 범위(scope) 관리

- 싱글톤 패턴을 사용하는 경우, 변수 범위(scope)에 주의하여 사용한다.
- Java에서 HttpServlet 클래스의 하위 클래스나 JSP, Controller에서 멤버 필드를 선언하지 않도록 한다.
- 필요한 경우 지역변수를 선언하여 사용한다.

## 진단 흐름도

1. 다중 스레드 환경 확인 → HttpServlet 하위 클래스 내 멤버필드 선언 여부 확인.
2. 멤버필드 선언이 **없음** → 안전.
3. 멤버필드 선언이 **있음** → `final`로 정의되어 있으면 안전, 아니면 **위험**.

## 코드 예시 — JSP 멤버변수 vs 로컬변수

**안전하지 않은 코드** (멤버 변수 `<%! %>`)
```jsp
<%@page import="javax.xml.namespace.*"%>
<%@page import="gov.mogaha.ntis.web.frs.gis.cmm.util.*" %>
<%!
  // JSP에서 String 필드들이 멤버 변수로 선언됨
  String commonPath = "/";
  String imagePath = commonPath + "img/";
  String imagePath_gis = imagePath + "gis/cmm/btn/";
%>
```

**안전한 코드** (로컬 변수 `<% %>`)
```jsp
<%
  // JSP에서 String 필드들이 로컬 변수로 선언됨
  String commonPath = "/";
  String imagePath = commonPath + "img/";
  String imagePath_gis = imagePath + "gis/cmm/btn/";
%>
```

## 코드 예시 — Controller 멤버변수 vs 지역변수

**안전하지 않은 코드**
```java
@Controller
public class TrendForecastController {
  // Controller에서 int 필드가 멤버 변수로 선언되어 스레드 간에 공유됨
  private int currentPage = 1;
  public void doSomething(HttpServletRequest request) {
      currentPage = Integer.parseInt(request.getParameter("page"));
  }
}
```

**안전한 코드**
```java
@Controller
public class TrendForecastController {
  public void doSomething(HttpServletRequest request) {
      // 지역변수로 사용하여 스레드간 공유되지 못하도록 한다.
      int currentPage = Integer.parseInt(request.getParameter("page"));
  }
}
```

## 시험 포인트

- 다중 스레드 환경에서 싱글톤 객체의 멤버변수 사용이 원인 — Servlet·JSP·Controller가 대상.
- 보안대책: 멤버 필드 선언 금지, 필요 시 지역변수 사용.
- JSP에서 `<%! %>`(멤버변수)는 위험, `<% %>`(로컬변수)가 안전.
- Controller의 `private int currentPage`를 request 값으로 갱신하면 스레드 간 정보 노출.
- 진단 흐름: 멤버필드 선언이 있고 `final`이 아니면 위험.

## 관련 라이브러리 항목
- IMP-EN-01
