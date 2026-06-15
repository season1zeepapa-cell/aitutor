# IMP-IV-01 · SQL 삽입 (SQL Injection)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-89
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §1 SQL 삽입 (p.180–193)

## 가. 개요

데이터베이스(DB)와 연동된 웹 응용프로그램에서 입력 데이터의 유효성을 검증하지 않으면, 공격자가 입력 폼·URL 입력란에 SQL 문을 삽입하여 DB 정보를 열람·조작할 수 있다. 사용자 입력값을 필터링 없이 **동적쿼리(Dynamic Query)** 생성에 사용하면 의도하지 않은 쿼리가 만들어져 정보유출에 악용된다.

## 나. 보안대책

- **PreparedStatement** 객체로 컴파일된 쿼리문(상수)을 DB에 전달
- 외부입력값에 대해 **특수문자·쿼리 예약어 필터링**
- Struts·Spring 등 프레임워크 사용 시 외부입력값 검증모듈·보안모듈을 적절히 적용

## 다. 코드예제

### Java (JDBC)
공격 예: `gubun` 에 `a' or 'a' = 'a` 입력 → 조건절이 `b_gubun = 'a' or 'a' = 'a'` 로 바뀌어 board 전체 조회.

```java
// ❌ 취약: 외부 입력값을 검증 없이 문자열 연결
String gubun = request.getParameter("gubun");
String sql = "SELECT * FROM board WHERE b_gubun = '" + gubun + "'";
Statement stmt = con.createStatement();
ResultSet rs = stmt.executeQuery(sql);
```
```java
// ✅ 안전: ? 바인딩 + setString
String sql = "SELECT * FROM board WHERE b_gubun = ?";
PreparedStatement pstmt = con.prepareStatement(sql);
pstmt.setString(1, gubun);
ResultSet rs = pstmt.executeQuery();
```

### Java (MyBatis)
```xml
<!-- ❌ 취약: ${} 는 문자열 결합 -->
select * from tbl_board where title like '%${keyword}%' order by pos asc
<!-- ✅ 안전: #{} 는 바인딩 -->
select * from tbl_board where title like '%'||#{keyword}||'%' order by pos asc
```

### Java (Hibernate)
```java
// ❌ 취약: 파라미터 바인딩 없이 문자열 연결
Query query = session.createQuery("from Student where studentName = '" + name + "'");

// ✅ 안전 (방식1): ? 위치 파라미터
Query query = session.createQuery("from Student where studentName = ?");
query.setString(0, name);

// ✅ 안전 (방식2): :name 명명 파라미터
Query query = session.createQuery("from Student where studentName = :name");
query.setParameter("name", name);
```

### C#
```csharp
// ❌ 취약: 외부 입력값 직접 연결
string query = "Select * From Products Where ProductID = " + usrinput;

// ✅ 안전: @ 파라미터 바인딩
string query = "Select * From Products Where ProductID = @ProductID";
cmd.Parameters.AddWithValue("@ProductID", Convert.ToInt32(Request["ProductID"]));
```

## 라. 진단방법

1. **①** Statement 객체로 쿼리가 실행되는 부분 확인
2. **②** 해당 객체가 PreparedStatement 인지 확인
3. **③** PreparedStatement + setString 이면 기본 안전 판정. 단, 쿼리 변수가 외부 입력값이면 **필터링 모듈 존재 여부를 추가 확인**

> 쿼리 생성 관련 외부 입력값에 대한 필터링 모듈이 반드시 존재하거나 프레임워크가 적절히 조치할 때 안전 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// PreparedStatement 지만 상수 아닌 동적 문자열 생성 → 취약
String query = "SELECT * FROM " + tableName + " WHERE Name = '" + name + "'";
stmt = con.prepareStatement(query);
rs = stmt.executeQuery();
```
```java
// 외부 입력 pid 가 where 절 문자열로 연결되어 실행 → 취약
commentDao.getProjectCommentTblByWhere("where projectid=" + pid + " ...");
// DAO 내부: sql_ += " " + where; → template_.query(sql_, ...)
```
```xml
<!-- mybatis $name$ → ' OR 'x'='x 전달 시 전체 삭제 → 취약 -->
DELETE STUDENTS WHERE NUM = #num# AND NAME = '$name$'
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// ? 바인딩 + setString → 안전
Query query = session.createQuery("from Student where studentName = ?");
query.setString(0, name);
```
```java
// :name 바인딩 → 안전
Query query = session.createQuery("from Student where studentName = :name");
query.setParameter("name", name);
```

## 마. 참고자료

- CWE-89 SQL Injection, MITRE — http://cwe.mitre.org/data/definitions/89.html
- SQL Injection, Microsoft / CERT (IDS00-J) / OWASP Cheat Sheet

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: PreparedStatement · 파라미터 바인딩 · setString · 동적쿼리 · MyBatis `#` 기호 · 특수문자/예약어 필터링 · 화이트리스트 검증
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
