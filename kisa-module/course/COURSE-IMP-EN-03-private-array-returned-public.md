# Public 메소드로부터 반환된 Private 배열

- **코드**: COURSE-IMP-EN-03 (chapter ref: IMP-EN-03)
- **단계**: Ⅴ. 구현 단계 보안약점 진단
- **분류**: 캡슐화(encapsulation)
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, 485-489쪽

## 요약

private으로 선언된 배열을 public 메소드를 통해 반환하는 경우, 배열의 레퍼런스(주소값)가 외부에 공개되어 권한 없는 사용자가 캡슐화된 중요 데이터를 직접 수정할 수 있는 캡슐화 보안약점이다.

## 개요 — 약점 정의와 위협

- private으로 선언된 배열을 public으로 선언된 메소드를 통해 반환하는 경우, 그 배열의 레퍼런스가 외부에 공개되어 외부에서 배열이 수정될 수 있다.
- 배열 주소값이 외부에 공개되어 권한이 없는 사용자가 캡슐화된 중요 데이터를 직접적으로 수정하는 것이 가능하다.

## 보안대책

- private로 선언된 배열을 public 메소드를 통해서 반환하지 않도록 한다.
- 필요한 경우에는 배열의 복제본을 반환한다.
- 또는 수정을 제어하는 별도의 public 메소드를 선언하여 사용한다.

## 진단 흐름도

1. private 배열 선언 확인 → public 메소드에서 반환 여부 확인.
2. **미반환** → 안전.
3. **반환** → 위험.

## 코드 예시 — 레퍼런스 반환 vs 복제본 반환

**안전하지 않은 코드**
```java
import java.util.Arrays;
public class GetPrivateArrayByPublicMethod {
  // private 인 배열을 public인 메소드가 return한다
  private String[] colors;
  public String[] getColors() {
      return this.colors;
  }
  public GetPrivateArrayByPublicMethod() {
      this.colors = new String[] { "red", "orange", "yellow", "green", "blue" };
  }
  public void print() { System.out.println(Arrays.toString(this.colors)); }

  public static void main(String[] args) {
      GetPrivateArrayByPublicMethod innerData = new GetPrivateArrayByPublicMethod();
      innerData.print();
      String[] outerData = innerData.getColors();
      outerData[1] = "blue";
      System.out.println(Arrays.toString(outerData));
      innerData.print();
  }
}
```

**안전한 코드**
```java
import java.util.Arrays;
public class GetPrivateArrayByPublicMethod {
  private String[] colors; // class private member variable
  public String[] getColors() {
      String[] safeArray = null; // local variable
      if (this.colors != null) {
          // 배열을 복사한다.
          safeArray = new String[this.colors.length];
          for (int i = 0; i < this.colors.length; i++) {
              // clone()메소드를 이용하여 배열의 원소도 복사한다.
              safeArray[i] = this.colors[i];
          }
      }
      return safeArray;
  }
  public GetPrivateArrayByPublicMethod() { … }
  public void print() { System.out.println(Arrays.toString(this.colors)); }
}
```

## 보충 — 접근 제한자와 접근자(Accessor)

| 접근 제어자 | 동일 클래스 | 동일 패키지 | 자식 클래스(다른 패키지) | 그 외 모든 클래스 |
| --- | --- | --- | --- | --- |
| private | O | X | X | X |
| default | O | O | X | X |
| protected | O | O | O | X |
| public | O | O | O | O |

- 접근자(Accessor)는 캡슐화를 구현하는 메서드로 private 필드에 간접 접근한다. `Getter()`는 값 읽기, `Setter()`는 값 설정(뮤테이터, Mutator).
- Immutable Object: 생성 후 상태 불변 (String, Integer, Float, Long 등).
- Mutable Object: 생성 후 상태 변경 가능 (ArrayList, HashMap, StringBuilder, Date 등).
- 배열은 참조형 타입으로, 변수는 데이터가 아니라 배열 객체의 주소를 가리킨다. 배열 변수 대입·전달은 참조를 공유하여 원본 배열 내용이 변경될 수 있다.

## 시험 포인트

- 원인: private 배열을 public 메소드가 그대로 반환 → 레퍼런스(주소값) 노출로 외부 수정 가능.
- 보안대책: 배열을 직접 반환하지 말고 복제본 반환, 또는 수정 제어용 별도 public 메소드 사용.
- 안전한 코드 핵심: 새 배열을 만들어 for 루프로 원소를 복사 후 반환.
- 접근 제어자 가시성 순서: private < default < protected < public.
- 배열은 참조형 타입 — 변수 대입·메소드 전달 시 참조가 공유되어 원본이 변경될 수 있음.
- 진단 흐름: private 배열을 public 메소드가 반환하면 위험.

## 관련 라이브러리 항목
- IMP-EN-03
