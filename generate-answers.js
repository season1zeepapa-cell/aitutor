// 네트워크관리사2급 정답 판별 + HTML 해설 생성 스크립트
require('dotenv').config();
const { query } = require('./api/db');

// HTML 해설 생성 헬퍼
function buildHtml(answerNum, choices, reasoning, wrongMap) {
  const nums = ['①', '②', '③', '④'];
  const texts = choices.map(c => {
    if (typeof c === 'string') return c;
    return c.text || c.label || '';
  });
  const answerText = texts[answerNum - 1] || '';

  let wrongHtml = '';
  for (let i = 0; i < texts.length; i++) {
    if (i === answerNum - 1) continue;
    const analysis = wrongMap[i + 1] || '해당 선택지는 정답이 아닙니다.';
    wrongHtml += `  <p>${nums[i]} ${texts[i]} — ${analysis}</p>\n`;
  }

  return `<p class="exp-answer">✅ 정답: <strong>${nums[answerNum - 1]} ${answerText}</strong></p>
<div class="exp-section">
  <div class="exp-section-title">📖 해설</div>
  <p>${reasoning}</p>
</div>
<div class="exp-section">
  <div class="exp-section-title">❌ 오답 분석</div>
${wrongHtml}</div>`;
}

// ============================================================
// 250문제 정답 + 해설 데이터
// key: "examId-questionNumber"
// ============================================================
const answersByExamQ = {
  // ===== 2025년 정기1회 (exam_id=156) =====
  '156-1': { answer: 1, reasoning: 'TTL(Time To Live)은 IP 패킷이 네트워크상에서 무한히 순환하는 것을 방지하기 위한 필드입니다. 라우터를 통과할 때마다 1씩 감소하며, 0이 되면 패킷이 폐기됩니다. 따라서 "영원히 존재할 수 있다"는 설명은 TTL의 목적과 정반대입니다.', wrong: {2: '라우터 한 홉을 통과할 때마다 TTL 값이 1씩 감소하는 것은 올바른 설명입니다.', 3: 'Ping과 Tracert는 TTL 값을 활용하여 호스트 접근 및 경로 추적을 수행합니다.', 4: 'TTL은 IP 패킷의 네트워크 생존 기간을 나타내는 필드로 정확한 설명입니다.'} },
  '156-2': { answer: 1, reasoning: '191.234.149.32는 첫 번째 옥텟이 191로 B Class(128~191) 범위에 해당합니다. 나머지 보기들은 198, 222, 195로 모두 C Class(192~223) 범위입니다. 따라서 Class가 다른 주소는 191.234.149.32입니다.', wrong: {2: '198.236.115.33은 C Class(192~223)에 해당합니다.', 3: '222.236.138.34는 C Class(192~223)에 해당합니다.', 4: '195.236.126.35는 C Class(192~223)에 해당합니다.'} },
  '156-3': { answer: 3, reasoning: 'C Class에서 6개의 서브넷을 만들려면 서브넷 비트가 최소 3비트 필요합니다(2^3=8≥6). 3비트를 서브넷에 사용하면 서브넷 마스크는 255.255.255.224(11100000)가 됩니다.', wrong: {1: '255.255.255.0은 서브네팅을 하지 않은 기본 C Class 마스크입니다.', 2: '255.255.255.192는 2비트 서브넷으로 4개의 서브넷만 생성 가능합니다.', 4: '255.255.255.240은 4비트 서브넷으로 16개 서브넷이 생성되어 과도합니다.'} },
  '156-4': { answer: 4, reasoning: 'IPv6 헤더에서 Hop Limit 필드는 IPv4의 TTL에 해당하며, 데이터그램의 네트워크 내 생존 기간을 제어합니다. 라우터를 통과할 때마다 1씩 감소하며 0이 되면 패킷이 폐기됩니다.', wrong: {1: 'Version은 IP 프로토콜의 버전(IPv6=6)을 나타내는 필드입니다.', 2: 'Priority(Traffic Class)는 패킷의 우선순위를 지정하는 필드입니다.', 3: 'Next Header는 다음 확장 헤더 또는 상위 프로토콜을 식별하는 필드입니다.'} },
  '156-5': { answer: 2, reasoning: 'TCP는 연결 지향적이고 신뢰성 있는 프로토콜로, 화상 통신과 같은 실시간 통신에는 부적합합니다. 실시간 통신에는 오버헤드가 적은 UDP가 사용됩니다.', wrong: {1: 'TCP는 동적 슬라이딩 윈도우 방식으로 흐름 제어를 수행합니다.', 3: 'TCP는 에러 제어를 통해 신뢰성 있는 데이터 전송을 보장합니다.', 4: 'TCP는 Three Way Handshaking으로 연결을 설정합니다.'} },
  '156-6': { answer: 1, reasoning: 'UDP 헤더에는 소스 포트, 목적지 포트, 길이, 체크섬 4개 필드만 포함됩니다. 확인 응답 번호(Acknowledgment Number)는 TCP 헤더에만 존재합니다.', wrong: {2: '소스 포트는 UDP 헤더의 구성 요소입니다.', 3: '체크섬은 UDP 헤더에 포함된 오류 검출 필드입니다.', 4: '목적지 포트는 UDP 헤더의 구성 요소입니다.'} },
  '156-7': { answer: 1, reasoning: 'ICMP Type 3은 "Destination Unreachable(목적지 도달 불가)" 메시지입니다. Echo Reply는 Type 0이고, Echo Request는 Type 8입니다.', wrong: {2: 'Type 4는 Source Quench로 흐름제어 및 폭주제어에 사용됩니다.', 3: 'Type 5는 Redirect로 대체경로를 알리기 위해 라우터가 사용합니다.', 4: 'Type 17은 Address Mask Request로 서브넷 마스크를 요구합니다.'} },
  '156-8': { answer: 2, reasoning: 'Broadcast는 같은 네트워크상의 모든 호스트에게 데이터를 전송하는 방식입니다.', wrong: {1: 'Unicast는 특정 한 호스트에게만 데이터를 전송하는 1:1 통신 방식입니다.', 3: 'Multicast는 특정 그룹에 속한 호스트들에게만 전송하는 방식입니다.', 4: 'UDP는 전송 프로토콜이지 전송 방식이 아닙니다.'} },
  '156-9': { answer: 1, reasoning: 'SNMP는 UDP를 사용하는 프로토콜입니다(포트 161/162). TCP를 이용한다는 설명이 잘못되었습니다.', wrong: {2: 'SNMP는 네트워크 관리를 위한 표준 프로토콜입니다.', 3: 'SNMP는 응용 계층에서 동작합니다.', 4: 'SNMP는 RFC 1157에 규정되어 있습니다.'} },
  '156-10': { answer: 2, reasoning: 'IPv6 주소는 128비트로 16진수 8그룹을 콜론으로 구분합니다. 3ffe:1900:4545:0003:0200:f8ff:ffff:1105가 올바른 IPv6 주소 형식입니다.', wrong: {1: '192.168.1.30은 IPv4 주소 형식입니다.', 3: '00:A0:C3:4B:21:33은 MAC 주소 형식입니다.', 4: '0000:002A:0080:c703:3c75는 5그룹으로 유효한 IPv6 형식이 아닙니다.'} },
  '156-11': { answer: 4, reasoning: 'OSI 7계층의 PDU는 7계층-데이터, 4계층-세그먼트, 3계층-패킷, 2계층-프레임, 1계층-비트입니다. "2계층: 프레임"이 올바릅니다.', wrong: {1: '7계층의 PDU는 세그먼트가 아니라 데이터(메시지)입니다.', 2: '4계층의 PDU는 패킷이 아니라 세그먼트입니다.', 3: '3계층의 PDU는 비트가 아니라 패킷입니다.'} },
  '156-12': { answer: 4, reasoning: '네트워크 ID가 127로 시작하는 주소는 루프백(Loopback) 주소로 예약되어 있습니다. 자기 자신에게 데이터를 보내는 테스트용입니다.', wrong: {1: '제한적 브로드캐스트 주소는 255.255.255.255입니다.', 2: '멀티캐스트 주소는 224~239 대역입니다.', 3: 'C Class 사설 IP는 192.168.0.0~192.168.255.255입니다.'} },
  '156-13': { answer: 2, reasoning: 'SMTP(Simple Mail Transfer Protocol)는 전자우편 송신을 위한 표준 프로토콜입니다.', wrong: {1: 'SNMP는 네트워크 관리 프로토콜입니다.', 3: 'VT(Virtual Terminal)는 가상 터미널 프로토콜입니다.', 4: 'FTP는 파일 전송 프로토콜입니다.'} },
  '156-14': { answer: 4, reasoning: 'FTP는 TCP를 사용하는 프로토콜이며, UDP와 69번 포트를 사용하는 것은 TFTP입니다.', wrong: {1: 'FTP 세션 설정 후 파일 송수신으로 원격 파일 복사가 가능합니다.', 2: 'FTP 서버는 20번 포트로 데이터 채널 연결을 시도합니다.', 3: '데이터 채널은 파일 송수신 시마다 설정/해제됩니다.'} },
  '156-15': { answer: 3, reasoning: 'DNS는 도메인 이름을 IP 주소로 변환하는 서비스이지, 방화벽과 같은 보안 장비가 아닙니다.', wrong: {1: 'DNS는 도메인 이름을 IP 주소로 변환합니다.', 2: 'DNS는 라운드 로빈 방식으로 로드 밸런싱을 제공합니다.', 4: 'DNS는 캐싱을 통해 조회 결과를 저장합니다.'} },
  '156-16': { answer: 3, reasoning: 'OSI 모델에서 송신 시 각 계층에서 헤더를 추가하는 과정이 캡슐화(A), 수신 시 헤더를 제거하는 과정이 역캡슐화(B)입니다.', wrong: {1: '암호화/복호화는 데이터 보안 관련 용어입니다.', 2: '복호화/암호화는 순서가 반대입니다.', 4: '역캡슐화/캡슐화는 순서가 반대입니다.'} },
  '156-17': { answer: 3, reasoning: 'ARP는 각 시스템에 ARP Cache를 유지하며, 이전에 조회한 IP-MAC 매핑 정보를 캐시에 보관합니다.', wrong: {1: 'ARP는 수신측의 물리주소(MAC)를 모르기 때문에 브로드캐스트하며, 논리주소(IP)는 알고 있습니다.', 2: 'ARP Reply는 유니캐스트로 전송됩니다.', 4: 'ARP는 IP를 MAC으로 변환합니다(반대가 아님).'} },
  '156-18': { answer: 3, reasoning: 'Loop/Echo는 전송 데이터의 무결성 확인 방법이며, 데이터 흐름 제어 기법이 아닙니다.', wrong: {1: 'Stop and Wait는 기본적인 흐름 제어 방식입니다.', 2: 'XON/XOFF는 소프트웨어 기반 흐름 제어 방식입니다.', 4: 'Sliding Window는 대표적인 흐름 제어 방식입니다.'} },
  '156-19': { answer: 3, reasoning: '텍스트의 압축, 암호화 기능은 표현 계층(6계층)의 기능입니다. 데이터 링크 계층(2계층)은 프레이밍, 오류 제어, 흐름 제어를 담당합니다.', wrong: {1: '전송 오류제어는 데이터 링크 계층의 핵심 기능입니다.', 2: '흐름 제어는 데이터 링크 계층의 기능입니다.', 4: '링크 관리는 데이터 링크 계층의 기능입니다.'} },
  '156-20': { answer: 3, reasoning: '성형(Star) 토폴로지에서 하나의 단말장치 고장은 다른 단말에 영향을 주지 않습니다. 중앙 허브 고장 시에만 전체에 영향을 줍니다.', wrong: {1: '성형은 point-to-point 방식으로 연결됩니다.', 2: '단말장치 추가/제거가 용이합니다.', 4: '각 단말은 중앙 컴퓨터를 통해 데이터를 교환합니다.'} },
  '156-21': { answer: 3, reasoning: 'CSMA/CD는 이더넷에서 사용하는 매체 접근 제어 방식으로, 전송 전 채널을 감지하고 충돌 발생 시 재전송합니다.', wrong: {1: 'Token Ring은 토큰을 순환시켜 전송 권한을 부여합니다.', 2: 'Token Bus는 버스 토폴로지에서 토큰을 사용합니다.', 4: 'Slotted Ring은 고정 크기 슬롯을 순환시키는 방식입니다.'} },
  '156-22': { answer: 1, reasoning: '타이밍(Timing)은 실체 간 통신 속도 및 메시지 순서를 위한 제어정보입니다.', wrong: {2: '의미(Semantics)는 비트의 의미와 해석에 관한 규칙입니다.', 3: '구문(Syntax)은 데이터의 형식, 코딩 등의 구조를 정의합니다.', 4: '처리(Process)는 프로토콜의 기본 구성요소가 아닙니다.'} },
  '156-23': { answer: 4, reasoning: '광섬유 케이블(Optical Fiber Cable)은 빛을 이용하여 장거리 고속 전송에 적합합니다.', wrong: {1: 'U/UTP CAT.3는 비차폐 꼬임쌍선으로 음성 통신용입니다.', 2: 'Thin Coaxial Cable은 얇은 동축 케이블입니다.', 3: 'U/FTP CAT.5는 차폐 꼬임쌍선 케이블입니다.'} },
  '156-24': { answer: 1, reasoning: 'MIMO(Multiple-Input and Multiple-Output)는 다수의 안테나를 사용하는 다중 안테나 신호 처리 기술입니다.', wrong: {2: 'M2M은 기계 간 통신 기술입니다.', 3: 'MQTT는 IoT용 경량 메시징 프로토콜입니다.', 4: 'OFDM은 직교 주파수 분할 다중화 기술입니다.'} },
  '156-25': { answer: 3, reasoning: '사설 클라우드는 특정 조직 내부 사용자만 접근할 수 있습니다. "회사 내·외부 모든 이용자들이 공유"하는 것은 공용 클라우드 설명입니다.', wrong: {1: '클라우드는 통신환경에 의존하며 데이터 위치 파악이 어렵습니다.', 2: '공용 클라우드는 외부 서비스 제공자가 관리합니다.', 4: '하이브리드 클라우드는 공용과 사설을 혼용합니다.'} },
  '156-26': { answer: 3, reasoning: 'SDN(Software Defined Networks)은 네트워크의 제어 평면과 데이터 평면을 분리하여 소프트웨어로 프로그래밍할 수 있게 합니다.', wrong: {1: 'Wireless sensor networks는 센서 노드 무선 네트워크입니다.', 2: 'Wireless mesh networks는 무선 메시 네트워크입니다.', 4: 'Content delivery networks는 콘텐츠 분산 전달 네트워크입니다.'} },
  '156-27': { answer: 4, reasoning: 'Transport Layer(전송 계층, 4계층)는 흐름 제어 및 오류 없는 종단 간 전송을 보장합니다.', wrong: {1: 'Session Layer는 세션 설정/관리/종료를 담당합니다.', 2: 'Physical Layer는 물리적 신호 전송을 담당합니다.', 3: 'Network Layer는 라우팅과 패킷 전달을 담당합니다.'} },
  '156-28': { answer: 2, reasoning: 'TCP 포트는 네트워크 포트 번호(기본 80)이지, 물리적인 시리얼 포트가 아닙니다.', wrong: {1: 'IP 주소 필드에서 사이트가 사용할 IP를 지정합니다.', 3: '연결 수 제한은 동시 접속 수를 제한합니다.', 4: '연결 시간 제한은 비활성 세션 타임아웃을 설정합니다.'} },
  '156-29': { answer: 4, reasoning: 'NS 레코드는 네임서버 정보를 제공합니다. "사서함 라우팅 정보 제공"은 MX 레코드의 역할입니다.', wrong: {1: 'A 레코드는 도메인→IPv4 매핑입니다.', 2: 'AAAA 레코드는 도메인→IPv6 매핑입니다.', 3: 'CNAME은 도메인 별칭입니다.'} },
  '156-30': { answer: 2, reasoning: 'Hyper-V는 서버 가용성을 향상시킵니다. "줄어든다"는 잘못된 설명입니다.', wrong: {1: 'Hyper-V는 하드웨어 사용률을 높여줍니다.', 3: '가상화로 유지비용을 절감할 수 있습니다.', 4: '개발/테스트 효율성이 향상됩니다.'} },
  '156-31': { answer: 4, reasoning: '데몬은 시스템 부팅 시뿐만 아니라 수동으로도 시작할 수 있습니다.', wrong: {1: '데몬은 백그라운드에서 실행됩니다.', 2: 'ps afx로 데몬 활동을 확인할 수 있습니다.', 3: '데몬은 시스템 서비스를 지원하는 프로세스입니다.'} },
  '156-32': { answer: 4, reasoning: 'chmod 644는 소유자에게 rw-, 그룹/기타에게 r--를 부여합니다. 볼 수 있지만 수정 불가능합니다.', wrong: {1: '777은 모든 권한을 부여합니다.', 2: '666은 모든 사용자에게 읽기+쓰기를 부여합니다.', 3: '646은 그룹에 읽기만, 기타에 읽기+쓰기로 일관성이 없습니다.'} },
  '156-33': { answer: 3, reasoning: 'pwd(Print Working Directory)는 현재 디렉터리의 절대경로를 출력합니다.', wrong: {1: 'cd는 디렉터리 변경 명령어입니다.', 2: 'man은 매뉴얼 페이지 명령어입니다.', 4: 'cron은 예약 작업 스케줄러입니다.'} },
  '156-34': { answer: 2, reasoning: '/etc/passwd에서 x는 패스워드가 /etc/shadow에 암호화되어 저장됨을 의미합니다. 실제 패스워드가 x가 아닙니다.', wrong: {1: '첫 번째 필드 user1은 사용자 계정 ID입니다.', 3: 'UID와 GID가 500이면 맞는 설명입니다.', 4: '/bin/bash는 기본 셸을 나타냅니다.'} },
  '156-35': { answer: 2, reasoning: '서버가 SYN 패킷을 수신하면 LISTEN에서 SYN_RECEIVED 상태로 변경됩니다.', wrong: {1: 'SYN_SENT는 클라이언트 상태입니다.', 3: 'ESTABLISHED는 연결 완료 후 상태입니다.', 4: 'CLOSE는 연결 종료 상태입니다.'} },
  '156-36': { answer: 1, reasoning: 'Round Robin DNS는 하나의 도메인에 여러 IP를 등록하여 순차적으로 반환하는 부하 분산 방식입니다.', wrong: {2: 'Cache Plugin은 DNS 부하 분산 방식이 아닙니다.', 3: 'Cache Server는 캐시 서버입니다.', 4: 'Azure AutoScaling은 클라우드 자동 스케일링입니다.'} },
  '156-37': { answer: 3, reasoning: 'init 6은 재부팅 명령이지 종료 명령이 아닙니다. init 0이 종료입니다.', wrong: {1: 'shutdown -h now는 즉시 종료 명령입니다.', 2: 'poweroff는 종료 명령입니다.', 4: 'halt는 종료 명령입니다.'} },
  '156-38': { answer: 2, reasoning: 'ipconfig /flushdns는 DNS 캐시를 초기화하는 명령어입니다.', wrong: {1: '/displaydns는 DNS 캐시 내용 표시 명령입니다.', 3: '/release는 IP 해제 명령입니다.', 4: '/renew는 IP 갱신 명령입니다.'} },
  '156-39': { answer: 4, reasoning: 'netstat는 네트워크 연결 상태와 열린 포트를 확인하는 명령어입니다.', wrong: {1: 'ps는 프로세스 목록 명령어입니다.', 2: 'pstree는 프로세스 트리 명령어입니다.', 3: 'getenforce는 SELinux 상태 확인 명령어입니다.'} },
  '156-40': { answer: 2, reasoning: 'LimitRequestBody는 Apache에서 HTTP 요청 본문 최대 크기를 제한하는 지시자입니다.', wrong: {1: 'KeepRequestSize는 유효한 지시자가 아닙니다.', 3: 'RestrictBodyRequest는 유효한 지시자가 아닙니다.', 4: 'PostRequestSize는 유효한 지시자가 아닙니다.'} },
  '156-41': { answer: 2, reasoning: 'SSH(Secure Shell)는 암호화된 안전한 원격 접속을 제공하는 프로토콜입니다.', wrong: {1: 'SSL은 웹 통신 보안 프로토콜입니다.', 3: 'TLS는 전송 계층 보안 프로토콜입니다.', 4: 'RDP는 Windows 원격 데스크톱 프로토콜입니다.'} },
  '156-42': { answer: 3, reasoning: 'OU(Organizational Unit)는 도메인 내 사용자/그룹을 부서별로 세분화하여 관리하는 단위입니다.', wrong: {1: 'DC는 도메인을 관리하는 서버입니다.', 2: 'RODC는 읽기 전용 도메인 컨트롤러입니다.', 4: 'Site는 물리적 네트워크 위치 단위입니다.'} },
  '156-43': { answer: 2, reasoning: 'Home Directory는 사용자에게 할당되어 임의로 사용할 수 있는 디렉터리입니다.', wrong: {1: 'Root Directory(/)는 최상위 디렉터리입니다.', 3: 'Temporary Directory(/tmp)는 임시 파일용입니다.', 4: 'Public Directory는 공유 디렉터리입니다.'} },
  '156-44': { answer: 4, reasoning: 'DHCP 서버에서 주소 분배 시 지연시간을 밀리초(ms) 단위로 지정할 수 있습니다.', wrong: {1: 'DHCP 임대 기간에 초 단위는 포함되지 않습니다.', 2: 'DHCP 범위 구성 시 WINS 서버도 구성할 수 있습니다.', 3: '예약 구성 시 DHCP와 BOOTP 모두 지원됩니다.'} },
  '156-45': { answer: 4, reasoning: 'fdisk는 디스크 파티션 관리 명령이지 파일시스템 점검이 아닙니다. 파일시스템 점검은 fsck입니다.', wrong: {1: 'mkfs는 파일시스템 생성 명령입니다.', 2: 'du는 디스크 사용량 확인 명령입니다.', 3: 'mount는 외부 장치 연결 명령입니다.'} },
  '156-46': { answer: 3, reasoning: 'L2 스위치는 프레임의 목적지 MAC 주소를 확인하여 전송합니다.', wrong: {1: 'IP 주소는 L3 장비가 사용합니다.', 2: 'Port 주소는 L4에서 사용됩니다.', 4: 'URL은 응용 계층에서 사용됩니다.'} },
  '156-47': { answer: 4, reasoning: 'IEEE 802.11ax(Wi-Fi 6)는 OFDMA, MU-MIMO 등을 지원하는 최신 Wi-Fi 표준입니다.', wrong: {1: '802.11n은 OFDMA 미지원입니다.', 2: '802.11ac는 OFDMA 미지원입니다.', 3: '802.11be(Wi-Fi 7)는 차세대 표준입니다.'} },
  '156-48': { answer: 1, reasoning: '게이트웨이는 다른 프로토콜을 사용하는 네트워크 간의 인터페이스입니다.', wrong: {2: '케이블 집선 장치는 허브입니다.', 3: '신호 증폭은 리피터입니다.', 4: 'MAC 캐시 테이블은 브리지/스위치입니다.'} },
  '156-49': { answer: 1, reasoning: 'NAC(Network Access Control)는 단말기 보안 상태를 점검하고 접근을 제어하는 솔루션입니다.', wrong: {2: 'NAT는 네트워크 주소 변환 기술입니다.', 3: 'IP제어는 특정 솔루션을 지칭하지 않습니다.', 4: 'WAF는 웹 애플리케이션 방화벽입니다.'} },
  '156-50': { answer: 4, reasoning: 'RAID는 여러 물리적 드라이브를 하나의 논리적 드라이브로 활용합니다. 설명이 반대로 되어 있습니다.', wrong: {1: 'RAID는 병렬 전송으로 속도를 향상시킵니다.', 2: 'RAID 1은 데이터를 중복 저장합니다.', 3: '핫스왑으로 가동 중 디스크 교체가 가능합니다.'} },

  // ===== 2025년 정기2회 (exam_id=157) =====
  '157-1': { answer: 1, reasoning: '캡슐화(Encapsulation)는 사용자 정보에 헤더와 트레일러를 부가하는 과정입니다.', wrong: {2: '동기화는 타이밍을 맞추는 기능입니다.', 3: '다중화는 여러 신호를 결합하는 기능입니다.', 4: '주소지정은 출발지/목적지를 지정하는 기능입니다.'} },
  '157-2': { answer: 3, reasoning: 'Class A의 기본 서브넷 마스크는 255.0.0.0입니다. 254.0.0.0은 올바르지 않습니다.', wrong: {1: 'IP Address 체계는 Network ID와 Host ID로 구분됩니다.', 2: '서브넷 마스크로 같은 네트워크 여부를 확인합니다.', 4: 'Network ID는 1, Host ID는 0으로 채웁니다.'} },
  '157-3': { answer: 2, reasoning: 'IGMP는 멀티캐스트 통신을 위한 프로토콜이며, 유니캐스트와 관련이 없습니다.', wrong: {1: 'IGMP 메시지에 TTL이 제공됩니다.', 3: 'IGMPv1은 첫 보고 메시지 손실 시 재전송하지 않습니다.', 4: 'IGMP는 호스트-라우터 간 비대칭 통신 구조입니다.'} },
  '157-4': { answer: 2, reasoning: '서브넷 마스크 255.255.255.192에서 상위 2비트가 서브넷으로 사용되어 2^2=4개 서브넷입니다.', wrong: {1: '2개는 1비트 서브넷의 경우입니다.', 3: '192는 마스크 값이지 서브넷 수가 아닙니다.', 4: '1024는 이 마스크에서 나올 수 없습니다.'} },
  '157-5': { answer: 2, reasoning: 'TFTP는 UDP를 사용합니다(포트 69). FTP, Telnet, SMTP는 TCP를 사용합니다.', wrong: {1: 'FTP는 TCP를 사용합니다.', 3: 'Telnet은 TCP를 사용합니다.', 4: 'SMTP는 TCP를 사용합니다.'} },
  '157-6': { answer: 2, reasoning: 'ICMP Type 5는 Redirect이며, Echo Request는 Type 8입니다.', wrong: {1: 'Type 0은 Echo Reply입니다.', 3: 'Type 13은 Timestamp Request입니다.', 4: 'Type 17은 Address Mask Request입니다.'} },
  '157-7': { answer: 1, reasoning: 'IPv6는 IETF에서 IPv4 주소 고갈 문제의 해결 방안으로 개발했습니다.', wrong: {2: 'IPv6가 확장 헤더를 통해 더 다양한 옵션 설정이 가능합니다.', 3: 'IPv6 주소 유형은 유니캐스트, 멀티캐스트, 애니캐스트입니다.', 4: 'IPv6는 브로드캐스트를 지원하지 않습니다.'} },
  '157-8': { answer: 3, reasoning: 'Window 필드는 TCP 헤더에만 존재합니다. UDP 헤더에는 Source Port, Destination Port, Length, Checksum만 있습니다.', wrong: {1: 'Source Port는 UDP 헤더 요소입니다.', 2: 'Destination Port는 UDP 헤더 요소입니다.', 4: 'Checksum은 UDP 헤더 요소입니다.'} },
  '157-9': { answer: 4, reasoning: 'IP 프로토콜은 MTU보다 큰 데이터그램에 대해 단편화를 수행합니다.', wrong: {1: 'IP는 신뢰성을 보장하지 않습니다.', 2: 'IP는 재전송 기능이 없습니다.', 3: 'IP는 흐름 제어가 없습니다.'} },
  '157-10': { answer: 4, reasoning: 'ARP 캐시에 유효한 매핑이 있으면 매번 MAC 주소를 다시 요청할 필요가 없습니다.', wrong: {1: '새 ARP 항목은 TTL 값을 가집니다.', 2: '미사용 시 캐시에서 삭제됩니다.', 3: '재사용 시 TTL이 재설정될 수 있습니다.'} },
  '157-11': { answer: 4, reasoning: 'FTP는 제어용 포트 21과 데이터용 포트 20을 분리하여 사용합니다.', wrong: {1: 'DNS는 포트 53 하나만 사용합니다.', 2: 'SMTP는 포트 25 하나만 사용합니다.', 3: 'TFTP는 포트 69 하나만 사용합니다.'} },
  '157-12': { answer: 2, reasoning: '128.52.10.6은 사설 IP 대역(10.x, 172.16~31.x, 192.168.x)에 해당하지 않습니다.', wrong: {1: '10.100.12.5는 사설 대역입니다.', 3: '172.25.30.5는 사설 대역입니다.', 4: '192.168.200.128은 사설 대역입니다.'} },
  '157-13': { answer: 3, reasoning: 'TCP/IP 구성 파라미터 확인은 ipconfig/ifconfig 명령의 기능이며 Ping과 무관합니다.', wrong: {1: 'Ping은 ICMP 메시지를 이용합니다.', 2: 'Ping은 Echo Request/Reply를 사용합니다.', 4: 'Ping은 TCP/IP 연결성을 테스트합니다.'} },
  '157-14': { answer: 1, reasoning: 'SMTP는 메일 송신, POP3는 메일 수신 프로토콜입니다.', wrong: {2: 'POP3는 로컬 다운로드 방식이며 IMAP이 서버 보관 방식입니다.', 3: 'POP3도 전자 메일 핵심 프로토콜입니다.', 4: 'SMTP와 POP3/IMAP은 역할이 분리되어 있습니다.'} },
  '157-15': { answer: 1, reasoning: 'OSPF는 링크 상태 알고리즘을 사용하는 내부 라우팅 프로토콜입니다.', wrong: {2: 'RIP는 거리 벡터 알고리즘을 사용합니다.', 3: 'EGP는 외부 게이트웨이 프로토콜입니다.', 4: 'BGP는 외부 라우팅 프로토콜입니다.'} },
  '157-16': { answer: 4, reasoning: 'HTTPS는 HTTP에 TLS/SSL 암호화를 적용한 프로토콜입니다.', wrong: {1: 'SMTP는 기본적으로 TLS가 적용되지 않습니다.', 2: 'FTP는 기본적으로 암호화되지 않습니다.', 3: 'Telnet은 암호화되지 않습니다.'} },
  '157-17': { answer: 4, reasoning: 'DNS 호스트 이름은 영문자, 숫자, 하이픈(-)으로 구성됩니다. @, # 등의 특수 문자는 사용할 수 없습니다.', wrong: {1: 'DNS는 IP 대신 계층적 호스트 이름을 사용합니다.', 2: 'DNS는 분산 데이터베이스입니다.', 3: 'DNS 호스트 이름은 도메인으로 그룹화됩니다.'} },
  '157-18': { answer: 1, reasoning: 'Adaptive ARQ는 프레임 길이를 동적으로 변경하여 전송효율을 최대화합니다.', wrong: {2: 'Go back-N은 오류 발생 시 해당 프레임부터 재전송합니다.', 3: 'Selective-Repeat은 오류 프레임만 재전송합니다.', 4: 'Stop and Wait는 하나씩 전송 후 확인합니다.'} },
  '157-19': { answer: 1, reasoning: 'TDM은 고정 타임 슬롯을 할당하므로 전송 데이터가 없어도 슬롯이 낭비됩니다.', wrong: {2: 'STDM은 데이터 있는 채널에만 슬롯을 할당합니다.', 3: 'FDM은 주파수 분할 방식입니다.', 4: 'FDMA는 주파수 분할 다중 접속입니다.'} },
  '157-20': { answer: 2, reasoning: 'Star 토폴로지는 중앙 관리가 가능하고 컴퓨터 추가가 용이합니다.', wrong: {1: 'Bus는 중앙 관리가 어렵습니다.', 3: 'Ring은 노드 추가가 어렵습니다.', 4: 'Mesh는 구성이 복잡합니다.'} },
  '157-21': { answer: 4, reasoning: 'Fast Ethernet은 100BASE-T로 100Mbps를 지원합니다.', wrong: {1: 'Ethernet은 10Mbps입니다.', 2: 'Gigabit Ethernet은 1Gbps입니다.', 3: '10Giga Ethernet은 10Gbps입니다.'} },
  '157-22': { answer: 2, reasoning: 'WDM에서 광증폭기를 사용하여 무중계 장거리 전송이 가능합니다.', wrong: {1: 'WDM은 파장 추가로 회선 증설이 가능합니다.', 3: 'WDM은 파장축에서 다중화합니다.', 4: '각 채널은 서로 다른 형식/속도를 가질 수 있습니다.'} },
  '157-23': { answer: 3, reasoning: 'NB-IoT는 LPWAN 기술로 저전력 광대역 IoT 통신에 사용됩니다.', wrong: {1: 'WPAN은 근거리 개인 무선 네트워크입니다.', 2: 'LTE-M은 LTE 기반 IoT 기술입니다.', 4: 'LAN은 근거리 통신망입니다.'} },
  '157-24': { answer: 2, reasoning: 'SDN은 소프트웨어로 네트워크를 제어하는 기술입니다.', wrong: {1: 'SDS는 소프트웨어 정의 스토리지입니다.', 3: 'SNMP는 네트워크 관리 프로토콜입니다.', 4: 'CLI는 명령줄 인터페이스입니다.'} },
  '157-25': { answer: 3, reasoning: '사설 클라우드는 내부 사용자만 접근할 수 있습니다.', wrong: {1: '클라우드는 통신환경에 의존합니다.', 2: '공용 클라우드는 외부 제공자가 관리합니다.', 4: '하이브리드는 공용+사설 혼용입니다.'} },
  '157-26': { answer: 4, reasoning: 'HTTP는 OSI 응용계층(7계층)에 해당합니다. 표현계층이 아닙니다.', wrong: {1: 'TCP는 전송계층(4계층)입니다.', 2: 'IP는 네트워크계층(3계층)입니다.', 3: 'FTP는 응용계층(7계층)입니다.'} },
  '157-27': { answer: 2, reasoning: 'Token Ring은 토큰을 순차 전달하여 공평하게 데이터를 전송합니다.', wrong: {1: 'CSMA/CD는 충돌 감지 방식입니다.', 3: 'CSMA는 반송파 감지 방식입니다.', 4: 'DQDB는 분산 큐 이중 버스 방식입니다.'} },
  '157-28': { answer: 3, reasoning: 'Shell은 사용자 명령어를 해석하여 커널에 전달하는 인터페이스입니다.', wrong: {1: 'System Program은 시스템 운영 프로그램입니다.', 2: 'Loader는 프로그램 적재 역할입니다.', 4: 'Directory는 파일 저장 구조입니다.'} },
  '157-29': { answer: 4, reasoning: '/usr은 프로그램/라이브러리 디렉터리이며, 사용자 계정은 /home에 위치합니다.', wrong: {1: '/tmp는 임시 파일 디렉터리입니다.', 2: '/boot는 부팅 관련 파일 디렉터리입니다.', 3: '/var는 로그/메일 등 가변 데이터 디렉터리입니다.'} },
  '157-30': { answer: 4, reasoning: 'TTL이 길면 캐시 유지 시간이 길어 DNS 쿼리 빈도가 줄어 부하가 줄어듭니다.', wrong: {1: 'Zone 파일은 SOA로 시작합니다.', 2: 'SOA에는 네임서버 유지 기본 자료가 저장됩니다.', 3: 'Refresh는 동기 주기를 설정합니다.'} },
  '157-31': { answer: 1, reasoning: 'chmod a-w는 모든 사용자의 쓰기 권한을 제거합니다.', wrong: {2: 'u-w는 소유자만 쓰기를 제거합니다.', 3: 'g+rw는 그룹에 읽기+쓰기를 추가합니다.', 4: 'a-r은 읽기 권한을 제거합니다.'} },
  '157-32': { answer: 1, reasoning: 'useradd -g icqa network는 사용자 network를 그룹 icqa에 생성합니다.', wrong: {2: '사용자명과 그룹명이 반대입니다.', 3: '사용자명과 그룹명이 반대입니다.', 4: '-G는 보조 그룹이며 순서도 반대입니다.'} },
  '157-33': { answer: 2, reasoning: 'free 명령어는 메모리 사용량과 가용량을 보여줍니다.', wrong: {1: 'mem은 표준 Linux 명령어가 아닙니다.', 3: 'du는 디스크 사용량 명령어입니다.', 4: 'cat은 파일 출력 명령어입니다.'} },
  '157-34': { answer: 3, reasoning: 'DHCP는 IP 자동 할당과 효율적 관리를 수행합니다.', wrong: {1: 'HTTP 압축은 웹서버 기능입니다.', 2: 'TCP/IP 이름 확인은 DNS 역할입니다.', 4: '사설→공인 IP 변환은 NAT 역할입니다.'} },
  '157-35': { answer: 1, reasoning: 'perfmon은 성능 모니터를 실행하는 명령어입니다.', wrong: {2: 'msconfig는 시스템 구성 유틸리티입니다.', 3: 'dfrg는 디스크 조각 모음입니다.', 4: 'secpol은 보안 정책 편집기입니다.'} },
  '157-36': { answer: 1, reasoning: 'Round Robin은 순차적으로 요청을 분배하여 부하를 공평하게 나눕니다.', wrong: {2: 'Heartbeat는 서버 생존 확인 메커니즘입니다.', 3: 'Failover Cluster는 장애 시 전환 기술입니다.', 4: 'Non-Repudiation은 부인 방지 보안 개념입니다.'} },
  '157-37': { answer: 1, reasoning: 'NAS는 네트워크에 직접 연결된 파일 수준 스토리지입니다.', wrong: {2: 'SAN은 블록 수준 고성능 스토리지입니다.', 3: 'RAID는 디스크 배열 기술입니다.', 4: 'SSD는 저장 장치 종류입니다.'} },
  '157-38': { answer: 1, reasoning: 'Hyper-V에서 가상 머신(Virtual Machine)을 생성하고 관리합니다.', wrong: {2: 'IIS는 웹서버 역할입니다.', 3: 'Windows Containers는 컨테이너 기술입니다.', 4: 'NanoServer는 최소 설치 옵션입니다.'} },
  '157-39': { answer: 1, reasoning: 'WAP(Web Application Proxy)는 내부 웹 리소스를 인터넷에 게시합니다.', wrong: {2: 'PPTP는 VPN 터널링 프로토콜입니다.', 3: 'L2TP는 Layer 2 터널링입니다.', 4: 'SSTP는 SSL 기반 VPN입니다.'} },
  '157-40': { answer: 4, reasoning: 'Access Control Assistance Operators는 인증 속성을 관리하는 그룹입니다.', wrong: {1: 'Replicator는 파일 복제 그룹입니다.', 2: 'Power Users는 제한된 관리 그룹입니다.', 3: 'Backup Operators는 백업/복원 그룹입니다.'} },
  '157-41': { answer: 4, reasoning: 'cal은 달력 표시 명령으로 디스크 추가와 무관합니다.', wrong: {1: 'fdisk는 파티션 생성 명령입니다.', 2: 'mkfs는 파일시스템 생성 명령입니다.', 3: 'mount는 마운트 명령입니다.'} },
  '157-42': { answer: 1, reasoning: 'DNS는 UDP 53번뿐만 아니라 TCP 53번도 사용합니다. UDP만 열면 안 됩니다.', wrong: {2: 'iptables로 방화벽을 설정할 수 있습니다.', 3: 'rpm -qa | grep bind로 설치 확인이 가능합니다.', 4: 'named-checkconf로 오류를 점검합니다.'} },
  '157-43': { answer: 1, reasoning: 'ipconfig /renew는 DHCP로 새 IP를 받는 명령이며, DNS 서버 설치 시 고정 IP가 필요한 상황에서는 부적절합니다.', wrong: {2: '고정 IP 방식 변경이 적절합니다.', 3: '고정 IP 직접 입력이 적절합니다.', 4: 'DNS 서버 주소 직접 입력이 적절합니다.'} },
  '157-44': { answer: 3, reasoning: '403 Forbidden은 접근 권한이 없어 서버가 거부하는 상태 코드입니다.', wrong: {1: '400은 Bad Request입니다.', 2: '200은 OK(성공)입니다.', 4: '203은 Non-Authoritative Information입니다.'} },
  '157-45': { answer: 1, reasoning: 'Options에서 Indexes 옵션이 Directory Indexing을 활성화하여 보안 취약점이 됩니다.', wrong: {2: 'ServerAdmin은 관리자 이메일 설정입니다.', 3: 'DocumentRoot는 웹 문서 루트 설정입니다.', 4: 'ServerRoot는 Apache 설치 경로입니다.'} },
  '157-46': { answer: 4, reasoning: 'RAID 0은 미러링이 없어 디스크 하나 손상 시 데이터 복구가 불가능합니다.', wrong: {1: 'RAID 0은 최소 2개 디스크에 분산 저장합니다.', 2: '분산 저장으로 처리속도가 향상됩니다.', 3: 'RAID 0은 스트라이핑 방식입니다.'} },
  '157-47': { answer: 2, reasoning: '로드밸런싱은 부하를 분산시켜 성능을 최적화하는 기술입니다.', wrong: {1: '가상 LAN 설명입니다.', 3: '가상 머신 설명입니다.', 4: 'SSL/TLS 설명입니다.'} },
  '157-48': { answer: 3, reasoning: 'NAT는 사설 IP를 공인 IP로 변환하는 기술입니다.', wrong: {1: 'DHCP는 IP 자동 할당입니다.', 2: 'IPv6는 주소 체계 확장입니다.', 4: 'MAC 방식은 IP 변환과 무관합니다.'} },
  '157-49': { answer: 4, reasoning: 'WAF는 웹서버 전용 보안장비로 웹 프로토콜 공격을 방어합니다.', wrong: {1: 'IDS는 침입 탐지 시스템입니다.', 2: 'IPS는 침입 방지 시스템입니다.', 3: 'Firewall은 일반 방화벽입니다.'} },
  '157-50': { answer: 1, reasoning: '포트(Port)는 서비스를 식별하는 논리적 접속점입니다.', wrong: {2: '트렁크는 VLAN 트래픽 전달 링크입니다.', 3: '소켓은 IP+포트 조합입니다.', 4: '플러그는 물리적 커넥터입니다.'} },

  // ===== 2025년 정기3회 (exam_id=158) =====
  '158-1': { answer: 2, reasoning: '서브넷 마스크 /28에서 호스트 비트 4비트(2^4-2=14)로 최대 14개 호스트입니다.', wrong: {1: '10개는 잘못된 계산입니다.', 3: '26개는 잘못된 값입니다.', 4: '32개는 /27 서브넷이며 미적용 값입니다.'} },
  '158-2': { answer: 1, reasoning: 'OSPF는 Link State 알고리즘을 사용하는 내부 라우팅 프로토콜입니다.', wrong: {2: 'IDRP는 IS-IS 기반 도메인 간 프로토콜입니다.', 3: 'EGP는 외부 게이트웨이 프로토콜입니다.', 4: 'BGP는 경로 벡터 외부 라우팅입니다.'} },
  '158-3': { answer: 3, reasoning: 'ICMPv6의 이웃 요청/광고 메시지가 IPv4의 ARP 역할과 호스트 도달 가능성 검사를 수행합니다.', wrong: {1: '재지정 메시지는 경로 변경 알림입니다.', 2: '에코 요청은 ping용입니다.', 4: '목적지 도달 불가는 오류 보고입니다.'} },
  '158-4': { answer: 2, reasoning: '이더넷 MTU 1500바이트이므로 6000바이트는 Fragmentation 확장 헤더로 분할합니다.', wrong: {1: 'Source Routing은 경로 지정 헤더입니다.', 3: 'Authentication은 인증 헤더입니다.', 4: 'Destination Option은 목적지 옵션입니다.'} },
  '158-5': { answer: 2, reasoning: 'IP는 네트워크 계층에서 실제 패킷을 전달(라우팅)합니다.', wrong: {1: 'IP는 비신뢰성 프로토콜입니다.', 3: 'IP는 오류 정정 메커니즘이 없습니다.', 4: '슬라이딩 윈도우는 TCP 기능입니다.'} },
  '158-6': { answer: 4, reasoning: '데이터 손실이 치명적이지 않은 프로그램에 적합한 것은 UDP입니다.', wrong: {1: 'TCP는 연결 지향 방식입니다.', 2: 'TCP는 신뢰성 있는 전송입니다.', 3: 'TCP는 능동적 흐름 제어가 있습니다.'} },
  '158-7': { answer: 1, reasoning: 'SMTP는 응용 계층(7계층)이고, RARP/ICMP/IGMP는 네트워크 계층(3계층)입니다.', wrong: {2: 'RARP는 네트워크 계층입니다.', 3: 'ICMP는 네트워크 계층입니다.', 4: 'IGMP는 네트워크 계층입니다.'} },
  '158-8': { answer: 1, reasoning: 'ARP는 IP 주소를 하드웨어(MAC) 주소로 매핑합니다.', wrong: {2: '-d는 삭제 옵션이며 -s가 Static 설정입니다.', 3: 'ARP는 MAC을 모를 때 브로드캐스트합니다.', 4: 'ARP 캐시는 IP→MAC 매핑이며 도메인이 아닙니다.'} },
  '158-9': { answer: 2, reasoning: 'Unicast는 한 호스트에서 다른 한 호스트로의 1:1 통신입니다.', wrong: {1: '여러 호스트로 전송은 Multicast입니다.', 3: '모든 호스트로는 Broadcast입니다.', 4: '특정 그룹으로는 Multicast입니다.'} },
  '158-10': { answer: 4, reasoning: 'NAT는 사설 IP를 공인 IP로 변환하여 IP 절약과 보안을 제공합니다.', wrong: {1: 'DHCP는 IP 자동 할당입니다.', 2: 'ARP는 IP→MAC 변환입니다.', 3: 'BOOTP는 부팅 시 IP 할당입니다.'} },
  '158-11': { answer: 1, reasoning: 'FIN 플래그는 TCP 연결의 정상 종료를 나타냅니다.', wrong: {2: 'URG는 긴급 데이터 플래그입니다.', 3: 'ACK는 확인 응답 플래그입니다.', 4: 'RST는 강제 재설정 플래그입니다.'} },
  '158-12': { answer: 2, reasoning: 'IPv6 축약 규칙에 따라 2000:00AB:0001:0000:0000:0000:0001:0002가 원본입니다.', wrong: {1: '6그룹이라 유효하지 않습니다.', 3: '바이트 배치가 잘못되었습니다.', 4: '바이트 배치가 잘못되었습니다.'} },
  '158-13': { answer: 3, reasoning: '교육장용 PC는 DHCP 자동 할당이 가장 적합합니다.', wrong: {1: '웹서버는 고정 IP가 필요합니다.', 2: 'AP는 고정 IP가 필요합니다.', 4: '프린터는 고정 IP가 필요합니다.'} },
  '158-14': { answer: 4, reasoning: 'TCP Checksum은 16비트입니다. 32비트가 아닙니다.', wrong: {1: 'Source port는 16비트입니다.', 2: 'Sequence Number는 32비트입니다.', 3: 'Flags는 9비트입니다.'} },
  '158-15': { answer: 4, reasoning: 'HTTP/3은 QUIC 기반으로 TCP가 아닌 UDP를 사용합니다.', wrong: {1: 'HTTP는 애플리케이션 계층입니다.', 2: 'HTTP/2는 SPDY 기반 TCP입니다.', 3: 'HTTP는 80, HTTPS는 443 포트입니다.'} },
  '158-16': { answer: 2, reasoning: 'SNMP는 네트워크 관리 정보 및 운반을 위한 프로토콜입니다.', wrong: {1: 'SNMP는 포트 161/162를 사용합니다.', 3: 'SNMP는 기존 네트워크와 쉽게 통합됩니다.', 4: 'SNMPv2c는 암호화를 기본 제공하지 않습니다.'} },
  '158-17': { answer: 3, reasoning: 'SMTP는 이메일 전송 프로토콜입니다.', wrong: {1: 'SNMP는 네트워크 관리 프로토콜입니다.', 2: 'SNTP는 시간 동기화 프로토콜입니다.', 4: 'HTTP는 웹 전송 프로토콜입니다.'} },
  '158-18': { answer: 1, reasoning: 'NFV는 소프트웨어로 네트워크 기능을 가상화합니다. "하드웨어로 제어"는 잘못된 설명입니다.', wrong: {2: 'NFV는 소프트웨어 기반 가상화입니다.', 3: 'NFVI는 물리/가상화 인프라를 제공합니다.', 4: 'NFV는 S/W로 네트워크를 제어합니다.'} },
  '158-19': { answer: 3, reasoning: '메시 네트워크는 중앙 제어 없이도 구성할 수 있습니다. "구성할 수 없다"는 잘못입니다.', wrong: {1: '노드 이동이 자유롭고 토폴로지가 동적입니다.', 2: '멀티홉 라우팅 방식입니다.', 4: '자동 대체 경로를 사용합니다.'} },
  '158-20': { answer: 3, reasoning: '가상회선교환은 경로 설정 후 데이터 전송, 미사용 시 경로 해제하는 방식입니다.', wrong: {1: '회선교환은 전용 회선을 점유합니다.', 2: '데이터그램은 패킷별 독립 라우팅입니다.', 4: '메시지교환은 축적 후 전달 방식입니다.'} },
  '158-21': { answer: 1, reasoning: 'Multiplexing은 여러 신호를 하나의 회선으로 합쳐 전송하는 기술입니다.', wrong: {2: 'MODEM은 디지털/아날로그 변환 장치입니다.', 3: 'DSU는 디지털 서비스 장치입니다.', 4: 'CODEC은 코딩/디코딩 장치입니다.'} },
  '158-22': { answer: 2, reasoning: '스타형은 중앙 제어점에서 모든 기기가 Point to Point로 연결됩니다.', wrong: {1: '링형은 원형 연결입니다.', 3: '버스형은 공유 매체 연결입니다.', 4: '트리형은 계층적 연결입니다.'} },
  '158-23': { answer: 3, reasoning: '흐름 제어는 수신측이 송신측의 데이터 양/속도를 제한하는 기능입니다.', wrong: {1: '에러 제어는 오류 검출/정정입니다.', 2: '순서 제어는 데이터 순서 보장입니다.', 4: '접속 제어는 연결 관리입니다.'} },
  '158-24': { answer: 1, reasoning: 'Go-back-N ARQ는 에러 블록부터 모든 블록을 재전송합니다.', wrong: {2: 'Selective는 오류 블록만 재전송합니다.', 3: 'Adaptive는 프레임 크기를 동적 조절합니다.', 4: 'Stop-and-Wait는 하나씩 전송합니다.'} },
  '158-25': { answer: 2, reasoning: '위상 왜곡은 주파수별 다른 지연시간으로 발생하는 전송 손실입니다.', wrong: {1: '감쇠는 신호 약화입니다.', 3: '누화는 회선 간 간섭입니다.', 4: '충격성 잡음은 순간적 전기 잡음입니다.'} },
  '158-26': { answer: 1, reasoning: 'Fast Ethernet은 100BASE-T, CSMA/CD 방식, 100Mbps입니다.', wrong: {2: '10Gigabit은 10Gbps입니다.', 3: 'Gigabit은 1Gbps입니다.', 4: 'Thick Ethernet은 10Mbps입니다.'} },
  '158-27': { answer: 2, reasoning: 'on-premises는 자체 데이터센터 운영으로 클라우드 배포 모델이 아닙니다.', wrong: {1: 'Public Cloud는 배포 모델입니다.', 3: 'Hybrid Cloud는 배포 모델입니다.', 4: 'Private Cloud는 배포 모델입니다.'} },
  '158-28': { answer: 2, reasoning: 'ping 기본값은 일반적으로 4회이므로 3번이라는 설명은 부정확합니다.', wrong: {1: '대상 호스트 확인은 결과에 표시됩니다.', 3: '최소 왕복시간은 min에서 확인됩니다.', 4: '평균시간은 avg에서 확인됩니다.'} },
  '158-29': { answer: 4, reasoning: '>> (append redirect)는 기존 파일에 이어서 씁니다.', wrong: {1: '> 는 덮어쓰기입니다.', 2: '< 는 입력 리다이렉션입니다.', 3: '<< 는 Here Document입니다.'} },
  '158-30': { answer: 4, reasoning: 'Windows 로그에는 응용 프로그램, 보안, 설치, 시스템 등이 포함됩니다.', wrong: {1: '하드웨어 이벤트는 기본 항목이 아닙니다.', 2: '인터넷 익스플로러는 로그 항목이 아닙니다.', 3: 'PowerShell은 서비스 로그에 해당합니다.'} },
  '158-31': { answer: 2, reasoning: 'crontab "분 시 일 월 요일"에서 매주 월요일(1) 10시는 "0 10 * * 1"입니다.', wrong: {1: '"10 0"은 0시 10분입니다.', 3: '"10 0 * * 0"은 일요일 0시 10분입니다.', 4: '"0 10 * * 0"은 일요일 10시입니다.'} },
  '158-32': { answer: 2, reasoning: 'chown은 소유자와 소유그룹을 변경합니다.', wrong: {1: 'chmod는 접근 권한 변경입니다.', 3: 'useradd는 사용자 추가입니다.', 4: 'chage는 암호 만료 정보 변경입니다.'} },
  '158-33': { answer: 3, reasoning: '/etc는 환경설정과 사용자 정보 파일이 위치합니다.', wrong: {1: '/bin은 실행 파일 디렉터리입니다.', 2: '/root는 root 홈 디렉터리입니다.', 4: '/proc는 가상 파일시스템입니다.'} },
  '158-34': { answer: 4, reasoning: '트러스트(Trust)는 도메인 간 인증/권한 부여를 위한 관계입니다.', wrong: {1: '도메인은 기본 관리 단위입니다.', 2: '트리는 도메인 집합입니다.', 3: '포리스트는 최상위 AD 구조입니다.'} },
  '158-35': { answer: 3, reasoning: 'netstat -t는 TCP 연결 표시 옵션이며, 시간 정보 표시가 아닙니다.', wrong: {1: '-r은 라우팅 테이블 표시입니다.', 2: '-p는 PID/프로그램명 출력입니다.', 4: '-a는 모든 연결 표시입니다.'} },
  '158-36': { answer: 4, reasoning: 'chmod go=w는 그룹/기타의 기존 권한을 제거하고 쓰기만 설정하므로 결과가 다릅니다.', wrong: {1: '666은 모든 사용자에게 rw-입니다.', 2: 'a+w는 쓰기를 추가합니다.', 3: 'ugo+w는 쓰기를 추가합니다.'} },
  '158-37': { answer: 2, reasoning: 'vi에서 x는 커서 위치의 문자 하나를 삭제합니다.', wrong: {1: 'dd는 줄 전체 삭제입니다.', 3: 'D는 커서부터 줄 끝까지 삭제입니다.', 4: 'dw는 단어 삭제입니다.'} },
  '158-38': { answer: 4, reasoning: 'net user는 로컬 계정 관리이며, AD 도메인 사용자는 ds 계열 명령을 사용합니다.', wrong: {1: 'dsadd는 AD 개체 추가입니다.', 2: 'dsmod는 AD 개체 수정입니다.', 3: 'dsrm은 AD 개체 삭제입니다.'} },
  '158-39': { answer: 3, reasoning: 'SOA 책임자 필드는 hostmaster.icqa.or.kr 형식이며, @를 사용하지 않습니다.', wrong: {1: '일련번호는 영역 파일 개정 번호입니다.', 2: '주 서버는 초기 설정 서버입니다.', 4: '새로 고침 간격은 동기화 대기 시간입니다.'} },
  '158-40': { answer: 4, reasoning: 'ps는 실행 중인 프로세스 목록으로 데몬 확인에 사용됩니다.', wrong: {1: 'daemon은 표준 명령이 아닙니다.', 2: 'fsck는 파일시스템 점검입니다.', 3: 'men은 유효한 명령이 아닙니다.'} },
  '158-41': { answer: 1, reasoning: 'compmgmt는 올바르지 않으며, compmgmt.msc를 사용해야 합니다.', wrong: {2: 'devmgmt.msc는 장치 관리자입니다.', 3: 'gpedit.msc는 그룹 정책 편집기입니다.', 4: 'perfmon은 성능 모니터입니다.'} },
  '158-42': { answer: 1, reasoning: 'ping -t는 중단하기 전까지 계속 에코 요청을 반복합니다.', wrong: {2: '-a는 호스트 이름 변환입니다.', 3: '-f는 Don\'t Fragment 설정입니다.', 4: '-n은 전송 횟수 지정입니다.'} },
  '158-43': { answer: 4, reasoning: 'Apache 포트 설정은 "Listen 8081"이 올바릅니다.', wrong: {1: 'Port는 Apache 1.x 구형 옵션입니다.', 2: 'Default Port는 유효하지 않습니다.', 3: 'Listening은 유효하지 않습니다.'} },
  '158-44': { answer: 2, reasoning: 'FTP 제어용(명령/인증) 포트는 21번입니다.', wrong: {1: '20번은 데이터 전송 포트입니다.', 3: '22번은 SSH 포트입니다.', 4: '23번은 Telnet 포트입니다.'} },
  '158-45': { answer: 4, reasoning: 'Round Robin은 순차적으로 요청을 분배하는 기본 부하 분산 방식입니다.', wrong: {1: 'Least Connection은 연결 수 기반입니다.', 2: 'IP Hash는 IP 해시 기반입니다.', 3: 'Least Response Time은 응답시간 기반입니다.'} },
  '158-46': { answer: 4, reasoning: 'RAID-5는 분산(회전) 패리티로 병목현상을 줄입니다.', wrong: {1: 'RAID-2는 해밍 코드 방식입니다.', 2: 'RAID-3은 전용 패리티 바이트 스트라이핑입니다.', 3: 'RAID-4는 전용 패리티 블록 스트라이핑입니다.'} },
  '158-47': { answer: 1, reasoning: '리피터는 물리 계층(1계층)에서 신호를 증폭/재생성합니다.', wrong: {2: '네트워크 계층은 라우터입니다.', 3: '전송 계층은 TCP/UDP입니다.', 4: '응용 계층은 HTTP/FTP입니다.'} },
  '158-48': { answer: 4, reasoning: '광 케이블은 코어와 클래딩으로 구성됩니다.', wrong: {1: '이중 나선은 꼬인 구리선입니다.', 2: '동축 케이블은 중심/외부 도체입니다.', 3: '2선식 개방 선로는 구리선입니다.'} },
  '158-49': { answer: 3, reasoning: '태그 포트는 802.1Q 태그를 추가하여 VLAN 트래픽을 전달합니다.', wrong: {1: 'STP는 루프 방지입니다.', 2: 'Native VLAN은 비태그 트래픽 VLAN입니다.', 4: 'LOOP는 네트워크 루프입니다.'} },
  '158-50': { answer: 2, reasoning: 'L4 스위치는 전송 계층(4계층)이며, 네트워크 계층(3계층)이 아닙니다.', wrong: {1: 'L4는 서버 부하를 분산합니다.', 3: 'L4는 TCP/UDP/HTTP 헤더를 분석합니다.', 4: '외부 요청은 L4를 통해 분산됩니다.'} },

  // ===== 2025년 정기4회 (exam_id=159) =====
  '159-1': { answer: 1, reasoning: 'HTTPS는 TLS로 데이터를 암호화하며 포트 443을 사용합니다.', wrong: {2: 'HTTP는 포트 80이며 암호화되지 않습니다.', 3: 'FTP는 포트 20/21입니다.', 4: 'SSH는 포트 22입니다.'} },
  '159-2': { answer: 2, reasoning: 'a184:0a01::을 축약하면 0a01→a01, 00ff→ff, 연속 0→:: 적용하여 a184:a01::cd8c:1000:317b:ff입니다.', wrong: {1: '축약이 잘못되었습니다.', 3: '::를 사용하지 않았고 일부 값이 잘못됩니다.', 4: '연속 0 그룹이 누락되었습니다.'} },
  '159-3': { answer: 4, reasoning: 'SNMP는 UDP 기반 원격 네트워크 관리 프로토콜입니다.', wrong: {1: 'FTP는 TCP 기반 파일 전송입니다.', 2: 'DHCP는 IP 자동 할당입니다.', 3: 'BOOTP는 부팅 시 IP 할당입니다.'} },
  '159-4': { answer: 3, reasoning: 'ICMP는 네트워크 장비들의 오류 상황을 공유하는 기능이 있습니다.', wrong: {1: 'ICMP가 바로 오류 보고 프로토콜입니다.', 2: 'ICMP는 비대칭 프로토콜이 아닙니다.', 4: 'MAC 주소 제공은 ARP 역할입니다.'} },
  '159-5': { answer: 4, reasoning: '3-way handshake 첫 번째 단계에서 SYN 플래그를 설정합니다.', wrong: {1: 'RST는 강제 재설정입니다.', 2: 'ACK는 두 번째/세 번째 단계입니다.', 3: 'URG는 긴급 데이터입니다.'} },
  '159-6': { answer: 2, reasoning: '/27 서브넷에서 첫 서브넷 브로드캐스트 주소는 210.212.100.31입니다.', wrong: {1: '30은 유효 호스트 주소입니다.', 3: '32는 다음 서브넷 네트워크 주소입니다.', 4: '0은 네트워크 주소입니다.'} },
  '159-7': { answer: 4, reasoning: 'SLAAC(자동 설정)은 IPv6에서 새롭게 도입된 기능입니다.', wrong: {1: 'IPv6에서 체크섬이 제거되었습니다.', 2: 'IPv6 헤더는 단순화되었습니다.', 3: 'IPsec은 IPv4에서도 사용 가능합니다.'} },
  '159-8': { answer: 4, reasoning: '127.0.0.1은 루프백 테스트용 주소입니다.', wrong: {1: '모든 네트워크는 0.0.0.0입니다.', 2: '사설 IP가 아닙니다.', 3: '모든 노드는 브로드캐스트 주소입니다.'} },
  '159-9': { answer: 3, reasoning: 'TCP는 슬라이딩 윈도우 방식으로 흐름을 제어합니다.', wrong: {1: 'Go-Back-N은 ARQ 오류 제어입니다.', 2: '선택적 재전송도 ARQ입니다.', 4: 'Stop-and-Wait는 기본 ARQ입니다.'} },
  '159-10': { answer: 1, reasoning: 'ACK는 TCP 헤더 필드이며 IPv4 헤더에는 없습니다.', wrong: {2: 'Version은 IPv4 헤더 필드입니다.', 3: 'Header Checksum은 IPv4 헤더 필드입니다.', 4: 'Header Length(IHL)는 IPv4 헤더 필드입니다.'} },
  '159-11': { answer: 2, reasoning: 'DNS TTL은 레코드가 캐시에서 만료되기까지 남은 시간입니다.', wrong: {1: '존에서 나오기 전이 아닌 캐시 만료 시간입니다.', 3: '패킷이 아닌 DNS 데이터의 캐시 시간입니다.', 4: '네임서버 레코드에 한정되지 않습니다.'} },
  '159-12': { answer: 3, reasoning: 'UDP 오류검사는 체크섬을 사용합니다. 패리티는 UDP 방식이 아닙니다.', wrong: {1: 'UDP는 TCP보다 신뢰성이 낮습니다.', 2: 'UDP는 데이터그램 단위로 전송합니다.', 4: 'UDP는 비연결형 서비스입니다.'} },
  '159-13': { answer: 4, reasoning: 'DHCP는 MAC 기반 IP 자동 부여에 주로 사용됩니다.', wrong: {1: 'RARP는 현대에 거의 사용되지 않습니다.', 2: 'ARP는 IP→MAC 방향입니다.', 3: 'ICMP는 IP 할당과 무관합니다.'} },
  '159-14': { answer: 3, reasoning: 'Broadcast는 모든 호스트로 전송하는 방식입니다.', wrong: {1: '한 호스트는 Unicast입니다.', 2: '특정 그룹은 Multicast입니다.', 4: '가장 가까운 호스트는 Anycast입니다.'} },
  '159-15': { answer: 3, reasoning: 'OSPF는 ECMP로 여러 경로를 동시에 사용합니다. "단일 경로만"은 틀립니다.', wrong: {1: 'OSPF는 링크 스테이트 프로토콜입니다.', 2: 'Hello 패킷으로 이웃을 확인합니다.', 4: 'OSPFv2(IPv4), OSPFv3(IPv6)입니다.'} },
  '159-16': { answer: 2, reasoning: 'IGMP는 멀티캐스트 그룹 가입/탈퇴를 관리합니다.', wrong: {1: 'ICMP는 오류 보고입니다.', 3: 'ARP는 IP→MAC 변환입니다.', 4: 'RARP는 MAC→IP 변환입니다.'} },
  '159-17': { answer: 3, reasoning: 'Ping은 오류 확인은 하지만 오류 정정 기능은 없습니다.', wrong: {1: 'Ping은 ICMP 기반입니다.', 2: 'Ping은 RTT를 측정합니다.', 4: 'Ping은 연결 상태를 진단합니다.'} },
  '159-18': { answer: 1, reasoning: '데이터 링크 계층은 2계층이며, "세 번째 계층"은 잘못입니다.', wrong: {2: '비트열을 프레임화합니다.', 3: '전송 오류를 검출합니다.', 4: '흐름 제어를 수행합니다.'} },
  '159-19': { answer: 3, reasoning: '데이터 양이 많으면 지연이 증가합니다. "속도가 빨라진다"는 틀립니다.', wrong: {1: '가상 회선/데이터그램으로 분류됩니다.', 2: '패킷 단위로 분할 전송합니다.', 4: '블로킹 현상이 없습니다.'} },
  '159-20': { answer: 4, reasoning: 'SIP는 화상 회의 등 멀티미디어 세션을 설정/종료하는 프로토콜입니다.', wrong: {1: 'IRC는 채팅 프로토콜입니다.', 2: 'HEVC는 비디오 코덱입니다.', 3: 'MIME은 이메일 인코딩입니다.'} },
  '159-21': { answer: 2, reasoning: '네트워크 계층의 PDU는 패킷입니다.', wrong: {1: '세그먼트는 전송 계층입니다.', 3: '프레임은 데이터 링크 계층입니다.', 4: '비트는 물리 계층입니다.'} },
  '159-22': { answer: 3, reasoning: 'IPsec은 네트워크 계층에서 암호화와 인증을 제공하는 VPN 프로토콜입니다.', wrong: {1: 'PPTP는 2계층 터널링입니다.', 2: 'L2TP는 2계층 터널링입니다.', 4: 'SSL/TLS는 응용 계층 VPN입니다.'} },
  '159-23': { answer: 3, reasoning: 'FEC는 수신측에서 자체 정정하며 재전송을 요청하지 않습니다.', wrong: {1: 'Stop and Wait ARQ는 재전송 기법입니다.', 2: 'Go-Back N ARQ는 재전송 기법입니다.', 4: 'Selective Repeat ARQ는 재전송 기법입니다.'} },
  '159-24': { answer: 4, reasoning: 'VLAN은 물리적 스위치를 논리적으로 분리하는 기술입니다.', wrong: {1: 'STM은 동기식 전송 다중화입니다.', 2: 'ATM은 비동기 전송 모드입니다.', 3: 'ALOHA는 무선 통신 프로토콜입니다.'} },
  '159-25': { answer: 4, reasoning: '802.11ax(Wi-Fi 6)는 MIMO, OFDMA, MU-MIMO로 고대역폭 서비스를 안정적으로 처리합니다.', wrong: {1: '802.11n은 OFDMA 미지원입니다.', 2: '802.11ac는 OFDMA 미지원입니다.', 3: '802.11ad는 60GHz 대역으로 짧은 도달 거리입니다.'} },
  '159-26': { answer: 1, reasoning: '1000BASE-T는 1000Mbps(1Gbps)입니다. 1000Kb/s가 아닙니다.', wrong: {2: '스타형 토폴로지가 일반적입니다.', 3: 'UTP 케이블을 사용합니다.', 4: 'IEEE 802.3ab에서 정의됩니다.'} },
  '159-27': { answer: 4, reasoning: '서버리스에서는 사용자가 서버 프로비저닝/OS 패치를 관리할 필요가 없습니다.', wrong: {1: '클라우드 제공자가 인프라를 관리합니다.', 2: '코드 실행 시간에 따라 요금이 계산됩니다.', 3: '오토스케일링이 지원됩니다.'} },
  '159-28': { answer: 4, reasoning: 'find -exec는 찾은 파일에 추가 명령을 실행합니다.', wrong: {1: '-name은 파일 이름 패턴 검색입니다.', 2: '-type은 파일 종류 검색입니다.', 3: '-perm은 권한으로 검색합니다.'} },
  '159-29': { answer: 2, reasoning: 'Hyper-V에서 가상 하드 디스크를 실행 중에 다른 저장소로 이동할 수 있습니다.', wrong: {1: '다른 서버로 복제 가능합니다.', 3: '여러 가상 컴퓨터를 사용할 수 있습니다.', 4: '자원 사용률이 높아집니다.'} },
  '159-30': { answer: 3, reasoning: 'lsattr는 파일의 확장 속성(i: immutable 등)을 확인합니다.', wrong: {1: 'file은 파일 종류 확인입니다.', 2: 'stat은 상세 정보 표시입니다.', 4: 'lsblk는 블록 장치 목록입니다.'} },
  '159-31': { answer: 4, reasoning: 'crontab -r은 crontab 전체를 삭제합니다.', wrong: {1: '-u는 사용자 지정 옵션입니다.', 2: '-e는 편집 옵션입니다.', 3: '-l은 출력 옵션입니다.'} },
  '159-32': { answer: 3, reasoning: '/proc는 프로세스/하드웨어/시스템 정보를 제공하는 가상 파일시스템입니다.', wrong: {1: '/boot는 부팅 관련 파일입니다.', 2: '/etc는 설정 파일입니다.', 4: '/lib는 라이브러리 파일입니다.'} },
  '159-33': { answer: 3, reasoning: 'PTR 레코드는 IP→도메인 역방향 조회에 사용됩니다.', wrong: {1: 'A는 정방향(도메인→IPv4)입니다.', 2: 'AAAA는 정방향(도메인→IPv6)입니다.', 4: 'SOA는 영역 권한 시작 정보입니다.'} },
  '159-34': { answer: 3, reasoning: 'KeepAliveTimeout 80은 80초 동안 추가 요청 없으면 연결을 종료합니다.', wrong: {1: 'Timeout은 전체 요청 처리 시간 제한입니다.', 2: 'KeepAlive On은 연결 유지 활성화입니다.', 4: 'MaxKeepAliveRequests는 최대 요청 수입니다.'} },
  '159-35': { answer: 2, reasoning: 'su는 사용자 전환 명령이며, 관리자 권한 실행은 sudo를 사용합니다.', wrong: {1: 'Well-known port 사용 시 root 권한이 필요합니다.', 3: '포트 변경 시 충돌을 피해야 합니다.', 4: 'Well-known port는 1~1023입니다.'} },
  '159-36': { answer: 2, reasoning: '774에서 마지막 4는 기타 사용자에게 읽기(r--)만 허용합니다.', wrong: {1: '776은 기타에게 rw-를 허용합니다.', 3: '746은 기타에게 rw-를 허용합니다.', 4: '766은 기타에게 rw-를 허용합니다.'} },
  '159-37': { answer: 2, reasoning: 'FTP 제어 포트는 21(ㄱ), 데이터 포트는 20(ㄴ)입니다.', wrong: {1: '21/1024는 데이터 포트가 잘못입니다.', 3: '20/21은 반대입니다.', 4: '20/1024는 제어 포트가 잘못입니다.'} },
  '159-38': { answer: 2, reasoning: '이벤트 뷰어에서 종료/재부팅 기록을 확인할 수 있습니다.', wrong: {1: '성능 모니터는 성능 데이터입니다.', 3: '로컬 보안 정책은 보안 설정입니다.', 4: '그룹 정책 편집기는 정책 설정입니다.'} },
  '159-39': { answer: 4, reasoning: 'cd ~는 홈 디렉터리로 이동합니다.', wrong: {1: 'cd HOME은 HOME 디렉터리로 이동합니다.', 2: 'cd /는 루트 디렉터리입니다.', 3: 'cd ../HOME은 상위의 HOME입니다.'} },
  '159-40': { answer: 3, reasoning: 'pathping은 tracert 기능에 홉별 패킷 손실률/지연 정보를 추가합니다.', wrong: {1: 'ping은 단순 연결 테스트입니다.', 2: 'nslookup은 DNS 조회입니다.', 4: 'nbtstat은 NetBIOS 통계입니다.'} },
  '159-41': { answer: 1, reasoning: 'IIS는 요청 필터링으로 특정 요청을 차단할 수 있습니다.', wrong: {2: 'IIS는 HTTPS를 지원합니다.', 3: 'IIS는 PHP 실행이 가능합니다.', 4: 'App Pool은 여러 사이트를 호스팅합니다.'} },
  '159-42': { answer: 2, reasoning: 'DNSSEC는 DNS 응답의 무결성과 출처 인증을 제공합니다.', wrong: {1: 'DNSSEC는 캐싱이 아닌 보안입니다.', 3: 'Windows Server 2022에서 지원됩니다.', 4: 'DNSSEC는 서명이지 암호화가 아닙니다.'} },
  '159-43': { answer: 3, reasoning: 'DHCP 클라이언트는 부팅 시 브로드캐스트로 DHCP 서버를 찾습니다.', wrong: {1: '워크그룹에서도 DHCP 구성 가능합니다.', 2: '동적 풀과 예약 모두 사용합니다.', 4: 'DHCP 포트는 67/68번입니다.'} },
  '159-44': { answer: 2, reasoning: 'ps -ef | grep python은 Python 프로세스를 검색합니다.', wrong: {1: 'pgrep은 PID만 출력합니다.', 3: 'ss는 네트워크 소켓 정보입니다.', 4: 'top은 모든 프로세스 자원 사용량입니다.'} },
  '159-45': { answer: 1, reasoning: 'netstat -b는 각 연결의 실행 파일(프로세스)을 표시합니다.', wrong: {2: '-p는 프로토콜 필터(Windows)입니다.', 3: '-a는 모든 연결 표시입니다.', 4: '-n은 숫자로 표시입니다.'} },
  '159-46': { answer: 3, reasoning: 'RAID 1은 미러링으로 동일 데이터를 두 디스크에 복제합니다.', wrong: {1: 'Linear RAID는 순차 연결입니다.', 2: 'RAID 0은 스트라이핑입니다.', 4: 'RAID 5는 분산 패리티입니다.'} },
  '159-47': { answer: 1, reasoning: '게이트웨이는 모든 계층에서 동작하며 L2 프레임만 중계하지 않습니다.', wrong: {2: '다른 네트워크 간 데이터 형식을 변환합니다.', 3: '데이터 변환으로 병목이 발생할 수 있습니다.', 4: '다른 프로토콜 네트워크를 연결합니다.'} },
  '159-48': { answer: 4, reasoning: '애플리케이션 계층 보안은 L7 스위치 기능이며 L4가 아닙니다.', wrong: {1: '헬스 체크는 L4 기본 기능입니다.', 2: '분산 처리는 L4 핵심 기능입니다.', 3: 'NAT는 L4 기본 기능입니다.'} },
  '159-49': { answer: 2, reasoning: 'NAT는 네트워크 계층(L3) IP 변환이며 데이터 링크(L2)가 아닙니다.', wrong: {1: '정적 NAT는 1:1 매핑입니다.', 3: 'PAT는 포트별 다수 사설 IP를 매핑합니다.', 4: 'NAT는 내부 주소를 숨겨 보안을 제공합니다.'} },
  '159-50': { answer: 4, reasoning: 'PoE Switch는 이더넷으로 데이터와 전력을 동시 공급합니다.', wrong: {1: 'L2 Switch는 MAC 기반 프레임 전달입니다.', 2: 'IP 공유기는 NAT를 수행합니다.', 3: 'UPS는 무정전 전원 장치입니다.'} },

  // ===== 2026년 정기1회 (exam_id=160) =====
  '160-1': { answer: 4, reasoning: '/etc/services는 서비스와 포트 번호 매핑 파일입니다.', wrong: {1: '/etc/deny는 표준 파일이 아닙니다.', 2: '/etc/hosts는 호스트-IP 매핑 파일입니다.', 3: '/etc/allow는 표준 파일이 아닙니다.'} },
  '160-2': { answer: 3, reasoning: 'SSH는 리눅스/유닉스뿐만 아니라 Windows에서도 사용 가능합니다.', wrong: {1: 'SSH는 암호화 전송을 합니다.', 2: 'SSH는 무결성을 제공합니다.', 4: 'SSH는 공개키 암호화를 사용합니다.'} },
  '160-3': { answer: 3, reasoning: '조건에 따라 255.255.255.224(/27)가 적절합니다.', wrong: {1: '/25는 2개 서브넷입니다.', 2: '/26은 4개 서브넷입니다.', 4: '/28은 호스트 14개로 적을 수 있습니다.'} },
  '160-4': { answer: 3, reasoning: 'TFTP는 UDP 방식이므로 데이터 손실 가능성이 있습니다.', wrong: {1: 'TFTP 기본 포트는 69번입니다.', 2: 'FTP는 익명 접속도 가능합니다.', 4: 'FTP는 TCP를 사용합니다.'} },
  '160-5': { answer: 4, reasoning: 'ICMP는 오류 보고/진단용이지 신뢰성 확보를 위한 프로토콜이 아닙니다.', wrong: {1: 'ICMP는 비대칭이고 TTL을 제공합니다.', 2: 'ICMPv4에는 질의 메시지가 있습니다.', 3: 'ICMP는 IP 데이터그램 오류를 보고합니다.'} },
  '160-6': { answer: 3, reasoning: 'L3 스위치는 네트워크 계층에서 라우팅 기능을 수행합니다.', wrong: {1: 'L1은 물리 계층 장비입니다.', 2: 'L2는 MAC 기반 데이터 링크 장비입니다.', 4: 'L4는 전송 계층 로드 밸런싱입니다.'} },
  '160-7': { answer: 4, reasoning: 'MX 레코드는 메일 서버 위치를 지정합니다.', wrong: {1: 'A 레코드는 도메인→IPv4입니다.', 2: 'PTR은 역방향 조회입니다.', 3: 'SOA는 영역 권한 시작입니다.'} },
  '160-8': { answer: 3, reasoning: 'DNS는 UDP 53(일반 쿼리)과 TCP 53(영역 전송)을 함께 사용합니다.', wrong: {1: 'SMTP는 TCP만 사용합니다.', 2: 'FTP는 TCP만 사용합니다.', 4: 'Telnet은 TCP만 사용합니다.'} },
  '160-9': { answer: 4, reasoning: 'Wi-Fi HaLow(802.11ah)는 900MHz 대역의 장거리 저전력 IoT Wi-Fi입니다.', wrong: {1: 'BLE는 블루투스 저전력입니다.', 2: 'Z-Wave는 홈 자동화 무선입니다.', 3: 'Zigbee는 802.15.4 기반입니다.'} },
  '160-10': { answer: 4, reasoning: 'SLAAC(자동 설정)은 IPv6에서 새롭게 도입되었습니다.', wrong: {1: 'IPv6에서 체크섬이 제거되었습니다.', 2: 'IPv6 헤더는 단순화되었습니다.', 3: 'IPsec은 IPv4에서도 사용 가능합니다.'} },
  '160-11': { answer: 4, reasoning: '127.x.x.x는 루프백 주소입니다.', wrong: {1: '제한적 브로드캐스트는 255.255.255.255입니다.', 2: '멀티캐스트는 224~239입니다.', 3: '사설 IP는 192.168.x.x입니다.'} },
  '160-12': { answer: 1, reasoning: 'HTTPS는 SSL/TLS로 암호화되며 TCP 443 포트를 사용합니다.', wrong: {2: 'TCP 80은 HTTP 포트입니다.', 3: 'HTTPS는 UDP가 아닌 TCP입니다.', 4: 'HTTPS는 인증서가 필요합니다.'} },
  '160-13': { answer: 1, reasoning: 'FIN 플래그는 정상 종료를 나타냅니다.', wrong: {2: 'URG는 긴급 데이터입니다.', 3: 'ACK는 확인 응답입니다.', 4: 'RST는 강제 재설정입니다.'} },
  '160-14': { answer: 1, reasoning: 'DHCP는 IP 자동 할당/관리 프로토콜입니다.', wrong: {2: 'IP는 패킷 전달입니다.', 3: 'RIP는 라우팅 프로토콜입니다.', 4: 'ARP는 IP→MAC 변환입니다.'} },
  '160-15': { answer: 3, reasoning: '182.0.2.1은 사설 IP 대역이 아닙니다.', wrong: {1: '10.168.24.2는 사설 대역입니다.', 2: '172.17.210.21은 사설 대역입니다.', 4: '192.168.177.7은 사설 대역입니다.'} },
  '160-16': { answer: 2, reasoning: 'IGMP는 멀티캐스트 그룹 가입/탈퇴를 관리합니다.', wrong: {1: 'ICMP는 오류 보고입니다.', 3: 'ARP는 IP→MAC입니다.', 4: 'RARP는 MAC→IP입니다.'} },
  '160-17': { answer: 4, reasoning: 'FTP는 TCP를 사용하며 UDP 대표 프로토콜이 아닙니다.', wrong: {1: 'UDP는 IP로 데이터그램을 전송합니다.', 2: 'UDP는 분할/재조립을 제공하지 않습니다.', 3: 'UDP는 순서를 보장하지 않습니다.'} },
  '160-18': { answer: 2, reasoning: 'Star 토폴로지는 중앙 관리와 추가가 용이합니다.', wrong: {1: 'Bus는 중앙 관리가 어렵습니다.', 3: 'Ring은 추가가 어렵습니다.', 4: 'Mesh는 복잡합니다.'} },
  '160-19': { answer: 1, reasoning: 'Tunneling은 VPN에서 가상 경로를 설정하는 핵심 기술입니다.', wrong: {2: 'Authentication은 인증입니다.', 3: 'Encryption은 암호화입니다.', 4: 'Access Control은 접근 제어입니다.'} },
  '160-20': { answer: 3, reasoning: '라우팅, 패킷 전달 등은 네트워크 계층의 기능입니다.', wrong: {1: '물리 계층은 비트 전송입니다.', 2: '데이터 링크는 프레임 전달입니다.', 4: '전송 계층은 종단 간 전송입니다.'} },
  '160-21': { answer: 1, reasoning: 'Adaptive ARQ는 프레임 길이를 동적으로 변경합니다.', wrong: {2: 'Go back-N은 오류부터 재전송입니다.', 3: 'Selective는 오류만 재전송입니다.', 4: 'Stop and Wait는 하나씩 전송입니다.'} },
  '160-22': { answer: 3, reasoning: 'Loop/Echo는 흐름 제어가 아닌 무결성 확인입니다.', wrong: {1: 'Stop and Wait는 흐름 제어입니다.', 2: 'XON/XOFF는 흐름 제어입니다.', 4: 'Sliding Window는 흐름 제어입니다.'} },
  '160-23': { answer: 2, reasoning: '위상 왜곡은 주파수별 다른 지연으로 발생하는 전송 왜곡입니다.', wrong: {1: '감쇠는 신호 약화입니다.', 3: '누화는 회선 간 간섭입니다.', 4: '충격성 잡음은 순간적 잡음입니다.'} },
  '160-24': { answer: 4, reasoning: '클라우드는 다중 임차인(multi-tenant) 모델을 사용합니다.', wrong: {1: '필요한 만큼 자원을 활용합니다.', 2: '자원이 동적으로 할당됩니다.', 3: '미터링으로 자원을 최적화합니다.'} },
  '160-25': { answer: 1, reasoning: '1000BASE-SX는 단파장 광케이블 기가비트 이더넷입니다.', wrong: {2: '1000BASE-T는 UTP 케이블입니다.', 3: '10GBASE-T는 10Gbps급입니다.', 4: '2.5GBASE-T는 UTP 케이블입니다.'} },
  '160-26': { answer: 4, reasoning: 'VTP 모드는 Server, Client, Transparent입니다. Interface mode는 없습니다.', wrong: {1: 'Server mode는 기본 모드입니다.', 2: 'Client mode는 수신 전용입니다.', 3: 'Transparent mode는 전달 전용입니다.'} },
  '160-27': { answer: 2, reasoning: 'CSMA/CA는 무선 LAN에서 충돌 회피를 위한 매체 접근 방식입니다.', wrong: {1: 'CSMA/CD는 유선 충돌 감지입니다.', 3: 'TDMA는 시분할 접속입니다.', 4: '토큰 패싱은 토큰 기반입니다.'} },
  '160-28': { answer: 1, reasoning: 'chmod -R 755는 디렉터리와 하위 항목에 재귀적으로 rwxr-xr-x를 부여합니다.', wrong: {2: '-R 없어 하위에 미적용입니다.', 3: '777은 보안상 위험합니다.', 4: '555는 소유자도 쓰기 불가입니다.'} },
  '160-29': { answer: 3, reasoning: 'gdisk는 GPT 디스크 파티셔닝 명령으로 2TB 이상에 적합합니다.', wrong: {1: 'fdisk는 MBR만 지원합니다.', 2: 'mkfs는 파일시스템 생성입니다.', 4: 'mount는 마운트입니다.'} },
  '160-30': { answer: 2, reasoning: 'DNSSEC validation 설정에 따라 오류가 발생할 수 있으므로 "오류가 발생하지 않는다"는 부정확합니다.', wrong: {1: 'allow-query any는 모든 쿼리를 허용합니다.', 3: 'listen-on port 53은 외부 접근을 허용합니다.', 4: 'masterfile-format text는 텍스트 저장입니다.'} },
  '160-31': { answer: 2, reasoning: 'LimitRequestBody는 POST 요청 본문 크기를 제한합니다.', wrong: {1: 'KeepRequestSize는 유효하지 않습니다.', 3: 'RestrictBodyRequest는 유효하지 않습니다.', 4: 'PostRequestSize는 유효하지 않습니다.'} },
  '160-32': { answer: 2, reasoning: 'ping 결과에서 송수신 횟수가 3번이라는 것은 실제와 다를 수 있습니다.', wrong: {1: '대상 호스트는 결과에 표시됩니다.', 3: '최소 왕복시간은 min입니다.', 4: '평균시간은 avg입니다.'} },
  '160-33': { answer: 2, reasoning: 'Hyper-V에서 가상 디스크를 실행 중에 이동할 수 있습니다.', wrong: {1: '복제가 가능합니다.', 3: '여러 가상 컴퓨터 사용 가능합니다.', 4: '자원 사용률이 높아집니다.'} },
  '160-34': { answer: 1, reasoning: 'lastb는 로그인 실패 이력을 확인합니다.', wrong: {2: 'xferlog는 FTP 로그입니다.', 3: 'history는 명령어 이력입니다.', 4: 'pkill은 프로세스 종료입니다.'} },
  '160-35': { answer: 4, reasoning: 'chage -W는 암호 만료 경고 일수를 설정합니다.', wrong: {1: '-m은 최소 사용 일수입니다.', 2: '-L은 유효하지 않습니다.', 3: '-i는 비활성 일수입니다.'} },
  '160-36': { answer: 3, reasoning: 'GRUB은 Linux 부트 로더로 멀티부팅을 지원합니다.', wrong: {1: 'CMOS는 하드웨어 설정 메모리입니다.', 2: 'BASH는 기본 셸입니다.', 4: 'ROOT는 관리자 계정입니다.'} },
  '160-37': { answer: 3, reasoning: 'pwd는 현재 디렉터리의 절대경로를 출력합니다.', wrong: {1: 'cd는 디렉터리 변경입니다.', 2: 'man은 매뉴얼입니다.', 4: 'cron은 스케줄러입니다.'} },
  '160-38': { answer: 1, reasoning: 'cat exam.txt | more는 한 페이지씩 출력합니다.', wrong: {2: 'grep은 패턴 검색입니다.', 3: 'find는 파일 검색입니다.', 4: 'tar는 아카이브 도구입니다.'} },
  '160-39': { answer: 3, reasoning: 'Shell은 명령어를 해석하여 커널에 전달합니다.', wrong: {1: 'System Program은 시스템 프로그램입니다.', 2: 'Loader는 프로그램 적재입니다.', 4: 'Directory는 파일 구조입니다.'} },
  '160-40': { answer: 1, reasoning: 'CNAME은 실제 도메인의 별칭(가상) 도메인입니다.', wrong: {2: 'MX는 메일 서버 레코드입니다.', 3: 'A는 도메인→IPv4입니다.', 4: 'PTR은 역방향 조회입니다.'} },
  '160-41': { answer: 1, reasoning: 'ipconfig /renew는 DHCP에서 IP를 갱신합니다.', wrong: {2: '/release는 IP 해제입니다.', 3: '/flushdns는 DNS 캐시 초기화입니다.', 4: '/setclassid는 클래스 ID 설정입니다.'} },
  '160-42': { answer: 3, reasoning: 'Resource Monitor는 CPU/메모리/네트워크/디스크를 실시간 모니터링합니다.', wrong: {1: 'Server Manager는 역할/기능 관리입니다.', 2: 'System Hardware Monitor는 표준 도구가 아닙니다.', 4: 'Event Viewer는 이벤트 로그입니다.'} },
  '160-43': { answer: 1, reasoning: '글로벌 그룹은 같은 도메인 사용자를 그룹화하여 다른 도메인 리소스에 접근합니다.', wrong: {2: '유니버설 그룹은 포리스트 전체입니다.', 3: '도메인 로컬은 해당 도메인 리소스입니다.', 4: '로컬 그룹은 개별 컴퓨터용입니다.'} },
  '160-44': { answer: 2, reasoning: 'TTL 미설정 시 기본값이 적용되므로 서비스 불가능이 아닙니다.', wrong: {1: '짧은 TTL은 잦은 쿼리로 부하를 줍니다.', 3: 'TTL은 캐싱 주기입니다.', 4: '긴 TTL은 갱신이 늦어집니다.'} },
  '160-45': { answer: 1, reasoning: 'IIS 로그 저장 위치는 변경 가능합니다.', wrong: {2: 'IIS는 여러 로그 형식을 지원합니다.', 3: '로그는 버퍼링되어 실시간이 아닙니다.', 4: '크기 초과 시 새 파일을 생성합니다.'} },
  '160-46': { answer: 3, reasoning: 'L2 스위치는 MAC 주소를 확인하여 전송합니다.', wrong: {1: 'IP는 L3입니다.', 2: 'Port는 L4입니다.', 4: 'URL은 응용 계층입니다.'} },
  '160-47': { answer: 2, reasoning: 'Round Robin은 순차적으로 트래픽을 분산합니다.', wrong: {1: 'Least Connection은 연결 수 기반입니다.', 3: 'Weighted Round Robin은 가중치 기반입니다.', 4: 'Weighted Least Connection은 가중치+연결 수입니다.'} },
  '160-48': { answer: 2, reasoning: 'NAT는 사설 IP를 공인 IP로 변환합니다.', wrong: {1: 'PBR은 정책 기반 라우팅입니다.', 3: 'Proxy ARP는 대리 응답입니다.', 4: 'Split DNS는 내부/외부 분리입니다.'} },
  '160-49': { answer: 2, reasoning: 'L7 스위치는 응용 계층까지 분석합니다. "TCP/UDP만"은 L4 스위치입니다.', wrong: {1: 'L7은 응용 계층에서 동작합니다.', 3: 'L7은 L5~L7 정보까지 분석합니다.', 4: 'L7은 하위 계층을 포괄합니다.'} },
  '160-50': { answer: 3, reasoning: '라우터는 네트워크 계층(3계층)/인터넷 계층에서 동작합니다.', wrong: {1: '리피터는 물리 계층입니다.', 2: 'L2 스위치는 데이터 링크 계층입니다.', 4: '허브는 물리 계층입니다.'} },
};

async function main() {
  const examIds = [156, 157, 158, 159, 160];
  let totalCount = 0;

  for (const examId of examIds) {
    const res = await query(
      'SELECT id, question_number, body, choices, answer FROM questions WHERE exam_id = $1 ORDER BY question_number',
      [examId]
    );

    const questions = res.rows;
    let updatedCount = 0;

    for (const q of questions) {
      const key = `${examId}-${q.question_number}`;
      const data = answersByExamQ[key];
      if (!data) {
        console.error(`  [경고] ${key} (id=${q.id}) 정답 데이터 없음`);
        continue;
      }

      const choices = (typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices) || [];
      const html = buildHtml(data.answer, choices, data.reasoning, data.wrong);

      await query(
        'UPDATE questions SET answer = $1, explanation = $2, updated_at = NOW() WHERE id = $3',
        [String(data.answer), html, q.id]
      );
      updatedCount++;
    }

    console.log(`[exam_id=${examId}] ${updatedCount}문제 업데이트 완료`);
    totalCount += updatedCount;
  }

  console.log(`\n총 ${totalCount}문제 정답+해설 저장 완료`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
