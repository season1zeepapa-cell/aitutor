# 적절하지 않은 난수값 사용 (IMP-SF-08)

> 2025년 SW보안약점 진단원 기본(양성)과정 — Ⅴ. 구현 단계 보안약점 진단 > 보안기능 항목에 대한 고려 2-8 (pp.403-405)

## 요약

예측 가능한 난수를 발생시키는 취약한 API를 사용하면 공격자가 다음에 생성될 값을 예측해 시스템을 공격할 수 있다. 세션 아이디, 암호화 키 등 보안결정을 위한 값을 생성할 때는 예측이 거의 불가능한 `java.security.SecureRandom` 클래스를 사용해야 한다.

## 정의 — 약점이 발생하는 경우

- 예측 가능한 난수를 발생시키는 취약한 API를 사용하는 경우

## 위협

- 공격자가 SW에서 생성되는 다음 숫자를 예상하여 시스템을 공격하는 것이 가능

## 대책

- 세션 아이디, 암호화 키 등 보안결정을 위한 값 생성 시 `java.security.SecureRandom` 사용

## 진단 흐름 — 난수값 사용 기능 확인

- `Math.random()` 사용 → 위험
- `java.util.Random` → 보안결정 시 사용은 위험, 일반적 사용(보안결정 시 미사용)은 허용
- `java.security.SecureRandom` 사용 → 안전

## 코드 예시

- 안전하지 않은 코드: `Random number = new Random(123L);` (고정 시드 → 동일 난수). 매번 변경되는 seed라도 보안결정용으로는 안전하지 않음
- 안전한 코드: `SecureRandom number = SecureRandom.getInstanceStrong();` (암호학적으로 보호, `NoSuchAlgorithmException` 처리 포함)

## 시험 포인트

- 약점: 예측 가능한 난수 API 사용
- 위협: 공격자가 다음 숫자 예측 → 시스템 공격
- 대책: 보안결정용 난수는 `SecureRandom`
- `Math.random()` 위험 / `java.util.Random`은 보안결정 시 위험·일반 사용 허용
- 고정 시드 `new Random(123L)` 위험 → `SecureRandom.getInstanceStrong()`
