# XML 삽입 (COURSE-IMP-IV-09)

> 2025년 SW보안약점 진단원 기본(양성)과정 · Ⅴ. 구현 단계 보안약점 진단 · 입력데이터 검증 및 표현 · 1-9 (pp.333-340)

## 요약
외부입력값을 검증하지 않고 XQuery 또는 XPath 구문 생성 및 실행에 사용하면 발생한다. 입력값을 조작하여 쿼리문을 조작할 수 있으며, 조작된 쿼리문은 데이터 무단 조회 및 인증 절차 우회 취약점을 유발한다. 특수문자·예약어 필터링과 파라미터화된 쿼리(bindString, 변수 바인딩) 사용이 대책이다.

## 개요 — 정의와 위협
- 정의: 외부입력값을 검증하지 않고 XQuery 또는 XPath 구문 생성 및 실행에 사용하는 경우 발생한다.
- 위협: 입력값을 조작하여 쿼리문을 조작할 수 있으며, 조작된 쿼리문은 데이터 무단 조회 및 인증 절차 우회와 같은 취약점을 유발할 수 있다.

## 보안대책
- XQuery에 사용되는 외부입력값에 대하여 특수문자 및 쿼리 예약어를 필터링한다.
- XQuery를 사용한 쿼리문은 문자열을 연결하는 형태로 구성하지 않고 파라미터화된 쿼리문을 사용한다.
- XPath 쿼리에 사용되는 외부입력값에 대하여 특수문자( `" [ ] / = @` 등 ) 및 쿼리 예약어를 필터링한다.
- 파라미터화된 쿼리문을 지원하는 XQuery 표현식을 사용한다.
- 진단 흐름: XQuery·XPath 사용 확인 → 외부입력값을 XQuery·XPath 변수에 사용 여부 → 미사용 시 안전, 사용 시 필터링 모듈 존재 여부에 따라 안전/위험.

## XQuery — 안전하지 않은 코드 vs 안전한 코드
- 안전하지 않은 코드: 입력값 name을 검증 없이 XQuery 표현식에 문자열로 연결한다. `doc('users.xml')/userlist/user[uname='"+name+"']` — 외부 입력값에 의해 쿼리 구조가 변경되어 안전하지 않다.
- 안전한 코드: 표현식에 `$xname` 변수를 두고 prepareExpression으로 준비한 뒤 `bindString(new QName("xname"), name, null)`으로 값을 바인딩한다.
- bindString 함수로 쿼리 구조가 변경되는 것을 방지한다(파라미터화).

## XPath — 안전하지 않은 코드 vs 안전한 코드(필터링)
- 안전하지 않은 코드: 외부 입력값 nm, pw를 문자열 연결로 XPathExpression에 사용한다. `//users/user[login/text()='"+nm+"' and password/text()='"+pw+"']/home_dir/text()` — 검증되지 않은 입력값으로 안전하지 않은 질의문이 작성된다.
- 안전한 코드: `XPathFilter` 함수로 XPath 삽입을 유발할 수 있는 문자(`input.replaceAll("[',\\[]", "")`)를 제거한 nm, pw를 사용하여 쿼리문을 생성하므로 안전하다.

## XPath Injection 방지 — 파라미터화된 XQuery(.xq) 사용
- `login.xq` 파일에 `declare variable $loginID as xs:string external;` 등 외부 변수를 선언하고 `//users/user[@loginID=$loginID and @password=$password]` 형태로 파라미터화한다.
- 파라미터화된 쿼리가 담긴 login.xq를 읽어 XQuery를 생성하고, vars 맵에 loginID·password 값을 put 하여 execute 한다.
- 문자열 연결이 아닌 변수 바인딩으로 XPath Injection을 방지한다.

## XPath — 커맨드 입력값 필터링 예
- 안전하지 않은 코드: 커맨드 옵션 입력값 name을 검증 없이 `//food[name='"+name+"']/price` XPath 구문 생성·실행에 사용한다.
- 안전한 코드: 프로그램의 커맨드 옵션으로 입력되는 외부값 name에서 XPath 구문을 조작할 수 있는 문자를 제거(`name.replaceAll("[()\\-'\\[\\]:,*/]", "")`)하는 검증을 수행하여 안전하다.

## 핵심 개념
- **XML 삽입(XML Injection)**: 외부입력값을 검증 없이 XQuery·XPath 구문 생성·실행에 사용해 쿼리 구조를 조작당하는 보안약점. 데이터 무단 조회·인증 우회 유발.
- **파라미터화된 쿼리(XQuery)**: 쿼리에 변수(`$xname`, `$loginID` 등)를 두고 bindString·변수 바인딩으로 값을 주입해 입력값이 쿼리 구조를 변경하지 못하게 하는 기법.
- **XPath 특수문자 필터링**: XPath 삽입을 유발할 수 있는 특수문자(`" [ ] / = @ ' ( ) - : , *` 등)와 쿼리 예약어를 입력값에서 제거하는 대책.

## 시험 포인트
- XML 삽입은 외부입력값을 검증 없이 XQuery·XPath 구문 생성·실행에 사용할 때 발생 → 데이터 무단 조회·인증 우회.
- 대책: 특수문자·예약어 필터링 + 파라미터화된 쿼리 사용(문자열 연결 금지).
- XQuery 안전 코드는 `$변수` + prepareExpression + `bindString(QName)`으로 값 바인딩.
- XPath 필터링 특수문자 예: `" [ ] / = @`, 코드에서는 `' [` 제거 또는 `( ) - ' [ ] : , * /` 제거.
- login.xq처럼 외부 변수를 선언한 파라미터화된 XQuery 파일을 vars 맵으로 실행하여 Injection 방지.
