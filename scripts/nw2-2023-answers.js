// 네트워크관리사2급 2023년 정기 1~4회 정답+해설 DB 저장 스크립트
require('dotenv').config();
const { query, getPool } = require('../api/db');

// 해설 HTML 생성 헬퍼
function makeHtml(answerNum, choices, explanation, wrongAnalysis) {
  const choiceTexts = choices.map(c => c.text || c.label);
  const answerText = choiceTexts[answerNum - 1];
  const nums = ['①','②','③','④'];
  const wrongLines = wrongAnalysis.map(w => `<p>${nums[w.num-1]} ${choiceTexts[w.num-1]} — ${w.reason}</p>`).join('');
  return `<p class="exp-answer">✅ 정답: <strong>${nums[answerNum-1]} ${answerText}</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>${explanation}</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div>${wrongLines}</div>`;
}

// ===== exam 148: 2023년 정기 1회 =====
const exam148 = [
  { q:1, a:3, exp:'C Class의 IP 범위는 192.0.0.0 ~ 223.255.255.255이다. 각 옥텟은 0~255 범위여야 유효하다.', wrong:[
    {num:1,reason:'33.x.x.x는 A Class 주소이다.'},
    {num:2,reason:'128.x.x.x는 B Class 주소이다.'},
    {num:4,reason:'256은 옥텟의 유효 범위(0~255)를 초과하므로 유효하지 않은 IP이다.'}
  ]},
  { q:2, a:3, exp:'ICMPv6의 이웃 요청(Neighbor Solicitation)과 이웃 광고(Neighbor Advertisement) 메시지는 IPv4의 ARP 역할을 대체하며, 특정 호스트의 도달 가능 여부(Reachability)를 검사하는 기능을 수행한다.', wrong:[
    {num:1,reason:'재지정 메시지는 더 나은 경로를 알려주는 용도이다.'},
    {num:2,reason:'에코 요청은 ping과 같은 연결 확인 용도이다.'},
    {num:4,reason:'목적지 도달 불가 메시지는 패킷 전달 실패를 알리는 용도이다.'}
  ]},
  { q:3, a:2, exp:'TCP 헤더의 6비트 플래그에는 URG, ACK, PSH, RST, SYN, FIN이 있다. UTC는 협정 세계시(Coordinated Universal Time)로 TCP 플래그가 아니다.', wrong:[
    {num:1,reason:'URG는 긴급 데이터를 나타내는 유효한 TCP 플래그이다.'},
    {num:3,reason:'ACK는 확인 응답을 나타내는 유효한 TCP 플래그이다.'},
    {num:4,reason:'RST는 연결 리셋을 나타내는 유효한 TCP 플래그이다.'}
  ]},
  { q:4, a:1, exp:'TCP의 Window 필드는 수신측 버퍼 크기를 알려주어 송신측이 전송량을 조절하는 슬라이딩 윈도우(Sliding Window) 흐름 제어 기법에 사용된다.', wrong:[
    {num:2,reason:'Stop and Wait는 한 번에 하나의 프레임만 전송하고 확인을 기다리는 방식이다.'},
    {num:3,reason:'Xon/Xoff는 소프트웨어 기반 직렬 통신 흐름 제어 방식이다.'},
    {num:4,reason:'CTS/RTS는 무선 네트워크에서 사용하는 매체 접근 제어 방식이다.'}
  ]},
  { q:5, a:1, exp:'IGMP(Internet Group Management Protocol)는 멀티캐스트 그룹 관리를 위한 프로토콜로, 호스트가 멀티캐스트 그룹에 참여/탈퇴할 때 사용된다.', wrong:[
    {num:2,reason:'ICMP는 네트워크 오류 보고 및 진단용 프로토콜이다.'},
    {num:3,reason:'SMTP는 이메일 전송 프로토콜이다.'},
    {num:4,reason:'DNS는 도메인 이름을 IP 주소로 변환하는 프로토콜이다.'}
  ]},
  { q:6, a:1, exp:'SSH(Secure Shell)는 22번 포트를 사용하며, 공개키/전자서명 기반 인증과 암호화된 통신을 제공하는 유닉스 기반 원격 접속 프로토콜이다.', wrong:[
    {num:2,reason:'IPSec은 네트워크 계층에서 IP 패킷을 암호화하는 프로토콜이다.'},
    {num:3,reason:'SSL은 전송 계층 보안 프로토콜로 443번 포트를 사용한다.'},
    {num:4,reason:'PGP는 이메일 암호화에 사용되는 프로그램이다.'}
  ]},
  { q:7, a:4, exp:'Cisco 스위치에서 arp 명령어(show arp)를 통해 IP와 MAC 주소 매핑 테이블을 확인하여 불법 IP 및 MAC 주소를 검색할 수 있다.', wrong:[
    {num:1,reason:'RARP는 MAC 주소로 IP를 알아내는 프로토콜이지 스위치 명령어가 아니다.'},
    {num:2,reason:'VLAN은 논리적 네트워크 분할 기술로 IP 검색 명령이 아니다.'},
    {num:3,reason:'CDP는 Cisco 장비 간 인접 장비 정보를 확인하는 프로토콜이다.'}
  ]},
  { q:8, a:2, exp:'서브넷 마스크 255.255.255.192에서 호스트 부분 8비트 중 상위 2비트가 서브넷으로 사용되므로(11000000) 서브넷 수는 2^2 = 4개이다.', wrong:[
    {num:1,reason:'2개는 서브넷 비트가 1개일 때의 수이다.'},
    {num:3,reason:'192는 서브넷 마스크의 마지막 옥텟 값이지 서브넷 수가 아니다.'},
    {num:4,reason:'1024는 서브넷 비트 10개일 때의 수로 해당하지 않는다.'}
  ]},
  { q:9, a:2, exp:'IPv6는 브로드캐스트를 사용하지 않고 멀티캐스트와 애니캐스트를 사용한다. 브로드캐스트 대신 멀티캐스트(ff02::1 등)로 대체하였다.', wrong:[
    {num:1,reason:'IPv6는 128bit 주소 체계를 사용하므로 올바른 설명이다.'},
    {num:3,reason:'IPv6는 IPsec을 기본 지원하며 모바일 IP도 사용 가능하다.'},
    {num:4,reason:'콜론으로 구분된 16진수 표기는 IPv6의 올바른 표현 방식이다.'}
  ]},
  { q:10, a:3, exp:'DNS는 일반적으로 UDP 53번 포트를 사용하지만, 512바이트를 초과하는 응답이나 영역 전송(Zone Transfer) 시 TCP 53번 포트도 사용한다.', wrong:[
    {num:1,reason:'FTP는 TCP만 사용한다(20번: 데이터, 21번: 제어).'},
    {num:2,reason:'SMTP는 TCP 25번 포트만 사용한다.'},
    {num:4,reason:'SNMP는 UDP 161/162번 포트를 사용한다.'}
  ]},
  { q:11, a:4, exp:'TTL(Time to Live)은 패킷이 통과할 수 있는 최대 라우터(홉) 수를 의미하며, 시간(초) 단위가 아니다. TTL 55는 55개의 라우터를 더 통과할 수 있다는 뜻이다.', wrong:[
    {num:1,reason:'ping 명령으로 정상 통신 확인은 올바른 설명이다.'},
    {num:2,reason:'기본 ping 데이터 크기 32바이트는 올바른 설명이다.'},
    {num:3,reason:'평균 응답 시간 2ms는 출력에서 확인할 수 있는 정보이다.'}
  ]},
  { q:12, a:1, exp:'HTTPS(HyperText Transfer Protocol Secure)는 TLS/SSL을 통해 HTTP 데이터를 암호화하며, 기본 포트로 443번을 사용한다.', wrong:[
    {num:2,reason:'HTTP는 암호화 없이 80번 포트를 사용한다.'},
    {num:3,reason:'FTP는 파일 전송 프로토콜로 20/21번 포트를 사용한다.'},
    {num:4,reason:'SSH는 원격 접속 프로토콜로 22번 포트를 사용한다.'}
  ]},
  { q:13, a:4, exp:'SMTP(Simple Mail Transfer Protocol)는 인터넷에서 전자 우편(이메일)을 전송하기 위한 프로토콜로 TCP 25번 포트를 사용한다.', wrong:[
    {num:1,reason:'WWW 데이터 전송은 HTTP 프로토콜이 담당한다.'},
    {num:2,reason:'네트워크 장비 관리는 SNMP 프로토콜이 담당한다.'},
    {num:3,reason:'파일 전송은 FTP 프로토콜이 담당한다.'}
  ]},
  { q:14, a:4, exp:'RARP(Reverse ARP)는 물리적 하드웨어 주소(MAC)를 IP 주소로 매핑시키는 프로토콜이다. ARP는 반대로 IP를 MAC으로 변환한다.', wrong:[
    {num:1,reason:'DHCP는 IP 주소를 동적으로 할당하는 프로토콜이다.'},
    {num:2,reason:'ICMP는 네트워크 오류 보고 프로토콜이다.'},
    {num:3,reason:'ARP는 IP 주소를 MAC 주소로 변환하는 프로토콜(반대 방향)이다.'}
  ]},
  { q:15, a:4, exp:'SNMP(Simple Network Management Protocol)는 UDP 기반으로 네트워크 장비를 원격 관리·감시하며, 서버 상태 정보를 수집·관리하는 프로토콜이다.', wrong:[
    {num:1,reason:'FTP는 파일 전송 프로토콜이다.'},
    {num:2,reason:'DHCP는 IP 주소 자동 할당 프로토콜이다.'},
    {num:3,reason:'BOOTP는 부팅 시 IP 할당용 프로토콜로 DHCP의 전신이다.'}
  ]},
  { q:16, a:2, exp:'SMTP는 응용 계층(Application Layer)에서 동작하고, IP·RARP·ARP는 모두 네트워크 계층(Internet Layer)에서 동작한다. 따라서 SMTP가 다른 계층이다.', wrong:[
    {num:1,reason:'IP는 네트워크 계층에서 동작한다.'},
    {num:3,reason:'RARP는 네트워크 계층에서 동작한다.'},
    {num:4,reason:'ARP는 네트워크 계층에서 동작한다.'}
  ]},
  { q:17, a:4, exp:'RIPv1은 브로드캐스트(255.255.255.255)를 이용하고, RIPv2만 멀티캐스트(224.0.0.9)를 이용한다. 둘 다 멀티캐스트를 사용한다는 설명은 틀리다.', wrong:[
    {num:1,reason:'RIP은 디스턴스 벡터 라우팅 프로토콜이 맞다.'},
    {num:2,reason:'RIP의 메트릭은 Hop Count를 사용하는 것이 맞다.'},
    {num:3,reason:'RIP은 표준 프로토콜로 대부분의 라우터가 지원한다.'}
  ]},
  { q:18, a:4, exp:'IEEE 802.11은 무선 LAN 표준으로 CSMA/CA(Carrier Sense Multiple Access with Collision Avoidance) 방식을 사용한다.', wrong:[
    {num:1,reason:'802.1은 네트워크 관리, 브리징 관련 표준이다.'},
    {num:2,reason:'802.2는 LLC(Logical Link Control) 표준이다.'},
    {num:3,reason:'802.3은 유선 이더넷으로 CSMA/CD 방식을 사용한다.'}
  ]},
  { q:19, a:1, exp:'타이밍(Timing)은 프로토콜 기본 요소 중 통신 속도 및 메시지 순서를 위한 제어정보로, 데이터 전송 시점과 속도를 조절한다.', wrong:[
    {num:2,reason:'의미(Semantics)는 전송 데이터의 의미와 해석에 관한 요소이다.'},
    {num:3,reason:'구문(Syntax)은 데이터의 형식, 부호화, 신호 수준에 관한 요소이다.'},
    {num:4,reason:'처리(Process)는 프로토콜의 기본 구성요소가 아니다.'}
  ]},
  { q:20, a:1, exp:'데이터 링크 계층은 OSI 7 Layer의 두 번째(2계층)이다. 세 번째 계층은 네트워크 계층이므로 이 설명은 틀렸다.', wrong:[
    {num:2,reason:'비트를 프레임화하는 것은 데이터 링크 계층의 올바른 기능이다.'},
    {num:3,reason:'에러 검색은 데이터 링크 계층의 올바른 기능이다.'},
    {num:4,reason:'흐름제어는 데이터 링크 계층의 올바른 기능이다.'}
  ]},
  { q:21, a:1, exp:'VPN(Virtual Private Network)은 공중 네트워크를 통해 사설 네트워크를 구성하여 안전한 통신을 가능하게 하는 기술로, 터널링과 암호화를 사용한다.', wrong:[
    {num:2,reason:'NAT는 사설 IP와 공인 IP 간의 주소 변환 기술이다.'},
    {num:3,reason:'PPP는 점대점 프로토콜로 직렬 통신에 사용된다.'},
    {num:4,reason:'PPPoE는 이더넷 위에서 PPP를 사용하는 프로토콜이다.'}
  ]},
  { q:22, a:2, exp:'네트워크 계층(3계층)의 데이터 단위는 패킷(Packet)이다.', wrong:[
    {num:1,reason:'세그먼트는 전송 계층(4계층)의 데이터 단위이다.'},
    {num:3,reason:'프레임은 데이터 링크 계층(2계층)의 데이터 단위이다.'},
    {num:4,reason:'비트는 물리 계층(1계층)의 데이터 단위이다.'}
  ]},
  { q:23, a:3, exp:'SDN(Software Defined Networks)은 네트워크의 제어 평면과 데이터 평면을 분리하여 소프트웨어로 네트워크를 프로그래밍하고 관리하는 기술이다.', wrong:[
    {num:1,reason:'무선 센서 네트워크는 센서 노드로 구성된 네트워크이다.'},
    {num:2,reason:'무선 메시 네트워크는 메시 토폴로지의 무선 네트워크이다.'},
    {num:4,reason:'CDN은 콘텐츠를 분산 배포하여 전송 속도를 높이는 네트워크이다.'}
  ]},
  { q:24, a:1, exp:'Sink 노드는 센서 네트워크에서 각 센서 노드들의 센싱 데이터를 수집하는 중심 노드 역할을 한다.', wrong:[
    {num:2,reason:'Actuator는 센서 데이터를 기반으로 물리적 동작을 수행하는 장치이다.'},
    {num:3,reason:'RFID는 무선 주파수를 이용한 식별 기술이다.'},
    {num:4,reason:'Access Point는 무선 LAN에서 유무선 연결을 제공하는 장치이다.'}
  ]},
  { q:25, a:1, exp:'감쇠(Attenuation) 현상은 전송 매체를 통해 신호가 전달될 때 거리가 멀어질수록 신호 세기가 약해지는 현상이다.', wrong:[
    {num:2,reason:'상호변조 잡음은 서로 다른 주파수의 신호가 혼합되어 발생하는 잡음이다.'},
    {num:3,reason:'지연 왜곡은 주파수별 전파 속도 차이로 인한 신호 왜곡이다.'},
    {num:4,reason:'누화 잡음은 인접 회선 간 전기적 간섭으로 발생하는 잡음이다.'}
  ]},
  { q:26, a:1, exp:'WPAN(Wireless Personal Area Network)은 개인 영역 네트워크로 블루투스, ZigBee 등 근거리 무선 통신 기술을 포함한다.', wrong:[
    {num:2,reason:'LTE-M은 IoT용 저전력 광역 네트워크(LPWAN) 기술이다.'},
    {num:3,reason:'NB-IoT는 협대역 IoT용 LPWAN 기술이다.'},
    {num:4,reason:'LAN은 로컬 영역 네트워크로 유무선 모두를 포함하는 광범위한 개념이다.'}
  ]},
  { q:27, a:2, exp:'Star(스타형) 토폴로지는 중앙 허브를 통해 모든 노드가 연결되어 컴퓨터 추가 설정이 용이하고 중앙에서 네트워크를 관리할 수 있다.', wrong:[
    {num:1,reason:'Bus형은 하나의 공유 매체에 모든 노드가 연결되어 중앙관리가 어렵다.'},
    {num:3,reason:'Ring형은 노드가 순환형으로 연결되어 노드 추가 시 전체 영향을 준다.'},
    {num:4,reason:'Mesh형은 모든 노드가 상호 연결되어 비용이 높고 관리가 복잡하다.'}
  ]},
  { q:28, a:1, exp:'PowerShell은 Windows Server의 시스템 관리를 위해 설계된 명령 라인 셸 및 스크립팅 언어로, 강력한 확장성과 자동화를 지원한다.', wrong:[
    {num:2,reason:'C-Shell은 유닉스/리눅스용 셸로 Windows Server와 무관하다.'},
    {num:3,reason:'K-Shell(Korn Shell)은 유닉스/리눅스용 셸이다.'},
    {num:4,reason:'Bourne-Shell은 유닉스 최초의 셸로 Windows Server와 무관하다.'}
  ]},
  { q:29, a:1, exp:'라운드 로빈(Round Robin)은 동일 도메인에 여러 IP를 등록하여 DNS 질의 시 IP 주소를 번갈아가며 응답함으로써 서버 부하를 분산하는 방식이다.', wrong:[
    {num:2,reason:'큐(Queue)는 자료구조 방식으로 DNS 부하분산 기법이 아니다.'},
    {num:3,reason:'스택(Stack)은 LIFO 자료구조로 DNS 부하분산과 무관하다.'},
    {num:4,reason:'FIFO는 선입선출 방식으로 큐와 유사하며 DNS 부하분산 기법이 아니다.'}
  ]},
  { q:30, a:4, exp:'Hyper-V는 하나의 물리 서버에서 여러 개의 가상 컴퓨터를 생성하고 실행할 수 있다. 하나만 사용할 수 있다는 설명은 틀렸다.', wrong:[
    {num:1,reason:'Hyper-V는 하드웨어 DEP(Data Execution Prevention) 지원이 필요하다.'},
    {num:2,reason:'서버관리자의 역할 추가로 Hyper-V를 설치할 수 있다.'},
    {num:3,reason:'스냅숏(체크포인트)으로 특정 시점의 상태를 기록할 수 있다.'}
  ]},
  { q:31, a:4, exp:'NS(Name Server) 레코드는 해당 도메인의 네임서버를 지정하는 레코드이다. 사서함 라우팅 정보를 제공하는 것은 MX(Mail Exchange) 레코드이다.', wrong:[
    {num:1,reason:'A 레코드는 도메인을 32비트 IPv4 주소와 연결하는 것이 맞다.'},
    {num:2,reason:'AAAA 레코드는 도메인을 128비트 IPv6 주소와 연결하는 것이 맞다.'},
    {num:3,reason:'CNAME 레코드는 실제 도메인과 연결되는 가상(별칭) 도메인이 맞다.'}
  ]},
  { q:32, a:3, exp:'IIS에서 가상 디렉터리의 이름(별칭)은 실제 경로의 이름과 다르게 설정할 수 있다. 이것이 가상 디렉터리의 핵심 기능이다.', wrong:[
    {num:1,reason:'기본 웹 문서 폴더(홈 디렉터리)를 변경할 수 있는 것은 맞다.'},
    {num:2,reason:'기본 문서를 추가하고 우선순위를 조정할 수 있는 것은 맞다.'},
    {num:4,reason:'디렉터리 검색 활성화 시 기본 문서가 없으면 파일 목록이 표시된다.'}
  ]},
  { q:33, a:2, exp:'man 명령어는 Linux에서 매뉴얼 페이지를 조회하는 명령어로, man ls로 ls 명령어의 사용법을 확인할 수 있다.', wrong:[
    {num:1,reason:'cat은 파일 내용을 출력하는 명령어이다.'},
    {num:3,reason:'ls man은 man이라는 파일/디렉터리를 나열하는 명령이다.'},
    {num:4,reason:'ls cat은 cat이라는 파일/디렉터리를 나열하는 명령이다.'}
  ]},
  { q:34, a:1, exp:'chmod a-w sample은 모든 사용자(a=all: user+group+others)에게서 쓰기(w) 권한을 제거(-) 하는 명령이다.', wrong:[
    {num:2,reason:'u-w는 소유자(user)에게서만 쓰기 권한을 제거한다.'},
    {num:3,reason:'g+rw는 그룹에 읽기와 쓰기 권한을 추가하는 것이다.'},
    {num:4,reason:'a-r은 모든 사용자의 읽기 권한을 제거하는 것이다.'}
  ]},
  { q:35, a:4, exp:'ps(Process Status) 명령어는 현재 실행 중인 프로세스 목록을 확인하여 특정 Daemon이 살아있는지 확인할 수 있다.', wrong:[
    {num:1,reason:'daemon은 프로세스 확인 명령어가 아니다.'},
    {num:2,reason:'fsck는 파일 시스템 검사 및 복구 명령어이다.'},
    {num:3,reason:'men은 Linux에 존재하지 않는 명령어이다.'}
  ]},
  { q:36, a:2, exp:'/etc/passwd에서 두 번째 필드의 x는 실제 패스워드가 /etc/shadow 파일에 암호화되어 저장되어 있음을 의미한다. x 자체가 패스워드가 아니다.', wrong:[
    {num:1,reason:'첫 번째 필드가 user1이므로 사용자 ID가 user1인 것은 맞다.'},
    {num:3,reason:'세 번째와 네 번째 필드가 500이므로 UID와 GID가 500인 것은 맞다.'},
    {num:4,reason:'마지막 필드가 /bin/bash이므로 기본 셸이 /bin/bash인 것은 맞다.'}
  ]},
  { q:37, a:4, exp:'Windows Server 이벤트 뷰어의 Windows 로그에는 응용 프로그램, 보안, Setup, 시스템 4가지가 있다. 사용자 권한은 포함되지 않는다.', wrong:[
    {num:1,reason:'보안 로그는 이벤트 뷰어의 Windows 로그 항목에 포함된다.'},
    {num:2,reason:'Setup 로그는 이벤트 뷰어의 Windows 로그 항목에 포함된다.'},
    {num:3,reason:'시스템 로그는 이벤트 뷰어의 Windows 로그 항목에 포함된다.'}
  ]},
  { q:38, a:4, exp:'ReFS(Resilient File System)는 NTFS의 후속 파일 시스템으로 데이터 무결성과 복원력에 중점을 두었다. FAT32와는 관련이 없다.', wrong:[
    {num:1,reason:'NTFS는 퍼미션 기반 접근 권한 설정을 지원하는 것이 맞다.'},
    {num:2,reason:'NTFS는 EFS를 통한 파일 시스템 암호화를 지원한다.'},
    {num:3,reason:'ReFS는 데이터 오류 자동 확인 및 수정 기능을 제공한다.'}
  ]},
  { q:39, a:4, exp:'Windows Server 2016에는 Administrator, DefaultAccount, Guest 3개의 기본 로컬 사용자 계정이 생성된다. root는 Linux 시스템의 관리자 계정이다.', wrong:[
    {num:1,reason:'Administrator는 기본 관리자 계정으로 기본 생성된다.'},
    {num:2,reason:'DefaultAccount는 시스템에서 사용하는 기본 계정으로 기본 생성된다.'},
    {num:3,reason:'Guest는 임시 사용자용 기본 계정으로 기본 생성된다.'}
  ]},
  { q:40, a:3, exp:'/etc 디렉터리는 Linux 시스템의 환경설정 파일과 사용자 정보(passwd, shadow 등)를 포함하는 디렉터리이다.', wrong:[
    {num:1,reason:'/bin은 기본 실행 파일(명령어)이 저장되는 디렉터리이다.'},
    {num:2,reason:'/root는 root 사용자의 홈 디렉터리이다.'},
    {num:4,reason:'/proc는 가상 파일 시스템으로 프로세스 및 시스템 정보를 제공한다.'}
  ]},
  { q:41, a:4, exp:'Active Directory 그룹정책을 통해 소프트웨어를 배포(설치, 업그레이드, 제거)할 수 있다. 배포할 수 없다는 설명은 틀렸다.', wrong:[
    {num:1,reason:'그룹정책으로 암호 정책 및 계정 잠금을 강제 적용할 수 있다.'},
    {num:2,reason:'그룹정책으로 암호 길이, 복잡성 조건을 지정할 수 있다.'},
    {num:3,reason:'로밍 프로필을 통해 어느 PC에서든 동일한 환경을 제공할 수 있다.'}
  ]},
  { q:42, a:2, exp:'FTP Active 모드에서 클라이언트는 21번 포트로 서버에 접속(제어 연결)하고, 서버는 20번 포트에서 클라이언트로 데이터 연결을 시작한다.', wrong:[
    {num:1,reason:'데이터 포트가 1024라면 Passive 모드의 동작이다.'},
    {num:3,reason:'제어 포트가 20번이 되는 FTP 모드는 없다.'},
    {num:4,reason:'제어 포트 20번에 데이터 포트 1024번 조합은 존재하지 않는다.'}
  ]},
  { q:43, a:4, exp:'netstat 명령어는 네트워크 연결 상태, 라우팅 테이블, 열려있는 포트 정보를 확인할 수 있는 명령어이다.', wrong:[
    {num:1,reason:'ps는 실행 중인 프로세스 목록을 확인하는 명령어이다.'},
    {num:2,reason:'pstree는 프로세스를 트리 형태로 표시하는 명령어이다.'},
    {num:3,reason:'getenforce는 SELinux 상태를 확인하는 명령어이다.'}
  ]},
  { q:44, a:4, exp:'Listen 지시어는 Apache 웹서버가 요청을 수신할 포트 번호를 지정하는 옵션으로, 이를 변경하면 서비스 포트를 변경할 수 있다.', wrong:[
    {num:1,reason:'KeepAlive는 지속 연결(Persistent Connection) 활성화 여부를 설정한다.'},
    {num:2,reason:'DocumentRoot는 웹 문서가 위치하는 디렉터리를 지정한다.'},
    {num:3,reason:'StartServers는 시작 시 생성할 자식 프로세스 수를 지정한다.'}
  ]},
  { q:45, a:1, exp:'ipconfig /renew는 DHCP 서버로부터 새로운 IP 주소를 갱신(재발급) 받기 위해 사용하는 명령어이다.', wrong:[
    {num:2,reason:'/release는 현재 할당된 IP를 해제하는 명령이다.'},
    {num:3,reason:'/flushdns는 DNS 캐시를 삭제하는 명령이다.'},
    {num:4,reason:'/setclassid는 DHCP 클래스 ID를 설정하는 명령이다.'}
  ]},
  { q:46, a:4, exp:'광 케이블(Optical Cable)은 내부에 코어(Core)와 이를 감싸는 굴절률이 다른 클래딩(Cladding)으로 구성된 전송 매체이다.', wrong:[
    {num:1,reason:'이중 나선(Twisted Pair)은 두 가닥의 구리선을 꼬아 만든 케이블이다.'},
    {num:2,reason:'동축 케이블은 중심 도체, 절연체, 외부 도체, 피복으로 구성된다.'},
    {num:3,reason:'2선식 개방 선로는 두 개의 평행 도선으로 구성된 단순한 전송 매체이다.'}
  ]},
  { q:47, a:3, exp:'NAT(Network Address Translation)는 사설 IP를 공인 IP로 변환하여 내부 네트워크의 보안을 유지하고 IP 주소 부족 문제를 해결하는 기술이다.', wrong:[
    {num:1,reason:'DHCP는 IP 주소를 동적으로 자동 할당하는 프로토콜이다.'},
    {num:2,reason:'IPv6는 128비트 주소 체계로 IP 부족을 근본적으로 해결하지만 주소 변환 방식은 아니다.'},
    {num:4,reason:'MAC Address 방식은 IP 주소 변환과 관련이 없다.'}
  ]},
  { q:48, a:3, exp:'VLAN은 관리자가 서로 다른 논리적 그룹에 대하여 서로 다른 보안정책을 적용할 수 있다. 적용할 수 없다는 설명은 틀렸다.', wrong:[
    {num:1,reason:'VLAN은 데이터링크 계층에서 브로드캐스트 도메인을 분리하는 기술이 맞다.'},
    {num:2,reason:'동일 VLAN이 아닌 곳에는 브로드캐스트 프레임을 전달하지 않는 것이 맞다.'},
    {num:4,reason:'VLAN 태그가 다른 네트워크로의 접근을 차단하여 보안을 유지하는 것이 맞다.'}
  ]},
  { q:49, a:1, exp:'Repeater(리피터)는 OSI 1계층(물리 계층)에서 동작하며, 약해진 신호를 증폭하여 전송 거리를 연장하는 장치이다.', wrong:[
    {num:2,reason:'응용 계층(7계층)은 사용자 인터페이스와 네트워크 서비스를 제공한다.'},
    {num:3,reason:'데이터링크 계층(2계층)에서 동작하는 장치는 브리지, 스위치이다.'},
    {num:4,reason:'네트워크 계층(3계층)에서 동작하는 장치는 라우터이다.'}
  ]},
  { q:50, a:4, exp:'RAID-5는 회전 패리티(Rotating Parity) 방식으로 패리티 정보를 모든 디스크에 분산 저장하여 특정 디스크에 패리티가 집중되는 병목현상을 줄인다.', wrong:[
    {num:1,reason:'RAID-2는 해밍코드를 이용한 오류 정정 방식이다.'},
    {num:2,reason:'RAID-3는 바이트 단위 스트라이핑에 전용 패리티 디스크를 사용한다.'},
    {num:3,reason:'RAID-4는 블록 단위 스트라이핑에 전용 패리티 디스크를 사용하여 병목이 발생한다.'}
  ]}
];

