# 渠道而外设置说明

该配置用于设置一些额外的渠道参数，可以通过 JSON 对象进行配置。常用设置项包括：

1. force_format
    - 用于标识是否对数据进行强制格式化为 OpenAI 格式
    - 类型为布尔值，设置为 true 时启用强制格式化

2. proxy
    - 用于配置网络代理
    - 类型为字符串，填写代理地址（例如 socks5 协议的代理地址）

3. thinking_to_content
   - 用于标识是否将思考内容`reasoning_content`转换为`<think>`标签拼接到内容中返回
   - 类型为布尔值，设置为 true 时启用思考内容转换

4. upstream_warmup_enabled
   - 用于标识是否对该渠道启用上游连接预热
   - 类型为布尔值，设置为 true 时会在全局 `UPSTREAM_WARMUP_ENABLED` 开启时，定时请求该渠道上游的非计费预热路径
   - 预热任务会完整排空响应体后才记录为“连接可复用”，401/403/404 等业务状态码不会直接视为连接失败

--------------------------------------------------------------

## JSON 格式示例

以下是一个示例配置，启用强制格式化、上游连接预热并设置了代理地址：

```json
{
    "force_format": true,
    "thinking_to_content": true,
    "upstream_warmup_enabled": true,
    "proxy": "socks5://xxxxxxx"
}
```

--------------------------------------------------------------

## 上游预热相关环境变量

- `UPSTREAM_WARMUP_ENABLED`：是否启用进程级预热任务，默认 `true`
- `UPSTREAM_WARMUP_URLS`：手动追加的预热 URL，多个地址可用逗号、分号、空格或换行分隔
- `UPSTREAM_WARMUP_PATH`：渠道基础地址自动拼接的预热路径，默认 `/v1/models`
- `UPSTREAM_WARMUP_INTERVAL`：预热间隔，支持秒数或 Go duration，默认 `30s`，最小 `5s`
- `UPSTREAM_WARMUP_TIMEOUT`：单个预热请求超时，支持秒数或 Go duration，默认 `10s`
- `UPSTREAM_WARMUP_JITTER`：预热间隔抖动比例，范围 `0-0.5`，默认 `0.2`
- `UPSTREAM_WARMUP_CONCURRENCY`：预热并发 worker 数，默认 `8`，范围 `1-32`
- `UPSTREAM_WARMUP_H1_CONNECTIONS`：已确认 HTTP/1.x 上游每轮预热请求数，默认 `1`，范围 `1-32`；HTTP/2 上游始终每轮 `1` 次
- `UPSTREAM_WARMUP_UA`：预热请求 User-Agent，默认 `new-api-upstream-warmup/1.0`

--------------------------------------------------------------

通过调整上述 JSON 配置中的值，可以灵活控制渠道的额外行为，比如是否进行格式化以及使用特定的网络代理。
