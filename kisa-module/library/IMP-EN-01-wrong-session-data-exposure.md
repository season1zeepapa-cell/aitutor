# IMP-EN-01 · 잘못된 세션에 의한 데이터 정보 노출

> **단계** 구현 · **분류** 캡슐화 · **CWE** CWE-488
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제6절 §1 잘못된 세션에 의한 데이터 정보 노출 (p.469–475)

## 가. 개요

다중 스레드 환경에서는 **싱글톤(Singleton) 객체 필드에 경쟁조건(Race Condition)** 이 발생할 수 있다. Java의 서블릿(Servlet) 등 다중 스레드 환경에서는 **정보를 저장하는 멤버변수가 포함되지 않도록** 하여, 서로 다른 세션에서 데이터를 공유하지 않도록 해야 한다.

## 나. 보안대책

- 싱글톤 패턴 사용 시 **변수 범위(Scope)** 에 주의
- Java에서는 `HttpServlet` 하위클래스에 **멤버 필드를 선언하지 않고**, 필요 시 **지역 변수**로 선언하여 사용

## 다. 코드예제

### Java (JSP)
JSP 선언부(`<%! %>`)에 선언한 변수는 접근하는 모든 사용자에게 공유된다. 서블릿 영역(`<% %>`)에 정의하면 `_jspService` 의 지역변수가 되어 공유되지 않는다.

```jsp
<%-- ❌ 취약: 멤버 변수로 선언 (선언부에 공유됨) --%>
String username = "/";
String imagePath = commonPath + "img/";
```
```jsp
<%-- ✅ 안전: 로컬(지역) 변수로 선언 --%>
String commonPath = "/";
String imagePath = commonPath + "img/";
```

### Java (Spring Controller)
```java
// ❌ 취약: 멤버 변수가 스레드 간 공유됨
@Controller
public class TrendForecastController {
  private int currentPage = 1;
  public void doSomething(HttpServletRequest request) {
    currentPage = Integer.parseInt(request.getParameter("page"));
  }
}
```
```java
// ✅ 안전: 지역 변수 사용
@Controller
public class TrendForecastController {
  public void doSomething(HttpServletRequest request) {
    int currentPage = Integer.parseInt(request.getParameter("page"));
  }
}
```

### C#
```csharp
// ❌ 취약: IHttpHandler 구현 클래스에 정보 저장 필드
class DataLeakBetweenSessions : IHttpHandler {
    private String id;
    public void ProcessRequest(HttpContext ctx) { ... }
}
```
```csharp
// ✅ 안전: 지역 변수 또는 세션변수 사용
ctx.Session["id"] = ctx.Request.QueryString["id"];
```

## 라. 진단방법

- `HttpServlet` 하위클래스에 **멤버필드가 선언되어 있고 final이 아닌 경우** 취약 판정
- 서블릿(JSP 포함)에서 **상수로 사용하지 않는 멤버 변수**를 사용하면 취약

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// HttpServlet 하위클래스에 final 아닌 멤버필드 name → 취약
public class U488 extends HttpServlet {
    private String name;
    protected void doPost(HttpServletRequest request, HttpServletResponse response) ... {
        name = request.getParameter("name");
        out.println(name + ", thanks for visiting!");
    }
}
```
```jsp
<%-- JSP 선언부에 상수 아닌 멤버 변수 → 취약 --%>
<%!
String commonPath = "/";
String imagePath = commonPath + "img/";
%>
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```jsp
<%-- 내부 클래스 사용은 멤버필드가 아님 → 안전 --%>
<%!
private class CacheEntity {
    String name; String lastModified; String expires; String eTag;
}
%>
```
```jsp
<%-- final 필드는 상수 → 안전 --%>
<%!
final String imagePath = "/img/";
String treeImagePath = imagePath+"/port/tree.gif";
%>
```
```java
// Spring/eGov는 IoC로 프레임워크가 인스턴스 관리 → 안전
@Resource(name = "fileMngService")
private FileMngService fileService;
```

## 마. 참고자료

- CWE-488 Exposure of Data Element to Wrong Session, MITRE — http://cwe.mitre.org/data/definitions/488.html
- CWE-543 Use of Singleton Pattern Without Synchronization in a Multithreaded Context, MITRE
- Do not let session information leak within a servlet, CERT (MSC11-J)

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 싱글톤 · 경쟁조건(Race Condition) · 멤버 변수 · 지역 변수 · HttpServlet · JSP 선언부 · final 필드 · 세션변수 · IoC
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
