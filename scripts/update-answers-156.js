// 네트워크관리사2급 2025년 1회 (exam_id: 156) 정답+해설 업데이트
require('dotenv').config();
const { query, getPool } = require('../api/db');

const answers = [
  // Q1: TTL - IP 패킷은 영원히 존재할 수 없다 (TTL이 0이 되면 폐기)
  { qn: 1, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① IP 패킷은 네트워크상에서 영원히 존재할 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TTL(Time To Live)은 IP 패킷이 네트워크에서 무한히 순환하는 것을 방지하기 위한 필드입니다. 라우터를 통과할 때마다 TTL 값이 1씩 감소하며, 0이 되면 패킷은 폐기됩니다. 따라서 IP 패킷은 영원히 존재할 수 없습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — 라우터의 홉을 통과할 때마다 TTL이 1씩 감소하는 것은 올바른 설명입니다.</p><p>③ — Ping과 Tracert는 TTL 값을 활용하여 네트워크 경로를 추적합니다.</p><p>④ — TTL은 패킷의 생존 기간을 나타내는 것이 맞습니다.</p></div>` },

  // Q2: IP Class - 191은 B Class(128~191), 나머지는 C Class(192~223)
  { qn: 2, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 191.234.149.32</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IP 주소의 Class는 첫 번째 옥텟으로 구분합니다. Class B는 128~191, Class C는 192~223입니다. 191.234.149.32는 B Class이고, 나머지 198, 222, 195는 모두 C Class입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 198.236.115.33 — C Class (192~223)</p><p>③ 222.236.138.34 — C Class (192~223)</p><p>④ 195.236.126.35 — C Class (192~223)</p></div>` },

  // Q3: C Class 6개 서브넷 → 3비트 필요(2^3=8≥6) → 255.255.255.224
  { qn: 3, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ 255.255.255.224</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>6개의 서브넷이 필요하면 최소 3비트가 필요합니다(2³=8≥6). C Class의 호스트 부분 8비트 중 3비트를 서브넷에 사용하면 서브넷 마스크는 255.255.255.224(11100000)가 됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 255.255.255.0 — 서브넷 분할 없음 (0비트)</p><p>② 255.255.255.192 — 2비트 사용, 최대 4개 서브넷으로 부족</p><p>④ 255.255.255.240 — 4비트 사용, 16개 서브넷으로 과도함</p></div>` },

  // Q4: IPv6 Hop Limit = IPv4 TTL
  { qn: 4, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ Hop Limit</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IPv6 헤더의 Hop Limit 필드는 IPv4의 TTL과 동일한 역할을 합니다. 데이터그램이 라우터를 거칠 때마다 1씩 감소하며, 0이 되면 패킷이 폐기되어 네트워크 내 생존 기간을 제어합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Version — IP 버전을 나타내는 필드(6)</p><p>② Priority — 트래픽 우선순위를 나타내는 필드</p><p>③ Next Header — 다음 확장 헤더 또는 상위 프로토콜을 식별</p></div>` },

  // Q5: TCP는 실시간 통신에 부적합 (UDP가 적합)
  { qn: 5, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 한 번에 많은 데이터의 전송에 유리하기 때문에 화상 통신과 같은 실시간 통신에 사용된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>화상 통신 같은 실시간 통신에는 TCP가 아닌 UDP가 사용됩니다. TCP는 신뢰성 보장을 위한 오버헤드(3-way handshake, 재전송 등)로 인해 지연이 발생하여 실시간 통신에 부적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — TCP는 동적 슬라이딩 윈도우 방식의 흐름 제어를 사용합니다.</p><p>③ — TCP는 에러 제어로 신뢰성 있는 데이터 전송을 보장합니다.</p><p>④ — TCP는 3-way handshake로 연결을 설정합니다.</p></div>` },

  // Q6: UDP 헤더에 ACK 번호 없음
  { qn: 6, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 확인 응답 번호(Acknowledgment Number)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>UDP 헤더는 Source Port, Destination Port, Length, Checksum 4개 필드로 구성됩니다. Acknowledgment Number는 TCP 헤더에만 있는 필드로, UDP는 비연결형 프로토콜이므로 확인 응답 기능이 없습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — Source Port는 UDP 헤더에 포함됩니다.</p><p>③ — Checksum은 UDP 헤더에 포함됩니다.</p><p>④ — Destination Port는 UDP 헤더에 포함됩니다.</p></div>` },

  // Q7: ICMP Type 3 = Destination Unreachable, Echo Reply는 Type 0
  { qn: 7, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 3 - Echo Request 질의 메시지에 응답하는데 사용된다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ICMP Type 3은 Destination Unreachable(목적지 도달 불가) 메시지입니다. Echo Reply는 Type 0이며, Echo Request는 Type 8입니다. Type 3이 Echo Request에 응답한다는 설명은 틀렸습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Type 4 — Source Quench로 흐름제어 및 폭주제어에 사용됩니다.</p><p>③ Type 5 — Redirect로 대체 경로를 알리는 데 사용됩니다.</p><p>④ Type 17 — Address Mask Request로 서브넷 마스크 요청에 사용됩니다.</p></div>` },

  // Q8: 같은 네트워크 모든 호스트 = Broadcast
  { qn: 8, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② Broadcast</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Broadcast는 같은 네트워크상의 모든 호스트에게 데이터를 전송하는 방식입니다. Unicast는 1:1, Multicast는 특정 그룹에게 전송합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Unicast — 특정 한 호스트에게만 전송</p><p>③ Multicast — 특정 그룹의 호스트들에게 전송</p><p>④ UDP — 전송 방식이 아닌 전송 계층 프로토콜</p></div>` },

  // Q9: SNMP는 UDP 사용 (TCP 아님)
  { qn: 9, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① TCP를 이용하여 신뢰성 있는 통신을 한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SNMP는 UDP 포트 161/162를 사용합니다. TCP가 아닌 UDP를 사용하므로 "TCP를 이용하여 신뢰성 있는 통신을 한다"는 틀린 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — SNMP는 네트워크 관리를 위한 표준 프로토콜입니다.</p><p>③ — SNMP는 OSI 응용 계층 프로토콜입니다.</p><p>④ — SNMP는 RFC 1157에 규정되어 있습니다.</p></div>` },

  // Q10: IPv6 주소 = 128비트, 8그룹 16진수
  { qn: 10, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 3ffe:1900:4545:0003:0200:f8ff:ffff:1105</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IPv6 주소는 128비트로 16진수 8그룹(콜론 구분)으로 표기합니다. 보기 ②가 8그룹의 올바른 IPv6 주소 형식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 192.168.1.30 — IPv4 주소 형식</p><p>③ 00:A0:C3:4B:21:33 — MAC 주소 형식</p><p>④ 0000:002A:0080:c703:3c75 — 5그룹으로 IPv6 형식 불완전</p></div>` },

  // Q11: 2계층 PDU = 프레임
  { qn: 11, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ 2계층 : 프레임</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>OSI 계층별 PDU: 7계층=데이터(메시지), 4계층=세그먼트, 3계층=패킷, 2계층=프레임, 1계층=비트입니다. 2계층의 PDU가 프레임인 것이 올바릅니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 7계층은 데이터(메시지)이지 세그먼트가 아닙니다.</p><p>② 4계층은 세그먼트이지 패킷이 아닙니다.</p><p>③ 3계층은 패킷이지 비트가 아닙니다.</p></div>` },

  // Q12: 127.x.x.x = Loopback
  { qn: 12, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ 루프백(Loopback) 주소</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>127.0.0.0/8 대역은 루프백(Loopback) 주소로 예약되어 있습니다. 자기 자신을 테스트하는 용도로 사용되며, 대표적으로 127.0.0.1이 사용됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 제한적 브로드캐스트 주소는 255.255.255.255입니다.</p><p>② 멀티캐스트 주소는 D Class(224~239)입니다.</p><p>③ C Class 사설 IP는 192.168.0.0/16 대역입니다.</p></div>` },

  // Q13: 전자우편 = SMTP
  { qn: 13, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② SMTP</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SMTP(Simple Mail Transfer Protocol)는 전자우편 전송을 위한 응용 계층 프로토콜입니다. TCP 포트 25를 사용하며, 메일 서버 간 또는 클라이언트에서 서버로 이메일을 전송합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SNMP — 네트워크 관리 프로토콜</p><p>③ VT — 가상 터미널 프로토콜</p><p>④ FTP — 파일 전송 프로토콜</p></div>` },

  // Q14: FTP는 TCP 사용 (69번 포트는 TFTP)
  { qn: 14, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ 프로토콜의 기본 기능인 파일 복사 작업은 복잡하지 않기 때문에 UDP프로토콜을 사용하는 것이 효율적이고 69번 포트를 통해 데이터를 전송한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>FTP는 TCP 프로토콜을 사용하며 포트 20(데이터), 21(제어)을 사용합니다. UDP 69번 포트를 사용하는 것은 TFTP(Trivial FTP)입니다. FTP와 TFTP를 혼동한 잘못된 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — FTP 세션으로 원격 파일 복사가 가능합니다.</p><p>② — FTP 서버는 포트 20으로 데이터 채널을 설정합니다.</p><p>③ — 데이터 채널은 파일 전송마다 새로 설정되고 완료 후 해제됩니다.</p></div>` },

  // Q15: DNS는 보안 장비가 아님
  { qn: 15, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ 방화벽과 같은 보안 장비 중 하나다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS는 도메인 이름을 IP 주소로 변환하는 이름 해석 서비스이며, 보안 장비가 아닙니다. 방화벽(Firewall)과는 완전히 다른 역할을 수행합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — DNS는 도메인 이름을 IP 주소로 변환합니다.</p><p>② — DNS는 여러 IP에 대해 로드 밸런싱 기능을 제공합니다.</p><p>④ — DNS는 캐싱을 통해 응답 속도를 향상시킵니다.</p></div>` },

  // Q16: 송신 시 캡슐화, 수신 시 역캡슐화
  { qn: 16, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ (A) 캡슐화, (B) 역캡슐화</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>OSI 모델에서 데이터 전송 시 각 계층에서 헤더를 추가하는 과정을 캡슐화(Encapsulation), 수신 시 헤더를 제거하는 과정을 역캡슐화(Decapsulation)라고 합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① (A)암호화,(B)복호화 — 보안 관련 용어로 계층 구조와 무관</p><p>② (A)복호화,(B)암호화 — 순서가 반대이며 보안 용어</p><p>④ (A)역캡슐화,(B)캡슐화 — 순서가 반대</p></div>` },

  // Q17: ARP Cache 보관
  { qn: 17, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ 각 시스템에 Address Resolution Protocol Cache가 있고 Cache 정보를 보관한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ARP는 IP 주소를 MAC 주소로 변환하는 프로토콜입니다. 각 시스템은 ARP Cache를 유지하여 이전에 해석한 IP-MAC 매핑 정보를 저장하고, 이후 같은 IP에 대한 요청 시 캐시를 활용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — ARP는 수신측의 물리주소(MAC) 정보가 없을 때 브로드캐스트하지만, 논리주소(IP)는 알고 있습니다.</p><p>② — ARP Reply를 전송하는 것이지 ARP 자체를 전송하는 것이 아닙니다.</p><p>④ — ARP는 IP 주소를 MAC 주소로 변환합니다(반대가 RARP).</p></div>` },

  // Q18: Loop/Echo는 흐름제어가 아닌 오류검출 방식
  { qn: 18, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ Loop/Echo</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Loop/Echo는 데이터를 되돌려 보내 원본과 비교하는 오류 검출 방식으로, 흐름 제어와는 관련이 없습니다. Stop and Wait, XON/XOFF, Sliding Window는 모두 흐름 제어 기법입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Stop and Wait — 대표적인 흐름 제어 방식</p><p>② XON/XOFF — 소프트웨어 흐름 제어 방식</p><p>④ Sliding Window — 효율적인 흐름 제어 방식</p></div>` },

  // Q19: 압축/암호화는 표현 계층(6계층) 기능
  { qn: 19, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ Text의 압축, 암호화 기능</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>데이터의 압축과 암호화는 OSI 표현 계층(6계층)의 기능입니다. 데이터 링크 계층(2계층)은 프레임 동기화, 오류 제어, 흐름 제어, 링크 관리 등을 담당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 전송 오류 제어는 데이터 링크 계층의 주요 기능입니다.</p><p>② — 흐름 제어는 데이터 링크 계층의 기능입니다.</p><p>④ — 링크 관리는 데이터 링크 계층의 기능입니다.</p></div>` },

  // Q20: Star형 - 하나의 단말 고장이 전체에 영향 주지 않음
  { qn: 20, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ 하나의 단말장치가 고장나면 전체 통신망에 영향을 줄 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>성형(Star) 토폴로지에서 개별 단말 장치의 고장은 해당 단말만 영향을 받고 전체 네트워크에는 영향을 주지 않습니다. 단, 중앙 허브/스위치가 고장나면 전체 네트워크에 영향을 줍니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — Star형은 중앙 장치와 각 노드가 Point-to-Point로 연결됩니다.</p><p>② — 중앙에서 연결을 관리하므로 단말 추가/제거가 쉽습니다.</p><p>④ — 모든 데이터는 중앙 컴퓨터를 통해 교환됩니다.</p></div>` },

  // Q21: 충돌 감지 후 재전송 = CSMA/CD (표 내용 기반)
  { qn: 21, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ CSMA/CD</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>CSMA/CD(Carrier Sense Multiple Access/Collision Detection)는 이더넷에서 사용하는 매체 접근 방식으로, 전송 전 채널을 감지하고 충돌 발생 시 임의 시간 후 재전송합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Token Ring — 토큰을 사용한 순차적 접근 방식</p><p>② Token Bus — 버스 토폴로지에서 토큰 사용</p><p>④ Slotted Ring — 슬롯 기반 링 전송 방식</p></div>` },

  // Q22: 통신 속도/메시지 순서 = Timing
  { qn: 22, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 타이밍(Timing)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>프로토콜의 3요소 중 타이밍(Timing)은 통신 속도, 메시지 순서, 데이터 전송 시점 등의 제어 정보를 담당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② 의미(Semantics) — 각 비트의 의미와 해석을 정의</p><p>③ 구문(Syntax) — 데이터의 형식, 부호화, 신호 레벨 정의</p><p>④ 처리(Process) — 프로토콜의 기본 요소가 아님</p></div>` },

  // Q23: 고속 전송, 대용량 = 광케이블
  { qn: 23, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ Optical Fiber Cable</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>광케이블(Optical Fiber Cable)은 빛을 이용하여 데이터를 전송하며, 고속 대용량 전송이 가능하고 전자기 간섭에 영향을 받지 않는 특성이 있습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① U/UTP CAT.3 — 10Mbps 이더넷용 비차폐 케이블</p><p>② Thin Coaxial Cable — 10BASE2 이더넷용 동축 케이블</p><p>③ U/FTP CAT.5 — 100Mbps 이더넷용 케이블</p></div>` },

  // Q24: 다중 안테나 신호 처리 = MIMO
  { qn: 24, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① MIMO(Multiple-Input and Multiple-Output)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>MIMO는 다수의 송수신 안테나를 사용하여 데이터 전송 속도와 신뢰성을 높이는 무선 통신 기술입니다. 고속 대용량 멀티미디어 서비스에 적합합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② M2M — 기기 간 직접 통신 기술</p><p>③ MQTT — IoT용 경량 메시징 프로토콜</p><p>④ OFDM — 직교 주파수 분할 다중화 방식(안테나 기술이 아님)</p></div>` },

  // Q25: 사설 클라우드는 내부 사용자만 접근
  { qn: 25, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ 사설 클라우드(private cloud)는 서버, 저장장치, 네트워크 데이터 그리고 응용프로그램 등을 함께 묶어서 회사 내·외부의 모든 이용자들이 공유할 수 있도록 하는 클라우드이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>사설 클라우드는 특정 조직 내부에서만 사용하는 클라우드로, 외부 이용자와 공유하지 않습니다. 내·외부 모든 이용자가 공유한다는 설명은 공용 클라우드에 해당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 클라우드의 단점으로 통신환경 의존성과 데이터 위치 불투명성은 맞습니다.</p><p>② — 공용 클라우드의 설명이 올바릅니다.</p><p>④ — 하이브리드 클라우드의 설명이 올바릅니다.</p></div>` },

  // Q26: SDN (표 내용 기반 - 소프트웨어 정의 네트워크)
  { qn: 26, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ Software defined networks</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SDN(Software Defined Networks)은 네트워크의 제어 기능을 데이터 전달 기능과 분리하여 소프트웨어로 네트워크를 프로그래밍 가능하게 하는 기술입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Wireless sensor networks — 무선 센서 네트워크</p><p>② Wireless mesh networks — 무선 메시 네트워크</p><p>④ Content delivery networks — 콘텐츠 전송 네트워크</p></div>` },

  // Q27: 흐름 제어 + 오류 없는 전송 = Transport Layer(4계층)
  { qn: 27, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ Transport Layer</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>전송 계층(Transport Layer, 4계층)은 종단 간 흐름 제어와 오류 없는 데이터 전송을 보장하는 계층입니다. TCP가 대표적인 프로토콜입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Session Layer — 세션 설정/유지/해제 담당</p><p>② Physical Layer — 물리적 신호 전송 담당</p><p>③ Network Layer — 라우팅과 논리적 주소 지정 담당</p></div>` },

  // Q28: TCP 포트는 논리적 포트 (물리적 시리얼 포트 아님)
  { qn: 28, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② TCP 포트: 웹서버 시스템의 물리적인 시리얼 포트 번호를 지정</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IIS의 TCP 포트는 웹 서비스가 사용하는 논리적인 포트 번호(기본값 80)를 지정하는 것이지, 물리적인 시리얼 포트와는 관계가 없습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — IP 주소 필드 설명은 올바릅니다.</p><p>③ — 연결 수 제한 설명은 올바릅니다.</p><p>④ — 연결 시간 제한(세션 타임아웃) 설명은 올바릅니다.</p></div>` },

  // Q29: NS 레코드는 네임서버 지정 (MX가 메일 라우팅)
  { qn: 29, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ NS - 주어진 사서함에 도달할 수 있는 라우팅 정보를 제공</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NS(Name Server) 레코드는 도메인에 대한 권한 있는 네임서버를 지정합니다. 사서함 라우팅 정보를 제공하는 것은 MX(Mail Exchange) 레코드입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① A 레코드 — 도메인을 32비트 IPv4 주소와 연결 (올바름)</p><p>② AAAA 레코드 — 도메인을 128비트 IPv6 주소와 연결 (올바름)</p><p>③ CNAME 레코드 — 도메인의 별칭(Alias) 설정 (올바름)</p></div>` },

  // Q30: Hyper-V는 서버 가용성을 높임
  { qn: 30, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 서버 가용성이 줄어든다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Hyper-V는 가상화를 통해 서버 가용성을 높여줍니다. 라이브 마이그레이션, 장애 조치 클러스터링 등의 기능으로 서비스 중단 시간을 최소화합니다. "가용성이 줄어든다"는 틀린 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 하드웨어 사용률을 높여주는 것은 맞습니다.</p><p>③ — 서버 통합으로 유지비용을 줄일 수 있습니다.</p><p>④ — 가상 환경으로 개발/테스트 효율성이 향상됩니다.</p></div>` },

  // Q31: 데몬은 부팅 시만이 아니라 언제든 시작 가능
  { qn: 31, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ 시스템 부팅 때만 시작될 수 있다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Linux 데몬은 시스템 부팅 시 자동 시작될 수 있지만, 관리자가 수동으로 언제든지 시작/중지할 수 있습니다. "부팅 때만 시작된다"는 틀린 설명입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 데몬은 백그라운드에서 실행됩니다.</p><p>② — ps afx 명령으로 데몬 프로세스를 확인할 수 있습니다.</p><p>③ — 데몬은 시스템 서비스를 지원하는 프로세스입니다.</p></div>` },

  // Q32: chmod 644 = 소유자 rw, 그룹/기타 r만
  { qn: 32, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ chmod 644 manager</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>chmod 644는 소유자에게 읽기/쓰기(6=rw-), 그룹과 기타 사용자에게 읽기(4=r--)만 부여합니다. 따라서 소유자가 아닌 사람도 볼 수는 있지만 수정할 수 없습니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① chmod 777 — 모든 사용자에게 모든 권한 부여</p><p>② chmod 666 — 모든 사용자에게 읽기/쓰기 권한 부여</p><p>③ chmod 646 — 그룹에 읽기만, 기타에 읽기/쓰기 부여(비대칭)</p></div>` },

  // Q33: 현재 작업 디렉터리 절대경로 = pwd
  { qn: 33, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ pwd</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>pwd(Print Working Directory)는 현재 작업 중인 디렉터리의 절대 경로를 출력하는 명령어입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① cd — 디렉터리 이동 명령어</p><p>② man — 매뉴얼 페이지 조회 명령어</p><p>④ cron — 작업 스케줄러</p></div>` },

  // Q34: /etc/passwd에서 x는 shadow 파일에 암호 저장을 의미
  { qn: 34, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② 패스워드는 'x' 이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>/etc/passwd의 두 번째 필드 'x'는 실제 패스워드가 아니라, 패스워드가 /etc/shadow 파일에 암호화되어 저장되어 있음을 나타내는 표시입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 사용자 계정 ID가 user1인 것은 올바른 해석입니다.</p><p>③ — UID와 GID가 500번인 것은 올바른 해석입니다.</p><p>④ — 기본 Shell이 /bin/bash인 것은 올바른 해석입니다.</p></div>` },

  // Q35: SYN 패킷 수신 → SYN_RECEIVED
  { qn: 35, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② SYN_RECEIVED</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>TCP 3-way handshake에서 서버가 클라이언트의 SYN 패킷을 수신하면 LISTEN 상태에서 SYN_RECEIVED 상태로 변경되고, SYN+ACK를 응답합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SYN_SENT — 클라이언트가 SYN을 보낸 후의 상태</p><p>③ ESTABLISHED — 3-way handshake 완료 후 연결 확립 상태</p><p>④ CLOSE — 연결이 종료된 상태</p></div>` },

  // Q36: 하나의 도메인에 여러 IP = Round Robin
  { qn: 36, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① Round Robin</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>DNS Round Robin은 하나의 도메인에 여러 IP 주소를 등록하여 DNS 질의 시 순환적으로 다른 IP를 응답하는 부하 분산 방식입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② Cache Plugin — DNS 캐시 플러그인</p><p>③ Cache Server — 캐시 전용 서버</p><p>④ Azure AutoScaling — 클라우드 자동 스케일링 서비스</p></div>` },

  // Q37: init 6은 재부팅 (종료 아님)
  { qn: 37, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ init 6</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>init 6은 시스템을 재부팅(reboot)하는 명령어입니다. 시스템을 종료하는 명령어가 아닙니다. 종료 명령어는 shutdown -h now, poweroff, halt, init 0 등입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① shutdown -h now — 즉시 시스템 종료</p><p>② poweroff — 시스템 전원 종료</p><p>④ halt — 시스템 정지</p></div>` },

  // Q38: DNS 캐시 초기화 = ipconfig /flushdns
  { qn: 38, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② ipconfig /flushdns</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>ipconfig /flushdns는 Windows에서 DNS 캐시를 초기화하는 명령어입니다. 이전 DNS 레코드 변경이 반영되지 않을 때 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ipconfig /displydns — 잘못된 명령어(displaydns가 올바른 철자)</p><p>③ ipconfig /release — DHCP IP 주소 해제</p><p>④ ipconfig /renew — DHCP IP 주소 갱신</p></div>` },

  // Q39: 열린 포트 확인 = netstat
  { qn: 39, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ netstat</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>netstat는 네트워크 연결 상태, 라우팅 테이블, 열려있는 포트 정보를 확인하는 명령어입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① ps — 실행 중인 프로세스 목록 확인</p><p>② pstree — 프로세스 트리 구조 확인</p><p>③ getenforce — SELinux 상태 확인</p></div>` },

  // Q40: POST 크기 제한 = LimitRequestBody
  { qn: 40, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② LimitRequestBody</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Apache의 httpd.conf에서 LimitRequestBody 지시자는 클라이언트가 전송할 수 있는 HTTP 요청 본문(body)의 최대 크기를 제한합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① KeepRequestSize — 존재하지 않는 지시자</p><p>③ RestrictBodyRequest — 존재하지 않는 지시자</p><p>④ PostRequestSize — 존재하지 않는 지시자</p></div>` },

  // Q41: SSH (보안 원격 접속)
  { qn: 41, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② SSH(Secure Shell)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>SSH는 네트워크를 통해 안전하게 원격 접속할 수 있는 프로토콜입니다. 데이터를 암호화하여 전송하며, Telnet의 보안 대안으로 사용됩니다. 포트 22를 사용합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① SSL — 웹 통신 암호화 프로토콜(원격 접속용 아님)</p><p>③ TLS — SSL의 후속 버전(웹 통신 암호화)</p><p>④ RDP — Windows 원격 데스크톱 프로토콜</p></div>` },

  // Q42: AD에서 부서별 구성 = OU
  { qn: 42, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ OU(Organizational Unit)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>OU(Organizational Unit, 조직 구성 단위)는 Active Directory에서 도메인 내부를 부서별로 세분화하여 관리할 수 있는 컨테이너입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① DC — 도메인 컨트롤러(AD 인증 서버)</p><p>② RDC — 읽기 전용 도메인 컨트롤러</p><p>④ Site — 물리적 네트워크 위치 기반 구분</p></div>` },

  // Q43: 사용자에게 할당된 디렉터리 = Home Directory
  { qn: 43, ans: 2, exp: `<p class="exp-answer">✅ 정답: <strong>② Home Directory</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Home Directory는 각 사용자에게 할당된 개인 디렉터리로, 사용자가 자유롭게 파일을 생성/수정/삭제할 수 있는 영역입니다. 보통 /home/사용자명 경로에 위치합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① Root Directory — 최상위 디렉터리(/)</p><p>③ Temporary Directory — 임시 파일 저장소(/tmp)</p><p>④ Public Directory — 공용 디렉터리</p></div>` },

  // Q44: DHCP 임대기간은 일/시간/분 (초 단위 없음) → ms 단위 지연시간
  { qn: 44, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ DHCP 서버에서 주소를 분배할 때, 적용할 지연시간은 ms 단위로 지정한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>Windows Server DHCP에서 주소 분배 지연시간(응답 지연)은 밀리초(ms) 단위로 지정합니다. 이는 여러 DHCP 서버가 있을 때 응답 우선순위를 조절하는 데 사용됩니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — DHCP 임대 기간은 일/시간/분 단위로 설정 가능합니다(초 단위 없음이 함정이지만 이 보기가 가장 올바름).</p><p>② — DHCP 범위 구성 시 WINS 서버를 구성할 수 있습니다.</p><p>③ — 새 예약 구성 시 DHCP와 BOOTP 모두 지원됩니다.</p></div>` },

  // Q45: fdisk는 디스크 파티션 관리 (파일시스템 점검은 fsck)
  { qn: 45, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ fdisk : 파일시스템 점검</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>fdisk는 디스크 파티션을 관리(생성/삭제/변경)하는 명령어입니다. 파일시스템 점검은 fsck(File System Check) 명령어가 담당합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① mkfs — 파일시스템 생성 명령어 (올바름)</p><p>② du — 디스크 사용량 확인 명령어 (올바름)</p><p>③ mount — 외부 장치를 디렉터리에 연결 (올바름)</p></div>` },

  // Q46: L2 스위치 = MAC 주소 기반 전송
  { qn: 46, ans: 3, exp: `<p class="exp-answer">✅ 정답: <strong>③ MAC 주소</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>L2(Layer 2) 스위치는 데이터 링크 계층에서 동작하며, 프레임의 목적지 MAC 주소를 확인하여 해당 포트로 전송합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① IP 주소 — L3(네트워크 계층) 장비가 사용</p><p>② Port 주소 — L4(전송 계층) 장비가 사용</p><p>④ URL 주소 — L7(응용 계층) 장비가 사용</p></div>` },

  // Q47: 802.11ax = Wi-Fi 6
  { qn: 47, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ IEEE 802.11ax</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>IEEE 802.11ax(Wi-Fi 6)는 OFDMA, MU-MIMO, BSS Coloring 등의 기술로 고밀도 환경에서도 효율적인 무선 통신을 제공하며, 최대 9.6Gbps의 이론적 속도를 지원합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① 802.11n(Wi-Fi 4) — 최대 600Mbps, MIMO 도입</p><p>② 802.11ac(Wi-Fi 5) — 최대 6.9Gbps, 5GHz 대역</p><p>③ 802.11be(Wi-Fi 7) — 차세대 표준</p></div>` },

  // Q48: 서로 다른 프로토콜 연결 = Gateway
  { qn: 48, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① 전혀 다른 프로토콜을 채용한 네트워크 간의 인터페이스이다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>게이트웨이는 서로 다른 프로토콜을 사용하는 네트워크 간을 연결하고 프로토콜 변환을 수행하는 장비입니다. OSI 7계층 전체에서 동작합니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② — 케이블 집선 장치는 허브(Hub)의 역할</p><p>③ — 신호 증폭은 리피터(Repeater)의 역할</p><p>④ — MAC 주소 테이블을 갖는 것은 스위치의 역할</p></div>` },

  // Q49: NAC (네트워크 접근 제어)
  { qn: 49, ans: 1, exp: `<p class="exp-answer">✅ 정답: <strong>① NAC(Network Access Control)</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>NAC(Network Access Control)은 네트워크에 접속하는 단말의 보안 상태를 점검하고, 정책에 따라 네트워크 접근을 허용/차단하는 보안 솔루션입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>② NAT — 네트워크 주소 변환 기술</p><p>③ IP제어 — 단순 IP 기반 접근 제어</p><p>④ WAF — 웹 애플리케이션 방화벽</p></div>` },

  // Q50: RAID는 여러 물리 드라이브를 하나의 논리 드라이브로 사용
  { qn: 50, ans: 4, exp: `<p class="exp-answer">✅ 정답: <strong>④ 운영체제에서 여러 개의 논리적 드라이브를 하나의 물리적 드라이브로 활용한다.</strong></p><div class="exp-section"><div class="exp-section-title">📖 해설</div><p>RAID는 여러 개의 물리적 디스크를 하나의 논리적 드라이브로 구성하는 기술입니다. "여러 논리적 드라이브를 하나의 물리적 드라이브로"라는 설명은 반대입니다.</p></div><div class="exp-section"><div class="exp-section-title">❌ 오답 분석</div><p>① — 데이터를 병렬 전송하여 속도가 향상됩니다.</p><p>② — 미러링(RAID 1)으로 데이터를 중복 저장할 수 있습니다.</p><p>③ — 핫스왑으로 가동 중 디스크 교체가 가능합니다.</p></div>` },
];

async function main() {
  let count = 0;
  for (const a of answers) {
    const res = await query(
      'UPDATE questions SET answer=$1, explanation=$2, updated_at=NOW() WHERE exam_id=$3 AND question_number=$4 RETURNING id',
      [a.ans, a.exp, 156, a.qn]
    );
    if (res.rows.length > 0) count++;
  }
  console.log(`exam_id=156 (2025년 1회): ${count}/50 문제 완료`);
  await getPool().end();
}

main().catch(e => { console.error(e); process.exit(1); });
