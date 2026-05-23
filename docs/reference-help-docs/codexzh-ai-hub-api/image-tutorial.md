# 生图模型调用教程

> 来源：https://docs.codexzh.com/ai-hub-api/image-tutorial
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- 生图模型调用教程
  - OpenAI 协议
    - 安装依赖
    - Python 调用
    - curl 调用
    - 支持的参数
    - 参考图生成模式
  - Gemini 原生协议
    - 安装依赖
    - Python 调用
    - curl 调用
  - 两种协议对比
  - 相关链接

## 原文内容

# 生图模型调用教程

AI Hub API 支持两种协议调用图像生成模型：

-   **OpenAI 协议**：使用 `openai` 库，调用 `/v1/images/generations` 接口，适合生成独立图片
-   **Gemini 原生协议**：使用 `google-genai` 库，支持多轮对话式生图和图文混合输出

前置准备

-   已注册 AI Hub API 账号：[https://api.xbai.top](https://api.xbai.top/)
-   已创建 API 令牌，**分组选择「默认分组」**
-   生图模型推荐使用 `nano-banana-2`，Gemini 生图模型使用 `gemini-3.1-flash-image-preview`

* * *

## OpenAI 协议

### 安装依赖

bash

```
pip install openai requests
```

### Python 调用

#### 基础生图

python

```
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",         # 替换为你的 API 令牌
    base_url="https://api.xbai.top/v1"
)

response = client.images.generate(
    model="nano-banana-2",          # 生图模型名称
    prompt="一只可爱的橘猫在阳光下打盹，水彩画风格",
    n=1,                            # 生成图片数量
    size="1024x1024",               # 图片尺寸
    quality="standard",             # standard 或 hd
    response_format="url"           # 返回 url 或 b64_json
)

image_url = response.data[0].url
print(f"图片地址：{image_url}")
```

#### 生成并保存到本地

python

```
import requests
from pathlib import Path
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.xbai.top/v1"
)

response = client.images.generate(
    model="nano-banana-2",
    prompt="赛博朋克风格的城市夜景，霓虹灯倒映在雨后的街道上",
    size="1024x1024",
    response_format="url"
)

image_url = response.data[0].url
img_data = requests.get(image_url).content
Path("output.png").write_bytes(img_data)
print("图片已保存到 output.png")
```

#### 返回 Base64 格式

python

```
import base64
from pathlib import Path
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.xbai.top/v1"
)

response = client.images.generate(
    model="nano-banana-2",
    prompt="极简风格的山水画，留白构图",
    size="1024x1024",
    response_format="b64_json"      # 返回 Base64 编码
)

b64_data = response.data[0].b64_json
img_bytes = base64.b64decode(b64_data)
Path("output.png").write_bytes(img_bytes)
print("图片已保存到 output.png")
```

### curl 调用

#### 基础生图

bash

```
curl https://api.xbai.top/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
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

### 支持的参数

| 参数 | 类型 | 说明 | 可选值 |
| --- | --- | --- | --- |
| `model` | string | 生图模型 | `nano-banana-2` 等，见控制台模型广场 |
| `prompt` | string | 图片描述提示词 | 最长 4000 字符 |
| `n` | int | 生成数量 | 1–4 |
| `size` | string | 图片尺寸 | `256x256` `512x512` `1024x1024` `1024x1792` `1792x1024` |
| `quality` | string | 图片质量 | `standard`（默认）、`hd` |
| `response_format` | string | 返回格式 | `url`（默认）、`b64_json` |

### 参考图生成模式

使用 `/v1/images/edits` 接口，上传参考图片并结合提示词生成新图片，支持单张或多张参考图。

#### Python 调用

python

```
import requests
from pathlib import Path

url = "https://api.xbai.top/v1/images/edits"

with open("image1.jpg", "rb") as f1, open("image2.jpg", "rb") as f2:
    response = requests.post(
        url,
        headers={"Authorization": "Bearer your-api-key"},
        files=[
            ("image", ("image1.jpg", f1, "image/jpeg")),
            ("image", ("image2.jpg", f2, "image/jpeg"))
        ],
        data={
            "model": "gpt-image-2",
            "prompt": "图1 的模特穿上图2的外套"
        }
    )

result = response.json()
image_url = result["data"][0]["url"]
print(f"图片地址：{image_url}")

img_data = requests.get(image_url).content
Path("output.png").write_bytes(img_data)
print("图片已保存到 output.png")
```

#### 返回 Base64 格式

python

```
import requests
import base64
from pathlib import Path

url = "https://api.xbai.top/v1/images/edits"

with open("image1.jpg", "rb") as f1, open("image2.jpg", "rb") as f2:
    response = requests.post(
        url,
        headers={"Authorization": "Bearer your-api-key"},
        files=[
            ("image", ("image1.jpg", f1, "image/jpeg")),
            ("image", ("image2.jpg", f2, "image/jpeg"))
        ],
        data={
            "model": "gpt-image-2",
            "prompt": "图1 的模特穿上图2的内衣",
            "response_format": "b64_json"
        }
    )

result = response.json()
b64_data = result["data"][0]["b64_json"]
img_bytes = base64.b64decode(b64_data)
Path("output.png").write_bytes(img_bytes)
print("图片已保存到 output.png")
```

#### curl 调用

bash

```
curl --request POST \
  --url https://api.xbai.top/v1/images/edits \
  --header "Authorization: Bearer your-api-key" \
  --form "image=@image1.jpg" \
  --form "image=@image2.jpg" \
  --form "model=gpt-image-2" \
  --form "prompt=图1 的模特穿上图2的内衣"
```

响应格式与基础生图一致：

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

提示

-   `image` 字段可以传一个或多个参考图片文件
-   提示词中用「图1」「图2」指代上传的参考图片顺序
-   支持 `response_format` 参数，值为 `url`（默认）或 `b64_json`

* * *

## Gemini 原生协议

Gemini 原生协议基于 Google GenAI SDK，支持对话式生图（多轮迭代）和图文混合输出，图片以 Base64 内嵌方式返回。

### 安装依赖

bash

```
pip install google-genai pillow
```

### Python 调用

#### 基础生图

python

```
from google import genai
from google.genai import types
import base64
from pathlib import Path

client = genai.Client(
    api_key="your-api-key",
    http_options=types.HttpOptions(
        base_url="https://api.xbai.top"
    )
)

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="请生成一张图片：一只可爱的橘猫在阳光下打盹，水彩画风格",
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"]
    )
)

