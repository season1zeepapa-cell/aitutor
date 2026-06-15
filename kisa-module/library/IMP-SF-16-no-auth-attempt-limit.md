# IMP-SF-16 · 반복된 인증시도 제한 기능 부재

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-307
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §16 반복된 인증시도 제한 기능 부재 (p.400–405)

## 가. 개요

일정 시간 내에 여러 번의 인증을 시도하여도 계정잠금 또는 추가 인증 방법 등의 충분한 조치가 수행되지 않는 경우, 공격자는 예상 ID와 비밀번호들을 사전(Dictionary)으로 만들고 무차별 대입(brute force)하여 로그인 성공 및 권한획득이 가능하다.

## 나. 보안대책

- 인증시도 횟수를 적절한 횟수로 제한하고 설정된 인증실패 횟수를 초과했을 경우 계정을 잠금하거나 추가적인 인증과정을 거쳐서 시스템에 접근이 가능하도록 한다.

## 다. 코드예제

### Java
```java
// ❌ 취약: 인증 실패에 대해 제한을 두지 않아 안전하지 않다.
private static final String SERVER_IP = "127.0.0.1";
private static final int SERVER_PORT = 8080;
private static final int FAIL = -1;
public void login() {
  String username = null;
  String password = null;
  Socket socket = null;
  int result = FAIL;
  try {
    socket = new Socket(SERVER_IP, SERVER_PORT);
    while (result == FAIL) {
      ...
      result = verifyUser(username, password);
    }
  }
}
```
```java
// ✅ 안전: 인증 실패 및 시도 횟수에 제한을 두어 안전하다.
private static final String SERVER_IP = "127.0.0.1";
private static final int SERVER_PORT = 8080;
private static final int FAIL = -1;
private static final int MAX_ATTEMPTS = 5;
public void login() {
  String username = null;
  String password = null;
  Socket socket = null;
  int result = FAIL;
  int count = 0;
  try {
    socket = new Socket(SERVER_IP, SERVER_PORT);
    while (result == FAIL && count < MAX_ATTEMPTS) {
      ...
      result = verifyUser(username, password);
      count++;
    }
  }
}
```
> 사용자 인증시도 횟수를 기록하는 MAX_ATTEMPTS 변수를 정의하고, 이를 인증시도 횟수를 제한하는 카운터로 사용함으로써 무차별 공격에 대응한다.

### C#
```csharp
// ❌ 취약: 로그인 실패 시 아무런 제약이 없음
override protected void OnLoginError(EventArgs e)
{
  //do nothing
}
```
```csharp
// ✅ 안전: 연속적인 사용자 인증 시도에 대한 횟수를 제한
override protected void OnLoginError(EventArgs e)
{
  if(ViewState["LoginErrors"] == null)
    ViewState["LoginErrors"] = 0;
  int ErrorCount = (int)ViewState["LoginErrors"] + 1;
  ViewState["LoginErrors"] = ErrorCount;

  if((ErrorCount > 3) && Login1.PasswordRecoveryUrl != string.Empty)
    Response.Redirect(Login1.PasswordRecoveryUrl);
}
```

### C
```c
// ❌ 취약: 인증시도 횟수를 제한하고 있지 않음
int validateUser(char *host, int port) {
  int socket = openSocketConnection(host, port);
  if (socket < 0) {
    printf("Unable to open socket connection");
    return(FAIL);
  }
  int isValidUser = 0;
  char nm[NAME_SIZE];
  char pw[PSWD_SIZE];
  while (isValidUser==0) {
    if (getNextMsg(socket, nm, NAME_SIZE) > 0) {
      if (getNextMsg(socket, pw, PSWD_SIZE) > 0) {
        isValidUser = AuthenticateUser(nm, pw);
      }
    }
  }
  return(SUCCESS);
}
```
```c
// ✅ 안전: 연속적인 사용자 인증 시도에 대한 횟수를 제한
#define MAX_ATTEMPTS 5

int validateUser(char *host, int port) {
  ......
  int count = 0;
  while ((isValidUser==0) && (count<MAX_ATTEMPTS)) {
    if (getNextMsg(socket, nm, NAME_SIZE) > 0) {
      if (getNextMsg(socket, pw, PSWD_SIZE) > 0) {
        isValidUser = AuthenticateUser(nm, pw);
      }
    }
    count++;
  }
  if (isValidUser) {
    return(SUCCESS);
  } else {
    return(FAIL);
  }
}
```

## 라. 진단방법

인증을 위한 함수를 호출하는 경우, 이 함수의 호출 횟수를 확인하고 함수의 호출을 제한하는 코드가 존재하는지 확인한다. 그렇지 않은 경우는 취약하다고 판단한다.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```c
// 인증 시도 회수에 대한 검사 루틴이 존재하지 않음 → 취약
int validateUser(char *host, int port)
{
  int socket = openSocketConnection(host, port);
  if (socket < 0)
  {
    printf("Unable to open socket connection");
    return(FAIL);
  }
  int isValidUser = 0;
  char username[USERNAME_SIZE];
  char password[PASSWORD_SIZE];
  while (isValidUser == 0)
  {
    if (getNextMessage(socket, username, USERNAME_SIZE) > 0)
    {
      if (getNextMessage(socket, password, PASSWORD_SIZE) > 0)
      {
        isValidUser = AuthenticateUser(username, password);
      }
    }
  }
  return(SUCCESS);
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문에 별도 오탐 예제 없음.

## 마. 참고자료

- CWE-307 Improper Restriction of Excessive Authentication Attempts, MITRE — http://cwe.mitre.org/data/definitions/307.html
- Blocking Brute Force Attacks, OWASP — https://www.owasp.org/index.php/Blocking_Brute_Force_Attacks

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 인증시도 제한 · 무차별 대입 · brute force · 계정 잠금 · MAX_ATTEMPTS · 사전 공격 · 카운터
- **객관형 시드**: 인증 실패 제한이 없는 코드와 MAX_ATTEMPTS 카운터로 제한하는 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 반복문 안에서 인증을 시도하는 코드 제시 → 인증 시도 횟수 제한 루틴 존재 여부로 정탐·오탐 판정
