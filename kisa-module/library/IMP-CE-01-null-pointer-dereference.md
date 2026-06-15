# IMP-CE-01 · Null Pointer 역참조

> **단계** 구현 · **분류** 코드오류 · **CWE** CWE-476
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §1 Null Pointer 역참조 (p.433–444)

## 가. 개요

널 포인터(Null Pointer) 역참조는 **'그 객체가 널(Null)이 될 수 없다'는 가정을 위반**했을 때 발생한다. 공격자가 의도적으로 널 포인터 역참조를 발생시키면, 그 결과 발생하는 예외 상황을 추후 공격 계획에 사용할 수 있다.

## 나. 보안대책

- 널이 될 수 있는 레퍼런스는 **참조하기 전에 널 값인지 검사**하여 안전한 경우에만 사용

## 다. 코드예제

### Java — cardinality
```java
// ❌ 취약: obj가 null이고 elt가 null이 아니면 null.equals → 역참조
if ((null == obj && null == elt) || obj.equals(elt)) { count++; }
```
```java
// ✅ 안전: obj가 null이 아닌 경우에만 obj.equals 실행
if ((null == obj && null == elt) || (null != obj && obj.equals(elt))) { count++; }
```

### Java — request 파라미터
```java
// ❌ 취약: url 이 null 이면 역참조
String url = reuqest.getParamter("url");
if (url.equals(""))
```
```java
// ✅ 안전: null 검사 후 사용
if ( url != null || url.equals("") )
```

### C#
```csharp
// ❌ 취약: QueryString["name"]이 null 이면 역참조
string username = Request.QueryString["name"];
if (username.Length > 20) { }
```
```csharp
// ✅ 안전: null 검사 후 참조
if ( username != null && username > 20) { }
```

### C
```c
// ❌ 취약: IntegerAddressReturn()이 0 반환 시 p 역참조
int *p = IntegerAddressReturn();
*p = count;
```
```c
// ✅ 안전: 참조 전 null 검사
int *p = IntegerAddressReturn();
If(p != 0) *p = count;
```

## 라. 진단방법

1. **①** 표현된 객체가 널 값이 될 수 있는지 확인. 널 체크 후 예외 처리하면 안전, 널 체크 없으면 취약 판정

> **널 가능성 판단 기준**: 초기값이 널인 값 · 선언 후 객체 미생성 값 · 널 객체로 필드 접근/메소드 호출한 결과 값 · Nullable 객체 연산 결과 값

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 널 체크 없이 cmd.trim() 호출 → 취약
String cmd = System.getProperty("cmd");
cmd = cmd.trim(); //①
```
```java
// vmrs를 null로 초기화 후 분기로 미초기화 상태에서 vmrs 참조 → 취약
VMResultSet vmrs = null;
if(rValue > 0) { vmrs = dao.listGoodKnowQuestion(con, model); vmrs.setMessage(...); }
else { vmrs.setMessage(...); }   // vmrs == null
```
```java
// Statement null 초기화 후 prepareStatement 전 예외 → finally의 statement.close() 역참조 → 취약
PreparedStatement statement = null;
...
} finally { try { statement.close(); } catch (Exception e1) {} }
```
```java
// enter2br()이 null 리턴 가능 → strContent.equals 역참조 → 취약
String strContent = UTIL.enter2br((String)hsROW.get("content"));
if (!strContent.equals("")) { ... }
```
```java
// 조건문 순서 오류: null 객체 참조(str.length())를 null 검사보다 먼저 → 취약
if ( str.length() == 0 || str == null )
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 설계상 null을 리턴하지 않는 StringTokenizer → 안전
StringTokenizer st = new StringTokenizer(info_url,"?");
while (st.hasMoreTokens()) { ... }
```
```java
// catch에서 throw → 이후 코드 미실행 → 안전
} catch (ParseException e) { throw new Exception(e); }
System.out.println("After Throw 1");   // 미실행
```
```java
// date1 null이면 days1에서 이미 역참조 → days2 미실행 → 추가 역참조 없음
int days1 = (int)((date1.getTime()/100000)/24);
int days2 = (int)((date1.getTime()/100000)/24);   // 미도달
```
```java
// 단락 평가: a == null 참이면 a.length() 미평가 → 안전
if (a == null || a.length() == 0) { }
```
```java
// catch에서 return → f.write() 미실행 → 안전
try { f = new FileOutputStream("toctou"); f.write(); }
catch (FileNotFoundException e) { e.printStackTrace(); }
```
```jsp
<!-- JSP 내장 객체 pageContext 참조 → 안전 -->
onclick="location.href='${pageContext.request.contextPath}/...'"
```
```java
// Integer static 함수 호출 → Integer는 객체 아님 → 안전
Integer.parseInt(stringValue);
```
```java
// Data Flow 밖 단일 함수의 파라미터 null → 호출 측 책임 → 오탐 주의
public SmsConnection sendRequsest(SmsConnection smsConn) throws Exception { ... }
```
```java
// JRE 기본 생성자는 null 반환 명시 없으면 null로 보지 않음 → 안전
if(infoList == null) infoList = new ArrayList();
```

## 마. 참고자료

- CWE-476 NULL Pointer Dereference, MITRE — http://cwe.mitre.org/data/definitions/476.html
- Do not dereference null pointers (EXP34-C), CERT
- Null Dereference, OWASP — https://www.owasp.org/index.php/Null_Dereference

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 널 포인터 역참조 · null 검사 · 단락 평가(short-circuit) · 조건문 순서 · null 초기화 · Nullable 객체 · 참조 전 검사
- **객관형 시드**: vulnerable/safe 또는 정탐/오탐 코드 제시 → "널 포인터 역참조 발생 여부" / "취약·안전 판정"
- **서술형 시드**: 정탐/오탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
