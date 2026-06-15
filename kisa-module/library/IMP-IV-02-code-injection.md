# IMP-IV-02 · 코드 삽입 (Code Injection)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-94
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §2 코드삽입 (p.194–200)

## 가. 개요

공격자가 소프트웨어의 의도된 동작을 변경하도록 **임의 코드를 삽입**하여 소프트웨어가 비정상적으로 동작하도록 하는 보안약점이다. 코드 삽입은 **프로그래밍 언어 자체의 기능에 의해서만 제한**된다는 점에서 운영체제 명령어 삽입과 다르다. 사용자 입력 값에 코드가 포함되는 것을 허용하면 공격자는 의도하지 않은 코드를 실행하여 권한 탈취·인증 우회·시스템 명령어 실행 등을 할 수 있다.

## 나. 보안대책

- **동적코드를 실행할 수 있는 함수를 사용하지 않는다**
- 필요 시 실행 가능한 동적코드를 입력 값으로 받지 않도록 외부 입력 값을 **화이트리스트 방식**으로 구현
- 유효한 문자만 포함하도록 동적 코드에 사용되는 사용자 입력 값을 **필터링**

## 다. 코드예제

### Java (ScriptEngine eval)
javax.script.ScriptEngineManager의 eval로 사용자 입력을 실행하면 공격자가 새 파일을 만들거나 덮어쓸 수 있다.

```java
// ❌ 취약: 외부 입력값 src를 eval로 실행
ScriptEngine scriptEngine = scriptEngineManager.getEngineByName("javascript");
String retValue = (String)scriptEngine.eval(src);
```
```java
// ✅ 안전: 정규식으로 특수문자 입력 시 예외 발생
if (src.matches("[\\w]*") == false) {
    throw new IllegalArgumentException();
}
String retValue = (String)scriptEngine.eval(src);
```

### JSP (new Function)
```jsp
<!-- ❌ 취약: 외부 입력값 name을 new Function()으로 함수 실행 -->
String name = request.getparameter("name");
<script>
(new Function(<%=name%>))();
</script>
```

### Java (화이트리스트)
```java
// ✅ 안전: 유효한 문자인 경우에만 실행, 그 외 예외 처리
if (src.matches("UNDER_BAR") == true) { ... }
else if (src.matches("DOLLAR") == true) { ... }
else { throw new IllegalArgumentException(); }
```

## 라. 진단방법

1. **①** 각 언어에서 제공하는 **동적실행 함수**(eval 등) 확인
2. **②** 동적코드 실행에 사용되는 데이터가 신뢰할 수 있는 값인지 확인

> 데이터가 신뢰할 수 없는 값이거나 별도의 검증절차가 없으면 취약 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// eval 실행코드 데이터 name이 사용자 입력값 → 취약
engine.eval("print('" + name + "')");
// ...
ACC.executeScript(name);
```
```php
// PHP eval: arg 파라미터 사전 검증 없이 실행 → 취약
$x = $_GET['arg'];
eval('$myvar = ' . $x . ';');
// /vul.php?arg=1;phpinfo() 등 삽입코드 실행 가능
```
```php
// 사용자 메시지를 파일에 저장 후 include로 실행 → 취약
fwrite($handle, "<b>$name</b> says '$message'<hr>\n");
// ...
include($MessageFile);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```php
// eval 전 preg_replace로 위험 기호 제거 → 안전
$x=preg_replace("/[w\\^a-z0-9]/i", "", $x);
eval("\$myvar = \$x;");
```
```java
// Filter.filterScript로 알파벳·숫자·'_'만 허용 검증 → 안전
if (!Filter.filterScript(name)) { throw new IllegalArgumentException(); }
engine.eval("print('" + name + "')");
```
```javascript
// 동적함수 eval 사용하나 외부 입력값 미실행 → 안전
for(var i = 0; i < 5; i++){ eval("obj.test" + i + "=" + i); }
```

## 마. 참고자료

- CWE-94 Improper Control of Generation of Code ('Code Injection'), MITRE — http://cwe.mitre.org/data/definitions/94.html
- CWE-95 Eval Injection, MITRE — http://cwe.mitre.org/data/definitions/95.html
- Code Injection Software Attack, OWASP — https://owasp.org/www-community/attacks/Code_Injection

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 동적실행 함수 · eval · ScriptEngine · new Function · 화이트리스트 · 특수문자 필터링 · 정규식 검증
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
