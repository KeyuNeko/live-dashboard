# Build Guide

## 环境要求

- **JDK**: 17+
- **Android SDK**: compileSdk 36, minSdk 26
- **Gradle**: 使用项目自带的 `gradlew` wrapper
- **IDE** (可选): Android Studio Hedgehog (2023.1.1) 或更新

## 推荐本地环境（避免占用 C 盘）

```txt
JAVA_HOME=D:\DevTools\jdk-17.x
ANDROID_SDK_ROOT=D:\Android\Sdk
ANDROID_HOME=D:\Android\Sdk
GRADLE_USER_HOME=D:\GradleHome
ANDROID_USER_HOME=D:\Android\UserHome
```

## 构建步骤

```bash
cd agents/android-app
./gradlew assembleDebug
```

APK 输出路径: `app/build/outputs/apk/debug/app-debug.apk`

## Release 构建

项目支持通过环境变量注入签名配置：

```txt
LIVE_DASHBOARD_ANDROID_KEYSTORE=D:\Android\Keystore\live-dashboard-release.jks
LIVE_DASHBOARD_ANDROID_STORE_PASSWORD=******
LIVE_DASHBOARD_ANDROID_KEY_ALIAS=live-dashboard
LIVE_DASHBOARD_ANDROID_KEY_PASSWORD=******
```

构建命令：

```bash
cd agents/android-app
./gradlew assembleRelease
```

Release APK 输出：

```txt
app/build/outputs/apk/release/app-release.apk
```

## 安装到手机

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

或直接将 APK 传到手机安装。

## 项目结构

详见 [GUIDE.md](./GUIDE.md)。
