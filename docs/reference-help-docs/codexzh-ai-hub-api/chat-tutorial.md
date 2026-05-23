# 聊天模型调用教程

> 来源：https://docs.codexzh.com/ai-hub-api/chat-tutorial
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- 聊天模型调用教程
  - Python 调用
    - 安装依赖
    - 基础调用
    - 流式输出
    - 多轮对话
    - 使用环境变量（推荐）
  - curl 调用
    - 基础请求
    - 流式输出
    - 多轮对话
  - 响应格式
  - 常用参数
  - 错误处理
  - 相关链接

## 原文内容

# 聊天模型调用教程

通过 **Python** 和 **curl** 调用 AI Hub API 中转的聊天模型（支持 GPT、Claude、Gemini 等全系列）。

前置准备

-   已注册 AI Hub API 账号：[https://api.xbai.top](https://api.xbai.top/)
-   已创建 API 令牌，**分组选择「默认分组」**
-   Python 环境已安装（3.8+）

* * *

## Python 调用

### 安装依赖

bash

```
pip install openai
```

### 基础调用

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",         # 替换为你的 API 令牌
    base_url="https://api.xbai.top/v1"
)

response = client.chat.completions.create(
    model="gpt-5.2",      # 模型名称，可在控制台模型广场查看
    messages=[
        {"role": "system", "content": "你是一个有帮助的助手。"},
        {"role": "user", "content": "介绍一下人工智能的发展历史"}
    ],
    max_tokens=1000
)

print(response.choices[0].message.content)
```

### 流式输出

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.xbai.top/v1"
)

stream = client.chat.completions.create(
    model="gpt-5.2",
    messages=[
        {"role": "user", "content": "写一首关于春天的诗"}
    ],
    stream=True
)

for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)
print()
```

### 多轮对话

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.xbai.top/v1"
)

# 维护对话历史
messages = [
    {"role": "system", "content": "你是一个 Python 编程专家。"}
]

def chat(user_input):
    messages.append({"role": "user", "content": user_input})
    response = client.chat.completions.create(
        model="gpt-5.2",
        messages=messages
    )
    reply = response.choices[0].message.content
    messages.append({"role": "assistant", "content": reply})
    return reply

print(chat("如何读取 JSON 文件？"))
print(chat("如果文件不存在怎么办？"))   # 会记住上一轮的上下文
```

### 使用环境变量（推荐）

python

```
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("AI_HUB_API_KEY"),
    base_url="https://api.xbai.top/v1"
)
```

bash

```
# 设置环境变量
export AI_HUB_API_KEY="your-api-key"
```

* * *

## curl 调用

### 基础请求

bash

```
curl https://api.xbai.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-5.2",
    "messages": [
      {"role": "system", "content": "你是一个有帮助的助手。"},
      {"role": "user", "content": "介绍一下人工智能的发展历史"}
    ],
    "max_tokens": 1000
  }'
```

### 流式输出

bash

```
curl https://api.xbai.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-5.2",
    "messages": [
      {"role": "user", "content": "写一首关于春天的诗"}
    ],
    "stream": true
  }'
```

### 多轮对话

bash

```
curl https://api.xbai.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-5.2",
    "messages": [
      {"role": "system", "content": "你是一个 Python 编程专家。"},
      {"role": "user", "content": "如何读取 JSON 文件？"},
      {"role": "assistant", "content": "可以使用内置的 json 模块：import json\nwith open(\"file.json\") as f:\n    data = json.load(f)"},
      {"role": "user", "content": "如果文件不存在怎么办？"}
    ]
  }'
```

* * *

## 响应格式

成功响应示例：

json

```
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-5.2",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "人工智能的发展历史可以追溯到..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 30,
    "completion_tokens": 200,
    "total_tokens": 230
  }
}
```

* * *

## 常用参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string | 模型名称，在控制台模型广场查看可用列表 |
| `messages` | array | 对话消息，包含 `role`（system/user/assistant）和 `content` |
| `max_tokens` | int | 最大输出 token 数 |
| `temperature` | float | 随机性（0-2），越高输出越随机，默认 1.0 |
| `stream` | boolean | 是否启用流式输出，默认 false |
| `top_p` | float | 核采样（0-1），与 temperature 二选一使用 |

* * *

## 错误处理

python

```
import os
from openai import OpenAI, APIError, AuthenticationError, RateLimitError

client = OpenAI(
    api_key=os.environ.get("AI_HUB_API_KEY"),
    base_url="https://api.xbai.top/v1"
)

try:
    response = client.chat.completions.create(
        model="gpt-5.2",
        messages=[{"role": "user", "content": "你好"}]
    )
    print(response.choices[0].message.content)

except AuthenticationError:
    print("API 密钥无效，请检查令牌是否正确")
except RateLimitError:
    print("请求超出速率限制，稍后重试")
except APIError as e:
    print(f"API 错误：{e}")
```

* * *

## 相关链接

-   [快速开始](https://docs.codexzh.com/ai-hub-api/quick-start) - 注册账号与创建令牌
-   [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups) - 查看可用模型
-   [生图模型调用教程](https://docs.codexzh.com/ai-hub-api/image-tutorial) - 图像生成教程

* * *

**最后更新**：2026-03-03
