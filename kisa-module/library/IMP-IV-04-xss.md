# IMP-IV-04 · 크로스사이트 스크립트 (XSS)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-79
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §4 크로스사이트 스크립트 (p.211–222)

## 가. 개요

웹 페이지에 악의적인 스크립트를 포함시켜 사용자 측에서 실행되게 유도할 수 있다. 검증되지 않은 외부 입력이 동적 웹페이지 생성에 사용되면, 페이지를 열람하는 접속자의 권한으로 부적절한 스크립트가 수행되어 정보유출 등을 유발한다. XSS는 3가지로 나뉜다.

- **Reflected XSS**: 서버가 외부 입력 악성 스크립트가 포함된 URL 파라미터를 응답에 반영
- **Stored XSS**: 게시판·코멘트 등으로 악성 스크립트가 DB에 저장되어 사용자에게 전달
- **DOM기반 XSS**: 서버를 거치지 않고 DOM 생성 과정에서 실행

## 나. 보안대책

- 문자변환 함수/메서드로 `< > & "` 를 `&lt; &gt; &amp; &quot;` 로 치환
- HTML 태그 허용 게시판은 허용 태그를 **화이트리스트**로 제한
- 잘 만들어진 외부 XSS방지 라이브러리(**NAVER Lucy-XSS-Filter, OWASP ESAPI, OWASP Java-Encoder-Project**)를 동작 상황에 맞게 사용 권장

## 다. 코드예제

### Java (Reflected/Stored/DOM)
```jsp
<!-- ❌ 취약: 외부 입력값 검증 없이 출력 -->
검색어 : <%=keyword%>                          <!-- Reflected -->
검색결과 : ${m.content}                          <!-- Stored -->
document.write("keyword:" + <%=keyword%>);      <!-- DOM -->
```
```jsp
<!-- ✅ 안전 방법1: 문자 치환 -->
keyword = keyword.replaceAll("<", "&lt;").replaceAll(">", "&gt;"); ...
<!-- ✅ 안전 방법2: JSTL c:out -->
<c:out value="${m.content}"/>
<!-- ✅ 안전 방법3: 외부 라이브러리 -->
document.write("keyword:" + <%=Encoder.encodeForJS(Encoder.encodeForHTML(keyword))%>);
```

### C#
```csharp
// ❌ 취약: 외부 입력값 검증 없이 출력
string str = "ID : " + usrinput; Request.Write(str);
// ✅ 안전: AntiXss Sanitizer
var sanitizedStr = Sanitizer.GetSafeHtmlFragment(str); Request.Write(sanitizedStr);
```

### C
```c
// ❌ 취약: cgi에 검증 없이 출력
fprintf(cgiOut, "Print user input = %s<br/>", data);
// ✅ 안전: < > 위험 문자 검사 후 출력
if(strchr(p, '<')) return; if(strchr(p, '>')) return;
```

## 라. 진단방법

1. **①** 웹 페이지로 출력하는 변수값 존재 확인
2. **②** 해당 변수값이 외부 입력값 또는 입력 폼에 의해 저장된 DB 값인지 확인 후 필터 통과 여부 확인

> 적절한 필터를 거치거나 프레임워크 자체 검증이 있으면 안전, 그 외 취약. Stored XSS는 입력 폼으로 저장된 데이터 출력 시 취약, 메뉴 이름 등 사용자 수정 불가 DB 값은 안전.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// [Reflected] 외부 입력 target을 필터링 없이 output stream 출력 → 취약
String target = apApsCommonCodeVO.getTarget();
printWriter.print(target);
```
```jsp
<!-- [Reflected] escapeXml=false → 스크립트 실행 → 취약 -->
<c:out value="${param.name}" escapeXml="false" />
```
```jsp
<!-- [Reflected] <script> 공백 치환은 <sc<script>ript> 우회로 실행 → 취약 -->
param = param.replaceAll("<script>","").replaceAll("</script>","");
```
```jsp
<!-- [Reflected] getQueryString()로 URL 구성 후 출력 → 취약 -->
<input type="hidden" name="nextUrl" value="<%=nextUrl%>" />
```
```jsp
<!-- [Reflected] 주석 안 출력이나 --><script> 삽입으로 우회 → 취약 -->
<!-- <%=param%> -->
```
```jsp
<!-- [DOM] 외부 입력 name이 document.write 인자에 그대로 → 취약 -->
document.write("name:" + <%=name%> );
```
```jsp
<!-- [DOM] 필터링하나 ; % - 미필터 → ;) alert(document.cookie);<%-- 로 실행 → 취약 -->
name = name.replaceAll("<","&lt;")...; document.write("name:" + <%=name%> );
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```jsp
<!-- [Reflected] sendRedirect/location.href → URL 이동이라 미실행 → 안전 -->
<%=respose.sendRedirect(requst.getParameter("url"))%>
location.href('<%=request.getParameter("url")%>');
<!-- [Reflected] JSTL c:out / fn:escapeXml → 안전 -->
<c:out value="${param.name}"/>
${fn:escapeXml(param.name)}
```
```jsp
<!-- 문자형 아님(parseInt) / substring 길이제한 / 내부 정의값 / System.out / 미사용자입력 → 안전 -->
int pageNm = Integer.parseInt(request.getParameter("pageNm"));
String year = date.substring(0, 4);
System.out.println("exam_tgt_se : " + exam_tgt_se);
var iconStr = "<%= request.getRequestURL() %>";
```
```jsp
<!-- [Stored] 메뉴 이름 등 사용자 수정 불가 DB 값 출력 → 안전 (입력 폼 저장 데이터면 취약) -->
<p> 제목 : <%=board_contents%> </p>
```

## 마. 참고자료

- CWE-79 Cross-site Scripting, MITRE — http://cwe.mitre.org/data/definitions/79.html
- Properly encode or escape output (IDS51-J), CERT
- XSS Prevention Cheat Sheet / DOM based XSS Prevention Cheat Sheet, OWASP
- Understanding Malicious Content Mitigation for Web Developers — http://www.cert.org/tech_tips/malicious_code_mitigation.html

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: Reflected/Stored/DOM XSS · 문자치환(`< > & "` → `&lt; &gt; &amp; &quot;`) · JSTL c:out · escapeXml · 외부 XSS 라이브러리(Lucy/ESAPI/Java-Encoder) · 화이트리스트 태그 · `<script>` 중첩 우회
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
