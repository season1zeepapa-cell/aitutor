# COURSE-06 · Ⅵ. 소스코드 보안약점 진단 실습

> **유형** 교육자료 (양성과정 교재) · **출처** 2025년 SW보안약점 진단원 기본(양성)과정 (p.501–520)

## 개요

제공된 Java 소스코드를 대상으로 **구현단계 보안약점**을 진단하는 실습 과정이다. JDK·Eclipse IDE로 진단환경을 구축하고 **SpotBugs·FindSecurityBugs** 진단도구를 설치·설정한 뒤, 실습 프로젝트를 import하여 보안약점을 탐지하고 소스코드를 수정·재진단하며, 결과를 **보고서 템플릿**으로 작성하는 절차를 학습한다.

## 1. 진단 환경 구축 (JDK · Eclipse IDE)

- **JDK(Java Development Kit)**: Oracle Java **1.8 버전 또는 이후 버전** 설치 → cmd에서 `java --version`으로 설치 확인
- **Eclipse IDE(통합개발환경)**: **Photon(4.8.0) 또는 이후 버전** 설치, zip 압축 해제 후 `eclipse.exe` 실행
- **Workspace** 폴더 지정(예: `C:/e/workspace`)하여 실습 프로젝트 작업공간으로 사용

## 2. 진단도구 설치 (SpotBugs · FindSecurityBugs)

- **SpotBugs**: Eclipse `Help > Install New Software`에서 `https://spotbugs.github.io/eclipse/` 추가 후 설치
- **SpotBugs Reporter 설정**

| 항목 | 설정값 |
|------|--------|
| Minimum rank to report | **20** |
| Minimum confidence to report | **Low** |
| Reported bug categories | **Security** |

- **FindSecurityBugs**: `find-sec-bugs.github.io`에서 `findsecbugs-plugin` jar 다운로드 → SpotBugs `Plugins` 탭에서 **Add**로 추가
- **룰셋 확인**: `Detector configuration` 탭의 **Provider** 컬럼에 **SpotBugs**와 **Find Security Bugs** 두 룰셋이 보이면 설치 정상

> 📌 FindSecurityBugs는 단독 도구가 아니라 **SpotBugs에 보안 룰셋을 추가하는 플러그인**이다.

## 3. 실습 프로젝트 구성과 파일 이해

- 제공된 프로젝트 파일 압축 해제 후 Eclipse에 import (`Existing Projects into Workspace` → `Copy projects into workspace`)
- **testcases** 폴더에 보안약점 **유형별 파일** 존재
- 각 파일에 취약/비취약 코드가 함께 포함

| 메소드 | 의미 |
|--------|------|
| `bad()` | 취약한 코드 |
| `goodG2B()`, `goodB2G()` | 취약하지 않은(안전한) 코드 |

- 테스트 케이스는 **NIST의 Juliet Test Suite**를 참조

## 4. 진단 수행 절차와 결과 확인

1. 프로젝트 우클릭 > **SpotBugs > Find Bugs**로 진단 실행
2. Package Explorer의 프로젝트·자바 파일명 오른쪽 **숫자 = SpotBugs가 발견한 위반 사항 개수**
3. `Window > Perspective > Open Perspective > Other > SpotBugs`로 진단 전용 화면 열기
4. **Bug Explorer**에 심각도·항목별 목록 표시, 항목 더블클릭 시 해당 소스로 이동
5. **BugInfo** 확인 후 취약 소스코드 수정 → **SpotBugs 재실행**으로 보안약점 제거 여부 검증

## 5. 진단보고서 작성 템플릿

| 항목 | 기재 내용 |
|------|-----------|
| 보안약점 | **유형 · 이름** |
| 위치 | **파일경로 · 위반라인** |
| 취약코드 | 발견된 취약 소스 |
| 취약사유 | 보안약점이 되는 이유 |
| 개선방안 | 조치 방향 |
| 개선코드 | 수정된 안전한 소스 |

## 🎯 시험 출제 포인트

1. 진단환경: **JDK 1.8 이상 + Eclipse Photon(4.8.0) 이상** 전제
2. SpotBugs Reporter 설정: **rank 20 / confidence Low / category Security**
3. FindSecurityBugs는 **SpotBugs에 보안 룰셋을 추가하는 플러그인** (단독 도구 아님)
4. `bad()`=취약 코드, `goodG2B()`/`goodB2G()`=비취약 코드, 출처는 **NIST Juliet Test Suite**
5. 진단 수행: **프로젝트 우클릭 > SpotBugs > Find Bugs**, 파일명 옆 숫자=위반 개수
6. 수정 후 **SpotBugs 재실행**으로 제거 여부 확인
7. 보고서 필수 항목: 유형·이름 / 파일경로·위반라인 / 취약코드 / 취약사유 / 개선방안 / 개선코드

**핵심 키워드**: SpotBugs · FindSecurityBugs · 정적분석 · JDK · Eclipse · Juliet Test Suite · 진단보고서 · testcases · 구현단계 보안약점
