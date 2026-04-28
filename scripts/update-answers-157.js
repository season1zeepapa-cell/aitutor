// 네트워크관리사2급 2025년 2회 (exam_id: 157) 정답+해설 업데이트
require('dotenv').config();
const { query, getPool } = require('../api/db');

const answers = [
  // Q1: 헤더+트레일러 부가 = 캡슐화
  { qn: 1, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 캡슐화(Encapsulation)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>캡슐화(Encapsulation)는 송신측에서 사용자 데이터에 헤더와 트레일러를 부가하여 프로토콜 데이터 단위를 구성하는 과정입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 동기화 — 송수신 간 타이밍을 맞추는 기능</p><p>③ 다중화 — 하나의 회선에 여러 신호를 전송하는 기능</p><p>④ 주소지정 — 목적지를 식별하는 기능</p></div>` },

  // Q2: Class A 기본 서브넷 마스크 = 255.0.0.0 (254 아님)
  { qn: 2, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ Class A는 기본 서브넷 마스크로 '254.0.0.0'을 이용한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Class A의 기본 서브넷 마스크는 255.0.0.0입니다. 254.0.0.0은 잘못된 값입니다. 서브넷 마스크는 연속된 1비트와 0비트로 구성되어야 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — IP Address에서 Network ID와 Host ID 구분은 올바른 설명입니다.</p><p>② — 목적지가 동일 네트워크인지 확인하는 것은 올바른 설명입니다.</p><p>④ — Network ID는 1, Host ID는 0으로 채우는 것은 올바릅니다.</p></div>` },

  // Q3: IGMP는 멀티캐스트용 (유니캐스트 아님)
  { qn: 3, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 유니캐스트 통신을 위한 프로토콜로 적합하다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IGMP(Internet Group Management Protocol)는 멀티캐스트 그룹 관리를 위한 프로토콜입니다. 유니캐스트가 아닌 멀티캐스트 통신에 사용됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — TTL이 제공되는 것은 맞습니다.</p><p>③ — IGMPv1에서 첫 보고 메시지 손실 시 재전송되지 않는 것은 맞습니다.</p><p>④ — 호스트와 라우터 간 비대칭 통신 구조를 가집니다.</p></div>` },

  // Q4: 255.255.255.192 = 2비트 → 4개 서브넷
  { qn: 4, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 4</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>C Class에서 서브넷 마스크 255.255.255.192는 마지막 옥텟이 11000000(2비트)이므로 2²=4개의 서브넷을 만들 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 2 — 1비트(128)일 때의 서브넷 수</p><p>③ 192 — 서브넷 마스크 값이지 서브넷 수가 아님</p><p>④ 1024 — 잘못된 계산</p></div>` },

  // Q5: TFTP는 UDP 사용
  { qn: 5, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② TFTP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TFTP(Trivial File Transfer Protocol)는 UDP 포트 69를 사용하는 프로토콜입니다. FTP, Telnet, SMTP는 모두 TCP를 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① FTP — TCP 포트 20/21 사용</p><p>③ Telnet — TCP 포트 23 사용</p><p>④ SMTP — TCP 포트 25 사용</p></div>` },

  // Q6: ICMP Type 5 = Redirect (Echo Request는 Type 8)
  { qn: 6, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 5 - Echo Request</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ICMP Type 5는 Redirect 메시지이며, Echo Request는 Type 8입니다. Type 5를 Echo Request라고 한 것은 잘못된 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Type 0 = Echo Reply — 올바른 설명</p><p>③ Type 13 = Timestamp Request — 올바른 설명</p><p>④ Type 17 = Address Mask Request — 올바른 설명</p></div>` },

  // Q7: IPv6 - IETF 제정, 주소 부족 해결
  { qn: 7, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① IETF(Internet Engineering Task Force)에서 IP Address 부족에 대한 해결 방안으로 만들었다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IPv6는 IETF에서 IPv4 주소 부족 문제를 해결하기 위해 개발한 128비트 주소 체계입니다. 유니캐스트, 멀티캐스트, 애니캐스트 3가지 주소 유형을 지원하며 브로드캐스트는 없습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — IPv6가 IPv4보다 더 다양한 옵션 설정이 가능합니다.</p><p>③ — 유니캐스트, 멀티캐스트, 애니캐스트 3가지(브로드캐스트 아님)</p><p>④ — IPv6는 Broadcasting을 지원하지 않습니다.</p></div>` },

  // Q8: UDP 헤더에 Window 없음
  { qn: 8, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ Window</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Window(윈도우 크기)는 TCP 헤더에만 있는 필드로, 흐름 제어에 사용됩니다. UDP 헤더는 Source Port, Destination Port, Length, Checksum 4개 필드만 포함합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Source Port — UDP 헤더에 포함</p><p>② Destination Port — UDP 헤더에 포함</p><p>④ Checksum — UDP 헤더에 포함</p></div>` },

  // Q9: IP의 Fragmentation 기능
  { qn: 9, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ MTU(Maximum Transmission Unit) 값보다 큰 Datagram은 단편화(Fragmentation)를 수행한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IP 프로토콜은 비연결형, 비신뢰성 프로토콜로 MTU보다 큰 데이터그램에 대해 단편화(Fragmentation)를 수행합니다. 신뢰성, 재전송, 흐름 제어는 TCP의 기능입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 신뢰성 보장은 TCP의 기능</p><p>② — 손실 패킷 재전송은 TCP의 기능</p><p>③ — 흐름 제어는 TCP의 기능</p></div>` },

  // Q10: ARP Cache가 있으면 매번 요청하지 않음
  { qn: 10, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ ARP는 ARP 캐시를 사용하더라도, 서버와 통신할 때마다 매번 MAC 주소를 다시 요청해야 한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ARP 캐시의 핵심 목적은 이전에 해석한 IP-MAC 매핑을 저장하여 매번 브로드캐스트를 보내지 않도록 하는 것입니다. 캐시에 있으면 재요청하지 않습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 등록된 주소는 TTL 값을 가집니다.</p><p>② — 일정 시간 미사용 시 캐시에서 삭제됩니다.</p><p>③ — 재사용 시 TTL이 초기화되는 시스템도 있습니다.</p></div>` },

  // Q11: 제어/데이터 포트 분리 = FTP (20, 21)
  { qn: 11, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ FTP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>FTP는 제어용 포트(21)와 데이터 전송용 포트(20)를 분리하여 사용하는 유일한 프로토콜입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① DNS — 단일 포트(53) 사용</p><p>② SMTP — 단일 포트(25) 사용</p><p>③ TFTP — 단일 포트(69) 사용</p></div>` },

  // Q12: 128.52.10.6은 공인 IP (사설IP: 10.x, 172.16~31.x, 192.168.x)
  { qn: 12, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 128.52.10.6</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>사설 IP 대역은 10.0.0.0/8, 172.16.0.0~172.31.255.255, 192.168.0.0/16입니다. 128.52.10.6은 어느 사설 대역에도 속하지 않는 공인 IP입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 10.100.12.5 — 사설 IP(10.0.0.0/8)</p><p>③ 172.25.30.5 — 사설 IP(172.16~31.x.x)</p><p>④ 192.168.200.128 — 사설 IP(192.168.x.x)</p></div>` },

  // Q13: TCP/IP 구성 파라미터 확인은 ipconfig
  { qn: 13, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ TCP/IP 구성 파라미터를 확인할 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Ping은 ICMP를 이용한 네트워크 연결 테스트 도구이며, TCP/IP 구성 파라미터 확인은 ipconfig/ifconfig 명령어의 기능입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — Ping은 ICMP 메시지를 이용합니다.</p><p>② — Echo Request를 보내고 Echo Reply를 받습니다.</p><p>④ — TCP/IP 연결성을 테스트할 수 있습니다.</p></div>` },

  // Q14: SMTP=송신, POP3=수신
  { qn: 14, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① SMTP는 전송 프로토콜로 메일을 송신하는 데 사용되며, POP3는 수신 프로토콜로 메일을 수신하는 데 사용된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SMTP(Simple Mail Transfer Protocol)는 메일 송신용, POP3(Post Office Protocol 3)는 메일 수신용 프로토콜입니다. 각각 다른 역할을 수행합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — POP3는 메일을 로컬로 다운로드하며 실시간 동기화는 IMAP의 기능</p><p>③ — POP3도 전자 메일 시스템과 관련된 프로토콜</p><p>④ — 송수신이 동시에 처리되는 것이 아니라 각각 별도로 동작</p></div>` },

  // Q15: 표 기반 - OSPF (Link State, Dijkstra 알고리즘)
  { qn: 15, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① OSPF</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>OSPF(Open Shortest Path First)는 Link State 알고리즘과 Dijkstra 알고리즘을 사용하는 내부 라우팅 프로토콜(IGP)입니다. 네트워크 전체 토폴로지를 파악하여 최적 경로를 계산합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② RIP — Distance Vector 방식의 라우팅 프로토콜</p><p>③ EGP — 외부 게이트웨이 프로토콜</p><p>④ BGP — AS 간 라우팅 프로토콜</p></div>` },

  // Q16: TLS로 데이터 암호화 = HTTPS
  { qn: 16, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ HTTPS</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>HTTPS(HTTP Secure)는 TLS/SSL 프로토콜을 통해 HTTP 데이터를 암호화하여 전송합니다. 포트 443을 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SMTP — 기본적으로 평문 전송(STARTTLS는 별도)</p><p>② FTP — 평문 전송(FTPS/SFTP는 별도)</p><p>③ Telnet — 평문 전송</p></div>` },

  // Q17: DNS 호스트 이름은 영숫자, 하이픈만 허용 (@, # 불가)
  { qn: 17, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ 호스트 이름은 영문자와 숫자 그리고 '@', '#'과 같은 특수 문자로 구성된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS 호스트 이름은 영문자(a-z), 숫자(0-9), 하이픈(-)만 허용됩니다. @, # 같은 특수 문자는 사용할 수 없습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — DNS의 도메인→IP 변환 기능 설명은 올바릅니다.</p><p>② — DNS는 분산 데이터베이스 구조입니다.</p><p>③ — 도메인의 계층적 구조 설명은 올바릅니다.</p></div>` },

  // Q18: Adaptive ARQ = 프레임 길이 동적 변경
  { qn: 18, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① Adaptive ARQ</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Adaptive ARQ는 전송 효율을 최대화하기 위해 채널 상태에 따라 프레임 길이를 동적으로 변경하는 ARQ 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Go back-N ARQ — 오류 발생 시 해당 프레임부터 재전송</p><p>③ Selective-Repeat ARQ — 오류 프레임만 선택적 재전송</p><p>④ Stop and Wait ARQ — 하나씩 보내고 확인 후 다음 전송</p></div>` },

  // Q19: TDM = 데이터 없어도 타임슬롯 할당 → 대역폭 낭비
  { qn: 19, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① TDM(Time Division Multiplexer)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>동기식 TDM은 각 채널에 고정된 타임슬롯을 할당하므로, 전송할 데이터가 없더라도 슬롯이 비어있어 대역폭이 낭비됩니다. STDM은 이 문제를 해결한 통계적 다중화 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② STDM — 통계적 다중화로 빈 슬롯을 다른 채널이 사용</p><p>③ FDM — 주파수 분할 방식(타임슬롯과 무관)</p><p>④ FDMA — 주파수 분할 다중 접속 방식</p></div>` },

  // Q20: 추가 설정 용이, 중앙관리 = Star
  { qn: 20, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② Star</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Star(성형) 토폴로지는 중앙 허브/스위치를 통해 모든 노드가 연결되어 있어 노드 추가/제거가 용이하고 중앙에서 관리할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Bus — 하나의 주 케이블에 모든 노드 연결(중앙관리 어려움)</p><p>③ Ring — 순환 형태로 연결(추가/제거 어려움)</p><p>④ Mesh — 모든 노드가 서로 연결(복잡한 구조)</p></div>` },

  // Q21: 100BASE-T = Fast Ethernet
  { qn: 21, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ Fast Ethernet</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Fast Ethernet(IEEE 802.3u)은 100BASE-T로도 불리며 100Mbps 전송 속도를 지원하는 이더넷 표준입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Ethernet — 10Mbps (10BASE-T)</p><p>② Gigabit Ethernet — 1000Mbps (1000BASE-T)</p><p>③ 10Giga Ethernet — 10Gbps</p></div>` },

  // Q22: WDM - 광증폭기로 무중계 장거리 전송 가능
  { qn: 22, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 광증폭기를 사용해 무중계 장거리 전송이 가능하다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>WDM(파장분할다중화)은 하나의 광섬유에 여러 파장의 광신호를 동시에 전송하며, 광증폭기(EDFA)를 사용하여 무중계 장거리 전송이 가능합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 선로 증설 없이 회선 증설이 가능합니다.</p><p>③ — 주파수(파장)축에서 다중화하는 방식입니다(시간축 아님).</p><p>④ — 각 채널은 서로 다른 전송 형식과 속도를 가질 수 있습니다.</p></div>` },

  // Q23: 표 기반 - WPAN (근거리 무선 개인 영역 네트워크)
  { qn: 23, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① WPAN</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>WPAN(Wireless Personal Area Network)은 개인 영역 내 근거리 무선 통신 기술로, Bluetooth, Zigbee 등이 해당합니다. 일반적으로 10m 이내의 통신 범위를 가집니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② LTE-M — IoT용 셀룰러 통신 기술</p><p>③ NB-IoT — 협대역 IoT 통신 기술</p><p>④ LAN — 근거리 유무선 통신망(개인 영역보다 넓음)</p></div>` },

  // Q24: 소프트웨어로 제어되는 네트워킹 = SDN
  { qn: 24, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② SDN (Software Defined Networking)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SDN은 네트워크 제어 기능을 데이터 전달 기능과 분리하여 소프트웨어로 네트워크를 프로그래밍하고 관리하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SDS — 소프트웨어 정의 스토리지(네트워킹 아님)</p><p>③ SNMP — 네트워크 관리 프로토콜(SDN과 다름)</p><p>④ CLI — 명령줄 인터페이스(네트워킹 기술 아님)</p></div>` },

  // Q25: 사설 클라우드는 내부 사용자만
  { qn: 25, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ 사설 클라우드(private cloud)는 서버, 저장장치, 네트워크 데이터 그리고 응용프로그램 등을 함께 묶어서 회사 내·외부의 모든 이용자들이 공유할 수 있도록 하는 클라우드이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>사설 클라우드는 특정 조직 내부에서만 사용하는 전용 클라우드입니다. 외부 이용자와 공유하지 않으므로 "내·외부 모든 이용자 공유"는 틀린 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 클라우드의 단점 설명은 올바릅니다.</p><p>② — 공용 클라우드 설명은 올바릅니다.</p><p>④ — 하이브리드 클라우드 설명은 올바릅니다.</p></div>` },

  // Q26: HTTP는 응용계층 (표현계층 아님)
  { qn: 26, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ HTTP 프로토콜은 OSI 7 Layer의 표현계층에 해당한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>HTTP는 OSI 7계층 중 응용 계층(7계층)에 해당하는 프로토콜입니다. 표현 계층(6계층)은 데이터 형식 변환, 암호화, 압축 등을 담당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — TCP는 전송계층에 해당합니다(올바름).</p><p>② — IP는 네트워크계층에 해당합니다(올바름).</p><p>③ — FTP는 응용계층에 해당합니다(올바름).</p></div>` },

  // Q27: 순차적 전송 기회 = Token Ring
  { qn: 27, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② Token Ring</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Token Ring은 토큰을 순차적으로 전달하여 각 노드에게 공평한 전송 기회를 부여하는 MAC 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① CSMA/CD — 경쟁 기반 접근 방식(공평하지 않음)</p><p>③ CSMA — 캐리어 감지 다중 접근 방식</p><p>④ DQDB — 분산 큐 이중 버스 방식</p></div>` },

  // Q28: 명령어를 커널에 전달 = Shell
  { qn: 28, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ Shell</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Shell은 사용자와 커널 사이의 인터페이스로, 사용자가 입력한 명령어를 해석하여 커널에 전달하는 역할을 합니다. bash, sh, csh 등이 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① System Program — 시스템 유틸리티 프로그램</p><p>② Loader — 프로그램을 메모리에 적재</p><p>④ Directory — 파일 시스템의 디렉터리 구조</p></div>` },

  // Q29: /usr은 사용자 프로그램/라이브러리 (사용자 계정은 /home)
  { qn: 29, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ /usr - 사용자 계정이 위치하는 파티션 위치</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>/usr은 사용자 프로그램, 라이브러리, 문서 등이 설치되는 디렉터리입니다. 사용자 계정(홈 디렉터리)이 위치하는 곳은 /home입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① /tmp — 임시 파일 저장 디렉터리(올바름)</p><p>② /boot — 부팅 커널 이미지 디렉터리(올바름)</p><p>③ /var — 로그, 메일 저장 위치(올바름)</p></div>` },

  // Q30: TTL 길면 DNS 부하 줄어듦 (늘지 않음)
  { qn: 30, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ TTL 값이 길면 DNS의 부하가 늘어난다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TTL(Time To Live) 값이 길면 캐시 유지 시간이 늘어나 DNS 서버에 대한 쿼리 횟수가 줄어들므로 부하가 감소합니다. "부하가 늘어난다"는 반대 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — Zone 파일은 항상 SOA로 시작합니다(올바름).</p><p>② — SOA에 네임서버 유지를 위한 기본 자료가 저장됩니다(올바름).</p><p>③ — Refresh는 주/보조 서버 동기 주기를 설정합니다(올바름).</p></div>` },

  // Q31: 모든 사용자 쓰기 금지 = chmod a-w
  { qn: 31, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① chmod a-w sample</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chmod a-w는 all(모든 사용자)에게서 write(쓰기) 권한을 제거합니다. 'a'는 user+group+others 전체를 의미합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② chmod u-w — 소유자만 쓰기 권한 제거</p><p>③ chmod g+rw — 그룹에 읽기/쓰기 추가(반대)</p><p>④ chmod a-r — 모든 사용자 읽기 권한 제거(쓰기 아님)</p></div>` },

  // Q32: useradd -g 그룹 사용자
  { qn: 32, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① useradd -g icqa network</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>useradd -g 옵션은 기본 그룹을 지정합니다. useradd -g icqa network는 'network' 사용자를 'icqa' 기본 그룹에 등록합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — 사용자와 그룹 위치가 반대</p><p>③ — adduser에서 사용자와 그룹 위치가 반대</p><p>④ — -G는 보조 그룹 지정 옵션(기본 그룹은 -g)</p></div>` },

  // Q33: 메모리 정보 = free
  { qn: 33, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② free</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>free 명령어는 시스템의 전체 메모리, 사용 중인 메모리, 사용 가능한 메모리, 공유 메모리, 스왑(가상 메모리) 정보를 보여줍니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① mem — Linux에 없는 명령어</p><p>③ du — 디스크 사용량 확인</p><p>④ cat — 파일 내용 출력</p></div>` },

  // Q34: DHCP = IP 자원 효율적 관리 및 자동 할당
  { qn: 34, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ IP 자원의 효율적인 관리 및 IP 자동 할당한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DHCP(Dynamic Host Configuration Protocol)의 주요 역할은 네트워크 클라이언트에게 IP 주소, 서브넷 마스크, 게이트웨이 등을 자동으로 할당하여 IP 자원을 효율적으로 관리하는 것입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — HTTP 압축은 IIS/웹서버의 기능</p><p>② — TCP/IP 이름 확인은 DNS의 역할</p><p>④ — 사설→공인 IP 변환은 NAT의 역할</p></div>` },

  // Q35: 성능 모니터 = perfmon
  { qn: 35, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① perfmon</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>perfmon(Performance Monitor)은 Windows에서 시스템 성능을 모니터링하고 데이터를 수집하는 도구입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② msconfig — 시스템 구성 유틸리티</p><p>③ dfrg — 디스크 조각 모음(더 이상 사용되지 않음)</p><p>④ secpol — 로컬 보안 정책</p></div>` },

  // Q36: 여러 서버 교대 서비스 = Round Robin
  { qn: 36, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① Round Robin</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Round Robin은 여러 서버에 순차적으로 요청을 분배하여 부하를 공평하게 나누는 로드밸런싱 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Heartbeat — 서버 상태 확인용 신호</p><p>③ Failover Cluster — 장애 시 대체 서버로 전환</p><p>④ Non-Repudiation — 부인 방지(보안 개념)</p></div>` },

  // Q37: 파일 수준 접근, NFS/CIFS = NAS
  { qn: 37, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① NAS(Network Attached Storage)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NAS는 네트워크에 직접 연결된 파일 수준의 스토리지로, NFS/CIFS 프로토콜을 통해 파일 공유 서비스를 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② SAN — 블록 수준 스토리지(FC/iSCSI 사용)</p><p>③ RAID — 디스크 어레이 기술(네트워크 스토리지 아님)</p><p>④ SSD — 저장 장치 종류(네트워크 스토리지 아님)</p></div>` },

  // Q38: Hyper-V 가상 머신
  { qn: 38, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① Virtual Machine</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Hyper-V는 가상 머신(Virtual Machine)을 생성하고 관리하는 하이퍼바이저 기반 가상화 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② IIS — 웹 서버 서비스</p><p>③ Windows Containers — 컨테이너 기술</p><p>④ NanoServer — 경량 서버 배포 옵션</p></div>` },

  // Q39: 내부 웹 리소스를 인터넷에 게시 = WAP
  { qn: 39, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① WAP(Web Application Proxy)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>WAP(Web Application Proxy)는 내부 웹 리소스를 인터넷에 안전하게 게시하는 역방향 프록시 기능을 제공합니다. VPN/DirectAccess와 달리 원격 네트워크 연결이 아닌 웹 리소스 게시용입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② PPTP — VPN 터널링 프로토콜</p><p>③ L2TP — 레이어 2 터널링 프로토콜</p><p>④ SSTP — SSL 기반 VPN 터널링 프로토콜</p></div>` },

  // Q40: 인증 속성 관리 = Access Control Assistance Operators
  { qn: 40, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ Access Control Assistance Operators</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Access Control Assistance Operators 그룹은 컴퓨터 자원에 대한 인증 속성(authorization attributes)을 원격으로 쿼리할 수 있는 권한을 가진 그룹입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Replicator — 도메인 내 파일 복제 관리</p><p>② Power Users — 제한된 관리 권한의 사용자 그룹</p><p>③ Backup Operators — 백업/복원 권한 그룹</p></div>` },

  // Q41: 하드디스크 추가와 관계없는 것 = cal(달력)
  { qn: 41, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ cal</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>cal은 달력을 표시하는 명령어로 하드디스크 추가 작업과 전혀 관계없습니다. 새 디스크 추가는 fdisk(파티션)→mkfs(포맷)→mount(마운트) 순서로 진행합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① fdisk — 디스크 파티션 설정</p><p>② mkfs — 파일시스템 생성(포맷)</p><p>③ mount — 파일시스템 마운트</p></div>` },

  // Q42: BIND는 TCP/UDP 53번 모두 열어야 함
  { qn: 42, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 방화벽에서 UDP의 53번 포트만 열면 된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS(BIND)는 UDP 53번(일반 쿼리)과 TCP 53번(존 전송, 대용량 응답)을 모두 사용합니다. UDP 53번만 여는 것은 부족합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — iptables로 방화벽을 설정할 수 있습니다(올바름).</p><p>③ — rpm -qa | grep bind로 설치 확인이 가능합니다(올바름).</p><p>④ — named-checkconf로 설정 파일 오류를 점검합니다(올바름).</p></div>` },

  // Q43: DNS 설치 시 IP가 없으면 ipconfig /renew로 IP 받기 (문제 해결과 가장 관계없음)
  { qn: 43, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 명령어 프롬프트 창에서 'ipconfig /renew'를 입력하였다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS 서버를 설치하려면 고정 IP가 필요합니다. ipconfig /renew는 DHCP에서 동적 IP를 받는 명령어로, DNS 서버에 고정 IP를 설정하는 것과는 가장 관계가 적습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — 고정 할당 방식으로 변경하는 것은 적절합니다.</p><p>③ — 직접 IP 주소를 입력하는 것은 적절합니다.</p><p>④ — DNS 서버 주소를 직접 설정하는 것은 적절합니다.</p></div>` },

  // Q44: 접속 차단/거부 = 403 Forbidden
  { qn: 44, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ 403</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>HTTP 403 Forbidden은 서버가 요청을 이해했지만 접근 권한이 없어 거부하는 상태 코드입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 400 — Bad Request(잘못된 요청)</p><p>② 200 — OK(성공)</p><p>④ 203 — Non-Authoritative Information</p></div>` },

  // Q45: Directory Indexing 취약 = Options Indexes
  { qn: 45, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① Options FollowSymLinks Indexes</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Apache에서 Options에 Indexes가 포함되면 디렉터리 인덱싱이 활성화되어 파일 목록이 노출됩니다. 이는 Directory Indexing 공격에 취약합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② ServerAdmin — 관리자 이메일 설정(보안 무관)</p><p>③ DocumentRoot — 문서 루트 경로(직접적 취약점 아님)</p><p>④ ServerRoot — 서버 루트 경로(직접적 취약점 아님)</p></div>` },

  // Q46: RAID 0 - 데이터 복구 불가능
  { qn: 46, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ 2개의 디스크 중 하나만 손상돼도 전체 데이터 복구가 가능하다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RAID 0(Striping)은 데이터를 분산 저장하여 성능을 높이지만, 패리티나 미러링이 없으므로 하나의 디스크가 손상되면 전체 데이터를 잃게 됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 최소 2개 디스크에 분산 저장(올바름)</p><p>② — 분산 저장으로 처리속도 향상(올바름)</p><p>③ — 스트라이핑(Striping)이라고도 부름(올바름)</p></div>` },

  // Q47: 로드밸런싱 = 부하 분산 최적화 기술
  { qn: 47, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 사용량과 처리량을 증가시키고 지연율을 낮추며 응답시간을 감소시키고 시스템 부하를 피할 수 있게 하는 최적화 기술</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>로드밸런싱은 네트워크 트래픽이나 작업을 여러 서버에 분산하여 처리량을 높이고 응답 시간을 줄이는 최적화 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — VLAN(가상 LAN) 설명</p><p>③ — 가상 머신 설명</p><p>④ — SSL/TLS 암호화 설명</p></div>` },

  // Q48: 사설→공인 IP 변환 = NAT
  { qn: 48, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ NAT 방식</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NAT(Network Address Translation)은 사설 IP를 공인 IP로 변환하여 인터넷에 접속할 수 있게 하는 기술입니다. IP 주소 부족 해결과 내부 네트워크 보안에 기여합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① DHCP — IP 주소 자동 할당 방식</p><p>② IPv6 — 차세대 IP 주소 체계</p><p>④ MAC Address — 물리적 주소 방식</p></div>` },

  // Q49: 웹 프로토콜 공격 방어 = WAF
  { qn: 49, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ WAF</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>WAF(Web Application Firewall)는 HTTP/HTTPS 트래픽을 분석하여 SQL 인젝션, XSS 등 웹 애플리케이션 공격을 방어하는 전용 보안장비입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IDS — 침입 탐지 시스템(탐지만, 차단 안 함)</p><p>② IPS — 침입 방지 시스템(네트워크 전반)</p><p>③ Firewall — 네트워크 계층 방화벽(웹 전용 아님)</p></div>` },

  // Q50: 트렁크 (스위치 간 VLAN 연결)
  { qn: 50, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 트렁크(Trunk)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>트렁크(Trunk)는 스위치 간에 여러 VLAN의 트래픽을 하나의 링크로 전달하기 위한 연결 방식입니다. IEEE 802.1Q 태깅을 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 포트 — 네트워크 장비의 물리적/논리적 접속점</p><p>③ 소켓 — IP+포트 조합의 통신 엔드포인트</p><p>④ 플러그 — 물리적 연결 장치</p></div>` },
];

async function main() {
  let count = 0;
  for (const a of answers) {
    const res = await query(
      'UPDATE questions SET answer=$1, explanation=$2, updated_at=NOW() WHERE exam_id=$3 AND question_number=$4 RETURNING id',
      [a.ans, a.exp, 157, a.qn]
    );
    if (res.rows.length > 0) count++;
  }
  console.log(`exam_id=157 (2025년 2회): ${count}/50 문제 완료`);
  await getPool().end();
}

main().catch(e => { console.error(e); process.exit(1); });