// ===== exam 149: 2023년 정기 2회 =====
const exam149 = [
  { q:1, a:3, exp:'D Class(224.0.0.0 ~ 239.255.255.255)가 멀티캐스트 용도로 사용된다.', wrong:[
    {num:1,reason:'B Class(128.0.0.0~191.255.255.255)는 유니캐스트용이다.'},
    {num:2,reason:'C Class(192.0.0.0~223.255.255.255)는 유니캐스트용이다.'},
    {num:4,reason:'E Class(240.0.0.0~)는 연구/실험용 예약 주소이다.'}
  ]},
  { q:2, a:2, exp:'DNS에서 TTL은 캐시된 데이터가 DNS 서버의 캐시에서 유효한 남은 시간을 의미한다. TTL이 만료되면 캐시에서 해당 레코드가 삭제된다.', wrong:[
    {num:1,reason:'존(Zone)이 아닌 캐시에서 나오기 전의 시간이다.'},
    {num:3,reason:'DNS의 TTL은 패킷이 아닌 데이터(레코드)에 적용된다.'},
    {num:4,reason:'네임서버 레코드가 아닌 캐시된 레코드에 적용된다.'}
  ]},
  { q:3, a:1, exp:'191.234.149.32는 B Class(128.0.0.0~191.255.255.255)이고, 나머지 198.x, 222.x, 195.x는 모두 C Class(192.0.0.0~223.255.255.255)이다.', wrong:[
    {num:2,reason:'198.x.x.x는 C Class 범위에 속한다.'},
    {num:3,reason:'222.x.x.x는 C Class 범위에 속한다.'},
    {num:4,reason:'195.x.x.x는 C Class 범위에 속한다.'}
  ]},
  { q:4, a:3, exp:'4~5대의 PC를 접속하려면 최소 6~7개의 IP가 필요하다(네트워크+브로드캐스트 포함). 서브넷 마스크 255.255.255.248은 /29로 호스트 비트 3개, 서브넷당 8개 IP(사용 가능 6개)를 제공한다.', wrong:[
    {num:1,reason:'255.255.255.240은 /28로 호스트 14개, 필요 이상으로 크다.'},
    {num:2,reason:'255.255.0.192는 올바른 서브넷 마스크 형식이 아니다.'},
    {num:4,reason:'255.255.255.0은 /24로 서브넷을 나누지 않은 상태이다.'}
  ]},
  { q:5, a:1, exp:'OSPF(Open Shortest Path First)는 Link State 알고리즘을 사용하여 각 라우터가 네트워크 전체 토폴로지를 파악하고 최단 경로를 계산하는 라우팅 프로토콜이다.', wrong:[
    {num:2,reason:'IDRP(Inter-Domain Routing Protocol)는 OSI 기반 도메인 간 라우팅 프로토콜이다.'},
    {num:3,reason:'EGP(Exterior Gateway Protocol)는 외부 게이트웨이 프로토콜로 Path Vector를 사용한다.'},
    {num:4,reason:'BGP(Border Gateway Protocol)는 Path Vector 알고리즘을 사용하는 외부 라우팅 프로토콜이다.'}
  ]},
  { q:6, a:1, exp:'UDP 헤더에는 Source Port, Destination Port, Length, Checksum만 포함된다. 확인 응답 번호(Acknowledgment Number)는 TCP 헤더에만 있다.', wrong:[
    {num:2,reason:'Source Port는 UDP 헤더에 포함된다.'},
    {num:3,reason:'Checksum은 UDP 헤더에 포함된다.'},
    {num:4,reason:'Destination Port는 UDP 헤더에 포함된다.'}
  ]},
  { q:7, a:3, exp:'RARP(Reverse ARP)는 자신의 MAC(하드웨어) 주소를 이용하여 IP 주소를 알아내기 위해 사용하는 프로토콜이다.', wrong:[
    {num:1,reason:'데이터 전송 서비스를 규정하는 것은 TCP이다.'},
    {num:2,reason:'접속 없이 데이터 전송을 수행하는 것은 UDP이다.'},
    {num:4,reason:'IP 오류 제어 및 라우팅 실패 보고는 ICMP이다.'}
  ]},
  { q:8, a:1, exp:'ICMP Type 3은 Destination Unreachable(목적지 도달 불가)이다. Echo Reply에 응답하는 것은 Type 0이고, Echo Request는 Type 8이다.', wrong:[
    {num:2,reason:'Type 4(Source Quench)는 흐름제어 및 폭주제어에 사용되는 것이 맞다.'},
    {num:3,reason:'Type 5(Redirect)는 대체경로를 알리기 위해 라우터에서 사용하는 것이 맞다.'},
    {num:4,reason:'Type 17(Address Mask Request)은 서브넷 마스크를 요구하는 것이 맞다.'}
  ]},
  { q:9, a:3, exp:'IGMP(Internet Group Management Protocol)는 멀티캐스트 그룹에 가입한 호스트를 관리하는 기능을 수행하는 프로토콜이다.', wrong:[
    {num:1,reason:'네트워크 오류 보고는 ICMP의 기능이다.'},
    {num:2,reason:'대용량 파일 전송은 FTP의 기능이다.'},
    {num:4,reason:'IP에 대응하는 물리 주소를 알려주는 것은 ARP의 기능이다.'}
  ]},
  { q:10, a:1, exp:'SSH(Secure Shell)는 암호화된 패스워드를 이용하여 안전하게 원격 호스트에 접속할 수 있도록 rlogin 등을 보완하여 만든 프로토콜이다.', wrong:[
    {num:2,reason:'SNMP는 네트워크 관리 프로토콜이다.'},
    {num:3,reason:'SSL은 웹 보안 프로토콜로 원격 접속 대체용이 아니다.'},
    {num:4,reason:'Telnet은 암호화 없이 원격 접속하는 프로토콜로 보안에 취약하다.'}
  ]},
  { q:11, a:1, exp:'TCP/IP 4계층 구조는 하위부터 Network Interface → Internet → Transport → Application 순서이다.', wrong:[
    {num:2,reason:'Application이 최상위인데 최하위에 배치되어 순서가 틀렸다.'},
    {num:3,reason:'Transport가 최하위에 배치되어 순서가 틀렸다.'},
    {num:4,reason:'Internet이 최하위에 배치되어 순서가 틀렸다.'}
  ]},
  { q:12, a:3, exp:'TFTP는 UDP 방식으로 데이터를 전송하므로 데이터 손실 가능성이 있다는 것이 TFTP의 단점이다.', wrong:[
    {num:1,reason:'TFTP의 기본 포트는 69번이며, 25번은 SMTP 포트이다.'},
    {num:2,reason:'FTP는 계정 접속뿐 아니라 Anonymous(익명) 접속도 가능하다.'},
    {num:4,reason:'FTP는 TCP를 사용하며 UDP를 사용하지 않는다.'}
  ]},
  { q:13, a:4, exp:'TCP 3-way handshake의 첫 번째 단계에서 클라이언트가 세션 성립을 요청할 때 SYN 플래그가 설정된 패킷을 전송한다.', wrong:[
    {num:1,reason:'RST는 연결을 강제 리셋할 때 사용하는 플래그이다.'},
    {num:2,reason:'ACK는 수신 확인 응답 플래그로 2, 3단계에서 사용된다.'},
    {num:3,reason:'URG는 긴급 데이터를 나타내는 플래그이다.'}
  ]},
  { q:14, a:3, exp:'ZigBee는 저전력, 저속의 근거리 무선 통신 기술로 IEEE 802.15.4 표준을 기반으로 하며, 홈 오토메이션, 센서 네트워크 등에 사용된다.', wrong:[
    {num:1,reason:'WLAN은 무선 랜으로 IEEE 802.11 계열의 기술이다.'},
    {num:2,reason:'HomeRF는 가정용 무선 네트워크 기술로 현재 거의 사용되지 않는다.'},
    {num:4,reason:'IrDA는 적외선을 이용한 근거리 통신 기술이다.'}
  ]},
  { q:15, a:4, exp:'POP3(Post Office Protocol 3)는 메일 수신, SMTP(Simple Mail Transfer Protocol)는 메일 발신에 사용되는 전자 메일 프로토콜이다.', wrong:[
    {num:1,reason:'HTTP는 웹 전송 프로토콜로 전자 메일과 무관하다.'},
    {num:2,reason:'ICMP는 네트워크 오류 보고 프로토콜이다.'},
    {num:3,reason:'ICMP는 전자 메일 프로토콜이 아니다.'}
  ]},
  { q:16, a:2, exp:'IPv6에서 MTU보다 큰 패킷을 전송해야 할 때 Fragmentation(단편화) 확장 헤더를 사용하여 패킷을 분할한다.', wrong:[
    {num:1,reason:'Source Routing은 패킷이 거쳐갈 경로를 지정하는 확장 헤더이다.'},
    {num:3,reason:'Authentication은 패킷의 인증과 무결성을 제공하는 확장 헤더이다.'},
    {num:4,reason:'Destination Option은 목적지에서만 처리되는 옵션 정보를 전달한다.'}
  ]},
  { q:17, a:1, exp:'IP의 체크섬은 IP 헤더의 완전성(무결성)만 검사한다. 데이터 부분의 완전성은 상위 계층(TCP/UDP)의 체크섬이 담당한다.', wrong:[
    {num:2,reason:'IP 체크섬은 헤더만 검사하며 데이터는 검사하지 않는다.'},
    {num:3,reason:'데이터의 완전성은 상위 계층에서 검사한다.'},
    {num:4,reason:'체크섬은 IP 계층에서도 제공되며 TCP 계층에만 한정되지 않는다.'}
  ]},
  { q:18, a:1, exp:'사물인터넷(IoT)은 사물에 센서와 통신 기능을 내장하여 인터넷에 연결하고 데이터를 수집·교환하는 기술이다.', wrong:[
    {num:2,reason:'유비쿼터스는 언제 어디서나 컴퓨팅 환경에 접근할 수 있는 개념이다.'},
    {num:3,reason:'에지 컴퓨팅은 데이터를 중앙이 아닌 네트워크 가장자리에서 처리하는 기술이다.'},
    {num:4,reason:'신 클라이언트는 서버에 의존하여 처리하는 최소 기능 단말이다.'}
  ]},
  { q:19, a:1, exp:'Adaptive ARQ는 전송효율을 최대로 하기 위해 채널 상태에 따라 프레임의 길이를 동적으로 변경시킬 수 있는 방식이다.', wrong:[
    {num:2,reason:'Go-back-N ARQ는 오류 발생 시 해당 프레임부터 재전송하는 고정 프레임 방식이다.'},
    {num:3,reason:'Selective-Repeat ARQ는 오류 프레임만 선택적으로 재전송하는 방식이다.'},
    {num:4,reason:'Stop and Wait ARQ는 하나씩 전송하고 확인을 기다리는 방식이다.'}
  ]},
  { q:20, a:3, exp:'Text의 압축, 암호 기능은 표현 계층(Presentation Layer, 6계층)의 기능이다. Data Link 계층(2계층)의 기능이 아니다.', wrong:[
    {num:1,reason:'전송 오류 제어는 데이터 링크 계층의 올바른 기능이다.'},
    {num:2,reason:'흐름(Flow) 제어는 데이터 링크 계층의 올바른 기능이다.'},
    {num:4,reason:'링크 관리는 데이터 링크 계층의 올바른 기능이다.'}
  ]},
  { q:21, a:4, exp:'패킷교환은 복수의 상대방과 동시에 통신이 가능하다. 이것이 회선교환 대비 패킷교환의 장점 중 하나이다.', wrong:[
    {num:1,reason:'패킷교환은 오류제어로 고품질·고신뢰성 통신이 가능한 것이 맞다.'},
    {num:2,reason:'전송 시에만 전송로를 사용하므로 설비 이용 효율이 높은 것이 맞다.'},
    {num:3,reason:'가상회선 방식과 데이터그램 방식 두 가지가 있는 것이 맞다.'}
  ]},
  { q:22, a:3, exp:'IPSec은 네트워크 계층에서 IP 패킷을 암호화하고 인증하는 VPN 프로토콜로, 터널 모드와 전송 모드를 지원한다.', wrong:[
    {num:1,reason:'PPTP는 2계층 VPN 프로토콜로 Microsoft에서 개발했다.'},
    {num:2,reason:'L2TP는 2계층 터널링 프로토콜로 자체 암호화가 없다.'},
    {num:4,reason:'SSL은 전송 계층 보안 프로토콜로 웹 VPN에 사용된다.'}
  ]},
  { q:23, a:4, exp:'SIP(Session Initiation Protocol)는 멀티미디어 세션(음성, 영상, 데이터)의 설정, 변경, 종료를 관리하는 시그널링 프로토콜로 화상 회의에 사용된다.', wrong:[
    {num:1,reason:'IRC는 텍스트 기반 인터넷 채팅 프로토콜이다.'},
    {num:2,reason:'HEVC/H.265는 비디오 코덱(압축 표준)이지 세션 관리 프로토콜이 아니다.'},
    {num:3,reason:'MIME는 이메일에서 멀티미디어 콘텐츠를 전송하는 표준이다.'}
  ]},
  { q:24, a:3, exp:'CSMA/CD 방식은 반송파가 감지되지 않으면 네트워크가 사용되지 않는 것으로 판단하여 데이터를 전송한다.', wrong:[
    {num:1,reason:'CSMA/CD는 버스형 토폴로지의 이더넷에서 사용하며 링형이 아니다.'},
    {num:2,reason:'CSMA/CD는 반송파 존재 여부를 확인한 후 전송한다.'},
    {num:4,reason:'통신량이 많아지면 충돌이 증가하여 지연 시간을 예측하기 어렵다.'}
  ]},
  { q:25, a:1, exp:'1000Base-SX는 기가비트 이더넷 규격으로, 멀티모드 광섬유를 사용하여 단거리(550m) 1Gbps 전송을 지원한다.', wrong:[
    {num:2,reason:'1000Base-NX는 존재하지 않는 규격이다.'},
    {num:3,reason:'1000Base-BX는 양방향 단일 광섬유 기가비트 이더넷이지만 SX가 더 표준적이다.'},
    {num:4,reason:'1000Base-AX는 존재하지 않는 규격이다.'}
  ]},
  { q:26, a:4, exp:'링형 네트워크는 각 노드가 인접한 두 노드와만 연결되어 확장성이 떨어진다. 노드 추가 시 링을 끊고 재연결해야 하기 때문이다.', wrong:[
    {num:1,reason:'링형은 토큰이 순환하므로 장애 발생 시 비교적 쉽게 발견할 수 있다.'},
    {num:2,reason:'링형은 노드간 연결을 최소화하는 목적으로 설계되었다.'},
    {num:3,reason:'한 노드의 오류가 전체 네트워크에 영향을 주는 것은 맞다.'}
  ]},
  { q:27, a:3, exp:'핸드오프(Handoff)는 이동 중인 단말이 하나의 기지국 셀에서 다른 셀로 이동할 때 통신 채널을 자동으로 전환하는 기술이다.', wrong:[
    {num:1,reason:'채널체인징은 일반적인 모바일 셀룰러 용어가 아니다.'},
    {num:2,reason:'페이징은 네트워크가 단말의 위치를 찾기 위해 호출하는 과정이다.'},
    {num:4,reason:'핸드쉐이크는 통신 시작 시 상호 확인 과정으로 셀 이동과 무관하다.'}
  ]},
  { q:28, a:3, exp:'CNAME(Canonical Name) 레코드는 도메인의 별칭(Alias)을 등록하는 것이다. 서브 도메인이 아닌 별칭 도메인을 등록한다.', wrong:[
    {num:1,reason:'A/AAAA 레코드는 호스트 이름에 대한 IP 주소를 등록하는 것이 맞다.'},
    {num:2,reason:'PTR 레코드는 IP 주소에 대한 FQDN을 등록하는 것이 맞다.'},
    {num:4,reason:'MX 레코드는 메일서버를 등록하는 것이 맞다.'}
  ]},
  { q:29, a:3, exp:'Shell은 사용자가 입력한 명령어를 해석하여 Kernel에 전달하는 명령어 해석기 역할을 한다.', wrong:[
    {num:1,reason:'System Program은 운영체제의 기능을 제공하는 프로그램이다.'},
    {num:2,reason:'Loader는 실행 파일을 메모리에 적재하는 프로그램이다.'},
    {num:4,reason:'Directory는 파일을 조직적으로 관리하는 구조이다.'}
  ]},
  { q:30, a:4, exp:'chmod 644는 소유자 rw-(6), 그룹 r--(4), 기타 r--(4)로 설정하여 소유자 외에는 읽기만 가능하고 수정은 불가능하게 한다.', wrong:[
    {num:1,reason:'777은 모든 사용자에게 읽기/쓰기/실행 권한을 부여한다.'},
    {num:2,reason:'666은 모든 사용자에게 읽기/쓰기 권한을 부여하여 수정이 가능하다.'},
    {num:3,reason:'646은 그룹에 읽기 권한이 없고 기타에 rw 권한이 있어 비대칭적이다.'}
  ]},
  { q:31, a:3, exp:'TPM(Trusted Platform Module)은 하드웨어 기반 보안 모듈로, BitLocker 암호화 키를 안전하게 저장하고 관리하기 위해 메인보드와 BIOS에서 지원해야 한다.', wrong:[
    {num:1,reason:'FSRM(File Server Resource Manager)은 파일 서버 리소스 관리 도구이다.'},
    {num:2,reason:'NTLM은 Windows 네트워크 인증 프로토콜이다.'},
    {num:4,reason:'Heartbeat는 클러스터 노드 간 생존 확인 메커니즘이다.'}
  ]},
  { q:32, a:1, exp:'perfmon은 Windows의 성능 모니터(Performance Monitor)를 시작하는 명령어로, 시스템 성능 데이터를 수집하고 분석할 수 있다.', wrong:[
    {num:2,reason:'msconfig는 시스템 구성 유틸리티 명령어이다.'},
    {num:3,reason:'dfrg는 디스크 조각 모음 명령어이다(구 버전).'},
    {num:4,reason:'secpol은 로컬 보안 정책 편집기 명령어이다.'}
  ]},
  { q:33, a:3, exp:'lsattr 명령어는 Linux에서 파일의 확장 속성(attribute)을 출력하는 명령어로, i(immutable) 속성 등을 확인할 수 있다.', wrong:[
    {num:1,reason:'file 명령어는 파일의 종류(타입)를 확인하는 명령어이다.'},
    {num:2,reason:'stat 명령어는 파일의 상태(크기, 수정시간 등)를 확인하는 명령어이다.'},
    {num:4,reason:'lsblk는 블록 디바이스 목록을 확인하는 명령어이다.'}
  ]},
  { q:34, a:2, exp:'nohup 명령어는 터미널이 종료되어도 실행 중인 프로세스가 종료되지 않고 백그라운드에서 계속 작업되도록 해주는 명령어이다.', wrong:[
    {num:1,reason:'mkfs는 파일 시스템을 생성하는 명령어이다.'},
    {num:3,reason:'sleep은 지정된 시간만큼 프로세스를 대기시키는 명령어이다.'},
    {num:4,reason:'last는 사용자 로그인 이력을 확인하는 명령어이다.'}
  ]},
  { q:35, a:4, exp:'-W 옵션은 패스워드 만료 전 경고 일수를 설정하는 옵션이다. chage -W 10 John으로 10일 전에 암호 변경 경고를 보낸다.', wrong:[
    {num:1,reason:'-m은 패스워드 최소 사용 일수를 설정하는 옵션이다.'},
    {num:2,reason:'-L은 존재하지 않는 옵션이다(소문자 -l은 정보 조회).'},
    {num:3,reason:'-i는 패스워드 만료 후 비활성 기간을 설정하는 옵션이다.'}
  ]},
  { q:36, a:2, exp:'ipconfig /flushdns는 DNS 클라이언트 캐시를 초기화(삭제)하여 기존 캐시된 DNS 레코드를 제거하는 명령어이다.', wrong:[
    {num:1,reason:'/displydns는 올바르지 않은 옵션이다(정확한 옵션은 /displaydns).'},
    {num:3,reason:'/release는 DHCP로부터 할당받은 IP를 해제하는 명령이다.'},
    {num:4,reason:'/renew는 DHCP로부터 IP를 갱신받는 명령이다.'}
  ]},
  { q:37, a:2, exp:'EFS는 인증서 파일의 확장자로 CER, P7B, PFX, SST 형식을 지원한다.', wrong:[
    {num:1,reason:'EFS는 NTFS 파일 시스템의 파일과 폴더에 암호화를 적용하며 파일에만 한정되지 않는다.'},
    {num:3,reason:'EFS는 개인키 보호에 암호 외에 스마트카드도 사용할 수 있다.'},
    {num:4,reason:'Windows 재설치 시 인증서가 없으면 암호화된 파일을 열 수 없다.'}
  ]},
  { q:38, a:4, exp:'net user는 로컬 사용자 계정 관리 명령어이며, Active Directory 도메인 사용자 계정 관리 명령어가 아니다. dsadd, dsmod, dsrm은 AD 도메인 계정 관리 명령어이다.', wrong:[
    {num:1,reason:'dsadd는 AD에서 개체(사용자 등)를 생성하는 명령어이다.'},
    {num:2,reason:'dsmod는 AD에서 개체를 수정하는 명령어이다.'},
    {num:3,reason:'dsrm은 AD에서 개체를 삭제하는 명령어이다.'}
  ]},
  { q:39, a:1, exp:'fdisk는 디스크 파티션을 관리하는 명령어로, 마운트 확인용이 아니다. mount, df, cat /etc/mtab은 모두 마운트 상태를 확인할 수 있다.', wrong:[
    {num:2,reason:'mount 명령어는 현재 마운트된 파일 시스템을 확인할 수 있다.'},
    {num:3,reason:'df 명령어는 마운트된 파일 시스템의 디스크 사용량을 확인할 수 있다.'},
    {num:4,reason:'cat /etc/mtab은 현재 마운트된 파일 시스템 정보를 확인할 수 있다.'}
  ]},
  { q:40, a:2, exp:'chown(change owner) 명령어는 파일이나 디렉터리의 소유자(owner)와 소유 그룹(group)을 변경하는 명령어이다.', wrong:[
    {num:1,reason:'chmod는 파일 권한(permission)을 변경하는 명령어이다.'},
    {num:3,reason:'useradd는 새 사용자 계정을 생성하는 명령어이다.'},
    {num:4,reason:'chage는 패스워드 만료 정책을 설정하는 명령어이다.'}
  ]},
  { q:41, a:1, exp:'lastb 명령어는 /var/log/btmp 파일을 읽어 실패한(비인가) 로그인 시도 이력을 확인하는 명령어이다.', wrong:[
    {num:2,reason:'xferlog는 FTP 서버의 파일 전송 로그를 확인하는 명령어이다.'},
    {num:3,reason:'history는 현재 사용자의 명령어 실행 이력을 확인하는 명령어이다.'},
    {num:4,reason:'pkill은 프로세스를 종료하는 명령어이다.'}
  ]},
  { q:42, a:2, exp:'netstat -antp는 모든(-a) 숫자형식(-n) TCP(-t) 연결과 프로그램명(-p)을 표시하여 열려있는 서비스 포트를 확인할 수 있다.', wrong:[
    {num:1,reason:'ps -ef | grep tcp는 프로세스 목록에서 tcp 문자열을 검색하는 것으로 포트 확인에 부적합하다.'},
    {num:3,reason:'netstat -rn은 라우팅 테이블을 숫자 형식으로 표시하는 명령이다.'},
    {num:4,reason:'cat /etc/services는 포트 번호 정의 파일을 조회하는 것으로 실제 열린 포트와 다르다.'}
  ]},
  { q:43, a:3, exp:'/proc는 가상 파일 시스템으로 동작 중인 프로세스 상태 정보, 하드웨어 정보, 시스템 정보 등을 확인할 수 있다.', wrong:[
    {num:1,reason:'/boot는 부트 로더와 커널 이미지가 저장되는 디렉터리이다.'},
    {num:2,reason:'/etc는 시스템 설정 파일이 저장되는 디렉터리이다.'},
    {num:4,reason:'/lib는 시스템 라이브러리 파일이 저장되는 디렉터리이다.'}
  ]},
  { q:44, a:1, exp:'cat exam.txt | more는 파일 내용을 more 명령어로 파이프하여 한 페이지씩 차례대로 볼 수 있게 해준다.', wrong:[
    {num:2,reason:'grep은 패턴 검색 명령어로 페이지 단위 보기와 무관하다.'},
    {num:3,reason:'find는 파일 검색 명령어이며 파일 내용을 보는 명령이 아니다.'},
    {num:4,reason:'tar는 아카이브(압축) 명령어이며 파일 내용을 보는 명령이 아니다.'}
  ]},
  { q:45, a:2, exp:'TCP 포트는 웹서버의 통신 포트 번호(기본 80)를 지정하는 것이며, 물리적 시리얼 포트 번호와는 무관하다.', wrong:[
    {num:1,reason:'IP 주소 필드에서 2개 이상의 IP가 할당된 경우 접속 순서를 지정하는 설명은 올바르다.'},
    {num:3,reason:'연결 수 제한은 동시 접속 가능한 수를 설정하는 올바른 설명이다.'},
    {num:4,reason:'연결 시간 제한은 일정 시간 비활동 시 세션을 끊는 올바른 설명이다.'}
  ]},
  { q:46, a:4, exp:'Optical Fiber(광 케이블)는 유리 섬유를 이용하여 빛으로 데이터를 전송하며 가장 빠른 속도와 넓은 대역폭을 가지지만 비용이 높고 유지보수가 어렵다.', wrong:[
    {num:1,reason:'Coaxial Cable(동축 케이블)은 구리 도체 기반으로 속도가 광 케이블보다 느리다.'},
    {num:2,reason:'Twisted Pair(꼬임쌍선)는 구리선을 꼬아 만든 케이블이다.'},
    {num:3,reason:'Thin Cable은 얇은 동축 케이블(10Base2)을 의미한다.'}
  ]},
  { q:47, a:2, exp:'VLAN(Virtual LAN)은 물리적 LAN을 논리적으로 나누어 내부망을 분리하고, 방화벽과 함께 외부로부터 내부를 보호할 때 사용할 수 있다.', wrong:[
    {num:1,reason:'NAC(Network Access Control)는 네트워크 접근 제어 솔루션이다.'},
    {num:3,reason:'IPS(Intrusion Prevention System)는 침입 방지 시스템이다.'},
    {num:4,reason:'IDS(Intrusion Detection System)는 침입 탐지 시스템이다.'}
  ]},
  { q:48, a:1, exp:'DHCP(Dynamic Host Configuration Protocol)는 호스트가 네트워크에 접속할 때마다 IP 주소 등 네트워크 파라미터를 동적으로 할당하는 프로토콜이다.', wrong:[
    {num:2,reason:'DNS는 도메인 이름을 IP 주소로 변환하는 시스템으로 IP 할당과 무관하다.'},
    {num:3,reason:'IP주소 관리 시스템은 IP를 동적으로 할당하는 프로토콜이 아니다.'},
    {num:4,reason:'NAC는 네트워크 접근 제어 솔루션으로 IP 동적 할당과 다르다.'}
  ]},
  { q:49, a:2, exp:'RAID 1은 미러링(Mirroring) 방식으로 데이터를 두 개의 디스크에 동일하게 복제하여 최고의 고장대비 능력을 제공한다.', wrong:[
    {num:1,reason:'RAID 0은 스트라이핑 방식으로 성능은 좋지만 고장 대비 능력이 없다.'},
    {num:3,reason:'RAID 3는 바이트 단위 스트라이핑과 전용 패리티 디스크를 사용한다.'},
    {num:4,reason:'RAID 5는 블록 단위 스트라이핑과 분산 패리티를 사용한다.'}
  ]},
  { q:50, a:4, exp:'IEEE 802.11ax(Wi-Fi 6)는 OFDMA, MU-MIMO 등의 기술을 사용하여 고밀도 환경에서 높은 효율을 제공하는 최신 와이파이 규격이다.', wrong:[
    {num:1,reason:'IEEE 802.11n(Wi-Fi 4)은 MIMO 기술을 도입한 이전 세대 규격이다.'},
    {num:2,reason:'IEEE 802.11ac(Wi-Fi 5)는 5GHz 대역의 고속 전송을 지원하는 규격이다.'},
    {num:3,reason:'IEEE 802.11be(Wi-Fi 7)는 아직 개발/표준화 중인 차세대 규격이다.'}
  ]}
];

