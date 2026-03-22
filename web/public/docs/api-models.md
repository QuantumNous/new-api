# GPT 模型列表

常见 GPT 模型示例与实时查询方式。

<div class="callout info">
  <div class="callout-icon">ℹ️</div>
  <div class="callout-content">
    <p><strong>重要：</strong>文档里的模型仅作示例，真实可用模型请始终以 <code>GET /v1/models</code> 的返回结果为准。</p>
  </div>
</div>

## 实时查询

```bash
curl http://61kj.top/v1/models \
  -H "Authorization: Bearer sk-your-token-here"
```

## 常见 GPT 模型

| 模型 ID | 类型 | 典型用途 |
| --- | --- | --- |
| `gpt-5.4` | 旗舰通用 | 复杂问答、代码、长文本处理 |
| `gpt-5.2` | 均衡通用 | 日常对话、工具调用、内容生成 |
| `gpt-4o` | 多模态通用 | 常规聊天、图文理解、接口兼容场景 |
| `gpt-4o-mini` | 轻量通用 | 成本敏感、批量请求、低延迟场景 |
