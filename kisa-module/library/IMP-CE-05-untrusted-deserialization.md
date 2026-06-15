# IMP-CE-05 · 신뢰할 수 없는 데이터의 역직렬화

> **단계** 구현 · **분류** 코드오류 · **CWE** CWE-502
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제5절 §5 신뢰할 수 없는 데이터의 역직렬화 (p.462–468)

## 가. 개요

**직렬화(Serialization)** 는 클래스 인스턴스 상태를 바이트 스트림으로 복사하여 파일 저장·전송하는 작업이고, **역직렬화(Deserialization)** 는 바이트 스트림에서 객체 구조로 복원하는 반대 연산이다. 송신자가 직렬화된 정보를 전달하는 과정에서 공격자가 전송·저장된 스트림을 조작할 수 있으면, 신뢰할 수 없는 역직렬화를 이용해 **무결성 침해·원격 코드 실행·서비스 거부 공격**이 발생할 수 있다.

## 나. 보안대책

- 신뢰할 수 없는 데이터를 **역직렬화하지 않도록** 응용프로그램을 구성
- 암호화 통신이 어려운 경우, 송신 측은 **서명을 추가**하고 수신 측은 **서명을 확인**하여 무결성 검증
- 역직렬화 대상이 **사전에 검증된 클래스(화이트리스트)** 만 포함하는지 검증하거나, **제한된 실행 권한**으로 역직렬화 코드 실행

## 다. 코드예제

### Java — 서명 검증 (map 직렬화/역직렬화)
공격자가 바이트 스트림을 조작하여 역직렬화 공격 객체를 만들 수 있다. 안전한 코드는 서명 값을 검증해 위변조를 방지한다.

```java
// ❌ 취약 / ✅ 안전 모두 서명 검증 로직을 포함하나, 취약 예는 조작된 스트림으로 객체가 생성될 수 있는 흐름
ObjectInputStream in = new ObjectInputStream(new FileInputStream("data"));
sealedMap = (SealedObject) in.readObject();
in.close();
cipher = Cipher.getInstance("AES");
cipher.init(Cipher.DECRYPT_MODE, key);
signedMap = (SignedObject) sealedMap.getObject(cipher);
if (!signedMap.verify(kp.getPublic(), sig)) {
    throw new GeneralSecurityException("Map failed verification");
}
map = (SerializableMap<String, Integer>) signedMap.getObject();
```

### Java — 화이트리스트 (readObject)
```java
// ❌ 취약: 검증 없이 readObject()
class DeserializeExample {
    public static Object deserialize(byte[] buffer) throws IOException, ClassNotFoundException {
        Object ret = null;
        try (ByteArrayInputStream bais = new ByteArrayInputStream(buffer)) {
            try (ObjectInputStream ois = new ObjectInputStream(bais)) {
                ret = ois.readObject();
            }
        }
        return ret;
    }
}
```
```java
// ✅ 안전: ObjectInputStream 상속 + resolveClass 화이트리스트 검증
public class WhitelistedObjectInputStream extends ObjectInputStream {
    public Set<String> whitelist;
    public WhitelistedObjectInputStream(InputStream inputStream, Set<String> wl) throws IOException {
        super(inputStream);
        whitelist = wl;
    }
    @Override
    protected Class<?> resolveClass(ObjectStreamClass cls) throws IOException, ClassNotFoundException {
        if (!whitelist.contains(cls.getName())) {
            throw new InvalidClassException("Unexpected serialized class", cls.getName());
        }
        return super.resolveClass(cls);
    }
}
// 업로드 핸들러: whitelist에 "Student"만 등록 → 그 외 클래스는 예외
```

## 라. 진단방법

1. **①** `ObjectInputStream.readObject()` 등 각 언어의 역직렬화 함수 확인
2. **②** 해당 함수가 사용하는 데이터가 **신뢰할 수 있는 값**인지 확인
3. 사용자 입력값·소켓 입력값 등 **출처를 신뢰할 수 없는 데이터를 검증하는 절차가 없으면** 취약 판정

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// HttpServletRequest의 InputStream(사용자 입력) → readObject() 검증 없음 → 취약
ois = new ObjectInputStream(req.getInputStream()); // ②
retImgInfo = (ImageInformation) ois.readObject(); // ①
```
```java
// XMLDecoder로 사용자 제공 데이터 역직렬화 → 명령 실행 가능 → 취약
xd = new XMLDecoder(new ByteArrayInputStream(xml.getBytes()));
Object s2 = xd.readObject();
```
```python
# 소켓 수신 데이터를 검증 없이 역직렬화 → 취약
conn,addr = self.receiver_socket.accept()
data = conn.recv(1024)
return Pickle.loads(data)
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```python
# HMAC으로 무결성 검증 후 역직렬화 → 안전
# 클라이언트: digest = hmac.new('shared-key', pickled_data, hashlib.sha1).hexdigest()
# 서버:
recvd_digest, pickled_data = data.split(' ')
new_digest = hmac.new('shared-key', pickled_data, hashlib.sha1).hexdigest()
if recvd_digest != new_digest:
    print 'Integrity check failed'
else:
    unpickled_data = pickle.loads(pickled_data)
```

## 마. 참고자료

- CWE-502 Deserialization of Untrusted Data, MITRE — https://cwe.mitre.org/data/definitions/502.html

> 비고: 원문 진단가이드 본 절의 참고자료 표기에는 SSRF(CWE-918)가 잘못 인쇄되어 있으나, 보안약점 명칭(역직렬화)에 따라 CWE-502가 정확한 매핑이다.

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 역직렬화 · readObject · ObjectInputStream · 화이트리스트 · resolveClass · 서명 검증 · HMAC 무결성 · pickle.loads · XMLDecoder
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
