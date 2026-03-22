# Live Dashboard — Android App 源码

本分支仅包含 Android 客户端的源代码，供需要自行编译或二次开发的用户使用。

- 下载 APK → [main 分支 / agents/android-app](https://github.com/Monika-Dream/live-dashboard/tree/main/agents/android-app)
- 主项目说明 → [main 分支](https://github.com/Monika-Dream/live-dashboard)

## 构建

见 [agents/android-app/BUILD.md](./agents/android-app/BUILD.md)。

## 架构

```
MainActivity (Compose UI, 3 tabs)
  ├─ SetupScreen     → 服务器地址 + Token 配置 + 心跳开关
  ├─ HealthScreen    → Health Connect 权限 + 数据类型 + 同步间隔
  └─ StatusScreen    → 权限检查 + 调试日志

Workers (WorkManager):
  ├─ HeartbeatWorker    → 可选，周期性上报在线状态 + 电量 (30-300s)
  └─ HealthSyncWorker   → 周期性 Health Connect 数据同步 (15-60 min)
```

详细代码说明见 [agents/android-app/GUIDE.md](./agents/android-app/GUIDE.md)。
