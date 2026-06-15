# 부적절한 XML 외부 개체 참조 (XXE) (COURSE-IMP-IV-08)

> 2025년 SW보안약점 진단원 기본(양성)과정 · Ⅴ. 구현 단계 보안약점 진단 · 입력데이터 검증 및 표현 · 1-8 (pp.328-332)

## 요약
XML 문서에는 DTD(Document Type Definition)를 포함할 수 있고 DTD는 XML 엔티티를 정의한다. XXE 보안약점은 서버가 XML 외부 엔티티를 처리하도록 설정된 경우 발생한다. 취약한 XML 파서가 외부 값을 참조하는 XML을 처리하면 공격 구문이 동작하여 서버 파일 접근, 불필요한 자원 사용, 인증 우회, 정보 노출 등이 발생한다. 외부 DTD·외부 엔티티를 파서별로 비활성화하는 것이 대책이다.

## 개요 — 정의와 위협
- XML 문서에는 DTD(Document Type Definition)를 포함할 수 있으며, DTD는 XML 엔티티(entity)를 정의한다.
- 부적절한 XML 외부개체 참조 보안약점은 서버에서 XML 외부 엔티티를 처리할 수 있도록 설정된 경우에 발생할 수 있다.
- 위협: 취약한 XML parser가 외부 값을 참조하는 XML 값을 처리할 때 공격 구문이 동작되어 서버 파일 접근, 불필요한 자원 사용, 인증 우회, 정보 노출 등이 발생할 수 있다.

## 보안대책
- 로컬 정적 DTD를 사용하도록 설정하고, 외부에서 전송된 XML문서에 포함된 DTD를 완전하게 비활성화한다.
- 비활성화를 할 수 없는 경우에는 외부 엔티티 및 외부 문서 유형 선언을 각 파서(parser)에 맞는 고유한 방식으로 비활성화한다.
- 진단 흐름: XML 헤더 데이터 확인 → 외부 DTD 사용 여부 → 미사용 시 안전, 사용 시 파서별 외부 DTD 비활성화 적용되면 안전, 아니면 위험.

## 안전하지 않은 코드 — 기본 DocumentBuilder 파싱
- DocumentBuilderFactory로 생성한 기본 파서로 입력받은 receivedXml을 그대로 `db.parse(receivedXml)` 처리한 뒤 JAXB로 unmarshal 한다.
- 외부 엔티티 비활성화 설정이 없어 공격 XML이 정의한 외부 엔티티가 참조·확장된다.
- 공격 XML 예: `<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>` 와 `<foo>&xxe;</foo>` — XML 외부 엔티티를 참조하는 receivedXML을 전송하면 파싱 시 /etc/passwd 파일을 참조할 수 있다.

## 안전한 코드 — DocumentBuilderFactory feature 비활성화
- `disallow-doctype-decl`을 true로 설정하여 XML 파서가 doctype을 정의하지 못하도록 한다.
- `external-general-entities`, `external-parameter-entities`를 false로 설정하여 외부 일반·파라미터 엔티티를 포함하지 않도록 한다.
- `load-external-dtd`를 false로 설정하여 외부 DTD를 비활성화한다.
- `setXIncludeAware(false)`로 XInclude를 사용하지 않고, `setExpandEntityReferences(false)`로 엔티티 참조 노드를 확장하지 않도록 한다.

## 안전한 코드 — 파서별 외부 접근 차단 (속성 설정)
- **DocumentBuilderFactory**: `setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "")` 및 `ACCESS_EXTERNAL_SCHEMA ""` 설정으로 외부 DTD·스키마 접근을 빈 값으로 차단.
- **SAXParserFactory**: SAXParser에 `ACCESS_EXTERNAL_DTD`·`ACCESS_EXTERNAL_SCHEMA` 프로퍼티를 `""`로 설정.
- **SchemaFactory**: `ACCESS_EXTERNAL_DTD`·`ACCESS_EXTERNAL_SCHEMA` 프로퍼티를 `""`로 설정.
- **XMLInputFactory**: `SUPPORT_DTD=false`, `IS_SUPPORTING_EXTERNAL_ENTITIES=false`로 설정하여 DTD·외부 엔티티를 지원하지 않도록 함.

## 핵심 개념
- **DTD(Document Type Definition)**: XML 문서에 포함될 수 있는 구조 정의로 XML 엔티티를 정의. 외부 DTD 처리가 허용되면 XXE의 통로가 된다.
- **XML 외부 엔티티(XXE)**: SYSTEM 키워드로 외부 리소스(예: `file:///etc/passwd`)를 참조하도록 정의된 엔티티. 취약한 파서가 확장하면 서버 파일 접근·정보 노출 발생.
- **파서별 외부 DTD 비활성화**: DocumentBuilderFactory·SAXParserFactory·SchemaFactory·XMLInputFactory 등 각 파서 고유 방식으로 외부 엔티티·외부 DTD를 비활성화하는 대책.

## 시험 포인트
- XXE는 서버가 XML 외부 엔티티를 처리하도록 설정된 경우 발생 → 서버 파일 접근, 자원 소모, 인증 우회, 정보 노출.
- 공격 구문 핵심: `<!ENTITY xxe SYSTEM "file:///etc/passwd">` + `&xxe;`로 시스템 파일 참조.
- 대책: 로컬 정적 DTD 사용 + 외부 DTD 완전 비활성화, 불가 시 파서별 외부 엔티티/외부 DTD 비활성화.
- DocumentBuilderFactory 안전 설정: disallow-doctype-decl=true, external-general/parameter-entities=false, load-external-dtd=false, XIncludeAware=false, ExpandEntityReferences=false.
- 파서별 속성: `ACCESS_EXTERNAL_DTD`·`ACCESS_EXTERNAL_SCHEMA`를 `""`로, XMLInputFactory는 SUPPORT_DTD=false·IS_SUPPORTING_EXTERNAL_ENTITIES=false.
