# Foxcode 状态接口接入说明

接口地址：`https://status.rjj.cc/api/status-page/heartbeat/foxcode`

## 接入结果

Foxcode 使用 Uptime Kuma 状态页接口。后端状态聚合已支持直接配置 heartbeat URL，不再要求管理员手动拆分 `url` 和 `slug`。

可用配置：

```json
[
  {
    "categoryName": "Foxcode",
    "url": "https://status.rjj.cc/api/status-page/heartbeat/foxcode",
    "description": "Foxcode 模型状态"
  }
]
```

兼容原有配置：

```json
[
  {
    "categoryName": "Foxcode",
    "url": "https://status.rjj.cc",
    "slug": "foxcode",
    "description": "Foxcode 模型状态"
  }
]
```

## 接口结构

该接口只返回心跳和 24 小时可用率：

```json
{
  "heartbeatList": {
    "2": [
      {
        "status": 1,
        "time": "2026-05-23 05:39:40.128",
        "msg": "",
        "ping": 3960
      }
    ]
  },
  "uptimeList": {
    "2_24": 0.9876
  }
}
```

为了拿到线路名称和分组，适配器会根据 heartbeat URL 自动推导并请求：

```text
https://status.rjj.cc/api/status-page/foxcode
```

然后用 `publicGroupList[].monitorList[].id` 关联 `heartbeatList` 和 `uptimeList`。

## 当前字段映射

| Foxcode / Uptime Kuma 字段 | 本地字段 | 说明 |
| --- | --- | --- |
| `publicGroupList[].name` | `Monitor.Group` | 状态页分组，例如 `Claude Code 分组` |
| `monitorList[].name` | `Monitor.Name` | 线路名，例如 `Codex 官方线路` |
| `heartbeatList[id][0].status` | `Monitor.Status` | 最新状态 |
| `uptimeList[id + "_24"]` | `Monitor.Uptime` | 24 小时可用率 |

## 状态含义

按 Uptime Kuma 约定：

- `1`：正常
- `0`：异常

Foxcode heartbeat 当前不提供 Ikun 那种 `request_model` 级字段，因此动态调度接入时应按“监控线路 ID / 线路名”建立渠道映射，不能直接按模型名自动匹配。
