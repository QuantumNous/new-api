# API 调用示例

> 来源：https://docs.codexzh.com/ai-hub-api/api-examples
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- API 调用示例
  - OpenAI GPT 模型调用（Responses API）
    - Python 调用示例
    - HTTP 请求示例（curl）
    - 流式响应示例
    - 多轮对话
  - Claude / Gemini 模型调用（Chat Completions 协议）
    - Python 调用示例
    - HTTP 请求示例（curl）
    - 流式响应示例
  - 生图模型调用
    - OpenAI 格式（推荐）
    - Gemini 格式
  - 常用参数说明
    - Responses API 参数（GPT 模型）
    - Chat Completions 参数（Claude / Gemini 模型）
    - 生图模型参数（OpenAI 格式）
  - 注意事项
  - 相关链接

## 原文内容

# API 调用示例

本页提供 AI Hub API 中转的常见调用方式示例，帮助你快速集成到自己的应用。

前置准备

-   已注册 AI Hub API 账号
-   已创建 API 令牌（在控制台获取）
-   已选择对应的模型分组

* * *

OpenAI GPT 系列模型：请使用 Responses API，不要用 Chat Completions！

这是最常见的踩坑点。

| 模型系列 | 应使用的协议 | 端点 |
| --- | --- | --- |
| **GPT 系列**（gpt-5.4、gpt-5.3-codex 等 OpenAI 模型） | **Responses API** ✅ | `POST /v1/responses` |
| Claude 系列（claude-sonnet、claude-opus 等） | Chat Completions | `POST /v1/chat/completions` |
| Gemini 系列（gemini-pro、gemini-flash 等） | Chat Completions | `POST /v1/chat/completions` |

OpenAI 官方已推荐所有新项目迁移到 Responses API，它比 Chat Completions 更高效、成本更低、功能更强。通过本站中转调用 GPT 模型时，请使用 `/v1/responses` 端点。

* * *

## OpenAI GPT 模型调用（Responses API）

适用于：`gpt-5.4`、`gpt-5.3-codex` 及其他 GPT 系列模型

### Python 调用示例

python

```
from openai import OpenAI

# 初始化客户端
client = OpenAI(
    api_key="your-api-key-here",  # 替换为你的 API 令牌
    base_url="https://api.xbai.top/v1"  # AI Hub API 地址
)

# ✅ 使用 Responses API（GPT 模型推荐方式）
response = client.responses.create(
    model="gpt-5.4",
    instructions="你是一个有帮助的助手。",  # 相当于 system prompt
    input="介绍一下人工智能的发展历史"
)

# 直接获取文本输出
print(response.output_text)
```

### HTTP 请求示例（curl）

bash

```
# ✅ Responses API — GPT 模型请使用 /v1/responses 端点
curl https://api.xbai.top/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "model": "gpt-5.4",
    "instructions": "你是一个有帮助的助手。",
    "input": "介绍一下人工智能的发展历史"
  }'
```

响应示例：

json

```
{
  "id": "resp_abc123",
  "object": "response",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [{ "type": "output_text", "text": "人工智能的发展历史..." }]
    }
  ],
  "output_text": "人工智能的发展历史..."
}
```

访问输出：`response.output_text`（Python SDK 直接返回字符串）

### 流式响应示例

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key-here",
    base_url="https://api.xbai.top/v1"
)

# ✅ Responses API 流式输出
stream = client.responses.create(
    model="gpt-5.4",
    input="写一首关于春天的诗",
    stream=True
)

# 逐块输出（监听 output_text.delta 事件）
for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
```

### 多轮对话

Responses API 通过 `previous_response_id` 链接上下文，无需手动维护消息历史：

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key-here",
    base_url="https://api.xbai.top/v1"
)

# 第一轮
resp1 = client.responses.create(
    model="gpt-5.4",
    instructions="你是一个 Python 编程专家。",
    input="如何读取 JSON 文件？"
)
print(f"第一轮：{resp1.output_text}\n")

# 第二轮（传入上一轮 ID，自动携带上下文）
resp2 = client.responses.create(
    model="gpt-5.4",
    input="如果文件不存在怎么办？",
    previous_response_id=resp1.id  # 链接上下文
)
print(f"第二轮：{resp2.output_text}")
```

* * *

## Claude / Gemini 模型调用（Chat Completions 协议）

适用于：`claude-sonnet-4.5`、`claude-opus`、`gemini-2.5-pro` 等非 GPT 模型

WARNING

Claude 和 Gemini 模型**不支持** Responses API，请继续使用 Chat Completions 格式。

### Python 调用示例

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key-here",
    base_url="https://api.xbai.top/v1"
)

response = client.chat.completions.create(
    model="claude-sonnet-4.5",  # Claude 模型用 chat.completions
    messages=[
        {"role": "system", "content": "你是一个有帮助的助手。"},
        {"role": "user", "content": "介绍一下人工智能的发展历史"}
    ],
    temperature=0.7,
    max_tokens=1000
)

print(response.choices[0].message.content)
```

### HTTP 请求示例（curl）

bash

```
curl https://api.xbai.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "model": "claude-sonnet-4.5",
    "messages": [
      { "role": "system", "content": "你是一个有帮助的助手。" },
      { "role": "user", "content": "介绍一下人工智能的发展历史" }
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

### 流式响应示例

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key-here",
    base_url="https://api.xbai.top/v1"
)