// ===== exam 150: 2023년 정기 3회 =====
const exam150 = [
  { q:1, a:3, exp:'VPN(Virtual Private Network)은 공중 네트워크를 통해 사설 네트워크를 안전하게 연결하여 데이터를 암호화하고 터널링하는 기술이다.', wrong:[
    {num:1,reason:'SSL은 전송 계층 보안 프로토콜로 VPN 구현에 사용될 수 있지만 VPN 자체는 아니다.'},
    {num:2,reason:'NAT는 주소 변환 기술이다.'},
    {num:4,reason:'IDS는 침입 탐지 시스템이다.'}
  ]},
  { q:2, a:2, exp:'Longest match rule은 라우팅 테이블에서 목적지 IP와 가장 긴 접두어(Prefix)가 일치하는 경로를 선택하는 규칙이다.', wrong:[
    {num:1,reason:'Administrative distance는 라우팅 프로토콜의 신뢰도 값이다.'},
    {num:3,reason:'Next-hop address는 다음 라우터의 주소이다.'},
    {num:4,reason:'Metric은 경로의 비용을 나타내는 값이다.'}
  ]},
  { q:3, a:4, exp:'Reverse ARP(RARP)는 자신의 MAC 주소를 이용하여 IP 주소를 알아내는 프로토콜이다.', wrong:[
    {num:1,reason:'ARP는 IP 주소를 MAC 주소로 변환하는 프로토콜이다.'},
    {num:2,reason:'Proxy ARP는 다른 네트워크의 ARP 요청에 대신 응답하는 기술이다.'},
    {num:3,reason:'Inverse ARP는 Frame Relay에서 DLCI를 IP로 매핑하는 프로토콜이다.'}
  ]},
  { q:4, a:3, exp:'DNS는 일반적으로 UDP 53번 포트를 사용하지만, 512바이트 초과 응답이나 영역 전송 시 TCP 53번 포트도 사용한다.', wrong:[
    {num:1,reason:'SMTP는 TCP 25번 포트만 사용한다.'},
    {num:2,reason:'FTP는 TCP 20/21번 포트만 사용한다.'},
    {num:4,reason:'Telnet은 TCP 23번 포트만 사용한다.'}
  ]},
  { q:5, a:3, exp:'SNMP(Simple Network Management Protocol)는 네트워크 장비를 관리하고 감시하는 기능을 제공하는 프로토콜이다.', wrong:[
    {num:1,reason:'대규모 환경의 망 관리는 TMN 등의 기능이다.'},
    {num:2,reason:'네트워크 장비 에러 보고는 ICMP의 기능이다.'},
    {num:4,reason:'호스트 간 연결성 점검과 혼잡 제어는 ICMP와 TCP의 기능이다.'}
  ]},
  { q:6, a:3, exp:'HTTP 300번대 상태코드는 리다이렉션을 의미하며, 요청 수행을 완료하기 위해 추가적인 작업이 필요함을 나타낸다.', wrong:[
    {num:1,reason:'100번대는 정보 제공(Informational) 코드이며 성공이 아니다.'},
    {num:2,reason:'200번대가 성공(Success) 코드이며 정보 제공이 아니다.'},
    {num:4,reason:'400번대는 클라이언트 에러이며, 500번대가 서버 에러이다.'}
  ]},
  { q:7, a:2, exp:'ICMP Type 5는 Redirect(재지정)이며, Type 8이 Echo Request이다. Type 5가 Echo Request라는 설명은 틀렸다.', wrong:[
    {num:1,reason:'Type 0은 Echo Reply로 올바른 설명이다.'},
    {num:3,reason:'Type 13은 Timestamp Request로 올바른 설명이다.'},
    {num:4,reason:'Type 17은 Address Mask Request로 올바른 설명이다.'}
  ]},
  { q:8, a:3, exp:'토큰(Token)을 사용하는 것은 Token Ring/Token Bus 방식이다. CSMA/CD는 토큰 없이 캐리어 감지 후 충돌을 감지하는 방식이다.', wrong:[
    {num:1,reason:'충돌 도메인이 작을수록 충돌 확률이 줄어 효율이 좋다.'},
    {num:2,reason:'충돌 후 임의 시간 대기로 지연 시간 예측이 어려운 것은 맞다.'},
    {num:4,reason:'캐리어 감지를 위해 신호를 주기적으로 보내는 것은 맞다.'}
  ]},
  { q:9, a:2, exp:'OSPF는 Dijkstra 알고리즘을 사용하여 최단 경로를 계산하는 Link State 라우팅 프로토콜이다.', wrong:[
    {num:1,reason:'Bellman-Ford 알고리즘은 RIP 등 거리 벡터 라우팅에서 사용된다.'},
    {num:3,reason:'거리 벡터 라우팅 알고리즘은 RIP에서 사용되며 OSPF의 방식이 아니다.'},
    {num:4,reason:'Floyd-Warshall은 모든 쌍 최단경로 알고리즘으로 라우팅에 사용되지 않는다.'}
  ]},
  { q:10, a:4, exp:'D Class(224.0.0.0 ~ 239.255.255.255)가 멀티캐스트 용도로 사용된다.', wrong:[
    {num:1,reason:'A Class는 유니캐스트용으로 대규모 네트워크에 사용된다.'},
    {num:2,reason:'B Class는 유니캐스트용으로 중규모 네트워크에 사용된다.'},
    {num:3,reason:'C Class는 유니캐스트용으로 소규모 네트워크에 사용된다.'}
  ]},
  { q:11, a:1, exp:'캡슐화(Encapsulation)는 상위 계층에서 받은 데이터에 헤더와 트레일러를 부가하여 하위 계층으로 전달하는 과정이다.', wrong:[
    {num:2,reason:'동기화는 송수신 측의 타이밍을 맞추는 기능이다.'},
    {num:3,reason:'다중화는 하나의 채널로 여러 신호를 전송하는 기능이다.'},
    {num:4,reason:'주소지정은 목적지를 식별하기 위한 주소를 부여하는 기능이다.'}
  ]},
  { q:12, a:4, exp:'TCP 3-Way Handshake의 3단계에서 클라이언트는 ACK 플래그를 설정한 패킷을 전송하여 연결 수립을 완료한다.', wrong:[
    {num:1,reason:'SYN은 1단계(연결 요청)에서 사용된다.'},
    {num:2,reason:'RST는 연결 리셋에 사용되며 정상 연결 수립에는 사용되지 않는다.'},
    {num:3,reason:'SYN+ACK는 2단계(서버 응답)에서 사용된다.'}
  ]},
  { q:13, a:3, exp:'Broadcast는 한 호스트에서 네트워크상의 모든 호스트들로 메시지를 전송하는 것이다.', wrong:[
    {num:1,reason:'하나의 호스트에서 다른 하나의 호스트로 전송하는 것은 유니캐스트이다.'},
    {num:2,reason:'특정 그룹으로 전송하는 것은 멀티캐스트이다.'},
    {num:4,reason:'가장 가까운 특정 그룹 호스트로 전송하는 것은 애니캐스트이다.'}
  ]},
  { q:14, a:4, exp:'C Class에서 5개의 네트워크로 나누려면 최소 3비트가 필요하다(2^3=8). 서브넷 마스크는 255.255.255.224(11100000)이 되며, 255.255.224.0은 B Class의 서브넷 마스크이다.', wrong:[
    {num:1,reason:'A Class의 기본 서브넷 마스크 255.0.0.0은 올바른 설명이다.'},
    {num:2,reason:'B Class에서 2개 네트워크 분리 시 서브넷 마스크 255.255.128.0은 올바르다.'},
    {num:3,reason:'C Class의 기본 서브넷 마스크 255.255.255.0은 올바른 설명이다.'}
  ]},
  { q:15, a:3, exp:'IGMP는 로컬 네트워크에서 멀티캐스팅 그룹에 대한 호스트의 가입과 탈퇴를 관리하는 프로토콜이다.', wrong:[
    {num:1,reason:'IGMP는 네트워크 계층(3계층)에서 동작하며 4계층이 아니다.'},
    {num:2,reason:'IGMP는 TTL을 제공하며 비대칭이라는 설명은 부정확하다.'},
    {num:4,reason:'IGMP는 멀티캐스트 관리용이며 유니캐스트와는 무관하다.'}
  ]},
  { q:16, a:4, exp:'IP는 MTU(Maximum Transmission Unit) 값보다 큰 데이터그램을 단편화(Fragmentation)하여 전송할 수 있다.', wrong:[
    {num:1,reason:'IP는 비연결형 비신뢰성 프로토콜로 패킷 전달의 신뢰성을 보장하지 않는다.'},
    {num:2,reason:'IP는 손실된 패킷의 재전송을 요청하지 않는다(상위 계층 TCP가 담당).'},
    {num:3,reason:'IP는 흐름제어 기능이 없다(상위 계층 TCP가 담당).'}
  ]},
  { q:17, a:3, exp:'201.100.5.68/28에서 서브넷 마스크는 255.255.255.240이다. 68을 이진수로 변환하면 01000100이고, 상위 4비트(0100=64)가 네트워크 부분이므로 Network ID는 201.100.5.64이다.', wrong:[
    {num:1,reason:'201.100.5.32는 /27 서브넷의 네트워크 주소이다.'},
    {num:2,reason:'201.100.5.0은 /24 서브넷의 네트워크 주소이다.'},
    {num:4,reason:'201.100.5.31은 유효한 네트워크 ID가 아니다.'}
  ]},
  { q:18, a:1, exp:'WMN(Wireless Mesh Network)은 각 노드가 서로 메시 형태로 연결되어 자율적으로 네트워크를 구성하는 무선 네트워크 기술이다.', wrong:[
    {num:2,reason:'UWB(Ultra Wide Band)는 초광대역 무선 기술로 근거리 고속 전송용이다.'},
    {num:3,reason:'WPAN은 개인 영역 무선 네트워크로 범위가 매우 좁다.'},
    {num:4,reason:'CAN(Campus Area Network)은 캠퍼스 규모의 네트워크이다.'}
  ]},
  { q:19, a:4, exp:'Optical Fiber Cable(광 케이블)은 광신호로 데이터를 전송하며 높은 대역폭과 장거리 전송이 가능한 매체이다.', wrong:[
    {num:1,reason:'U/UTP CAT.3는 비차폐 꼬임쌍선으로 전화 및 10Mbps 이더넷용이다.'},
    {num:2,reason:'Thin Coaxial Cable은 얇은 동축 케이블(10Base2)이다.'},
    {num:3,reason:'U/FTP CAT.5는 차폐 꼬임쌍선으로 100Mbps 이더넷용이다.'}
  ]},
  { q:20, a:1, exp:'NFV(Network Functions Virtualization)는 네트워크 기능을 소프트웨어로 가상화하여 범용 하드웨어에서 실행하는 기술이다.', wrong:[
    {num:2,reason:'WMN은 무선 메시 네트워크 기술이다.'},
    {num:3,reason:'VPN은 가상 사설 네트워크 기술이다.'},
    {num:4,reason:'CDN은 콘텐츠 전송 네트워크이다.'}
  ]},
  { q:21, a:1, exp:'QoS(Quality of Service)는 네트워크에서 데이터 전송 품질을 보장하기 위해 대역폭, 지연, 손실률 등을 관리하는 기술이다.', wrong:[
    {num:2,reason:'F/W(Firewall)는 네트워크 트래픽을 필터링하는 보안 장치이다.'},
    {num:3,reason:'IPS는 침입을 탐지하고 차단하는 시스템이다.'},
    {num:4,reason:'IDS는 침입을 탐지하여 알림을 제공하는 시스템이다.'}
  ]},
  { q:22, a:2, exp:'IPv6의 일반적 특징에 해당하는 것들(128비트 주소, 멀티캐스트, 간소화된 헤더, IPsec 기본 지원 등)을 포함한 조합이 A, C, D, E이다.', wrong:[
    {num:1,reason:'A, B, C, D에는 IPv6 특징에 해당하지 않는 항목이 포함되어 있다.'},
    {num:3,reason:'B, C, D, E에는 올바르지 않은 항목이 포함되어 있다.'},
    {num:4,reason:'B, D, E, F에는 올바르지 않은 항목이 포함되어 있다.'}
  ]},
  { q:23, a:2, exp:'스타형(Star) 구성은 중앙의 제어점(허브/스위치)으로부터 모든 기기가 점 대 점(Point to Point) 방식으로 연결된 형태이다.', wrong:[
    {num:1,reason:'링형은 각 노드가 인접한 두 노드와 순환형으로 연결된 구성이다.'},
    {num:3,reason:'버스형은 하나의 공유 매체에 모든 노드가 연결된 구성이다.'},
    {num:4,reason:'트리형은 계층적 구조로 노드가 연결된 구성이다.'}
  ]},
  { q:24, a:3, exp:'표현 계층(Presentation Layer, 6계층)은 데이터의 암호/복호, 인증, 압축 등의 기능을 수행한다.', wrong:[
    {num:1,reason:'전송 계층(4계층)은 종단 간 통신과 흐름 제어를 담당한다.'},
    {num:2,reason:'데이터링크 계층(2계층)은 프레임화와 오류 검출을 담당한다.'},
    {num:4,reason:'응용 계층(7계층)은 사용자 인터페이스와 네트워크 서비스를 제공한다.'}
  ]},
  { q:25, a:2, exp:'WDM은 광증폭기(EDFA)를 사용하여 무중계 장거리 전송이 가능하며, 파장별로 다중화하여 대용량 전송을 실현한다.', wrong:[
    {num:1,reason:'WDM은 선로 증설 없이 파장 추가만으로 회선 증설이 가능하다.'},
    {num:3,reason:'WDM은 시간축이 아닌 파장(주파수)축에서 다중화하는 방식이다.'},
    {num:4,reason:'각 채널은 서로 다른 전송 형식, 속도, 프로토콜을 가질 수 있다.'}
  ]},
  { q:26, a:1, exp:'터널링(Tunneling)은 VPN에서 두 호스트 사이에 가상의 전용 경로(터널)를 설정하여 외부 영향을 받지 않고 데이터를 전송하는 기술이다.', wrong:[
    {num:2,reason:'Authentication은 사용자나 장치의 신원을 확인하는 기술이다.'},
    {num:3,reason:'Encryption은 데이터를 암호화하여 기밀성을 보장하는 기술이다.'},
    {num:4,reason:'Access Control은 접근 권한을 관리하는 기술이다.'}
  ]},
  { q:27, a:1, exp:'IEEE 802.2는 LLC(Logical Link Control) 표준이며 Wireless LAN이 아니다. Wireless LAN은 IEEE 802.11이다.', wrong:[
    {num:2,reason:'IEEE 802.3은 CSMA/CD(이더넷) 표준이 맞다.'},
    {num:3,reason:'IEEE 802.4는 Token Bus 표준이 맞다.'},
    {num:4,reason:'IEEE 802.5는 Token Ring 표준이 맞다.'}
  ]},
  { q:28, a:2, exp:'Passive Mode는 서버가 임의의 데이터 포트를 설정하고 해당 포트 정보를 클라이언트에 전달하여, 클라이언트가 해당 포트로 접속하는 방식이다.', wrong:[
    {num:1,reason:'Active Mode는 서버가 20번 포트에서 클라이언트로 접속하는 방식이다.'},
    {num:3,reason:'Privileges Mode는 FTP 모드가 아니다.'},
    {num:4,reason:'Proxy Mode는 FTP 모드가 아니다.'}
  ]},
  { q:29, a:3, exp:'init 6은 시스템을 재부팅하는 명령이지 종료 명령이 아니다. shutdown -h now, poweroff, halt는 모두 시스템 종료 명령이다.', wrong:[
    {num:1,reason:'shutdown -h now는 즉시 시스템을 종료하는 명령이다.'},
    {num:2,reason:'poweroff는 시스템을 종료하는 명령이다.'},
    {num:4,reason:'halt는 시스템을 종료하는 명령이다.'}
  ]},
  { q:30, a:1, exp:'resolv.conf는 DNS 서버 주소를 설정하는 파일로, /etc/resolv.conf에서 nameserver 항목을 확인하고 수정할 수 있다.', wrong:[
    {num:2,reason:'networks는 네트워크 이름과 주소를 매핑하는 파일이다.'},
    {num:3,reason:'protocols는 프로토콜 이름과 번호를 매핑하는 파일이다.'},
    {num:4,reason:'services는 서비스 이름과 포트 번호를 매핑하는 파일이다.'}
  ]},
  { q:31, a:1, exp:'Round Robin은 동일 도메인에 여러 IP를 등록하여 DNS 질의 시 IP 주소를 순환하며 응답하는 부하 분산 방식이다.', wrong:[
    {num:2,reason:'Cache Plugin은 DNS 부하분산 방식이 아니다.'},
    {num:3,reason:'Cache Server는 캐시 기반 서버로 부하분산 방식과 다르다.'},
    {num:4,reason:'Azure AutoScaling은 클라우드 자동 확장 기능으로 DNS 방식이 아니다.'}
  ]},
  { q:32, a:3, exp:'netstat의 -t 옵션은 TCP 연결만 표시하는 옵션이다. 연결 이후 시간을 표시하는 옵션이 아니다.', wrong:[
    {num:1,reason:'-r 옵션은 라우팅 테이블을 표시하는 것이 맞다.'},
    {num:2,reason:'-p 옵션은 PID와 프로그램명을 출력하는 것이 맞다.'},
    {num:4,reason:'-y 옵션은 모든 연결의 TCP 연결 템플릿을 표시하는 것이 맞다.'}
  ]},
  { q:33, a:4, exp:'chmod go=w file은 그룹과 기타 사용자의 권한을 쓰기만으로 설정(기존 권한 무시)한다. 다른 3개는 쓰기 권한을 추가하여 기존 권한을 유지한다.', wrong:[
    {num:1,reason:'chmod 666은 모든 사용자에게 rw 권한을 부여하여 쓰기가 가능해진다.'},
    {num:2,reason:'chmod a+w는 모든 사용자에게 쓰기 권한을 추가한다.'},
    {num:3,reason:'chmod ugo+w는 모든 사용자에게 쓰기 권한을 추가한다.'}
  ]},
  { q:34, a:4, exp:'crontab -r은 현재 사용자의 crontab 내용을 모두 삭제(remove)하는 명령어이다.', wrong:[
    {num:1,reason:'-u는 특정 사용자의 crontab을 지정하는 옵션이다.'},
    {num:2,reason:'-e는 crontab을 편집(edit)하는 옵션이다.'},
    {num:3,reason:'-l은 crontab 내용을 조회(list)하는 옵션이다.'}
  ]},
  { q:35, a:3, exp:'/var 디렉터리는 시스템 운영 중 변동되는 파일(로그, 메일, 스풀 등)이 저장되는 디렉터리이다.', wrong:[
    {num:1,reason:'/home은 일반 사용자들의 홈 디렉터리이다.'},
    {num:2,reason:'/usr는 사용자 프로그램과 라이브러리가 설치되는 디렉터리이다.'},
    {num:4,reason:'/tmp는 임시 파일이 저장되는 디렉터리이다.'}
  ]},
  { q:36, a:2, exp:'free 명령어는 시스템의 물리 메모리, 스왑 메모리, 공유 메모리의 사용량과 사용 가능 용량을 표시한다.', wrong:[
    {num:1,reason:'mem은 Linux에서 일반적으로 사용되지 않는 명령어이다.'},
    {num:3,reason:'du는 디스크 사용량을 확인하는 명령어이다.'},
    {num:4,reason:'cat은 파일 내용을 출력하는 명령어이다.'}
  ]},
  { q:37, a:1, exp:'Shell은 사용자의 명령을 해석하여 커널에 전달하는 명령어 해석기(Command Interpreter)이다.', wrong:[
    {num:2,reason:'Kernel은 운영체제의 핵심으로 하드웨어를 직접 관리한다.'},
    {num:3,reason:'Utility Program은 시스템 관리를 위한 유틸리티 프로그램이다.'},
    {num:4,reason:'Hierarchical File System은 계층적 파일 시스템 구조를 의미한다.'}
  ]},
  { q:38, a:4, exp:'TTL 값이 길면 캐시된 데이터가 오래 유지되어 DNS 질의 횟수가 줄어들므로 DNS 부하가 감소한다. 부하가 늘어난다는 설명은 틀렸다.', wrong:[
    {num:1,reason:'Zone 파일은 항상 SOA 레코드로 시작하는 것이 맞다.'},
    {num:2,reason:'SOA 레코드에 네임서버 유지를 위한 기본 자료가 저장되는 것이 맞다.'},
    {num:3,reason:'Refresh는 주 서버와 보조 서버의 동기 주기를 설정하는 것이 맞다.'}
  ]},
  { q:39, a:2, exp:'역방향 조회(Reverse Lookup)는 클라이언트가 IP 주소를 제공하면 해당하는 도메인 이름을 반환하는 DNS 조회 방식이다.', wrong:[
    {num:1,reason:'도메인을 제공하면 IP를 반환하는 것은 정방향 조회(Forward Lookup)이다.'},
    {num:3,reason:'라운드 로빈 방식으로 IP를 반환하는 것은 부하분산 기능이다.'},
    {num:4,reason:'하위 도메인을 반환하는 조회 방식은 존재하지 않는다.'}
  ]},
  { q:40, a:3, exp:'KeepAliveTimeout은 Apache에서 연결 유지 시간을 설정하는 옵션으로, 지정된 시간 동안 요청이 없으면 세션을 종료한다.', wrong:[
    {num:1,reason:'Exec-timeout은 Cisco 장비의 세션 타임아웃 명령어이다.'},
    {num:2,reason:'Listen은 Apache가 수신할 포트 번호를 지정하는 옵션이다.'},
    {num:4,reason:'NameVirtualHost는 이름 기반 가상 호스트를 설정하는 옵션이다.'}
  ]},
  { q:41, a:4, exp:'find 명령어의 -exec 옵션은 찾은 파일에 대해 삭제 등 추가적인 명령을 실행할 수 있게 해준다.', wrong:[
    {num:1,reason:'-name은 파일/디렉터리 이름을 기준으로 검색하며 사용자 이름이 아니다.'},
    {num:2,reason:'-type은 파일 유형(f:파일, d:디렉터리 등)을 기준으로 검색한다.'},
    {num:3,reason:'-perm은 소유자뿐 아니라 모든 권한 비트를 고려하여 검색한다.'}
  ]},
  { q:42, a:4, exp:'응용 프로그램 로그는 이벤트 뷰어의 Windows 로그 항목에 해당한다. Windows 로그에는 응용 프로그램, 보안, 설치, 시스템, 전달된 이벤트가 포함된다.', wrong:[
    {num:1,reason:'하드웨어 이벤트는 Windows 로그가 아닌 응용 프로그램 및 서비스 로그에 속한다.'},
    {num:2,reason:'인터넷 익스플로러는 응용 프로그램 및 서비스 로그에 속한다.'},
    {num:3,reason:'윈도우즈 파워셸은 응용 프로그램 및 서비스 로그에 속한다.'}
  ]},
  { q:43, a:1, exp:'SWAP 파티션은 물리 메모리(RAM)가 부족할 때 디스크를 가상 메모리로 사용하는 논리적 메모리 저장공간이다.', wrong:[
    {num:2,reason:'FAT32는 Windows의 파일 시스템으로 가상 메모리와 무관하다.'},
    {num:3,reason:'RAID는 여러 디스크를 묶어 사용하는 기술이다.'},
    {num:4,reason:'LVM은 논리 볼륨 관리로 디스크 파티션을 유연하게 관리하는 기술이다.'}
  ]},
  { q:44, a:4, exp:'certmgr.msc는 인증서 관리자(Certificate Manager)를 호출하는 명령어로, 인증서의 가져오기, 내보내기, 삭제 등을 관리할 수 있다.', wrong:[
    {num:1,reason:'eventvwr.msc는 이벤트 뷰어를 호출하는 명령어이다.'},
    {num:2,reason:'compmgmt.msc는 컴퓨터 관리를 호출하는 명령어이다.'},
    {num:3,reason:'secpol.msc는 로컬 보안 정책을 호출하는 명령어이다.'}
  ]},
  { q:45, a:2, exp:'DirectAccess는 원격 클라이언트가 VPN 없이 인터넷을 통해 회사 내부 네트워크에 자동으로 안전하게 접속할 수 있는 기술이다.', wrong:[
    {num:1,reason:'Multihoming은 여러 네트워크 인터페이스를 가지는 것이다.'},
    {num:3,reason:'VPN은 터널링으로 가상 사설망을 구성하는 기술이다.'},
    {num:4,reason:'Hyper-V는 가상화 플랫폼이다.'}
  ]},
  { q:46, a:1, exp:'L2(Layer 2) LAN 스위치는 데이터링크 계층에서 동작하며 이더넷 프레임의 MAC 주소를 사용하여 중계 처리한다.', wrong:[
    {num:2,reason:'IP 주소는 L3(네트워크 계층) 장비인 라우터가 사용한다.'},
    {num:3,reason:'Port 주소는 L4(전송 계층)에서 사용되는 개념이다.'},
    {num:4,reason:'URL 주소는 응용 계층에서 사용되는 개념이다.'}
  ]},
  { q:47, a:1, exp:'게이트웨이는 전혀 다른 프로토콜을 사용하는 네트워크 간의 인터페이스 역할을 하여 프로토콜 변환을 수행한다.', wrong:[
    {num:2,reason:'네트워크 케이블 집선 장치는 허브(Hub)이다.'},
    {num:3,reason:'케이블 중계점에서 신호를 증폭하는 것은 리피터(Repeater)이다.'},
    {num:4,reason:'물리 주소 캐시 테이블을 가지는 것은 스위치(Switch)이다.'}
  ]},
  { q:48, a:4, exp:'RAID 0은 미러링이 없는 스트라이핑 방식이므로, 디스크 중 하나가 손상되면 데이터 복구가 불가능하다.', wrong:[
    {num:1,reason:'RAID 0은 최소 2개의 디스크에 데이터를 분산 저장하는 것이 맞다.'},
    {num:2,reason:'데이터를 분산 저장하여 처리속도가 향상되는 것이 맞다.'},
    {num:3,reason:'RAID 0은 스트라이핑(Striping)이라고 부르는 것이 맞다.'}
  ]},
  { q:49, a:4, exp:'방화벽은 암호화/복호화 기능을 제공하지 않는다. 데이터 암호화는 VPN이나 SSL/TLS 등이 담당한다.', wrong:[
    {num:1,reason:'접근 규칙에 따라 허용 또는 차단을 수행하는 것은 방화벽의 주요 기능이다.'},
    {num:2,reason:'허용/차단 접근에 대한 기록(로깅)을 유지하는 것은 방화벽의 기능이다.'},
    {num:3,reason:'다양한 인증을 수행하는 것은 방화벽의 기능이다.'}
  ]},
  { q:50, a:2, exp:'VLAN(Virtual Local Area Network)은 하나의 물리적 스위치를 논리적으로 여러 네트워크로 분리하며, 부서 간 통신은 L3 장비를 통해서만 가능하다.', wrong:[
    {num:1,reason:'VPN은 공중망을 통한 사설 네트워크 연결 기술로 내부 분리와 다르다.'},
    {num:3,reason:'VCN은 가상 클라우드 네트워크로 물리적 스위치 분할과 다르다.'},
    {num:4,reason:'IPS는 침입 방지 시스템으로 네트워크 분리 기술이 아니다.'}
  ]}
];

