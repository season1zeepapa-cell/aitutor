# IMP-IV-06 · 위험한 형식 파일 업로드 (Dangerous File Upload)

> **단계** 구현 · **분류** 입력데이터 검증 및 표현 · **CWE** CWE-434
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §6 위험한 형식 파일 업로드 (p.232–238)

## 가. 개요

서버 측에서 실행될 수 있는 **스크립트 파일(asp, jsp, php 등)** 이 업로드 가능하고, 이 파일을 공격자가 웹으로 직접 실행시킬 수 있는 경우, 시스템 내부명령어를 실행하거나 외부와 연결하여 시스템을 제어할 수 있는 보안약점이다.

## 나. 보안대책

- **화이트 리스트** 방식으로 허용된 확장자만 업로드 허용
- 저장 시 파일명·확장자를 **외부사용자가 추측할 수 없는 문자열로 변경**
- 저장 경로를 **'web document root' 밖**에 위치시켜 웹 직접 접근 차단
- 파일 실행여부 설정 가능 시 **실행 속성 제거**

## 다. 코드예제

### Java
업로드 파일의 확장자를 검사하여 허용되지 않은 확장자인 경우 업로드를 제한한다.

```java
// ❌ 취약: 업로드 파일명을 검증 없이 사용
String fileName = multi.getFilesystemName("filename");
pstmt.setString(6, fileName);
Thumbnail.create(savePath+"/"+fileName, savePath+"/"+"s_"+fileName, 150);
```
```java
// ✅ 안전: 마지막 "." 기준 확장자 추출 + toLowerCase + 화이트 리스트 제한
String fileName = multi.getFilesystemName("filename");
if (fileName != null) {
  String fileExt = fileName.substring(fileName.lastIndexOf(".")+1).toLowerCase();
  if (!"gif".equals(fileExt) && !"jpg".equals(fileExt) && !"png".equals(fileExt)) {
    alertMessage("업로드 불가능한 파일입니다.");
    return;
  }
}
```

### C#
```csharp
// ❌ 취약: 업로드 파일명을 검증 없이 사용
string fn = Path.GetFileName(FileUploadCtr.FileName);
FileUploadCtr.SaveAs(fn);
```
```csharp
// ✅ 안전: 파일 타입(ContentType)과 크기(ContentLength) 제한
if (FileUploadCtr.PostedFile.ContentType == "image/jpeg") {
  if (FileUploadCtr.PostedFile.ContentLength < 102400) {
    string fn = Path.GetFileName(FileUploadCtr.FileName);
    FileUploadCtr.SaveAs(Server.MapPath("~/") + fn);
  }
}
```

## 라. 진단방법

1. **①** 외부 입력값에서 파일명을 얻어오는 부분이 존재하는지 확인
2. **②** 허용된 확장자에 대해서만 파일 업로드를 허용하는지 확인

> 허용된 파일만 업로드되고 파일명을 외부에서 알 수 없는 형태로 변경하면 안전, 그 외에는 취약. `getOriginalFilename()` 으로 업로드하면서 확장자를 체크하지 않으면 취약 판정.

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 업로드 파일 확장자를 체크하지 않음 → 취약
String orginFileName = file.getOriginalFilename();
String fileExt = orginFileName.substring(orginFileName.lastIndexOf(".") + 1);
file.transferTo(new File(storePathString + File.separator + newName)); // 확장자 검증 없음
```
```java
// 확장자 필터링하나 대소문자 구분 안함 → JSP, Jsp, PHP 등 우회 가능 → 취약
String fileName = file.getOriginalFilename();
if ( fileName != null ) {
  if ( !fileName.endsWith(".jsp") ) { /* file 업로드 루틴 */ }
}
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

```java
// fileExt.toLowerCase() 로 확장자 체크/필터링 → 안전
String fileExt = orginFileName.substring(orginFileName.lastIndexOf(".") + 1);
for(Object fileExclusionExt : this.fileExclusionExtension) {
  if( ((String) fileExclusionExt).equals(fileExt.toLowerCase())){
    throw new Exception("egume.message.error.file.exclusion.extension");
  }
}
```
```java
// getOriginalFilename() 리턴 값을 저장/사용하지 않음 → 취약하지 않음
if (!"".equals(file.getOriginalFilename())) {
  zipManageService.insertExcelZip(file.getInputStream());
```

## 마. 참고자료

- CWE-434 Unrestricted Upload of File with Dangerous Type, MITRE — http://cwe.mitre.org/data/definitions/434.html
- Prevent arbitrary file upload, CERT (IDS56-J) / Secure File Upload Check List With PHP / Unrestricted File Upload, OWASP

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 화이트 리스트 확장자 검증 · 대소문자 구분(toLowerCase) · 파일명 난수화 · web document root 밖 저장 · 실행 속성 제거 · getOriginalFilename() · 파일 타입/크기 제한
- **객관형 시드**: 취약/안전 코드쌍 또는 정탐/오탐 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: 정탐 코드 제시 → 취약 여부(Y/N) + 근거 서술, 채점은 키워드 포함 여부로 정·오탐 판정
