# 客户端配置

服务端地址：

```txt
https://now.m1301.cyou
```

## Windows（审批流）

对应文件：

- `windows-pc-1.config.json`
- `windows-pc-2.config.json`

用法：

1. 下载 `live-dashboard-agent.exe`
2. 双击运行
3. 在设置页填写：
   - `server_url`
   - `device_id`
   - `device_name`
4. 点击“提交接入申请”
5. 管理员在 `/admin` 批准
6. 客户端点击“检查审批状态”

## Android（审批流源码已接入）

对应文件：

- `android-1.settings.txt`
- `android-2.settings.txt`

用法：

1. 安装 Android App
2. 打开 `SetupScreen`
3. 填写 `server_url`、`device_id`、`device_name`
4. 点击“提交接入申请”
5. 管理员在 `/admin` 批准
6. 点击“检查审批状态”领取 token

## 设备对应关系

| 设备 | 平台 | device_id | token |
|---|---|---|---|
| PC 1 | Windows | `pc-1` | 由管理员审批后自动签发 |
| PC 2 | Windows | `pc-2` | 由管理员审批后自动签发 |
| Android 1 | Android | `android-1` | 由管理员审批后自动签发 |
| Android 2 | Android | `android-2` | 由管理员审批后自动签发 |
