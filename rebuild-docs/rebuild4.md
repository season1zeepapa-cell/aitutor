# AI TutorTwo — Capacitor 모바일 앱 적용 (rebuild4)

## 개요

AI TutorTwo 웹 앱에 Capacitor를 적용하여 iOS/Android 네이티브 앱으로 빌드·배포 가능하도록 구성했습니다.
`workspace/docstore`의 Capacitor 설정 패턴을 기반으로 동일한 구조를 적용했습니다.

---

## 적용 단계 및 결과

### 1단계: Capacitor 코어 패키지 설치

| 패키지 | 버전 | 유형 |
|--------|------|------|
| `@capacitor/core` | ^8.2.0 | dependencies |
| `@capacitor/network` | ^8.0.1 | dependencies |
| `@capacitor/cli` | ^8.2.0 | devDependencies |
| `@capacitor/ios` | ^8.2.0 | devDependencies |
| `@capacitor/android` | ^8.2.0 | devDependencies |

**테스트**: `npm run build:fe` → 빌드 성공 (651ms)

---

### 2단계: Capacitor 설정 파일 + npm 스크립트

**capacitor.config.json**:
```json
{
  "appId": "com.aitutortwo.app",
  "appName": "AI TutorTwo",
  "webDir": "dist",
  "server": {
    "url": "https://aitutor-six.vercel.app",
    "cleartext": false
  },
  "ios": { "scheme": "AITutorTwo" },
  "android": { "allowMixedContent": false }
}
```

**추가된 npm 스크립트**:
```
cap:sync    — npx cap sync (iOS/Android 동기화)
cap:ios     — npx cap open ios (Xcode 열기)
cap:android — npx cap open android (Android Studio 열기)
cap:build   — npm run build:fe && npx cap sync (빌드 후 동기화)
```

---

### 3단계: iOS/Android 플랫폼 초기화

```bash
npx cap add ios      # ✅ ios/ 디렉토리 생성
npx cap add android  # ✅ android/ 디렉토리 생성
```

- iOS: Xcode 프로젝트 + Swift Package Manager 자동 구성
- Android: Gradle 프로젝트 자동 구성
- `@capacitor/network` 플러그인 양쪽 플랫폼에 자동 등록

---

### 4단계: 네이티브 플랫폼 유틸리티

**신규 파일**:

| 파일 | 역할 |
|------|------|
| `src/lib/capacitor.js` | `isNative()`, `getPlatform()` — 플랫폼 감지 |
| `src/hooks/useNetwork.js` | 네이티브는 `@capacitor/network`, 웹은 `navigator.onLine` |
| `src/components/OfflineBanner.jsx` | 오프라인 시 상단 빨간 배너 표시 |

**App.jsx 통합**: `<OfflineBanner />` 전역 추가

**테스트**: `npm run build:fe` → 빌드 성공 (540ms, 66 모듈)

---

### 5단계: Android 네이티브 설정

**MainActivity.java** — 상태바 영역 WebView 확장:
```java
WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
```

**AndroidManifest.xml** — 권한 추가:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**variables.gradle**: minSdk 24, compileSdk 36, targetSdk 36 (docstore 동일)

---

### 6단계: iOS 네이티브 설정

**Info.plist**: Capacitor 자동 생성 설정 확인 완료
- CFBundleDisplayName: "AI TutorTwo"
- iPhone: 세로 + 가로 회전 지원
- iPad: 전방향 지원

**Package.swift**: iOS 15.0+, Swift 5.9, `CapacitorNetwork` 플러그인 등록 확인

---

### 7단계: .gitignore 업데이트

네이티브 빌드 산출물 제외 항목 추가:
```
ios/App/Pods/
ios/App/App/public/
android/.gradle/
android/.idea/
android/app/build/
android/app/src/main/assets/public/
android/local.properties
```

---

### 8단계: cap:build 최종 테스트

```bash
npm run cap:build
```

**결과**:
- Vite 빌드: ✅ 517ms, 66 모듈, 13개 에셋
- Android sync: ✅ 웹 에셋 복사 + Network 플러그인 등록
- iOS sync: ✅ 웹 에셋 복사 + Network 플러그인 등록

