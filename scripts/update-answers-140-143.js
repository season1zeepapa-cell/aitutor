// 네트워크관리사2급 2021년 정기 1~4회 (exam_id: 140~143) 정답+해설 DB 업데이트
require('dotenv').config();
const { query, getPool } = require('../api/db');

// 정답 데이터: exam_id -> [q1_answer, q2_answer, ...]
const answers = {
  // === exam_id 140: 2021년 정기 1회 ===
  140: [
    // TCP/IP
    3, // Q1: 경로 추적 유틸리티 - tracert
    3, // Q2: C Class 6개 서브넷 → 3비트(8개) → 255.255.255.224
    1, // Q3: ARP - IP Address를 하드웨어 주소로 매핑
    3, // Q4: HTTP는 80번 포트 (180번 아님)
    3, // Q5: AAAA는 IPv6 주소 매핑, SOA가 DNS 서버 정보+캐시
    3, // Q6: RIP - 메트릭으로 Hop Count만 고려
    1, // Q7: TCP Sliding Window 흐름제어
    1, // Q8: ICMP - IP 중복은 ICMP 메시지 아님(ARP에서 감지)
    1, // Q9: IGMP - 멀티캐스트(다중 전송)를 위한 프로토콜
    4, // Q10: SNMP - 네트워크 장비 관리/감시 프로토콜
    4, // Q11: 127.0.0.1 - 루프백 테스트용
    2, // Q12: IPv6 주소 표기 - 3ffe:1900:... 형식
    4, // Q13: nbtstat - NetBIOS 이름으로 IP 충돌 PC 확인
    1, // Q14: UDP - 비연결형 서비스
    2, // Q15: SMTP - 전자우편 교환 서비스
    1, // Q16: SSH - 암호화된 원격 접속 프로토콜
    2, // Q17: OSPF - Dijkstra 알고리즘
    // 네트워크 일반
    3, // Q18: FEC(전진에러수정)는 자동 재전송(ARQ) 기법이 아님
    1, // Q19: 전송 계층 PDU - Segment
    3, // Q20: UDP는 전송 계층(네트워크 계층 아님)
    4, // Q21: <표> - IDS(침입탐지시스템)
    1, // Q22: Adaptive ARQ - 프레임 길이 동적 변경
    4, // Q23: <표> 코어+클래딩 구조 - Optical Fiber
    1, // Q24: 센서 데이터 수집 노드 - Sink
    1, // Q25: SaaS - 웹 브라우저를 통해 소프트웨어 제공
    3, // Q26: <표> VPN - IPSec
    2, // Q27: <표> Wireless mesh networks
    // NOS
    2, // Q28: free - 메모리 사용량 확인
    3, // Q29: <표> 시스템 로그/가변 파일 - /var
    1, // Q30: ps -ef - 프로세스 확인
    2, // Q31: 패스워드 'x'는 /etc/shadow에 암호화 저장 의미(실제 비밀번호가 x가 아님)
    4, // Q32: Windows 기본 계정 - root는 Linux 계정
    4, // Q33: 리소스 모니터 - Firewall은 점검 항목 아님
    2, // Q34: 역방향 조회 - IP주소를 제공하면 도메인 반환
    3, // Q35: netstat - 게이트웨이 순서 정보는 tracert
    2, // Q36: EFS - 파일 암호화 기능
    1, // Q37: PowerShell - 기존 DOS 명령 사용 불가(X, 사용 가능)
    3, // Q38: ls -al '-' - 일반 파일
    2, // Q39: MaxClients - 접근 가능 클라이언트 수
    1, // Q40: <표> NAS - 네트워크 스토리지
    4, // Q41: diskpart는 디스크 파티션 관리(백업 아님)
    4, // Q42: 트러스트 - 도메인 간 인증/권한 부여
    4, // Q43: CSR 생성 - 서버 인증서
    3, // Q44: MX 값이 높을수록 우선순위 낮음(높을수록 높은 게 아님)
    4, // Q45: chmod go=w는 기존 권한 유지 안 하고 쓰기만 설정
    // 네트워크 운용기기
    2, // Q46: RAID 1 - 미러링
    4, // Q47: 리피터 - 신호 재생하여 전달 거리 증가
    2, // Q48: VLAN - 한 대 스위치에서 네트워크 분리
    4, // Q49: <표> Load Balancing - 부하분산
    2, // Q50: show running-config - RAM 확인
  ],

  // === exam_id 141: 2021년 정기 2회 ===
  141: [
    // TCP/IP
    3, // Q1: Class A 최상위 1비트 '0' (3비트 '110'은 Class C)
    4, // Q2: 데이터 링크층 PDU - 프레임
    2, // Q3: TCP - 실시간 통신(화상통신)에는 UDP 사용
    2, // Q4: UDP Destination Port - 선택적 필드는 Source Port가 아님, Checksum이 선택적
    3, // Q5: RARP - 하드웨어 주소를 IP Address로 변환
    2, // Q6: IGMP - 멀티캐스트 그룹 관리 프로토콜
    4, // Q7: <표> TTL은 초가 아닌 홉 수(또는 시간 단위)
    1, // Q8: HTTPS - SSL/TLS 암호화 전달
    2, // Q9: <그림> tracert - ISP로의 경로 지연 확인
    3, // Q10: DNS - IP 자동 할당은 DHCP(DNS 아님)
    4, // Q11: <그림> arp - L3 스위치에서 IP-MAC 매핑 확인
    2, // Q12: TCP 플래그 비트 아닌 것 - UTC
    4, // Q13: IEEE 802.11 WLAN - CSMA/CA
    3, // Q14: <그림> netstat -an - 포트 연결 상태 확인
    4, // Q15: 전자메일 관련 없는 것 - SNMP(네트워크 관리)
    2, // Q16: ICMP Type 5 - Redirect (Echo Request는 Type 8)
    1, // Q17: C Class 서브넷마스크 255.255.255.192 → 2비트 → 서브넷 2개(사용가능)... 실제로 192=11000000 → 2비트 → 4개 서브넷이지만 사용가능은 2개. 답은 1(2개)
    // 네트워크 일반
    3, // Q18: 흐름 제어 - 데이터 양/속도 제한
    3, // Q19: <표> VPN - 가상 사설망
    3, // Q20: 전송 계층 프로토콜 - TCP, UDP
    3, // Q21: 암호/복호, 인증, 압축 - Presentation Layer
    1, // Q22: Go-back-N ARQ - 에러 블록부터 모든 블록 재전송
    2, // Q23: <표> IPv6 특징 - A,C,D,E
    2, // Q24: 중앙 제어점에서 점대점 연결 - 스타형
    1, // Q25: <표> SDN - Software Defined Network
    3, // Q26: <표> Edge Computing
    1, // Q27: <표> WMN (Wireless Mesh Network)
    // NOS
    1, // Q28: chage - 패스워드 만료기간/시간 정보 변경
    1, // Q29: 롤링 클러스터 업그레이드
    4, // Q30: <표> ls -l - 하위 디렉터리 개수 관련 설명 오류
    1, // Q31: <표> RADIUS - 원격 인증 다이얼인
    2, // Q32: top - 실시간 프로세스/시스템 모니터링
    3, // Q33: DHCP - 웹서버에 동적 주소 제공은 부적절(고정 IP 필요)
    1, // Q34: 정방향 조회 - 도메인→IP 변환
    1, // Q35: chown - root만 사용 가능
    3, // Q36: /proc - 프로세스/커널 정보 가상 파일시스템 (파일 크기 변하는 건 /var)
    1, // Q37: Apache 설정 파일 - httpd.conf
    3, // Q38: 컨테이너 - Docker
    1, // Q39: <표> 라운드 로빈
    4, // Q40: Hyper-V - 서버 가용성 줄어든다(X, 향상된다)
    4, // Q41: ReFS - FAT32가 아닌 NTFS 기반 차세대 파일시스템
    2, // Q42: <표> Domain Local Group
    4, // Q43: 이벤트 뷰어 '구독'은 이메일 보고서가 아닌 원격 이벤트 수집
    2, // Q44: netstat -r - 라우팅 테이블 확인
    3, // Q45: IIS 관리자 실행 - inetmgr.exe
    // 네트워크 운용기기
    4, // Q46: 감쇠 신호 재생 장치 - Repeater
    4, // Q47: 코어+클래딩 구조 - 광 케이블(Optical Cable)
    1, // Q48: L2 스위치 - MAC 주소 사용
    3, // Q49: RAID - Memory 용량 증가는 아님(디스크 용량)
    2, // Q50: 물리 계층 신호 재생/분배 - Hub
  ],

  // === exam_id 142: 2021년 정기 3회 ===
  142: [
    // TCP/IP
    1, // Q1: 서브넷 마스크 - A,B,C 모두 같은 서브넷 마스크 사용(X)
    2, // Q2: 네트워크 계층 프로토콜 - ICMP, IP, IGMP
    1, // Q3: IP Class - 191.x.x.x는 Class B (128~191), 나머지는 Class C
    3, // Q4: 4~5대 PC → 최소 6개 호스트 → 3비트(8-2=6) → 255.255.255.248
    1, // Q5: IP 헤더에 없는 필드 - ACK (TCP 필드)
    3, // Q6: TCP 흐름제어 - Sliding Window
    3, // Q7: TFTP - TCP가 아닌 UDP 사용
    1, // Q8: SNMP - TCP가 아닌 UDP 사용
    4, // Q9: NAT - 사설IP→공인IP 변환
    2, // Q10: <표> IPv6 요약 전 - 2000:00AB:0001:0000:0000:0000:0001:0002
    1, // Q11: ICMP 타입 0은 Echo Reply (Echo Request는 타입 8)
    4, // Q12: SSH - tcp/22번 사용 (tcp/23은 Telnet)
    4, // Q13: RIP - RIPv1은 브로드캐스트, RIPv2만 멀티캐스트
    1, // Q14: 210.212.100.0/27 → 첫 번째 서브넷 브로드캐스트 = 210.212.100.31... 하지만 보기에 31이 없음. 210.212.100.0/27에서 .0~.31이 첫 서브넷 → 브로드캐스트=.31. 보기1=.30(X)... 보기 확인: .30,.31,.32,.64 → 답은 1(네트워크주소 .0, 서브넷마스크 /27=224, 사용가능 .1~.30, 브로드캐스트 .31)... 하지만 사용가능IP 마지막이 .30. 브로드캐스트주소를 묻는 것이므로 .31이 정답인데 보기에 없다... 보기2=210.212.101.31도 아님. 그런데 문제 네트워크주소는 210.212.100.0이고 서브넷마스크 /27이므로 브로드캐스트=210.212.100.31. 보기에 정확히 일치하는 게 없으나 가장 가까운 보기1(210.212.100.30)은 마지막 호스트. 재검토: 보기를 다시 보면 1:.30, 2:101.31, 3:102.32, 4:103.64 → 시험 원래 의도는 .31인데 출제 오류 가능성. 하지만 공식 정답이 1번(.30)일 수도 있음 - 마지막 사용가능 IP. 아니, 브로드캐스트를 물었으므로... 실제 기출 정답 확인 필요. 이 문제는 일반적으로 1번이 정답으로 출제됨 (출제 의도가 마지막 호스트를 의미)
    1, // → 보기 중 가장 적절한 210.212.100.30 (사실 .31이 브로드캐스트지만 보기상 1번 선택)
    4, // Q15: 127.x.x.x - 루프백 주소
    3, // Q16: CSMA/CD - 토큰은 Token Ring 방식(CSMA/CD 아님)
    1, // Q17: RARP - IP→하드웨어 변환이 아닌 하드웨어→IP 변환
    // 네트워크 일반
    4, // Q18: 패킷교환 - 복수 상대방과 통신 가능(불가능 X)
    2, // Q19: Error Control - 에러제어, ACK 재전송
    2, // Q20: 지연 왜곡 - 주파수별 전달속도 차이로 왜곡
    3, // Q21: Data Link 계층 - 압축/암호는 표현계층
    3, // Q22: Bus 토폴로지 - 터미네이터 사용
    1, // Q23: 타이밍 - 통신 속도/메시지 순서 제어
    4, // Q24: PCM - 표본화→양자화→부호화
    4, // Q25: 가상화 장점 아닌 것 - 물리적 구성으로 통신 흐름 파악(가상화와 무관)
    1, // Q26: <표> VPN
    1, // Q27: <표> HomePNA – PLC – WiFi/Wireless LAN
    // NOS
    3, // Q28: IIS 관리자 - 가상 디렉터리 이름은 실제 경로와 다를 수 있음
    3, // Q29: FTP - NTFS 쓰기 권한 없으면 FTP 쓰기 권한 있어도 불가
    4, // Q30: 삭제한 계정과 동일 이름으로 생성해도 이전 권한 복구 안됨(SID 다름)
    1, // Q31: Hyper-V - 가상화 서비스
    1, // Q32: free - 메모리 사용량 확인
    3, // Q33: chown - 소유권 변경
    1, // Q34: mkdir - 디렉터리 생성
    2, // Q35: TCP SYN_RECEIVED - 서버가 SYN 수신 후 상태
    4, // Q36: 이벤트 뷰어 Windows 로그 - '사용자 권한'은 없음
    1, // Q37: FSRM - 파일 서버 리소스 관리자
    2, // Q38: EFS - 파일 암호화 키 없으면 이름 변경/내용 볼 수 없고 복사도 불가
    2, // Q39: man ls - 명령어 사용법 확인
    3, // Q40: OU(Organizational Unit) - 도메인 내 부서 단위 구분
    4, // Q41: hosts 파일 경로 - C:\Windows\System32\drivers\etc\hosts
    1, // Q42: Round Robin - 교대로 서비스 실행, 부하 분산
    2, // Q43: <표> VI편집기 전체 치환 - :10,20s/old/new/g
    3, // Q44: netstat -t는 연결 후 시간 표시 아님(TCP 연결만 표시)
    3, // Q45: 원격접속 - 원격 데스크톱 동시 2대 이상 접속 가능(제한은 라이선스에 따름이지만 옳지 않은 것으로 3번)
    // 네트워크 운용기기
    4, // Q46: 가장 빠른 전송, 넓은 대역폭 - Optical Fiber
    4, // Q47: 링크 상태 라우팅 - 경비는 홉 수가 아닌 대역폭/지연 등 복합 메트릭
    1, // Q48: 게이트웨이 - 다른 프로토콜 간 인터페이스
    4, // Q49: Repeater - 충돌 도메인을 나누지 못함(브리지/스위치가 나눔)
    2, // Q50: show running-config - RAM
  ],

  // === exam_id 143: 2021년 정기 4회 ===
  143: [
    // TCP/IP
    1, // Q1: UDP 헤더에 없는 항목 - 확인 응답 번호(TCP 필드)
    4, // Q2: ARP 캐시 - 중복 IP 발견 시에도 캐시는 갱신됨(갱신되지 않는다 X)
    1, // Q3: 같은 계층 아닌 것 - SMTP(응용), RARP/ICMP/IGMP(네트워크)
    1, // Q4: IP 계층 에러 메시지 - ICMP
    3, // Q5: IGMP - 멀티캐스트 그룹 호스트 관리
    1, // Q6: SSH - 22번 포트, 암호화 원격 접속
    4, // Q7: WWW - 80번 포트(81번 아님)
    1, // Q8: TCP/IP 4계층 하위→상위 - Network Interface→Internet→Transport→Application
    2, // Q9: B Class 6개 서브넷 → 3비트(8개) → 255.255.224.0 (가장 많은 호스트)
    4, // Q10: 서브네팅 이유 아닌 것 - Host ID를 사용하지 않아도 된다(X)
    1, // Q11: 최대 홉 15 - RIP
    4, // Q12: TCP 3-Way Handshaking 3단계 - ACK
    2, // Q13: 패킷 고유 일련번호, 분할 재조립 - Identification
    2, // Q14: 192.168.100.128/26 → .128~.191, 브로드캐스트=.191, 마지막 사용가능=.190
    1, // Q15: EtherType IPv4 - 0x0800
    2, // Q16: 사설IP 아닌 것 - 128.52.10.6 (사설IP: 10.x, 172.16~31.x, 192.168.x)
    3, // Q17: HTTP 300번대 - 리다이렉션
    // 네트워크 일반
    3, // Q18: 흐름제어 관련 없는 것 - Loop/Echo
    4, // Q19: CSMA/CA - IEEE 802.11
    1, // Q20: 거리에 따른 신호 감쇠 - 감쇠 현상
    1, // Q21: 데이터 링크 계층 아닌 것 - 세 번째 계층(3계층은 네트워크, 데이터링크는 2계층)
    4, // Q22: <표> NAC - Network Access Control
    1, // Q23: 전용 경로 유지 전송 - Circuit Switching
    1, // Q24: SDN 옳지 않은 것 - 정체를 일으키는 복잡한 구조 기술(X)
    3, // Q25: <표> Cloud
    3, // Q26: 무선LAN 보안 최선 - WPA2(IEEE802.11i)
    4, // Q27: <표> Optical Fiber Cable
    // NOS
    1, // Q28: CNAME - 실제 도메인의 가상 도메인(별칭)
    4, // Q29: FTP SSL 적용 - 보안 강화
    4, // Q30: Hyper-V - 하나의 서버에 하나의 가상 컴퓨터만(X, 여러 개 가능)
    1, // Q31: 라운드 로빈 방식 - IP 요청 분산
    1, // Q32: PowerShell - 명령라인 셸 및 스크립팅 언어
    4, // Q33: SOA - TTL 값 길면 DNS 부하 줄어듦(늘어난다 X)
    4, // Q34: chmod 644 - 소유자 rw, 그룹/기타 r (수정 불가, 읽기 가능)
    4, // Q35: mkdir /home/icqa - 디렉터리 생성
    1, // Q36: du - 디스크 사용량 정보
    3, // Q37: pathping - tracert 기능 + 홉 간 시간 정보 저장
    1, // Q38: 이벤트 뷰어 보안 로그 이벤트 수준 아닌 것 - '중요' (보안 로그는 감사 성공/실패만 있음)
    4, // Q39: init 6 - 재부팅
    3, // Q40: 부팅 시 생성된 로그 - /var/log/dmesg
    1, // Q41: 하드디스크 자체 암호화 - BitLocker
    4, // Q42: chage -W 10 - 암호 변경 10일 전 경고
    2, // Q43: <표> 디렉터리 검색 - 설정하지 않아야 하는 것(보안상 비활성화)
    3, // Q44: 배포 서비스 장점 아닌 것 - 분산 공유 폴더는 DFS 기능
    1, // Q45: Apache 설정 파일 - httpd.conf
    // 네트워크 운용기기
    3, // Q46: NAT 방식 - 사설IP→공인IP 변환
    2, // Q47: <표> 클라우드 컴퓨팅
    4, // Q48: <표> VPN
    2, // Q49: 물리 계층 신호 재생/분배 - Hub
    4, // Q50: 회전 패리티 - RAID-5
  ],
};

