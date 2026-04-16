# 远端日志收集接口契约

## Endpoint

`POST /api/security/remote_log_export`

权限：root 管理员。

## Request

```json
{
  "collector_url": "https://collector.example.com/new-api/security-logs",
  "collector_secret": "optional-hmac-secret",
  "start_timestamp": 1768492800,
  "end_timestamp": 1768579200,
  "quota_threshold": 500000000,
  "max_business_logs": 500,
  "log_tail_bytes": 262144,
  "include_log_file_tail": true
}
```

字段说明：

- `collector_url`：远端收集端地址；为空时使用 `SECURITY_LOG_COLLECTOR_URL`。
- `collector_secret`：HMAC 密钥；为空时使用 `SECURITY_LOG_COLLECTOR_SECRET`。仍为空时允许发送，但响应会标记 `signed=false`。
- `start_timestamp` / `end_timestamp`：Unix 秒级时间窗口；未传默认最近 24 小时，最大跨度 7 天。
- `quota_threshold`：异常用户余额阈值，默认等于 1000 美元对应额度。
- `max_business_logs`：导出的业务日志上限，默认 500，最大 2000。
- `log_tail_bytes`：导出当前日志文件尾部字节数，默认 256 KiB，最大 2 MiB。
- `include_log_file_tail`：是否包含当前日志文件尾部，默认 true。

## Remote Payload

```json
{
  "generated_at": 1768579200,
  "window": {
    "start_timestamp": 1768492800,
    "end_timestamp": 1768579200
  },
  "instance": {
    "version": "v0.0.0",
    "log_dir": "/app/logs",
    "log_file": "/app/logs/oneapi-20260417090000.log"
  },
  "summary": {
    "business_logs": 120,
    "topups": 8,
    "suspicious_users": 2
  },
  "suspicious_users": [
    {
      "id": 123,
      "username": "user1",
      "quota": 500000000,
      "quota_usd": 1000,
      "used_quota": 0,
      "successful_topup_quota": 0,
      "successful_topup_count": 0,
      "related_log_count": 0,
      "reasons": [
        "quota >= threshold",
        "no successful top-up records"
      ]
    }
  ],
  "recent_topups": [],
  "recent_business_logs": [],
  "log_file_tail": {
    "path": "/app/logs/oneapi-20260417090000.log",
    "truncated": true,
    "content": "..."
  }
}
```

## Remote Headers

- `Content-Type: application/json`
- `X-NewAPI-Event: security.remote_log_export`
- `X-NewAPI-Timestamp: <unix_seconds>`
- `X-NewAPI-Signature: sha256=<hmac_sha256(timestamp + "." + body)>`，仅当密钥存在时发送。

## Response

```json
{
  "collector_url": "https://collector.example.com/new-api/security-logs",
  "remote_status": 200,
  "signed": true,
  "payload_bytes": 12345,
  "suspicious_user_count": 2,
  "message": "exported"
}
```

错误情况：

- `collector_url` 缺失或非法：返回业务错误。
- 时间窗口非法或超过 7 天：自动裁剪为最大 7 天。
- 远端非 2xx：返回业务错误并包含远端状态码。