---

## 프로젝트 구조 (Capacitor 적용 후)

```
workspace/aitutor/
├── capacitor.config.json          # Capacitor 설정
├── package.json                   # cap:* 스크립트 추가
├── vite.config.js                 # webDir: dist
├── vercel.json                    # Vercel 배포 (변경 없음)
│
├── src/                           # 프론트엔드 소스
│   ├── lib/capacitor.js           # 🆕 플랫폼 감지
│   ├── hooks/useNetwork.js        # 🆕 네트워크 상태
│   ├── components/OfflineBanner.jsx # 🆕 오프라인 배너
│   └── App.jsx                    # OfflineBanner 통합
│
├── ios/                           # 🆕 iOS 네이티브 프로젝트
│   └── App/
│       ├── App/
│       │   ├── AppDelegate.swift
│       │   ├── Info.plist
│       │   └── capacitor.config.json
│       ├── App.xcodeproj/
│       └── CapApp-SPM/Package.swift
│
├── android/                       # 🆕 Android 네이티브 프로젝트
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/.../MainActivity.java
│   │   │   ├── AndroidManifest.xml
│   │   │   └── res/
│   │   └── build.gradle
│   ├── variables.gradle
│   └── settings.gradle
│
├── api/                           # 서버리스 API (변경 없음)
└── dist/                          # Vite 빌드 출력
```

---

## 앱 스토어 출시 체크리스트

### iOS App Store

- [x] appId: `com.aitutortwo.app`
- [x] appName: `AI TutorTwo`
- [x] iOS scheme: `AITutorTwo`
- [x] 최소 iOS 15.0 (Capacitor 8 요구사항 충족)
- [x] iPhone 세로/가로 회전 지원
- [x] iPad 전방향 지원
- [x] safe-area CSS 대응 (viewport-fit=cover)
- [ ] 앱 아이콘 세트 준비 (1024x1024 → 각 사이즈 생성)
- [ ] 스플래시 스크린 이미지 교체
- [ ] Apple Developer 계정에서 App ID 등록
- [ ] Xcode에서 Signing & Capabilities 설정
- [ ] App Store Connect에서 앱 등록 + 스크린샷

### Google Play Store

- [x] applicationId: `com.aitutortwo.app`
- [x] minSdk 24 (Android 7.0+, 99%+ 기기 지원)
- [x] targetSdk 36 (최신 Google Play 요구사항 충족)
- [x] INTERNET + ACCESS_NETWORK_STATE 권한
- [x] 상태바 edge-to-edge 레이아웃
- [ ] 앱 아이콘 교체 (mipmap-* 디렉토리)
- [ ] 스플래시 스크린 교체
- [ ] Google Play Console에서 앱 등록
- [ ] 서명 키(keystore) 생성
- [ ] 릴리스 빌드 (APK/AAB) 생성

---

## 개발 워크플로우

```bash
# 웹 개발 (브라우저)
npm run dev              # Vite 개발 서버 (localhost:5174)

# 네이티브 앱 빌드
npm run cap:build        # Vite 빌드 + iOS/Android 동기화

# iOS 빌드 (Xcode)
npm run cap:ios          # Xcode 열기 → Run

# Android 빌드 (Android Studio)
npm run cap:android      # Android Studio 열기 → Run

# Vercel 배포 (웹)
npx vercel --prod --yes  # 기존과 동일
```

---

## docstore vs aitutor 비교

| 항목 | docstore | aitutor |
|------|----------|---------|
| appId | com.docstore.app | com.aitutortwo.app |
| Capacitor 버전 | 8.2.0 | 8.2.0 |
| 플러그인 | Camera, Filesystem, Network, FilePicker | Network |
| iOS 최소 | 15.0 | 15.0 |
| Android minSdk | 24 | 24 |
| targetSdk | 36 | 36 |
| server.url | docstore-eight.vercel.app | aitutor-six.vercel.app |

aitutor는 퀴즈/학습 앱이므로 카메라·파일 시스템 플러그인 없이 Network만 사용합니다.
향후 필요 시 `npm install @capacitor/camera` 등으로 플러그인 추가 가능합니다.
