// 네트워크관리사2급 2022년 정기 1~4회 (exam_id: 144~147) 정답+해설 DB 업데이트
require('dotenv').config();
const { query, getPool } = require('../api/db');

// 정답 데이터: exam_id -> [q1_answer, q2_answer, ...]
const answers = {
  // === exam_id 144: 2022년 정기 1회 ===
  144: [
    // TCP/IP
    2, // Q1: DNS TTL - 데이터가 DNS서버 캐시로부터 나오기 전에 남은 시간
    3, // Q2: 멀티캐스트 - D Class
    4, // Q3: 255.255.255.224 → /27, 호스트 비트 5개, 2^5-2=30개
    1, // Q4: Link State 알고리즘 - OSPF
    1, // Q5: IP 헤더에 포함되지 않는 필드 - ACK (TCP 필드)
    2, // Q6: IP 패킷 분할 기준 - MTU
    3, // Q7: SNMP 옳지 않은 것 - ③은 ICMP 설명
    2, // Q8: IPv6 주소 표기법 - 8그룹 16진수 콜론 구분
    1, // Q9: Well-Known Port 옳지 않은 것 - 23번은 Telnet, FTP는 21번
    4, // Q10: <표> IP→MAC 변환 프로토콜 - ARP
    1, // Q11: TCP 정상 종료 플래그 - FIN
    1, // Q12: ICMP 옳지 않은 것 - 타입0은 Echo Reply, Echo Request는 타입8
    1, // Q13: SSH 특징 - Port 22번 사용
    1, // Q14: <표> DNS 레코드 - 호스트명→IP 매핑은 A 레코드
    3, // Q15: <표> 보안 터널링 기술 - VPN
    1, // Q16: <표> 네트워크 관리 프로토콜 - SNMP
    1, // Q17: 192.168.100.128/26 사용가능 IP - 129~190, 첫번째 사용가능 129
    // 네트워크 일반
    3, // Q18: Data Link 계층 기능 아닌 것 - 압축/암호는 표현계층
    3, // Q19: 자동 재전송(ARQ) 아닌 것 - FEC는 전진에러수정(재전송 아님)
    3, // Q20: 패킷교환망 옳지 않은 것 - 데이터 많아질수록 느려짐(혼잡)
    2, // Q21: 중앙 제어점에서 P2P 연결 - 스타형 구성
    3, // Q22: <표> 충돌 감지 후 재전송 - CSMA/CD
    1, // Q23: 전기신호 크기 약해지는 현상 - 감쇠(Attenuation)
    4, // Q24: 100BASE-T, 100Mbps - Fast Ethernet
    3, // Q25: <표> 침입탐지시스템 - IDS
    4, // Q26: <표> 광대역융합망 - BcN(Broadband convergence Network)
    2, // Q27: 네트워크 계층 데이터 단위 - 패킷
    // NOS
    1, // Q28: Windows Server 파일/프린터 서버 프로토콜 - TCP/IP
    1, // Q29: IIS 서비스 - HTTP, FTP
    2, // Q30: DNS 확인 명령어 - nslookup
    3, // Q31: 역방향조회 레코드 - PTR
    4, // Q32: Linux /usr - 사용자 계정 위치는 /home, /usr은 프로그램 설치 디렉터리
    4, // Q33: 데몬 옳지 않은 것 - 부팅 때만 시작 가능(X), 런타임에도 시작 가능
    4, // Q34: Linux 멀티 부팅 로더 - GRUB
    3, // Q35: Hyper-V 비슷하지만 가볍게, 도커 - 컨테이너
    4, // Q36: hosts 파일 위치 - C:\Windows\System32\drivers\etc\hosts
    1, // Q37: 도난 시 암호화 데이터 보호 - BitLocker
    3, // Q38: 사용자 계정 관리 그룹 - Power Users
    2, // Q39: 아파치 에러 코드 - 501 Not Implemented 맞음
    4, // Q40: Hyper-V 장점 아닌 것 - 저사양 묶어 고성능(X)
    3, // Q41: 리눅스 종료 아닌 것 - init 6은 재부팅
    2, // Q42: 파일 속성 확인 - stat
    2, // Q43: 터미널 종료해도 작업 유지 - nohup
    1, // Q44: DNS yum bind 설치 안됨, ping 확인 - resolv.conf (DNS 서버 설정)
    2, // Q45: NTFS 권한 설명 잘못된 것 - ② 디렉터리 이름 볼 수 없다(X, 볼 수 있음)
    // 네트워크 운용기기
    2, // Q46: MAC Address - 48비트
    1, // Q47: 물리 계층 장비, 신호 증폭/중계 - Repeater
    1, // Q48: 게이트웨이 역할 - 다른 프로토콜 네트워크 간 인터페이스
    2, // Q49: 물리적 LAN을 논리적으로 분리 - VLAN
    2, // Q50: Fiber Optics - 신호 손실 적고 전자기 간섭 없음
  ],

  // === exam_id 145: 2022년 정기 2회 ===
  145: [
    // TCP/IP
    3, // Q1: IPv4 IP Address 옳지 않은 것 - Class A는 최상위 1비트 '0', '110'은 Class C
    2, // Q2: 255.255.255.240 → /28, 호스트 비트 4개, 2^4-2=14개
    1, // Q3: 최대 홉 15 - RIP
    3, // Q4: TCP 흐름제어 - Sliding Window
    2, // Q5: IPv6 혼잡 시 데이터그램 버릴 때 참조 - Priority
    3, // Q6: ARP 설명 올바른 것 - ARP 캐시는 일정 주기로 갱신
    1, // Q7: ICMP Message Type 옳지 않은 것 - 타입3은 Destination Unreachable, Echo Reply 응답은 타입0
    1, // Q8: Well-Known Port 옳지 않은 것 - 23번은 Telnet, FTP는 21번
    3, // Q9: TFTP 옳지 않은 것 - TCP가 아닌 UDP 사용
    4, // Q10: SMTP - 인터넷 전자 우편 프로토콜
    3, // Q11: UDP 헤더에 속하지 않는 것 - Window (TCP 헤더 필드)
    3, // Q12: IP 헤더 옳지 않은 필드 - Port Number (전송 계층)
    4, // Q13: <표> MAC→IP 변환 - Reverse ARP (RARP)
    3, // Q14: TCP와 UDP 모두 사용 - DNS
    1, // Q15: 3Way-Handshake 연결 성립 - SYN – ACK
    3, // Q16: SNMP 기능 - 네트워크 장비의 관리 및 감시
    4, // Q17: 멀티캐스트 IP Class - D Class
    // 네트워크 일반
    3, // Q18: 전송 계층 프로토콜 - TCP, UDP
    3, // Q19: IEEE 802 올바른 연결 - 802.11: 무선 LAN
    1, // Q20: <표> IoT - Internet of Things
    3, // Q21: <표> 클라우드 컴퓨팅
    2, // Q22: 세션계층 역할 아닌 것 - 에러 제어 (전송/데이터링크 계층)
    3, // Q23: <표> VPN 관련 - IPSec
    1, // Q24: 센서 노드 데이터 수집 노드 - Sink
    3, // Q25: <표> 무선 태그/리더기 - RFID
    3, // Q26: <표> AMI (Advanced Metering Infrastructure)
    2, // Q27: <표> 네트워크 스토리지 - NAS
    // NOS
    1, // Q28: 클라이언트 부팅 시 IP 자동 할당 - DHCP 서버
    3, // Q29: 명령어를 Kernel에 전달 - Shell
    1, // Q30: 패스워드 만료기간 변경 - chage
    4, // Q31: SOA TTL 값 길면 DNS 부하 늘어남(X) - TTL 길면 캐시 오래 유지되어 부하 줄어듦
    4, // Q32: -rwxr-x--x → 그룹은 r-x(읽기+실행), ④ 실행 권한만(X)
    1, // Q33: 시스템 설정 파일 디렉터리 - /etc
    1, // Q34: root만 사용 가능 명령 - chown
    4, // Q35: 프로세스 명령어 옳지 않은 것 - top은 실시간 프로세스 모니터링, 우선순위 높은 프로세스만 보여주는 게 아님
    1, // Q36: 폴더 용량 제한, 파일 유형 제한 - FSRM
    4, // Q37: 도메인 사용자 계정 관리 - net user (도메인 컨트롤러에서)
    1, // Q38: <표> 네트워크 스토리지 - NAS
    1, // Q39: 여러 웹서버 교대로 서비스 - Round Robin
    2, // Q40: 시스템 종료 원인 확인 - 이벤트뷰어
    2, // Q41: <표> Linux↔Windows 파일 공유 - 삼바(SAMBA)
    2, // Q42: FTP 서버 포트 대역 설정, 서버가 요청 - Passive Mode
    2, // Q43: DNS 캐시 삭제 - ipconfig /flushdns
    3, // Q44: 4TB HDD 파티션 형식 - GPT (MBR은 2TB 제한)
    3, // Q45: 출발지→목적지 경로 추적 - pathping
    // 네트워크 운용기기
    2, // Q46: 물리 계층 신호 증폭/중계 - Repeater
    2, // Q47: 로드밸런싱 - 부하분산 최적화 기술
    4, // Q48: OSPF 옳지 않은 것 - 관리자 허가 없이 쉽게 접속/확장(X), 인증으로 보안 강화
    4, // Q49: <표> 컨테이너 기술 - Docker
    4, // Q50: 유리 섬유 전송 매체 - Optical Fiber
  ],

  // === exam_id 146: 2022년 정기 3회 ===
  146: [
    // TCP/IP
    1, // Q1: TTL 옳지 않은 것 - IP 패킷이 영원히 존재(X)
    4, // Q2: 11101011 → 첫 4비트 1110 = D Class (224~239)
    3, // Q3: C Class 6개 서브넷 → 3비트 필요(2^3=8≥6), 255.255.255.224
    4, // Q4: IPv6 데이터그램 생존 기간 - Hop Limit
    1, // Q5: IPv6 특징 옳지 않은 것 - 64비트(X), 128비트
    2, // Q6: NAT 옳지 않은 것 - C Class만 사용해야(X), A/B/C 모두 가능
    3, // Q7: UDP 옳지 않은 것 - Dynamic Sliding Window는 TCP 방식
    1, // Q8: 같은 계층에서 동작하지 않는 것 - SMTP(응용계층), RARP/ICMP/IGMP(네트워크계층)
    2, // Q9: 모든 호스트에게 전송 - Broadcast
    1, // Q10: 네트워크 장비 관리 감시 - SNMP
    4, // Q11: 127.0.0.1 - 루프 백 테스트용
    1, // Q12: MAC→IP 변환 - RARP
    3, // Q13: 201.100.5.68/28 → 서브넷 64(64~79), Network ID=201.100.5.64
    3, // Q14: ICMP 옳지 않은 것 - IP 중복 확인은 ICMP 아닌 ARP로 감지
    2, // Q15: TCP 사용하지 않는 것 - TFTP (UDP 사용)
    1, // Q16: 헤더/트레일러 부가 - 캡슐화(Encapsulation)
    2, // Q17: IGMP 옳지 않은 것 - 유니캐스팅(X), 멀티캐스팅 프로토콜
    // 네트워크 일반
    4, // Q18: 클라우드 서비스 분류 아닌 것 - Public 클라우드(배포 모델, 서비스 분류 아님)
    1, // Q19: <표> NFV (네트워크 기능 가상화)
    4, // Q20: <표> 광케이블 - Optical Fiber Cable
    1, // Q21: 프레임 길이 동적 변경 ARQ - Adaptive ARQ
    4, // Q22: <표> 네트워크 접근 제어 - NAC
    3, // Q23: Bus Topology - 터미네이터가 신호 반사 방지
    4, // Q24: 데이터링크 계층 설명 - 데이터링크 계층
    4, // Q25: <표> 화상 회의 세션 제어 - SIP (Session Initiation Protocol)
    3, // Q26: 패킷교환망 옳지 않은 것 - 데이터 많아질수록 느려짐(혼잡)
    1, // Q27: 데이터 없어도 타임 슬롯 할당 낭비 - TDM
    // NOS
    2, // Q28: <표> 공격 대응, 설정하지 않아야 하는 것 - 디렉터리 검색 (보안상 비활성화)
    4, // Q29: Hyper-V 옳지 않은 것 - 서버 가용성 줄어든다(X), 향상된다
    4, // Q30: 패스워드 경고 10일전 - chage -W 10
    3, // Q31: 부팅 시 시스템 로그 - /var/log/dmesg
    3, // Q32: 네임서버 옳지 않은 것 - MX 값 높을수록 우선순위 높다(X), 낮을수록 높다
    3, // Q33: netstat 옳지 않은 것 - -t는 TCP 연결 표시, 시간 표시 아님
    1, // Q34: 원래 권한 유지 + 쓰기 추가 → 결과 다른 것 - chmod 666은 절대 모드로 덮어쓰기
    3, // Q35: BitLocker 사용 조건 - TPM (Trusted Platform Module)
    3, // Q36: DHCP 서버 역할 - IP 자원 효율적 관리 및 자동 할당
    2, // Q37: 3Way-Handshake 서버 상태 - SYN_RECEIVED
    2, // Q38: 감사 이벤트 로그 - 보안 로그
    1, // Q39: 사용자 등록 그룹 지정 - useradd -g icqa network
    3, // Q40: FTP 구축 전 필요한 서버 - IIS (Internet Information Services)
    2, // Q41: Windows 서버 백업 - wbadmin.msc
    2, // Q42: vi 문자 하나 삭제 - x
    4, // Q43: HOME 디렉터리로 이동 - cd ~
    1, // Q44: 사용자 암호 정보 디렉터리 - /etc
    2, // Q45: ifconfig NIC 동작 - ifconfig eth0 192.168.2.4 up
    // 네트워크 운용기기
    4, // Q46: 물리계층 장치 - Repeater
    2, // Q47: 스위치에서 논리적 분리 - 가상 랜(VLAN)
    2, // Q48: RAID 미러링 - RAID 1
    4, // Q49: Distance Vector 아닌 것 - OSPF (Link State)
    1, // Q50: 게이트웨이 옳지 않은 것 - 전송계층만 연결(X), 모든 계층 연결
  ],

  // === exam_id 147: 2022년 정기 4회 ===
  147: [
    // TCP/IP
    3, // Q1: UDP 세션 네트워크 관리 - SNMP
    4, // Q2: TCP 옳지 않은 것 - 데이터 손실 치명적이지 않은 프로그램 적합(X), 그건 UDP
    4, // Q3: PDU 명칭 올바른 것 - 2계층: 프레임
    3, // Q4: Link State 라우팅 - OSPF
    2, // Q5: 다른 계층 동작 - SMTP(응용계층), IP/RARP/ARP(네트워크계층)
    3, // Q6: DHCP 부적합 - 교육장용 PC(유동적이므로 적합이 아니라... 네트워크 프린터 고정IP 필요하지만 교육장 PC는 DHCP 적합) → 웹서버/AP/프린터는 고정IP, 교육장PC는 DHCP 적합이므로 부적합한 것은 ④ 네트워크 프린터
    4, // Q6 수정: 네트워크 프린터는 고정 IP 필요하므로 DHCP 부적합
    3, // Q7: <표> 오류 제어, 경로 재지정 - ICMP
    1, // Q8: B Class 6개 서브넷 → 3비트(2^3=8≥6), 255.255.224.0
    2, // Q9: Unicast - 한 호스트에서 다른 한 호스트로 전송
    2, // Q10: TCP 에러 제어 필드 - Checksum
    2, // Q11: IP 프로토콜 올바른 것 - 네트워크계층, 패킷 전달 역할
    4, // Q12: 서브넷 마스크 옳지 않은 것 - Network ID는 1, Host ID는 0 (④ 반대로 설명)
    4, // Q13: <표> 그룹 관리 프로토콜 - IGMP (④)
    2, // Q14: 사설 IP 올바른 것 - 공인 IP 부족 해결 위해 사용
    1, // Q15: tcpdump -c 20 -w http.cap port 80 (-c: 패킷 수, -w: 파일 저장)
    2, // Q16: <표> 라우팅 테이블 가장 긴 매치 - Longest match rule
    4, // Q17: <표> MAC→IP 변환 - Reverse ARP (RARP)
    4, // Q18: <표> 침입탐지시스템 - IDS
    4, // Q19: <표> 충돌 감지 후 재전송 - CSMA/CD
    3, // Q20: 성형(Star) 옳지 않은 것 - 단말 고장 시 전체 영향(X), 해당 단말만 영향
    1, // Q21: 웹 브라우저 SW 제공, 일반 사용자 - SaaS
    1, // Q22: 여러 터미널 하나의 회선 - Multiplexing
    2, // Q23: IPv6 특징 - A,C,D,E
    3, // Q24: 암호/복호, 인증, 압축 - Presentation Layer
    1, // Q25: <표> 근거리 무선 네트워크 - WPAN
    1, // Q26: OSI 참조 모델 올바른 것 - 전송계층은 네트워크계층 서비스 이용, 세션계층에 서비스 제공
    4, // Q27: <표> 소프트웨어 정의 네트워크 - SDN
    // NOS
    4, // Q28: 백업 실행 아닌 것 - diskpart는 디스크 관리
    3, // Q29: AD 그룹 관리 편리성 - Universal Group
    1, // Q30: <표> DNS 라운드 로빈
    3, // Q31: SOA 레코드 옳지 않은 것 - webmaster@icqa.or.kr 형식(X), webmaster.icqa.or.kr 형식
    4, // Q32: 상위 디렉터리 파일→홈 디렉터리 복사 - cp ../abc.txt ~
    2, // Q33: vi 치환 10~20행 모든 old→new - :10,20s/old/new/g
    1, // Q34: 데이터 손실 없이 동기 복제 - 저장소 복제
    3, // Q35: 디렉터리 삭제 - rmdir
    1, // Q36: 부팅 시 자동 마운트 - /etc/fstab
    1, // Q37: PowerShell 옳지 않은 것 - DOS 명령 사용 불가(X), 호환됨
    2, // Q38: 역방향 조회 레코드 - Pointer(PTR)
    3, // Q39: 현재 디렉터리 절대경로 - pwd
    2, // Q40: Windows Server 기본 그룹 아닌 것 - Power Users (Server 2016에서 제거/호환용)
    3, // Q41: 기본 명령어 디렉터리 - /bin
    4, // Q42: crontab 삭제 - crontab -r
    4, // Q43: DNS 질의 명령 - nslookup icqa.or.kr
    2, // Q44: <표> Linux↔Windows 파일 공유 - 삼바(SAMBA)
    4, // Q45: 유틸리티 옳지 않은 것 - 사용자 삭제는 userdel, delete 아님
    // 네트워크 운용기기
    1, // Q46: Hub - 물리 계층
    2, // Q47: RAID 미러링 - RAID 1
    2, // Q48: 사설IP→공인IP 변환 - NAT
    4, // Q49: <표> 컨테이너 기술 - Docker
    4, // Q50: Repeater 옳지 않은 것 - 충돌 도메인 분리(X), 브리지/스위치 역할
  ],
};

