# IMP-SF-01 · 적절한 인증 없는 중요기능 허용

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-306
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §1 적절한 인증 없는 중요기능 허용 (p.314–318)

## 가. 개요

적절한 인증과정이 없이 중요정보(계좌이체 정보, 개인정보 등)를 열람(또는 변경)할 때 발생하는 보안약점이다.

## 나. 보안대책

- **클라이언트 보안검사 우회**로 서버에 접근하지 못하도록 설계
- 중요한 정보가 있는 페이지는 **재인증** 적용(은행 계좌이체 등)
- 안전하다고 검증된 라이브러리·프레임워크(OpenSSL, ESAPI 보안기능 등) 사용

## 다. 코드예제

### Java (Spring MVC)
회원정보 수정 시 수정을 요청한 사용자와 로그인한 사용자의 일치 여부를 확인한 후 처리해야 한다.

```java
// ❌ 취약: 수정 요청자와 로그인 사용자 일치 여부 미확인
String userId = (String) session.getAttribute("userId");
if (service.modifyMember(memberModel)) { ... } // 일치 확인 없이 수정
```
```java
// ✅ 안전: 요청자(requestUser)와 로그인 사용자(userId) 동일 여부 확인 후 수정
String requestUser = memberModel.getUserId();
if (userId != null && requestUser != null && !userId.equals(requestUser)) {
  mav.addObject("errCode", 1); // 불일치 시 차단
  return mav;
}
if (service.modifyMember(memberModel)) { ... } // 동일한 경우에만 수정
```

### C#
```csharp
// ❌ 취약: 자격인증 과정 없이 로그인 수행
FormsAuthentication.RedirectFromLoginPage(UserName.Text, RememberMe.Checked);

// ✅ 안전: ValidateUser 로 자격인증 후 로그인
if(Membership.ValidateUser(UserName.Text, Password.Text)) {
  FormsAuthentication.RedirectFromLoginPage(UserName.Text, RememberMe.Checked);
}
```

## 라. 진단방법

1. **①** 비밀번호·개인정보·금융정보, 게시글 수정·삭제 등 **접근/사용이 제한되어야 하는 중요정보·기능을 정의**하였는지 확인하고 사용 여부 확인
2. **②** 중요정보 접근·변경 시 **적절한 인증 여부를 확인**하여 허용하는 기능이 구현되었는지 확인

> 인증여부를 확인하면 안전, 확인하지 않으면 취약 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 재인증 없이 계좌이체 → 취약
public void sendBankAccount(String accountNumber, double balance) {
  BankAccount account = new BankAccount();
  account.setAccountNumber(accountNumber);
  account.setBalance(balance);
  AccountManager.send(account);
}
```
```html
<!-- 클라이언트(JavaScript) 측에서 인증 → 우회 가능 → 취약 -->
<script type='text/javascript'>
  if (${command.allowedIp} == false) {
    alert("권한이 없습니다.")
    history.back(-1);
  }
</script>
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문에 오탐 코드 예제 없음.

## 마. 참고자료

- CWE-306 Missing Authentication for Critical Function, MITRE — http://cwe.mitre.org/data/definitions/306.html
- Access Control, OWASP — https://www.owasp.org/index.php/Access_Control_Cheat_Sheet

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 재인증 · 자격인증 · ValidateUser · 로그인 사용자 일치 확인 · 클라이언트 우회 · 서버측 인증 · 중요정보(계좌이체/개인정보)
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
