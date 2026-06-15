# IMP-SF-15 · 무결성 검사 없는 코드 다운로드

> **단계** 구현 · **분류** 보안기능 · **CWE** CWE-494
> **출처** 소프트웨어 보안약점 진단가이드(2021) — 제4장 §15 무결성 검사 없는 코드 다운로드 (p.394–399)

## 가. 개요

원격으로부터 소스코드 또는 실행파일을 무결성 검사 없이 다운로드 받고, 이를 실행하는 제품들이 종종 존재한다. 이는 호스트 서버의 변조, DNS 스푸핑(Spoofing) 또는 전송시의 코드 변조 등의 방법을 이용하여 공격자가 악의적인 코드를 실행할 수 있도록 한다.

## 나. 보안대책

- DNS 스푸핑(Spoofing)을 방어할 수 있는 DNS lookup을 수행하고 코드 전송시 신뢰할 수 있는 암호 기법을 이용하여 코드를 암호화한다.
- 다운로드한 코드는 작업 수행을 위해 필요한 최소한의 권한으로 실행하도록 한다.

## 다. 코드예제

### Java
URLClassLoader()로 원격에서 파일을 다운로드한 뒤 로드하면서 무결성 검사를 수행하지 않으면 공격자가 악의적인 실행코드로 클래스의 내용을 수정할 수 있다.

```java
// ❌ 취약: 무결성 검사 없이 원격 클래스 로드
URL[] classURLs = new URL[] { new URL("file:subdir/") };
URLClassLoader loader = new URLClassLoader(classURLs);
Class loadedClass = Class.forName("LoadMe", true, loader);
```
```java
// ✅ 안전: 공개키 방식 암호화로 시그니처를 생성하고 변조유무를 판단한다.
//   서버에서는 Private Key를 가지고 MyClass를 암호화한다.
String jarFile = "./download/util.jar";
byte[] loadFile = FileManager.getBytes(jarFile);
loadFile = encrypt(loadFile, privateKey);
// jarFileName으로 암호화된 파일을 생성한다.
FileManager.createFile(loadFile, jarFileName);

// 클라이언트에서는 파일을 다운로드 받을 경우 Public Key로 복호화한다.
URL[] classURLs = new URL[] { new URL("http://filesave.com/download/util.jar") };
URLConnection conn = classURLs.openConnection();
InputStream is = conn.getInputStream();
// 입력 스트림을 jarFile명으로 파일을 출력한다.
FileOutputStream fos = new FileOutputStream(new File(jarFile));
While (is.read(buf) != -1) {
......
}
byte[] loadFile = FileManager.getBytes(jarFile);
loadFile = decrypt(loadFile, publicKey);
// 복호화된 파일을 생성한다.
FileManager.createFile(loadFile, jarFile);
URLClassLoader loader = new URLClassLoader(classURLs);
Class loadedClass = Class.forName("MyClass", true, loader);
```

### C#
```csharp
// ❌ 취약: 파일 무결성 검사 없이 다운로드
public override bool DownloadFile()
{
  var url = "https://www.somewhere.untrusted.com";
  var desDir = "D:/DestinationPath";
  string fileName = Path.GetFileName(url);
  string descFilePath = Path.Combine(desDir, fileName);
  try
  {
    WebRequest myre = WebRequest.Create(url);
  }
  catch (Exception ex)
  {
    throw new Exception(ex.Message);
  }
  try
  {
    byte[] fileData;
    using (WebClient client = new WebClient())
    {
      fileData = client.DownloadData(url);
    }
    using (FileStream fs = new FileStream(descFilePath, FileMode.OpenOrCreate))
    {
      fs.Write(fileData, 0, fileData.Length);
    }
    return true;
  }
  catch (Exception ex)
  {
    throw new Exception(ex.Message);
  }
}
```
```csharp
// ✅ 안전: 해시 값 등을 사용하여 다운로드 받은 파일 무결성 검사
public override bool DownloadFile()
{
  var url = "https://www.somewhere.untrusted.com";
  var desDir = "D:/DestinationPath";
  string fileName = Path.GetFileName(url);
  string descFilePath = Path.Combine(desDir, fileName);
  try
  {
    WebRequest myre = WebRequest.Create(url);
  }
  catch (Exception ex)
  {
    throw new Exception(ex.Message);
  }
  try
  {
    byte[] fileData;
    using (WebClient client = new WebClient())
    {
      fileData = client.DownloadData(url);
    }
    CheckIntegrity(fileData);
    using (FileStream fs = new FileStream(descFilePath, FileMode.OpenOrCreate))
    {
      fs.Write(fileData, 0, fileData.Length);
    }
    return true;
  }
  catch (Exception ex)
  {
    throw new Exception(ex.Message);
  }
}
```

### C
```c
// ❌ 취약: 리턴값을 이용한 무결성 검사 없음
void foo(){
/* ... */
  hFile = CreateFile((LPCWSTR)data,GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  InternetQueryDataAvailable(m_hURL, &dwSize,0,0);
  InternetReadFile(m_hURL, lpBuffer, dwSize, &dwRead);
  WriteFile(hFile, lpBuffer, dwRead, &dwWritten, NULL);
/* ... */
```
```c
// ✅ 안전: 리턴 값을 이용하여 무결성을 확인한 후 사용
void foo(){
/* ... */
  hFile = CreateFile((LPCWSTR)data,GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  InternetQueryDataAvailable(m_hURL, &dwSize,0,0);
  bool result = InternetReadFile(m_hURL, lpBuffer, dwSize, &dwRead);
  if( result == true){
    WriteFile(hFile, lpBuffer, dwRead, &dwWritten, NULL);
  }
/* ... */
}
```

## 라. 진단방법

1. **①** 클래스를 로드하기 위한 코드를 확인
2. 클래스를 로드하기 전에 체크섬을 실행 및 비교하여 로드하려는 코드가 변조되지 않았음을 확인

### 🔴 정탐 코드 (실제 취약 — 취약하다고 판정해야 함)

```java
// 로드하려는 클래스의 체크섬을 비교하여 무결성을 확인하지 않음 → 취약
URL[] classURLs = new URL[]{
  new URL("file:subdir/")
};
URLClassLoader loader = new URLClassLoader(classURLs);
Class loadedClass = Class.forName("LoadMe", true, loader); // ①
```

### 🟢 오탐 코드 (실제 안전 — 취약하다고 오판하면 안 됨)

> 원문에 별도 오탐 예제 없음.

## 마. 참고자료

- CWE-494 Download of Code Without Integrity Check, MITRE — http://cwe.mitre.org/data/definitions/494.html
- Do not rely on the default automatic signature verification provided by URLClassLoader and java.util.jar, CERT (SEC06-J)

---

## 🎯 문제 생성 연결고리 (question_hooks)

- **핵심 키워드(서술형 채점용)**: 무결성 검사 · 체크섬 · URLClassLoader · 코드 변조 · DNS 스푸핑 · 전자서명 · 해시값 검증
- **객관형 시드**: 무결성 검사 없이 원격 코드를 로드/다운로드하는 코드와 체크섬·암호화로 검증하는 코드를 제시 → "보안약점 설명으로 잘못된 것" / "취약·안전 판정"
- **서술형 시드**: URLClassLoader로 원격 클래스를 로드하는 코드 제시 → 체크섬·무결성 검사 존재 여부로 정탐·오탐 판정