// ===== exam 151: 2023년 정기 4회 =====
const exam151 = [
  { q:1, a:2, exp:'서브넷 마스크 255.255.255.240(/28)에서 호스트 비트는 4비트이다. 사용 가능한 호스트 수는 2^4 - 2 = 14개이다(네트워크 주소와 브로드캐스트 주소 제외).', wrong:[
    {num:1,reason:'10개는 올바른 계산 결과가 아니다.'},
    {num:3,reason:'26개는 /27 서브넷(호스트 비트 5개)에서의 값이다.'},
    {num:4,reason:'32개는 호스트 비트 5개일 때 제외 없이 계산한 값이다.'}
  ]},
  { q:2, a:4, exp:'Hop Limit은 IPv6 헤더에서 데이터그램이 네트워크에서 거칠 수 있는 최대 라우터 수를 제한하며, IPv4의 TTL에 해당한다.', wrong:[
    {num:1,reason:'Version 필드는 IP 프로토콜 버전(6)을 나타낸다.'},
    {num:2,reason:'Priority(Traffic Class)는 트래픽 우선순위를 나타낸다.'},
    {num:3,reason:'Next Header는 다음 확장 헤더나 상위 계층 프로토콜을 지정한다.'}
  ]},
  { q:3, a:2, exp:'TCP는 연결 지향형 프로토콜로 신뢰성을 중시하여 오버헤드가 크므로 실시간 통신(화상통신)에는 적합하지 않다. 실시간 통신에는 UDP가 사용된다.', wrong:[
    {num:1,reason:'TCP는 동적 슬라이딩 윈도우 방식으로 흐름 제어를 하는 것이 맞다.'},
    {num:3,reason:'TCP는 에러 제어를 통해 신뢰성 있는 데이터 전송을 보장한다.'},
    {num:4,reason:'TCP는 3-Way Handshake로 연결을 설정하는 것이 맞다.'}
  ]},
  { q:4, a:2, exp:'Destination Port는 수신측 응용 프로세스의 포트 번호를 나타내는 필수 필드이다. 선택적 필드가 아니며, 선택적 필드는 Checksum이다.', wrong:[
    {num:1,reason:'Source Port는 송신측 응용 프로세스 포트 번호로 올바른 설명이다.'},
    {num:3,reason:'Checksum은 오류 검사를 위한 필드로 올바른 설명이다.'},
    {num:4,reason:'Length는 UDP 헤더와 데이터를 포함한 길이로 올바른 설명이다.'}
  ]},
  { q:5, a:3, exp:'HTTP의 Well-Known Port는 80번이다. 180번은 올바르지 않다.', wrong:[
    {num:1,reason:'FTP의 포트 번호 21번은 맞다.'},
    {num:2,reason:'Telnet의 포트 번호 23번은 맞다.'},
    {num:4,reason:'SMTP의 포트 번호 25번은 맞다.'}
  ]},
  { q:6, a:4, exp:'NAT(Network Address Translation)는 사설 IP를 공인 IP로 변환하여 공인 IP 절약과 내부 네트워크 보안 강화를 제공한다.', wrong:[
    {num:1,reason:'DHCP는 IP 주소를 동적으로 할당하는 프로토콜로 주소 변환과 다르다.'},
    {num:2,reason:'ARP는 IP를 MAC으로 변환하는 프로토콜이다.'},
    {num:3,reason:'BOOTP는 부팅 시 IP 할당용 프로토콜이다.'}
  ]},
  { q:7, a:1, exp:'ARP(Address Resolution Protocol)는 이더넷의 브로드캐스트 기능을 사용하여 목적지 IP 주소에 대응하는 MAC 주소를 알아내는 프로토콜이다.', wrong:[
    {num:2,reason:'RARP는 MAC 주소로 IP 주소를 알아내는 반대 방향의 프로토콜이다.'},
    {num:3,reason:'DNS는 도메인 이름을 IP 주소로 변환하는 프로토콜이다.'},
    {num:4,reason:'DHCP는 IP 주소를 자동 할당하는 프로토콜이다.'}
  ]},
  { q:8, a:1, exp:'SNMP는 UDP(161/162번 포트)를 사용하며 TCP를 이용하지 않는다. UDP 기반이므로 신뢰성 있는 통신을 보장하지 않는다.', wrong:[
    {num:2,reason:'SNMP는 네트워크 관리를 위한 표준 프로토콜이 맞다.'},
    {num:3,reason:'SNMP는 응용 계층 프로토콜이 맞다.'},
    {num:4,reason:'SNMP는 RFC 1157에 규정되어 있는 것이 맞다.'}
  ]},
  { q:9, a:2, exp:'2000:AB:1::1:2를 풀어쓰면 2000:00AB:0001:0000:0000:0000:0001:0002이다. ::은 연속된 0 그룹을 축약한 것이다.', wrong:[
    {num:1,reason:'6개 그룹으로 되어 있어 IPv6 주소 형식(8그룹)에 맞지 않다.'},
    {num:3,reason:'AB00이 아닌 00AB이 올바른 확장이다.'},
    {num:4,reason:'AB00, 1000, 2000 등의 확장이 잘못되었다.'}
  ]},
  { q:10, a:2, exp:'tracert는 Windows에서 목적지까지의 경로를 추적하며, 각 홉의 지연 시간을 확인하여 네트워크 지연 구간을 파악할 수 있는 명령어이다.', wrong:[
    {num:1,reason:'nslookup은 DNS 질의를 수행하는 명령어로 경로 추적과 무관하다.'},
    {num:3,reason:'ping은 호스트 연결 상태만 확인하며 경로를 추적하지 않는다.'},
    {num:4,reason:'traceroute는 Linux/Unix의 명령어이며 Windows에서는 tracert를 사용한다.'}
  ]},
  { q:11, a:2, exp:'서브넷 마스크 255.255.255.224(/27)에서 네트워크 주소 210.212.100.0의 첫 번째 서브넷 브로드캐스트 주소는 210.212.100.31이다(0~31 범위).', wrong:[
    {num:1,reason:'210.212.100.30은 첫 번째 서브넷의 마지막 사용 가능 호스트 주소이다.'},
    {num:3,reason:'210.212.100.32는 두 번째 서브넷의 네트워크 주소이다.'},
    {num:4,reason:'210.212.103.64는 해당 서브넷 범위에 포함되지 않는다.'}
  ]},
  { q:12, a:4, exp:'127.x.x.x 주소(127.0.0.0 ~ 127.255.255.255)는 루프백(Loopback) 주소로, 자기 자신에게 데이터를 보내 네트워크 인터페이스를 테스트하는 데 사용된다.', wrong:[
    {num:1,reason:'제한적 브로드캐스트 주소는 255.255.255.255이다.'},
    {num:2,reason:'멀티캐스트 주소는 D Class(224~239)이며 B Class가 아니다.'},
    {num:3,reason:'C Class 사설 IP는 192.168.x.x 대역이다.'}
  ]},
  { q:13, a:3, exp:'ICMP는 네트워크 장비들 간에 오류 상황을 공유할 수 있는 기능을 제공하여 네트워크 문제를 보고하고 진단하는 프로토콜이다.', wrong:[
    {num:1,reason:'ICMP가 바로 이벤트 보고를 지원하는 프로토콜이므로 이 설명은 틀렸다.'},
    {num:2,reason:'ICMP는 대칭 프로토콜이며 자체적으로 TTL을 제공하지 않는다.'},
    {num:4,reason:'물리적 주소를 제공하는 것은 ARP 프로토콜이다.'}
  ]},
  { q:14, a:3, exp:'오프셋(Fragment Offset)은 IP 단편화 시 분할된 각 데이터 조각이 원본 데이터에서의 위치를 나타내어 재조립 시 순서를 결정한다.', wrong:[
    {num:1,reason:'DF Flag는 단편화 금지 여부를 설정하는 플래그이다.'},
    {num:2,reason:'서비스 타입은 패킷의 우선순위와 서비스 품질을 지정하는 필드이다.'},
    {num:4,reason:'TTL은 패킷의 생존 시간(최대 홉 수)을 제한하는 필드이다.'}
  ]},
  { q:15, a:3, exp:'L3 스위치는 네트워크 계층(3계층)에서 동작하여 IP 주소 기반 라우팅을 수행하는 스위치이다.', wrong:[
    {num:1,reason:'L1 스위치는 물리 계층 장치로 신호 재생/분배만 한다.'},
    {num:2,reason:'L2 스위치는 MAC 주소 기반으로 프레임을 전달한다.'},
    {num:4,reason:'L4 스위치는 전송 계층에서 포트 번호 기반으로 로드밸런싱을 한다.'}
  ]},
  { q:16, a:3, exp:'Ethernet V2 프레임에서 대부분의 IP 패킷은 MTU 1500 바이트를 가진다. 이는 가장 일반적인 이더넷 환경의 MTU 값이다.', wrong:[
    {num:1,reason:'IPv4의 최소 MTU는 68바이트이며 1280바이트는 IPv6이다.'},
    {num:2,reason:'IPv6의 최소 MTU는 1280바이트이며 68바이트는 IPv4이다.'},
    {num:4,reason:'MTU 크기는 네트워크 환경에 따라 변경 가능하며 항상 1500이 아니다.'}
  ]},
  { q:17, a:1, exp:'멀티캐스트는 하나의 호스트가 네트워크 내의 특정 호스트 그룹으로 메시지를 보내는 통신 방식이다.', wrong:[
    {num:2,reason:'모든 호스트에게 보내는 것은 브로드캐스트이다.'},
    {num:3,reason:'하나의 호스트로 보내는 것은 유니캐스트이다.'},
    {num:4,reason:'자기 자신에게 보내는 것은 루프백이다.'}
  ]},
  { q:18, a:3, exp:'VPN(Virtual Private Network)은 공중 네트워크를 통해 안전한 사설 네트워크를 구성하는 기술이다.', wrong:[
    {num:1,reason:'VLAN은 물리적 LAN을 논리적으로 분리하는 기술이다.'},
    {num:2,reason:'NAT는 사설 IP와 공인 IP 간 주소 변환 기술이다.'},
    {num:4,reason:'Public Network는 공중 네트워크로 VPN과 반대 개념이다.'}
  ]},
  { q:19, a:3, exp:'흐름 제어(Flow Control)는 수신측에서 송신측으로부터 오는 데이터의 양이나 속도를 제한하여 수신 버퍼 오버플로를 방지하는 기능이다.', wrong:[
    {num:1,reason:'에러 제어는 전송 중 발생한 오류를 검출하고 정정하는 기능이다.'},
    {num:2,reason:'순서 제어는 데이터의 순서를 보장하는 기능이다.'},
    {num:4,reason:'접속 제어는 연결의 설정과 해제를 관리하는 기능이다.'}
  ]},
  { q:20, a:3, exp:'IEEE 802.11은 무선 LAN(Wireless LAN) 표준으로 올바른 연결이다.', wrong:[
    {num:1,reason:'IEEE 802.3이 CSMA/CD이며, 802.3은 토큰 버스가 아니다.'},
    {num:2,reason:'IEEE 802.5가 토큰 링이며, 802.4는 토큰 버스이다.'},
    {num:4,reason:'IEEE 802.5는 토큰 링이며 CSMA/CD는 802.3이다.'}
  ]},
  { q:21, a:2, exp:'세션 계층(5계층)은 대화 제어, 연결 설정/종료, 동기화 기능을 수행한다. 에러 제어는 데이터 링크 계층(2계층)이나 전송 계층(4계층)의 기능이다.', wrong:[
    {num:1,reason:'대화 제어는 세션 계층의 올바른 기능이다.'},
    {num:3,reason:'연결 설정 종료는 세션 계층의 올바른 기능이다.'},
    {num:4,reason:'동기화는 세션 계층의 올바른 기능이다.'}
  ]},
  { q:22, a:3, exp:'WPA2(IEEE 802.11i)는 AES 암호화를 사용하여 무선 LAN 보안을 제공하는 가장 강력한 보안 방법이다.', wrong:[
    {num:1,reason:'WEP는 취약한 RC4 암호화를 사용하여 쉽게 해킹될 수 있다.'},
    {num:2,reason:'WPA는 TKIP 암호화를 사용하며 WPA2보다 보안이 약하다.'},
    {num:4,reason:'MAC 주소 필터링은 MAC 위조에 취약한 보안 방법이다.'}
  ]},
  { q:23, a:1, exp:'단일모드(Single-mode)는 광섬유 접속이 어렵고 장거리 전송에 유리하다. 단거리가 아닌 장거리 전송에 유리하며, 다중모드가 단거리에 유리하다.', wrong:[
    {num:2,reason:'광 케이블은 전반사 효과를 이용하며 과도한 구부림 시 성능이 저하된다.'},
    {num:3,reason:'광 케이블은 단방향이므로 양방향 통신에 2회선 이상이 필요하다.'},
    {num:4,reason:'광신호 기반이므로 전자기장 잡음에 영향을 받지 않는다.'}
  ]},
  { q:24, a:2, exp:'HLR(Home Location Register, 홈 위치 등록기)은 이동 통신에서 가입자의 위치 정보와 서비스 프로파일을 영구적으로 관리하는 데이터베이스이다.', wrong:[
    {num:1,reason:'BSC(기지국 제어기)는 여러 기지국을 제어하는 장비이다.'},
    {num:3,reason:'VLR(방문자 위치 등록기)은 임시로 방문자 정보를 관리한다.'},
    {num:4,reason:'OMC(운용 보존국)는 네트워크 운용 및 보수를 담당하는 기관이다.'}
  ]},
  { q:25, a:4, exp:'클라우드는 인터넷을 통해 컴퓨팅 자원(서버, 스토리지, 네트워크 등)을 제공하는 서비스 모델이다.', wrong:[
    {num:1,reason:'위키는 협업 기반 웹 콘텐츠 편집 시스템이다.'},
    {num:2,reason:'블로그는 개인 웹 일지 형태의 콘텐츠 플랫폼이다.'},
    {num:3,reason:'플랫폼은 서비스가 실행되는 기반 환경을 의미한다.'}
  ]},
  { q:26, a:3, exp:'WPAN의 표준은 IEEE 802.15 계열로, 802.15.1(Bluetooth), 802.15.3(UWB), 802.15.4(ZigBee)이다.', wrong:[
    {num:1,reason:'802.11.x는 무선 LAN(WLAN) 관련 표준이다.'},
    {num:2,reason:'802.11a/b/c는 WLAN 규격이며 WPAN과 무관하다.'},
    {num:4,reason:'802.16.x는 WiMAX(무선 MAN) 관련 표준이다.'}
  ]},
  { q:27, a:3, exp:'DAS(Direct-Attached Storage)는 서버에 직접 연결되는 스토리지 방식으로, 네트워크를 경유하지 않고 직접 접속한다.', wrong:[
    {num:1,reason:'NAS는 네트워크를 통해 접속하는 스토리지이다.'},
    {num:2,reason:'SCSI는 컴퓨터와 주변기기를 연결하는 인터페이스 표준이다.'},
    {num:4,reason:'RAID는 여러 디스크를 묶어 사용하는 기술이다.'}
  ]},
  { q:28, a:3, exp:'shutdown -r +5는 5분 후 시스템을 재부팅(-r)하며, 메시지를 접속 사용자에게 전달할 수 있다.', wrong:[
    {num:1,reason:'shutdown -r now는 즉시 재부팅하므로 5분 후 재부팅이 아니다.'},
    {num:2,reason:'-r 옵션이 없으므로 재부팅이 아닌 종료 명령이며 시간 지정도 없다.'},
    {num:4,reason:'-r 옵션이 없으므로 재부팅이 아닌 종료 명령이다.'}
  ]},
  { q:29, a:3, exp:'GRUB(GRand Unified Bootloader)는 Linux의 대표적인 부트 로더로, 다른 운영체제와의 멀티부팅을 지원한다.', wrong:[
    {num:1,reason:'CMOS는 BIOS 설정을 저장하는 하드웨어이다.'},
    {num:2,reason:'BASH는 Linux의 기본 셸(Shell)이다.'},
    {num:4,reason:'ROOT는 Linux의 최상위 관리자 계정이다.'}
  ]},
  { q:30, a:2, exp:'Hyper-V는 서버 가용성을 높여준다. 줄어든다는 설명은 틀렸다. 가상화를 통해 자원 활용과 가용성이 향상된다.', wrong:[
    {num:1,reason:'Hyper-V는 하드웨어 사용율을 높여주는 것이 맞다.'},
    {num:3,reason:'Hyper-V는 유지비용을 줄일 수 있는 것이 맞다.'},
    {num:4,reason:'Hyper-V는 개발 및 테스트의 효율성을 향상시키는 것이 맞다.'}
  ]},
  { q:31, a:4, exp:'파일 권한 -rwxr-x--x에서 그룹 권한은 r-x(읽기+실행)이다. 실행 권한만 갖는다는 설명은 틀렸다.', wrong:[
    {num:1,reason:'소유자 rwx는 읽기, 쓰기, 실행 권한을 모두 갖는 것이 맞다.'},
    {num:2,reason:'기타 사용자 --x는 실행 권한만 갖는 것이 맞다.'},
    {num:3,reason:'rwx(7) r-x(5) --x(1) = 751로 올바르다.'}
  ]},
  { q:32, a:1, exp:'BitLocker는 Windows의 전체 드라이브 암호화 기능으로, 도난 시에도 강력한 암호화로 데이터를 보호한다.', wrong:[
    {num:2,reason:'NTLM은 Windows 네트워크 인증 프로토콜이다.'},
    {num:3,reason:'Encryption은 암호화의 일반적 용어이지 특정 Windows 기능이 아니다.'},
    {num:4,reason:'vTPM은 가상 TPM으로 가상 머신의 보안 모듈이다.'}
  ]},
  { q:33, a:1, exp:'httpd.conf는 Apache 웹서버의 기본 설정 파일로, 디렉터리 리스팅 방지, 보안 설정 등 대부분의 설정을 관리한다.', wrong:[
    {num:2,reason:'httpd-default.conf는 기본값 설정 보조 파일이다.'},
    {num:3,reason:'httpd-vhosts.conf는 가상 호스트 설정 파일이다.'},
    {num:4,reason:'httpd-mpm.conf는 다중 처리 모듈(MPM) 설정 파일이다.'}
  ]},
  { q:34, a:3, exp:'pathping은 tracert와 ping의 기능을 결합하여 각 홉의 패킷 손실률과 지연 시간에 관한 상세 정보를 출력하는 명령어이다.', wrong:[
    {num:1,reason:'ping은 단순 연결 상태 확인만 하며 경로 정보를 제공하지 않는다.'},
    {num:2,reason:'nslookup은 DNS 질의를 수행하는 명령어이다.'},
    {num:4,reason:'nbtstat은 NetBIOS over TCP/IP 통계를 표시하는 명령어이다.'}
  ]},
  { q:35, a:2, exp:':10,20s/old/new/g는 10~20행에서 old를 new로 모두(g: global) 치환하는 VI 편집기 명령이다.', wrong:[
    {num:1,reason:'/g가 없으면 각 행의 첫 번째 매칭만 치환되어 모두 치환되지 않는다.'},
    {num:3,reason:':r은 파일 읽기 명령으로 치환 명령이 아니다.'},
    {num:4,reason:':r은 치환이 아닌 읽기 명령이며 /a 옵션도 존재하지 않는다.'}
  ]},
  { q:36, a:1, exp:'/etc 디렉터리에 passwd, shadow 등 사용자 암호 정보 파일이 저장되어 있다.', wrong:[
    {num:2,reason:'/sbin은 시스템 관리용 실행 파일이 저장되는 디렉터리이다.'},
    {num:3,reason:'/home은 일반 사용자들의 홈 디렉터리이다.'},
    {num:4,reason:'/lib는 시스템 라이브러리 파일이 저장되는 디렉터리이다.'}
  ]},
  { q:37, a:2, exp:'netstat -r은 라우팅 테이블을 표시하는 명령 옵션이다.', wrong:[
    {num:1,reason:'netstat -a는 모든 연결과 수신 대기 포트를 표시한다.'},
    {num:3,reason:'netstat -n은 주소와 포트를 숫자 형식으로 표시한다.'},
    {num:4,reason:'netstat -s는 프로토콜별 통계를 표시한다.'}
  ]},
  { q:38, a:2, exp:'top 명령어는 실시간으로 시스템의 프로세스 상태, CPU 사용량, 메모리 사용량 등을 모니터링할 수 있는 명령어이다.', wrong:[
    {num:1,reason:'ps는 현재 시점의 프로세스 목록을 스냅숏으로 보여주며 실시간이 아니다.'},
    {num:3,reason:'kill은 프로세스를 종료하는 명령어이다.'},
    {num:4,reason:'nice는 프로세스의 우선순위를 변경하는 명령어이다.'}
  ]},
  { q:39, a:1, exp:'이벤트 뷰어 보안 로그의 이벤트 수준에는 경고, 오류, 정보가 포함되지만 "중요"는 시스템 로그의 이벤트 수준이며 보안 로그에서는 사용되지 않는다.', wrong:[
    {num:2,reason:'경고는 보안 로그 필터링에 사용할 수 있는 이벤트 수준이다.'},
    {num:3,reason:'오류는 보안 로그 필터링에 사용할 수 있는 이벤트 수준이다.'},
    {num:4,reason:'정보는 보안 로그 필터링에 사용할 수 있는 이벤트 수준이다.'}
  ]},
  { q:40, a:4, exp:'allow-query는 클라이언트에 대한 도메인 이름 요청(DNS 질의)의 허용 여부를 설정하는 BIND 옵션이다.', wrong:[
    {num:1,reason:'listen-on은 네임 서버가 수신할 IP와 포트를 설정하지만, 접속 허용과는 다른 개념이다.'},
    {num:2,reason:'directory는 zone 파일이 위치하는 경로를 설정하며 환경설정 파일 경로가 아니다.'},
    {num:3,reason:'dump-file은 캐시 덤프 파일을 설정하며 오류 정보 출력용이 아니다.'}
  ]},
  { q:41, a:3, exp:'sconfig는 Windows Server Core와 Hyper-V Server에서 제공하는 서버 구성 도구로, 숫자 메뉴 기반의 간단한 인터페이스를 제공한다.', wrong:[
    {num:1,reason:'ipconfig는 네트워크 구성 정보를 확인하는 명령어이다.'},
    {num:2,reason:'ifconfig는 Linux/Unix의 네트워크 인터페이스 설정 명령어이다.'},
    {num:4,reason:'msconfig는 시스템 구성 유틸리티(GUI)로 서버 코어에서 사용할 수 없다.'}
  ]},
  { q:42, a:4, exp:'Users 그룹은 사용자 계정의 기본 그룹이지만 시스템 수준의 변경 권한은 갖지 않는다. 제한된 권한만 가진다.', wrong:[
    {num:1,reason:'Administrators 그룹은 모든 권한을 가지며 일반 사용자 추가 시 동일 권한을 갖는다.'},
    {num:2,reason:'Backup Operators는 백업/복구 권한을 가진다.'},
    {num:3,reason:'Guests 그룹은 임시 프로필을 사용하고 로그아웃 시 삭제되는 것이 맞다.'}
  ]},
  { q:43, a:4, exp:':q는 변경사항이 있을 때 저장하지 않으면 종료가 되지 않고 경고 메시지를 출력한다. :q!로 강제 종료해야 한다.', wrong:[
    {num:1,reason:':wq는 저장 후 종료하므로 정상적으로 종료된다.'},
    {num:2,reason:':wq!는 강제 저장 후 종료하므로 정상적으로 종료된다.'},
    {num:3,reason:':q!는 저장하지 않고 강제 종료하므로 정상적으로 종료된다.'}
  ]},
  { q:44, a:2, exp:'crontab 형식은 "분 시 일 월 요일"이다. 매주 월요일(1) 오전 10시는 "0 10 * * 1"이다.', wrong:[
    {num:1,reason:'"10 0 * * 1"은 월요일 0시 10분이다.'},
    {num:3,reason:'"10 0 * * 0"은 일요일 0시 10분이다.'},
    {num:4,reason:'"0 10 * * 0"은 일요일 10시이다.'}
  ]},
  { q:45, a:2, exp:'ipconfig /all은 Windows에서 Host Name, IP 주소, 서브넷 마스크, DNS Server, 기본 게이트웨이 등 모든 네트워크 설정을 표시한다.', wrong:[
    {num:1,reason:'arp -a는 ARP 캐시 테이블만 표시한다.'},
    {num:3,reason:'convert는 파일 시스템 변환 명령어이다.'},
    {num:4,reason:'netstat는 네트워크 연결 상태를 표시하는 명령어이다.'}
  ]},
  { q:46, a:2, exp:'MAC Address는 48비트(6바이트)의 번호체계로, 상위 24비트는 OUI(제조사 코드), 하위 24비트는 제조사가 할당하는 고유 번호이다.', wrong:[
    {num:1,reason:'32비트는 IPv4 주소의 길이이다.'},
    {num:3,reason:'64비트는 일반적인 주소 체계로 사용되지 않는다.'},
    {num:4,reason:'128비트는 IPv6 주소의 길이이다.'}
  ]},
  { q:47, a:2, exp:'RAID 1은 미러링(Mirroring) 방식으로 한 드라이브의 데이터를 다른 드라이브에 동일하게 복사하여 복구 능력을 제공한다.', wrong:[
    {num:1,reason:'RAID 0은 스트라이핑 방식으로 복구 능력이 없다.'},
    {num:3,reason:'RAID 3는 바이트 단위 스트라이핑과 전용 패리티 디스크를 사용한다.'},
    {num:4,reason:'RAID 4는 블록 단위 스트라이핑과 전용 패리티 디스크를 사용한다.'}
  ]},
  { q:48, a:3, exp:'MPLS(Multiprotocol Label Switching)는 짧고 고정된 길이의 라벨을 이용하여 L2 스위칭 속도로 패킷을 전달하는 기술이다.', wrong:[
    {num:1,reason:'VPN은 가상 사설 네트워크로 라벨 스위칭 기술이 아니다.'},
    {num:2,reason:'MSPP는 다중 서비스 제공 플랫폼으로 전송 장비이다.'},
    {num:4,reason:'ROUTER는 IP 주소 기반 라우팅 장비로 라벨 기반이 아니다.'}
  ]},
  { q:49, a:4, exp:'NAC(Network Access Control)는 IP 관리 시스템에서 발전하여 네트워크 접근을 통제하고 보안 정책을 적용하는 솔루션이다.', wrong:[
    {num:1,reason:'F/W(Firewall)는 네트워크 트래픽 필터링 보안 장치이다.'},
    {num:2,reason:'IDS는 침입을 탐지하여 알리는 시스템이다.'},
    {num:3,reason:'IPS는 침입을 탐지하고 차단하는 시스템이다.'}
  ]},
  { q:50, a:2, exp:'show running-config는 RAM에 저장된 현재 실행 중인 설정을 확인하는 명령어이다.', wrong:[
    {num:1,reason:'ROM은 라우터의 부트 코드와 POST가 저장되는 읽기 전용 메모리이다.'},
    {num:3,reason:'NVRAM은 startup-config가 저장되는 비휘발성 메모리이다.'},
    {num:4,reason:'FLASH는 IOS 이미지가 저장되는 메모리이다.'}
  ]}
];

