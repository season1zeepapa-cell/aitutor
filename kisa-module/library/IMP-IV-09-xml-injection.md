# IMP-IV-09 · XML 삽입 (XML Injection)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-91
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §9 XML 삽입 (p.251–263)

## 가. 개요

검증되지 않은 외부 입력 값이 **XQuery 또는 XPath 쿼리문**을 생성하는 문자열로 사용되어, 공격자가 쿼리문 구조를 임의로 변경하고 임의의 쿼리를 실행하여 **허가되지 않은 데이터 열람·인증 절차 우회**가 가능한 보안약점이다.

## 나. 보안대책

- XQuery/XPath 쿼리에 쓰이는 외부 입력데이터에 대해 **특수문자·쿼리 예약어 필터링**
- **파라미터화된 쿼리문을 지원하는 XQuery** 사용

## 다. 코드예제

### Java (XQuery)
공격 예: `name` 에 `something' or '1'='1` → `[uname='something' or '1'='1']` 로 전체 출력.

```java
// ❌ 취약: 외부 입력값을 XQuery 문자열에 연결
String es = "doc('users.xml')/userlist/user[uname='"+name+"']";
XQPreparedExpression expr = conn.prepareExpression(es);
```
```java
// ✅ 안전: bindString 으로 파라미터 바인딩
String es = "doc('users.xml')/userlist/user[uname='$xname']";
XQPreparedExpression expr = conn.prepareExpression(es);
expr.bindString(new QName("xname"), name, null);
```

### C# (XQuery)
```csharp
// ❌ 취약: 외부 입력값으로 XQuery 문 조립 → 검증 없이 접근
String squery = "for $user in doc(users.xml)//user[username='" + UserTextBox.Text + "'and pass='" + PwdTextBox.Text + "'] return $user";
```
```csharp
// ✅ 안전: 문자열 필터링으로 위험 문자 제거
string validatedQuery = squery.Replace('/','*');
```

### Java (XPath)
공격 예: nm=`tester`, pw=`x' or 'x'='x` → 인증 우회 로그인.

```java
// ❌ 취약: 외부 입력값을 XPath compile 문자열에 연결
XPathExpression expr = xpath.compile("//users/user[login/text()='"+nm+"' and password/text()='"+pw+"']/home_dir/text()");
```
```java
// ✅ 안전: 파라미터화된 XQuery(login.xq) 사용
// login.xq: declare variable $loginID as xs:string external; ... [@loginID=$loginID and @password=$password]
XQuery xquery = new XQueryFactory().createXQuery(new File("login.xq"));
Map vars = new HashMap();
vars.put("loginID", nm);
vars.put("password", pw);
Nodes results = xquery.execute(doc, null, vars).toNodes();
```

### Java (XPath - 문자열 필터링)
공격 예: `any' or 'a' = 'a` → `//food[name='any' or 'a' = 'a']/price` 전체 조회.

```java
// ❌ 취약: 외부 입력값 name 을 XPath 에 직접 사용
NodeList nodes = (NodeList) xpath.evaluate("//food[name='" + name + "']/price", doc, XPathConstants.NODESET);
```
```java
// ✅ 안전: 조작 가능 문자 제거 후 사용
if (name != null) name = name.replaceAll("[()\\-'\\[\\]:,*/]", "");
```

### C# (XPath)
```csharp
// ❌ 취약: 외부 입력값을 검증 없이 XPath 식에 사용
StringBuffer sb = new StringBuffer("/accounts/account[acctID='");
sb.Append(acctID); sb.Append("']/email/text()");
nav.Evaluate(sb.ToString());
```
```csharp
// ✅ 안전: XPathExpression + DynamicContext 변수 바인딩
string xpath = "/accounts/account[@acctID=$acctID]/email/text()";
XPathExpression expr = DynamicContext.Compile(xpath);
DynamicContext ctx = new DynamicContext();
ctx.AddVariable("acctID", AccountIDTextBox.Text);
expr.SetContext(ctx);
```

## 라. 진단방법

- **XQuery 삽입**: XQuery 실행 부분 확인(①) → 쿼리스트링 변수가 외부 입력값인지 확인(②) → 필터링 모듈 존재 여부 확인. 필터링/프레임워크 조치 시 안전.
- **XPath 삽입**: XPath 객체로 쿼리 스트링이 컴파일되는 부분 확인(①) → 변수가 외부 입력값인지 확인(②) → 필터링 모듈 존재 여부 확인. 필터링/프레임워크 조치 시 안전.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 외부 입력 name 을 XQuery executeQuery 인자에 연결 → 취약
String name = props.getProperty("name");
String es = "doc('users.xml')/userlist/user[uname='" + name + "']";
XQPreparedExpression expr = conn.prepareExpression(es);
XQResultSequence result = expr.executeQuery();
```
```java
// 외부 입력 name, passwd 를 XPath compile 에 연결 → 인증 우회 가능 → 취약
XPathExpression expr = xpath.compile("//users/user[login/text()='" + name + "' and password/text() = '" + passwd + "']/home_dir/text()");
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문 진단방법에 별도 오탐코드 예제 없음. 안전 사례는 코드예제의 ✅(bindString, 파라미터화 XQuery, 문자 필터링, DynamicContext) 참고.

## 마. 참고자료

- CWE-652 XQuery Injection / CWE-643 XPath Injection, MITRE
- Prevent XML Injection (IDS16-J) / Prevent XPath Injection (IDS53-J), CERT
- XPATH Injection, OWASP — https://www.owasp.org/index.php/XPATH_Injection

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: XQuery 파라미터화 · bindString · XPath compile · 특수문자/예약어 필터링 · 파라미터화된 쿼리(login.xq) · DynamicContext.AddVariable · 인증 우회 · replaceAll 문자 제거
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
