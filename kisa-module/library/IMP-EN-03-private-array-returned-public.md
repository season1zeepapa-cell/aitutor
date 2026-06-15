# IMP-EN-03 · Public 메소드부터 반환된 Private 배열

> **단계** 구현 · **분류** 캡슐화 · **CWE** CWE-495
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 제6절 §3 (p.481–485)

## 가. 개요

private로 선언된 배열을 public 메소드로 반환(return)하면 그 배열의 **레퍼런스가 외부에 공개**되어, 외부에서 배열 수정과 객체 속성 변경이 가능해진다.

## 나. 보안대책

- private 배열을 public 메소드로 직접 반환하지 않는다
- **복사본을 반환**한다. 원소가 일반 객체이면 `clone()` 으로 원소까지 복사
- 원소가 String 등 불변 타입이면 배열 복사본만 만들어 반환

## 다. 코드예제

### Java (배열 원소가 일반객체)
```java
// ❌ 취약: private 배열 레퍼런스를 그대로 반환
private Color[] colors;
public Color[] getUserColors(Color[] userColors) { return colors; }
```
```java
// ✅ 안전: 배열 복사 + 원소도 clone()
public Color[] getUserColors(Color[] userColors) {
  Color[] colors = new Color[userColors.length];
  for (int i = 0; i < colors.length; i++)
    colors[i] = this.colors[i].clone();
  return colors;
}
```

### Java (배열 원소가 String 등 불변 타입)
```java
// ❌ 취약: 레퍼런스 반환
private String[] colors;
public String[] getColors() { return colors; }
```
```java
// ✅ 안전: 불변 원소는 배열 복사본만 반환해도 됨
public String[] getColors() {
  String[] ret = null;
  if ( this.colors != null ) {
    ret = new String[colors.length];
    for (int i = 0; i < colors.length; i++) { ret[i] = this.colors[i]; }
  }
  return ret;
}
```

### C#
```csharp
// ❌ 취약: private collection 레퍼런스 반환
private List<Color> colors;
public List<Color> getUserColors() { return colors; }
```
```csharp
// ✅ 안전: collection 복사 + Clone()
public List<Color> getUserColors() {
  List<ICloneable> newList = new List<ICloneable>(colors.Count);
  colors.ForEach((item) => { newList.Add((ICloneable)item.Clone()); });
  return newList;
}
```

## 라. 진단방법

1. **①** private 배열이 선언되어 있는지 확인
2. **②** 해당 배열이 public 메소드에서 반환되면 취약 판정
3. 원소가 일반 객체이면 원소별로 객체를 생성하고 내부 값을 복사하는지 추가 확인

> 함수 안에서 멤버필드 배열을 리턴하면 그 배열을 받아 값을 바꿀 수 있어 private 의도에 벗어나므로 취약.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// private String[] checkb 를 public getChkb() 가 그대로 반환 → 취약
public class AddManager extends BaseManager {
  private String[] checkb;
  public String[] getChkb() { return this.checkb; }
}
```
```java
// 배열 새로 생성·복사했으나 원소가 일반 객체(Color) → 주소값만 복사 → 취약
private Color[] myColors;
public Color[] getColors() {
  Color[] retColors = new Color[myColors.length];
  for(int i =0; i < myColors.length; i++) {
    retColors[i] = this.myColors[i]; // 일반 객체일 경우 주소값만 복사된다.
  }
  return retColors;
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// private도 아니고 final → 취약하지 않음
public static final String[] XML_TAG = { "<?xml version=\"1.0\" encoding=\"", "\"?>" };
```

## 마. 참고자료

- CWE-495 Private Array-Typed Field Returned From A Public Method, MITRE — http://cwe.mitre.org/data/definitions/495.html
- Do not return references to private mutable class members (OBJ05-J), CERT

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: private 배열 · public 메소드 반환 · 레퍼런스 공개 · 복사본 반환 · clone() · 주소값만 복사 · 일반객체 vs 불변타입
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
