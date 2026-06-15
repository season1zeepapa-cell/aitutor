# IMP-IV-08 · 부적절한 XML 외부개체 참조 (XXE)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-611
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §8 부적절한 XML 외부개체 참조 (p.244–250)

## 가. 개요

XML 문서에는 **DTD(Document Type Definition)** 를 포함할 수 있으며, DTD는 XML 엔티티(entity)를 정의한다. 서버에서 **XML 외부 엔티티를 처리**할 수 있도록 설정된 경우 발생한다. 취약한 XML parser가 외부 값을 참조하는 XML을 처리할 때, 공격자의 공격 구문이 동작되어 **서버 파일 접근·자원 고갈·인증 우회·정보 노출**이 발생할 수 있다.

## 나. 보안대책

- **로컬 정적 DTD** 사용 설정, 외부 전송 XML의 DTD를 완전히 **비활성화**
- 비활성화 불가 시 외부 엔티티·외부 문서 유형 선언을 **각 파서별 고유 방식으로 비활성화**

## 다. 코드예제

### Java (JAXB / DocumentBuilder)
공격 예: `<!ENTITY xxe SYSTEM "file:///etc/passwd">` 를 포함한 XML 전송 시 파싱하면 `/etc/passwd` 참조.

```java
// ❌ 취약: 외부 엔티티 제한 없이 파싱
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setNamespaceAware(true);
DocumentBuilder db = dbf.newDocumentBuilder();
Document document = db.parse(receivedXml);
```
```java
// ✅ 안전: doctype/외부엔티티/외부DTD/XInclude/엔티티확장 모두 비활성화
dbf.setFeature("http://apache.org/xml/featuresdisallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
dbf.setXIncludeAware(false);
dbf.setExpandEntityReferences(false);
```

### Java (SAXParser)
`<!DOCTYPE foo SYSTEM "file:/dev/tty">` 인 secure.xml 참조 시 `/dev/tty` 콘솔이 입력을 대기하는 DoS 발생.

```java
// ❌ 취약: 외부개체 참조 제한 설정 없이 파싱
SAXParserFactory factory = SAXParserFactory.newInstance();
SAXParser saxParser = factory.newSAXParser();
saxParser.parse(new FileInputStream("secure.xml"), new DefaultHandler());
```

### PHP
```php
// ✅ 안전: libxml_disable_entity_loader 로 외부 엔티티 비활성화
$value = libxml_disable_entity_loader(true);
$dom = new DOMDocument();
$dom -> loadXML($xml);
libxml_disable_entity_loader($value);
```

## 라. 진단방법

1. **①** XML 파일을 파싱하고 있는지 확인

> 신뢰할 수 없는 외부 입력 파일에 대한 외부 엔티티를 비활성화하는 코드가 없으면 취약 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 사용자 입력 XML 파일 파싱하나 외부 엔티티 비활성화 없음 → 취약
File xmlFile = new File(multipartFile.getOriginalFilename());
multipartFile.transferTo(xmlFile);
SAXParserFactory factory = SAXParserFactory.newInstance();
SAXParser saxParser = factory.newSAXParser();
saxParser.parse(new FileInputStream(xmlFile), new DefaultHandler());
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// DocumentBuilderFactory: ACCESS_EXTERNAL_DTD / SCHEMA 제한 → 안전
df.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
df.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
```
```java
// SAXParser: parser.setProperty 로 제한 → 안전
parser.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
parser.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
```
```java
// SchemaFactory / Validator: setProperty 로 제한 → 안전
factory.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
validator.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
```
```java
// XMLInputFactory: SUPPORT_DTD / 외부엔티티 false → 안전
factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
```

## 마. 참고자료

- CWE-611 Improper Restriction of XML External Entity Reference, MITRE — https://cwe.mitre.org/data/definitions/611.html
- XML External Entity Prevention Cheat Sheet, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 외부 엔티티 비활성화 · disallow-doctype-decl · external-general-entities · ACCESS_EXTERNAL_DTD · setExpandEntityReferences · libxml_disable_entity_loader · 로컬 정적 DTD · `SYSTEM file:///etc/passwd`
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
