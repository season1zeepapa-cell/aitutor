# IMP-IV-05 · 운영체제 명령어 삽입 (OS Command Injection)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-78
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §5 운영체제 명령어 삽입 (p.223–231)

## 가. 개요

적절한 검증절차를 거치지 않은 사용자 입력값이 **운영체제 명령어의 일부 또는 전부**로 구성되어 실행되면, 의도하지 않은 시스템 명령어가 실행되어 권한이 부적절하게 변경되거나 시스템 운영에 악영향을 미친다. 명령어 라인 파라미터·스트림 입력 등 외부 입력은 신뢰할 수 없으므로 적절히 처리하지 않으면 공격자가 원하는 명령어 실행이 가능하다.

## 나. 보안대책

- 웹 인터페이스로 서버 내부에 시스템 명령어를 전달시키지 않도록 응용프로그램 구성
- 외부에서 전달되는 값을 **검증 없이 시스템 내부 명령어로 사용하지 않음**
- 명령어 생성·선택이 필요하면 필요한 값들을 **미리 지정해 놓고 외부 입력에 따라 선택**

## 다. 코드예제

### Java (exec 화이트리스트)
```java
// ❌ 취약: 실행 프로그램 제한 없이 args[0] 실행
String cmd = args[0];
ps = Runtime.getRuntime().exec(cmd);
```
```java
// ✅ 안전: allowedCommands 화이트리스트로 제한
List<String> allowedCommands = new ArrayList<String>();
allowedCommands.add("notepad"); allowedCommands.add("calc");
if (!allowedCommands.contains(cmd)) { return; }
ps = Runtime.getRuntime().exec(cmd);
```

### Java (특수문자 필터링)
```java
// ❌ 취약: 외부 입력 date를 검증 없이 명령어에 결합
Runtime.getRuntime().exec(command + date);
// ✅ 안전: | ; & : > 우회문자 제거 후 사용
date = date.replaceAll("|","").replaceAll(";","").replaceAll("&","").replaceAll(":","").replaceAll(">","");
```

### C#
```csharp
// ❌ 취약: 외부 입력값을 실행 파일명으로 직접 사용
proStartInfo.FileName = fileName; Process.Start(proStartInfo);
// ✅ 안전: 정규식 검증 후 실행
if (Regex.IsMatch(fileName, "properRegexHere")) { ... Process.Start(proStartInfo); }
```

### C
```c
// ❌ 취약: 외부 입력을 검증 없이 system()
snprintf(cmd, CMD_LENGTH, "cat %s", cmd_data); system(cmd);
// ✅ 안전: | & ; : > 특수문자 존재 시 차단
if (cmd_data[i] == '|' || ... || cmd_data[i] == '>') { return -1; }
```

## 라. 진단방법

1. **①** 운영체제 명령어 실행 함수(`exec()`, `system()`, `Runtime.getRuntime().exec` 등) 호출 여부 확인
2. **②** 외부에서 전달되는 값이 시스템 내부명령어의 일부/전부로 사용되는지 확인

> 후보군에서 선택된 값(White List)이거나 적절히 검증하면 안전, 그 외 취약. 시스템 프로퍼티가 아닌 **개별 사용 프로퍼티**는 취약, **시스템 프로퍼티** 사용은 안전.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 외부 입력 processNm으로 execStr 구성 후 exec → 취약
String execStr = "tasklist /fo table /nh /fi \"imagename eq "+processNm+"\"";
p = Runtime.getRuntime().exec(execStr);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// 시스템 Property에서 cmdStr 획득 후 명령어 사용 → 안전 (개별 프로퍼티였다면 취약)
String cmdStr = EgovProperties.getPathProperty(Globals.SERVER_CONF_PATH, "SHELL."+Globals.OS_TYPE+".getMoryInfo");
p = Runtime.getRuntime().exec(command);
```
```java
// fname은 srcFile.getName() 결과(파일명)라 file separator/".." 없음 → 안전
String fname = srcFile.getName();
String[] command = {cmdStr..., parentPath..., fname};
p = Runtime.getRuntime().exec(command);
```

## 마. 참고자료

- CWE-78 OS Command Injection, MITRE — http://cwe.mitre.org/data/definitions/78.html
- Sanitize untrusted data passed to the Runtime.exec() method (IDS07-J), CERT
- Do not call system(), CERT
- Reviewing Code for OS Injection, OWASP — https://www.owasp.org/index.php/Reviewing_Code_for_OS_Injection

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: `Runtime.getRuntime().exec`/`system`/`exec` · 화이트리스트(allowedCommands) · 멀티라인 특수문자(`| ; & :`) · 파일 리다이렉트 특수문자(`> >>`) · 정규식 검증 · 시스템 프로퍼티 vs 개별 프로퍼티
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