stream = client.chat.completions.create(
    model="claude-sonnet-4.5",
    messages=[{"role": "user", "content": "写一首关于春天的诗"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

* * *

## 生图模型调用

AI Hub API 支持两种图像生成格式：OpenAI 格式（DALL-E 风格）和 Gemini 格式。

### OpenAI 格式（推荐）

#### Python 调用示例

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key-here",
    base_url="https://api.xbai.top/v1"
)

# 生成图片
response = client.images.generate(
    model="nano-banana-2",  # 生图模型名称
    prompt="一只可爱的橘猫在阳光下打盹，水彩画风格",
    n=1,  # 生成图片数量
    size="1024x1024",  # 图片尺寸：256x256, 512x512, 1024x1024, 1024x1792, 1792x1024
    quality="standard",  # 图片质量：standard 或 hd
    response_format="url"  # 返回格式：url 或 b64_json
)

# 获取图片 URL
image_url = response.data[0].url
print(f"生成的图片地址：{image_url}")

# 如果需要下载图片
import requests
from pathlib import Path

img_data = requests.get(image_url).content
Path("generated_image.png").write_bytes(img_data)
print("图片已保存到 generated_image.png")
```

#### HTTP 请求示例（curl）

bash

```
curl https://api.xbai.top/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "model": "nano-banana-2",
    "prompt": "一只可爱的橘猫在阳光下打盹，水彩画风格",
    "n": 1,
    "size": "1024x1024",
    "quality": "standard",
    "response_format": "url"
  }'
```

响应示例：

json

```
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://example.com/generated-image.png"
    }
  ]
}
```

### Gemini 格式

Gemini 格式使用聊天接口生成图片，通过特定的 prompt 触发图像生成。

#### Python 调用示例

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key-here",
    base_url="https://api.xbai.top/v1"
)

response = client.chat.completions.create(
    model="gemini-3-pro-image-preview",  # Gemini 生图模型
    messages=[
        {
            "role": "user",
            "content": "请生成一张图片：一只可爱的橘猫在阳光下打盹，水彩画风格"
        }
    ],
    temperature=0.7
)

content = response.choices[0].message.content
print(content)
```

#### HTTP 请求示例（curl）

bash

```
curl https://api.xbai.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "model": "gemini-3-pro-image-preview",
    "messages": [
      {
        "role": "user",
        "content": "请生成一张图片：一只可爱的橘猫在阳光下打盹，水彩画风格"
      }
    ],
    "temperature": 0.7
  }'
```

* * *

## 常用参数说明

### Responses API 参数（GPT 模型）

| 参数 | 类型 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `model` | string | 模型名称（如 `gpt-5.4`） | 必填 |
| `input` | string / array | 用户输入，字符串或消息数组 | 必填 |
| `instructions` | string | 系统指令（相当于 system prompt） | 可选 |
| `previous_response_id` | string | 上一轮响应 ID，用于多轮对话 | 可选 |
| `stream` | boolean | 是否启用流式输出 | false |

### Chat Completions 参数（Claude / Gemini 模型）

| 参数 | 类型 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `model` | string | 模型名称（如 `claude-sonnet-4.5`） | 必填 |
| `messages` | array | 对话消息列表 | 必填 |
| `temperature` | float | 随机性控制（0-2），越高越随机 | 1.0 |
| `max_tokens` | int | 最大生成 token 数 | 模型默认 |
| `stream` | boolean | 是否启用流式输出 | false |

### 生图模型参数（OpenAI 格式）

| 参数 | 类型 | 说明 | 可选值 |
| --- | --- | --- | --- |
| `model` | string | 生图模型名称 | `nano-banana-2` 等 |
| `prompt` | string | 图片描述提示词 | 必填 |
| `n` | int | 生成图片数量 | 1-10 |
| `size` | string | 图片尺寸 | `256x256`, `512x512`, `1024x1024`, `1024x1792`, `1792x1024` |
| `quality` | string | 图片质量 | `standard`, `hd` |
| `response_format` | string | 返回格式 | `url`, `b64_json` |

* * *

## 注意事项

1.  API 密钥安全：不要在代码中硬编码 API 密钥，建议使用环境变量：

    python

    ```
    import os
    api_key = os.getenv("AI_HUB_API_KEY")
    ```

2.  错误处理：生产环境中应添加完善的错误处理：

    python

    ```
    try:
        response = client.responses.create(...)  # GPT 模型
    except Exception as e:
        print(f"API 调用失败：{e}")
    ```

3.  速率限制：根据你的分组套餐，API 可能有速率限制，建议添加重试逻辑。

4.  模型选择：不同分组支持的模型不同，请参考 [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups)。


* * *

## 相关链接

-   [快速开始](https://docs.codexzh.com/ai-hub-api/quick-start) - 从零开始配置
-   [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups) - 了解各分组支持的模型
-   [分组定价](https://docs.codexzh.com/ai-hub-api/pricing) - 查看价格和配额
-   [OpenAI Responses API 官方文档](https://platform.openai.com/docs/api-reference/responses) - Responses API 参考

* * *

最后更新：2026-03-31
