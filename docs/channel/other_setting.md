# 渠道额外设置说明

该配置用于设置一些额外的渠道参数，可以通过 JSON 对象进行配置。常见设置项如下：

1. force_format
    - 用于标识是否对数据进行强制格式化为 OpenAI 格式
    - 类型为布尔值，设置为 true 时启用强制格式化

2. proxy
    - 用于配置网络代理
    - 类型为字符串，填写代理地址（例如 socks5 协议的代理地址）

3. thinking_to_content
   - 用于标识是否将思考内容`reasoning_content`转换为`<think>`标签拼接到内容中返回
   - 类型为布尔值，设置为 true 时启用思考内容转换

4. channel_rate_limit_*
   - 用于配置本地渠道级请求限流，按用户分别使用令牌桶计数
   - `channel_rate_limit_enabled`: 是否启用渠道限流
   - `channel_rate_limit_count`: 每周期允许的请求数；启用时必须大于 0
   - `channel_rate_limit_period_seconds`: 限流周期（秒）；启用时必须大于 0
   - `channel_rate_limit_scope`: 限流范围，支持 `channel`（按渠道）或 `key`（按渠道内密钥）
   - `key` 仅对多密钥渠道生效；某个密钥达到限制后会尝试该渠道的其他可用密钥

--------------------------------------------------------------

## JSON 格式示例

以下是一个示例配置，启用强制格式化并设置了代理地址：

```json
{
    "force_format": true,
    "thinking_to_content": true,
    "proxy": "socks5://xxxxxxx",
    "channel_rate_limit_enabled": true,
    "channel_rate_limit_count": 2,
    "channel_rate_limit_period_seconds": 60,
    "channel_rate_limit_scope": "channel"
}
```

--------------------------------------------------------------

通过调整上述 JSON 配置中的值，可以灵活控制渠道的额外行为，比如是否进行格式化以及使用特定的网络代理。
