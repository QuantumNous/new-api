# 使用 API

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/user/api.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/user/api.mdx

## 页面大纲

  - 操练场在线测试
    - 访问操练场
    - 使用操练场
  - 获取 API 地址
    - 复制 API 地址
    - 配置客户端
  - 代码示例
    - Python（OpenAI SDK）
    - Claude 原生格式
    - Gemini 原生格式
  - 支持的接口端点

## 原文内容

---
title: 使用 API
description: 将平台地址替换 OpenAI 的 base_url，使用平台颁发的令牌作为 api_key，即可开始调用
---
将平台地址替换 OpenAI 的 `base_url`，使用平台颁发的令牌作为 `api_key`，即可开始调用。

## 操练场在线测试

操练场是内置的在线测试工具，无需编写代码即可直接与模型对话，适合快速验证令牌是否可用。

### 访问操练场

左侧导航点击「操练场」，或直接访问 `/console/playground`

![操练场页面](/assets/guide/feature-guide/playground.png)

### 使用操练场

1. 在左侧选择要测试的模型
2. 在底部输入框输入消息内容，点击发送
3. 右侧对话区域显示模型的回复结果

![操练场对话示例](/assets/guide/feature-guide/playground-chat.png)

## 获取 API 地址

### 复制 API 地址

1. 访问平台首页
2. 在页面中部找到 API Base URL 显示区域
3. 点击复制按钮，将地址复制到剪贴板

![首页 API 地址复制区域](/assets/guide/feature-guide/api-address.png)

### 配置客户端

将复制的地址填入你的客户端或代码中作为 `base_url`，配合令牌即可开始调用。

## 代码示例

### Python（OpenAI SDK）

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxxxxxxxxxx",  # 平台颁发的令牌
    base_url="https://your-platform.com/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

### Claude 原生格式

```bash
curl https://your-platform.com/v1/messages \
  -H "x-api-key: sk-xxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### Gemini 原生格式

```bash
curl "https://your-platform.com/v1beta/models/gemini-1.5-pro:generateContent?key=sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

## 支持的接口端点

| 接口 | 路径 | 说明 |
| --- | --- | --- |
| 聊天补全 | `POST /v1/chat/completions` | 对话生成，支持流式输出 |
| 文本补全 | `POST /v1/completions` | 传统补全接口 |
| 向量嵌入 | `POST /v1/embeddings` | 文本向量化 |
| 图像生成 | `POST /v1/images/generations` | 文生图 |
| 图像编辑 | `POST /v1/images/edits` | 图像编辑 |
| 语音转文字 | `POST /v1/audio/transcriptions` | Whisper 等 |
| 文字转语音 | `POST /v1/audio/speech` | TTS |
| 重排序 | `POST /v1/rerank` | 文档重排序 |
| Responses API | `POST /v1/responses` | OpenAI Responses 格式 |
| 实时对话 | `GET /v1/realtime`（WebSocket） | OpenAI Realtime API |
| 模型列表 | `GET /v1/models` | 查询可用模型 |
