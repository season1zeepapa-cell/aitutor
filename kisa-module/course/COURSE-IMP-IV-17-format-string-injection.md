# 포맷 스트링 삽입

- **unit_code**: COURSE-IMP-IV-17
- **단원**: Ⅴ. 구현 단계 보안약점 진단 > 입력데이터 검증 및 표현
- **출처**: 2025년 SW보안약점 진단원 기본(양성)과정 (pp. 369-373)
- **관련 보안약점**: 입력 데이터 검증 및 표현 > 포맷 스트링 삽입

## 요약

printf(), fprintf(), sprintf()와 같이 포맷 스트링을 사용하는 함수를 사용하는 경우, 외부로부터 입력된 값을 검증하지 않고 입출력 함수의 포맷 문자열로 그대로 사용하는 경우 발생한다.

## 공격 영향

- 포맷 문자열을 이용하여 취약한 프로세스를 공격하거나 메모리 내용을 읽거나 쓸 수 있다.
- **리턴 주소를 조작하여 임의의 코드를 실행**하거나 데이터 표현에 관한 문제를 유발할 수 있다.

## 보안대책

1. 포맷 스트링 함수 사용 시, 사용자 입력값을 **포맷 문자열로 바로 사용하거나 포맷 스트링 생성에 사용하지 않는다.**
2. 포맷 스트링에 표현되어 있는 **인자와 매개 변수의 개수를 일치**시킨다.

## 진단 흐름도

- 외부입력값을 포맷 스트링 생성에 사용하지 않으면 → **안전**
- 사용하는 경우, 포맷 스트링의 인자와 매개변수 개수 불일치 → **위험**
- 포맷에 출력할 데이터의 길이를 한정하지 않으면 → **위험**

## 안전한 코드 (Java printf)

```java
// 안전하지 않은 코드: 외부입력값(args[0])을 포맷 문자열로 직접 사용
//   args[0]에 "%1$tY-%1$tm-%1$te"를 전달하면 시스템 날짜(2014-10-14)가 노출됨
System.out.printf(args[0] + " did not match! HINT: It was issued on %1$terd of some month", validDate);

// 안전한 코드: args[0]을 %s의 인자로만 사용하고 고정 포맷 문자열 사용
System.out.printf("%s did not match! HINT: It was issued on %2$terd of some month", args[0], validDate);
```

## 안전한 코드 (C 출력 함수 선택)

```c
int ret = snprintf(msg, len, msg_format, user);  // "%s cannot be authenticated.\n"
if (ret < 0 || ret >= len) { /* 오류 처리 */ }

// 안전하지 않은 코드: fprintf(stderr, msg);  // msg를 포맷 위치에 직접 전달
// 안전한 코드: 포맷 해석을 하지 않는 fputs 사용
if (fputs(msg, stderr) == EOF) {
    /* 오류 처리 */
}
free(msg);
msg = NULL;
```

## 시험 포인트

- 포맷 스트링 삽입: printf·fprintf·sprintf의 포맷 문자열로 외부입력값을 검증 없이 사용 시 발생
- 공격 영향: 메모리 읽기·쓰기, 리턴 주소 조작으로 임의 코드 실행, 데이터 표현 문제
- 보안대책: 입력값을 포맷 문자열·포맷 생성에 사용 금지 / 포맷 지정자와 인자 개수 일치
- Java: args[0]을 포맷에 직접 넣지 말고 `%s` 인자로 사용(직접 사용 시 `%1$tY` 등으로 날짜 정보 노출)
- C: `fprintf(stderr, msg)` 대신 `fputs(msg, stderr)` 사용
