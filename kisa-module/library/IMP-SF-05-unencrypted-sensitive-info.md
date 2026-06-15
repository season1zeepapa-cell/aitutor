# IMP-SF-05 · 암호화되지 않은 중요정보

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-312 (저장) / CWE-319 (전송)
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §5 암호화되지 않은 중요정보 (p.337–349)

## 가. 개요

많은 응용프로그램은 메모리·디스크에서 중요정보(개인정보, 인증정보, 금융정보 등)를 처리한다. 이 정보가 제대로 보호되지 않으면 보안·무결성을 잃을 수 있다. 특히 중요정보가 포함된 데이터를 **평문으로 송·수신하거나 저장**하면 인가되지 않은 사용자에게 노출된다.

## 나. 보안대책

- 개인정보(주민번호·여권번호), 금융정보(카드·계좌번호), 비밀번호 등은 저장·전송 시 **반드시 암호화**
- 중요정보 읽기·쓰기 시 **권한인증**으로 적합한 사용자만 접근
- 필요 시 **SSL·HTTPS 등 보안 채널** 사용
- 쿠키에 저장 시 보안속성 설정(예: `setSecure(true)`)

## 다. 코드예제

### Java (중요정보 평문저장)
```java
// ❌ 취약: 비밀번호를 평문으로 DB에 저장
stmt.setString(2, pwd);
stmt.executeUpdate();
```
```java
// ✅ 안전: 솔트 포함 SHA-256 해시로 변환 후 저장
MessageDigest md = MessageDigest.getInstance("SHA-256");
md.update(salt);
byte[] hashInBytes = md.digest(pwd.getBytes());
// ... %02x 로 hex 문자열 변환 후 저장
```

### C# (비밀번호 평문저장/출력)
```csharp
// ❌ 취약: 평문 비밀번호를 그대로 출력
var password = user.GetPassword();
Response.Write(password);
```
```csharp
// ✅ 안전: 암호화 처리, 출력하지 않음
var encrypetedPassword = user.GetPassword();
SecureFindPasswordFunction();
```

### Java (중요정보 평문전송)
```java
// ❌ 취약: 비밀번호 평문 소켓 전송 → 패킷 스니핑 노출
String password = getPassword();
o.write(password);
```
```java
// ✅ 안전: AES 암호화 후 전송
Cipher c = Cipher.getInstance("AES/CBC/PKCS5Padding");
byte[] encPassword = c.update(password.getBytes());
o.write(encPassword, 0, encPassword.length);
```

### C# (비밀번호 평문전송)
```csharp
// ❌ 취약: 평문 비밀번호를 메일 본문에 포함하여 전송
Message.Body = "Your password is: " + Server.HtmlEncode(password);
SmtpMail.Send(Message);
```
```csharp
// ✅ 안전: SHA256 해시 후 전송
data = new System.Security.Cryptography.SHA256Managed().ComputeHash(data);
```

### C (파일에서 읽은 비밀번호)
```c
// ❌ 취약: 파일에서 읽은 평문 비밀번호로 직접 DB 연결
fgets(passwd, sizeof(passwd), fp);
SQLConnect(hdbc, ..., (SQLCHAR*) passwd, (SQLSMALLINT) strlen(passwd));
```
```c
// ✅ 안전: 외부 키로 AES-CBC 암호화 후 사용
key = getenv("encrypt_key");
ncPasswd = CkCrypt2_encryptStringENC(crypt, passwd);
```

## 라. 진단방법

### 평문저장
1. 중요정보는 설계과정에서 결정 → 일반적 검사기법 없음. 저장·사용 시 **암호화·복호화** 과정 필수
2. 로그인·암호 사용 등 특정 경우 **메소드 인자 값 추적**으로 평문 유무 판단
3. 임시변수 저장 시에도 암호화 확인, **사용 완료 임시변수는 반드시 초기화**
4. 쿠키에는 중요정보를 저장하지 않거나 암호화하여 저장

### 평문전송
- 정적도구로 중요정보 기준 판단은 어려움
- 민감정보를 네트워크 전송 시 **암호화 여부·보안 채널 이용 여부** 확인
- 쿠키 전송 시 `setSecure(true)`로 암호화. 이러한 절차가 생략되면 취약 판단

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```c
// 전달받은 암호를 암호화 없이 파일에 직접 기록 → 취약
while ((n=read(sock,buffer,BUFSIZE-1))!=-1) {
  write(passFileD,password_buffer,n);
}
```
```xml
<!-- 설정파일에 DB 비밀번호 평문 저장 → 취약 -->
<add name="ud_DEV" connectionString="...; pwd=password; ..." />
```
```java
// 외부 비밀번호를 암호화 없이 소켓 전송 → 취약
String password = getPassword();
out.write(password);
```
```java
// 중요정보 URL을 http 일반 채널로 연결 → 취약
URL u = new URL("http://www.secret.example.org/");
HttpURLConnection hu = (HttpURLConnection) u.openConnection();
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

_원문에 해당 항목 없음._

## 마. 참고자료

- CWE-312 Cleartext Storage of Sensitive Information, MITRE — http://cwe.mitre.org/data/definitions/312.html
- CWE-319 Cleartext Transmission of Sensitive Information, MITRE — http://cwe.mitre.org/data/definitions/319.html
- CERT (MEM03-C / MSC18-C / MSC03-J / FIO52-J) / OWASP (Password Plaintext Storage, Insecure Transport)

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 평문저장 · 평문전송 · 암호화 · SHA-256 해시 · 솔트 · AES · 보안 채널(SSL/HTTPS) · `setSecure(true)` · 임시변수 초기화 · 패킷 스니핑
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "평문저장·전송 취약 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