// ===== 메인 실행 =====
async function main() {
  const allExams = [
    { examId: 148, name: '2023년 정기 1회', data: exam148 },
    { examId: 149, name: '2023년 정기 2회', data: exam149 },
    { examId: 150, name: '2023년 정기 3회', data: exam150 },
    { examId: 151, name: '2023년 정기 4회', data: exam151 },
  ];

  let totalUpdated = 0;

  for (const exam of allExams) {
    console.log(`\n===== ${exam.name} (exam_id: ${exam.examId}) 처리 시작 =====`);

    // 문제 조회
    const res = await query(
      'SELECT id, question_number, body, choices FROM questions WHERE exam_id=$1 ORDER BY question_number',
      [exam.examId]
    );

    let examUpdated = 0;

    for (const row of res.rows) {
      const qData = exam.data.find(d => d.q === row.question_number);
      if (!qData) {
        console.log(`  [SKIP] Q${row.question_number} (id:${row.id}) - 정답 데이터 없음`);
        continue;
      }

      const choices = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
      const html = makeHtml(qData.a, choices, qData.exp, qData.wrong);

      await query(
        'UPDATE questions SET answer=$1, explanation=$2, updated_at=NOW() WHERE id=$3',
        [qData.a, html, row.id]
      );

      examUpdated++;
    }

    console.log(`  ${exam.name}: ${examUpdated}문제 업데이트 완료`);
    totalUpdated += examUpdated;
  }

  console.log(`\n총 ${totalUpdated}문제 완료`);
  await getPool().end();
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
