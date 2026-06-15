# Private 배열에 Public 데이터 할당

- **코드**: COURSE-IMP-EN-04 (chapter ref: IMP-EN-04)
- **단계**: Ⅴ. 구현 단계 보안약점 진단
- **분류**: 캡슐화(encapsulation)
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정, 490-492쪽

## 요약

public으로 선언된 데이터 또는 메소드 인자를 private 배열에 저장하는 경우, 외부에서 private 배열을 직접 접근하여 값을 수정할 수 있는 캡슐화 보안약점이다. 입력된 public 배열의 reference가 아니라 배열의 '값'을 private 배열에 할당하여 private 멤버로서의 접근권한을 유지해야 한다.

## 개요 — 약점 정의와 위협

- public으로 선언된 데이터 또는 메소드의 인자를 private 배열에 저장하는 경우 발생한다.
- private 배열을 외부에서 직접 접근하여 값을 수정하는 것이 가능하다.

## 보안대책

- 입력된 public 배열의 reference가 아닌, 배열의 '값'을 private 배열에 할당한다.
- 이를 통해 private 멤버로서의 접근권한을 유지한다.

## 진단 흐름도

1. private 배열 선언 확인 → public 메소드를 통한 외부 배열 할당 여부 확인.
2. **미할당** → 안전.
3. **할당** → 위험.

## 코드 예시 — reference 할당 vs 값 복사 할당

**안전하지 않은 코드**
```java
import java.util.Arrays;
public class SetPublicArrayToPrivateArray {
  // private 배열의 원소를 외부에서 변경할 수 있음
  private String[] datas;
  public void setDatas(String[] datas) {
      this.datas = datas;
  }
  public SetPublicArrayToPrivateArray() {
      this.datas = new String[] { "100","90","70","80" };
  }
  public void print() { System.out.println(Arrays.toString(this.datas)); }

  public static void main(String[] args) {
      SetPublicArrayToPrivateArray innerData = new SetPublicArrayToPrivateArray();
      innerData.print();
      String[] outerData = new String[] { "10", "20", "30" };
      innerData.setDatas(outerData);
      innerData.print();
      outerData[1] = "xx";
      innerData.print(); // 외부 수정이 내부에 반영됨
  }
}
```

**안전한 코드**
```java
import java.util.Arrays;
public class SetPublicArrayToPrivateArray {
  // 객체가 클래스의 private member를 수정하지 않도록 한다.
  private String[] datas; // class private member array variable
  public void setDatas(String[] datas) {
      if (datas != null) {
          this.datas = new String[datas.length];
          for (int i = 0; i < datas.length; i++) {
              // clone()메소드를 이용하여 배열의 원소도 복사한다.
              this.datas[i] = datas[i];
          }
      }
  }
  public SetPublicArrayToPrivateArray() {
      this.datas = new String[] { "100","90","70","80" };
  }
  public void print() { System.out.println(Arrays.toString(this.datas)); }
}
```

## 시험 포인트

- 원인: public 데이터/메소드 인자를 private 배열에 reference로 저장 → 외부에서 private 배열 직접 수정 가능.
- 보안대책: reference가 아닌 배열의 '값'을 복사하여 할당해 private 멤버 접근권한 유지.
- 안전한 코드 핵심: null 검사 후 새 배열 생성 + for 루프로 원소 복사.
- EN-03(public 메소드의 private 배열 반환)과 대칭 — EN-04는 외부 배열을 private에 할당하는 입력 측 약점.
- 진단 흐름: public 메소드를 통한 외부 배열 할당이 있으면 위험.

## 관련 라이브러리 항목
- IMP-EN-04
