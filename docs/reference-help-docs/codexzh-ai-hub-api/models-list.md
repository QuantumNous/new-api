# 获取可用模型列表

> 来源：https://docs.codexzh.com/ai-hub-api/models-list
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- 获取可用模型列表
  - Python 调用
    - 安装依赖
    - 获取模型列表
    - 格式化输出
    - 按前缀筛选模型
  - curl 调用
  - 相关链接

## 原文内容

# 获取可用模型列表

通过 API 查询当前令牌（Key）下可调用的全部模型，方便在代码中动态获取模型列表，无需手动维护。

前置准备

-   已创建 API 令牌（在控制台获取）
-   令牌分组决定返回的模型范围，**默认分组**返回完整模型列表

* * *

## Python 调用

### 安装依赖

bash

```
pip install openai
```

### 获取模型列表

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.xbai.top/v1"
)

models = client.models.list()

for model in models.data:
    print(model.id)
```

### 格式化输出

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.xbai.top/v1"
)

models = client.models.list()
model_ids = sorted([m.id for m in models.data])

print(f"共 {len(model_ids)} 个可用模型：\n")
for model_id in model_ids:
    print(f"  - {model_id}")
```

### 按前缀筛选模型

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.xbai.top/v1"
)

models = client.models.list()
all_ids = [m.id for m in models.data]

# 筛选 Claude 系列
claude_models = [m for m in all_ids if m.startswith("claude")]
print("Claude 模型：", claude_models)

# 筛选 GPT 系列
gpt_models = [m for m in all_ids if m.startswith("gpt")]
print("GPT 模型：", gpt_models)

# 筛选 Gemini 系列
gemini_models = [m for m in all_ids if m.startswith("gemini")]
print("Gemini 模型：", gemini_models)
```

* * *

## curl 调用

bash

```
curl https://api.xbai.top/v1/models \
  -H "Authorization: Bearer your-api-key"
```

响应示例：

json

```
{
  "object": "list",
  "data": [
    {
      "id": "claude-sonnet-4-5",
      "object": "model",
      "created": 1234567890,
      "owned_by": "anthropic"
    },
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1234567890,
      "owned_by": "openai"
    }
  ]
}
```

* * *

## 相关链接

-   [聊天模型调用教程](https://docs.codexzh.com/ai-hub-api/chat-tutorial)
-   [生图模型调用教程](https://docs.codexzh.com/ai-hub-api/image-tutorial)
-   [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups)

* * *

**最后更新**：2026-03-03
