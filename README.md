# Live Dashboard — Android App 源码

[Live Dashboard](https://github.com/Monika-Dream/live-dashboard) 的 Android 客户端源代码。

下载 APK → [main 分支](https://github.com/Monika-Dream/live-dashboard/tree/main/agents/android-app)

## 功能

- **Health Connect 数据同步**：读取 17 种健康数据类型（心率、步数、睡眠、血氧等），通过 WorkManager 定时上传至服务器
- **心跳上报（可选）**：默认关闭。开启后周期性上报手机在线状态 + 电量，让网页端显示手机在线

## 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | Kotlin |
| UI | Jetpack Compose + Material 3 |
| 后台任务 | WorkManager（自调度 OneTimeWorkRequest，绕过 15 分钟最小周期限制） |
| 健康数据 | Google Health Connect API |
| 网络 | OkHttp3 |
| 存储 | DataStore (Preferences) + EncryptedSharedPreferences (Token) |
| 最低版本 | Android 8.0 (API 26)，编译目标 API 34 |

## 构建

```bash
cd agents/android-app
./gradlew assembleDebug
```

APK 输出：`app/build/outputs/apk/debug/app-debug.apk`

需要 JDK 17+，Android SDK compileSdk 34。

## 架构

```
MainActivity (Compose UI, 3 tabs)
  ├─ SetupScreen     → 服务器地址 + Token + 心跳间隔 + 开关
  ├─ HealthScreen    → Health Connect 权限授权 + 数据类型选择 + 同步间隔
  └─ StatusScreen    → 权限状态检查 + OEM 保活提示 + 调试日志

Workers (WorkManager, 存活于进程冻结):
  ├─ HeartbeatWorker    → 可选，上报在线状态 + 电量 (30-300s 间隔)
  └─ HealthSyncWorker   → 定时读取 Health Connect → POST /api/health-data (15-60 min)

Data:
  ├─ SettingsStore   → DataStore (配置) + EncryptedSharedPreferences (Token, AES256-GCM)
  ├─ ReportClient    → OkHttp3 HTTP 客户端 (reportApp / reportHealthData / testConnection)
  └─ DebugLog        → 内存环形日志 (ConcurrentLinkedDeque, 100 条)
```

## 文件说明

源码位于 `agents/android-app/app/src/main/java/com/monika/dashboard/`：

| 文件 | 职责 |
|------|------|
| `MainActivity.kt` | 入口，Scaffold + TopAppBar（连接状态指示器），3 个 Tab 导航 |
| `ui/screens/SetupScreen.kt` | 服务器 URL / Token / 心跳间隔配置，保存按钮，心跳开关 |
| `ui/screens/HealthScreen.kt` | Health Connect 权限管理，数据类型多选，同步间隔设置 |
| `ui/screens/StatusScreen.kt` | Health Connect / 电池优化 / 通知权限状态卡片，小米自启动引导，OEM 保活提示，调试日志 |
| `ui/theme/Theme.kt` | Material 3 主题定义（Primary `#E8A0BF`、Border、TextMuted 等） |
| `data/SettingsStore.kt` | 所有持久化设置。DataStore 存配置，EncryptedSharedPreferences 存 Token |
| `data/DebugLog.kt` | 线程安全环形日志缓冲区（ConcurrentLinkedDeque，上限 100 条） |
| `network/ReportClient.kt` | HTTP 客户端。`reportApp()` 上报心跳，`reportHealthData()` 上报健康数据，`testConnection()` 测试连通 |
| `service/HeartbeatWorker.kt` | WorkManager Worker，自调度 OneTimeWorkRequest 实现 30-300s 心跳。读取电量通过 BatteryManager |
| `health/HealthConnectManager.kt` | 封装 Health Connect API，读取 17 种健康数据类型 |
| `health/HealthSyncWorker.kt` | WorkManager 周期性 Worker，读取 Health Connect → 调用 ReportClient 上传 |
| `health/HealthDataTypes.kt` | 健康数据类型元数据（中文标签、单位、图标） |
| `DashboardApp.kt` | Application 类，WorkManager 初始化 |
| `PermissionRationaleActivity.kt` | Health Connect 权限说明页（系统回调） |

## 数据流

### 心跳上报（可选）

```
用户开启 → SetupScreen → HeartbeatWorker.schedule()
  → WorkManager 延迟触发 → doWork()
    → BatteryManager 读电量
    → ReportClient.reportApp() → POST /api/report {app_id: "android", battery}
    → 自调度下一次 OneTimeWorkRequest
```

关键设计：使用 OneTimeWorkRequest 自调度而非 PeriodicWorkRequest，绕过 WorkManager 15 分钟最小周期限制。底层 AlarmManager 确保即使被小米 cgroup freezer 冻结也能唤醒。

### Health Connect 同步

```
用户授权 + 选择数据类型 → HealthScreen 保存配置
  → HealthSyncWorker 定时触发 (15-60 min)
    → HealthConnectManager 读取各类型最近数据
    → ReportClient.reportHealthData() → POST /api/health-data {records: [...]}
```

### 连接状态检测

```
MainActivity TopAppBar → LaunchedEffect 每 5s 循环
  → ReportClient.testConnection() → GET /api/health
  → 成功 = "已连接"(绿) / 失败 = "未连接"(灰)
```

## API 接口

| 方法 | 路径 | 用途 | 调用者 |
|------|------|------|--------|
| POST | `/api/report` | 心跳上报（电量 + 在线状态） | HeartbeatWorker |
| POST | `/api/health-data` | 上传健康数据记录 | HealthSyncWorker |
| GET | `/api/health` | 连接测试 | MainActivity |

## 设计决策

- **无前台应用检测**：Android 无法在非 root 环境下可靠获取前台应用。无障碍服务在国产 ROM（小米 HyperOS 等）上会被 cgroup v2 freezer 冻结，不可用。前台应用监控由 PC 端 Agent 完成。
- **无音乐监听**：v2 移除了 NotificationListenerService，简化为纯健康数据工具。
- **心跳默认关闭**：不是所有用户都需要在网页上显示手机在线，作为可选功能。
- **Token 加密存储**：使用 AndroidX EncryptedSharedPreferences (AES256-GCM)，不以明文存储。
- **URL 安全校验**：只允许 HTTPS，仅 localhost/127.0.0.1 允许 HTTP。

## 更新日志

### v2.0 — 2026-03-22

- 移除音乐监听服务（MusicListenerService）
- 移除前台应用监控服务（AppMonitorService）
- 心跳功能改为可选（默认关闭）
- 图标更新：粉色底 + 白色心形
- 清理不再需要的权限
