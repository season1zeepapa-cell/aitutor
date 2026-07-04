// 구현단계 composite(복합서술형) 확충 시드 생성 (REBUILD88)
//
// 무엇을: composite 미보유 구현 챕터 41개에 각 1문항(8점, rubric 3항목 3/3/2) 생성.
//   - 산출물 3종(보안요구사항명세서·개발가이드·개발산출물)은 기존 IMP-IV-01 composite 규격.
//   - 취약 소스코드·해설 note 는 kisa-library.json(진단가이드 원문)에서 자동 주입.
//   - 진단포인트·요구사항·가이드 규칙·rubric 키워드는 아래 SPEC(챕터별 수작성) 사용.
//
// 실행: node scripts/build-kisa-composite-impl.mjs
//   → kisa-module/seed/composite-impl-expansion.json
// 적재: node scripts/kisa-seed-composite-impl.mjs (weakness_code 기준, 재실행 안전)

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = JSON.parse(readFileSync(join(root, 'src/data/kisa-library.json'), 'utf8'));
const items = lib.sources.find((s) => s.id === 'library').items;
const byId = new Map(items.map((it) => [it.id, it]));

// DB language enum 매핑
const langEnum = (lang) => {
  const s = String(lang || '').toLowerCase();
  if (s.includes('javascript')) return 'javascript';
  if (s.includes('python')) return 'python';
  if (s.includes('java')) return 'java'; // JSP/Spring 포함
  return 'etc'; // C 등
};

// 카테고리 enum
const CAT_ENUM = {
  '입력데이터 검증 및 표현': 'input_validation', 보안기능: 'security_feature',
  '시간 및 상태': 'time_state', 에러처리: 'error_handling', 코드오류: 'code_error',
  캡슐화: 'encapsulation', API오용: 'api_abuse', 세션통제: 'session_control',
};

