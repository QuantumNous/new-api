# 错误码

API 返回的错误状态码及说明。

| HTTP 状态码 | 说明 | 解决方案 |
| --- | --- | --- |
| `400` | 请求参数错误 | 检查请求体格式和参数 |
| `401` | 认证失败 | 检查 API Key 是否正确 |
| `403` | 权限不足 | 检查令牌是否有对应模型权限 |
| `404` | 路径或任务不存在 | 检查 URL 是否正确，异步任务请确认 `task_id` |
| `413` | 请求体过大 | 减小文件、图片或上下文体积 |
| `429` | 请求频率超限 | 降低请求频率或联系管理员 |
| `500` | 服务器内部错误 | 稍后重试或联系支持 |
| `502` | 上游服务不可用 | 上游提供商异常，稍后重试 |
| `503` | 服务暂不可用 | 服务维护中，请稍候 |

## 常见错误代码

| `error.code` | 含义 | 排查方向 |
| --- | --- | --- |
| `invalid_api_key` | 令牌无效 | 检查是否复制完整，是否用了错误分组的 Key |
| `insufficient_quota` | 额度不足 | 充值或切换到仍有额度的令牌 |
| `model_not_found` | 模型不存在或当前不可用 | 先用 `GET /v1/models` 确认实时可用模型 |
| `context_length_exceeded` | 上下文过长 | 裁剪历史消息、文件或输入文本 |
| `unsupported_endpoint` | 模型不支持当前接口 | 例如某些模型应改用 `/v1/responses` 或原生接口 |

## 错误响应格式

```json
{
  "error": {
    "message": "Incorrect API key provided: sk-****.",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_api_key"
  }
}
```

## 排查建议

- OpenAI 兼容客户端确认 Base URL 是 `http://61kj.top/v1`，不要重复拼 `/v1`
- 确认请求头已经带上 `Authorization: Bearer sk-your-token-here`
- 当 `/v1/chat/completions` 无法满足需求时，优先尝试 `/v1/responses`
- 调用前先用 `GET /v1/models` 检查当前令牌可用的 GPT 模型