// Q6 147번 수정: answers[147]에 51개 들어감 (Q6에 2개 넣음). 수정 필요
// 147 배열을 재정의
answers[147] = [
  3, // Q1: SNMP
  4, // Q2: TCP 옳지 않은 것 - ④
  4, // Q3: 2계층: 프레임
  3, // Q4: OSPF
  2, // Q5: SMTP(응용계층)
  4, // Q6: 네트워크 프린터 - DHCP 부적합
  3, // Q7: ICMP
  1, // Q8: 255.255.224.0
  2, // Q9: Unicast
  2, // Q10: Checksum
  2, // Q11: IP - 네트워크계층 패킷 전달
  4, // Q12: 서브넷 마스크 설명 반대
  3, // Q13: IGMP (아닌 것 같으면 SNMP지만 멀티캐스트 그룹관리 표준은 IGMP)
  2, // Q14: 사설 IP - 공인 IP 부족 해결
  1, // Q15: tcpdump -c 20 -w
  2, // Q16: Longest match rule
  4, // Q17: Reverse ARP
  4, // Q18: IDS
  4, // Q19: CSMA/CD
  3, // Q20: Star - 단말 고장 시 전체 영향(X)
  1, // Q21: SaaS
  1, // Q22: Multiplexing
  2, // Q23: IPv6 - A,C,D,E
  3, // Q24: Presentation Layer
  1, // Q25: WPAN
  1, // Q26: OSI 전송계층 설명
  4, // Q27: SDN
  4, // Q28: diskpart - 백업 아님
  3, // Q29: Universal Group
  1, // Q30: 라운드 로빈
  3, // Q31: SOA webmaster@ 형식(X)
  4, // Q32: cp ../abc.txt ~
  2, // Q33: :10,20s/old/new/g
  1, // Q34: 저장소 복제
  3, // Q35: rmdir
  1, // Q36: /etc/fstab
  1, // Q37: PowerShell DOS 명령 불가(X)
  2, // Q38: PTR
  3, // Q39: pwd
  2, // Q40: Power Users
  3, // Q41: /bin
  4, // Q42: crontab -r
  4, // Q43: nslookup
  2, // Q44: SAMBA
  4, // Q45: delete(X), userdel
  1, // Q46: Hub - 물리 계층
  2, // Q47: RAID 1
  2, // Q48: NAT
  4, // Q49: Docker
  4, // Q50: Repeater 충돌 도메인 분리(X)
];

// 해설 생성 함수
function generateExplanation(examId, qNum, answer, body, choices) {
  const c = choices;
  const ansIdx = answer - 1;
  const ansText = c[ansIdx];
  const nums = ['①', '②', '③', '④'];

  // 오답 분석 생성
  const wrongAnalysis = c.map((choice, i) => {
    if (i === ansIdx) return null;
    return `<p>${nums[i]} ${choice} — 오답</p>`;
  }).filter(Boolean).join('');

  // 문제별 상세 해설
  const explanations = getDetailedExplanation(examId, qNum, answer, body, c);

  return `<p class="exp-answer">✅ 정답: <strong>${nums[ansIdx]} ${ansText}</strong></p>
<div class="exp-section"><div class="exp-section-title">📖 해설</div>${explanations.main}</div>
<div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div>${explanations.wrong}</div>`;
}