// ── 챕터별 SPEC (수작성) ────────────────────────────────────────────────
// req: 요구사항 2줄 · guide: 개발가이드 규칙 · p1/p2: 진단포인트 ①②
// kwDefect(3점 결함진단) / kwVerdict(3점 판정·현황) / kwFix(2점 개선방안) — 짧은 핵심어(REBUILD82 §4 교훈)
const SPEC = {
  'IMP-IV-02': { p1: '외부입력값이 검증 없이 스크립트 실행 함수(eval)에 전달되는가', p2: '실행 가능한 문자·명령을 제한하는 입력값 검증이 있는가',
    req: ['외부입력값을 동적 코드 실행 함수(eval 등)에 직접 사용하지 않는다.', '동적 실행이 불가피하면 실행 가능 문자를 화이트리스트로 제한한다.'],
    guide: 'ScriptEngine.eval() 등 동적 실행 API에 사용자 입력을 전달하기 전, 허용된 문자·패턴(화이트리스트)만 통과시키는 검증 로직을 공통모듈로 적용한다.',
    kwDefect: ['eval', '검증 없이', '외부입력'], kwVerdict: ['결함', '코드 삽입', '실행'], kwFix: ['화이트리스트', '입력값 검증', '제한'] },
  'IMP-IV-07': { p1: '외부입력값이 검증 없이 리다이렉트 URL로 사용되는가', p2: '이동 허용 URL 목록(화이트리스트) 검증이 있는가',
    req: ['리다이렉트 대상 URL은 외부입력값을 직접 사용하지 않는다.', '이동 가능한 URL 은 사전 정의된 허용 목록으로 제한한다.'],
    guide: 'sendRedirect 등 자동접속 연결 시 외부에서 받은 url 파라미터는 서버에 보관된 허용 URL 목록과 대조한 뒤 일치할 때만 이동시킨다.',
    kwDefect: ['sendRedirect', '검증 없이', 'url'], kwVerdict: ['결함', '오픈 리다이렉트', '피싱'], kwFix: ['화이트리스트', '허용 목록', '검증'] },
  'IMP-IV-08': { p1: 'XML 파서에 외부개체(DTD) 참조 기능이 활성화된 채 외부 XML을 파싱하는가', p2: 'disallow-doctype-decl 등 외부개체 차단 설정이 있는가',
    req: ['외부에서 수신한 XML 파싱 시 외부개체(External Entity) 참조를 금지한다.', 'XML 파서의 DOCTYPE 선언을 비활성화한다.'],
    guide: 'DocumentBuilderFactory 등 파서 생성 시 setFeature("http://apache.org/xml/features/disallow-doctype-decl", true) 로 DTD 를 차단한 후 파싱한다.',
    kwDefect: ['외부개체', 'DOCTYPE', '파싱'], kwVerdict: ['결함', 'XXE', '내부 파일'], kwFix: ['disallow-doctype-decl', 'setFeature', '비활성화'] },
  'IMP-IV-09': { p1: '외부입력값이 검증 없이 XQuery/XPath 질의문에 문자열 결합되는가', p2: '파라미터 바인딩 또는 특수문자 필터링이 적용되는가',
    req: ['XML 질의문(XQuery/XPath)에 외부입력값을 문자열 결합으로 삽입하지 않는다.', '질의문은 파라미터 바인딩 방식으로 구성한다.'],
    guide: 'XQuery 는 declare variable 외부 변수 바인딩($var)을 사용하고, 외부입력의 특수문자(따옴표 등)는 검증·필터링한다.',
    kwDefect: ['문자열 결합', '검증 없이', '질의문'], kwVerdict: ['결함', 'XML 삽입', '조작'], kwFix: ['바인딩', '외부 변수', '필터링'] },
  'IMP-IV-10': { p1: '외부입력값이 검증 없이 LDAP 검색 필터에 사용되는가', p2: '필터 특수문자(*, (, ) 등) 이스케이프 처리가 있는가',
    req: ['LDAP 검색 필터에 외부입력값을 직접 사용하지 않는다.', '필터 메타문자는 이스케이프 처리 후 사용한다.'],
    guide: 'LDAP 필터 구성 시 외부입력의 *, (, ), \\, NUL 등 메타문자를 이스케이프하는 공통 함수를 거친 값만 사용한다.',
    kwDefect: ['필터', '검증 없이', '외부입력'], kwVerdict: ['결함', 'LDAP 삽입', '인증 우회'], kwFix: ['이스케이프', '특수문자', '검증'] },
  'IMP-IV-11': { p1: '상태변경 요청에 재전송 방지 토큰(CSRF 토큰) 검증이 있는가', p2: '토큰이 세션별 임의값으로 생성·비교되는가',
    req: ['중요기능(등록·수정·삭제) 요청은 CSRF 토큰으로 정상 요청 여부를 검증한다.', '토큰은 세션마다 예측 불가능한 임의값으로 생성한다.'],
    guide: '입력 폼 생성 시 세션에 임의 토큰을 저장하고 hidden 필드로 내려보낸 뒤, 처리 요청에서 세션 토큰과 일치할 때만 수행한다.',
    kwDefect: ['토큰', '검증 없이', '요청'], kwVerdict: ['결함', 'CSRF', '위조'], kwFix: ['CSRF 토큰', '세션', '일치'] },
  'IMP-IV-12': { p1: '외부입력 URL로 서버가 직접 요청을 보내는가(내부망 접근 가능)', p2: '허용 호스트 목록·내부 IP 차단 검증이 있는가',
    req: ['서버가 요청하는 URL 은 외부입력값을 직접 사용하지 않는다.', '요청 가능한 호스트는 화이트리스트로 제한하고 내부 IP 대역을 차단한다.'],
    guide: '서버측 요청(open/connect) 전 대상 호스트를 허용 목록과 대조하고, 사설 IP·루프백 주소는 요청을 거부한다.',
    kwDefect: ['url', '검증 없이', '서버'], kwVerdict: ['결함', 'SSRF', '내부'], kwFix: ['화이트리스트', '허용 목록', '차단'] },
  'IMP-IV-13': { p1: '외부입력값이 개행(CR/LF) 제거 없이 HTTP 헤더에 설정되는가', p2: '헤더 설정 전 \\r\\n 필터링이 있는가',
    req: ['HTTP 응답헤더에 외부입력값을 직접 설정하지 않는다.', '헤더 값의 개행문자(CR/LF)는 제거 후 사용한다.'],
    guide: 'addHeader/setHeader 등에 전달되는 외부입력은 replaceAll("[\\r\\n]", "") 등으로 개행을 제거한 뒤 설정한다.',
    kwDefect: ['개행', '헤더', '검증 없이'], kwVerdict: ['결함', '응답분할', 'CRLF'], kwFix: ['개행 제거', '필터링', 'replace'] },
  'IMP-IV-14': { p1: '외부입력 기반 연산 결과가 범위 검증 없이 크기·인덱스로 사용되는가', p2: '연산 결과의 음수·상한 검증이 있는가',
    req: ['외부입력으로 계산되는 정수 연산은 오버플로우 여부를 검증한다.', '배열 크기·인덱스로 쓰는 값은 0 이상, 상한 이하인지 확인한다.'],
    guide: '곱셈 등 연산 결과를 사용하기 전 결과값이 음수이거나 허용 범위를 벗어나면 예외 처리하도록 경계값 검증을 추가한다.',
    kwDefect: ['오버플로우', '검증 없이', '음수'], kwVerdict: ['결함', '정수형', '배열'], kwFix: ['범위 검증', '경계값', '예외 처리'] },
  'IMP-IV-15': { p1: '가격·권한 등 보안결정 값이 클라이언트(브라우저)에서 전달되는가', p2: '서버측 재검증(원본 대조)이 있는가',
    req: ['보안결정(가격·권한·수량 한도)에 사용되는 값은 서버에서 관리한다.', '클라이언트에서 전달된 중요 값은 서버 원본과 재검증한다.'],
    guide: '단가·권한 등은 hidden 필드로 전달받지 말고 서버 DB 원본을 조회해 사용하며, 전달값은 서버측에서 무결성을 재확인한다.',
    kwDefect: ['클라이언트', 'hidden', '검증 없이'], kwVerdict: ['결함', '변조', '가격'], kwFix: ['서버', '재검증', '원본'] },
  'IMP-IV-16': { p1: '버퍼 크기 계산이 잘못되어 할당 범위를 초과해 쓰는가', p2: '복사·쓰기 전 크기 검증이 있는가',
    req: ['메모리 복사·쓰기 시 대상 버퍼 크기를 초과하지 않도록 검증한다.', '크기 계산은 대상 자료형 기준으로 정확히 산정한다.'],
    guide: '할당 크기는 사용 목적 구조체·배열 기준(sizeof 대상)을 정확히 지정하고, 인덱스 접근 전 경계값을 검증한다.',
    kwDefect: ['버퍼', 'sizeof', '초과'], kwVerdict: ['결함', '오버플로우', '메모리'], kwFix: ['크기 검증', '경계', '할당'] },
  'IMP-IV-17': { p1: '외부입력값이 포맷 문자열 인자로 직접 전달되는가', p2: '고정 포맷 문자열 사용 여부',
    req: ['format/printf 계열 함수의 포맷 문자열에 외부입력값을 사용하지 않는다.', '포맷 문자열은 상수로 고정한다.'],
    guide: 'String.format(외부입력) 형태를 금지하고, 외부입력은 포맷의 인자(%s 값)로만 전달한다.',
    kwDefect: ['포맷', 'format', '외부입력'], kwVerdict: ['결함', '포맷 스트링', '노출'], kwFix: ['상수', '고정', '인자'] },
  'IMP-SF-01': { p1: '중요기능(회원정보 수정 등) 수행 전 요청자 본인 확인이 있는가', p2: '로그인 사용자와 대상 리소스 소유자 일치 검증이 있는가',
    req: ['중요기능은 인증된 사용자만 수행할 수 있어야 한다.', '요청 대상 데이터의 소유자와 로그인 사용자의 일치 여부를 검증한다.'],
    guide: '수정·조회 처리 전 세션의 사용자 식별자와 요청 파라미터의 대상 식별자를 비교해 불일치 시 거부한다.',
    kwDefect: ['인증', '확인 없이', '세션'], kwVerdict: ['결함', '중요기능', '타인'], kwFix: ['일치 여부', '본인 확인', '검증'] },
  'IMP-SF-03': { p1: '파일 권한 설정 API 의 ownerOnly 인자가 false 로 전체 허용되는가', p2: '중요 자원의 최소권한 설정 여부',
    req: ['중요 파일·자원은 소유자에게만 필요한 최소 권한을 부여한다.', '실행·읽기·쓰기 권한을 모든 사용자에게 개방하지 않는다.'],
    guide: 'setExecutable/setReadable/setWritable 의 두 번째 인자(ownerOnly)는 true 로 설정해 소유자 외 접근을 차단한다.',
    kwDefect: ['권한', 'false', '모든 사용자'], kwVerdict: ['결함', '잘못된 권한', '자원'], kwFix: ['ownerOnly', 'true', '최소 권한'] },
  'IMP-SF-04': { p1: 'DES 등 취약 알고리즘으로 암호화하는가', p2: '검증된 안전 알고리즘(AES 등) 사용 여부',
    req: ['암호화에는 검증된 안전한 알고리즘을 사용한다.', 'DES·RC4 등 취약 알고리즘 사용을 금지한다.'],
    guide: 'Cipher.getInstance 에 DES 대신 AES(권장 운용모드·패딩 포함)를 지정하고, 알고리즘 목록은 보안정책으로 관리한다.',
    kwDefect: ['DES', '취약', '알고리즘'], kwVerdict: ['결함', '암호화', '복호화'], kwFix: ['AES', '안전한 알고리즘', '교체'] },
  'IMP-SF-07': { p1: 'RSA 등 공개키 키 길이가 권장 기준(2048비트) 미만인가', p2: '키 길이 정책 준수 여부',
    req: ['공개키 암호 RSA 는 2048비트 이상 키 길이를 사용한다.', '대칭키·해시도 보안강도 112비트 이상 기준을 준수한다.'],
    guide: 'KeyPairGenerator.initialize(1024) 같은 짧은 키 설정을 금지하고 2048 이상으로 초기화한다.',
    kwDefect: ['1024', '키 길이', '짧'], kwVerdict: ['결함', 'RSA', '보안강도'], kwFix: ['2048', '이상', 'initialize'] },
  'IMP-SF-08': { p1: '고정 seed 로 난수를 생성하는가', p2: '예측 불가능한 난수원(SecureRandom) 사용 여부',
    req: ['보안 목적 난수는 예측 불가능해야 한다.', '고정 시드(seed) 사용을 금지한다.'],
    guide: 'new Random(고정값) 대신 SecureRandom 을 사용하고, seed 가 필요하면 매번 변경되는 값으로 설정한다.',
    kwDefect: ['고정', 'seed', 'Random'], kwVerdict: ['결함', '난수', '예측'], kwFix: ['SecureRandom', '예측 불가', '변경'] },
  'IMP-SF-09': { p1: '가입·변경 시 비밀번호 복잡도 검증이 있는가', p2: '자릿수·문자조합 규칙 적용 여부',
    req: ['비밀번호는 길이·영문·숫자·특수문자 조합 규칙을 강제한다.', '규칙 미달 비밀번호는 가입·변경을 거부한다.'],
    guide: '회원가입 처리 전 비밀번호 복잡도(최소 자릿수, 문자종 혼합)를 검증하는 공통 함수를 호출하고 실패 시 승인하지 않는다.',
    kwDefect: ['복잡도', '검증 없이', '비밀번호'], kwVerdict: ['결함', '취약한 비밀번호', '무차별'], kwFix: ['자릿수', '특수문자', '조합'] },
  'IMP-SF-10': { p1: '다운로드한 코드(JAR)의 전자서명을 확인 없이 실행하는가', p2: '서명 검증 로직 존재 여부',
    req: ['외부에서 받은 실행코드는 전자서명을 검증한 후 사용한다.', '서명 검증 실패 시 로드·실행을 중단한다.'],
    guide: 'JarFile(file, true) 로 서명 검증을 활성화하고 인증서 체인을 확인한 뒤에만 클래스를 로드한다.',
    kwDefect: ['서명', '확인 없이', '다운로드'], kwVerdict: ['결함', '전자서명', '악성코드'], kwFix: ['서명 검증', '인증서', '확인'] },
  'IMP-SF-11': { p1: '서버 인증서 검증 결과(자체서명 등 오류)를 무시하고 통신을 계속하는가', p2: '검증 실패 시 연결 중단 여부',
    req: ['SSL/TLS 통신 시 상대 인증서의 유효성을 검증한다.', '검증 실패(자체서명·만료 등) 시 연결을 중단한다.'],
    guide: 'SSL_get_verify_result 결과가 X509_V_OK 가 아니면(자체서명 오류 포함) 세션을 종료하도록 분기한다.',
    kwDefect: ['인증서', '무시', '검증'], kwVerdict: ['결함', '자체서명', '중간자'], kwFix: ['유효성 검증', '연결 중단', 'X509'] },
  'IMP-SF-12': { p1: '민감정보가 영속 쿠키(긴 만료시간)로 저장되는가', p2: '세션 쿠키 사용·만료 최소화 여부',
    req: ['개인정보·인증정보를 영속 쿠키에 저장하지 않는다.', '쿠키 만료시간은 필요 최소한으로 설정한다.'],
    guide: 'setMaxAge 로 장기간(예: 1년) 유효한 쿠키에 개인정보를 담지 말고, 세션 쿠키 또는 짧은 만료로 설정한다.',
    kwDefect: ['쿠키', 'setMaxAge', '유효기간'], kwVerdict: ['결함', '하드디스크', '도용'], kwFix: ['세션 쿠키', '만료', '최소'] },
  'IMP-SF-13': { p1: '주석에 계정·비밀번호 등 시스템 주요정보가 남아 있는가', p2: '배포 전 주석 정보 제거 여부',
    req: ['소스코드 주석에 계정·비밀번호·내부 IP 등 중요정보를 남기지 않는다.', '배포 전 주석의 민감정보를 제거한다.'],
    guide: '개발 중 임시로 기록한 계정/비밀번호 주석은 코드리뷰·배포 단계에서 확인하여 삭제한다.',
    kwDefect: ['주석', '비밀번호', '계정'], kwVerdict: ['결함', '주요정보', '노출'], kwFix: ['제거', '삭제', '배포 전'] },
  'IMP-SF-14': { p1: '비밀번호를 솔트 없이 해시하는가', p2: '사용자별 랜덤 솔트 적용 여부',
    req: ['비밀번호 해시에는 사용자별 랜덤 솔트를 적용한다.', '솔트는 예측 불가능한 난수로 생성해 안전하게 보관한다.'],
    guide: 'digest(password) 단독 해시를 금지하고, SecureRandom 솔트를 결합(password+salt)해 해시한 뒤 솔트를 함께 저장한다.',
    kwDefect: ['솔트 없이', '해시', '비밀번호'], kwVerdict: ['결함', '레인보우', '사전 공격'], kwFix: ['솔트', '랜덤', '결합'] },
  'IMP-SF-15': { p1: '원격에서 받은 코드를 무결성 검사 없이 로드·실행하는가', p2: '해시/서명 대조 로직 여부',
    req: ['원격 다운로드 코드는 무결성(해시·서명) 검증 후 실행한다.', '검증 실패 시 로드를 중단한다.'],
    guide: 'URLClassLoader 로 원격 클래스를 로드하기 전, 사전 배포된 해시값과 다운로드 파일의 해시를 대조한다.',
    kwDefect: ['무결성', '검사 없이', '다운로드'], kwVerdict: ['결함', '원격', '변조'], kwFix: ['해시', '대조', '검증'] },
  'IMP-SF-16': { p1: '로그인 실패 횟수 제한이 없는가', p2: '임계 초과 시 계정 잠금·지연 처리 여부',
    req: ['인증 시도 횟수를 기록하고 임계값 초과 시 차단한다.', '차단 해제는 안전한 절차(시간 경과·본인확인)로만 허용한다.'],
    guide: '로그인 처리에 실패 카운터(MAX_ATTEMPTS)를 두고 초과 시 인증 시도를 거부하도록 구현한다.',
    kwDefect: ['횟수', '제한 없이', '인증'], kwVerdict: ['결함', '무차별', '자동화'], kwFix: ['MAX_ATTEMPTS', '잠금', '제한'] },
  'IMP-TS-01': { p1: '검사(exists)와 사용(read/delete) 사이에 자원 상태가 바뀔 수 있는가', p2: '동기화(synchronized 등)로 원자성 보장 여부',
    req: ['공유자원의 검사와 사용은 원자적으로 수행한다.', '다중 스레드 접근 구간은 동기화한다.'],
    guide: '파일 존재 검사 후 사용하는 구간을 synchronized 블록(또는 락)으로 묶어 검사~사용 사이 상태 변경을 차단한다.',
    kwDefect: ['검사 시점', '사용 시점', '스레드'], kwVerdict: ['결함', '경쟁조건', 'TOCTOU'], kwFix: ['동기화', 'synchronized', '원자'] },
  'IMP-TS-02': { p1: '재귀·반복문에 종료(귀납)조건이 없는가', p2: '한계값 도달 시 탈출 로직 여부',
    req: ['반복문·재귀는 명확한 종료조건을 가진다.', '외부입력이 반복 횟수에 영향을 주면 상한을 검증한다.'],
    guide: '재귀 함수에 base case(예: n<=1 반환)를 두고, 반복 상한을 검증해 무한 수행을 차단한다.',
    kwDefect: ['종료', '조건 없이', '재귀'], kwVerdict: ['결함', '무한', '자원 고갈'], kwFix: ['귀납조건', 'base case', '상한'] },
  'IMP-EH-01': { p1: '예외 처리 시 스택 트레이스 등 내부정보를 사용자에게 출력하는가', p2: '일반화된 메시지 처리 여부',
    req: ['오류 발생 시 내부 정보(스택 트레이스·쿼리)를 사용자에게 노출하지 않는다.', '상세 오류는 서버 로그에만 기록한다.'],
    guide: 'printStackTrace()·getMessage() 를 화면 응답에 사용하지 말고, 일반화된 안내 후 상세는 로거로 기록한다.',
    kwDefect: ['printStackTrace', '스택', '노출'], kwVerdict: ['결함', '오류 메시지', '정보'], kwFix: ['일반화', '로그', '기록'] },
  'IMP-EH-02': { p1: 'catch 블록이 비어 있어 오류가 무시되는가', p2: '오류 상황별 처리(중단·보정) 여부',
    req: ['오류 발생 시 적절한 처리(중단·복구·기록)를 수행한다.', '빈 catch 블록을 금지한다.'],
    guide: 'catch 에서 최소한 로그 기록과 흐름 제어(반환·예외 재던짐)를 수행해 오류가 정상 흐름으로 이어지지 않게 한다.',
    kwDefect: ['catch', '비어', '무시'], kwVerdict: ['결함', '대응 부재', '계속 실행'], kwFix: ['오류 처리', '로그', '중단'] },
  'IMP-EH-03': { p1: '광범위한 Exception 하나로 상이한 예외를 뭉뚱그려 처리하는가', p2: '예외 유형별 구체 처리 여부',
    req: ['예외는 유형별로 구분해 처리한다.', '광범위한 예외 클래스 남용을 금지한다.'],
    guide: 'IOException·SQLException 등 구체 예외를 각각 catch 하여 상황별 복구·메시지를 달리 처리한다.',
    kwDefect: ['Exception', '광범위', '한꺼번'], kwVerdict: ['결함', '부적절한 예외', '구분'], kwFix: ['유형별', '구체', '개별 처리'] },
  'IMP-CE-01': { p1: 'null 가능 객체를 검사 없이 역참조하는가', p2: 'null 검사·안전 비교 순서 여부',
    req: ['null 이 될 수 있는 참조는 사용 전 null 검사를 한다.', '상수.equals(변수) 등 안전한 비교 순서를 사용한다.'],
    guide: 'obj.equals(elt) 처럼 null 가능 객체를 좌변에 두지 말고, null 검사 후 사용하거나 상수를 좌변에 둔다.',
    kwDefect: ['null', '검사 없이', '역참조'], kwVerdict: ['결함', 'NullPointer', '중단'], kwFix: ['null 검사', '순서', '확인'] },
  'IMP-CE-02': { p1: '예외 발생 시 close() 미실행으로 자원이 누수되는가', p2: 'finally/try-with-resources 반환 여부',
    req: ['획득한 자원(스트림·커넥션)은 오류 여부와 무관하게 해제한다.', '자원 해제는 finally 또는 try-with-resources 로 보장한다.'],
    guide: 'close() 를 try 본문에만 두지 말고 finally 블록(또는 try-with-resources)에서 호출해 예외 시에도 반환되게 한다.',
    kwDefect: ['close', '해제', '누수'], kwVerdict: ['결함', '자원', '반환'], kwFix: ['finally', 'try-with-resources', '보장'] },
  'IMP-CE-03': { p1: 'free() 후 해제된 메모리를 다시 사용하는가', p2: '해제 후 포인터 초기화 여부',
    req: ['해제한 메모리는 재사용하지 않는다.', '해제 직후 포인터를 NULL 로 초기화한다.'],
    guide: 'free(temp) 이후 temp 사용을 금지하고 temp = NULL 로 초기화하여 재사용을 차단한다.',
    kwDefect: ['free', '해제된', '사용'], kwVerdict: ['결함', 'use after free', '임의'], kwFix: ['NULL', '초기화', '재사용 금지'] },
  'IMP-CE-04': { p1: '분기(switch/if)에 따라 초기화되지 않는 변수가 사용되는가', p2: '선언 시 초기값 부여 여부',
    req: ['모든 변수는 사용 전에 초기화한다.', '모든 분기 경로에서 초기화를 보장한다.'],
    guide: '변수 선언 시 기본값을 부여하고, default 등 모든 분기에서 값이 설정되는지 확인한다.',
    kwDefect: ['초기화', '않은', '변수'], kwVerdict: ['결함', '쓰레기 값', '예측'], kwFix: ['초기값', '선언 시', '모든 분기'] },
  'IMP-CE-05': { p1: '신뢰할 수 없는 바이트 스트림을 검증 없이 역직렬화하는가', p2: '허용 클래스 제한(필터) 여부',
    req: ['신뢰할 수 없는 데이터의 역직렬화를 금지한다.', '불가피하면 역직렬화 허용 클래스를 화이트리스트로 제한한다.'],
    guide: 'ObjectInputStream 사용 시 ObjectInputFilter 로 허용 클래스·깊이·크기를 제한하고, 가능하면 JSON 등 안전한 포맷으로 대체한다.',
    kwDefect: ['역직렬화', '검증 없이', 'ObjectInputStream'], kwVerdict: ['결함', '조작', '원격'], kwFix: ['필터', '허용 클래스', '제한'] },
  'IMP-EN-01': { p1: 'JSP 선언부(<%! %>) 등 공유 멤버변수에 사용자별 데이터를 저장하는가', p2: '요청 단위 지역변수 사용 여부',
    req: ['사용자별 데이터는 세션·요청 범위에 저장한다.', '멀티스레드 공유 멤버변수에 사용자 데이터를 두지 않는다.'],
    guide: 'JSP 선언부 변수는 모든 사용자에게 공유되므로, 사용자 데이터는 스크립틀릿 지역변수 또는 세션에 저장한다.',
    kwDefect: ['선언부', '공유', '멤버변수'], kwVerdict: ['결함', '세션', '다른 사용자'], kwFix: ['지역변수', '요청 단위', '분리'] },
  'IMP-EN-02': { p1: '배포 코드에 디버그 코드(main·출력문)가 남아 있는가', p2: '배포 전 제거 여부',
    req: ['배포 소스에는 디버깅 목적 코드를 남기지 않는다.', '디버그 정보 출력(시스템 정보 등)을 금지한다.'],
    guide: 'J2EE 컴포넌트의 main() 등 테스트용 진입점과 콘솔 출력 디버그 코드는 배포 전 제거한다.',
    kwDefect: ['디버그', '남', 'main'], kwVerdict: ['결함', '제거되지 않', '정보'], kwFix: ['제거', '배포 전', '삭제'] },
  'IMP-EN-03': { p1: 'private 배열을 public 메소드가 그대로 반환하는가', p2: '복제본 반환 여부',
    req: ['private 배열은 외부에 직접 반환하지 않는다.', '반환이 필요하면 복제본(clone)을 반환한다.'],
    guide: 'getter 에서 배열 참조를 그대로 반환하지 말고 clone() 으로 복사해 반환하며, 원소가 객체면 원소도 복사한다.',
    kwDefect: ['private 배열', '그대로', '반환'], kwVerdict: ['결함', '참조', '외부 수정'], kwFix: ['clone', '복사', '복제본'] },
  'IMP-EN-04': { p1: 'public 으로 받은 배열을 private 배열에 그대로 할당하는가', p2: '방어적 복사 여부',
    req: ['외부에서 받은 배열은 복사하여 private 멤버에 저장한다.', '외부 참조로 내부 상태가 변경되지 않게 한다.'],
    guide: 'setter 에서 전달받은 배열을 참조 할당하지 말고 clone()·복사로 저장한다(원소가 객체면 원소도 복사).',
    kwDefect: ['할당', '그대로', 'public'], kwVerdict: ['결함', 'private', '변경'], kwFix: ['방어적 복사', 'clone', '복사'] },
  'IMP-AA-01': { p1: '호스트명(DNS 조회 결과)으로 신뢰 여부를 판단하는가', p2: 'IP 직접 비교·상호 인증 여부',
    req: ['보안결정에 DNS 조회 결과(호스트명)를 사용하지 않는다.', '신뢰 판단은 IP 직접 비교 또는 인증서 기반으로 한다.'],
    guide: 'getCanonicalHostName() 비교 대신 신뢰 IP 주소를 직접 비교하거나 TLS 상호 인증을 적용한다.',
    kwDefect: ['DNS', '호스트', '판단'], kwVerdict: ['결함', '스푸핑', '위장'], kwFix: ['IP 주소', '직접 비교', '인증'] },
  'IMP-AA-02': { p1: 'gets() 등 경계 검사 없는 취약 API 를 사용하는가', p2: '안전 대체 API 사용 여부',
    req: ['버퍼 경계를 검사하지 않는 취약 API 사용을 금지한다.', '안전한 대체 함수(gets_s, fgets 등)를 사용한다.'],
    guide: '금지 API 목록(gets, strcpy 등)을 개발가이드에 두고, 크기 인자를 받는 안전 함수로 대체한다.',
    kwDefect: ['gets', '취약', 'API'], kwVerdict: ['결함', '버퍼', '오버플로우'], kwFix: ['gets_s', '대체', '안전한 함수'] },
};