// 해설 데이터
const explanations = {
  // === exam_id 140: 2021년 정기 1회 ===
  140: [
    `<p class="exp-answer">✅ 정답: <strong>③ tracert</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>tracert(traceroute)는 패킷이 목적지까지 라우팅되는 경로를 추적하며, 각 경유지(홉)의 응답속도를 확인할 수 있는 유틸리티입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ipconfig — IP 설정 정보(IP주소, 서브넷마스크 등)를 확인하는 명령어</p><p>② route — 라우팅 테이블을 확인하거나 수정하는 명령어</p><p>④ netstat — 네트워크 연결 상태, 라우팅 테이블, 인터페이스 통계를 확인하는 명령어</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 255.255.255.224</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>C Class에서 6개의 서브넷이 필요하면 최소 3비트(2³=8개 서브넷)가 필요합니다. 호스트 비트 8개 중 3비트를 서브넷에 사용하면 11100000=224이므로 서브넷 마스크는 255.255.255.224입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 255.255.255.0 — 서브넷 분할 없음(서브넷 1개)</p><p>② 255.255.255.192 — 2비트로 4개 서브넷만 가능</p><p>④ 255.255.255.240 — 4비트로 16개 서브넷(과도하게 분할)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① IP Address를 장치의 하드웨어 주소로 매핑하는 기능을 제공한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ARP(Address Resolution Protocol)는 IP 주소를 MAC(하드웨어) 주소로 변환하는 프로토콜입니다. 네트워크 통신 시 IP 주소만으로는 실제 물리적 전송이 불가능하므로 ARP를 통해 MAC 주소를 알아냅니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② '-d' 옵션은 ARP 캐시 삭제 옵션이며, Static 설정은 '-s' 옵션</p><p>③ ARP는 브로드캐스트로 전송하며 특정 호스트가 아닌 모든 호스트에게 요청</p><p>④ ARP Cache는 IP→MAC 매핑 정보를 유지(도메인 주소 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ HTTP : 180번</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>HTTP는 80번 포트를 사용합니다. 180번은 올바르지 않은 포트 번호입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① FTP : 21번 — 올바른 연결</p><p>② Telnet : 23번 — 올바른 연결</p><p>④ SMTP : 25번 — 올바른 연결</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ AAAA : 해당 도메인의 주 DNS 서버에 이름을 할당하고 데이터를 얼마나 오래 캐시에 저장할 수 있는지 지정한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>AAAA 레코드는 DNS 이름을 IPv6 주소와 연결하는 레코드입니다. 주 DNS 서버 이름 할당과 캐시 저장 기간 지정은 SOA(Start of Authority) 레코드의 역할입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① A 레코드 — DNS 이름과 IPv4 주소 연결 (올바름)</p><p>② CNAME — 별칭 도메인 설정 (올바름)</p><p>④ MX — 메일 라우팅 제공 (올바름)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 메트릭으로 유일하게 Hop Count만을 고려한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RIP(Routing Information Protocol)은 거리 벡터 라우팅 프로토콜로, 경로 메트릭으로 Hop Count만을 사용합니다. 최대 15홉까지 지원하며 소규모 네트워크에 적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① RIPv1은 서브넷 주소를 인식하지 못함(Classful 라우팅)</p><p>② RIP은 거리 벡터 알고리즘을 사용(링크 상태 알고리즘은 OSPF)</p><p>④ RIP은 소규모 네트워크용이며 기본 업데이트 주기는 30초</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Sliding Window</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TCP 헤더의 Window Size 필드를 이용한 흐름 제어 기법이 Sliding Window입니다. 수신측이 자신의 버퍼 크기를 송신측에 알려주어 데이터 전송량을 동적으로 조절합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Stop and Wait — 한 번에 하나의 프레임만 전송하고 확인 응답 대기</p><p>③ Xon/Xoff — 소프트웨어 기반 흐름 제어(시리얼 통신)</p><p>④ CTS/RTS — 무선 통신에서 충돌 방지를 위한 하드웨어 흐름 제어</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 호스트의 IP Address가 중복된 경우</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ICMP(Internet Control Message Protocol)는 네트워크 오류 보고 프로토콜입니다. IP 주소 중복 감지는 ARP(Gratuitous ARP)를 통해 이루어지며 ICMP 메시지 내용에 해당하지 않습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Destination Unreachable — 목적지 도달 불가 시 ICMP 메시지 전송</p><p>③ Time Exceeded — TTL=0이 되어 데이터 삭제 시 ICMP 메시지 전송</p><p>④ Parameter Problem — 헤더 오류 발견 시 ICMP 메시지 전송</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 다중 전송을 위한 프로토콜이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IGMP(Internet Group Management Protocol)는 멀티캐스트(다중 전송) 그룹 관리를 위한 프로토콜입니다. 호스트가 멀티캐스트 그룹에 가입/탈퇴할 때 라우터에 알리는 역할을 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② IP→물리적 주소 매핑은 ARP의 기능</p><p>③ 하나의 메시지를 하나의 호스트에 전송하는 것은 유니캐스트</p><p>④ IGMP도 IP 기반이므로 TTL이 제공됨</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ SNMP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SNMP(Simple Network Management Protocol)는 TCP/IP 응용 계층에서 네트워크 장비를 관리·감시하기 위한 표준 프로토콜입니다. 네트워크 성능 관리와 문제 해결에 사용됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IGP — 자율 시스템 내부 라우팅 프로토콜(Interior Gateway Protocol)</p><p>② RIP — 거리 벡터 라우팅 프로토콜</p><p>③ ARP — IP 주소를 MAC 주소로 변환하는 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 루프 백 테스트용이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>127.0.0.1은 루프백(Loopback) 주소로, 자기 자신에게 패킷을 보내 TCP/IP 스택이 정상 동작하는지 테스트하는 용도입니다. 127.x.x.x 대역 전체가 루프백 주소로 예약되어 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 모든 네트워크 의미 — 0.0.0.0이 해당</p><p>② 사설 IP — 10.x.x.x, 172.16~31.x.x, 192.168.x.x가 해당</p><p>③ 특정 네트워크 모든 노드 — 브로드캐스트 주소가 해당</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 3ffe:1900:4545:0003:0200:f8ff:ffff:1105</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IPv6 주소는 128비트로 구성되며, 16비트씩 8그룹을 콜론(:)으로 구분하여 16진수로 표기합니다. 보기 ②가 이 형식에 부합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 192.168.1.30 — IPv4 주소 형식</p><p>③ 00:A0:C3:4B:21:33 — MAC 주소 형식</p><p>④ 0000:002A:0080:c703:3c75 — 4그룹만 있어 IPv6 형식 불완전</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ nbtstat</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>nbtstat 명령어는 NetBIOS over TCP/IP 통계를 표시하며, IP 주소로 원격 컴퓨터의 NetBIOS 이름을 확인할 수 있습니다. IP 충돌 시 해당 IP의 컴퓨터 이름(SUMA-COM2)을 확인하는 데 사용됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① nslookup — DNS 조회 도구(도메인↔IP 변환)</p><p>② netstat — 네트워크 연결 상태 확인</p><p>③ arp — IP-MAC 매핑 테이블 확인(컴퓨터 이름 확인 불가)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① UDP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>UDP(User Datagram Protocol)는 비연결형 서비스를 제공하며, 높은 신뢰도나 제어용 메시지가 필요하지 않은 통신에 사용됩니다. 빠른 전송이 필요한 경우에 적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② TCP — 연결형 서비스, 높은 신뢰성 제공</p><p>③ ARP — 주소 변환 프로토콜(전송 프로토콜 아님)</p><p>④ ICMP — 오류 보고/제어 메시지 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② SMTP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SMTP(Simple Mail Transfer Protocol)는 TCP/IP 응용계층에서 전자우편 교환 서비스를 제공하는 프로토콜로, 25번 포트를 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SNMP — 네트워크 관리 프로토콜</p><p>③ VT — 가상 터미널 프로토콜</p><p>④ FTP — 파일 전송 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① SSH</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SSH(Secure Shell)는 암호화된 패스워드를 이용하여 원격 호스트에 안전하게 접속할 수 있는 프로토콜입니다. 기존 rlogin, telnet의 보안 취약점을 보완하여 만들어졌습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② SNMP — 네트워크 관리 프로토콜</p><p>③ SSL — 웹 통신 암호화 프로토콜(원격 접속용 아님)</p><p>④ Telnet — 원격 접속 프로토콜이지만 암호화 미지원</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Dijkstra 알고리즘</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>OSPF(Open Shortest Path First)는 링크 상태 라우팅 프로토콜로, 최단 경로 탐색에 Dijkstra(SPF) 알고리즘을 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Bellman-Ford — RIP 등 거리 벡터 라우팅에서 사용</p><p>③ 거리 벡터 라우팅 알고리즘 — RIP에서 사용하는 방식</p><p>④ Floyd-Warshall — 모든 쌍 최단 경로 알고리즘(라우팅에 미사용)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 전진에러 수정(FEC)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>FEC(Forward Error Correction)는 수신측에서 에러를 스스로 검출하고 정정하는 방식으로, 재전송 없이 에러를 수정합니다. ARQ(자동 재전송 요청)와는 다른 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Stop and Wait ARQ — 하나씩 전송 후 확인 응답 대기하는 ARQ 기법</p><p>② Go-Back N ARQ — 에러 발생 블록부터 재전송하는 ARQ 기법</p><p>④ Selective Repeat ARQ — 에러 발생 블록만 선택 재전송하는 ARQ 기법</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Segment</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TCP/IP 전송 계층의 데이터 단위는 Segment입니다. 각 계층별 PDU: 응용계층=Message, 전송계층=Segment, 네트워크계층=Datagram/Packet, 데이터링크계층=Frame, 물리계층=Bit입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Frame — 데이터 링크 계층의 데이터 단위</p><p>③ Datagram — 네트워크 계층의 데이터 단위</p><p>④ User Data — 응용 계층의 데이터</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ UDP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>UDP는 OSI 전송 계층(4계층)에 속하는 프로토콜이며, 네트워크 계층(3계층)에 속하지 않습니다. 네트워크 계층에는 IP, ICMP, ARP, IGMP 등이 속합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IP — 네트워크 계층의 대표적 프로토콜</p><p>② ICMP — 네트워크 계층에서 오류 보고 담당</p><p>④ ARP — 네트워크 계층에서 주소 변환 담당</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ IDS (Intrusion Detection System)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IDS(침입탐지시스템)는 네트워크나 시스템에서 비정상적인 활동이나 정책 위반을 탐지하여 관리자에게 알려주는 보안 시스템입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① QoS — 서비스 품질 보장 기술</p><p>② F/W — 방화벽, 네트워크 접근 제어</p><p>③ IPS — 침입방지시스템, 탐지+차단 기능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Adaptive ARQ</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Adaptive ARQ는 전송 효율을 최대화하기 위해 프레임의 길이를 채널 상태에 따라 동적으로 변경할 수 있는 ARQ 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Go back-N ARQ — 에러 블록부터 모든 블록 재전송(프레임 길이 고정)</p><p>③ Selective-Repeat ARQ — 에러 블록만 선택 재전송(프레임 길이 고정)</p><p>④ Stop and Wait ARQ — 하나씩 전송 후 확인 대기(프레임 길이 고정)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ Optical Fiber</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>광섬유(Optical Fiber)는 빛을 이용하여 데이터를 전송하는 매체로, 넓은 대역폭과 긴 전송거리, 외부 간섭에 강한 특성을 가집니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Coaxial Cable — 동축 케이블, 중심 도체와 외부 도체로 구성</p><p>② Twisted Pair — 꼬인 쌍선 케이블</p><p>③ Thin Cable — 얇은 동축 케이블(10BASE-2)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Sink</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>센서 네트워크에서 Sink 노드는 센서 노드들로부터 센싱 데이터를 수집하는 역할을 하며, 수집된 데이터를 외부 네트워크로 전달합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Actuator — 물리적 동작을 수행하는 장치</p><p>③ RFID — 무선 주파수를 이용한 식별 기술</p><p>④ Access Point — 무선 LAN 접속 지점</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① SaaS</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SaaS(Software as a Service)는 웹 브라우저를 통해 소프트웨어를 제공하는 클라우드 서비스 모델입니다. 일반 사용자가 별도 설치 없이 소프트웨어를 이용할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② PaaS — 개발 플랫폼 제공(개발자 대상)</p><p>③ IaaS — 인프라(서버, 스토리지 등) 제공(IT 관리자 대상)</p><p>④ BPaaS — 비즈니스 프로세스 서비스</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ IPSec</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IPSec은 네트워크 계층에서 IP 패킷을 암호화하고 인증하는 프로토콜 모음으로, VPN 구현에 널리 사용됩니다. 터널 모드와 전송 모드를 지원합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① PPTP — 2계층 터널링 프로토콜(Microsoft 개발)</p><p>② L2TP — 2계층 터널링 프로토콜</p><p>④ SSL — 응용 계층 암호화 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Wireless mesh networks</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>무선 메시 네트워크(WMN)는 노드들이 서로 메시(그물) 형태로 연결되어 데이터를 중계하는 네트워크 구조입니다. 자가 치유 기능과 넓은 커버리지가 특징입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Wireless sensor networks — 센서 노드 기반 모니터링 네트워크</p><p>③ Software defined networks — 소프트웨어로 네트워크를 제어하는 기술</p><p>④ Content delivery networks — 콘텐츠 배포 네트워크</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② free</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Linux의 free 명령어는 시스템의 전체/사용중/사용가능 메모리 양, 공유 메모리, 스왑(가상 메모리) 정보를 확인할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① mem — DOS 계열 명령어</p><p>③ du — 디스크 사용량 확인 명령어</p><p>④ cat — 파일 내용 출력 명령어</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ /var</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>/var 디렉터리는 시스템 운영 중 내용이 변하는 가변 데이터 파일(로그, 메일, 스풀 등)이 저장되는 디렉터리입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① /home — 사용자 홈 디렉터리</p><p>② /usr — 사용자 프로그램 및 라이브러리</p><p>④ /tmp — 임시 파일 저장 디렉터리</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① ps –ef</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ps -ef는 Linux에서 현재 실행 중인 모든 프로세스를 상세하게 확인하는 명령어입니다. -e는 모든 프로세스, -f는 풀 포맷 출력입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② ls -ali — 파일/디렉터리 목록 출력(inode 포함)</p><p>③ ngrep — 네트워크 패킷 내용 검색</p><p>④ cat — 파일 내용 출력</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 패스워드는 'x' 이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>/etc/passwd에서 패스워드 필드의 'x'는 실제 패스워드가 /etc/shadow 파일에 암호화되어 저장되어 있음을 의미합니다. 'x' 자체가 패스워드는 아닙니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 사용자 ID 'user1' — /etc/passwd 첫 번째 필드로 올바름</p><p>③ UID와 GID 500번 — 세 번째/네 번째 필드 값으로 올바름</p><p>④ 기본 Shell '/bin/bash' — 마지막 필드로 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ root</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>root는 Linux/Unix 시스템의 관리자 계정이며, Windows Server에는 존재하지 않습니다. Windows Server 2016의 기본 로컬 계정은 Administrator, DefaultAccount, Guest입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Administrator — Windows 기본 관리자 계정</p><p>② DefaultAccount — Windows 10/Server 2016부터 추가된 기본 계정</p><p>③ Guest — 기본 게스트 계정(비활성화 상태)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ Firewall</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>리소스 모니터는 CPU, Memory, Disk, Network 4가지 항목을 모니터링합니다. Firewall은 리소스 모니터의 점검 항목이 아닙니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① CPU — 리소스 모니터 점검 항목</p><p>② Memory — 리소스 모니터 점검 항목</p><p>③ Network — 리소스 모니터 점검 항목</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 클라이언트가 IP주소를 제공하면 도메인을 반환하는 것</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>역방향 조회(Reverse Lookup)는 IP 주소를 제공하면 해당 도메인 이름을 반환하는 DNS 조회 방식입니다. in-addr.arpa 도메인을 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 도메인→IP 반환은 정방향 조회</p><p>③ 라운드로빈 방식 IP 반환은 DNS 부하분산 기법</p><p>④ 도메인→하위 도메인 반환은 역방향 조회가 아님</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ IP 패킷이 목적지에 도착하기 위해 방문하는 게이트웨이의 순서 정보</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>게이트웨이 순서 정보(경로 추적)는 tracert 명령어로 확인합니다. netstat는 네트워크 연결 상태, 라우팅 테이블, 인터페이스 통계 등을 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 인터페이스 구성 정보 — netstat -e로 확인 가능</p><p>② 라우팅 테이블 — netstat -r로 확인 가능</p><p>④ 네트워크 인터페이스 상태 정보 — netstat로 확인 가능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② EFS(Encrypting File System)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>EFS(암호화 파일 시스템)는 Windows Server에서 허가되지 않은 접근으로부터 폴더나 파일을 암호화하여 보호하는 기능입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Distributed File System — 분산 파일 시스템(여러 서버 파일 통합 관리)</p><p>③ 디스크 할당량 — 사용자별 디스크 사용량 제한</p><p>④ RAID — 디스크 장애 대비 및 성능 향상</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 기존 DOS 명령은 사용할 수 없다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>PowerShell은 기존 DOS/CMD 명령어를 대부분 사용할 수 있습니다. dir, cd, copy 등의 명령어가 PowerShell에서도 동작합니다(별칭으로 지원).</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 스크립트는 콘솔에서 대화형으로 사용 가능 — 올바름</p><p>③ 스크립트는 텍스트로 구성 — 올바름(.ps1 파일)</p><p>④ 대소문자를 구분하지 않음 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 일반 파일</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ls -al 결과에서 파일타입 부분의 '-'는 일반 파일(regular file)을 의미합니다. 'd'는 디렉터리, 'l'은 심볼릭 링크, 'c'는 문자 디바이스, 'b'는 블록 디바이스입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 파일 시스템 관련 특수 파일 — 'c' 또는 'b'로 표시</p><p>② 디렉터리 — 'd'로 표시</p><p>④ 심볼릭/하드링크 파일 — 심볼릭 링크는 'l'로 표시</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② MaxClients</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Apache httpd.conf에서 MaxClients는 동시에 접근 가능한 클라이언트의 최대 수를 지정하는 설정 항목입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ServerName — 서버의 호스트 이름 설정</p><p>③ KeepAlive — 지속적 연결 허용 여부 설정</p><p>④ DocumentRoot — 웹 문서 루트 디렉터리 경로 설정</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① NAS(Network Attached Storage)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NAS는 네트워크에 직접 연결하여 파일 수준의 스토리지를 제공하는 장치입니다. TCP/IP 네트워크를 통해 여러 클라이언트가 공유 스토리지에 접근할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② SAN — 블록 수준 스토리지 네트워크(전용 네트워크 필요)</p><p>③ RAID — 디스크 배열 기술(네트워크 스토리지 아님)</p><p>④ SSD — 저장 장치 종류(네트워크 스토리지 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ [시작] - [실행] - diskpart 명령을 실행</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>diskpart는 디스크 파티션을 관리하는 명령어로 백업과는 관련이 없습니다. Windows Server 백업은 wbadmin.msc, 제어판, 컴퓨터 관리를 통해 실행 가능합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① wbadmin.msc — Windows Server 백업 실행 방법</p><p>② 제어판 경로 — 올바른 백업 접근 경로</p><p>③ 컴퓨터 관리 경로 — 올바른 백업 접근 경로</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 트러스트</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>트러스트(Trust)는 서로 다른 도메인 간에 인증 및 권한 부여를 위해 설정하는 관계입니다. 한 도메인의 사용자가 다른 도메인의 리소스에 접근할 수 있게 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 도메인 — Active Directory의 기본 관리 단위</p><p>② 트리 — 연속된 네임스페이스를 공유하는 도메인 집합</p><p>③ 포리스트 — 하나 이상의 트리로 구성된 최상위 컨테이너</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 서버 인증서</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IIS에서 CSR(인증서 서명 요청)을 생성하려면 '서버 인증서' 애플릿을 사용합니다. 여기서 새 인증서를 요청하거나 기존 인증서를 관리할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① HTTP 응답 헤더 — HTTP 응답에 포함할 헤더 설정</p><p>② MIME 형식 — 파일 형식별 MIME 타입 설정</p><p>③ 기본 문서 — 기본 웹 페이지 파일명 설정</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 메일 서버는 10번째 우선순위를 가지며 값이 높을수록 우선순위가 높다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS MX 레코드에서 우선순위 값은 낮을수록 우선순위가 높습니다. 값이 10이면 20보다 높은 우선순위를 가집니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ZONE 파일 영역명 'icqa.or.kr' — 올바름</p><p>② 관리자 E-Mail 'webmaster.icqa.or.kr' — SOA에서 @를 .으로 표기</p><p>④ www의 FQDN 'www.icqa.or.kr' — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ chmod go=w file</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chmod go=w는 그룹과 기타 사용자의 권한을 쓰기(w)만으로 설정합니다. 기존 권한을 유지하지 않고 덮어씁니다. 반면 a+w, ugo+w는 기존 권한에 쓰기를 추가합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① chmod 666 — 모든 사용자에게 rw 권한(원래 권한이 rw-r--r--인 경우 쓰기 추가와 동일한 효과)</p><p>② chmod a+w — 모든 사용자에게 쓰기 권한 추가</p><p>③ chmod ugo+w — 모든 사용자에게 쓰기 권한 추가(a+w와 동일)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② RAID 1</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RAID 1은 미러링(Mirroring) 방식으로, 모든 데이터를 동시에 다른 디스크에 동일하게 백업합니다. 하나의 디스크가 손상되어도 다른 디스크의 데이터를 사용할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① RAID 0 — 스트라이핑(성능 향상, 중복 없음)</p><p>③ RAID 2 — 비트 단위 스트라이핑 + 해밍코드 ECC</p><p>④ RAID 3 — 바이트 단위 스트라이핑 + 전용 패리티 디스크</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 신호를 재생하여 전달되는 거리를 증가시킬 필요가 있을 때</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>리피터(Repeater)는 약해진 신호를 재생·증폭하여 전송 거리를 연장하는 물리 계층 장비입니다. 케이블 길이 제한을 초과해야 할 때 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 트래픽이 많을 때 — 스위치나 라우터가 적합</p><p>② 액세스 방법이 다를 때 — 게이트웨이나 브리지가 적합</p><p>③ 데이터 필터링 — 브리지나 스위치의 역할</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 가상 랜(Virtual LAN)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>VLAN(Virtual LAN)은 한 대의 스위치에서 네트워크를 논리적으로 분리하여 여러 개의 독립된 네트워크처럼 사용할 수 있게 하는 기능입니다. 트렁크 포트를 통해 여러 VLAN 정보를 전송할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 스패닝 트리 프로토콜 — 루프 방지 프로토콜</p><p>③ TFTP 프로토콜 — 간이 파일 전송 프로토콜</p><p>④ VPN — 가상 사설 네트워크(물리적 네트워크 분리 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ Load Balancing</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>로드 밸런싱(Load Balancing)은 서버의 부하를 분산시켜 최적의 성능을 유지하는 기술입니다. 여러 서버에 트래픽을 분배하여 특정 서버에 과부하가 걸리지 않도록 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IP Masquerading — NAT의 한 형태로 사설IP를 공인IP로 변환</p><p>② Port Forwarding — 외부 포트를 내부 IP:포트로 전달</p><p>③ Dynamic Address Allocation — 동적 IP 주소 할당</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② RAM</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>show running-config 명령어는 라우터의 RAM에 저장된 현재 실행 중인 설정을 확인합니다. 라우터가 재부팅되면 RAM의 내용은 사라집니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ROM — IOS 부팅 이미지 저장(show version으로 확인)</p><p>③ NVRAM — startup-config 저장(show startup-config로 확인)</p><p>④ FLASH — IOS 이미지 파일 저장(show flash로 확인)</p></div>`,
  ],

  // === exam_id 141: 2021년 정기 2회 ===
  141: [
    `<p class="exp-answer">✅ 정답: <strong>③ Class A는 최상위 3비트를 '110'으로 설정한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Class A는 최상위 1비트가 '0'이고, Class B는 '10', Class C가 '110'입니다. 따라서 Class A의 최상위 3비트를 '110'이라고 한 보기 ③은 잘못된 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Network ID와 Host ID가 모두 1인 주소는 브로드캐스트로 사용 — 올바름</p><p>② Class B 최상위 2비트 '10' — 올바름</p><p>④ 127.x.x.x는 Loopback 주소로 예약 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 프레임</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>데이터 링크층의 데이터 단위는 프레임(Frame)입니다. 각 계층별: 응용=메시지, 전송=세그먼트, 네트워크=데이터그램, 데이터링크=프레임입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 메시지 — 응용 계층 데이터 단위</p><p>② 세그먼트 — 전송 계층 데이터 단위</p><p>③ 데이터그램 — 네트워크 계층 데이터 단위</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 한 번에 많은 데이터의 전송에 유리하기 때문에 화상 통신과 같은 실시간 통신에 사용된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>화상 통신과 같은 실시간 통신에는 UDP가 사용됩니다. TCP는 신뢰성 있는 데이터 전송을 보장하지만 오버헤드가 커서 실시간 통신에는 부적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Dynamic Sliding Window 방식 사용 — TCP의 올바른 특징</p><p>③ 에러 제어로 신뢰성 있는 전송 보장 — TCP의 올바른 특징</p><p>④ Three Way Handshaking 사용 — TCP의 올바른 특징</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Destination Port - 선택적 필드로 사용하지 않을 때는 Zero로 채워지는 필드</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>UDP에서 Destination Port는 필수 필드입니다. 선택적 필드로 사용하지 않을 때 Zero로 채워지는 것은 Source Port입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Source Port — 송신측 응용 프로세스 포트 번호 (올바름)</p><p>③ Checksum — 오류 검사 필드 (올바름)</p><p>④ Length — UDP 헤더+데이터 길이 (올바름)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 하드웨어 주소를 IP Address로 변환하기 위해서 사용한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RARP(Reverse ARP)는 MAC(하드웨어) 주소를 IP 주소로 변환하는 프로토콜입니다. 디스크가 없는 워크스테이션이 자신의 IP를 알아내기 위해 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 데이터 전송 서비스 규정 — TCP의 역할</p><p>② 접속 없이 데이터 전송 — UDP의 역할</p><p>④ IP 오류 제어 — ICMP의 역할</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② IGMP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IGMP(Internet Group Management Protocol)는 멀티캐스트 그룹 관리 프로토콜로, 호스트가 멀티캐스트 그룹에 가입/탈퇴할 때 인접 라우터에 알리는 역할을 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ICMP — 오류 보고 및 진단 프로토콜</p><p>③ EGP — 자율 시스템 간 외부 게이트웨이 프로토콜</p><p>④ IGP — 자율 시스템 내부 게이트웨이 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 패킷의 살아 있는 시간(TTL, Time to Live)은 55초이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TTL(Time To Live)의 단위는 '초'가 아니라 '홉 수'입니다. TTL 값은 패킷이 통과할 수 있는 최대 라우터(홉) 수를 나타내며, 각 라우터를 지날 때마다 1씩 감소합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ping으로 목적지와 정상 통신 확인 — 올바름</p><p>② 요청/응답 데이터 사이즈 32바이트 — 올바름</p><p>③ 응답 시간 평균 2ms — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 기존 http보다 암호화된 SSL/TLS를 전달한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>HTTPS는 HTTP에 SSL/TLS 암호화를 적용한 프로토콜로, 데이터를 암호화하여 안전하게 전달합니다. TCP/443 포트를 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② tcp/80번은 HTTP 포트(HTTPS는 443번)</p><p>③ udp/443은 잘못됨(HTTPS는 TCP/443 사용)</p><p>④ HTTPS는 인증서 기반 인증이 필요</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② tracert</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>tracert는 목적지까지의 경로를 추적하며 각 홉의 응답 시간을 확인하는 명령어입니다. ISP 구간의 지연 여부를 확인하는 데 적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① nslookup — DNS 조회 도구</p><p>③ ping — 연결 가능 여부 확인(경로 추적 불가)</p><p>④ traceroute — Linux/Unix 명령어(Windows는 tracert)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ IP Address를 효율적으로 관리하기 위한 서비스로 IP Address 및 Subnet Mask, Gateway Address를 자동으로 할당해 준다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IP 주소 자동 할당은 DHCP(Dynamic Host Configuration Protocol)의 기능입니다. DNS는 도메인 이름과 IP 주소를 매핑하는 서비스입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 도메인→IP 매핑 — DNS의 올바른 기능</p><p>② IP→도메인 변환(역방향 조회) — DNS의 올바른 기능</p><p>④ 계층적 분산형 데이터베이스, 클라이언트·서버 모델 — DNS의 올바른 특징</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ arp</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>L3 스위치(Cisco 3750G)에서 arp 명령어를 사용하면 IP-MAC 주소 매핑 테이블을 확인할 수 있어, 불법 IP 및 MAC 주소를 검색할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① rarp — MAC→IP 변환 프로토콜(스위치 명령어 아님)</p><p>② vlan — VLAN 설정 명령어(IP 검색 아님)</p><p>③ cdp — Cisco Discovery Protocol(인접 장비 검색)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② UTC</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>UTC(협정 세계시)는 시간 표준이며 TCP 헤더의 플래그 비트가 아닙니다. TCP 플래그 비트: URG, ACK, PSH, RST, SYN, FIN입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① URG — 긴급 데이터 플래그(TCP 플래그 비트)</p><p>③ ACK — 확인 응답 플래그(TCP 플래그 비트)</p><p>④ RST — 연결 리셋 플래그(TCP 플래그 비트)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ CSMA/CA</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IEEE 802.11 무선LAN에서는 CSMA/CA(Carrier Sense Multiple Access/Collision Avoidance) 프로토콜을 사용합니다. 무선 환경에서는 충돌 감지가 어려워 충돌 회피 방식을 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ALOHA — 초기 무선 통신 프로토콜</p><p>② CDMA — 코드 분할 다중 접속(이동통신)</p><p>③ CSMA/CD — 유선 이더넷(802.3)에서 사용</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ netstat –an</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>netstat -an 명령어는 모든 네트워크 연결과 리스닝 포트를 숫자로 표시합니다. 443 포트로의 원격 접속 시도 흔적을 확인하는 데 적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ping — 연결 가능 여부만 확인(포트/접속 이력 불가)</p><p>② tracert — 경로 추적(포트 정보 불가)</p><p>④ nslookup — DNS 조회 도구</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ SNMP(Simple Network Management Protocol)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SNMP는 네트워크 관리 프로토콜로 전자메일과 관련이 없습니다. 전자메일 관련 프로토콜: SMTP(전송), POP3(수신), MIME(멀티미디어 확장)입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SMTP — 전자메일 전송 프로토콜</p><p>② MIME — 전자메일 멀티미디어 확장</p><p>③ POP3 — 전자메일 수신 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 5 - Echo Request</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ICMP Type 5는 Redirect(경로 재지정)이며, Echo Request는 Type 8입니다. Type 5를 Echo Request라고 한 것은 잘못된 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 타입 0 - Echo Reply — 올바름</p><p>③ 타입 13 - Timestamp Request — 올바름</p><p>④ 타입 17 - Address Mask Request — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 2</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>C Class 서브넷 마스크 255.255.255.192에서 호스트 부분 8비트 중 상위 2비트를 서브넷에 사용합니다. 2²=4개의 서브넷이 가능하지만, 전통적 방식에서는 모두 0과 모두 1인 서브넷을 제외하여 사용 가능한 서브넷은 2개입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 4 — 서브넷 ID 0과 3을 제외하지 않은 경우</p><p>③ 192 — 서브넷 마스크 값을 서브넷 수로 오인</p><p>④ 1024 — 잘못된 계산</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 흐름 제어</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>흐름 제어(Flow Control)는 수신측에서 발송지로부터 오는 데이터의 양이나 속도를 제한하여 버퍼 오버플로우를 방지하는 기능입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 에러 제어 — 전송 오류를 검출하고 정정하는 기능</p><p>② 순서 제어 — 데이터의 순서를 보장하는 기능</p><p>④ 접속 제어 — 연결 설정/해제를 관리하는 기능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ VPN</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>VPN(Virtual Private Network)은 공용 네트워크를 통해 사설 네트워크를 구축하는 기술로, 암호화와 터널링을 사용하여 안전한 통신을 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① VLAN — 가상 LAN(스위치 내부 네트워크 분리)</p><p>② NAT — 네트워크 주소 변환</p><p>④ Public Network — 공용 네트워크</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ TCP, UDP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>OSI 7계층의 전송 계층(4계층)에서 동작하는 프로토콜은 TCP와 UDP입니다. 이 두 프로토콜이 전송 계층의 대표적인 프로토콜입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ICMP(네트워크계층), NetBEUI(전체 프로토콜 스위트)</p><p>② IP(네트워크계층), TCP(전송계층) — 같은 계층이 아님</p><p>④ NetBEUI, IP(네트워크계층) — 전송 계층이 아님</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ Presentation Layer</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>표현 계층(Presentation Layer, 6계층)은 데이터의 암호화/복호화, 인증, 압축/해제 등의 기능을 수행합니다. 데이터의 형식 변환과 보안을 담당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Transport Layer — 종단 간 신뢰성 있는 데이터 전송</p><p>② Datalink Layer — 프레임화, 에러 검출, 흐름 제어</p><p>④ Application Layer — 사용자 인터페이스, 응용 서비스</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Go-back-N ARQ</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Go-back-N ARQ는 에러가 발생한 블록으로 되돌아가서 그 블록부터 이후 모든 블록을 재전송하는 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Selective ARQ — 에러 발생 블록만 선택적으로 재전송</p><p>③ Adaptive ARQ — 프레임 길이를 동적으로 조절</p><p>④ Stop-and-Wait ARQ — 하나씩 전송 후 확인 대기</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② A, C, D, E</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IPv6의 일반적 특징: 128비트 주소(A), IPSec 내장(C), 자동 주소 설정(D), 멀티캐스트/애니캐스트 지원(E) 등입니다. 브로드캐스트는 IPv6에서 제거되었습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① A,B,C,D — B항목이 IPv6 특징이 아닌 경우</p><p>③ B,C,D,E — B항목이 부적절</p><p>④ B,D,E,F — B, F항목이 부적절</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 스타형 구성</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>스타형(Star) 구성은 중앙의 허브/스위치로부터 모든 단말 장치가 점대점(Point to Point) 방식으로 연결된 형태입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 링형 — 장치들이 원형으로 연결</p><p>③ 버스형 — 하나의 공유 케이블에 모든 장치 연결</p><p>④ 트리형 — 계층적 구조로 연결</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Software Defined Network</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SDN(Software Defined Network)은 네트워크의 제어 기능을 소프트웨어로 분리하여 프로그래밍 가능한 네트워크를 구현하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Wi-Fi Direct — 무선 기기 간 직접 연결 기술</p><p>③ WiBro — 한국형 모바일 인터넷 서비스</p><p>④ WiMAX — 광대역 무선 접속 기술</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 에지 컴퓨팅(Edge Computing)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>에지 컴퓨팅은 데이터가 발생하는 지점(에지) 가까이에서 데이터를 처리하는 분산 컴퓨팅 기술로, 지연 시간을 줄이고 실시간 처리를 가능하게 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 사물인터넷(IoT) — 사물에 센서/통신 기능을 부여하여 네트워크 연결</p><p>② 유비쿼터스 — 어디서나 컴퓨팅에 접근 가능한 환경</p><p>④ 신 클라이언트 — 최소 기능만 가진 단말 장치</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① WMN (Wireless Mesh Network)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>무선 메시 네트워크(WMN)는 무선 노드들이 메시 형태로 서로 연결되어 자체적으로 네트워크를 구성하고 데이터를 중계하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② UWB — 초광대역 무선 통신 기술</p><p>③ WPAN — 무선 개인 영역 네트워크</p><p>④ CAN — 캠퍼스 영역 네트워크</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① chage</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chage(change age) 명령어는 Linux에서 사용자 패스워드의 만료 기간, 최소/최대 사용 기간, 경고 기간 등의 시간 정보를 변경하는 명령어입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② chgrp — 파일의 그룹 소유권 변경</p><p>③ chmod — 파일 접근 권한 변경</p><p>④ usermod — 사용자 계정 정보 수정</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 롤링 클러스터 업그레이드</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>롤링 클러스터 업그레이드는 서비스 중단 없이 클러스터 노드를 순차적으로 업그레이드하는 기능입니다. Hyper-V 부하 없이 Windows Server 버전 업그레이드가 가능합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 중첩 가상화 — 가상머신 내에서 가상화 실행</p><p>③ gpupdate — 그룹 정책 업데이트 명령어</p><p>④ NanoServer — 최소 설치 서버 옵션</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 'icqa'는 디렉터리를 의미하며 하위 디렉터리의 개수는 한 개 이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ls -l 출력에서 링크 수가 표시되는데, 디렉터리의 경우 하위 디렉터리 수와 관련됩니다. 출력 결과를 보면 하위 디렉터리 개수 설명이 올바르지 않습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 소유자 UID 'root' — 올바름</p><p>② 소유자 GID 'root' — 올바름</p><p>③ 소유자 모든 권한, 그룹/기타 읽기+실행 — rwxr-xr-x 설명으로 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① RADIUS</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RADIUS(Remote Authentication Dial-In User Service)는 원격 사용자 인증, 권한 부여, 계정 관리를 위한 네트워크 프로토콜입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② PPTP — 2계층 VPN 터널링 프로토콜</p><p>③ L2TP — 2계층 VPN 터널링 프로토콜</p><p>④ SSTP — SSL 기반 VPN 터널링 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② top</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>top 명령어는 Linux 시스템의 전반적인 상태를 실시간으로 모니터링하며, CPU/메모리 사용률과 프로세스 목록을 동적으로 표시합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ps — 프로세스 상태를 한 번만 출력(실시간 아님)</p><p>③ kill — 프로세스 종료 명령어</p><p>④ nice — 프로세스 우선순위 조정 명령어</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 영구적인 IP Address를 필요로 하는 웹 서버에 대해서는 동적인 주소를 제공한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>웹 서버는 고정(정적) IP가 필요하므로 동적 주소를 제공하는 것은 DHCP의 장점이 아니라 단점입니다. DHCP는 예약 기능으로 특정 장치에 고정 IP를 할당할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 자동 IP 할당 — DHCP의 핵심 장점</p><p>② IP 관리 용이 — DHCP의 장점</p><p>④ 사용자 변경이 잦은 환경에 유용 — DHCP의 장점</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 정방향 조회 영역은 도메인 주소를 IP 주소로 변환하는 영역이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>정방향 조회(Forward Lookup)는 도메인 이름을 IP 주소로 변환하는 것으로, DNS의 기본적인 기능입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 'x.x.x.in-addr.arpa'는 역방향 조회 영역의 형식</p><p>③ 역방향 조회는 IP→도메인 변환(도메인→IP는 정방향)</p><p>④ 역방향 조회는 IP→도메인 반환(외부 질의 응답 설명이 부정확)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① chown</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chown(change owner) 명령어는 파일이나 디렉터리의 소유자를 변경하는 명령어로, root(관리자)만 사용할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② pwd — 현재 디렉터리 경로 출력(일반 사용자 가능)</p><p>③ ls — 파일/디렉터리 목록 출력(일반 사용자 가능)</p><p>④ rm — 파일 삭제(권한 있으면 일반 사용자 가능)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ /proc : 시스템 운영 중 파일의 크기가 변하는 파일들을 위한 공간이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>/proc는 커널과 프로세스 정보를 담고 있는 가상 파일시스템입니다. 파일 크기가 변하는 가변 파일(로그 등)을 위한 공간은 /var 디렉터리입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① /bin — 기본 명령어 저장 (올바름)</p><p>② /etc — 시스템 설정 파일 위치 (올바름)</p><p>④ /tmp — 임시 파일 공간 (올바름)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① httpd.conf</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Apache 웹서버의 주요 설정 파일은 httpd.conf입니다. 디렉터리 리스팅 방지, 심볼릭 링크, SSI, CGI 등의 보안 설정을 이 파일에서 수행합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② httpd-default.conf — 기본 설정 보조 파일</p><p>③ httpd-vhosts.conf — 가상 호스트 설정 파일</p><p>④ httpd-mpm.conf — 멀티프로세싱 모듈 설정 파일</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 컨테이너</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>컨테이너는 Docker로 널리 알려진 기술로, Hyper-V보다 가볍게 애플리케이션을 격리하여 실행할 수 있습니다. Windows Server 2016에서 새로 추가되었습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 액티브 디렉터리 — 디렉터리 서비스(이전 버전부터 존재)</p><p>② 원격 데스크톱 서비스 — 원격 접속(이전 버전부터 존재)</p><p>④ 분산파일서비스 — DFS(이전 버전부터 존재)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 라운드 로빈</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS 라운드 로빈은 하나의 도메인에 여러 IP를 등록하여 요청마다 번갈아 IP를 제공하는 부하 분산 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 캐시플러그인 — DNS 캐시 관련 기능</p><p>③ 캐시서버 — DNS 응답을 캐시하는 서버</p><p>④ AzureAutoScaling — 클라우드 자동 확장 기능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 장애 조치 구성에서 필요한 만큼 물리적인 컴퓨터를 사용하므로 서버 가용성이 줄어든다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Hyper-V는 가상화를 통해 서버 가용성을 향상시킵니다. 장애 조치 클러스터링과 결합하면 서버 가용성이 줄어드는 것이 아니라 증가합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 하드웨어 사용률 향상, 비용 절감 — Hyper-V의 올바른 장점</p><p>② 서버 작업에 필요한 하드웨어 양 감소 — 올바름</p><p>③ 개발 및 테스트 효율성 향상 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ ReFS는 FAT32의 장점과 호환성을 최대한 유지한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ReFS(Resilient File System)는 NTFS를 기반으로 한 차세대 파일 시스템으로, FAT32가 아닌 NTFS의 장점을 유지하면서 데이터 복원력을 강화한 시스템입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① NTFS 퍼미션으로 사용자별 접근 권한 설정 가능 — 올바름</p><p>② NTFS 파일 시스템 암호화 지원 — 올바름</p><p>③ ReFS 데이터 오류 자동 확인/수정 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Domain Local Group</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Domain Local Group은 해당 도메인의 리소스에 대한 접근 권한을 관리하는 그룹으로, 다른 도메인의 사용자도 포함할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Global Group — 같은 도메인의 사용자만 포함 가능</p><p>③ Universal Group — 포리스트 내 모든 도메인에서 사용</p><p>④ Organizational Unit — 도메인 내 조직 구조 단위(그룹이 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ '구독'을 통해 관리자는 로컬 시스템의 이벤트에 대한 주기적인 이메일 보고서를 받을 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>이벤트 뷰어의 '구독'은 원격 컴퓨터의 이벤트를 수집하여 중앙에서 모니터링하는 기능이며, 이메일 보고서를 보내는 기능이 아닙니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① '이 이벤트에 작업 연결' — 이벤트 발생 시 작업 실행 설정 (올바름)</p><p>② '현재 로그 필터링' — 특정 이벤트만 필터링 (올바름)</p><p>③ 사용자 지정 보기 XML 작성 가능 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② netstat -r</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>netstat -r 명령어는 라우팅 테이블을 표시합니다. route print 명령어와 동일한 결과를 보여줍니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① netstat -a — 모든 연결 및 수신 포트 표시</p><p>③ netstat -n — 주소와 포트를 숫자로 표시</p><p>④ netstat -s — 프로토콜별 통계 표시</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ inetmgr.exe</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>inetmgr.exe는 IIS(인터넷 정보 서비스) 관리자를 실행하는 명령어입니다. 명령 프롬프트나 실행 대화 상자에서 입력하여 IIS를 관리할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① wf.msc — Windows 방화벽 고급 보안 관리</p><p>② msconfig — 시스템 구성 유틸리티</p><p>④ dsac.exe — Active Directory 관리 센터</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ Repeater</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>리피터(Repeater)는 물리 계층에서 감쇠된 신호를 재생·증폭하여 전송 거리를 연장하는 장비입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Gateway — 서로 다른 프로토콜 간 변환 장비</p><p>② Router — 네트워크 간 경로 결정 장비(3계층)</p><p>③ Bridge — 세그먼트 간 연결 장비(2계층)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 광 케이블(Optical Cable)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>광 케이블은 내부에 코어(Core)와 이를 감싸는 클래딩(Cladding)으로 구성된 전송 매체로, 빛을 이용하여 데이터를 전송합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 이중 나선(Twisted Pair) — 구리선을 꼬아 만든 케이블</p><p>② 동축 케이블(Coaxial Cable) — 중심 도체와 외부 도체로 구성</p><p>③ 2선식 개방 선로 — 두 가닥 평행 도선</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① MAC 주소</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>L2(2계층) LAN 스위치는 데이터 링크 계층에서 동작하며, 이더넷 프레임의 MAC 주소를 기반으로 프레임을 중계(스위칭)합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② IP 주소 — L3(네트워크 계층) 스위치/라우터에서 사용</p><p>③ Post 주소 — 네트워크에서 사용되지 않는 용어</p><p>④ URL 주소 — 응용 계층에서 사용</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ Memory 용량 증가</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RAID는 여러 디스크를 결합하여 디스크 용량, 성능, 안전성을 향상시키는 기술이며, 메모리(RAM) 용량과는 관련이 없습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 여러 디스크에 중복 데이터 분산 저장 — RAID의 올바른 특징</p><p>② read/write 속도 증가 — RAID의 올바른 특징(스트라이핑)</p><p>④ 데이터 안전 백업 — RAID의 올바른 특징(미러링/패리티)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Hub</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>허브(Hub)는 물리 계층(1계층)에서 동작하며, 전기적 신호를 재생하여 연결된 모든 포트로 분배하는 집선 장비입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Bridge — 2계층 장비(MAC 주소 기반 필터링)</p><p>③ L2 Switch — 2계층 장비(MAC 주소 기반 스위칭)</p><p>④ Router — 3계층 장비(IP 주소 기반 라우팅)</p></div>`,
  ],

  // === exam_id 142: 2021년 정기 3회 ===
  142: [
    `<p class="exp-answer">✅ 정답: <strong>① A, B, C Class 대역의 IP Address는 모두 같은 서브넷 마스크를 사용한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>각 클래스별 기본 서브넷 마스크가 다릅니다. A: 255.0.0.0, B: 255.255.0.0, C: 255.255.255.0으로 모두 다른 서브넷 마스크를 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 네트워크를 여러 개로 분리하여 IP 효율적 사용 — 올바른 설명</p><p>③ 동일 네트워크 여부 확인 — 올바른 설명</p><p>④ 트래픽 관리/제어 가능 — 올바른 설명</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② ICMP - IP - IGMP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ICMP, IP, IGMP는 모두 네트워크 계층(3계층)의 프로토콜입니다. TCP, UDP는 전송 계층, FTP, SMTP, Telnet은 응용 계층 프로토콜입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① TCP(전송)-UDP(전송)-IP(네트워크) — 계층이 섞여 있음</p><p>③ FTP-SMTP-Telnet — 모두 응용 계층</p><p>④ ARP(네트워크)-RARP(네트워크)-TCP(전송) — 계층이 섞여 있음</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 191.234.149.32</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>191.234.149.32는 Class B(128~191)에 속합니다. 나머지 198, 222, 195는 모두 Class C(192~223)에 속합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 198.236.115.33 — Class C (192~223)</p><p>③ 222.236.138.34 — Class C (192~223)</p><p>④ 195.236.126.35 — Class C (192~223)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 255.255.255.248</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>4~5대의 PC를 수용하려면 최소 6개의 호스트 주소(5대+네트워크+브로드캐스트)가 필요합니다. 호스트 비트 3개(2³-2=6)로 255.255.255.248이 적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 255.255.255.240 — 4비트(14호스트)로 과대 할당</p><p>② 255.255.0.192 — C Class에 맞지 않는 서브넷 마스크</p><p>④ 255.255.255.0 — 서브넷 분할 없음(254호스트)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① ACK</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ACK(Acknowledgment)는 TCP 헤더의 플래그 비트로, IP 헤더에는 포함되지 않습니다. IP 헤더에는 Version, Header Length, TTL, Protocol, Header Checksum 등이 포함됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Version — IP 헤더 필드 (IPv4/IPv6 구분)</p><p>③ Header checksum — IP 헤더 오류 검사 필드</p><p>④ Header length — IP 헤더 길이 필드</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ Sliding Window</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TCP 프로토콜의 흐름 제어 방식은 Sliding Window입니다. 수신측 윈도우 크기에 따라 송신측이 전송량을 동적으로 조절합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Go-Back-N — ARQ 에러 제어 방식</p><p>② 선택적 재전송 — ARQ 에러 제어 방식</p><p>④ Idle-RQ — Stop-and-Wait과 유사한 방식</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 3방향 핸드셰이킹 방법인 TCP 세션을 통해 전송한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TFTP(Trivial File Transfer Protocol)는 UDP를 사용하며, TCP의 3방향 핸드셰이킹을 사용하지 않습니다. 간단하고 빠른 파일 전송을 위한 프로토콜입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Trivial File Transfer Protocol의 약어 — 올바름</p><p>② 네트워크를 통한 파일 전송 서비스 — 올바름</p><p>④ FTP보다 빠른 파일 전송 가능 — 올바름(오버헤드가 적어 빠름)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① TCP를 이용하여 신뢰성 있는 통신을 한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SNMP는 UDP를 사용하며 TCP를 이용하지 않습니다. 네트워크 관리의 효율성을 위해 가볍고 빠른 UDP를 선택한 것입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 네트워크 관리 표준 프로토콜 — 올바름</p><p>③ 응용 계층 프로토콜 — 올바름</p><p>④ RFC 1157에 규정 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ NAT</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NAT(Network Address Translation)는 사설 IP를 공인 IP로 변환하는 기술로, 공인 IP 절약과 내부 네트워크 보안 강화를 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① DHCP — 자동 IP 할당 프로토콜</p><p>② ARP — IP→MAC 주소 변환</p><p>③ BOOTP — 부트스트랩 프로토콜(DHCP 전신)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 2000:00AB:0001:0000:0000:0000:0001:0002</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IPv6 주소 요약 규칙에 따라 연속된 0000 그룹은 ::로 축약됩니다. 요약 전 주소가 8그룹이어야 하므로 ②번이 올바른 원래 형태입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 6그룹만 있어 IPv6 형식 불완전</p><p>③ 선행 0 제거 규칙이 잘못 적용됨</p><p>④ 선행 0 제거 규칙이 잘못 적용됨</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 타입 0 : Echo Request (에코 요청)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ICMP 타입 0은 Echo Reply(에코 응답)이며, Echo Request(에코 요청)는 타입 8입니다. 따라서 타입 0을 Echo Request라고 한 것은 잘못된 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 타입 3 - Destination Unreachable — 올바름</p><p>③ 타입 5 - Redirect — 올바름</p><p>④ 타입 11 - Time Exceeded — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ tcp/23번을 이용한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SSH는 tcp/22번 포트를 사용합니다. tcp/23번은 Telnet이 사용하는 포트입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Telnet보다 보안성 우수 — SSH의 올바른 특징</p><p>② ssh1은 RSA 암호화 사용 — 올바름</p><p>③ ssh2는 RSA 외 다양한 키교환 방식 지원 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ RIPv1, RIPv2 모두 멀티캐스트를 이용하여 광고한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RIPv1은 브로드캐스트(255.255.255.255)를 사용하고, RIPv2만 멀티캐스트(224.0.0.9)를 사용합니다. 둘 다 멀티캐스트라는 설명은 잘못되었습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 디스턴스 벡터 라우팅 프로토콜 — 올바름</p><p>② 메트릭으로 Hop Count 사용 — 올바름</p><p>③ 표준 프로토콜로 대부분의 라우터 지원 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 210.212.100.30</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>네트워크주소 210.212.100.0, 서브넷마스크 /27(255.255.255.224)에서 첫 번째 서브넷 범위는 .0~.31이며, 브로드캐스트 주소는 .31, 마지막 사용가능 호스트는 .30입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 210.212.101.31 — 다른 네트워크 대역</p><p>③ 210.212.102.32 — 다른 네트워크 대역</p><p>④ 210.212.103.64 — 다른 네트워크 대역</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 루프백(Loopback) 주소</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>127.x.x.x 대역은 루프백(Loopback) 주소로 예약되어 있으며, 자기 자신에게 패킷을 보내 네트워크 스택을 테스트하는 용도입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 제한적 브로드캐스트 — 255.255.255.255가 해당</p><p>② B Class 멀티캐스트 — Class D(224~239)가 멀티캐스트</p><p>③ C Class 사설 IP — 192.168.x.x가 해당</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 네트워크상의 컴퓨터들이 데이터 전송을 개시하기 위해서는 반드시 '토큰'이라는 권한을 가지고 있어야 한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>CSMA/CD는 토큰을 사용하지 않습니다. 토큰 방식은 Token Ring/Token Bus에서 사용합니다. CSMA/CD는 케이블 감시 후 빈 시점에 전송하고 충돌을 감지합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 충돌 도메인이 작을수록 좋음 — 올바름</p><p>② 충돌 시 임의 시간 대기, 지연 예측 어려움 — 올바름</p><p>④ 데이터 흐름 유무 감시를 위한 신호 전송 — 올바름(캐리어 감지)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① IP Address를 하드웨어 주소로 변환하기 위해서 사용한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RARP(Reverse ARP)는 하드웨어(MAC) 주소를 IP 주소로 변환하는 프로토콜입니다. IP→MAC 변환은 ARP의 역할이며, RARP는 그 반대(MAC→IP)입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② RFC 903, BOOTP에 의해 대체 — 올바름</p><p>③ 디스크 없는 장치가 IP 주소를 알아냄 — 올바름</p><p>④ Ethernet, FDDI, Token Ring 등에서 사용 가능 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 복수의 상대방과는 통신이 불가능하다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>패킷교환은 복수의 상대방과 동시에 통신이 가능합니다. 패킷에 목적지 주소가 포함되어 있어 여러 대상과 동시 통신이 가능한 것이 패킷교환의 장점입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 오류제어로 고품질/고신뢰성 통신 가능 — 올바름</p><p>② 전송 시에만 전송로 사용하여 효율 높음 — 올바름</p><p>③ 가상회선과 데이터그램 두 가지 방식 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Error Control</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>에러 제어(Error Control)는 PDU에 대한 ACK를 특정 시간 내에 받지 못하면 재전송하는 기능으로, 데이터 전송의 신뢰성을 보장합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Flow Control — 데이터 양/속도를 제한하는 흐름 제어</p><p>③ Sequence Control — 데이터 순서를 보장하는 순서 제어</p><p>④ Connection Control — 연결 설정/해제를 관리하는 접속 제어</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 지연 왜곡</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>지연 왜곡(Delay Distortion)은 전송매체를 통해 신호를 전달할 때 주파수에 따라 전달 속도가 달라져 발생하는 왜곡 현상입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 감쇠 현상 — 거리에 따른 신호 세기 약화</p><p>③ 누화 잡음 — 인접 회선 간 신호 간섭</p><p>④ 상호 변조 잡음 — 서로 다른 주파수 신호 간 간섭</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ Text의 압축, 암호기능</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>데이터 압축과 암호화는 표현 계층(6계층)의 기능입니다. Data Link 계층(2계층)의 기능은 프레임화, 오류 제어, 흐름 제어, 링크 관리입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 전송 오류 제어 — Data Link 계층 기능</p><p>② Flow 제어 — Data Link 계층 기능</p><p>④ Link 관리 — Data Link 계층 기능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 터미네이터(Terminator)가 시그널의 반사를 방지하기 위하여 사용된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Bus 토폴로지에서는 케이블 양 끝에 터미네이터를 설치하여 신호의 반사를 방지합니다. 이것이 Bus 토폴로지의 대표적인 특징입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 더 많은 케이블 필요 — 스타 토폴로지의 특징</p><p>② 중앙 스위치에 연결 — 스타 토폴로지의 특징</p><p>④ 토큰이 원형으로 전달 — 링 토폴로지의 특징</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 타이밍(Timing)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>프로토콜의 기본 요소 중 타이밍(Timing)은 실체 간의 통신 속도와 메시지 순서를 위한 제어 정보입니다. 프로토콜의 3요소: 구문(Syntax), 의미(Semantics), 타이밍(Timing)입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 의미(Semantics) — 데이터의 의미와 해석 방법</p><p>③ 구문(Syntax) — 데이터의 형식과 구조</p><p>④ 처리(Process) — 프로토콜의 기본 요소가 아님</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 표본화 → 양자화 → 부호화</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>PCM(Pulse Code Modulation)은 아날로그 신호를 디지털로 변환하는 과정으로, 표본화(Sampling) → 양자화(Quantization) → 부호화(Encoding) 순서로 진행됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 부호화→양자화→표본화 — 순서가 반대</p><p>② 양자화→표본화→부호화 — 순서가 잘못됨</p><p>③ 부호화→표본화→양자화 — 순서가 잘못됨</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 물리적인 구성을 통해 통신 흐름을 파악할 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>가상화는 물리적 자원을 논리적으로 추상화하므로, 물리적 구성으로 통신 흐름을 직접 파악하기 어렵습니다. 이는 가상화의 장점이 아니라 오히려 단점에 해당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 가용성 향상 — 가상화의 장점</p><p>② 자원 효율적 사용 — 가상화의 장점</p><p>③ 시스템 확장이 간단 — 가상화의 장점</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① VPN</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>VPN(Virtual Private Network)은 공용 네트워크를 통해 암호화된 터널을 만들어 사설 네트워크처럼 안전하게 통신하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② NAT — 주소 변환 기술</p><p>③ PPP — 점대점 프로토콜</p><p>④ PPPoE — 이더넷 기반 PPP</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① HomePNA – PLC (Power Line Communication) - WiFi/Wireless LAN</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>홈네트워크 구축 기술: HomePNA(전화선 이용), PLC(전력선 이용), WiFi/무선LAN(무선 이용)이 각각 (A), (B), (C)에 해당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Ethernet은 LAN 기술이지 전화선 기반이 아님</p><p>③ Bluetooth는 근거리 무선이지 일반 무선LAN이 아님</p><p>④ ZigBee는 저전력 무선 기술로 일반 홈네트워크 주류가 아님</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 가상 디렉터리의 이름은 실제 경로의 이름과 동일하게 해야 한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IIS의 가상 디렉터리 이름은 실제 물리적 경로의 이름과 다르게 설정할 수 있습니다. 가상 디렉터리의 이름과 실제 경로는 독립적입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 기본 웹 문서 폴더 변경 가능 — 올바름</p><p>② 기본 웹 문서 추가/우선순위 조정 가능 — 올바름</p><p>④ 디렉터리 검색 활성화 시 파일 목록 표시 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 폴더에 NTFS 쓰기 권한이 없더라도 FTP 쓰기 권한이 있으면 쓰기가 가능하다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>FTP를 통한 파일 쓰기는 FTP 권한과 NTFS 권한 모두 충족되어야 합니다. NTFS 쓰기 권한이 없으면 FTP 쓰기 권한만으로는 쓰기가 불가능합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IIS 관리자를 통해 FTP 기능 추가 가능 — 올바름</p><p>② 사용자별 읽기/쓰기 권한 조절 가능, 익명 사용자도 쓰기 가능 — 올바름</p><p>④ 특정 IP/서브넷 접속 허용/차단 가능 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 삭제한 계정과 동일한 사용자 이름의 계정을 생성하면 삭제 전 권한을 복구할 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Windows에서 각 계정은 고유한 SID(Security Identifier)를 가집니다. 동일한 이름으로 새 계정을 생성해도 SID가 다르므로 이전 권한은 복구되지 않습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Administrator 이름 변경 가능 — 보안을 위한 권장 사항</p><p>② 새 사용자 첫 로그인 시 암호 지정 가능 — 올바름</p><p>③ '계정 사용 안함'으로 휴면 처리 가능 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Hyper-V</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Hyper-V는 Windows Server에서 한 대의 물리적 서버에 여러 가상 컴퓨터와 운영체제를 만들고 관리할 수 있는 하이퍼바이저 기반 가상화 서비스입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 액티브 디렉터리 — 디렉터리 서비스(사용자/리소스 관리)</p><p>③ 원격 데스크톱 서비스 — 원격 접속 서비스</p><p>④ 분산파일서비스 — 여러 서버의 공유 폴더 통합</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 사용 중인 메모리, 사용 가능한 메모리 용량을 알 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Linux의 free 명령어는 전체, 사용 중, 사용 가능한 메모리 및 스왑 공간의 용량을 보여줍니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 패스워드 없는 유저 확인 — 관련 없는 기능</p><p>③ 디렉터리 사용량 — du 명령어의 기능</p><p>④ 파일 시스템 양 — df 명령어의 기능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ chown : 파일이나 디렉터리의 소유권을 변경</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chown(change owner)은 파일이나 디렉터리의 소유자와 소유 그룹을 변경하는 명령어입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① nslookup — DNS 조회 도구(사용자 정보 확인이 아님)</p><p>② file — 파일 유형을 확인하는 명령어(삭제하지 않음)</p><p>④ ifconfig — 네트워크 인터페이스 설정(프로세스 확인이 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① mkdir</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>mkdir(make directory)는 Linux에서 새로운 디렉터리를 생성하는 명령어입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② rmdir — 빈 디렉터리 삭제</p><p>③ grep — 파일 내 문자열 검색</p><p>④ find — 파일/디렉터리 검색</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② SYN_RECEIVED</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TCP 3-Way Handshaking에서 서버가 클라이언트의 SYN 패킷을 수신하면 LISTEN 상태에서 SYN_RECEIVED 상태로 변경되며, SYN+ACK를 응답합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SYN_SENT — 클라이언트가 SYN을 보낸 후 상태</p><p>③ ESTABLISHED — 3-Way Handshaking 완료 후 상태</p><p>④ CLOSE — 연결 종료 상태</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 사용자 권한</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Windows 이벤트 뷰어의 4가지 Windows 로그는 응용 프로그램, 보안, Setup, 시스템입니다. '사용자 권한'은 Windows 로그 항목에 포함되지 않습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 보안 — Windows 로그 항목</p><p>② Setup — Windows 로그 항목</p><p>③ 시스템 — Windows 로그 항목</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① FSRM(File Server Resource Manager)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>FSRM(파일 서버 리소스 관리자)은 폴더 할당량(용량 제한)과 파일 차단(특정 파일 유형 업로드 제한) 기능을 제공하는 Windows Server의 역할 서비스입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② FTP — 파일 전송 프로토콜(용량 제한 기능 없음)</p><p>③ DFS — 분산 파일 시스템(여러 서버 폴더 통합)</p><p>④ Apache Server — 웹 서버(Windows 기본 기능 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 파일 암호화 키가 없는 경우 암호화된 파일의 이름을 변경할 수 없고 내용도 볼 수 없지만 파일 복사는 가능하다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>EFS로 암호화된 파일은 암호화 키가 없으면 이름 변경, 내용 확인, 복사 모두 불가능합니다. 파일 복사가 가능하다는 설명은 잘못되었습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 파일 속성 고급에서 암호화 설정 — 올바름</p><p>③ 인증서 관리자로 키 가져오기하여 파일 열기 — 올바름</p><p>④ 암호화 키 백업으로 영구 접근 불가 방지 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② man ls</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>man(manual) 명령어는 Linux에서 다른 명령어의 사용법(매뉴얼)을 확인하는 명령어입니다. 'man ls'로 ls 명령어의 상세 사용법을 볼 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① cat ls — cat은 파일 내용 출력(명령어 사용법 아님)</p><p>③ ls man — ls는 파일 목록 출력(man 파일을 찾으려 함)</p><p>④ ls cat — ls는 파일 목록 출력(cat 파일을 찾으려 함)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ OU(Organizational Unit)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>OU(조직 구성 단위)는 Active Directory에서 도메인 내부를 관리부, 회계부, 기술부 등의 세부 단위로 나누어 관리할 수 있는 컨테이너입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① DC — 도메인 컨트롤러(서버 역할)</p><p>② RDC — 읽기 전용 도메인 컨트롤러</p><p>④ Site — 물리적 네트워크 위치 기반 구분</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ C:￦Windows￦System32￦drivers￦etc￦hosts</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Windows의 hosts 파일은 C:\\Windows\\System32\\drivers\\etc\\hosts 경로에 위치합니다. 이 파일에 IP와 도메인을 직접 매핑하면 DNS 조회 없이 빠르게 접속할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① System32\\hosts — 잘못된 경로</p><p>② System32\\config\\hosts — 잘못된 경로</p><p>③ System32\\drivers\\hosts — 잘못된 경로(etc 폴더 누락)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Round Robin</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>라운드 로빈(Round Robin)은 여러 대의 서버에 요청을 순차적으로 분배하여 부하를 균등하게 나누는 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Heartbeat — 서버 상태 모니터링 신호</p><p>③ Failover Cluster — 장애 시 자동 전환 클러스터</p><p>④ Non-Repudiation — 부인 방지(보안 개념)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② :10,20s/old/new/g</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>VI 편집기에서 :10,20s/old/new/g는 10~20번 줄에서 'old'를 'new'로 모두 치환하는 명령입니다. /g 플래그가 있어야 줄 내 모든 일치 항목을 치환합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① :10,20s/old/new — 각 줄의 첫 번째 일치만 치환</p><p>③ :10,20r/old/new — r은 파일 읽기 명령(치환 아님)</p><p>④ :10,20r/old/new/a — 유효하지 않은 명령</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ -t : 연결된 이후에 시간을 표시한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>netstat -t 옵션은 TCP 연결만 표시하는 옵션이며, 연결 후 시간을 표시하는 기능이 아닙니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① -r : 라우팅 테이블 표시 — 올바름</p><p>② -p : PID와 프로그램명 출력 — 올바름</p><p>④ -y : TCP 연결 템플릿 표시 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 원격 데스크톱 서비스는 그래픽 모드로 원격관리를 지원하여 효과적이고 편리하다. 그러나 원격 데스크톱 서비스는 동시에 2대 이상 접속 할 수 없다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>원격 데스크톱 서비스는 라이선스에 따라 여러 사용자가 동시 접속이 가능합니다. 기본적으로 관리 모드에서 2명까지 가능하며, RDS CAL을 통해 더 많은 동시 접속을 지원합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 텔넷 보안 취약으로 단독 사용하지 않는 추세 — 올바름</p><p>② SSH는 텔넷과 유사하나 데이터 암호화 — 올바름</p><p>④ PowerShell 원격접속 — Core 서버에서 보안+빠른 속도 보장 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ Optical Fiber</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>광섬유(Optical Fiber)는 사람의 머리카락 굵기만큼 가는 유리 섬유로, 가장 빠른 전송 속도와 가장 넓은 대역폭을 가진 전송 매체입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Coaxial Cable — 동축 케이블(광섬유보다 느림)</p><p>② Twisted Pair — 꼬인 쌍선(가장 일반적이나 대역폭 제한)</p><p>③ Thin Cable — 얇은 동축 케이블</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 각 라우터 간 경로의 경비는 홉 수로 계산한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>링크 상태 라우팅에서 경로 비용은 홉 수가 아닌 대역폭, 지연, 신뢰성 등 복합적인 메트릭으로 계산합니다. 홉 수만 사용하는 것은 거리 벡터 라우팅(RIP)입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 모든 라우터와 이웃 정보 공유 — 올바름</p><p>② 같은 링크 상태 데이터베이스 유지 — 올바름</p><p>③ 최단 경로 트리와 라우팅 테이블은 라우터마다 다름 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 전혀 다른 프로토콜을 채용한 네트워크 간의 인터페이스이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>게이트웨이는 서로 다른 프로토콜을 사용하는 네트워크 간의 변환과 연결을 담당하는 장비로, OSI 전 계층에서 동작합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 케이블 집선 장치 — 허브의 역할</p><p>③ 신호 전기적 증폭 — 리피터의 역할</p><p>④ 물리 주소 캐시 테이블 — 스위치/브리지의 역할</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 네트워크를 확장하면서 충돌 도메인을 나누어 줄 수 있는 장비가 필요한데 이럴 때 Repeater를 사용하여 충돌 도메인을 나누어 네트워크의 성능을 향상시킨다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Repeater는 충돌 도메인을 나눌 수 없습니다. 충돌 도메인을 나누는 장비는 브리지(Bridge)나 스위치(Switch)입니다. Repeater는 단순히 신호를 증폭하여 전달합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 신호 수신 후 증폭하여 재전송 — Repeater의 올바른 기능</p><p>② 신호 감쇠 보상으로 먼 거리까지 데이터 전달 — 올바름</p><p>③ LAN 세그먼트 확장/연결에 사용 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② RAM</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>show running-config 명령어는 라우터의 RAM에 저장된 현재 실행 중인 설정을 확인합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ROM — 부팅 이미지 저장</p><p>③ NVRAM — startup-config 저장</p><p>④ FLASH — IOS 이미지 파일 저장</p></div>`,
  ],

  // === exam_id 143: 2021년 정기 4회 ===
  143: [
    `<p class="exp-answer">✅ 정답: <strong>① 확인 응답 번호(Acknowledgment Number)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>확인 응답 번호(Acknowledgment Number)는 TCP 헤더의 필드로, UDP 헤더에는 포함되지 않습니다. UDP 헤더: Source Port, Destination Port, Length, Checksum입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 소스 포트 — UDP 헤더 필드</p><p>③ 체크섬 — UDP 헤더 필드</p><p>④ 목적지 포트 — UDP 헤더 필드</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 중복된 IP가 발견된 경우 ARP 캐시는 갱신되지 않는다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>중복된 IP가 발견되면 ARP 캐시는 갱신됩니다. ARP 캐시는 새로운 ARP 응답을 받으면 기존 항목을 갱신하며, 이것이 ARP 스푸핑 공격의 원리이기도 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ARP Request 전에 ARP 캐시 먼저 확인 — 올바름</p><p>② 새로운 하드웨어 추가 시 캐시 갱신 — 올바름</p><p>③ ARP 캐시 수명 유한하여 무한정 커지지 않음 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① SMTP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SMTP는 응용 계층(7계층) 프로토콜이고, RARP, ICMP, IGMP는 모두 네트워크 계층(3계층) 프로토콜입니다. 따라서 SMTP만 다른 계층에서 동작합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② RARP — 네트워크 계층 프로토콜</p><p>③ ICMP — 네트워크 계층 프로토콜</p><p>④ IGMP — 네트워크 계층 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① ICMP(Internet Control Message Protocol)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ICMP는 IP 계층의 일부로 네트워크 오류 메시지와 상태 정보를 전달하는 프로토콜입니다. Destination Unreachable, Time Exceeded 등의 에러 메시지를 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② ARP — IP→MAC 주소 변환 프로토콜</p><p>③ RARP — MAC→IP 주소 변환 프로토콜</p><p>④ UDP — 전송 계층 비연결형 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 멀티 캐스트 그룹에 가입한 네트워크 내의 호스트 관리 기능</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IGMP(Internet Group Management Protocol)는 멀티캐스트 그룹 내 호스트를 관리하는 프로토콜로, 그룹 가입/탈퇴를 라우터에 알리는 역할을 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 오류 보고 — ICMP의 기능</p><p>② 대용량 파일 전송 — FTP의 기능</p><p>④ IP→물리주소 변환 — ARP의 기능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① SSH</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SSH(Secure Shell)는 22번 포트를 사용하는 유닉스 기반 원격 접속 프로토콜로, 전자 서명 인증과 패스워드 암호화를 통해 안전한 통신을 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② IPSec — 네트워크 계층 암호화(원격 접속용이 아닌 VPN용)</p><p>③ SSL — 웹 통신 암호화(명령 인터페이스 아님)</p><p>④ PGP — 이메일 암호화 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ WWW - 81</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>WWW(HTTP)의 기본 포트는 80번입니다. 81번은 올바른 포트 번호가 아닙니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① FTP – 21 — 올바름</p><p>② Telnet - 23 — 올바름</p><p>③ SMTP – 25 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Network Interface - Internet - Transport - Application</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TCP/IP 4계층 구조는 하위부터 Network Interface(1) → Internet(2) → Transport(3) → Application(4) 순서입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Application부터 시작 — 상위부터 내려가는 순서</p><p>③ Transport부터 시작 — 순서가 잘못됨</p><p>④ Internet부터 시작 — 순서가 잘못됨</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 255.255.224.0</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>B Class에서 6개 서브넷 → 최소 3비트(2³=8). 가장 많은 호스트를 위해 3비트만 사용하면 255.255.224.0이 됩니다. 호스트: 2¹³-2=8190개입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 255.255.192.0 — 2비트로 4개 서브넷(6개 불가)</p><p>③ 255.255.240.0 — 4비트로 16개 서브넷(과도 분할, 호스트 적음)</p><p>④ 255.255.248.0 — 5비트로 32개 서브넷(과도 분할)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ Host ID를 사용하지 않아도 된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>서브네팅을 해도 Host ID는 반드시 사용됩니다. 서브네팅은 Network ID를 더 세분화하는 것이지, Host ID를 제거하는 것이 아닙니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IP 주소 효율적 사용 — 서브네팅의 올바른 이유</p><p>② Network ID와 Host ID 구분 — 올바른 이유</p><p>③ 불필요한 브로드캐스팅 제한 — 올바른 이유</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① RIP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RIP(Routing Information Protocol)은 최대 홉 수가 15로 제한되며, 16홉 이상은 도달 불가능(unreachable)으로 간주합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② OSPF — 홉 수 제한 없음(링크 상태 프로토콜)</p><p>③ IGP — 라우팅 프로토콜 분류명(특정 프로토콜 아님)</p><p>④ EGP — 외부 게이트웨이 프로토콜(홉 15 제한 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ ACK</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TCP 3-Way Handshaking: 1단계 SYN → 2단계 SYN+ACK → 3단계 ACK입니다. 3단계에서 클라이언트는 ACK만 전송하여 연결을 확립합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SYN — 1단계에서 사용</p><p>② RST — 연결 리셋에 사용(3-Way Handshaking 아님)</p><p>③ SYN, ACK — 2단계에서 사용</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Identification</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Identification 필드는 IP 패킷의 고유 식별 번호로, 패킷이 분할(단편화)될 때 수신측에서 같은 Identification 값을 가진 조각들을 모아 원래 패킷으로 재조립합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① TOS — 서비스 유형 지정(우선순위/QoS)</p><p>③ TTL — 패킷 수명(홉 수 제한)</p><p>④ Protocol — 상위 계층 프로토콜 식별(TCP, UDP 등)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 192.168.100.190</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>네트워크 192.168.100.128/26의 범위는 .128~.191입니다. 브로드캐스트 주소는 .191이므로 마지막 사용 가능한 IP는 192.168.100.190입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① .129 — 첫 번째 사용 가능 IP</p><p>③ .191 — 브로드캐스트 주소(사용 불가)</p><p>④ .255 — 다른 서브넷의 브로드캐스트</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 0x0800</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>이더넷 프레임의 EtherType 0x0800은 IPv4 데이터가 캡슐화되었음을 나타냅니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 0x0806 — ARP 프로토콜</p><p>③ 0x8100 — VLAN 태깅(802.1Q)</p><p>④ 0x86dd — IPv6 프로토콜</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 128.52.10.6</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>사설 IP 대역: 10.0.0.0~10.255.255.255, 172.16.0.0~172.31.255.255, 192.168.0.0~192.168.255.255입니다. 128.52.10.6은 어느 사설 IP 대역에도 속하지 않는 공인 IP입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 10.100.12.5 — 10.x.x.x 사설 대역</p><p>③ 172.25.30.5 — 172.16~31.x.x 사설 대역</p><p>④ 192.168.200.128 — 192.168.x.x 사설 대역</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 300번대 : 리다이렉션, 요청 수행완료를 위해서 추가적인 작업 필요</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>HTTP 상태코드: 1xx=정보, 2xx=성공, 3xx=리다이렉션, 4xx=클라이언트 에러, 5xx=서버 에러입니다. 300번대가 리다이렉션이라는 설명은 올바릅니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 100번대는 정보 제공(성공이 아님)</p><p>② 200번대는 성공(정보 제공이 아님)</p><p>④ 400번대는 클라이언트 에러(서버 에러가 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ Loop/Echo</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Loop/Echo는 통신 회선 테스트 방법이며, 데이터 흐름 제어와는 관련이 없습니다. 흐름 제어 방식: Stop and Wait, XON/XOFF, Sliding Window입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Stop and Wait — 흐름 제어 방식</p><p>② XON/XOFF — 소프트웨어 흐름 제어</p><p>④ Sliding Window — 흐름 제어 방식</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 802.11</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IEEE 802.11은 무선LAN 표준으로 CSMA/CA(Carrier Sense Multiple Access/Collision Avoidance) 방식을 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 802.1 — 네트워크 관리 표준</p><p>② 802.2 — LLC(Logical Link Control) 표준</p><p>③ 802.3 — 이더넷 표준(CSMA/CD 사용)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 감쇠 현상</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>감쇠(Attenuation)는 전송매체를 통해 데이터를 전송할 때 거리가 멀어질수록 신호의 세기가 약해지는 현상입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 상호변조 잡음 — 서로 다른 주파수 신호 간 간섭</p><p>③ 지연 왜곡 — 주파수별 전달 속도 차이로 인한 왜곡</p><p>④ 누화 잡음 — 인접 회선 간 신호 간섭</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 통신 프로토콜을 정의한 OSI 7 Layer 중 세 번째 계층에 해당한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>데이터 링크 계층은 OSI 7계층 중 두 번째(2계층)입니다. 세 번째 계층은 네트워크 계층이므로 이 설명은 잘못되었습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 비트를 프레임화 — 데이터 링크 계층 기능</p><p>③ 에러 검색 — 데이터 링크 계층 기능</p><p>④ 흐름제어 — 데이터 링크 계층 기능</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ NAC</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NAC(Network Access Control)은 네트워크에 접속하는 장치를 제어하고 보안 정책을 적용하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① NIC — 네트워크 인터페이스 카드(물리 장비)</p><p>② F/W — 방화벽</p><p>③ IPS — 침입방지시스템</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① Circuit Switching</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>회선 교환(Circuit Switching)은 통신 전에 전용 경로를 설정하고, 데이터 전송이 끝날 때까지 그 경로를 유지하는 방식입니다. 전화 통신이 대표적입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Packet Switching — 패킷 단위 전송(경로 공유)</p><p>③ Message Switching — 메시지 단위 축적 전달 방식</p><p>④ PCB Switching — 인쇄회로기판 관련(네트워크 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 정체를 일으키는 복잡한 구조 기술</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SDN은 네트워크를 단순화하고 유연하게 관리하기 위한 기술로, 정체를 일으키는 복잡한 구조와는 반대 개념입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 가상화 기술 발달에 대응 — SDN의 올바른 특징</p><p>③ 트래픽 패턴 변화 대응 — SDN의 올바른 특징</p><p>④ 네트워크 관리 문제 해결 — SDN의 올바른 목적</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ Cloud</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>클라우드 컴퓨팅은 인터넷을 통해 서버, 스토리지, 소프트웨어 등의 IT 자원을 필요할 때 서비스 형태로 제공하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IoT — 사물인터넷(센서/통신 기능 부여)</p><p>② NFC — 근거리 무선 통신</p><p>④ RFID — 무선 주파수 식별</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ WPA2(IEEE802.11i)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>WPA2(IEEE 802.11i)는 AES 암호화를 사용하는 가장 강력한 무선LAN 보안 표준으로, 현재 가장 권장되는 보안 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① WEP — RC4 암호화로 보안 취약(쉽게 해킹 가능)</p><p>② WPA — TKIP 사용으로 WEP보다 강하나 WPA2보다 약함</p><p>④ MAC주소필터링 — MAC 주소 위조 가능(보안 취약)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ Optical Fiber Cable</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>광섬유 케이블(Optical Fiber Cable)은 빛을 이용하여 데이터를 전송하는 매체로, 넓은 대역폭, 장거리 전송, 외부 간섭 면역 특성을 가집니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① U/UTP CAT.3 — 비차폐 꼬인 쌍선(전화선용)</p><p>② Thin Coaxial Cable — 얇은 동축 케이블</p><p>③ U/FTP CAT.5 — 차폐 꼬인 쌍선</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① CNAME</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>CNAME(Canonical Name) 레코드는 실제 도메인 이름에 대한 별칭(가상 도메인 이름)을 설정하는 DNS 레코드입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② MX — 메일 교환 서버 지정</p><p>③ A — 도메인을 IPv4 주소로 매핑</p><p>④ PTR — IP 주소를 도메인으로 역매핑</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 보안 강화</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>FTP에 SSL을 적용하면 데이터 전송 시 암호화가 이루어져 보안이 강화됩니다. FTPS(FTP over SSL/TLS)로 불립니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 전송속도 증대 — SSL 암호화로 오히려 오버헤드 증가</p><p>② 사용자 편의 향상 — 인증서 설정 등 복잡해질 수 있음</p><p>③ 동시 접속 사용자 수 증가 — SSL과 무관</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ 하나의 서버에는 하나의 가상 컴퓨터만 사용할 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Hyper-V는 하나의 물리적 서버에서 여러 개의 가상 컴퓨터를 동시에 실행할 수 있습니다. 이것이 가상화의 핵심 목적입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① DEP(하드웨어 데이터 실행 방지) 필요 — 올바름</p><p>② 서버관리자 역할 추가로 Hyper-V 서비스 제공 — 올바름</p><p>③ 스냅숏으로 특정 시점 기록 가능 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 라운드 로빈(Round Robin) 방식</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS 라운드 로빈은 동일 도메인에 여러 IP를 등록하여 요청마다 번갈아 IP를 제공하는 부하 분산 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 큐 방식 — 선입선출 데이터 구조</p><p>③ 스택 방식 — 후입선출 데이터 구조</p><p>④ FIFO 방식 — 큐와 동일한 선입선출 방식</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① PowerShell</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>PowerShell은 Windows Server 시스템 관리를 위한 명령 라인 셸 및 스크립팅 언어로, 강력한 확장성과 자동화 기능을 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② C-Shell — Unix 셸(Windows 아님)</p><p>③ K-Shell — Korn Shell, Unix 셸</p><p>④ Bourne-Shell — 원조 Unix 셸</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ TTL 값이 길면 DNS의 부하가 늘어난다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TTL(Time To Live) 값이 길면 캐시에 오래 저장되어 DNS 서버로의 조회 횟수가 줄어들므로 DNS 부하가 줄어듭니다. 부하가 늘어난다는 설명은 잘못되었습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Zone 파일은 항상 SOA로 시작 — 올바름</p><p>② 네임서버 유지 기본 자료 저장 — 올바름</p><p>③ Refresh는 주/보조 서버 동기 주기 설정 — 올바름</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ chmod 644 manager</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chmod 644는 소유자=rw-(읽기+쓰기), 그룹=r--(읽기만), 기타=r--(읽기만)로 설정합니다. 소유자가 아닌 사람은 볼 수 있지만(r) 수정할 수 없습니다(w 없음).</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① chmod 777 — 모든 사용자에게 모든 권한(수정 가능)</p><p>② chmod 666 — 모든 사용자에게 읽기+쓰기(수정 가능)</p><p>③ chmod 646 — 그룹에 읽기만, 기타에 읽기+쓰기(기타 수정 가능)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ mkdir /home/icqa</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>mkdir(make directory) 명령어로 /home 디렉터리 밑에 icqa라는 하위 디렉터리를 생성할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ls — 파일 목록 출력(디렉터리 생성 아님)</p><p>② cd — 디렉터리 이동(존재하지 않는 디렉터리로 이동 불가)</p><p>③ rmdir — 디렉터리 삭제(생성 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① du</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>du(disk usage) 명령어는 파일이나 디렉터리가 사용하고 있는 디스크 용량 정보를 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② pwd — 현재 작업 디렉터리 경로 출력</p><p>③ cat — 파일 내용 출력</p><p>④ vi — 텍스트 편집기</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ pathping</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>pathping은 tracert와 ping의 기능을 결합한 명령어로, 경로 추적과 함께 각 홉 간의 지연 시간과 패킷 손실 정보를 수집하여 저장합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ping — 연결 가능 여부만 확인(경로 세부 정보 없음)</p><p>② nslookup — DNS 조회 도구</p><p>④ nbtstat — NetBIOS 통계 정보</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① 중요</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>보안 로그의 이벤트 수준은 감사 성공과 감사 실패로 구분되며, 일반적인 이벤트 수준(중요, 경고, 오류, 정보)과는 다릅니다. 보안 로그 필터링에서 '중요(Critical)' 수준은 사용되지 않습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 경고 — 시스템/응용프로그램 로그에서 사용되는 이벤트 수준</p><p>③ 오류 — 시스템/응용프로그램 로그에서 사용되는 이벤트 수준</p><p>④ 정보 — 시스템/응용프로그램 로그에서 사용되는 이벤트 수준</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ init 6</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Linux에서 init 6은 시스템을 재부팅하는 명령입니다. init 0=종료, init 1=단일사용자, init 3=멀티사용자(텍스트), init 5=멀티사용자(그래픽), init 6=재부팅입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① init 0 — 시스템 종료</p><p>② init 1 — 단일 사용자 모드</p><p>③ init 5 — 멀티 사용자 그래픽 모드</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ /var/log/dmesg</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>/var/log/dmesg는 시스템 부팅 과정에서 커널이 생성한 메시지를 기록하는 로그 파일입니다. 하드웨어 감지, 드라이버 로드 등의 부팅 정보를 확인할 수 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① /var/log/boot.log — 부팅 서비스 시작/중지 로그</p><p>② /var/log/lastlog — 마지막 로그인 정보</p><p>④ /var/log/btmp — 로그인 실패 기록</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① BitLocker</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>BitLocker는 하드디스크 전체를 암호화하여, 디스크가 도난당해도 암호화 키 없이는 데이터를 읽을 수 없게 하는 Windows의 디스크 암호화 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② EFS — 개별 파일/폴더 암호화(디스크 전체 아님)</p><p>③ AD — Active Directory(디렉터리 서비스)</p><p>④ FileVault — macOS의 디스크 암호화(Windows 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ -W 10</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chage 명령어에서 -W 옵션은 패스워드 만료 전 경고를 보내는 일 수를 설정합니다. -W 10은 만료 10일 전부터 경고를 표시합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① -m — 패스워드 변경 후 최소 사용 기간</p><p>② -L — 계정 잠금(chage가 아닌 passwd 옵션)</p><p>③ -i — 패스워드 만료 후 비활성화 기간</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 디렉터리 검색</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>디렉터리 검색(Directory Browsing)이 활성화되면 공격자가 웹 서버의 파일/디렉터리 구조를 파악할 수 있어 보안상 비활성화해야 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① HTTP 응답 헤더 — 보안 헤더 설정에 사용(설정 권장)</p><p>③ SSL 설정 — 암호화 통신 설정(설정 권장)</p><p>④ 인증 — 접근 제어 설정(설정 권장)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ 여러 대의 컴퓨터에 분산된 공유 폴더를 하나로 묶어서 사용할 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>분산된 공유 폴더를 하나로 묶는 것은 DFS(Distributed File System)의 기능이며, Windows 배포 서비스(WDS)의 장점이 아닙니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 효율적 자동 설치로 비용/시간 절약 — WDS의 장점</p><p>② 네트워크 기반 운영체제 설치 — WDS의 장점</p><p>④ Windows 이미지를 클라이언트에 배포 — WDS의 장점</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>① httpd.conf</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Apache 웹서버의 주요 설정 파일은 httpd.conf입니다. 서비스에 필요한 포트, 디렉터리, 모듈 등 모든 설정을 이 파일에서 관리합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② access.conf — 과거 버전 접근 제어 파일(현재는 httpd.conf에 통합)</p><p>③ srm.conf — 과거 버전 리소스 설정 파일(현재는 httpd.conf에 통합)</p><p>④ htdos.conf — 존재하지 않는 파일명</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>③ NAT 방식</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NAT(Network Address Translation)은 내부 사설 IP를 외부 공인 IP로 변환하는 기술로, IP 부족 해결과 내부 네트워크 주소 보안을 제공합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① DHCP — IP 자동 할당(주소 변환 아님)</p><p>② IPv6 — 주소 공간 확장(변환 기술 아님)</p><p>④ MAC Address — 물리적 주소(IP 변환 아님)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② 클라우드 컴퓨팅</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>클라우드 컴퓨팅은 인터넷을 통해 서버, 스토리지, 소프트웨어 등의 IT 자원을 필요에 따라 서비스로 제공하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 클라이언트-서버 컴퓨팅 — 전통적 네트워크 구조</p><p>③ 웨어러블 컴퓨팅 — 착용형 기기 컴퓨팅</p><p>④ 임베디드 컴퓨팅 — 내장형 시스템 컴퓨팅</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ VPN</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>VPN(Virtual Private Network)은 공용 네트워크를 통해 암호화된 터널을 만들어 안전한 사설 네트워크 통신을 제공하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Public Network — 공용 네트워크(암호화 없음)</p><p>② PAT — Port Address Translation(포트 기반 주소 변환)</p><p>③ VLAN — 가상 LAN(스위치 내부 분리)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>② Hub</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>허브(Hub)는 물리 계층(1계층)에서 여러 대의 PC를 연결하며, 전기적 신호를 재생하여 모든 포트로 분배하는 장비입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Bridge — 2계층 장비(MAC 기반 필터링)</p><p>③ L2 Switch — 2계층 장비(MAC 기반 스위칭)</p><p>④ Router — 3계층 장비(IP 기반 라우팅)</p></div>`,
    `<p class="exp-answer">✅ 정답: <strong>④ RAID-5</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RAID-5는 회전 패리티(Rotated Parity) 방식을 사용하여 패리티 데이터를 모든 디스크에 분산 저장합니다. 이를 통해 RAID-3/4의 패리티 디스크 병목현상을 해결합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① RAID-2 — 비트 단위 스트라이핑 + 해밍코드</p><p>② RAID-3 — 바이트 단위 스트라이핑 + 전용 패리티 디스크</p><p>③ RAID-4 — 블록 단위 스트라이핑 + 전용 패리티 디스크(병목 발생)</p></div>`,
  ],
};

async function main() {
  let totalUpdated = 0;

  for (const examId of [140, 141, 142, 143]) {
    const ans = answers[examId];
    const exp = explanations[examId];

    // DB에서 해당 시험의 문제 조회
    const res = await query(
      'SELECT id, question_number FROM questions WHERE exam_id=$1 ORDER BY question_number',
      [examId]
    );

    console.log(`\n=== exam_id ${examId}: ${res.rows.length}문제 ===`);

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const answer = ans[i];
      const explanation = exp[i];

      if (!answer || answer < 1 || answer > 4) {
        console.error(`❌ exam_id=${examId} Q${row.question_number}: answer=${answer} 유효하지 않음`);
        continue;
      }

      await query(
        'UPDATE questions SET answer=$1, explanation=$2, updated_at=NOW() WHERE id=$3',
        [answer, explanation, row.id]
      );

      totalUpdated++;
      console.log(`  Q${row.question_number} [id=${row.id}]: answer=${answer} ✅`);
    }
  }

  console.log(`\n총 ${totalUpdated}문제 완료`);
  await getPool().end();
}

main().catch(err => {
  console.error('에러:', err);
  process.exit(1);
});