for part in response.candidates[0].content.parts:
    if part.inline_data:
        img_bytes = base64.b64decode(part.inline_data.data)
        Path("output.png").write_bytes(img_bytes)
        print("图片已保存到 output.png")
    elif part.text:
        print(part.text)
```

#### 多轮对话式生图

python

```
from google import genai
from google.genai import types
import base64
from pathlib import Path

client = genai.Client(
    api_key="your-api-key",
    http_options=types.HttpOptions(
        base_url="https://api.xbai.top"
    )
)

chat = client.chats.create(
    model="gemini-3.1-flash-image-preview",
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"]
    )
)

# 第一轮：生成初始图片
response = chat.send_message("生成一只橘猫在草地上的图片")
for i, part in enumerate(response.candidates[0].content.parts):
    if part.inline_data:
        img_bytes = base64.b64decode(part.inline_data.data)
        Path(f"round1.png").write_bytes(img_bytes)
        print("第一轮图片已保存")
    elif part.text:
        print(f"描述：{part.text}")

# 第二轮：基于上一张图片继续调整
response = chat.send_message("给猫咪戴上一顶草帽")
for i, part in enumerate(response.candidates[0].content.parts):
    if part.inline_data:
        img_bytes = base64.b64decode(part.inline_data.data)
        Path(f"round2.png").write_bytes(img_bytes)
        print("第二轮图片已保存")
```

#### 图文混合输出

python

```
from google import genai
from google.genai import types
import base64
from pathlib import Path

client = genai.Client(
    api_key="your-api-key",
    http_options=types.HttpOptions(
        base_url="https://api.xbai.top"
    )
)

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="写一段关于秋天的短文，并配上一张秋叶飘落的插图",
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"]
    )
)

img_count = 0
for part in response.candidates[0].content.parts:
    if part.text:
        print(part.text)
    elif part.inline_data:
        img_bytes = base64.b64decode(part.inline_data.data)
        filename = f"image_{img_count}.png"
        Path(filename).write_bytes(img_bytes)
        print(f"[图片已保存：{filename}]")
        img_count += 1
```

### curl 调用

Gemini 原生协议通过 `generateContent` 接口调用，图片以 Base64 格式内嵌在响应中。

#### 基础生图

bash

```
curl https://api.xbai.top/v1beta/models/gemini-3.1-flash-image-preview:generateContent \
  -H "x-goog-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {"text": "请生成一张图片：一只可爱的橘猫在阳光下打盹，水彩画风格"}
        ]
      }
    ],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"]
    }
  }'
```

响应示例：

json

```
{
  "candidates": [
    {
      "content": {
        "parts": [
          {"text": "这是一只在阳光下打盹的橘猫..."},
          {
            "inlineData": {
              "mimeType": "image/png",
              "data": "<base64编码的图片数据>"
            }
          }
        ]
      }
    }
  ]
}
```

#### 从响应中提取图片（Shell 脚本）

bash

```
# 发送请求并保存响应
curl https://api.xbai.top/v1beta/models/gemini-3.1-flash-image-preview:generateContent \
  -H "x-goog-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"生成一张赛博朋克城市夜景图片"}]}],"generationConfig":{"responseModalities":["TEXT","IMAGE"]}}' \
  -o response.json

# 提取 Base64 数据并解码为图片（需要安装 jq）
cat response.json | jq -r '.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data' | base64 -d > output.png
echo "图片已保存到 output.png"
```

* * *

## 两种协议对比

| 特性 | OpenAI 协议 | Gemini 原生协议 |
| --- | --- | --- |
| 调用接口 | `/v1/images/generations` | `/v1beta/models/{model}:generateContent` |
| Python 库 | `openai` | `google-genai` |
| 返回格式 | URL 或 Base64 | Base64 内嵌 |
| 多轮对话生图 | 不支持 | ✅ 支持 |
| 图文混合输出 | 不支持 | ✅ 支持 |
| 适用场景 | 独立生图任务 | 交互式/迭代式生图 |

* * *

## 相关链接

-   [快速开始](https://docs.codexzh.com/ai-hub-api/quick-start) - 注册账号与创建令牌
-   [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups) - 查看可用模型
-   [聊天模型调用教程](https://docs.codexzh.com/ai-hub-api/chat-tutorial) - 聊天接口教程
-   [Cherry Studio 图像生成](https://docs.codexzh.com/ai-hub-api/nano-banana2) - 客户端生图教程

* * *

最后更新：2026-04-26