// ── 문항 생성 ───────────────────────────────────────────────────────────
const abbr = (id) => id.replace(/^IMP-/, '').replace(/-/g, ''); // IV02 형태
const questions = [];
for (const [cid, sp] of Object.entries(SPEC)) {
  const it = byId.get(cid);
  if (!it) { console.warn('라이브러리 항목 없음:', cid); continue; }
  const ce = (it.codeExamples || [])[0] || {};
  const title = it.title;
  const rq = abbr(cid);

  questions.push({
    question_type: 'composite',
    stage: 'implementation',
    chapter_code: cid,
    weakness_code: `${cid}-C1`,
    weakness_name_ko: title.replace(/\s*\(.*\)$/, ''),
    weakness_category: CAT_ENUM[it.category] || 'input_validation',
    language: langEnum(ce.lang),
    difficulty: '상',
    body: `다음은 어느 웹 서비스 프로젝트의 구현 단계 산출물(보안요구사항명세서·개발가이드·개발산출물 소스코드)이다. '${title}' 항목의 적용 여부를 진단하고 결함을 식별하여 진단보고서를 작성하시오. (8점)\n\n진단 시 ① ${sp.p1}, ② ${sp.p2}를 확인하고, 결함이 있다면 현황·문제점과 개선방안을 제시한다.`,
    reference: `소프트웨어 보안약점 진단가이드(2021) — ${cid} ${title} (overview·countermeasure·code_examples)`,
    tags: [CAT_ENUM[it.category] || 'input_validation', 'implementation', '복합서술형', '진단보고서', '산출물'],
    is_active: true,
    artifacts: [
      {
        type: '보안요구사항명세서',
        title: `보안요구사항명세서 — ${title}(REQ-${rq})`,
        content: sp.req.map((r, i) => `REQ-${rq}-0${i + 1} ${r}`).join('\n'),
      },
      {
        type: '개발가이드',
        title: `시큐어코딩 개발가이드 — ${title}`,
        content: sp.guide,
      },
      {
        type: '개발산출물',
        title: `개발산출물 소스코드${ce.lang ? ` (${ce.lang})` : ''}`,
        content: ce.vulnerable || '(코드 없음)',
      },
    ],
    rubric: [
      {
        item: `결함 진단 — ${sp.p1}`,
        method: `개발산출물 코드에서 REQ-${rq}-01 위반 지점을 특정하고 위반임을 서술.`,
        points: 3,
        artifact_ref: `개발산출물 ↔ REQ-${rq}-01`,
        required_keywords: sp.kwDefect,
      },
      {
        item: '판정 및 현황·문제점 서술',
        method: '진단항목에 대해 결함 판정을 내리고, 방치 시 영향(공격 시나리오)을 현황·문제점으로 서술.',
        points: 3,
        artifact_ref: '진단보고서(판정·현황 및 문제점)',
        required_keywords: sp.kwVerdict,
      },
      {
        item: '개선방안 제시',
        method: `개발가이드 기준의 안전한 구현 방법으로 개선방안을 제시.`,
        points: 2,
        artifact_ref: `개발가이드 ↔ REQ-${rq}-02`,
        required_keywords: sp.kwFix,
      },
    ],
    report_template: { sections: ['진단항목', '판정', '현황 및 문제점', '개선방안'] },
    explanation: `복합서술형(8점). ${cid} 진단가이드 code_examples(취약/안전)와 대응방안을 채점 근거로 사용한다.\n\n[진단 흐름] (1) 보안요구사항명세서 REQ-${rq}-01/02 수립 확인 → (2) 개발가이드 규칙 확인 → (3) 개발산출물 코드에서 위반 지점 식별: ${sp.p1}. → 판정: 결함.\n\n[원문 해설] ${ce.note || it.summary}\n\n[개선방안] ${sp.guide}`,
  });
}

const outFile = join(root, 'kisa-module/seed/composite-impl-expansion.json');
writeFileSync(outFile, JSON.stringify({ questions }, null, 2));
console.log(`[composite-impl] ${questions.length}문항 생성 → ${outFile}`);
