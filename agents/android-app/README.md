# Live Dashboard Android App — 源码

本分支包含 Android 客户端的完整源代码。

下载 APK 请前往 [main 分支](https://github.com/Monika-Dream/live-dashboard/tree/main/agents/android-app)。

## 构建

见 [BUILD.md](./BUILD.md)。

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

详细代码说明见 [GUIDE.md](./GUIDE.md)。
