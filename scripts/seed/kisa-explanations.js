// KISA 단답형 문제 해설 — 챕터별 핵심 개념·방어 원리.
// generate-blank-seed.js 에서 import 해 각 문제의 explanation 필드로 사용.
// 형식: chapter_code → { body: 공통 해설 (Q1/Q2 모두에 적용) }
//
// 생성 시 각 질문의 정답은 blank_answers[0].answers[0] 에서 자동 추출되어
// 해설 앞부분에 "정답: ..." 으로 붙는다. 여기서는 개념·원리만 작성.

module.exports = {
  // ================== Design 20개 ==================
  'DSG-IV-01': `SQL 삽입(SQL Injection)은 입력값이 SQL 구문에 그대로 삽입돼 쿼리 구조를 변조하는 공격입니다.
방어의 원칙은 "구조와 데이터를 분리"하는 것으로, Java JDBC의 PreparedStatement는 ? 플레이스홀더에 값을 바인드해 구조 변조를 원천 차단합니다.
MyBatis에서는 문자열 치환 \${}를 사용하면 동일한 취약점이 발생하므로 반드시 바인드 파라미터 #{} 문법을 사용해야 합니다.`,

  'DSG-IV-02': `XML 조회(XPath/XQuery)에서도 SQL 삽입과 동일한 논리로 입력값이 질의 구조에 삽입되면 XPath Injection이 발생합니다.
Java에서는 javax.xml.xpath.XPathExpression 과 XPathVariableResolver 를 사용해 변수 바인딩을 수행하면 안전합니다.
문자열 결합으로 XPath 를 구성하는 코드는 항상 취약하다고 간주해야 합니다.`,

  'DSG-IV-03': `LDAP Injection 은 LDAP 필터 문자열에 특수문자(*, (, ), \\, NUL)가 삽입돼 필터 구조가 변조되는 공격입니다.
Spring LDAP 의 LdapEncoder 나 OWASP ESAPI 의 encodeForLDAP 같은 라이브러리로 특수문자를 \\xx 헥사 형식으로 이스케이프해야 합니다.
화이트리스트 입력 검증과 함께 사용하면 더욱 안전합니다.`,

  'DSG-IV-04': `OS 명령어 삽입은 Runtime.exec 이나 ProcessBuilder 에 사용자 입력을 셸 해석 가능한 형태로 넘길 때 발생합니다.
ProcessBuilder 에 인자를 배열로 전달하면 셸을 거치지 않아 메타문자(;, |, &, \`)가 해석되지 않습니다.
추가로 화이트리스트 검증, chroot, 최소 권한 계정 등 다층 방어를 권장합니다.`,

  'DSG-IV-05': `서버가 외부 URL 을 사용자 입력 그대로 호출하면 내부망 스캔·메타데이터 탈취(AWS 169.254.169.254)가 가능한 SSRF 취약점이 됩니다.
방어는 허용 도메인 allowlist + private IP 대역(10.x, 172.16-31, 192.168, 169.254) 차단이 기본이며, DNS 리바인딩 방지를 위해 해석된 IP 까지 검증합니다.`,

  'DSG-IV-06': `CSRF 는 외부 사이트가 자동 POST 를 유도해 피해자의 세션으로 중요 요청을 발생시키는 공격입니다.
Spring Security 의 CsrfFilter 는 Synchronizer Token 패턴으로 매 폼 요청에 토큰을 검증하며, 쿠키에 SameSite=Strict/Lax 와 Origin/Referer 검증을 함께 적용하면 효과적입니다.`,

  'DSG-IV-07': `HTTP 응답분할은 Location, Set-Cookie 등 응답 헤더에 CR(\\r, 0x0D)/LF(\\n, 0x0A)가 포함된 사용자 입력이 실리면 발생합니다.
개행문자 제거/거부가 기본 방어이며, 최신 서블릿 API 는 헤더 값 개행을 막지만 커스텀 로직은 반드시 직접 검증해야 합니다.`,

  'DSG-IV-08': `허용 범위를 벗어난 메모리 접근은 버퍼 오버플로우를 일으켜 인접 데이터를 덮어쓰고 RCE 로 이어질 수 있습니다.
C/C++ 에서는 strcpy/sprintf 대신 strncpy/strlcpy/snprintf 같은 크기 제한 함수와 함께 인덱스 범위 검증을 수행해야 합니다.`,

  'DSG-IV-09': `인증·인가 판단에 쓰이는 입력은 반드시 화이트리스트(allowlist) 방식으로 검증해야 합니다.
블랙리스트는 우회 가능성이 높아 권장되지 않으며, 서버 측 검증을 클라이언트 검증으로 대체할 수 없습니다.`,

  'DSG-IV-10': `업로드 파일은 확장자만 볼 것이 아니라 Magic Number(MIME 시그니처)를 확인하고, 저장 디렉토리에서 실행 권한을 제거해야 합니다.
다운로드 시 경로에 ".." 가 포함되면 Path Traversal 이 발생하므로 getCanonicalPath 로 정규화 후 허용 루트와 비교해야 합니다.`,

  'DSG-SF-01': `인증 수단을 하나만 쓰면 비밀번호 탈취 시 즉시 계정이 탈취됩니다. MFA(다중 인증)로 OTP, 생체정보, 보안키를 추가하면 위험이 크게 낮아집니다.
2차 인증 요소는 저장 시 해시·암호화된 상태로 보관해야 합니다.`,

  'DSG-SF-02': `로그인 API 에 실패 횟수 제한이 없으면 무차별 대입 공격(Brute Force)에 노출됩니다.
IP+계정 기준 N회 실패 시 일시 잠금, CAPTCHA 제시, 점진적 지연(exponential backoff) 등 복합 방어를 적용합니다.`,

  'DSG-SF-03': `비밀번호는 평문 저장 불가. 단방향(One-way) 해시와 솔트를 사용해야 하며, bcrypt/scrypt/Argon2/PBKDF2 같은 키 스트레칭 해시를 사용해 brute-force 비용을 올립니다.
정책은 길이 8자 이상 + 복잡도 조합 + 유출 사전 단어 차단이 권장됩니다.`,

  'DSG-SF-04': `접근 통제는 반드시 서버 측에서 매 요청마다 재확인해야 합니다. 클라이언트 숨김 필드나 localStorage 만으로 권한을 결정하면 변조가 쉽습니다.
자원 식별자를 URL/파라미터로 직접 노출하고 권한 검증을 누락하면 IDOR(Insecure Direct Object Reference) 취약점이 발생합니다.`,

  'DSG-SF-05': `암호키를 소스코드에 박아두는 Hardcoded Credentials 는 디컴파일 또는 저장소 유출 시 즉시 탈취됩니다.
키는 KMS, AWS Secrets Manager, GCP Secret Manager 등에 보관하고 환경변수로 주입받으며, 대칭키는 최소 AES-128, 비대칭키는 RSA-2048/ECC-256 이상을 사용합니다.`,

  'DSG-SF-06': `DES/3DES/RC4/MD5/SHA-1 등은 취약(deprecated) 알고리즘으로 금지되며 AES-256, ChaCha20, SHA-256 이상을 사용해야 합니다.
블록 암호 모드는 ECB 를 피하고 CBC/CTR 또는 인증 암호화(GCM) 모드를 사용합니다.`,

  'DSG-SF-07': `개인정보·금융정보는 저장 시 반드시 암호화되어야 하며 복호화 키는 데이터와 분리 보관합니다.
비밀번호는 단방향 해시만 저장(bcrypt/Argon2 등)하고, 주민번호는 대체 식별자(CI/DI)나 해시+소금값으로 처리하는 것이 권장됩니다.`,

  'DSG-SF-08': `중요 정보 전송에는 반드시 TLS(HTTPS)를 사용하며, HSTS 헤더로 다운그레이드 공격을 차단합니다.
민감 파라미터는 URL 쿼리 대신 요청 body 에 실어 로그/Referer 노출을 피합니다.`,

  'DSG-EH-01': `예외 메시지에 스택트레이스, SQL 문, 파일 경로 같은 정보가 노출되면 공격자에게 시스템 구조를 알려주게 됩니다.
사용자에게는 일반화된 메시지를 보여주고 상세 내용은 서버 로그에만 기록해야 합니다.`,

  'DSG-SC-01': `Session Fixation 공격은 로그인 전후 세션 ID 가 동일한 것을 악용하므로, 로그인 성공 시점에 반드시 세션 ID 를 재발급해야 합니다.
세션 쿠키에는 HttpOnly, Secure, SameSite 속성을 모두 적용합니다.`,

  // ================== Implementation-1 17개 ==================
  'IMP-IV-01': `SQL Injection 의 근본 방어는 "구조와 값을 분리"하는 것입니다.
Java 는 PreparedStatement + ? 바인드, MyBatis 는 #{} 바인딩을 사용하며, 문자열 치환 \${} 또는 단순 concat 은 절대 쓰지 않아야 합니다.
ORM 사용 시에도 동적 쿼리 구성에서 취약점이 생길 수 있으니 주의가 필요합니다.`,

  'IMP-IV-02': `eval() 이나 서버 사이드 템플릿에 외부 입력을 넣으면 임의 코드 실행(Code Injection, SSTI)이 가능해집니다.
eval 대신 JSON.parse, 템플릿 엔진의 안전한 출력 모드(이스케이프)를 사용해야 합니다.`,

  'IMP-IV-03': `Path Traversal 은 경로 문자열에 "../" 가 삽입돼 상위 디렉토리 접근을 허용할 때 발생합니다.
Java 는 File.getCanonicalPath / Path.toRealPath 로 정규화한 뒤 허용 루트로 startsWith 검증을 수행해야 합니다.`,

  'IMP-IV-04': `XSS 방어의 핵심은 출력 컨텍스트(HTML body, attribute, JS, URL, CSS)별로 적절한 이스케이프를 적용하는 것입니다.
Spring 은 HtmlUtils.htmlEscape, Apache Commons 는 StringEscapeUtils.escapeHtml4 가 있으며, React/Vue 등 현대 프레임워크는 기본 이스케이프를 제공합니다.`,

  'IMP-IV-05': `Runtime.getRuntime().exec 에 셸 해석 가능한 문자열을 넘기면 메타문자 ; | & \` 로 명령이 주입됩니다.
ProcessBuilder 에 인자를 배열로 전달하면 셸을 거치지 않아 안전합니다.`,

  'IMP-IV-06': `업로드된 파일의 확장자만 검사하면 .jsp, .php 등의 웹쉘 업로드가 가능합니다.
Magic Number(파일 시그니처)로 실제 타입을 검증하고, 업로드 디렉토리에서 스크립트 실행 권한을 제거하며, 파일명은 서버가 생성한 UUID 로 치환합니다.`,

  'IMP-IV-07': `로그인 후 redirect 파라미터를 그대로 사용하면 피싱 사이트로 사용자를 유도하는 Open Redirect 에 취약합니다.
리다이렉트 목적지는 서버 측 allowlist 로 제한하고 외부 도메인 이동 시 경고 페이지를 거치게 합니다.`,

  'IMP-IV-08': `XXE 는 XML 파서가 외부 엔티티를 해석해 로컬 파일 유출·SSRF 로 이어지는 취약점입니다.
Java DocumentBuilderFactory 에 disallow-doctype-decl=true 등 FEATURE 를 설정하거나 XMLConstants.FEATURE_SECURE_PROCESSING 을 활성화합니다.`,

  'IMP-IV-09': `XML Injection 은 사용자 입력이 XML 태그·속성 구조를 왜곡시키는 공격입니다.
DOM API 로 요소를 구성하거나, < > & " ' 다섯 특수문자를 엔티티로 이스케이프해야 합니다.`,

  'IMP-IV-10': `LDAP 필터 특수문자(*, (, ), \\, NUL)는 반드시 \\xx 형식으로 이스케이프해야 LDAP Injection 을 방어할 수 있습니다.
RFC 4515 준수하는 라이브러리 함수를 사용하는 것이 안전합니다.`,

  'IMP-IV-11': `CSRF 방어의 표준은 Synchronizer Token Pattern(STP) 입니다.
Spring Security 의 CsrfFilter 가 자동으로 토큰 생성·검증하며, 쿠키 SameSite 속성과 Origin/Referer 검증을 함께 적용하면 효과적입니다.`,

  'IMP-IV-12': `SSRF 방어의 핵심은 클라우드 메타데이터 IP(169.254.169.254) 차단과 내부망 IP 대역(10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) 차단입니다.
외부 요청은 allowlist 로 허용 도메인만 통과시키고 DNS 재조회 방지를 위해 해석된 IP 를 직접 확인합니다.`,

  'IMP-IV-13': `응답 헤더 작성 시 CR(0x0D)/LF(0x0A) 문자를 포함한 입력을 그대로 실으면 HTTP 응답분할이 발생합니다.
개행·공백·탭 문자를 필터링(sanitize)하거나, 값 전체를 거부하는 strict 모드가 권장됩니다.`,

  'IMP-IV-14': `Integer Overflow 는 정수 연산이 표현 범위를 초과해 wraparound 가 발생하면서 길이 검증·인덱스 계산을 우회하게 만듭니다.
C에서는 __builtin_mul_overflow, <stdckdint.h>(C23) ckd_mul 등의 체크 함수로 연산 전 overflow 여부를 확인합니다.`,

  'IMP-IV-15': `권한·인증 결정을 hidden input, 쿠키, 클라이언트 전송값 같은 사용자 변조 가능한 입력에만 의존하면 우회가 쉽습니다.
세션 서버 측 상태를 기준으로 판단하고, 모든 보안 결정은 서버에서 재검증해야 합니다.`,

  'IMP-IV-16': `버퍼 오버플로우 방어는 크기 제한 함수(strncpy, strlcpy, snprintf) 사용과 컴파일러 보호 기능(-fstack-protector, -D_FORTIFY_SOURCE=2) 활성화가 기본입니다.
ASan/Valgrind 로 런타임 체크를 병행하면 효과적입니다.`,

  'IMP-IV-17': `printf(userInput) 처럼 사용자 입력을 포맷 문자열로 쓰면 %s, %n 시퀀스로 메모리 읽기·쓰기가 가능해집니다.
고정 포맷 문자열을 사용하고 값은 가변인자로 전달해야 안전합니다: printf("%s", userInput).`,

  // ================== Implementation-2 32개 ==================
  'IMP-SF-01': `인증 없이 접근 가능한 중요 기능은 API 게이트웨이 설정이나 프레임워크 레벨에서 반드시 보호해야 합니다.
Spring Security 는 @PreAuthorize("isAuthenticated()") 또는 HttpSecurity.authorizeRequests 로 경로별 인증을 강제합니다.`,

  'IMP-SF-02': `역할(role) 검증만으로는 부족하며, 요청한 자원의 소유자와 현재 사용자 ID 를 비교하는 리소스 단위 인가가 필요합니다.
누락 시 IDOR(Insecure Direct Object Reference) 취약점이 발생합니다.`,

  'IMP-SF-03': `중요 파일은 최소 권한 원칙에 따라 chmod 600(소유자만 읽기/쓰기) 또는 640(소유자 쓰기+그룹 읽기)으로 제한하고 umask 027 정도를 기본으로 설정합니다.
컨테이너 환경에서는 USER 디렉티브로 root 를 피합니다.`,

  'IMP-SF-04': `DES/3DES/RC4 는 이미 깨진 알고리즘이며, MD5/SHA-1 은 충돌 공격으로 무결성이 보장되지 않습니다.
AES-128/256, ChaCha20, SHA-256 이상, 인증 암호화(AES-GCM, ChaCha20-Poly1305) 를 사용합니다.`,

  'IMP-SF-05': `저장 암호화 미적용 시 DB/백업 유출로 정보가 즉시 노출됩니다. 전송 미암호화 시 네트워크 도청으로 노출됩니다.
저장은 AES-GCM 대칭 암호화, 전송은 TLS 1.2+ 로 이중 방어합니다.`,

  'IMP-SF-06': `API 키·비밀번호·암호키의 소스코드 하드코딩은 디컴파일, Git 기록 유출, 내부자 유출 위험이 큽니다.
환경변수, AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault 같은 전용 저장소를 사용합니다.`,

  'IMP-SF-07': `RSA 는 최소 2048 bit, ECC 는 256 bit, AES 대칭키는 128 bit, HMAC-SHA256 키는 256 bit 이상을 권장합니다.
짧은 키는 양자 이후 시대를 고려하면 더 빨리 상향해야 합니다.`,

  'IMP-SF-08': `java.util.Random 은 선형 합동 PRNG 로 예측 가능하며 보안용으로 부적합합니다.
java.security.SecureRandom (Linux /dev/urandom 기반) 또는 JDK 17 의 RandomGenerator 의 SecureRandom 사용을 권장합니다.`,

  'IMP-SF-09': `취약한 비밀번호 정책은 사전 공격(dictionary attack)을 쉽게 성공시킵니다.
길이 8 자 이상, 대소문자+숫자+특수문자 중 3 종 이상 조합, HaveIBeenPwned 같은 유출 목록과의 대조로 필터링합니다.`,

  'IMP-SF-10': `서명 검증 생략이나 alg=none 허용은 JWT/JWS 위조 공격의 원인이 됩니다.
서버 정책으로 허용 알고리즘(RS256, ES256 등)을 명시하고 헤더의 alg 를 신뢰하지 않아야 합니다.`,

  'IMP-SF-11': `TLS 연결 시 인증서 체인, 유효 기간, CN/SAN, OCSP/CRL 을 모두 검증해야 합니다.
개발 편의로 TrustManager 를 trust-all 로 구현한 코드는 반드시 제거하고 pinning 을 고려합니다.`,

  'IMP-SF-12': `Max-Age/Expires 가 있는 persistent 쿠키는 브라우저 종료 후에도 디스크에 남아 평문 노출 위험이 있습니다.
세션 쿠키는 이 속성 없이 발급해 브라우저 종료 시 삭제되게 하고 HttpOnly/Secure/SameSite 를 함께 적용합니다.`,

  'IMP-SF-13': `소스 주석의 TODO, 계정정보, 내부 API URL, 디버그 힌트는 배포 번들에 그대로 포함될 수 있습니다.
JS 는 minify 단계에서 주석을 제거하고, 서버 코드도 빌드 시 주석 검사 도구(ESLint custom rule 등)로 차단합니다.`,

  'IMP-SF-14': `솔트 없는 MD5/SHA-1 해시는 레인보우 테이블로 쉽게 역추적됩니다.
비밀번호는 고유 솔트 + bcrypt/scrypt/Argon2/PBKDF2 의 키 스트레칭 해시로 저장해 brute-force 비용을 충분히 올립니다.`,

  'IMP-SF-15': `외부 코드·스크립트 다운로드 시 서명(GPG)이나 해시(SHA-256) 검증 없이 실행하면 변조 공격에 노출됩니다.
npm lockfile, Maven checksums, SRI(Subresource Integrity) 로 의존성 무결성을 보장합니다.`,

  'IMP-SF-16': `로그인 실패 제한이 없으면 분산 brute-force 에 무력합니다.
IP+계정 기준 Rate Limiting(Token Bucket, Leaky Bucket)과 CAPTCHA, 점진적 지연을 복합 적용합니다.`,

  'IMP-TS-01': `TOCTOU(Time-of-Check to Time-of-Use)는 access() 로 검사 후 open() 사이에 파일이 교체되는 경쟁 조건 취약점입니다.
openat(O_NOFOLLOW) 같은 원자적 시스템 콜과 파일 디스크립터 기반 연산(fchown, fstat)으로 방어합니다.`,

  'IMP-TS-02': `반복·재귀 횟수를 외부 입력이 결정하면 무한 루프나 스택 오버플로우로 DoS 가 발생합니다.
입력 범위 검증과 최대 반복/재귀 깊이 제한을 설정해야 합니다.`,

  'IMP-EH-01': `스택트레이스, SQL 구문, 내부 경로가 노출된 오류 메시지는 공격자의 정찰을 돕습니다.
운영 환경에서는 일반화된 메시지만 사용자에게 노출하고, 상세 내용은 서버 로그에 기록합니다.`,

  'IMP-EH-02': `예외를 try-catch 없이 전파하거나 빈 catch 로 무시하면 자원 유출·일관성 파괴가 발생합니다.
finally 블록 또는 try-with-resources(Java 7+) 로 자원 해제를 보장해야 합니다.`,

  'IMP-EH-03': `catch 블록에서 예외를 swallow(무시)하거나 로그 없이 삼키면 장애 원인 추적이 불가능해집니다.
의미 있는 로그 기록과 재전파(rethrow) 여부의 명확한 판단이 필요합니다.`,

  'IMP-CE-01': `Null Pointer Dereference 는 NullPointerException 을 발생시켜 서비스 장애의 주 원인이 됩니다.
Java 에서는 Optional.ofNullable + ifPresent, Objects.requireNonNull, @Nullable 어노테이션 활용이 권장됩니다.`,

  'IMP-CE-02': `파일, DB 커넥션, 소켓 등 AutoCloseable 자원은 사용 후 반드시 close 해야 자원 누수가 없습니다.
Java 7+ 의 try-with-resources 구문으로 자동 해제하는 것이 가장 안전합니다.`,

  'IMP-CE-03': `Use After Free(UAF)는 free 된 포인터를 재사용할 때 다른 객체로 재할당된 메모리를 조작할 수 있는 치명적 취약점입니다.
해제 직후 포인터에 NULL 대입, 또는 스마트 포인터(unique_ptr, shared_ptr) 사용으로 원천 차단합니다.`,

  'IMP-CE-04': `초기화되지 않은 스택 변수는 이전 함수 호출의 쓰레기 값을 포함해 정보 유출로 이어질 수 있습니다.
모든 지역 변수는 선언 즉시 0 또는 기본값으로 초기화하고, 힙은 calloc 또는 memset 으로 0 초기화합니다.`,

  'IMP-CE-05': `Java ObjectInputStream.readObject 는 임의 클래스의 객체 생성을 허용하므로, 외부 입력 역직렬화는 RCE 로 이어질 수 있습니다.
JSON 같은 안전한 포맷(Jackson, Gson) 으로 대체하거나 ObjectInputFilter 로 허용 클래스를 화이트리스트로 제한합니다.`,

  'IMP-EN-01': `static 변수에 요청별 데이터를 저장하면 여러 사용자 세션이 동일 변수를 공유해 정보 유출이 발생합니다.
요청 스코프 객체(Spring @RequestScope), ThreadLocal(사용 후 remove 필수) 를 활용합니다.`,

  'IMP-EN-02': `System.out.println, console.log, 개발자 도구 열림 힌트 등 디버그 코드는 프로덕션에 포함되면 정보 노출 또는 성능 문제로 이어집니다.
빌드 프로파일(prod/dev)을 분리해 디버그 코드를 조건부 컴파일/제거합니다.`,

  'IMP-EN-03': `public 메소드가 내부 private 배열을 그대로 반환하면 호출자가 참조를 유지하며 원본을 수정해 캡슐화가 깨집니다.
Arrays.copyOf 또는 clone 으로 복사본을 반환해 외부 수정으로부터 보호합니다.`,

  'IMP-EN-04': `setter 가 외부 배열 참조를 그대로 저장하면 외부에서 원본을 계속 수정할 수 있어 내부 불변식이 깨집니다.
setter 에서는 Arrays.copyOf / clone 으로 깊은 복사 후 저장합니다.`,

  'IMP-AA-01': `IP 역조회(reverse DNS) 나 호스트명으로 권한을 결정하면 DNS 스푸핑·캐시 포이즈닝 공격으로 우회됩니다.
인증은 TLS 클라이언트 인증서, OAuth/JWT 토큰, 상호 TLS(mTLS) 같이 위조 불가능한 식별자로 수행해야 합니다.`,

  'IMP-AA-02': `String.getBytes() / new String(byte[]) 같은 플랫폼 기본 문자셋 의존 API 는 환경에 따라 다르게 동작해 데이터 변환 오류를 일으킵니다.
StandardCharsets.UTF_8 처럼 명시적 인코딩을 항상 지정해야 합니다.`,
};