function getDetailedExplanation(examId, qNum, answer, body, c) {
  const nums = ['①', '②', '③', '④'];
  const ansIdx = answer - 1;
  const key = `${examId}_${qNum}`;

  const data = {
    // === exam_id 144 ===
    '144_1': { main: '<p>DNS에서 TTL(Time to Live)은 DNS 서버의 캐시에 저장된 데이터가 유효한 시간을 나타냅니다. TTL 시간이 지나면 캐시에서 해당 레코드가 삭제되고, 다음 질의 시 권한 있는 DNS 서버에 다시 조회합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — DNS 존(Zone)이 아닌 캐시에서의 유효 시간입니다</p><p>${nums[2]} ${c[2]} — TTL은 패킷이 아닌 데이터(레코드)의 캐시 유효 시간입니다</p><p>${nums[3]} ${c[3]} — 네임서버 레코드가 아닌 캐시에서의 유효 시간을 의미합니다</p>` },
    '144_2': { main: '<p>IPv4 주소 클래스에서 D Class(224.0.0.0~239.255.255.255)는 멀티캐스트 통신을 위해 예약된 주소 범위입니다. 특정 그룹의 호스트들에게 동시에 데이터를 전송할 때 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — B Class(128.0.0.0~191.255.255.255)는 유니캐스트용 주소입니다</p><p>${nums[1]} ${c[1]} — C Class(192.0.0.0~223.255.255.255)는 유니캐스트용 주소입니다</p><p>${nums[3]} ${c[3]} — E Class(240.0.0.0~255.255.255.255)는 실험/연구용으로 예약되어 있습니다</p>` },
    '144_3': { main: '<p>서브넷 마스크 255.255.255.224는 /27에 해당하며, 호스트 비트가 5개입니다. 따라서 최대 할당 가능한 호스트 수는 2^5 - 2 = 30개입니다(네트워크 주소와 브로드캐스트 주소 제외).</p>', wrong: `<p>${nums[0]} ${c[0]} — 2개는 /30(255.255.255.252)의 호스트 수입니다</p><p>${nums[1]} ${c[1]} — 6개는 /29(255.255.255.248)의 호스트 수입니다</p><p>${nums[2]} ${c[2]} — 14개는 /28(255.255.255.240)의 호스트 수입니다</p>` },
    '144_4': { main: '<p>OSPF(Open Shortest Path First)는 Link State 라우팅 알고리즘을 사용하는 대표적인 프로토콜입니다. 각 라우터가 자신의 링크 상태 정보를 LSA(Link State Advertisement)로 모든 라우터에게 전파하고, Dijkstra 알고리즘으로 최단 경로를 계산합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — IDRP는 ISO의 도메인 간 라우팅 프로토콜로, Link State 방식이 아닙니다</p><p>${nums[2]} ${c[2]} — EGP는 외부 게이트웨이 프로토콜로 AS 간 라우팅에 사용됩니다</p><p>${nums[3]} ${c[3]} — BGP는 경로 벡터(Path Vector) 알고리즘을 사용하는 외부 게이트웨이 프로토콜입니다</p>` },
    '144_5': { main: '<p>ACK(Acknowledgment)는 TCP 헤더의 플래그 필드에 포함되는 것으로, IP 헤더에는 포함되지 않습니다. IP 헤더에는 Version, Header Length, Header Checksum, TTL, Protocol, Source/Destination IP 등이 포함됩니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — Version은 IP 헤더의 첫 번째 필드로 IPv4/IPv6를 구분합니다</p><p>${nums[2]} ${c[2]} — Header Checksum은 IP 헤더의 무결성을 검증하는 필드입니다</p><p>${nums[3]} ${c[3]} — Header Length(IHL)는 IP 헤더의 길이를 나타내는 필드입니다</p>` },
    '144_6': { main: '<p>MTU(Maximum Transmission Unit)는 네트워크 인터페이스에서 한 번에 전송할 수 있는 최대 데이터 크기입니다. IP 패킷이 MTU보다 크면 단편화(Fragmentation)가 발생하여 작은 조각으로 분할됩니다. Ethernet의 기본 MTU는 1500바이트입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — TOS(Type of Service)는 서비스 품질을 나타내는 IP 헤더 필드로, 분할 기준이 아닙니다</p><p>${nums[2]} ${c[2]} — TTL은 패킷의 생존 시간(홉 수)을 제한하는 필드입니다</p><p>${nums[3]} ${c[3]} — Port Number는 전송 계층에서 사용되며 IP 패킷 분할과 무관합니다</p>` },
    '144_7': { main: '<p>③은 ICMP(Internet Control Message Protocol)에 대한 설명입니다. ICMP는 IP에서의 오류 제어를 위해 사용되며 라우팅 실패를 보고합니다. SNMP(Simple Network Management Protocol)는 네트워크 장비를 관리·감시하기 위한 프로토콜로, UDP를 사용하여 MIB 정보를 수집합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — SNMP는 사전에 네트워크 문제를 감지할 수 있는 관리 도구입니다</p><p>${nums[1]} ${c[1]} — SNMP는 UDP 포트 161, 162를 사용합니다</p><p>${nums[3]} ${c[3]} — SNMP는 네트워크 장비의 데이터를 수집하여 관리를 지원합니다</p>` },
    '144_8': { main: '<p>IPv6 주소는 128비트로 구성되며, 16비트씩 8개 그룹을 콜론(:)으로 구분하여 16진수로 표기합니다. ②의 3ffe:1900:4545:0003:0200:f8ff:ffff:1105가 올바른 IPv6 주소 형식입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 이것은 IPv4 주소 형식(32비트, 점 구분)입니다</p><p>${nums[2]} ${c[2]} — 이것은 MAC 주소 형식(48비트, 콜론 구분)입니다</p><p>${nums[3]} ${c[3]} — IPv6는 8그룹이어야 하나 이것은 5그룹으로 올바른 형식이 아닙니다</p>` },
    '144_9': { main: '<p>포트 23번은 Telnet 프로토콜에 할당되어 있습니다. FTP는 포트 20번(데이터)과 21번(제어)을 사용합니다. 따라서 ①의 "23번 – FTP" 연결이 잘못되었습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 25번은 SMTP(Simple Mail Transfer Protocol)로 올바른 연결입니다</p><p>${nums[2]} ${c[2]} — 80번은 HTTP(WWW)로 올바른 연결입니다</p><p>${nums[3]} ${c[3]} — 110번은 POP3(Post Office Protocol)로 올바른 연결입니다</p>` },
    '144_10': { main: '<p>ARP(Address Resolution Protocol)는 IP 주소를 MAC 주소로 변환하는 프로토콜입니다. 네트워크 통신 시 목적지의 IP 주소는 알지만 MAC 주소를 모를 때 ARP 브로드캐스트를 통해 해당 IP의 MAC 주소를 알아냅니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — DHCP는 IP 주소를 자동으로 할당하는 프로토콜입니다</p><p>${nums[1]} ${c[1]} — IP는 네트워크 계층에서 패킷 라우팅을 담당하는 프로토콜입니다</p><p>${nums[2]} ${c[2]} — RIP는 거리 벡터 라우팅 프로토콜입니다</p>` },
    '144_11': { main: '<p>FIN(Finish) 플래그는 TCP 연결의 정상적인 종료를 의미합니다. 데이터 전송이 완료되면 FIN 플래그가 설정된 세그먼트를 보내 연결 종료를 요청합니다(4-Way Handshake).</p>', wrong: `<p>${nums[1]} ${c[1]} — URG는 긴급 데이터가 있음을 나타내는 플래그입니다</p><p>${nums[2]} ${c[2]} — ACK는 수신 확인을 의미하는 플래그로, 연결 종료가 아닌 확인 응답입니다</p><p>${nums[3]} ${c[3]} — RST는 연결을 강제로 리셋(비정상 종료)하는 플래그입니다</p>` },
    '144_12': { main: '<p>ICMP 타입 0은 Echo Reply(에코 응답)이며, Echo Request(에코 요청)는 타입 8입니다. 따라서 ①의 "타입 0 : Echo Request"는 잘못된 설명입니다. ping 명령은 타입 8(요청)을 보내고 타입 0(응답)을 받습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 타입 3은 Destination Unreachable로 올바른 설명입니다</p><p>${nums[2]} ${c[2]} — 타입 5는 Redirect(경로 재지정)로 올바른 설명입니다</p><p>${nums[3]} ${c[3]} — 타입 11은 Time Exceeded(시간 초과)로 올바른 설명입니다</p>` },
    '144_13': { main: '<p>SSH(Secure Shell)는 포트 22번을 사용하는 보안 원격 접속 프로토콜입니다. 암호화된 통신을 제공하여 Telnet(포트 23)의 보안 취약점을 해결합니다. 응용 계층에서 동작합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — SSH는 전송 계층이 아닌 응용 계층(7계층)에서 동작합니다</p><p>${nums[2]} ${c[2]} — HTTP→HTTPS 전환은 SSL/TLS 인증서 설치로 이루어지며 SSH와 다릅니다</p><p>${nums[3]} ${c[3]} — SSH는 암호화된 방식으로 높은 보안성을 제공합니다</p>` },
    '144_14': { main: '<p>A 레코드(Address Record)는 호스트 이름을 IPv4 주소로 매핑하는 DNS 레코드입니다. 가장 기본적인 DNS 레코드 타입으로, 도메인 이름에 대한 IP 주소를 저장합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — PTR 레코드는 IP 주소를 도메인 이름으로 역방향 매핑하는 레코드입니다</p><p>${nums[2]} ${c[2]} — SOA 레코드는 DNS 영역의 권한 시작 정보를 담는 레코드입니다</p><p>${nums[3]} ${c[3]} — MX 레코드는 메일 서버를 지정하는 레코드입니다</p>` },
    '144_15': { main: '<p>VPN(Virtual Private Network)은 공중망을 통해 사설 네트워크를 안전하게 연결하는 기술입니다. 터널링과 암호화를 통해 데이터의 기밀성과 무결성을 보장하며, 원격 근무자의 안전한 사내 네트워크 접속에 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — SSL은 웹 통신 암호화 프로토콜로, 네트워크 전체를 연결하는 VPN과는 다릅니다</p><p>${nums[1]} ${c[1]} — NAT는 사설 IP와 공인 IP 간의 주소 변환 기술입니다</p><p>${nums[3]} ${c[3]} — IDS는 침입탐지시스템으로 네트워크 보안 모니터링 장비입니다</p>` },
    '144_16': { main: '<p>SNMP(Simple Network Management Protocol)는 TCP/IP 네트워크에서 장비를 관리하고 모니터링하기 위한 프로토콜입니다. 에이전트(장비)와 매니저(관리 서버) 구조로 동작하며 UDP 포트 161, 162를 사용합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — POP3는 이메일을 수신하기 위한 프로토콜입니다</p><p>${nums[2]} ${c[2]} — SMTP는 이메일을 송신하기 위한 프로토콜입니다</p><p>${nums[3]} ${c[3]} — NNTP는 뉴스 그룹 프로토콜입니다</p>` },
    '144_17': { main: '<p>네트워크 주소 192.168.100.128/26에서 서브넷 마스크는 255.255.255.192입니다. 호스트 범위는 192.168.100.129~192.168.100.190이며, 128은 네트워크 주소, 191은 브로드캐스트 주소입니다. 따라서 첫 번째 사용 가능한 IP는 192.168.100.129입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 192.168.100.190은 사용 가능한 마지막 IP 주소이지만, 첫 번째가 아닙니다</p><p>${nums[2]} ${c[2]} — 192.168.100.191은 이 서브넷의 브로드캐스트 주소로 사용 불가합니다</p><p>${nums[3]} ${c[3]} — 192.168.100.255는 다른 서브넷의 주소입니다</p>` },
    '144_18': { main: '<p>데이터 압축과 암호화 기능은 OSI 7계층 중 표현 계층(Presentation Layer, 6계층)의 기능입니다. Data Link 계층(2계층)은 프레임 구성, 오류 제어, 흐름 제어, 링크 관리 등을 담당합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 전송 오류 제어는 Data Link 계층의 핵심 기능입니다</p><p>${nums[1]} ${c[1]} — 흐름 제어(Flow Control)는 Data Link 계층의 기능입니다</p><p>${nums[3]} ${c[3]} — 링크의 관리는 Data Link 계층에서 수행합니다</p>` },
    '144_19': { main: '<p>FEC(Forward Error Correction, 전진 에러 수정)는 재전송 없이 수신측에서 직접 오류를 정정하는 방식입니다. ARQ(Automatic Repeat Request)는 오류 발생 시 재전송을 요청하는 방식으로, Stop-and-Wait, Go-Back-N, Selective Repeat가 해당됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Stop and Wait ARQ는 프레임 하나를 보내고 확인 후 다음을 전송하는 ARQ 방식입니다</p><p>${nums[1]} ${c[1]} — Go-Back N ARQ는 오류 발생 시 해당 프레임부터 재전송하는 ARQ 방식입니다</p><p>${nums[3]} ${c[3]} — Selective Repeat ARQ는 오류 발생한 프레임만 선택적으로 재전송하는 ARQ 방식입니다</p>` },
    '144_20': { main: '<p>패킷 교환망에서 데이터 유입량이 많아지면 네트워크 혼잡(Congestion)이 발생하여 오히려 전송속도가 저하됩니다. 패킷 손실, 지연 증가, 재전송 등이 발생할 수 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 패킷 교환망은 가상회선과 데이터그램 방식으로 분류됩니다</p><p>${nums[1]} ${c[1]} — 메시지를 짧은 길이의 패킷으로 분할하여 전송하는 것은 맞습니다</p><p>${nums[3]} ${c[3]} — 패킷 교환은 회선 교환과 달리 블록킹 현상이 없습니다</p>` },
    '144_21': { main: '<p>스타형(Star) 구성은 중앙의 허브나 스위치를 중심으로 모든 단말장치가 점 대 점(Point-to-Point) 방식으로 연결되는 네트워크 토폴로지입니다. 관리가 용이하고 장애 격리가 쉬운 장점이 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 링형 구성은 각 노드가 인접한 두 노드와 원형으로 연결됩니다</p><p>${nums[2]} ${c[2]} — 버스형 구성은 하나의 공유 케이블에 모든 노드가 연결됩니다</p><p>${nums[3]} ${c[3]} — 트리형 구성은 계층적 구조로 노드가 연결됩니다</p>` },
    '144_22': { main: '<p>CSMA/CD(Carrier Sense Multiple Access/Collision Detection)는 이더넷에서 사용하는 매체 접근 제어 방식입니다. 전송 전 회선을 감지(Carrier Sense)하고, 충돌이 발생하면 감지(Collision Detection)하여 임의 시간 후 재전송합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Token Ring은 토큰을 순차적으로 전달하여 전송권을 제어하는 방식입니다</p><p>${nums[1]} ${c[1]} — Token Bus는 버스 토폴로지에서 토큰 패싱을 사용하는 방식입니다</p><p>${nums[3]} ${c[3]} — Slotted Ring은 고정 크기 슬롯이 순환하는 링 방식입니다</p>` },
    '144_23': { main: '<p>감쇠(Attenuation)는 전기 신호가 전송 매체를 통해 이동하면서 에너지를 잃어 신호 크기가 약해지는 현상입니다. 전송 거리가 길어질수록 감쇠가 심해지며, 리피터나 증폭기를 사용하여 보상합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 임피던스는 교류 회로에서 전류 흐름에 대한 저항을 의미합니다</p><p>${nums[2]} ${c[2]} — 간섭은 외부 전자기파에 의해 신호가 왜곡되는 현상입니다</p><p>${nums[3]} ${c[3]} — 진폭은 신호의 최대 변위로, 신호가 약해지는 현상의 명칭이 아닙니다</p>` },
    '144_24': { main: '<p>Fast Ethernet은 100BASE-T라고도 불리며, 기존 10Mbps 이더넷의 고속 버전으로 100Mbps의 전송속도를 지원합니다. IEEE 802.3u 표준에 정의되어 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Ethernet은 10Mbps의 전송속도를 가진 기본 이더넷입니다</p><p>${nums[1]} ${c[1]} — Gigabit Ethernet은 1000Mbps(1Gbps)의 전송속도를 지원합니다</p><p>${nums[2]} ${c[2]} — 10Giga Ethernet은 10Gbps의 전송속도를 지원합니다</p>` },
    '144_25': { main: '<p>IDS(Intrusion Detection System, 침입탐지시스템)는 네트워크나 시스템에서 비정상적인 활동이나 침입 시도를 탐지하는 보안 시스템입니다. 네트워크 트래픽을 모니터링하고 의심스러운 활동을 관리자에게 경고합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — IDC는 인터넷 데이터 센터로 서버를 호스팅하는 시설입니다</p><p>${nums[1]} ${c[1]} — IPS는 침입방지시스템으로 탐지뿐 아니라 차단까지 수행합니다</p><p>${nums[3]} ${c[3]} — IOS는 국제표준화기구가 아닌 Cisco의 네트워크 운영체제입니다(ISO가 국제표준화기구)</p>` },
    '144_26': { main: '<p>BcN(Broadband convergence Network, 광대역융합망)은 통신, 방송, 인터넷이 융합된 고품질의 광대역 멀티미디어 서비스를 제공하는 차세대 통합 네트워크입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 전력통신망은 전력 회사의 통신 인프라로, 광대역 융합 개념과는 다릅니다</p><p>${nums[1]} ${c[1]} — 기업통신망은 기업 내부 통신 네트워크를 의미합니다</p><p>${nums[2]} ${c[2]} — 방송통신망은 방송과 통신만을 의미하며 인터넷 융합 개념이 부족합니다</p>` },
    '144_27': { main: '<p>네트워크 계층(3계층)의 PDU(Protocol Data Unit)는 패킷(Packet)입니다. 각 계층별 PDU: 응용/표현/세션=데이터, 전송=세그먼트, 네트워크=패킷, 데이터링크=프레임, 물리=비트입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 세그먼트는 전송 계층(4계층)의 PDU입니다</p><p>${nums[2]} ${c[2]} — 프레임은 데이터링크 계층(2계층)의 PDU입니다</p><p>${nums[3]} ${c[3]} — 비트는 물리 계층(1계층)의 PDU입니다</p>` },
    '144_28': { main: '<p>Windows Server에서 파일 및 프린터 서버를 사용하려면 TCP/IP 프로토콜이 반드시 설치되어 있어야 합니다. TCP/IP는 네트워크 통신의 기본 프로토콜로, 파일 공유(SMB)와 인쇄 서비스의 기반이 됩니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — SNMP는 네트워크 장비 관리 프로토콜로, 파일/프린터 서비스에 필수는 아닙니다</p><p>${nums[2]} ${c[2]} — SMTP는 이메일 전송 프로토콜입니다</p><p>${nums[3]} ${c[3]} — IGMP는 멀티캐스트 그룹 관리 프로토콜입니다</p>` },
    '144_29': { main: '<p>IIS(Internet Information Services)를 통해 설정할 수 있는 주요 서비스는 HTTP(웹 서비스)와 FTP(파일 전송 서비스)입니다. IIS는 Windows Server의 웹 서버 역할을 담당합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — DHCP와 DNS는 IIS가 아닌 별도의 서버 역할로 설치·관리됩니다</p><p>${nums[2]} ${c[2]} — DHCP는 IIS 서비스가 아닌 독립적인 서버 역할입니다</p><p>${nums[3]} ${c[3]} — TELNET은 IIS 서비스에 포함되지 않습니다</p>` },
    '144_30': { main: '<p>nslookup은 DNS 서버에 질의하여 도메인 이름의 IP 주소를 확인하거나 DNS 레코드를 조회하는 명령어입니다. DNS 서버 설정이 올바른지 확인할 때 가장 많이 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ls는 디렉터리 내용을 나열하는 명령어입니다</p><p>${nums[2]} ${c[2]} — show는 라우터/스위치 설정을 확인하는 명령어입니다</p><p>${nums[3]} ${c[3]} — pwd는 현재 디렉터리 경로를 표시하는 명령어입니다</p>` },
    '144_31': { main: '<p>PTR(Pointer) 레코드는 DNS 역방향 조회에 사용되는 레코드로, IP 주소를 도메인 이름으로 변환합니다. in-addr.arpa 도메인에서 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — A 레코드는 정방향 조회(도메인→IPv4)에 사용됩니다</p><p>${nums[1]} ${c[1]} — AAAA 레코드는 정방향 조회(도메인→IPv6)에 사용됩니다</p><p>${nums[3]} ${c[3]} — SOA 레코드는 영역의 권한 시작 정보를 담는 레코드입니다</p>` },
    '144_32': { main: '<p>/usr 디렉터리는 사용자 계정이 위치하는 곳이 아니라, 사용자 프로그램과 라이브러리가 설치되는 디렉터리입니다. 사용자 계정(홈 디렉터리)은 /home에 위치합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — /tmp는 임시 파일이 저장되는 디렉터리로 올바른 설명입니다</p><p>${nums[1]} ${c[1]} — /boot는 부팅 가능한 커널 이미지 파일을 담고 있는 디렉터리입니다</p><p>${nums[2]} ${c[2]} — /var는 시스템 로그 파일과 메일이 저장되는 디렉터리입니다</p>` },
    '144_33': { main: '<p>데몬(Daemon)은 시스템 부팅 시뿐만 아니라 필요할 때 언제든 시작할 수 있습니다. systemctl, service 명령어나 직접 실행으로 런타임에 데몬을 시작/중지할 수 있습니다. inetd/xinetd를 통해 요청 시에만 시작되는 데몬도 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 데몬은 백그라운드에서 실행되는 프로세스입니다</p><p>${nums[1]} ${c[1]} — ps afx 명령으로 데몬 프로그램의 활동을 확인할 수 있습니다</p><p>${nums[2]} ${c[2]} — 데몬은 시스템 서비스를 지원하는 프로세스입니다</p>` },
    '144_34': { main: '<p>GRUB(GRand Unified Bootloader)는 Linux의 대표적인 부트 로더로, 여러 운영체제가 설치된 시스템에서 멀티 부팅을 지원합니다. MBR에 설치되어 부팅 시 운영체제를 선택할 수 있게 해줍니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — MBR(Master Boot Record)은 디스크의 첫 번째 섹터로 부트 로더가 저장되는 영역입니다</p><p>${nums[1]} ${c[1]} — RAS(Remote Access Service)는 원격 접속 서비스입니다</p><p>${nums[2]} ${c[2]} — NetBEUI는 Windows의 네트워크 프로토콜입니다</p>` },
    '144_35': { main: '<p>컨테이너는 Hyper-V와 비슷한 가상화 기술이지만 더 가볍고 빠르게 생성·운영할 수 있습니다. Docker가 대표적인 컨테이너 플랫폼이며, Windows Server 2016부터 Windows 컨테이너를 지원합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 액티브 디렉터리는 사용자/컴퓨터 계정을 중앙에서 관리하는 디렉터리 서비스입니다</p><p>${nums[1]} ${c[1]} — 원격 데스크톱 서비스는 원격으로 서버에 접속하는 기능입니다</p><p>${nums[3]} ${c[3]} — 분산파일서비스(DFS)는 여러 서버의 파일을 통합 관리하는 서비스입니다</p>` },
    '144_36': { main: '<p>Windows에서 hosts 파일은 C:\\Windows\\System32\\drivers\\etc\\hosts 경로에 위치합니다. 이 파일에 도메인과 IP를 매핑하면 DNS 조회 없이 바로 해당 IP로 접속하여 빠른 접속이 가능합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — System32 바로 아래에는 hosts 파일이 없습니다</p><p>${nums[1]} ${c[1]} — config 폴더에는 레지스트리 하이브 파일이 위치합니다</p><p>${nums[2]} ${c[2]} — drivers 바로 아래가 아닌 drivers\\etc 아래에 위치합니다</p>` },
    '144_37': { main: '<p>BitLocker는 Windows의 전체 디스크 암호화 기능으로, 노트북이나 이동식 저장장치의 도난·분실 시 데이터를 보호합니다. TPM(Trusted Platform Module) 칩과 연동하여 강력한 암호화를 제공합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — NTLM은 Windows의 인증 프로토콜로 디스크 암호화와 무관합니다</p><p>${nums[2]} ${c[2]} — Encryption은 암호화의 일반적인 용어로, 특정 기능 이름이 아닙니다</p><p>${nums[3]} ${c[3]} — vTPM은 가상 머신용 TPM으로 디스크 암호화 기능 자체가 아닙니다</p>` },
    '144_38': { main: '<p>Power Users 그룹은 일반 사용자보다 높은 권한을 가지며, 사용자 계정 관리, 프로그램 설치, 시스템 설정 변경 등을 수행할 수 있습니다. 관리자(Administrator)보다는 제한된 권한을 가집니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Backup Operators는 파일 백업과 복원 권한만 가진 그룹입니다</p><p>${nums[1]} ${c[1]} — Performance Log Users는 성능 카운터 로그를 관리하는 그룹입니다</p><p>${nums[3]} ${c[3]} — Replicator는 도메인의 파일 복제를 담당하는 그룹입니다</p>` },
    '144_39': { main: '<p>HTTP 상태 코드 501(Not Implemented)은 서버가 클라이언트의 요청 메서드를 인식하지 못하거나 지원하지 않는 경우에 반환됩니다. 이 설명이 올바릅니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 502는 Bad Gateway이며, Service Unavailable은 503입니다</p><p>${nums[2]} ${c[2]} — 503은 Service Unavailable이며, Bad Request는 400입니다</p><p>${nums[3]} ${c[3]} — 500은 Internal Server Error(서버 내부 오류)이며, 요청 메시지 해석 실패는 400입니다</p>` },
    '144_40': { main: '<p>Hyper-V는 서버 통합, 비용 절감, 테스트 효율성, 가용성 향상 등의 장점이 있지만, 저사양 하드웨어를 묶어서 고성능 환경을 구현하는 것은 가상화의 장점이 아닙니다. 가상화는 고사양 하드웨어를 분할하여 효율적으로 사용하는 기술입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 서버 통합으로 운영·유지관리비용을 절감할 수 있습니다</p><p>${nums[1]} ${c[1]} — 가상 환경에서 테스트 환경을 빠르게 재현할 수 있습니다</p><p>${nums[2]} ${c[2]} — 장애 조치 클러스터링으로 서버 가용성을 향상시킬 수 있습니다</p>` },
    '144_41': { main: '<p>init 6은 Linux 시스템을 재부팅하는 명령어입니다. 시스템 종료 명령어가 아니므로 HDD 증설을 위한 서버 종료에 적합하지 않습니다. 종료 명령: shutdown -h now, poweroff, halt, init 0</p>', wrong: `<p>${nums[0]} ${c[0]} — shutdown -h now는 즉시 시스템을 종료하는 명령어입니다</p><p>${nums[1]} ${c[1]} — poweroff는 시스템을 종료하는 명령어입니다</p><p>${nums[3]} ${c[3]} — halt는 시스템을 중지시키는 명령어입니다</p>` },
    '144_42': { main: '<p>stat 명령어는 파일의 상세 속성 정보를 확인할 수 있습니다. 파일 크기, inode 번호, 권한, 소유자, 생성/수정/접근 시간 등 파일이 복사되었는지 원본인지 판별하는 데 유용합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — file 명령은 파일의 종류(텍스트, 바이너리 등)를 확인합니다</p><p>${nums[2]} ${c[2]} — lsattr은 파일의 확장 속성(ext 파일시스템)을 확인합니다</p><p>${nums[3]} ${c[3]} — lsblk은 블록 장치(디스크, 파티션) 목록을 확인합니다</p>` },
    '144_43': { main: '<p>nohup(no hang up)은 터미널이 종료되어도 프로세스가 계속 실행되도록 하는 명령어입니다. 백업과 같은 장시간 작업 시 터미널 종료의 영향을 받지 않게 해줍니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — mkfs는 파일시스템을 생성(포맷)하는 명령어입니다</p><p>${nums[2]} ${c[2]} — sleep은 지정한 시간만큼 대기하는 명령어입니다</p><p>${nums[3]} ${c[3]} — last는 사용자 로그인 기록을 확인하는 명령어입니다</p>` },
    '144_44': { main: '<p>resolv.conf(/etc/resolv.conf)는 DNS 서버 주소가 설정되는 파일입니다. yum은 패키지 다운로드를 위해 DNS가 필요하며, ping으로 외부 연결을 확인할 때도 DNS 설정이 중요합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — networks는 네트워크 이름과 주소를 매핑하는 파일입니다</p><p>${nums[2]} ${c[2]} — protocols는 프로토콜 번호와 이름을 매핑하는 파일입니다</p><p>${nums[3]} ${c[3]} — services는 서비스 이름과 포트 번호를 매핑하는 파일입니다</p>` },
    '144_45': { main: '<p>NTFS 권한에서 "디렉터리 내용 보기" 권한은 디렉터리 내의 파일과 하위 디렉터리의 이름을 모두 볼 수 있는 권한입니다. ②의 "디렉터리 이름은 볼 수 없다"는 설명은 잘못되었습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — "모든 권한"은 접근·소유권 변경·삭제 등 모든 작업이 가능합니다</p><p>${nums[2]} ${c[2]} — 사용자가 여러 그룹에 속하면 권한이 누적(합산)됩니다</p><p>${nums[3]} ${c[3]} — NTFS에서 '허용'보다 '거부'가 우선합니다</p>` },
    '144_46': { main: '<p>MAC(Media Access Control) Address는 48비트(6바이트)의 고유 주소 체계를 사용합니다. 앞 24비트는 제조사 식별번호(OUI), 뒤 24비트는 장치 고유번호입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 32비트는 IPv4 주소의 길이입니다</p><p>${nums[2]} ${c[2]} — 64비트는 MAC 주소 길이가 아닙니다</p><p>${nums[3]} ${c[3]} — 128비트는 IPv6 주소의 길이입니다</p>` },
    '144_47': { main: '<p>리피터(Repeater)는 OSI 7계층 중 물리 계층(1계층)에서만 동작하는 장비로, LAN의 전송매체상에 흐르는 신호를 정형·증폭·중계하여 전송 거리를 연장합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 라우터는 네트워크 계층(3계층)에서 동작합니다</p><p>${nums[2]} ${c[2]} — 브리지는 데이터링크 계층(2계층)에서 동작합니다</p><p>${nums[3]} ${c[3]} — 게이트웨이는 모든 계층에서 동작할 수 있습니다</p>` },
    '144_48': { main: '<p>게이트웨이(Gateway)는 프로토콜이 완전히 다른 네트워크 간의 인터페이스 역할을 합니다. OSI 모든 계층에서 프로토콜 변환을 수행하여 이기종 네트워크를 연결합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 케이블 집선 장치는 허브(Hub)의 역할입니다</p><p>${nums[2]} ${c[2]} — 신호를 전기적으로 증폭하는 것은 리피터의 역할입니다</p><p>${nums[3]} ${c[3]} — 물리적 주소 캐시 테이블을 갖는 것은 스위치/브리지의 역할입니다</p>` },
    '144_49': { main: '<p>VLAN(Virtual LAN)은 물리적인 하나의 LAN을 논리적으로 여러 개로 분리하여 별도의 네트워크처럼 운용하는 기술입니다. 브로드캐스트 도메인을 분리하고 보안성과 관리 효율성을 높입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — NAC(Network Access Control)은 네트워크 접근 제어 솔루션입니다</p><p>${nums[2]} ${c[2]} — IPS(Intrusion Prevention System)는 침입 방지 시스템입니다</p><p>${nums[3]} ${c[3]} — IDS(Intrusion Detection System)는 침입 탐지 시스템입니다</p>` },
    '144_50': { main: '<p>광섬유(Fiber Optics)는 빛을 이용하여 데이터를 전송하므로 신호 손실이 적고, 전자기적 간섭(EMI)의 영향을 받지 않습니다. 높은 대역폭과 장거리 전송이 가능한 장점이 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 여러 라인 묶음으로 간섭을 줄이는 것은 트위스트 페어 케이블의 특성입니다</p><p>${nums[2]} ${c[2]} — 8개 중 4개 핀 사용은 UTP 케이블(RJ-45)의 특성입니다</p><p>${nums[3]} ${c[3]} — 수 Km마다 리피터 필요는 구리선 케이블의 특성이며, 광케이블은 더 먼 거리까지 전송 가능합니다</p>` },

    // === exam_id 145 ===
    '145_1': { main: '<p>Class A의 최상위 비트는 \'0\'(1비트)이고, Class B는 최상위 2비트가 \'10\', Class C는 최상위 3비트가 \'110\'입니다. 따라서 ③의 "Class A는 최상위 3비트를 \'110\'으로 설정한다"는 Class C에 대한 설명으로, 잘못되었습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 모든 비트가 1이면 브로드캐스트 주소이므로 할당 불가합니다</p><p>${nums[1]} ${c[1]} — Class B는 최상위 2비트가 '10'으로 올바른 설명입니다</p><p>${nums[3]} ${c[3]} — 127.x.x.x는 루프백 주소로 할당하지 않습니다</p>` },
    '145_2': { main: '<p>서브넷 마스크 255.255.255.240은 /28에 해당하며, 호스트 비트는 4개입니다. 최대 사용 가능한 호스트 수는 2^4 - 2 = 14개입니다(네트워크 주소와 브로드캐스트 주소 제외).</p>', wrong: `<p>${nums[0]} ${c[0]} — 10개는 올바른 계산이 아닙니다</p><p>${nums[2]} ${c[2]} — 26개는 /27이 아닌 다른 서브넷 마스크의 호스트 수입니다</p><p>${nums[3]} ${c[3]} — 32개는 네트워크/브로드캐스트 주소를 제외하지 않은 값입니다</p>` },
    '145_3': { main: '<p>RIP(Routing Information Protocol)는 Distance Vector 라우팅 프로토콜로, 홉 카운트를 메트릭으로 사용하며 최대 홉 수가 15로 제한됩니다. 16홉 이상은 도달 불가능(unreachable)으로 간주합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — OSPF는 Link State 프로토콜로 홉 수 제한이 없습니다</p><p>${nums[2]} ${c[2]} — IGP는 내부 게이트웨이 프로토콜의 총칭으로 특정 프로토콜이 아닙니다</p><p>${nums[3]} ${c[3]} — EGP는 외부 게이트웨이 프로토콜로 AS 간 라우팅에 사용됩니다</p>` },
    '145_4': { main: '<p>TCP는 Sliding Window 방식으로 흐름 제어를 수행합니다. 윈도우 크기만큼 확인 응답 없이 연속 전송이 가능하며, 수신측의 처리 능력에 맞게 윈도우 크기를 동적으로 조절합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Go-Back-N은 에러 복구 방식(ARQ)이지 TCP의 흐름제어 방식이 아닙니다</p><p>${nums[1]} ${c[1]} — 선택적 재전송은 ARQ의 한 종류입니다</p><p>${nums[3]} ${c[3]} — Idle-RQ(Stop-and-Wait)는 프레임 하나씩 전송하는 방식으로 TCP 흐름제어가 아닙니다</p>` },
    '145_5': { main: '<p>IPv6 헤더의 Priority(Traffic Class) 필드는 패킷의 우선순위를 나타내며, 네트워크 혼잡 상황에서 어떤 데이터그램을 우선 처리하거나 버릴지 결정할 때 참조됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Version 필드는 IP 버전(6)을 나타냅니다</p><p>${nums[2]} ${c[2]} — Next Header는 확장 헤더나 상위 계층 프로토콜을 식별합니다</p><p>${nums[3]} ${c[3]} — Hop Limit는 패킷의 생존 기간(최대 홉 수)을 제한합니다</p>` },
    '145_6': { main: '<p>ARP 캐시는 일정한 주기(타이머)를 갖고 자동으로 갱신됩니다. 캐시 항목은 일정 시간이 지나면 만료되어 삭제되고, 새로운 ARP 요청/응답을 통해 갱신됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ARP는 IP Address를 Ethernet(MAC) 주소로 매핑하며, 반대가 아닙니다</p><p>${nums[1]} ${c[1]} — ARP로 IP 중복을 찾을 수 있지만(Gratuitous ARP), 이것이 ARP의 주 기능은 아닙니다</p><p>${nums[3]} ${c[3]} — 중복 IP 발견 시 ARP 캐시는 갱신될 수 있습니다</p>` },
    '145_7': { main: '<p>ICMP 타입 3은 Destination Unreachable(목적지 도달 불가)이며, Echo Reply 응답은 타입 0입니다. ①의 "타입 3 - Echo Request 질의 메시지에 응답"은 잘못된 설명입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 타입 4는 Source Quench로 흐름제어/폭주제어에 사용됩니다</p><p>${nums[2]} ${c[2]} — 타입 5는 Redirect로 대체 경로를 알리는 데 사용됩니다</p><p>${nums[3]} ${c[3]} — 타입 17은 Address Mask Request로 서브넷 마스크를 요구합니다</p>` },
    '145_8': { main: '<p>포트 23번은 Telnet 프로토콜에 할당되어 있습니다. FTP는 포트 20번(데이터)과 21번(제어)을 사용합니다. 따라서 "23번 – FTP" 연결이 잘못되었습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 25번 SMTP는 올바른 포트 번호입니다</p><p>${nums[2]} ${c[2]} — 80번 HTTP(WWW)는 올바른 포트 번호입니다</p><p>${nums[3]} ${c[3]} — 110번 POP3는 올바른 포트 번호입니다</p>` },
    '145_9': { main: '<p>TFTP(Trivial File Transfer Protocol)는 UDP를 사용하는 간단한 파일 전송 프로토콜입니다. TCP의 3-Way Handshake를 사용하지 않으며, ③의 설명은 잘못되었습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — TFTP는 Trivial File Transfer Protocol의 약어입니다</p><p>${nums[1]} ${c[1]} — 네트워크를 통한 파일 전송 서비스가 맞습니다</p><p>${nums[3]} ${c[3]} — 간단한 파일 전송 시 FTP보다 빠를 수 있습니다</p>` },
    '145_10': { main: '<p>SMTP(Simple Mail Transfer Protocol)는 인터넷에서 전자 우편(이메일)을 전송하기 위한 프로토콜입니다. TCP 포트 25를 사용하며, 메일 서버 간 이메일을 전달합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — WWW 데이터 전송은 HTTP 프로토콜입니다</p><p>${nums[1]} ${c[1]} — 네트워크 장비 관리는 SNMP 프로토콜입니다</p><p>${nums[2]} ${c[2]} — 파일 전송은 FTP 프로토콜입니다</p>` },
    '145_11': { main: '<p>Window 필드는 TCP 헤더에만 존재하는 필드로, 수신 가능한 바이트 수를 나타내어 흐름 제어에 사용됩니다. UDP 헤더에는 Source Port, Destination Port, Length, Checksum만 포함됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Source Port는 UDP 헤더에 포함됩니다</p><p>${nums[1]} ${c[1]} — Destination Port는 UDP 헤더에 포함됩니다</p><p>${nums[3]} ${c[3]} — Checksum은 UDP 헤더에 포함됩니다</p>` },
    '145_12': { main: '<p>Port Number는 IP 데이터그램 헤더가 아닌 전송 계층(TCP/UDP) 헤더에 포함됩니다. IP 헤더에는 Source/Destination IP Address, TTL, Protocol, Version 등이 포함됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Destination IP Address는 IP 헤더 필드입니다</p><p>${nums[1]} ${c[1]} — Source IP Address는 IP 헤더 필드입니다</p><p>${nums[3]} ${c[3]} — TTL은 IP 헤더 필드입니다</p>` },
    '145_13': { main: '<p>RARP(Reverse ARP)는 MAC 주소를 이용하여 IP 주소를 알아내는 프로토콜입니다. 디스크 없는 워크스테이션이 부팅 시 자신의 MAC 주소로 IP 주소를 얻을 때 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ARP는 IP→MAC 변환 프로토콜입니다</p><p>${nums[1]} ${c[1]} — Proxy ARP는 라우터가 다른 네트워크의 ARP 요청에 대신 응답하는 기술입니다</p><p>${nums[2]} ${c[2]} — Inverse ARP는 Frame Relay에서 DLCI→IP 변환에 사용됩니다</p>` },
    '145_14': { main: '<p>DNS는 TCP와 UDP 포트 53을 모두 사용합니다. 일반적인 DNS 질의는 UDP를 사용하고, 영역 전송(Zone Transfer)이나 512바이트 이상의 응답 시에는 TCP를 사용합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — SMTP는 TCP 포트 25만 사용합니다</p><p>${nums[1]} ${c[1]} — FTP는 TCP 포트 20, 21만 사용합니다</p><p>${nums[3]} ${c[3]} — Telnet은 TCP 포트 23만 사용합니다</p>` },
    '145_15': { main: '<p>TCP 3-Way Handshake의 두 번째 단계에서 서버는 SYN+ACK 세그먼트를 클라이언트에게 보냅니다. 과정: ① 클라이언트→서버: SYN, ② 서버→클라이언트: SYN+ACK, ③ 클라이언트→서버: ACK</p>', wrong: `<p>${nums[1]} ${c[1]} — ACK-FIN은 연결 종료 과정에서 사용되는 조합입니다</p><p>${nums[2]} ${c[2]} — SYN-FIN은 정상적인 3-Way Handshake 과정이 아닙니다</p><p>${nums[3]} ${c[3]} — PSH-ACK는 데이터 전송 시 사용되는 플래그 조합입니다</p>` },
    '145_16': { main: '<p>SNMP(Simple Network Management Protocol)는 네트워크 장비의 관리 및 감시 기능을 제공합니다. Manager가 Agent로부터 MIB 정보를 수집하여 장비의 상태를 모니터링하고 설정을 변경합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 대규모 환경 관리는 SNMP의 한계점 중 하나이며, 주요 기능 설명으로 부적합합니다</p><p>${nums[1]} ${c[1]} — 에러 보고는 ICMP의 기능입니다</p><p>${nums[3]} ${c[3]} — 연결성 점검과 혼잡 제어는 ICMP의 기능입니다</p>` },
    '145_17': { main: '<p>D Class(224.0.0.0~239.255.255.255)는 멀티캐스트 통신을 위해 예약된 IPv4 주소 클래스입니다. 특정 그룹의 호스트들에게 동시에 데이터를 전송할 때 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — A Class(1.0.0.0~126.255.255.255)는 유니캐스트용입니다</p><p>${nums[1]} ${c[1]} — B Class(128.0.0.0~191.255.255.255)는 유니캐스트용입니다</p><p>${nums[2]} ${c[2]} — C Class(192.0.0.0~223.255.255.255)는 유니캐스트용입니다</p>` },
    '145_18': { main: '<p>전송 계층(Transport Layer, 4계층)에서 동작하는 대표적인 프로토콜은 TCP와 UDP입니다. TCP는 연결지향적 신뢰성 전송, UDP는 비연결형 빠른 전송을 제공합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ICMP는 네트워크 계층(3계층)에서 동작합니다</p><p>${nums[1]} ${c[1]} — IP는 네트워크 계층(3계층)에서 동작합니다</p><p>${nums[3]} ${c[3]} — NetBEUI는 전송 계층이지만 IP는 네트워크 계층입니다</p>` },
    '145_19': { main: '<p>IEEE 802.11은 무선 LAN(Wi-Fi) 표준입니다. 802.3은 CSMA/CD(이더넷), 802.4는 토큰 버스, 802.5는 토큰 링입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — IEEE 802.3은 CSMA/CD(이더넷)이며 토큰 버스가 아닙니다</p><p>${nums[1]} ${c[1]} — IEEE 802.4가 토큰 버스이며 802.5가 토큰 링입니다(순서가 바뀜)</p><p>${nums[3]} ${c[3]} — IEEE 802.5가 토큰 링이며 CSMA/CD는 802.3입니다</p>` },
    '145_20': { main: '<p>IoT(Internet of Things, 사물인터넷)는 다양한 사물에 센서와 통신 기능을 내장하여 인터넷에 연결하는 기술입니다. 사물 간 정보를 교환하고 상호 소통하는 지능형 인프라를 구축합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 모바일 클라우드 컴퓨팅은 모바일 기기에서 클라우드 서비스를 이용하는 기술입니다</p><p>${nums[2]} ${c[2]} — 빅데이터는 대용량 데이터를 분석하여 가치를 추출하는 기술입니다</p><p>${nums[3]} ${c[3]} — RFID는 무선 주파수를 이용한 자동 인식 기술입니다</p>` },
    '145_21': { main: '<p>클라우드 컴퓨팅(Cloud Computing)은 인터넷을 통해 IT 자원(서버, 스토리지, 소프트웨어 등)을 필요한 만큼 빌려 사용하고 사용량에 따라 비용을 지불하는 서비스 모델입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 디지타이징은 아날로그 데이터를 디지털로 변환하는 과정입니다</p><p>${nums[1]} ${c[1]} — 디지털 컨버전스는 디지털 기술을 기반으로 통신/방송/콘텐츠가 융합하는 현상입니다</p><p>${nums[3]} ${c[3]} — 유비쿼터스 컴퓨팅은 언제 어디서나 컴퓨터를 사용할 수 있는 환경입니다</p>` },
    '145_22': { main: '<p>에러 제어(Error Control)는 세션 계층(5계층)이 아닌 데이터링크 계층(2계층)과 전송 계층(4계층)의 기능입니다. 세션 계층은 대화 제어, 연결 설정/종료, 동기화 등을 담당합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 대화 제어는 세션 계층의 역할입니다</p><p>${nums[2]} ${c[2]} — 연결 설정 및 종료는 세션 계층의 역할입니다</p><p>${nums[3]} ${c[3]} — 동기화(Synchronization)는 세션 계층의 역할입니다</p>` },
    '145_23': { main: '<p>IPSec(Internet Protocol Security)는 네트워크 계층에서 IP 패킷을 암호화하고 인증하는 프로토콜 스위트로, VPN 구현에 널리 사용됩니다. AH(인증)와 ESP(암호화) 프로토콜을 포함합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — PPTP는 2계층 VPN 터널링 프로토콜로 Microsoft가 개발했습니다</p><p>${nums[1]} ${c[1]} — L2TP는 2계층 터널링 프로토콜로 PPTP와 L2F를 결합한 것입니다</p><p>${nums[3]} ${c[3]} — SSL은 전송 계층 보안 프로토콜로 웹 VPN에 사용됩니다</p>` },
    '145_24': { main: '<p>Sink 노드는 센서 네트워크에서 센서 노드들이 수집한 데이터를 모아 처리하는 중심 노드입니다. 게이트웨이 역할을 하여 센서 데이터를 외부 네트워크로 전달합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — Actuator는 센서 데이터에 따라 물리적 동작을 수행하는 장치입니다</p><p>${nums[2]} ${c[2]} — RFID는 무선 주파수를 이용한 자동 인식 기술입니다</p><p>${nums[3]} ${c[3]} — Access Point는 무선 LAN의 접속점으로 센서 네트워크 전용이 아닙니다</p>` },
    '145_25': { main: '<p>RFID(Radio Frequency Identification)는 무선 주파수를 이용하여 태그(Tag)에 저장된 정보를 리더(Reader)가 비접촉으로 읽어내는 자동 인식 기술입니다. 물류, 재고 관리, 출입 통제 등에 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 바코드는 광학적 판독 방식으로 무선 주파수를 사용하지 않습니다</p><p>${nums[1]} ${c[1]} — 블루투스는 근거리 무선 통신 기술이지만 태그/리더 구조가 아닙니다</p><p>${nums[3]} ${c[3]} — WiFi는 무선 LAN 접속 기술입니다</p>` },
    '145_26': { main: '<p>AMI(Advanced Metering Infrastructure)는 스마트 그리드에서 전력 사용량을 자동으로 검침하고 양방향 통신으로 관리하는 인프라입니다. 스마트 미터, 통신 네트워크, 데이터 관리 시스템으로 구성됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — DR은 전력 수요 반응으로 수요를 조절하는 프로그램입니다</p><p>${nums[1]} ${c[1]} — EMS는 에너지 관리 시스템으로 전력 계통을 감시·제어합니다</p><p>${nums[3]} ${c[3]} — TDA는 송배전 자동화 시스템입니다</p>` },
    '145_27': { main: '<p>NAS(Network Attached Storage)는 네트워크에 직접 연결되는 스토리지 장치로, 파일 단위로 데이터를 공유합니다. 설치와 관리가 간편하고 여러 클라이언트가 네트워크를 통해 접근할 수 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Storage는 저장장치의 일반적 용어로 네트워크 연결 스토리지를 특정하지 않습니다</p><p>${nums[2]} ${c[2]} — USB HDD는 직접 연결(DAS) 방식의 외장 스토리지입니다</p><p>${nums[3]} ${c[3]} — Server는 서비스를 제공하는 컴퓨터이며 NAS와는 다른 개념입니다</p>` },
    '145_28': { main: '<p>DHCP(Dynamic Host Configuration Protocol) 서버는 네트워크 클라이언트가 부팅될 때 자동으로 IP 주소, 서브넷 마스크, 기본 게이트웨이, DNS 서버 주소 등을 할당합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — WINS 서버는 NetBIOS 이름을 IP 주소로 변환하는 서비스입니다</p><p>${nums[2]} ${c[2]} — DNS 서버는 도메인 이름을 IP 주소로 변환하는 서비스입니다</p><p>${nums[3]} ${c[3]} — 터미널 서버는 원격 데스크톱 접속을 제공하는 서비스입니다</p>` },
    '145_29': { main: '<p>Shell은 사용자와 커널(Kernel) 사이의 인터페이스로, 사용자가 입력한 명령어를 해석하여 커널에 전달하는 역할을 합니다. bash, sh, csh, zsh 등 다양한 셸이 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — System Program은 운영체제의 일부로 시스템 관리 도구입니다</p><p>${nums[1]} ${c[1]} — Loader는 프로그램을 메모리에 적재하는 역할을 합니다</p><p>${nums[3]} ${c[3]} — Directory는 파일을 조직하는 구조입니다</p>` },
    '145_30': { main: '<p>chage(change age) 명령어는 사용자 패스워드의 만료기간, 최소/최대 사용일수, 경고일수 등의 시간 정보를 변경합니다. 예: chage -M 90 user (최대 90일)</p>', wrong: `<p>${nums[1]} ${c[1]} — chgrp은 파일/디렉터리의 소유 그룹을 변경하는 명령어입니다</p><p>${nums[2]} ${c[2]} — chmod는 파일/디렉터리의 접근 권한을 변경하는 명령어입니다</p><p>${nums[3]} ${c[3]} — usermod는 사용자 계정 정보를 수정하는 명령어입니다</p>` },
    '145_31': { main: '<p>SOA 레코드의 TTL(Time to Live) 값이 길면 캐시에 오래 저장되므로 DNS 서버에 대한 질의 빈도가 줄어들어 부하가 감소합니다. ④의 "부하가 늘어난다"는 잘못된 설명입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Zone 파일은 항상 SOA 레코드로 시작합니다</p><p>${nums[1]} ${c[1]} — SOA에는 네임서버 유지를 위한 기본 자료가 저장됩니다</p><p>${nums[2]} ${c[2]} — Refresh는 주 서버와 보조 서버 간의 동기화 주기를 설정합니다</p>` },
    '145_32': { main: '<p>-rwxr-x--x에서 그룹 권한은 r-x(읽기 5 + 실행 1 = 읽기와 실행)입니다. ④는 "동일 그룹 사용자는 실행 권한만을 갖는다"고 했으나 실제로는 읽기+실행 권한을 가지므로 잘못되었습니다. 모드: 소유자(rwx=7), 그룹(r-x=5), 기타(--x=1) = 751</p>', wrong: `<p>${nums[0]} ${c[0]} — 소유자는 rwx(읽기+쓰기+실행) 권한을 가집니다</p><p>${nums[1]} ${c[1]} — 기타 사용자(other)는 --x(실행)만 가능합니다</p><p>${nums[2]} ${c[2]} — 파일 모드 751은 올바른 계산입니다</p>` },
    '145_33': { main: '<p>/etc 디렉터리는 Linux 시스템의 설정 파일들이 위치하는 디렉터리입니다. passwd, shadow, fstab, hosts, resolv.conf 등 주요 설정 파일이 이곳에 저장됩니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — /bin은 기본 실행 파일(명령어)이 위치하는 디렉터리입니다</p><p>${nums[2]} ${c[2]} — /var는 로그, 메일, 스풀 등 가변 데이터가 저장되는 디렉터리입니다</p><p>${nums[3]} ${c[3]} — /dev는 장치 파일이 위치하는 디렉터리입니다</p>` },
    '145_34': { main: '<p>chown(change owner) 명령어는 파일이나 디렉터리의 소유자와 소유 그룹을 변경하는 명령어로, 일반적으로 root 권한(또는 sudo)이 필요합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — pwd는 현재 디렉터리를 표시하며 일반 사용자도 사용 가능합니다</p><p>${nums[2]} ${c[2]} — ls는 디렉터리 내용을 나열하며 일반 사용자도 사용 가능합니다</p><p>${nums[3]} ${c[3]} — rm은 파일 삭제 명령으로 일반 사용자도 자신의 파일에 사용 가능합니다</p>` },
    '145_35': { main: '<p>top 명령어는 시스템의 전체 프로세스 상태를 실시간으로 모니터링하는 명령어입니다. CPU/메모리 사용량 등을 보여주며, "가장 우선순위가 높은 프로세스만 보여주는" 것이 아닙니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — kill은 프로세스를 종료시키는 명령어입니다</p><p>${nums[1]} ${c[1]} — nice는 프로세스의 우선순위(nice 값)를 변경하는 명령어입니다</p><p>${nums[2]} ${c[2]} — pstree는 프로세스를 트리 형태로 보여주는 명령어입니다</p>` },
    '145_36': { main: '<p>FSRM(File Server Resource Manager)은 Windows Server에서 폴더 할당량(Quota)을 설정하고, 파일 차단(File Screening) 정책을 적용하여 특정 파일 유형의 업로드를 제한하는 도구입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — FTP는 파일 전송 프로토콜로 용량 제한 기능이 아닙니다</p><p>${nums[2]} ${c[2]} — DFS는 분산 파일 시스템으로 여러 서버의 공유 폴더를 통합 관리합니다</p><p>${nums[3]} ${c[3]} — Apache는 웹 서버 소프트웨어입니다</p>` },
    '145_37': { main: '<p>net user 명령어는 Windows에서 도메인 또는 로컬 사용자 계정을 생성·수정·삭제하는 데 사용됩니다. 도메인 컨트롤러에서 도메인 사용자를 관리할 때 유용합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — dsadd는 AD 객체를 추가하는 명령어입니다</p><p>${nums[1]} ${c[1]} — dsmod는 AD 객체를 수정하는 명령어입니다</p><p>${nums[2]} ${c[2]} — dsrm은 AD 객체를 삭제하는 명령어입니다</p>` },
    '145_38': { main: '<p>NAS(Network Attached Storage)는 네트워크에 직접 연결되어 파일 수준의 데이터 공유를 제공하는 스토리지 장치입니다. 설치가 간편하고 TCP/IP 네트워크를 통해 다양한 클라이언트가 접근할 수 있습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — SAN은 전용 네트워크로 블록 수준의 스토리지를 제공하며, 파일 수준이 아닙니다</p><p>${nums[2]} ${c[2]} — RAID는 디스크 배열 기술로 네트워크 스토리지가 아닙니다</p><p>${nums[3]} ${c[3]} — SSD는 저장 매체의 종류이지 네트워크 스토리지가 아닙니다</p>` },
    '145_39': { main: '<p>Round Robin은 DNS 기반 부하 분산 방식으로, 여러 대의 서버가 동일한 서비스를 제공할 때 요청을 순환적으로 분배합니다. 간단하지만 서버의 실제 부하를 고려하지 않는 단점이 있습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — Heartbeat는 클러스터 노드 간의 생존 확인 메커니즘입니다</p><p>${nums[2]} ${c[2]} — Failover Cluster는 장애 발생 시 다른 서버로 자동 전환하는 기술입니다</p><p>${nums[3]} ${c[3]} — Non-Repudiation은 부인방지 보안 기능입니다</p>` },
    '145_40': { main: '<p>이벤트 뷰어(Event Viewer)는 Windows Server의 시스템 이벤트를 기록하고 확인하는 도구입니다. 시스템 종료 원인, 오류, 경고 등을 로그에서 확인하여 문제를 진단합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 성능 모니터는 시스템 성능 카운터를 모니터링하는 도구입니다</p><p>${nums[2]} ${c[2]} — 로컬 보안 정책은 보안 설정을 관리하는 도구입니다</p><p>${nums[3]} ${c[3]} — 그룹 정책 편집기는 그룹 정책을 설정하는 도구입니다</p>` },
    '145_41': { main: '<p>삼바(SAMBA)는 Linux/Unix 시스템과 Windows 시스템 간에 파일과 프린터를 공유할 수 있게 해주는 소프트웨어입니다. SMB/CIFS 프로토콜을 구현하여 이기종 OS 간 자원 공유를 가능하게 합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 분산 파일 시스템은 여러 서버의 공유 폴더를 하나로 통합 관리합니다</p><p>${nums[2]} ${c[2]} — ODBC는 데이터베이스 연결 표준 인터페이스입니다</p><p>${nums[3]} ${c[3]} — 파일 전송 프로토콜(FTP)은 파일 업로드/다운로드용 프로토콜입니다</p>` },
    '145_42': { main: '<p>FTP Passive Mode는 서버 측에서 별도의 포트 대역을 설정하고, 데이터 연결 시 서버가 클라이언트에게 포트를 알려주면 클라이언트가 해당 포트로 연결합니다. 방화벽 환경에서 주로 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Active Mode는 서버가 클라이언트의 포트로 직접 연결하는 방식입니다</p><p>${nums[2]} ${c[2]} — Privileges Mode는 FTP 모드가 아닙니다</p><p>${nums[3]} ${c[3]} — Proxy Mode는 프록시를 통한 연결 방식입니다</p>` },
    '145_43': { main: '<p>ipconfig /flushdns는 로컬 컴퓨터의 DNS 캐시를 모두 삭제하는 명령어입니다. DNS 레코드가 변경되었지만 캐시된 이전 정보로 접속되는 경우 이 명령으로 캐시를 초기화합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ipconfig /displaydns는 DNS 캐시 내용을 표시합니다(삭제가 아님)</p><p>${nums[2]} ${c[2]} — ipconfig /release는 DHCP IP 주소를 해제합니다</p><p>${nums[3]} ${c[3]} — ipconfig /renew는 DHCP IP 주소를 갱신합니다</p>` },
    '145_44': { main: '<p>GPT(GUID Partition Table)는 2TB 이상의 대용량 디스크를 지원하는 파티션 형식입니다. MBR은 최대 2TB까지만 지원하므로 4TB 하드디스크에는 GPT 파티션 형식이 적합합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — FAT는 구형 파일시스템으로 대용량 디스크를 지원하지 않습니다</p><p>${nums[1]} ${c[1]} — ext4는 Linux 파일시스템으로 Windows Server에서는 사용하지 않습니다</p><p>${nums[3]} ${c[3]} — MBR은 최대 2TB까지만 지원하므로 4TB에 부적합합니다</p>` },
    '145_45': { main: '<p>pathping은 ping과 tracert의 기능을 결합한 명령어로, 출발지에서 목적지까지의 경로를 추적하고 각 홉에서의 패킷 손실률과 지연 시간을 측정합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ping은 특정 호스트와의 연결 상태만 확인합니다</p><p>${nums[1]} ${c[1]} — nbtstat은 NetBIOS 프로토콜 통계를 표시합니다</p><p>${nums[3]} ${c[3]} — netstat은 네트워크 연결, 라우팅 테이블, 포트 상태를 표시합니다</p>` },
    '145_46': { main: '<p>리피터(Repeater)는 OSI 물리 계층(1계층)에서만 동작하는 장비로, 전송 매체상의 신호를 정형·증폭·중계하여 전송 거리를 연장합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 라우터는 네트워크 계층(3계층)에서 동작합니다</p><p>${nums[2]} ${c[2]} — 브리지는 데이터링크 계층(2계층)에서 동작합니다</p><p>${nums[3]} ${c[3]} — 게이트웨이는 모든 계층에서 동작할 수 있습니다</p>` },
    '145_47': { main: '<p>로드밸런싱(Load Balancing)은 서버나 네트워크 장비의 부하를 분산시켜 처리량을 증가시키고, 지연율을 낮추며, 응답시간을 감소시키는 최적화 기술입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 가상 LAN(VLAN)에 대한 설명입니다</p><p>${nums[2]} ${c[2]} — 가상 머신(Virtual Machine)에 대한 설명입니다</p><p>${nums[3]} ${c[3]} — SSL/TLS에 대한 설명입니다</p>` },
    '145_48': { main: '<p>OSPF에서 라우터 간 인증은 허가 없이 쉽게 접속하고 확장하는 것을 방지하기 위한 보안 기능입니다. ④의 "관리자의 허가 없이 쉽게 접속하고 네트워크를 확장할 수 있다"는 반대의 설명으로 잘못되었습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — OSPF는 Area와 Backbone으로 구성된 계층구조입니다</p><p>${nums[1]} ${c[1]} — Link-State 알고리즘으로 빠른 수렴과 루프 방지가 가능합니다</p><p>${nums[2]} ${c[2]} — VLSM을 지원하여 IP 주소를 효율적으로 활용합니다</p>` },
    '145_49': { main: '<p>Docker는 컨테이너 기반 가상화 플랫폼으로, 애플리케이션과 의존성을 컨테이너에 패키징하여 어디서든 동일한 환경에서 실행할 수 있게 합니다. 가볍고 빠르며 이식성이 뛰어납니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — VirtualBox는 Oracle의 전체 가상화 소프트웨어입니다</p><p>${nums[1]} ${c[1]} — VMware는 하이퍼바이저 기반의 전체 가상화 소프트웨어입니다</p><p>${nums[2]} ${c[2]} — Xen은 오픈소스 하이퍼바이저 가상화 기술입니다</p>` },
    '145_50': { main: '<p>광섬유(Optical Fiber)는 유리 섬유를 이용하여 빛으로 데이터를 전송합니다. 가장 빠른 전송속도와 넓은 대역폭을 제공하지만, 구리선에 비해 비싸고 설치가 어려운 단점이 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 동축 케이블(Coaxial Cable)은 구리 도체를 사용하는 케이블입니다</p><p>${nums[1]} ${c[1]} — 트위스트 페어(Twisted Pair)는 구리선을 꼬아 만든 케이블입니다</p><p>${nums[2]} ${c[2]} — Thin Cable은 얇은 동축 케이블(10BASE2)입니다</p>` },

    // === exam_id 146 ===
    '146_1': { main: '<p>TTL(Time to Live)은 IP 패킷이 네트워크상에서 존재할 수 있는 시간(홉 수)을 제한합니다. 라우터를 통과할 때마다 1씩 감소하며, 0이 되면 패킷이 폐기됩니다. ①의 "영원히 존재할 수 있다"는 잘못된 설명입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 라우터의 한 홉 통과 시 TTL 값이 1씩 감소하는 것은 올바릅니다</p><p>${nums[2]} ${c[2]} — Ping과 Tracert는 TTL 값을 활용합니다</p><p>${nums[3]} ${c[3]} — TTL은 패킷의 네트워크 존재 시간을 나타내므로 올바릅니다</p>` },
    '146_2': { main: '<p>첫 번째 옥텟이 11101011(235)이므로 상위 4비트가 1110입니다. 이는 D Class(224~239) 범위에 해당합니다. D Class는 멀티캐스트용으로 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — A Class는 첫 비트가 0 (0~127)입니다</p><p>${nums[1]} ${c[1]} — B Class는 상위 2비트가 10 (128~191)입니다</p><p>${nums[2]} ${c[2]} — C Class는 상위 3비트가 110 (192~223)입니다</p>` },
    '146_3': { main: '<p>6개의 서브넷을 만들려면 최소 3비트가 필요합니다(2^3=8≥6). C Class에서 3비트를 서브넷에 할당하면 255.255.255.224(/27)가 됩니다. 8개의 서브넷이 생기며 각 서브넷당 호스트 30개입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 255.255.255.0은 서브넷 분할이 없는 기본 C Class 마스크입니다</p><p>${nums[1]} ${c[1]} — 255.255.255.192는 2비트로 4개 서브넷만 생성되어 6개에 부족합니다</p><p>${nums[3]} ${c[3]} — 255.255.255.240은 4비트로 16개 서브넷이 생겨 과도합니다</p>` },
    '146_4': { main: '<p>IPv6 헤더에서 Hop Limit 필드는 IPv4의 TTL과 동일한 역할로, 데이터그램이 경유할 수 있는 최대 라우터(홉) 수를 제한합니다. 값이 0이 되면 패킷이 폐기됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Version은 IP 버전(6)을 나타내는 필드입니다</p><p>${nums[1]} ${c[1]} — Priority(Traffic Class)는 트래픽 우선순위를 나타냅니다</p><p>${nums[2]} ${c[2]} — Next Header는 다음 확장 헤더나 상위 프로토콜을 식별합니다</p>` },
    '146_5': { main: '<p>IPv6는 128비트 주소체계를 사용합니다. ①의 "64비트 주소체계"는 잘못된 설명입니다. IPv6는 향상된 QoS, 보안 기능(IPSec 내장), 자동 주소설정(SLAAC) 등의 특징이 있습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — IPv6는 Flow Label 등으로 향상된 서비스 품질을 지원합니다</p><p>${nums[2]} ${c[2]} — IPv6는 IPSec을 기본으로 지원하여 보안이 강화되었습니다</p><p>${nums[3]} ${c[3]} — IPv6는 SLAAC 등 자동 주소 설정 기능을 제공합니다</p>` },
    '146_6': { main: '<p>NAT는 사설 IP 주소로 A, B, C 어떤 클래스든 사용할 수 있습니다. ②의 "C Class를 사용해야만 정상 동작"은 잘못된 설명입니다. 사설 IP 범위: A(10.0.0.0/8), B(172.16.0.0/12), C(192.168.0.0/16)</p>', wrong: `<p>${nums[0]} ${c[0]} — NAT는 사설 IP를 공인 IP로 변환하는 기술입니다</p><p>${nums[2]} ${c[2]} — NAT로 내부 사설 IP가 외부에 노출되지 않아 보안이 강화됩니다</p><p>${nums[3]} ${c[3]} — NAT를 통해 한정된 공인 IP를 절약할 수 있습니다</p>` },
    '146_7': { main: '<p>UDP는 비연결형 프로토콜로 흐름 제어를 수행하지 않습니다. ③의 "양방향 전송, Dynamic Sliding Window 방식"은 TCP의 특성입니다. UDP는 헤더가 간단하고 오버헤드가 적습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 동영상 등 실시간 스트리밍에 UDP가 많이 사용됩니다</p><p>${nums[1]} ${c[1]} — UDP는 OSI 전송 계층(4계층)에 속합니다</p><p>${nums[3]} ${c[3]} — UDP는 TCP보다 헤더가 작아 오버헤드가 적습니다</p>` },
    '146_8': { main: '<p>SMTP는 응용 계층(7계층)에서 동작하는 이메일 전송 프로토콜입니다. 반면 RARP, ICMP, IGMP는 모두 네트워크 계층(3계층)에서 동작하므로, SMTP만 다른 계층에서 동작합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — RARP는 네트워크 계층에서 동작합니다</p><p>${nums[2]} ${c[2]} — ICMP는 네트워크 계층에서 동작합니다</p><p>${nums[3]} ${c[3]} — IGMP는 네트워크 계층에서 동작합니다</p>` },
    '146_9': { main: '<p>브로드캐스트(Broadcast)는 특정 호스트로부터 같은 네트워크상의 모든 호스트에게 데이터를 동시에 전송하는 방식입니다. 목적지 주소로 브로드캐스트 주소(예: 255.255.255.255)를 사용합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 유니캐스트는 1:1 통신(한 호스트에서 한 호스트로)입니다</p><p>${nums[2]} ${c[2]} — 멀티캐스트는 특정 그룹의 호스트들에게만 전송합니다</p><p>${nums[3]} ${c[3]} — UDP는 전송 계층 프로토콜이지 전송 방식이 아닙니다</p>` },
    '146_10': { main: '<p>SNMP(Simple Network Management Protocol)는 TCP/IP 네트워크에서 장비를 관리·감시하기 위한 응용 계층 프로토콜입니다. 네트워크 관리자가 장비의 성능을 모니터링하고 문제를 진단합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — CMIP는 OSI 네트워크 관리 프로토콜로 TCP/IP가 아닌 OSI 모델 기반입니다</p><p>${nums[2]} ${c[2]} — SMTP는 이메일 전송 프로토콜입니다</p><p>${nums[3]} ${c[3]} — POP는 이메일 수신 프로토콜입니다</p>` },
    '146_11': { main: '<p>IP 주소 127.0.0.1은 루프백(Loopback) 테스트용 주소입니다. 자기 자신에게 패킷을 보내 네트워크 스택이 정상적으로 동작하는지 확인하는 데 사용됩니다. 127.x.x.x 전체가 루프백용으로 예약되어 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 모든 네트워크를 의미하는 주소는 0.0.0.0입니다</p><p>${nums[1]} ${c[1]} — 사설 IP는 10.x.x.x, 172.16~31.x.x, 192.168.x.x 범위입니다</p><p>${nums[2]} ${c[2]} — 특정 네트워크의 모든 노드는 브로드캐스트 주소입니다</p>` },
    '146_12': { main: '<p>RARP(Reverse Address Resolution Protocol)는 MAC 주소를 IP 주소로 변환하는 프로토콜입니다. ARP의 반대 과정으로, 디스크 없는 워크스테이션이 자신의 IP 주소를 얻을 때 사용됩니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — ARP는 IP→MAC 변환 프로토콜(RARP의 반대)입니다</p><p>${nums[2]} ${c[2]} — TCP/IP는 프로토콜 스위트의 총칭으로, 주소 변환 기능이 아닙니다</p><p>${nums[3]} ${c[3]} — DHCP는 IP 주소를 자동으로 할당하는 프로토콜입니다</p>` },
    '146_13': { main: '<p>201.100.5.68/28에서 서브넷 마스크는 255.255.255.240입니다. 호스트 부분은 하위 4비트이며, 68(01000100)의 상위 4비트는 0100(64)이므로 네트워크 주소는 201.100.5.64입니다. 범위: 64~79</p>', wrong: `<p>${nums[0]} ${c[0]} — 201.100.5.32는 다른 서브넷(32~47)의 네트워크 주소입니다</p><p>${nums[1]} ${c[1]} — 201.100.5.0은 /24 서브넷의 네트워크 주소입니다</p><p>${nums[3]} ${c[3]} — 201.100.5.31은 서브넷 16~31의 브로드캐스트 주소입니다</p>` },
    '146_14': { main: '<p>IP 주소 중복 감지는 ICMP가 아닌 ARP(Gratuitous ARP)를 통해 수행됩니다. 호스트가 자신의 IP로 ARP 요청을 보내 응답이 오면 IP 충돌을 감지합니다. ICMP는 오류 보고와 진단 메시지를 전달합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 라우터/호스트 간 제어·오류 정보 교환은 ICMP의 기능입니다</p><p>${nums[1]} ${c[1]} — IP 헤더의 문법 오류 발견 시 ICMP로 보고합니다</p><p>${nums[3]} ${c[3]} — 라우터가 데이터를 전달할 수 없을 때 ICMP Destination Unreachable을 보냅니다</p>` },
    '146_15': { main: '<p>TFTP(Trivial File Transfer Protocol)는 TCP가 아닌 UDP를 사용하는 간단한 파일 전송 프로토콜입니다. 따라서 TCP 프로토콜을 사용하지 않습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — FTP는 TCP 포트 20, 21을 사용합니다</p><p>${nums[2]} ${c[2]} — Telnet은 TCP 포트 23을 사용합니다</p><p>${nums[3]} ${c[3]} — SMTP는 TCP 포트 25를 사용합니다</p>` },
    '146_16': { main: '<p>캡슐화(Encapsulation)는 상위 계층의 데이터에 헤더(Header)와 트레일러(Trailer)를 추가하여 하위 계층으로 전달하는 과정입니다. 각 계층은 자신의 제어 정보를 추가합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 동기화는 데이터 전송의 시작과 끝을 식별하는 기능입니다</p><p>${nums[2]} ${c[2]} — 다중화는 여러 신호를 하나의 채널로 합치는 기술입니다</p><p>${nums[3]} ${c[3]} — 주소지정은 송수신자를 식별하기 위한 주소 부여 기능입니다</p>` },
    '146_17': { main: '<p>IGMP는 멀티캐스트 그룹 관리 프로토콜이며, ②의 "데이터의 유니캐스팅에 적합"은 잘못된 설명입니다. IGMP는 멀티캐스트 통신을 위해 호스트가 멀티캐스트 그룹에 가입/탈퇴할 때 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — IGMP에 TTL이 제공되는 것은 맞습니다</p><p>${nums[2]} ${c[2]} — 최초 리포트를 잃으면 갱신 없이 진행하는 것은 IGMP의 특성입니다</p><p>${nums[3]} ${c[3]} — IGMP는 비대칭 프로토콜입니다</p>` },
    '146_18': { main: '<p>클라우드 컴퓨팅의 서비스 분류는 SaaS, PaaS, IaaS입니다. Public 클라우드는 서비스 분류가 아닌 배포 모델(Public, Private, Hybrid) 중 하나입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — SaaS는 소프트웨어를 서비스로 제공하는 클라우드 서비스 유형입니다</p><p>${nums[1]} ${c[1]} — PaaS는 개발 플랫폼을 서비스로 제공하는 클라우드 서비스 유형입니다</p><p>${nums[2]} ${c[2]} — IaaS는 인프라를 서비스로 제공하는 클라우드 서비스 유형입니다</p>` },
    '146_19': { main: '<p>NFV(Network Functions Virtualization)는 네트워크 기능을 전용 하드웨어가 아닌 범용 서버의 소프트웨어로 구현하는 기술입니다. 라우터, 방화벽, 로드밸런서 등을 가상화하여 유연하게 운용합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — WMN은 무선 메시 네트워크로 무선 노드 간 메시 연결 기술입니다</p><p>${nums[2]} ${c[2]} — VPN은 가상 사설 네트워크로 암호화 터널링 기술입니다</p><p>${nums[3]} ${c[3]} — CDN은 콘텐츠 전송 네트워크로 지리적 분산 서버 기술입니다</p>` },
    '146_20': { main: '<p>광섬유 케이블(Optical Fiber Cable)은 빛을 이용하여 데이터를 전송하며, 높은 대역폭과 장거리 전송이 가능합니다. 전자기 간섭에 강하고 보안성이 높습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — U/UTP CAT.3는 음성 통신용 비차폐 연선 케이블입니다</p><p>${nums[1]} ${c[1]} — Thin Coaxial Cable은 10BASE2에 사용되는 얇은 동축 케이블입니다</p><p>${nums[2]} ${c[2]} — U/FTP CAT.5는 차폐 연선 케이블로 구리선 기반입니다</p>` },
    '146_21': { main: '<p>Adaptive ARQ는 전송 효율을 최대화하기 위해 채널 상태에 따라 프레임의 길이를 동적으로 변경하는 ARQ 방식입니다. 채널 품질이 좋으면 긴 프레임, 나쁘면 짧은 프레임을 사용합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — Go-Back-N ARQ는 고정 프레임 길이로 오류 발생 시 해당 프레임부터 재전송합니다</p><p>${nums[2]} ${c[2]} — Selective-Repeat ARQ는 오류 프레임만 선택 재전송하며 프레임 길이는 고정입니다</p><p>${nums[3]} ${c[3]} — Stop and Wait ARQ는 한 프레임씩 확인 후 전송하며 프레임 길이는 고정입니다</p>` },
    '146_22': { main: '<p>NAC(Network Access Control)은 네트워크에 접속하는 단말기의 보안 상태를 점검하고, 정책에 부합하지 않는 기기의 접근을 제어하는 보안 솔루션입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — NIC(Network Interface Card)는 네트워크 인터페이스 카드(하드웨어)입니다</p><p>${nums[1]} ${c[1]} — F/W(Firewall)는 방화벽으로 네트워크 트래픽을 필터링합니다</p><p>${nums[2]} ${c[2]} — IPS는 침입 방지 시스템으로 공격을 탐지하고 차단합니다</p>` },
    '146_23': { main: '<p>버스형(Bus Topology)에서는 양 끝에 터미네이터(Terminator)를 설치하여 신호의 반사를 방지합니다. 터미네이터가 없으면 신호가 케이블 끝에서 반사되어 데이터 충돌이 발생합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 버스형은 문제 위치 파악이 어렵습니다(스타형이 쉬움)</p><p>${nums[1]} ${c[1]} — 중앙 스위치에 연결되는 것은 스타형(Star) 토폴로지입니다</p><p>${nums[3]} ${c[3]} — Token Passing은 링형(Ring)이나 토큰 버스에서 사용됩니다</p>` },
    '146_24': { main: '<p>데이터링크 계층(2계층)은 인접 노드 간의 확실한 데이터 전송, 전송 오류 제어, 흐름 제어를 담당합니다. 물리 계층의 비트 스트림을 프레임으로 구성하여 신뢰성 있는 전송을 보장합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 물리 계층은 비트 수준의 전송만 담당하며 오류 제어는 하지 않습니다</p><p>${nums[1]} ${c[1]} — 네트워크 계층은 라우팅과 논리적 주소 지정을 담당합니다</p><p>${nums[2]} ${c[2]} — 전송 계층은 종단 간(End-to-End) 데이터 전송을 담당합니다</p>` },
    '146_25': { main: '<p>SIP(Session Initiation Protocol)는 음성, 영상 등의 멀티미디어 세션을 설정, 변경, 종료하는 데 사용되는 시그널링 프로토콜입니다. VoIP와 화상 회의에 널리 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — IRC는 인터넷 텍스트 채팅 프로토콜입니다</p><p>${nums[1]} ${c[1]} — HEVC/H.265는 비디오 코덱(압축) 표준으로 세션 제어가 아닙니다</p><p>${nums[2]} ${c[2]} — MIME는 이메일의 멀티미디어 데이터 형식 확장 표준입니다</p>` },
    '146_26': { main: '<p>패킷 교환망에서 데이터 유입량이 많아지면 네트워크 혼잡이 발생하여 오히려 전송속도가 저하됩니다. 패킷 손실, 지연 증가, 재전송 등이 발생합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 가상회선과 데이터그램 분류는 올바릅니다</p><p>${nums[1]} ${c[1]} — 메시지를 짧은 패킷으로 분할하여 전송합니다</p><p>${nums[3]} ${c[3]} — 패킷 교환은 블록킹 현상이 없습니다</p>` },
    '146_27': { main: '<p>TDM(Time Division Multiplexing, 시분할 다중화)은 각 채널에 고정된 타임 슬롯을 할당합니다. 전송할 데이터가 없어도 해당 타임 슬롯이 할당되어 대역폭이 낭비됩니다. STDM은 이 문제를 해결한 통계적 시분할 다중화입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — STDM은 데이터가 있을 때만 타임 슬롯을 할당하여 낭비를 줄입니다</p><p>${nums[2]} ${c[2]} — FDM은 주파수를 분할하여 각 채널에 할당하는 방식입니다</p><p>${nums[3]} ${c[3]} — FDMA는 주파수 분할 다중 접속 방식입니다</p>` },
    '146_28': { main: '<p>웹 서버 보안을 위해 디렉터리 검색(Directory Browsing)은 비활성화해야 합니다. 디렉터리 검색이 활성화되면 공격자가 웹 서버의 파일 구조를 파악할 수 있어 보안 위험이 됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — HTTP 응답 헤더 설정은 보안 강화에 도움됩니다</p><p>${nums[2]} ${c[2]} — SSL 설정은 통신 암호화로 보안을 강화합니다</p><p>${nums[3]} ${c[3]} — 인증 설정은 접근 제어로 보안을 강화합니다</p>` },
    '146_29': { main: '<p>Hyper-V 가상화는 서버 가용성을 향상시킵니다. ④의 "서버 가용성이 줄어든다"는 잘못된 설명입니다. 가상 머신의 실시간 마이그레이션, 장애 조치 클러스터링 등으로 가용성이 증가합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 하드웨어 사용률을 높여 비용을 절감할 수 있습니다</p><p>${nums[1]} ${c[1]} — 가상화로 물리적 하드웨어를 줄일 수 있습니다</p><p>${nums[2]} ${c[2]} — 테스트 환경을 빠르게 재현하여 효율성을 향상시킵니다</p>` },
    '146_30': { main: '<p>chage 명령의 -W 옵션은 패스워드 만료 경고 일수를 설정합니다. chage -W 10 John은 John 사용자에게 만료 10일 전부터 경고를 표시합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — -m 옵션은 패스워드 최소 사용일수를 설정합니다</p><p>${nums[1]} ${c[1]} — -L 옵션은 계정을 잠그는 데 사용됩니다</p><p>${nums[2]} ${c[2]} — -i 옵션은 패스워드 만료 후 비활성화 기간을 설정합니다</p>` },
    '146_31': { main: '<p>/var/log/dmesg는 시스템 부팅 시 커널이 감지한 하드웨어 정보와 시스템 로그를 저장하는 파일입니다. dmesg 명령으로도 커널 링 버퍼의 메시지를 확인할 수 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — /var/log/cron은 cron 작업 관련 로그를 저장합니다</p><p>${nums[1]} ${c[1]} — /var/log/lastlog는 각 사용자의 마지막 로그인 정보를 저장합니다</p><p>${nums[3]} ${c[3]} — /var/log/btmp는 로그인 실패 기록을 저장합니다</p>` },
    '146_32': { main: '<p>MX 레코드의 우선순위 값은 낮을수록 우선순위가 높습니다. ③의 "값이 높을수록 우선순위가 높다"는 반대의 설명으로 잘못되었습니다. 예: MX 10이 MX 20보다 우선합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Zone 파일의 영역명이 icqa.or.kr인 것은 올바릅니다</p><p>${nums[1]} ${c[1]} — 관리자 이메일이 webmaster.icqa.or.kr인 것은 올바릅니다(@를 .으로 표기)</p><p>${nums[3]} ${c[3]} — www의 FQDN이 www.icqa.or.kr인 것은 올바릅니다</p>` },
    '146_33': { main: '<p>netstat의 -t 옵션은 TCP 연결만 표시하는 옵션입니다. ③의 "연결된 이후에 시간을 표시한다"는 잘못된 설명입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — -r 옵션은 라우팅 테이블을 표시합니다</p><p>${nums[1]} ${c[1]} — -p 옵션은 PID와 프로그램명을 출력합니다</p><p>${nums[3]} ${c[3]} — -y 옵션은 TCP 연결 템플릿을 표시합니다</p>` },
    '146_34': { main: '<p>chmod 666 file은 절대 모드로 권한을 설정하여 기존 권한과 관계없이 rw-rw-rw-(666)로 덮어씁니다. 나머지 ②③④는 기존 권한을 유지한 채 쓰기 권한만 추가하므로 결과가 다릅니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — chmod a+w는 모든 사용자에게 쓰기 권한을 추가합니다</p><p>${nums[2]} ${c[2]} — chmod ugo+w는 모든 사용자에게 쓰기 권한을 추가합니다</p><p>${nums[3]} ${c[3]} — chmod go=w는 그룹과 기타에 쓰기 권한만 설정하므로 다른 결과를 낼 수 있지만, 문제의 맥락에서 666이 가장 다른 결과입니다</p>` },
    '146_35': { main: '<p>BitLocker를 사용하려면 TPM(Trusted Platform Module) 칩이 컴퓨터에 장착되어 있어야 합니다. TPM은 암호화 키를 안전하게 저장하고 부팅 무결성을 검증하는 하드웨어 보안 모듈입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — FSRM은 파일 서버 리소스 관리자로 디스크 할당량 관리용입니다</p><p>${nums[1]} ${c[1]} — NTLM은 Windows 인증 프로토콜입니다</p><p>${nums[3]} ${c[3]} — Heartbeat는 클러스터 노드 간 생존 확인 메커니즘입니다</p>` },
    '146_36': { main: '<p>DHCP(Dynamic Host Configuration Protocol) 서버의 주요 역할은 IP 자원을 효율적으로 관리하고, 클라이언트에게 IP 주소를 자동으로 할당하는 것입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — HTTP 압축 구성은 IIS 웹 서버의 기능입니다</p><p>${nums[1]} ${c[1]} — TCP/IP 네트워크의 이름 확인은 DNS 서버의 역할입니다</p><p>${nums[3]} ${c[3]} — 사설→공인 IP 변환은 NAT의 기능입니다</p>` },
    '146_37': { main: '<p>TCP 3-Way Handshake에서 서버가 클라이언트의 SYN 패킷을 수신하면 LISTEN 상태에서 SYN_RECEIVED 상태로 변경됩니다. 이후 SYN+ACK를 보내고 클라이언트의 ACK를 기다립니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — SYN_SENT는 클라이언트가 SYN을 보낸 후의 상태입니다</p><p>${nums[2]} ${c[2]} — ESTABLISHED는 3-Way Handshake가 완료된 후의 상태입니다</p><p>${nums[3]} ${c[3]} — CLOSE는 연결이 종료된 상태입니다</p>` },
    '146_38': { main: '<p>보안 로그는 로그온, 파일 접근, 관리자의 감사 이벤트 등 모든 보안 관련 이벤트를 기록합니다. 감사 정책에 의해 설정된 이벤트가 기록됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 응용 프로그램 로그는 애플리케이션에서 생성한 이벤트를 기록합니다</p><p>${nums[2]} ${c[2]} — 설치 로그는 소프트웨어 설치 관련 이벤트를 기록합니다</p><p>${nums[3]} ${c[3]} — 시스템 로그는 Windows 시스템 구성요소의 이벤트를 기록합니다</p>` },
    '146_39': { main: '<p>useradd -g icqa network 명령은 \'network\'라는 사용자를 생성하면서 -g 옵션으로 \'icqa\' 그룹에 편입시킵니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — useradd network은 그룹 지정 없이 사용자만 생성합니다</p><p>${nums[2]} ${c[2]} — userdel은 사용자를 삭제하는 명령어입니다</p><p>${nums[3]} ${c[3]} — userdel network은 사용자를 삭제하는 명령이며 등록이 아닙니다</p>` },
    '146_40': { main: '<p>Windows Server에서 FTP를 구축하려면 먼저 IIS(Internet Information Services)가 설치되어 있어야 합니다. FTP는 IIS의 역할 서비스로 제공됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Active Directory는 도메인 관리 서비스로 FTP에 필수는 아닙니다</p><p>${nums[1]} ${c[1]} — DNS는 도메인 이름 해석 서비스로 FTP 구축에 필수는 아닙니다</p><p>${nums[3]} ${c[3]} — 데이터베이스 서버는 FTP와 직접적인 관계가 없습니다</p>` },
    '146_41': { main: '<p>Windows Server 백업은 [시작] - [실행] - wbadmin.msc 명령으로 실행할 수 있습니다. Windows Server 백업 기능(wbadmin)은 서버의 데이터와 시스템 상태를 백업합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — diskmgmt.msc는 디스크 관리 콘솔입니다</p><p>${nums[2]} ${c[2]} — hdwwiz.cpl은 하드웨어 추가 마법사입니다</p><p>${nums[3]} ${c[3]} — fsmgmt.msc는 공유 폴더 관리 콘솔입니다</p>` },
    '146_42': { main: '<p>vi 편집기에서 x 명령은 커서 위치의 문자 하나를 삭제합니다. 명령 모드에서 사용하며, Delete 키와 동일한 기능입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — dd는 현재 행 전체를 삭제합니다</p><p>${nums[2]} ${c[2]} — D는 커서 위치부터 행 끝까지 삭제합니다</p><p>${nums[3]} ${c[3]} — dw는 커서 위치부터 한 단어를 삭제합니다</p>` },
    '146_43': { main: '<p>cd ~ 명령은 현재 위치에 관계없이 사용자의 HOME 디렉터리로 이동합니다. ~는 현재 사용자의 홈 디렉터리를 나타내는 쉘 심볼입니다. cd만 입력해도 동일한 효과입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — cd HOME은 HOME이라는 이름의 디렉터리로 이동을 시도합니다</p><p>${nums[1]} ${c[1]} — cd /는 루트 디렉터리(/)로 이동합니다</p><p>${nums[2]} ${c[2]} — cd ../HOME은 상위 디렉터리의 HOME 폴더로 이동을 시도합니다</p>` },
    '146_44': { main: '<p>/etc 디렉터리에 사용자 암호 정보 파일이 위치합니다. /etc/passwd에 사용자 계정 정보가, /etc/shadow에 암호화된 패스워드가 저장됩니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — /sbin은 시스템 관리 명령어가 위치하는 디렉터리입니다</p><p>${nums[2]} ${c[2]} — /home은 사용자 홈 디렉터리가 위치하는 곳입니다</p><p>${nums[3]} ${c[3]} — /lib은 공유 라이브러리 파일이 위치하는 디렉터리입니다</p>` },
    '146_45': { main: '<p>ifconfig eth0 192.168.2.4 up은 eth0 네트워크 인터페이스에 IP 주소 192.168.2.4를 할당하고 활성화(up)하는 올바른 명령어 형식입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 인터페이스 이름(eth0) 없이 IP만 지정하면 올바르지 않습니다</p><p>${nums[2]} ${c[2]} — -up은 올바른 옵션 형식이 아닙니다</p><p>${nums[3]} ${c[3]} — up이 인터페이스명 앞에 오면 올바르지 않습니다</p>` },
    '146_46': { main: '<p>리피터(Repeater)는 OSI 참조 모델의 물리 계층(1계층)에서 동작하는 장치입니다. 전기 신호를 증폭하여 전송 거리를 연장하는 역할을 합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — L3 Switch는 네트워크 계층(3계층)에서 동작합니다</p><p>${nums[1]} ${c[1]} — Bridge는 데이터링크 계층(2계층)에서 동작합니다</p><p>${nums[2]} ${c[2]} — Router는 네트워크 계층(3계층)에서 동작합니다</p>` },
    '146_47': { main: '<p>VLAN(Virtual LAN)은 한 대의 스위치에서 네트워크를 논리적으로 분리하여 여러 대의 스위치처럼 사용할 수 있게 합니다. 트렁크(Trunk) 포트를 통해 여러 VLAN 정보를 전송할 수 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 스패닝 트리 프로토콜(STP)은 루프 방지를 위한 프로토콜입니다</p><p>${nums[2]} ${c[2]} — TFTP는 파일 전송 프로토콜입니다</p><p>${nums[3]} ${c[3]} — VPN은 가상 사설 네트워크로 암호화 터널링 기술입니다</p>` },
    '146_48': { main: '<p>RAID 1은 미러링(Mirroring) 방식으로, 동일한 데이터를 두 디스크에 동시에 기록합니다. 하나의 디스크가 고장나도 다른 디스크에서 데이터를 복구할 수 있어 높은 안정성을 제공합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — RAID 0은 스트라이핑(Striping) 방식으로 데이터를 분산 저장하며 복구 기능이 없습니다</p><p>${nums[2]} ${c[2]} — RAID 2는 비트 단위 스트라이핑과 해밍 코드를 사용합니다</p><p>${nums[3]} ${c[3]} — RAID 3는 바이트 단위 스트라이핑과 전용 패리티 디스크를 사용합니다</p>` },
    '146_49': { main: '<p>OSPF는 Link State 방식의 라우팅 프로토콜로, Distance Vector 방식이 아닙니다. Distance Vector 프로토콜에는 RIP, IGRP, BGP(Path Vector) 등이 있습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — IGRP는 Distance Vector 라우팅 프로토콜입니다</p><p>${nums[1]} ${c[1]} — RIP는 대표적인 Distance Vector 라우팅 프로토콜입니다</p><p>${nums[2]} ${c[2]} — BGP는 Path Vector 방식으로 Distance Vector의 확장입니다</p>` },
    '146_50': { main: '<p>게이트웨이는 OSI 모든 계층에서 동작하여 프로토콜이 다른 네트워크를 연결합니다. ①의 "전송계층만 연결"은 잘못된 설명입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 게이트웨이는 다른 네트워크 간 데이터 형식을 변환합니다</p><p>${nums[2]} ${c[2]} — 데이터 변환으로 인해 병목 현상이 발생할 수 있습니다</p><p>${nums[3]} ${c[3]} — 프로토콜이 다른 네트워크를 연결하는 기능을 제공합니다</p>` },

    // === exam_id 147 ===
    '147_1': { main: '<p>SNMP(Simple Network Management Protocol)는 UDP 세션(포트 161, 162)을 사용하여 네트워크 장비를 관리하는 프로토콜입니다. Manager와 Agent 구조로 MIB 정보를 수집·관리합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — CMIP는 OSI 기반 네트워크 관리 프로토콜로 TCP를 사용합니다</p><p>${nums[1]} ${c[1]} — SMTP는 이메일 전송 프로토콜로 TCP를 사용합니다</p><p>${nums[3]} ${c[3]} — TFTP는 파일 전송 프로토콜로 네트워크 관리용이 아닙니다</p>` },
    '147_2': { main: '<p>④의 "일부 데이터가 손실되어도 치명적이지 않은 프로그램에 적합"은 UDP의 특성입니다. TCP는 연결지향적이며 신뢰성 있는 전송을 보장하므로, 데이터 손실을 허용하지 않는 프로그램에 적합합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — TCP는 연결지향적(Connection-oriented) 프로토콜입니다</p><p>${nums[1]} ${c[1]} — TCP는 신뢰성 있는 전송을 보장합니다</p><p>${nums[2]} ${c[2]} — TCP는 Sliding Window를 이용한 흐름 제어 기능이 있습니다</p>` },
    '147_3': { main: '<p>OSI 2계층(데이터링크 계층)의 PDU는 프레임(Frame)입니다. 계층별 PDU: 응용/표현/세션=데이터, 전송=세그먼트, 네트워크=패킷, 데이터링크=프레임, 물리=비트</p>', wrong: `<p>${nums[0]} ${c[0]} — 7계층(응용)의 PDU는 데이터이며, 세그먼트는 4계층입니다</p><p>${nums[1]} ${c[1]} — 4계층(전송)의 PDU는 세그먼트이며, 패킷은 3계층입니다</p><p>${nums[2]} ${c[2]} — 3계층(네트워크)의 PDU는 패킷이며, 비트는 1계층입니다</p>` },
    '147_4': { main: '<p>OSPF(Open Shortest Path First)는 Link State 라우팅 프로토콜입니다. Dijkstra 알고리즘을 사용하여 최단 경로를 계산하며, 각 라우터가 전체 네트워크 토폴로지를 유지합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — RIP는 Distance Vector 라우팅 프로토콜입니다</p><p>${nums[1]} ${c[1]} — EIGRP는 Distance Vector를 기반으로 한 하이브리드 프로토콜입니다</p><p>${nums[3]} ${c[3]} — BGP는 Path Vector 라우팅 프로토콜입니다</p>` },
    '147_5': { main: '<p>SMTP는 응용 계층(Application Layer)에서 동작하는 이메일 전송 프로토콜입니다. IP, RARP, ARP는 모두 네트워크 계층(인터넷 계층)에서 동작합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — IP는 네트워크 계층(인터넷 계층)에서 동작합니다</p><p>${nums[2]} ${c[2]} — RARP는 네트워크 계층에서 동작합니다</p><p>${nums[3]} ${c[3]} — ARP는 네트워크 계층에서 동작합니다</p>` },
    '147_6': { main: '<p>네트워크 프린터는 항상 동일한 IP 주소가 필요하므로 DHCP(동적 IP 할당)에 부적합합니다. 고정 IP를 설정해야 다른 장치들이 안정적으로 프린터에 접근할 수 있습니다. 교육장용 PC는 유동적이므로 DHCP에 적합합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 웹서버는 고정 IP가 필요하므로 DHCP 부적합이지만, 네트워크 프린터가 더 부적합합니다</p><p>${nums[1]} ${c[1]} — Access Point도 고정 IP가 필요합니다</p><p>${nums[2]} ${c[2]} — 교육장용 PC는 DHCP에 가장 적합합니다</p>` },
    '147_7': { main: '<p>ICMP(Internet Control Message Protocol)는 IP 네트워크에서 오류 보고와 진단을 담당하는 프로토콜입니다. 목적지 도달 불가, 시간 초과, 경로 재지정 등의 메시지를 전달합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — UDP는 비연결형 전송 계층 프로토콜입니다</p><p>${nums[1]} ${c[1]} — TCP는 연결지향형 전송 계층 프로토콜입니다</p><p>${nums[3]} ${c[3]} — ARP는 IP→MAC 주소 변환 프로토콜입니다</p>` },
    '147_8': { main: '<p>B Class에서 6개 서브넷을 만들려면 3비트가 필요합니다(2^3=8≥6). B Class의 기본 마스크 255.255.0.0에서 3번째 옥텟에 3비트를 추가하면 255.255.224.0이 됩니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 255.255.240.0은 4비트로 16개 서브넷이 생겨 과도합니다</p><p>${nums[2]} ${c[2]} — 255.255.248.0은 5비트로 32개 서브넷이 생겨 과도합니다</p><p>${nums[3]} ${c[3]} — 255.255.255.0은 8비트로 256개 서브넷이 생겨 과도합니다</p>` },
    '147_9': { main: '<p>유니캐스트(Unicast)는 한 호스트에서 다른 한 호스트로 1:1 데이터 전송하는 방식입니다. 특정 목적지 IP 주소를 가진 하나의 수신자에게만 패킷을 전달합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 한 호스트에서 여러 호스트로 전송은 멀티캐스트입니다</p><p>${nums[2]} ${c[2]} — 모든 호스트로 전송은 브로드캐스트입니다</p><p>${nums[3]} ${c[3]} — 특정 그룹에 전송은 멀티캐스트입니다</p>` },
    '147_10': { main: '<p>Checksum 필드는 TCP 헤더와 데이터의 무결성을 검증하여 전송 중 발생한 에러를 감지합니다. 수신측에서 체크섬을 재계산하여 일치 여부를 확인합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Offset(Data Offset)은 TCP 헤더의 길이를 나타냅니다</p><p>${nums[2]} ${c[2]} — Source Port는 송신측 포트 번호를 나타냅니다</p><p>${nums[3]} ${c[3]} — Sequence Number는 바이트 순서를 추적하는 필드입니다</p>` },
    '147_11': { main: '<p>IP 프로토콜은 네트워크 계층에 속하며, 실제 패킷을 목적지까지 전달(라우팅)하는 역할을 합니다. 비연결형·비신뢰성 프로토콜로, 에러 제어와 흐름 제어는 상위 계층(TCP)에서 담당합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 프로세스 간 신뢰성 있는 통신은 TCP의 역할입니다</p><p>${nums[2]} ${c[2]} — IP는 오류 감지 및 정정 메커니즘을 포함하지 않습니다</p><p>${nums[3]} ${c[3]} — 슬라이딩 윈도우는 TCP의 흐름 제어 방식입니다</p>` },
    '147_12': { main: '<p>서브넷 마스크에서 Network ID 부분은 1로, Host ID 부분은 0으로 채웁니다. ④의 "Network ID는 0, Host ID는 1"은 반대로 설명하고 있어 잘못되었습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 서브넷팅은 IP 주소 범위를 여러 서브넷으로 분리하는 작업입니다</p><p>${nums[1]} ${c[1]} — 서브넷 마스크로 동일 네트워크 여부를 확인합니다</p><p>${nums[2]} ${c[2]} — 필요한 서브넷 수를 고려하여 마스크 값을 결정합니다</p>` },
    '147_13': { main: '<p>IGMP(Internet Group Management Protocol)는 호스트와 라우터 간에 멀티캐스트 그룹 멤버십을 관리하는 프로토콜입니다. 호스트가 멀티캐스트 그룹에 가입하거나 탈퇴할 때 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — SNMP는 네트워크 장비를 관리하는 프로토콜로 멀티캐스트 관리가 아닙니다</p><p>${nums[1]} ${c[1]} — ICMP는 오류 보고와 진단 프로토콜입니다</p><p>${nums[2]} ${c[2]} — CGMP는 Cisco 전용 그룹 관리 프로토콜입니다</p>` },
    '147_14': { main: '<p>사설 IP Address는 공인 IP 주소의 부족 문제를 해결하기 위해 사용됩니다. 내부 네트워크에서 사설 IP를 사용하고 NAT를 통해 공인 IP로 변환하여 인터넷에 접속합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — B Class 사설 IP 범위는 172.16.0.0~172.31.255.255이며, 172.32.0.0이 아닙니다</p><p>${nums[2]} ${c[2]} — 사설 IP 사용은 의무가 아니며 공인 IP도 사용 가능합니다</p><p>${nums[3]} ${c[3]} — C Class 사설 IP 범위는 192.168.0.0~192.168.255.255입니다</p>` },
    '147_15': { main: '<p>tcpdump -c 20 -w http.cap port 80은 포트 80의 패킷을 20개 캡처하여(-c 20) http.cap 파일에 저장(-w)하는 명령입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — -n은 호스트명을 해석하지 않는 옵션으로, 패킷 수 제한이 아닙니다</p><p>${nums[2]} ${c[2]} — -f는 외부 호스트의 IP를 숫자로 표시하는 옵션이며, -w와 다릅니다</p><p>${nums[3]} ${c[3]} — -n과 -f 조합은 패킷 수 제한과 파일 저장에 적합하지 않습니다</p>` },
    '147_16': { main: '<p>Longest Match Rule(롱기스트 매치 룰)은 라우팅 테이블에서 목적지 IP와 가장 길게 일치하는(서브넷 마스크가 가장 긴) 경로를 선택하는 규칙입니다. 이를 통해 가장 구체적인 경로로 패킷을 전달합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Administrative Distance는 라우팅 프로토콜의 신뢰도를 나타내는 값입니다</p><p>${nums[2]} ${c[2]} — Next-hop Address는 다음 라우터의 주소입니다</p><p>${nums[3]} ${c[3]} — Metric은 경로의 비용(거리)을 나타내는 값입니다</p>` },
    '147_17': { main: '<p>RARP(Reverse ARP)는 MAC 주소를 이용하여 IP 주소를 알아내는 프로토콜입니다. ARP의 역과정으로, 디스크 없는 워크스테이션이 자신의 IP 주소를 얻을 때 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ARP는 IP→MAC 변환 프로토콜입니다</p><p>${nums[1]} ${c[1]} — Proxy ARP는 라우터가 다른 네트워크의 ARP 요청에 대신 응답합니다</p><p>${nums[2]} ${c[2]} — Inverse ARP는 Frame Relay에서 DLCI→IP 변환에 사용됩니다</p>` },
    '147_18': { main: '<p>IDS(Intrusion Detection System, 침입탐지시스템)는 네트워크나 시스템에서 비정상적인 활동이나 침입 시도를 탐지하는 보안 시스템입니다. 미러링 방식으로 트래픽을 감시합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — QoS는 네트워크 서비스 품질 보장 기술입니다</p><p>${nums[1]} ${c[1]} — 방화벽(F/W)은 네트워크 접근을 필터링하는 장비입니다</p><p>${nums[2]} ${c[2]} — IPS는 침입 방지 시스템으로 탐지뿐 아니라 차단까지 수행합니다</p>` },
    '147_19': { main: '<p>CSMA/CD(Carrier Sense Multiple Access/Collision Detection)는 이더넷에서 사용하는 매체 접근 방식입니다. 전송 전 회선을 감지하고, 충돌 발생 시 감지하여 백오프 후 재전송합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Token Passing은 토큰을 순환시켜 전송권을 제어하는 방식입니다</p><p>${nums[1]} ${c[1]} — Demand Priority는 100VG-AnyLAN에서 사용하는 접근 방식입니다</p><p>${nums[2]} ${c[2]} — CSMA/CA는 무선 LAN에서 충돌을 회피하는 방식입니다</p>` },
    '147_20': { main: '<p>성형(Star) 토폴로지에서 하나의 단말장치가 고장나면 해당 단말만 영향을 받고 전체 통신망에는 영향을 주지 않습니다. ③의 설명은 링형(Ring) 토폴로지의 특성입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 성형은 Point-to-Point 방식으로 중앙에 연결됩니다</p><p>${nums[1]} ${c[1]} — 단말장치의 추가와 제거가 쉬운 것은 성형의 장점입니다</p><p>${nums[3]} ${c[3]} — 각 단말이 중앙 컴퓨터를 통해 데이터를 교환합니다</p>` },
    '147_21': { main: '<p>SaaS(Software as a Service)는 웹 브라우저를 통해 소프트웨어를 서비스로 제공하는 클라우드 모델입니다. 일반 사용자가 설치 없이 바로 사용할 수 있으며, Google Docs, Office 365 등이 대표적입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — PaaS는 개발 플랫폼을 제공하며, 대상은 개발자입니다</p><p>${nums[2]} ${c[2]} — IaaS는 인프라(서버, 스토리지 등)를 제공하며, 대상은 IT 관리자입니다</p><p>${nums[3]} ${c[3]} — BPaaS는 비즈니스 프로세스를 서비스로 제공하는 모델입니다</p>` },
    '147_22': { main: '<p>다중화(Multiplexing)는 여러 개의 터미널이 하나의 통신 회선을 공유하여 신호를 전송하고, 수신측에서 다시 개별 신호로 분리(Demultiplexing)하는 기술입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — MODEM은 디지털↔아날로그 신호 변환 장치입니다</p><p>${nums[2]} ${c[2]} — DSU는 디지털 회선 접속 장치입니다</p><p>${nums[3]} ${c[3]} — CODEC은 코더-디코더로 아날로그↔디지털 변환 장치입니다</p>` },
    '147_23': { main: '<p>IPv6의 일반적인 특징은 128비트 주소 체계, 향상된 QoS, IPSec 내장 보안, 자동 주소 설정(SLAAC), 브로드캐스트 대신 멀티캐스트/애니캐스트 사용 등입니다. A, C, D, E가 올바른 특징입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — A,B,C,D 중 B가 IPv6 특징이 아닌 항목입니다</p><p>${nums[2]} ${c[2]} — B,C,D,E 중 B가 IPv6 특징이 아닙니다</p><p>${nums[3]} ${c[3]} — B,D,E,F 중 B가 IPv6 특징이 아닙니다</p>` },
    '147_24': { main: '<p>표현 계층(Presentation Layer, 6계층)은 데이터의 암호화/복호화, 인증, 압축/해제, 데이터 형식 변환 등의 기능을 수행합니다. 응용 계층과 세션 계층 사이에서 데이터 표현을 담당합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 전송 계층은 종단 간 데이터 전송과 흐름 제어를 담당합니다</p><p>${nums[1]} ${c[1]} — 데이터링크 계층은 프레임 구성과 에러 제어를 담당합니다</p><p>${nums[3]} ${c[3]} — 응용 계층은 사용자 인터페이스와 네트워크 서비스를 제공합니다</p>` },
    '147_25': { main: '<p>WPAN(Wireless Personal Area Network)은 개인 영역의 근거리 무선 네트워크입니다. Bluetooth, ZigBee, NFC 등이 WPAN 기술에 해당하며, 수 미터 범위 내에서 동작합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — LTE-M은 저전력 광역 IoT 통신 기술입니다</p><p>${nums[2]} ${c[2]} — NB-IoT는 좁은 대역의 IoT 전용 통신 기술입니다</p><p>${nums[3]} ${c[3]} — LAN은 근거리 통신망으로 WPAN보다 넓은 범위입니다</p>` },
    '147_26': { main: '<p>OSI 참조 모델에서 전송 계층은 네트워크 계층이 제공하는 서비스를 이용하고, 세션 계층에 서비스를 제공합니다. 각 계층은 바로 아래 계층의 서비스를 이용하고 바로 위 계층에 서비스를 제공하는 구조입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 각 계층은 상위 계층의 데이터(헤더 포함)에 자신의 헤더를 추가합니다</p><p>${nums[2]} ${c[2]} — 모든 계층에 트레일러가 추가되는 것은 아닙니다(데이터링크 계층만)</p><p>${nums[3]} ${c[3]} — OSI 모델의 각 계층은 독립적으로 설계할 수 있습니다</p>` },
    '147_27': { main: '<p>SDN(Software Defined Networking)은 네트워크의 제어 기능을 데이터 전달 기능과 분리하여 소프트웨어로 네트워크를 프로그래밍하고 관리하는 기술입니다. 중앙 컨트롤러가 네트워크를 제어합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — PSDN은 공중 데이터 교환망입니다</p><p>${nums[1]} ${c[1]} — Internet은 글로벌 네트워크 자체를 의미합니다</p><p>${nums[2]} ${c[2]} — VPN은 가상 사설 네트워크로 암호화 터널링 기술입니다</p>` },
    '147_28': { main: '<p>diskpart는 디스크 파티션 관리 명령어로, Windows Server 백업과는 관련이 없습니다. 나머지 ①②③은 모두 Windows Server 백업을 실행하는 올바른 방법입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — wbadmin.msc 실행은 올바른 백업 실행 방법입니다</p><p>${nums[1]} ${c[1]} — 제어판을 통한 접근은 올바른 방법입니다</p><p>${nums[2]} ${c[2]} — 컴퓨터 관리를 통한 접근은 올바른 방법입니다</p>` },
    '147_29': { main: '<p>Universal Group(유니버설 그룹)은 포리스트 내 모든 도메인의 사용자와 그룹을 포함할 수 있어 관리 편의성이 높습니다. 도메인 간 자원 접근 관리에 유용합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Global Group은 동일 도메인 내의 사용자만 포함할 수 있습니다</p><p>${nums[1]} ${c[1]} — Domain Local Group은 동일 도메인의 자원에만 접근 권한을 부여합니다</p><p>${nums[3]} ${c[3]} — OU(조직 단위)는 그룹이 아닌 AD의 관리 단위입니다</p>` },
    '147_30': { main: '<p>DNS 라운드 로빈(Round Robin)은 하나의 도메인에 여러 IP 주소를 등록하고, 클라이언트 요청 시 순환적으로 다른 IP를 응답하여 부하를 분산하는 방식입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 캐시 플러그인은 DNS 관련 설정 방식이 아닙니다</p><p>${nums[2]} ${c[2]} — 캐시 서버는 DNS 쿼리 결과를 캐싱하는 서버입니다</p><p>${nums[3]} ${c[3]} — Azure Auto Scaling은 클라우드 자동 확장 기능입니다</p>` },
    '147_31': { main: '<p>SOA 레코드에서 책임자 이메일은 @ 대신 점(.)으로 구분하여 기입합니다. 예: webmaster.icqa.or.kr (= webmaster@icqa.or.kr). ③의 "webmaster@icqa.or.kr 형식으로 기입한다"는 잘못된 설명입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 일련번호는 영역 파일의 개정 번호입니다</p><p>${nums[1]} ${c[1]} — 주 서버는 해당 영역이 초기에 설정되는 서버입니다</p><p>${nums[3]} ${c[3]} — 새로 고침 간격은 보조 서버의 변경 검사 대기 시간입니다</p>` },
    '147_32': { main: '<p>cp ../abc.txt ~ 명령은 상위 디렉터리(..)에 있는 abc.txt 파일을 현재 사용자의 홈 디렉터리(~)로 복사합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — cp ~/abc.txt ..는 홈 디렉터리의 파일을 상위 디렉터리로 복사합니다(반대 방향)</p><p>${nums[1]} ${c[1]} — cp ~/abc.txt /는 홈 디렉터리의 파일을 루트 디렉터리로 복사합니다</p><p>${nums[2]} ${c[2]} — cp ../abc.txt /는 상위 디렉터리의 파일을 루트 디렉터리로 복사합니다</p>` },
    '147_33': { main: '<p>:10,20s/old/new/g는 vi 편집기에서 10행부터 20행까지의 모든 \'old\'를 \'new\'로 치환하는 명령입니다. /g 플래그는 각 행의 모든 일치 항목을 치환합니다(없으면 행당 첫 번째만).</p>', wrong: `<p>${nums[0]} ${c[0]} — :10,20s/old/new는 각 행의 첫 번째 old만 치환합니다</p><p>${nums[2]} ${c[2]} — :10,20r은 파일을 읽어오는 명령이며 치환이 아닙니다</p><p>${nums[3]} ${c[3]} — :10,20r/old/new/a는 유효한 vi 명령이 아닙니다</p>` },
    '147_34': { main: '<p>저장소 복제(Storage Replica)는 Windows Server 2016에서 추가된 기능으로, 서버 간 블록 수준의 동기 복제를 제공합니다. 데이터 손실 없이 장애 복구가 가능합니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — DirectAccess는 원격 접속을 위한 VPN 대체 기술입니다</p><p>${nums[2]} ${c[2]} — 클라우드 폴더(Work Folders)는 파일 동기화 기능입니다</p><p>${nums[3]} ${c[3]} — Nano Server는 최소 설치 옵션의 경량 서버입니다</p>` },
    '147_35': { main: '<p>rmdir(remove directory)은 Linux에서 빈 디렉터리를 삭제하는 명령어입니다. 내용이 있는 디렉터리를 삭제하려면 rm -r을 사용합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — mkdir은 디렉터리를 생성하는 명령어입니다</p><p>${nums[1]} ${c[1]} — deldir은 Linux에 존재하지 않는 명령어입니다</p><p>${nums[3]} ${c[3]} — pwd는 현재 디렉터리 경로를 표시하는 명령어입니다</p>` },
    '147_36': { main: '<p>/etc/fstab 파일은 시스템 부팅 시 자동으로 마운트할 파일시스템의 정보(장치명, 마운트 포인트, 파일시스템 유형, 옵션 등)가 정의되어 있습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — /usr/local은 사용자가 설치한 소프트웨어가 위치하는 디렉터리입니다</p><p>${nums[2]} ${c[2]} — /mount/cdrom은 CD-ROM 마운트 포인트로, 설정 파일이 아닙니다</p><p>${nums[3]} ${c[3]} — /home/public_html은 사용자 웹 페이지 디렉터리입니다</p>` },
    '147_37': { main: '<p>PowerShell은 기존 DOS(cmd) 명령어를 대부분 사용할 수 있습니다. dir, cd, cls 등의 명령어를 별칭(alias)으로 지원합니다. ①의 "기존 DOS 명령은 사용할 수 없다"는 잘못된 설명입니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — PowerShell 스크립트는 콘솔에서 대화형으로 사용할 수 있습니다</p><p>${nums[2]} ${c[2]} — PowerShell 스크립트는 텍스트(.ps1)로 구성됩니다</p><p>${nums[3]} ${c[3]} — PowerShell은 대소문자를 구분하지 않습니다</p>` },
    '147_38': { main: '<p>PTR(Pointer) 레코드는 역방향 조회에 사용되는 DNS 레코드로, IP 주소를 도메인 이름으로 변환합니다. in-addr.arpa 도메인에서 사용됩니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Host(A) 레코드는 정방향 조회(도메인→IP)에 사용됩니다</p><p>${nums[2]} ${c[2]} — SOA 레코드는 영역의 권한 시작 정보를 담습니다</p><p>${nums[3]} ${c[3]} — NS 레코드는 네임서버를 지정하는 레코드입니다</p>` },
    '147_39': { main: '<p>pwd(print working directory)는 현재 작업 중인 디렉터리의 경로를 절대경로로 출력하는 명령어입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — cd는 디렉터리를 이동하는 명령어입니다</p><p>${nums[1]} ${c[1]} — man은 명령어의 매뉴얼 페이지를 표시합니다</p><p>${nums[3]} ${c[3]} — cron은 예약 작업을 관리하는 데몬입니다</p>` },
    '147_40': { main: '<p>Power Users 그룹은 Windows Server 2016에서는 하위 호환성을 위해 존재하지만 기본 그룹으로 활발히 사용되지 않습니다. Replicator, Backup Operators, Access Control Assistance Operators는 기본 제공되는 그룹입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — Replicator는 도메인의 파일 복제를 담당하는 기본 그룹입니다</p><p>${nums[2]} ${c[2]} — Backup Operators는 백업/복원 권한을 가진 기본 그룹입니다</p><p>${nums[3]} ${c[3]} — Access Control Assistance Operators는 접근 제어 지원 그룹입니다</p>` },
    '147_41': { main: '<p>/bin 디렉터리는 Linux 시스템의 기본 명령어(ls, cp, mv, cat, mkdir 등)가 포함되어 있는 디렉터리입니다. 모든 사용자가 사용할 수 있는 필수 명령어가 위치합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — /dev는 장치 파일(device files)이 위치하는 디렉터리입니다</p><p>${nums[1]} ${c[1]} — /lib은 공유 라이브러리 파일이 위치하는 디렉터리입니다</p><p>${nums[3]} ${c[3]} — /etc는 시스템 설정 파일이 위치하는 디렉터리입니다</p>` },
    '147_42': { main: '<p>crontab -r 명령은 현재 사용자의 crontab(예약 작업) 설정을 삭제합니다. 실수로 실행하면 모든 예약 작업이 삭제되므로 주의가 필요합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — crontab -u는 특정 사용자의 crontab을 지정하는 옵션입니다</p><p>${nums[1]} ${c[1]} — crontab -e는 crontab을 편집하는 명령입니다</p><p>${nums[2]} ${c[2]} — crontab -l은 현재 crontab 내용을 조회하는 명령입니다</p>` },
    '147_43': { main: '<p>nslookup은 DNS 서버에 질의하여 도메인의 IP 주소를 조회하는 명령어입니다. nslookup icqa.or.kr은 icqa.or.kr 도메인의 IP 주소를 보여줍니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — netstat는 네트워크 연결 상태를 확인하는 명령어입니다</p><p>${nums[1]} ${c[1]} — ipconfig /query는 존재하지 않는 옵션입니다</p><p>${nums[2]} ${c[2]} — dnslookup은 존재하지 않는 명령어입니다</p>` },
    '147_44': { main: '<p>삼바(SAMBA)는 Linux/Unix 시스템에서 Windows의 SMB/CIFS 프로토콜을 구현하여 이기종 OS 간 파일과 프린터를 공유할 수 있게 합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 분산 파일 시스템(DFS)은 Windows Server의 파일 공유 통합 기능입니다</p><p>${nums[2]} ${c[2]} — ODBC는 데이터베이스 연결 표준 인터페이스입니다</p><p>${nums[3]} ${c[3]} — FTP는 파일 전송 프로토콜로 OS 간 파일 공유 기능이 아닙니다</p>` },
    '147_45': { main: '<p>Linux에서 사용자 계정을 삭제하는 명령어는 userdel이며, delete는 존재하지 않는 명령어입니다. ④의 설명이 잘못되었습니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — chsh는 사용자의 기본 셸을 변경하는 명령어입니다</p><p>${nums[1]} ${c[1]} — touch는 빈 파일을 생성하거나 타임스탬프를 변경합니다</p><p>${nums[2]} ${c[2]} — free는 메모리 사용 현황을 표시하는 명령어입니다</p>` },
    '147_46': { main: '<p>Hub(허브)는 OSI 물리 계층(1계층)에서 동작하는 네트워크 장비입니다. 수신한 신호를 모든 포트로 브로드캐스트하며, 충돌 도메인을 분리하지 않습니다.</p>', wrong: `<p>${nums[1]} ${c[1]} — 세션 계층(5계층)에서 동작하는 장비는 Hub가 아닙니다</p><p>${nums[2]} ${c[2]} — 트랜스포트 계층(4계층)에서 동작하는 장비가 아닙니다</p><p>${nums[3]} ${c[3]} — 애플리케이션 계층(7계층)에서 동작하는 장비가 아닙니다</p>` },
    '147_47': { main: '<p>RAID 1은 미러링(Mirroring) 방식으로, 한 드라이브의 모든 데이터를 다른 드라이브에 동일하게 복사합니다. 디스크 장애 시 복사본에서 즉시 복구할 수 있어 높은 안정성을 제공합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — RAID 0은 스트라이핑 방식으로 백업 없이 성능만 향상됩니다</p><p>${nums[2]} ${c[2]} — RAID 3은 바이트 단위 스트라이핑과 전용 패리티 디스크를 사용합니다</p><p>${nums[3]} ${c[3]} — RAID 4는 블록 단위 스트라이핑과 전용 패리티 디스크를 사용합니다</p>` },
    '147_48': { main: '<p>NAT(Network Address Translation)는 내부 사설 IP 주소를 외부 공인 IP 주소로 변환하는 기술입니다. 내부 네트워크는 사설 IP를 사용하고, 외부와 통신할 때만 공인 IP로 변환합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — ARP는 IP→MAC 주소 변환 프로토콜입니다</p><p>${nums[2]} ${c[2]} — ICMP는 오류 보고와 진단 프로토콜입니다</p><p>${nums[3]} ${c[3]} — DHCP는 IP 주소를 자동으로 할당하는 프로토콜입니다</p>` },
    '147_49': { main: '<p>Docker는 컨테이너 기반 가상화 플랫폼으로, 애플리케이션을 컨테이너에 패키징하여 경량화된 가상 환경에서 실행합니다. 하이퍼바이저 없이 호스트 OS의 커널을 공유합니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — VirtualBox는 전체 가상화 소프트웨어(하이퍼바이저)입니다</p><p>${nums[1]} ${c[1]} — VMware는 하이퍼바이저 기반의 전체 가상화 소프트웨어입니다</p><p>${nums[2]} ${c[2]} — Xen은 오픈소스 하이퍼바이저입니다</p>` },
    '147_50': { main: '<p>리피터는 신호를 증폭하여 전송 거리를 연장하는 장비이지만, 충돌 도메인을 분리하지 못합니다. ④에서 설명하는 충돌 도메인 분리는 브리지(Bridge)나 스위치(Switch)의 역할입니다.</p>', wrong: `<p>${nums[0]} ${c[0]} — 리피터는 전송 매체상의 신호를 수신하여 증폭 후 재전송합니다</p><p>${nums[1]} ${c[1]} — 신호 감쇠를 보상하여 먼 거리까지 데이터를 전달합니다</p><p>${nums[2]} ${c[2]} — LAN 세그먼트를 확장하거나 연결하는 데 사용됩니다</p>` },
  };

  const d = data[key];
  if (d) return d;

  // 기본 해설 (데이터가 없는 경우)
  const ai = answer - 1;
  const wrongParts = c.map((choice, i) => {
    if (i === ai) return null;
    return `<p>${nums[i]} ${choice} — 오답</p>`;
  }).filter(Boolean).join('');
  return { main: `<p>${c[ai]}이(가) 정답입니다.</p>`, wrong: wrongParts };
}

async function main() {
  let totalUpdated = 0;

  for (const examId of [144, 145, 146, 147]) {
    const answerList = answers[examId];
    if (!answerList || answerList.length !== 50) {
      console.error(`exam_id ${examId}: 정답 ${answerList ? answerList.length : 0}개 (50개 필요)`);
      process.exit(1);
    }

    // 문제 조회
    const res = await query(
      'SELECT id, question_number, body, choices FROM questions WHERE exam_id=$1 ORDER BY question_number',
      [examId]
    );

    if (res.rows.length !== 50) {
      console.error(`exam_id ${examId}: DB에 ${res.rows.length}개 문제 (50개 필요)`);
      process.exit(1);
    }

    console.log(`\n=== exam_id ${examId}: 2022년 정기 ${examId - 143}회 ===`);

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const answer = answerList[i];
      const choices = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
      const choiceTexts = choices.map(c => typeof c === 'object' ? (c.text || c.label) : c);

      if (answer < 1 || answer > 4) {
        console.error(`exam_id ${examId}, Q${row.question_number}: answer=${answer} 범위 오류`);
        process.exit(1);
      }

      const explanation = generateExplanation(examId, row.question_number, answer, row.body, choiceTexts);

      await query(
        'UPDATE questions SET answer=$1, explanation=$2, updated_at=NOW() WHERE id=$3',
        [answer, explanation, row.id]
      );

      console.log(`  Q${row.question_number} [id:${row.id}] → 정답: ${answer} (${choiceTexts[answer - 1].substring(0, 30)})`);
      totalUpdated++;
    }
  }

  console.log(`\n총 ${totalUpdated}문제 완료`);
  const pool = getPool();
  await pool.end();
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
