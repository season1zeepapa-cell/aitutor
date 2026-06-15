# IMP-IV-03 · 경로 조작 및 자원 삽입 (Path Traversal)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-22
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §3 경로 조작 및 자원 삽입 (p.201–210)

## 가. 개요

검증되지 않은 외부입력값으로 파일·서버 등 시스템 자원에 대한 **접근·식별을 허용**하면, 입력값 조작으로 시스템이 보호하는 자원에 임의로 접근할 수 있다. 공격자는 자원의 수정·삭제, 시스템 정보누출, 자원 간 충돌로 인한 서비스 장애 등을 유발할 수 있고, 허용되지 않은 권한을 획득하여 설정 파일을 변경·실행시킬 수 있다.

## 나. 보안대책

- 외부 입력을 자원(파일·소켓 포트 등)의 식별자로 사용할 때 **적절한 검증** 또는 **사전 정의된 리스트에서 선택**
- 외부 입력이 파일명인 경우 **경로 순회(directory traversal) 문자( / \\ .. 등 ) 제거 필터** 사용

## 다. 코드예제

### Java (파일 다운로드)
공격자가 P에 `../../../rootFile.txt` 전달 시 의도하지 않은 파일이 버퍼에 쓰인다.

```java
// ❌ 취약: 외부 입력값을 검증 없이 파일 경로에 사용
String fileName = request.getParameter("P");
fis = new FileInputStream("C:/datas/" + fileName);
```
```java
// ✅ 안전: 경로순회 문자열(. / \) 제거 후 사용
filename = filename.replaceAll("\\.", "").replaceAll("/", "").replaceAll("\\\\", "");
fis = new FileInputStream("C:/datas/" + fileName);
```

### Java (도움말 파일 읽기)
`args[0]` 에 `..\..\..\windows\system32\drivers\etc\hosts` 입력 시 제한 경로 열람 가능.

```java
// ❌ 취약: safeDir + helpFile 그대로 사용
try (BufferedReader br = new BufferedReader(new FileReader(safeDir + helpFile))) { ... }
// ✅ 안전: null 체크 + 경로조작 문자열 제거
if (helpFile != null) { helpFile = helpFile.replaceAll("\\.{2,}[/\\\\]", ""); }
```

### C#
```csharp
// ❌ 취약: 외부 입력값을 검증 없이 File.Delete
string file = Request.QueryString["path"];
if (file != null) { File.Delete(file); }
// ✅ 안전: 경로조작 문자(\ /) 포함 여부 확인
if (file.IndexOf('\\') > -1 || file.IndexOf('/') > -1) { Response.Write("Path Traversal Attack"); }
else { File.Delete(file); }
```

### C
```c
// ❌ 취약: 환경변수 reportfile을 그대로 fopen
char* filename = getenv("reportfile");
fin = fopen(filename, "r");
// ✅ 안전: 정규식 ".*\.\..*" 로 경로 조작 문자열 탐지 후 사용
ret = regcomp(&regex, ".*\\.\\..*", 0);
ret = regexec(&regex, filename, 0, NULL, 0);
```

## 라. 진단방법

**[경로 조작]**
1. **①** 파일객체 사용 여부 확인
2. **②** 파일 접근이 외부에서 직접 접근하는지 확인 — 경로 순회 문자열 제거 없이 사용되면 취약

**[자원 삽입]**
1. **①** 파일명·소켓 포트 등 자원 사용 여부 확인
2. **②** 외부 직접 접근인지 확인 — 매핑표·리스트로 선택하면 안전, 그 외 취약

> 시스템 경로는 직접 입력 대신 `getRealPath()`·`getContextPath()` 등 시스템 함수 사용이 바람직.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 경로순회 문자 필터링했으나 getRealPath("/") 컨텍스트 경로 접근 가능 → 취약
filePath = filePath.replaceAll("\\.", "").replaceAll("/", "").replaceAll("\\\\", "");
String targetFile = getServletContext().getRealPath("/") + filePath;
```
```java
// 외부 입력값 source를 static cmprsFile에 전달 → File 생성 → 취약
isCompressed = EgovFileCmprs.cmprsFile(source, target);
// cmprsFile 내부: File srcFile = new File(source1);
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// getRealPath() 내부 함수로 경로 구성 → 안전
File file = new File(getServletContext().getRealPath("/")+ "/jsp/.../"+...);
```
```java
// 시스템 프로퍼티(is.OrgCode) 기반 필터 → 안전
// (단, 개별 사용 프로퍼티는 정탐 / 시스템 프로퍼티는 오탐)
String org_code = SystemierConfig.getPropertiesBean().getProperty("is.OrgCode");
```

## 마. 참고자료

- CWE-99 Resource Injection, MITRE — http://cwe.mitre.org/data/definitions/99.html
- CWE-22 Path Traversal, MITRE — http://cwe.mitre.org/data/definitions/22.html
- Path Traversal, OWASP — https://www.owasp.org/index.php/Path_Traversal

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 경로순회(directory traversal) · 경로조작 문자열(/ \\ ..) · 화이트리스트/매핑표 · getRealPath/getContextPath · 시스템 함수 · 필터링 · 자원 식별자 검증
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
