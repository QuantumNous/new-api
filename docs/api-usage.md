# API 调用文档

本文档描述了通过本服务调用 AI 视频生成、图片生成和文本对话的完整方式。所有接口兼容 OpenAI API 格式，可直接使用任何 OpenAI SDK 或兼容客户端调用。

---

## 连接信息

| 项目 | 值 |
|------|-----|
| Base URL | `http://206.119.182.61/v1` |
| 认证方式 | HTTP Header `Authorization: Bearer <api-key>` |
| 兼容协议 | OpenAI API (Chat Completions, Models, Video Generations) |
| 测试 API Key | `sk-qZ9riqHVLChWVgVJXEkgYht3kVvVnnXS9xx9hVjzlcG7nKe9` |
| 测试 Key 额度 | 50,000,000 单位（约 $50） |

所有请求必须在 HTTP Header 中携带 API Key：

```
Authorization: Bearer sk-qZ9riqHVLChWVgVJXEkgYht3kVvVnnXS9xx9hVjzlcG7nKe9
```

---

## 一、视频生成（Gemini Veo）

视频生成采用**异步任务模式**：先提交任务获取 task_id，然后轮询任务状态，直到视频生成完成。

### 1.1 提交视频生成任务

**请求：**

```
POST {Base URL}/video/generations
Content-Type: application/json
Authorization: Bearer <api-key>
```

#### 1.1.1 文生视频

最基础的调用方式，仅提供文字描述即可生成视频。

```json
{
  "model": "veo3.1-fast",
  "prompt": "A golden retriever running on a beach at sunset, cinematic quality, slow motion"
}
```

#### 1.1.2 图生视频（首帧）

提供一张图片作为视频的首帧，模型会基于图片内容生成后续视频。

```json
{
  "model": "veo3.1",
  "prompt": "The character starts walking forward slowly",
  "images": [
    "https://example.com/first_frame.jpg"
  ]
}
```

#### 1.1.3 图生视频（首尾帧）

提供两张图片分别作为视频的首帧和尾帧，模型会生成从首帧过渡到尾帧的视频。**仅部分模型支持首尾帧**（见下方模型列表）。

```json
{
  "model": "veo3.1",
  "prompt": "Smooth transition from the first pose to the second pose",
  "images": [
    "https://example.com/first_frame.jpg",
    "https://example.com/last_frame.jpg"
  ]
}
```

#### 1.1.4 多图参考（Components 模式）

提供 1-3 张参考图片，模型会将这些图片作为视频中的元素融合生成。使用 `veo3.1-components` 或 `veo3.1-fast-components` 模型。

```json
{
  "model": "veo3.1-components",
  "prompt": "A person wearing the outfit in front of the building",
  "images": [
    "https://example.com/person.jpg",
    "https://example.com/outfit.jpg",
    "https://example.com/building.jpg"
  ]
}
```

#### 1.1.5 带额外参数

```json
{
  "model": "veo3.1",
  "prompt": "A cat walking across the room",
  "images": [
    "https://example.com/first_frame.jpg"
  ],
  "aspect_ratio": "16:9",
  "enhance_prompt": true
}
```

### 1.2 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| model | string | 是 | 视频生成模型名称，见下方模型列表 |
| prompt | string | 是 | 视频内容描述，建议用英文，描述越详细效果越好 |
| images | array[string] | 否 | 参考图片 URL 或 base64 编码。传图后自动启用图生视频模式。不同模型对图片数量限制不同（见模型列表） |
| aspect_ratio | string | 否 | 视频比例，可选 `16:9`（横屏）或 `9:16`（竖屏）。不传时文生视频默认 16:9，图生视频根据参考图自动匹配 |
| enhance_prompt | boolean | 否 | 是否优化提示词。由于 Veo 只支持英文提示词，开启后会自动将中文提示词翻译为英文并优化。默认 false |
| enable_upsample | boolean | 否 | 是否提升分辨率至 1080p。仅文生视频支持。默认 false |

### 1.3 可用视频模型

#### 基础模型（推荐使用）

上游调用方只需使用基础模型名，系统会根据是否传入 `images` 字段自动路由到合适的下游模型。

| 模型名 | 说明 | 单次价格 | images 限制 | 支持首尾帧 |
|--------|------|----------|-------------|-----------|
| veo3.1-fast | 快速生成，约 30-60 秒 | $0.3 | 2 张 | ✅ |
| veo3.1 | 标准质量 | $0.4 | 2 张 | ✅ |
| veo3.1-pro | 高质量 | $1.5 | 2 张 | ✅ |
| veo3.1-pro-4k | 4K 高质量 | $15 | 2 张 | ✅ |
| veo3.1-components | 多图参考模式 | $0.4 | 3 张 | ❌（元素参考） |
| veo3.1-fast-components | 快速多图参考 | $0.3 | 3 张 | ❌（元素参考） |
| veo3.1-lite | 轻量版 | $0.6 | — | — |

#### 高级模型（直接指定下游模型名）

如果需要精确控制下游模型，也可以直接使用以下模型名：

| 模型名 | 说明 | 单次价格 | images 限制 |
|--------|------|----------|-------------|
| veo3-pro-frames | Veo3 图生视频（仅首帧） | $1.5 | 1 张 |
| veo3-fast-frames | Veo3 快速图生视频 | $0.3 | 1+ 张 |
| veo2-fast-frames | Veo2 首尾帧 | $0.3 | 2 张（首尾帧） |
| veo2-fast-components | Veo2 多图元素参考 | $0.3 | 3 张 |
| veo3.1-fast-4k | Veo3.1 快速 4K | $1.5 | 2 张 |
| veo3.1-4k | Veo3.1 标准 4K | $1.5 | 2 张 |
| veo3.1-components-4k | Veo3.1 多图参考 4K | $1.5 | 3 张 |
| veo3.1-fast-components-4k | Veo3.1 快速多图参考 4K | $1.5 | 3 张 |
| veo3.1-lite-4k | 轻量版 4K | $0.65 | — |

### 1.4 模型自动映射规则

系统根据请求中是否包含 `images` 字段，自动将基础模型映射为合适的下游模型：

| 基础模型 | 无 images（文生视频） | 有 images（图生视频） |
|----------|---------------------|---------------------|
| veo3.1 | veo3.1 | veo3.1（自带首尾帧支持） |
| veo3.1-fast | veo3.1-fast | veo3.1-fast（自带首尾帧支持） |
| veo3.1-pro | veo3.1-pro | veo3.1-pro（自带首尾帧支持） |
| veo3.1-components | veo3.1-components | veo3.1-components（多图参考） |
| veo3 | veo3 | veo3-pro-frames |
| veo3-fast | veo3-fast | veo3-fast-frames |
| veo2-fast | veo2-fast | veo2-fast-frames |

> **设计原则**：上游调用方无需感知下游中转站的模型命名差异。只需使用基础模型名 + `images` 字段，系统自动处理路由。后续对接新的中转站时，只需在内部映射表中添加规则，上游调用方式不变。

### 1.5 成功响应（HTTP 200）

```json
{
  "id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH",
  "task_id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH"
}
```

返回的 `task_id` 用于后续查询任务状态。

### 1.6 查询视频生成状态

**请求：**

```
GET {Base URL}/video/generations/{task_id}
Authorization: Bearer <api-key>
```

将 `{task_id}` 替换为提交任务时返回的 task_id。

**响应（生成中）：**

```json
{
  "code": "success",
  "data": {
    "task_id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH",
    "status": "IN_PROGRESS",
    "progress": "50%",
    "data": {
      "status": "RUNNING",
      "progress": 50
    }
  }
}
```

**响应（生成成功）：**

```json
{
  "code": "success",
  "data": {
    "task_id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH",
    "status": "SUCCESS",
    "progress": "100%",
    "data": {
      "status": "SUCCESS",
      "data": {
        "output": "https://midjourney-plus.oss-us-west-1.aliyuncs.com/flow/xxxx.mp4"
      }
    }
  }
}
```

**响应（生成失败）：**

```json
{
  "code": "success",
  "data": {
    "task_id": "task_xxx",
    "status": "FAILURE",
    "progress": "0%",
    "data": {
      "status": "FAILED",
      "fail_reason": "Content policy violation"
    }
  }
}
```

**任务状态流转：**

```
QUEUED → IN_PROGRESS → SUCCESS
                     → FAILURE
```

| 状态 | 含义 | 是否终态 |
|------|------|----------|
| QUEUED | 任务排队中，等待处理 | 否 |
| IN_PROGRESS | 视频正在生成中 | 否 |
| SUCCESS | 生成成功，视频 URL 在 `data.data.data.output` | 是 |
| FAILURE | 生成失败，失败原因在 `data.data.fail_reason` | 是 |

**轮询建议：** 每隔 10-15 秒查询一次状态，veo3.1-fast 通常 30-60 秒完成，veo3.1-pro 可能需要 2-5 分钟。

### 1.7 完整调用示例（Python）

```python
import requests
import time

BASE_URL = "http://206.119.182.61/v1"
API_KEY = "sk-qZ9riqHVLChWVgVJXEkgYht3kVvVnnXS9xx9hVjzlcG7nKe9"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def generate_video(prompt, model="veo3.1-fast", images=None, aspect_ratio=None, enhance_prompt=False, poll_interval=15, max_wait=600):
    """
    提交视频生成任务并等待完成。

    Args:
        prompt: 视频描述（英文效果更好）
        model: 模型名称，默认 veo3.1-fast
        images: 参考图片 URL 列表。1张=首帧，2张=首尾帧（需模型支持），3张=元素参考（需 components 模型）
        aspect_ratio: 视频比例 "16:9" 或 "9:16"
        enhance_prompt: 是否自动优化/翻译提示词
        poll_interval: 轮询间隔（秒），默认 15 秒
        max_wait: 最大等待时间（秒），默认 600 秒（10 分钟）

    Returns:
        成功时返回视频 URL，失败时返回 None
    """
    body = {"model": model, "prompt": prompt}
    if images:
        body["images"] = images
    if aspect_ratio:
        body["aspect_ratio"] = aspect_ratio
    if enhance_prompt:
        body["enhance_prompt"] = True

    submit_resp = requests.post(
        f"{BASE_URL}/video/generations",
        headers=headers,
        json=body
    )
    submit_data = submit_resp.json()

    if "task_id" not in submit_data:
        print(f"提交失败: {submit_data}")
        return None

    task_id = submit_data["task_id"]
    print(f"任务已提交，task_id: {task_id}")

    start_time = time.time()
    while time.time() - start_time < max_wait:
        time.sleep(poll_interval)

        poll_resp = requests.get(
            f"{BASE_URL}/video/generations/{task_id}",
            headers=headers
        )
        poll_data = poll_resp.json()
        data = poll_data.get("data", {})
        status = data.get("status", "UNKNOWN")
        progress = data.get("progress", "")
        print(f"状态: {status}, 进度: {progress}")

        if status == "SUCCESS":
            video_url = data.get("data", {}).get("data", {}).get("output", "")
            print(f"视频生成成功: {video_url}")
            return video_url

        elif status == "FAILURE":
            fail_reason = data.get("data", {}).get("fail_reason", "未知原因")
            print(f"视频生成失败: {fail_reason}")
            return None

    print("超时，视频未在指定时间内完成")
    return None

# 文生视频
video_url = generate_video("A golden retriever running on a beach at sunset")

# 图生视频（首帧）
video_url = generate_video(
    "The character starts walking forward",
    model="veo3.1",
    images=["https://example.com/first_frame.jpg"]
)

# 图生视频（首尾帧）
video_url = generate_video(
    "Smooth transition from sitting to standing",
    model="veo3.1",
    images=["https://example.com/sitting.jpg", "https://example.com/standing.jpg"]
)

# 多图参考
video_url = generate_video(
    "A person wearing the outfit in front of the building",
    model="veo3.1-components",
    images=["https://example.com/person.jpg", "https://example.com/outfit.jpg", "https://example.com/building.jpg"]
)

# 带中文提示词 + 自动翻译
video_url = generate_video(
    "一只金毛犬在日落的海滩上奔跑",
    model="veo3.1-fast",
    enhance_prompt=True
)
```

### 1.8 完整调用示例（cURL）

```bash
#!/bin/bash
API_KEY="sk-qZ9riqHVLChWVgVJXEkgYht3kVvVnnXS9xx9hVjzlcG7nKe9"
BASE_URL="http://206.119.182.61/v1"

# 文生视频
echo "提交视频生成任务..."
TASK_ID=$(curl -s "${BASE_URL}/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"veo3.1-fast","prompt":"A cat playing piano in a jazz bar"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")

echo "Task ID: ${TASK_ID}"

# 轮询任务状态
while true; do
    sleep 15
    RESULT=$(curl -s "${BASE_URL}/video/generations/${TASK_ID}" \
      -H "Authorization: Bearer ${API_KEY}")

    STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
    PROGRESS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('progress',''))")
    echo "状态: ${STATUS}, 进度: ${PROGRESS}"

    if [ "$STATUS" = "SUCCESS" ]; then
        VIDEO_URL=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['data']['data']['output'])")
        echo "视频 URL: ${VIDEO_URL}"
        break
    elif [ "$STATUS" = "FAILURE" ]; then
        echo "生成失败"
        break
    fi
done
```

#### cURL 图生视频示例（首尾帧）

```bash
curl -s "${BASE_URL}/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo3.1",
    "prompt": "Smooth transition from the first pose to the second pose",
    "images": [
      "https://example.com/first_frame.jpg",
      "https://example.com/last_frame.jpg"
    ],
    "aspect_ratio": "16:9"
  }'
```

---

## 二、图片生成

图片生成通过 OpenAI 兼容的 **Chat Completions** 接口调用。在用户消息中描述想要生成的图片即可，模型会返回包含图片 URL 的响应。

### 2.1 请求

```
POST {Base URL}/chat/completions
Content-Type: application/json
Authorization: Bearer <api-key>
```

**请求体（JSON）：**

```json
{
  "model": "nano-banana",
  "messages": [
    {
      "role": "user",
      "content": "Generate an image of a cute cat wearing a tiny hat"
    }
  ],
  "max_tokens": 4096
}
```

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| model | string | 是 | 图片生成模型名称，见下方模型列表 |
| messages | array | 是 | 消息数组，格式同 OpenAI Chat Completions |
| messages[].role | string | 是 | 角色，固定为 "user" |
| messages[].content | string | 是 | 图片描述，建议用英文，描述越详细效果越好 |
| max_tokens | integer | 否 | 建议设为 4096，确保图片 URL 能完整返回 |

**可用图片模型：**

| 模型名 | 说明 | 单次价格 | 建议场景 |
|--------|------|----------|----------|
| nano-banana | 快速生图 | $0.18 | 快速预览、简单图片 |
| nano-banana-hd | 高清生图 | $0.22 | 需要更清晰的效果 |
| nano-banana-pro | 专业生图 | $0.3 | 高质量需求 |
| gemini-2.5-flash-image-preview | Gemini 2.5 Flash 生图 | $0.14 | 最便宜，适合批量 |
| gemini-2.5-flash-image | Gemini 2.5 Flash 生图（正式版） | $0.14 | 最便宜，适合批量 |
| gemini-3-pro-image-preview | Gemini 3 Pro 生图 | $0.3 | 最高质量 |

**成功响应（HTTP 200）：**

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here is the image you requested:\n\n![image1](https://example.com/generated-image.png)"
      },
      "finish_reason": "stop"
    }
  ],
  "model": "nano-banana",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 100,
    "total_tokens": 115
  }
}
```

**图片 URL 提取方式：** 图片 URL 嵌入在 `choices[0].message.content` 中，格式为 Markdown 图片语法 `![image1](url)`。可通过正则表达式 `!\[.*?\]\((.*?)\)` 提取 URL。

### 2.2 完整调用示例（Python）

```python
import requests
import re

BASE_URL = "http://206.119.182.61/v1"
API_KEY = "sk-qZ9riqHVLChWVgVJXEkgYht3kVvVnnXS9xx9hVjzlcG7nKe9"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def generate_image(prompt, model="nano-banana"):
    response = requests.post(
        f"{BASE_URL}/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4096
        }
    )

    result = response.json()

    if "error" in result:
        print(f"生成失败: {result['error']}")
        return None

    content = result["choices"][0]["message"]["content"]

    urls = re.findall(r'!\[.*?\]\((.*?)\)', content)
    if urls:
        return urls[0]

    url_pattern = r'(https?://[^\s\)]+\.(png|jpg|jpeg|webp))'
    urls = re.findall(url_pattern, content)
    if urls:
        return urls[0][0]

    print(f"未找到图片 URL，原始内容: {content[:200]}")
    return None

image_url = generate_image("A sunset over snow-capped mountains, oil painting style")
if image_url:
    print(f"图片 URL: {image_url}")
```

---

## 三、文本对话

文本对话使用标准 OpenAI Chat Completions 接口。

```
POST {Base URL}/chat/completions
Content-Type: application/json
Authorization: Bearer <api-key>
```

**请求体：**

```json
{
  "model": "gemini-2.5-flash",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "你好，请介绍一下你自己"}
  ],
  "max_tokens": 100,
  "temperature": 0.7
}
```

**可用文本模型：**

| 模型名 | 说明 |
|--------|------|
| gemini-2.5-flash | Gemini 2.5 Flash，快速文本对话 |

响应格式与 OpenAI Chat Completions 完全一致。

---

## 四、列出可用模型

```
GET {Base URL}/models
Authorization: Bearer <api-key>
```

返回当前 API Key 可访问的所有模型列表，格式同 OpenAI Models API。

---

## 五、错误处理

### 5.1 常见错误码

| HTTP 状态码 | 错误信息 | 原因 | 解决方案 |
|-------------|----------|------|----------|
| 401 | Invalid authentication | API Key 无效 | 检查 Authorization Header |
| 403 | No available channel | 无可用渠道 | 检查模型名是否正确 |
| 429 | Rate limit exceeded | 请求频率过高 | 降低请求频率 |
| 500 | Internal server error | 服务器内部错误 | 稍后重试 |

### 5.2 视频生成特殊错误

| 场景 | 原因 | 解决方案 |
|------|------|----------|
| 提交后 task_id 为空 | 上游中转站不可用 | 稍后重试或换模型 |
| 状态一直 QUEUED | 上游排队中 | 耐心等待，veo3.1-pro 可能排队较久 |
| 状态 FAILURE | 内容违规或上游错误 | 修改 prompt 或重试 |
| 图生视频 images 数量超限 | 不同模型对图片数量限制不同 | veo3.1 系列最多 2 张，components 最多 3 张，veo3-pro-frames 最多 1 张 |

---

## 六、价格与上游采购价参考

### 对外定价

| 模型 | 类型 | 单次价格 | 说明 |
|------|------|----------|------|
| veo2 | 视频 | $0.3 | Veo2 基础版 |
| veo2-fast | 视频 | $0.3 | Veo2 快速版 |
| veo2-pro | 视频 | $0.6 | Veo2 高质量版 |
| veo2-fast-frames | 视频 | $0.3 | Veo2 首尾帧 |
| veo2-fast-components | 视频 | $0.3 | Veo2 多图参考 |
| veo3 | 视频 | $0.4 | Veo3 基础版，支持音频 |
| veo3-fast | 视频 | $0.3 | Veo3 快速版 |
| veo3-pro | 视频 | $1.5 | Veo3 高质量版 |
| veo3-pro-frames | 视频 | $1.5 | Veo3 图生视频 |
| veo3-fast-frames | 视频 | $0.3 | Veo3 快速图生视频 |
| veo3.1-fast | 视频 | $0.3 | 快速生成，性价比最高 |
| veo3.1 | 视频 | $0.4 | 标准质量，支持首尾帧 |
| veo3.1-pro | 视频 | $1.5 | 高质量，支持首尾帧 |
| veo3.1-pro-4k | 视频 | $15 | 4K 最高质量 |
| veo3.1-components | 视频 | $0.4 | 多图参考模式（1-3张） |
| veo3.1-fast-components | 视频 | $0.3 | 快速多图参考 |
| veo3.1-lite | 视频 | $0.6 | 轻量版 |
| veo3.1-lite-4k | 视频 | $0.65 | 轻量版 4K |
| veo3.1-fast-4k | 视频 | $1.5 | 快速 4K |
| veo3.1-4k | 视频 | $1.5 | 标准 4K |
| veo3.1-components-4k | 视频 | $1.5 | 多图参考 4K |
| veo3.1-fast-components-4k | 视频 | $1.5 | 快速多图参考 4K |
| nano-banana | 图片 | $0.18 | 快速生图 |
| nano-banana-hd | 图片 | $0.22 | 高清生图 |
| nano-banana-pro | 图片 | $0.3 | 专业生图 |
| gemini-2.5-flash-image-preview | 图片 | $0.14 | 最便宜 |
| gemini-2.5-flash-image | 图片 | $0.14 | 最便宜 |
| gemini-3-pro-image-preview | 图片 | $0.3 | 最高质量 |
| gemini-2.5-flash | 文本 | 按 token 计费 | 快速对话 |

### 上游采购价（内部参考）

| 模型 | 上游价格 | 上游来源 |
|------|----------|----------|
| veo2 | ≈$0.2 | apexerapi.top |
| veo2-fast | ≈$0.2 | apexerapi.top |
| veo2-pro | ≈$0.5 | apexerapi.top |
| veo3 | ≈$0.3 | apexerapi.top |
| veo3-fast | ≈$0.2 | apexerapi.top |
| veo3-pro | ≈$1 | apexerapi.top |
| veo3.1 | ≈$0.3 | apexerapi.top |
| veo3.1-pro | ≈$1 | apexerapi.top |
| veo3.1-fast | $0.2 | bltcy.ai |
| veo3.1 | $0.3 | bltcy.ai |
| veo3.1-pro | $1 | bltcy.ai |
| veo3.1-pro-4k | $13 | bltcy.ai |
| veo3.1-components | $0.3 | bltcy.ai |
| veo3.1-fast-components | $0.2 | bltcy.ai |
| veo3.1-lite | $0.5 | xgapi.top |
| veo3.1-fast-4k | $1.5 | bltcy.ai |
| veo3.1-4k | $1.5 | bltcy.ai |
| veo3.1-components-4k | $1.5 | bltcy.ai |
| veo3-pro-frames | ≈$1 | bltcy.ai |
| veo3-fast-frames | ≈$0.2 | bltcy.ai |
| veo2-fast-frames | ≈$0.2 | bltcy.ai |
| nano-banana | $0.08 | bltcy.ai |
| nano-banana-hd | $0.12 | bltcy.ai |
| nano-banana-pro | $0.2 | bltcy.ai |
| gemini-2.5-flash-image | $0.04 | bltcy.ai |
| gemini-3-pro-image-preview | $0.2 | bltcy.ai |

### 已对接平台

| 平台 | Base URL 关键词 | 优先级 | 支持模型 | 特点 |
|------|----------------|--------|----------|------|
| bltcy.ai / ablai.top | 默认（无匹配时） | 100（最高） | veo2/veo3/veo3.1 全系列, sora-2, 生图模型 | 统一格式接口，支持首尾帧、多图参考 |
| apexerapi.top | apexer | 50（第二） | veo3.1_fast, veo3.1_pro, veo3.1_relaxed | new-api 实例，标准 OpenAI 格式 |
| xgapi.top | xgapi | 10（兜底） | veo3.1-lite, sora-2 | veo3.1-lite 价格便宜 |

### 渠道优先级与自动故障转移

系统内置了渠道优先级和自动故障转移机制，上游调用方无需感知下游中转站的差异或故障：

**优先级规则：**
1. 请求首先路由到优先级最高的可用渠道（如 bltcy, priority=100）
2. 如果该渠道请求失败（5xx、429 等可重试错误），自动降级到下一优先级渠道（如 apexerapi, priority=50）
3. 如果所有渠道都失败，返回错误

**自动故障转移配置：**

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| RetryTimes | 2 | 失败后最多重试 2 次（覆盖 3 个优先级层级） |
| AutomaticDisableChannelEnabled | true | 渠道持续失败时自动禁用 |
| AutomaticEnableChannelEnabled | true | 被禁用的渠道恢复后自动启用 |

**故障转移覆盖模型：**

以下模型在多个渠道注册，支持自动故障转移：

| 模型 | 主渠道（优先级 100） | 备用渠道（优先级 50） |
|------|---------------------|---------------------|
| veo3.1 | bltcy-veo | apexerapi-veo |
| veo3.1-pro | bltcy-veo | apexerapi-veo |
| veo3.1-fast | bltcy-veo | apexerapi-veo |

以下模型仅在一个渠道注册，无故障转移：

| 模型 | 唯一渠道 |
|------|----------|
| veo3.1-components | bltcy-veo |
| veo3.1-lite | bltcy-veo |
| veo3.1-pro-4k | bltcy-veo |

> **扩展提示**：要增加故障转移覆盖的模型，需要在多个渠道的模型列表中注册同一模型，并配置正确的 model_mapping（模型名映射）。

**模型名映射（model_mapping）：**

不同中转站使用不同的模型命名约定。系统通过渠道的 `model_mapping` 字段自动转换：

| 我们的模型名 | apexerapi 模型名 |
|-------------|-----------------|
| veo3.1 | veo3.1_relaxed |
| veo3.1-fast | veo3.1_fast |
| veo3.1-pro | veo3.1_pro |

bltcy 使用与系统相同的命名，无需映射。

### 定价策略

- 视频生成：在采购价基础上加 $0.1/次
- 超过 $1 的模型：按采购价 ×1.5 定价
- $13 以上的模型：按 $15 定价
- 图片生成：在采购价基础上加 $0.1/次

---

## 七、视频生成架构分析

### 7.1 整体架构

视频生成采用 **Provider 模式**，将不同中转站的差异封装在 Provider 接口背后，对上游调用方完全透明：

```
上游调用方
    │
    ▼
┌──────────────────────────────────────────────────┐
│  统一 API 入口 (POST /v1/video/generations)      │
│  统一查询入口 (GET  /v1/video/generations/{id})   │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  TaskAdaptor (relay/channel/task/openaivideo/)   │
│  ┌─────────────────────────────────────────────┐ │
│  │  provider 接口                               │ │
│  │  ├─ submitURL()        提交任务 URL          │ │
│  │  ├─ queryURL()         查询任务 URL          │ │
│  │  ├─ parseSubmitResponse()  解析提交响应      │ │
│  │  ├─ parseQueryResponse()   解析查询响应      │ │
│  │  ├─ buildSubmitResponseBody() 构建统一响应   │ │
│  │  ├─ needsMultipart()  是否需要 multipart     │ │
│  │  └─ mapModelForImages() 模型名自动映射       │ │
│  └─────────────────────────────────────────────┘ │
│  ┌──────┐ ┌──────────┐ ┌──────┐ ┌────────┐     │
│  │bltcy │ │apexerapi │ │xgapi │ │newapi  │     │
│  └──────┘ └──────────┘ └──────┘ └────────┘     │
└──────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  渠道选择 + 优先级 + 自动重试 + 自动禁用/恢复    │
│  (service/channel_select.go + controller/relay.go)│
└──────────────────────────────────────────────────┘
```

### 7.2 Provider 路由机制

Provider 通过 `getProviderByBaseURL(baseURL)` 自动选择，匹配规则：

| Base URL 包含关键词 | 选择的 Provider | 说明 |
|---------------------|----------------|------|
| `xgapi` | xgapiProvider | 星光站 |
| `apexer` | apexerapiProvider | Apex 站 |
| `newapi` | newapiProvider | 通用 new-api 实例 |
| 其他（默认） | bltcyProvider | 柏拉图站 |

**设计原则**：Provider 在 `TaskAdaptor.Init()` 阶段一次性确定，后续提交、查询、解析全部使用同一个 Provider，避免自动检测带来的路由错误。

### 7.3 各平台能力对比

| 能力 | bltcy.ai | apexerapi.top | xgapi.top | 通用 new-api |
|------|----------|---------------|-----------|-------------|
| 提交端点 | `/v2/videos/generations` | `/v1/video/generations` | `/v1/videos` | `/v1/video/generations` |
| 查询端点 | `/v2/videos/generations/{id}` | `/v1/videos/{id}` | `/v1/videos/{id}` | `/v1/video/generations/{id}` |
| 需要 Multipart | ❌ | ❌ | ✅ | ✅ |
| 模型名映射 | frames 自动映射 | 横线→下划线 | 原样 | 原样 |
| 提交响应格式 | `{task_id}` | `{id}` | `{id, object, ...}` | `{id, task_id, ...}` |
| 查询响应格式 | `{data: {output}}` | `{video_url}` | `{video_url}` | `{status, progress}` |
| 文生视频 | ✅ | ✅ | ✅ | ✅ |
| 首帧图生视频 | ✅ | ✅ | ✅ | ✅ |
| 首尾帧图生视频 | ✅ | ⚠️ 需验证 | ❓ | ⚠️ 需验证 |
| 多图 Components | ✅ | ❓ | ❓ | ❓ |
| sora-2 | ✅ | ❓ | ✅ | ❓ |

> ✅ 已验证支持 | ❓ 未验证 | ⚠️ 需验证 | ❌ 不支持

### 7.4 上游屏蔽感知机制

系统在多个层面屏蔽了下游中转站的差异，上游调用方只需使用统一的 API：

**1. 统一 API 格式**
- 上游只看到 OpenAI Video 格式：`POST /v1/video/generations` + `GET /v1/video/generations/{id}`
- 不同中转站的端点差异（`/v2/` vs `/v1/`、`/videos` vs `/video/generations`）完全透明

**2. 统一模型名**
- 上游使用标准模型名（如 `veo3.1-fast`），系统自动映射到各中转站的实际模型名
- 映射分两层：
  - **Provider 层**：`mapModelForImages()` 处理 images 相关映射（如 bltcy 的 frames 映射、apexerapi 的下划线转换）
  - **Channel 层**：`model_mapping` 处理平台间命名差异（如 `veo3.1` → `veo3.1_relaxed`）

**3. 统一响应格式**
- 提交响应统一返回 `{id, task_id}` 格式
- 查询响应统一转换为 `TaskInfo` 结构（status, url, progress, reason）
- 上游无需关心下游是 `{data: {output}}` 还是 `{video_url}` 格式

**4. 统一状态码**
- 各平台的状态字符串（`SUCCESS`/`completed`/`succeed`/`NOT_START`/`queued` 等）统一映射为 4 种内部状态：QUEUED / IN_PROGRESS / SUCCESS / FAILURE

### 7.5 自动重试机制

系统在两个阶段提供自动重试：

**阶段一：任务提交时（同步重试）**

```
请求 → 选择最高优先级渠道 → 提交失败？
  → shouldRetryTaskRelay() 判断是否可重试
  → 选择下一优先级渠道 → 再次提交
  → 最多重试 RetryTimes 次
```

可重试的条件：
- 5xx 服务器错误（超时除外）
- 429 限流
- 307 重定向
- 其他非 2xx/400/408 错误

不可重试的条件：
- 400 Bad Request（请求本身有问题）
- 408 Request Timeout（超时不重试）
- 2xx 成功
- LocalError（本地校验错误）

**阶段二：任务轮询时（异步容错）**

```
定时轮询 → FetchTask() 获取上游状态
  → 首先尝试 dto.TaskResponse[model.Task] 格式解析（new-api 标准格式）
  → 失败则使用 Provider.parseQueryResponse() 解析（平台特定格式）
  → 更新任务状态
```

**阶段三：渠道自动禁用/恢复**

```
渠道连续失败 → processChannelError() → ShouldDisableChannel()
  → 自动禁用该渠道（AutoBan=true 时）
  → 后续请求自动跳过该渠道

定时检查 → AutomaticEnableChannelEnabled=true
  → 被禁用渠道恢复后自动重新启用
```

### 7.6 接入新平台指南

要接入一个新的中转站，需要以下步骤：

**步骤 1：创建 Provider 文件**

在 `relay/channel/task/openaivideo/` 目录下创建新文件，如 `newstation.go`：

```go
package openaivideo

type newstationProvider struct{}

func (p *newstationProvider) submitURL(baseURL string) string {
    return baseURL + "/v1/video/generations"
}

func (p *newstationProvider) queryURL(baseURL, taskID string) string {
    return baseURL + "/v1/videos/" + taskID
}

func (p *newstationProvider) parseSubmitResponse(body []byte) (string, error) {
    // 解析提交响应，返回上游 task ID
}

func (p *newstationProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
    // 解析查询响应，返回 TaskInfo
}

func (p *newstationProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
    return map[string]any{
        "id":      info.PublicTaskID,
        "task_id": info.PublicTaskID,
    }
}

func (p *newstationProvider) needsMultipart() bool { return false }

func (p *newstationProvider) mapModelForImages(model string, hasImages bool) string {
    return model // 或添加平台特定的模型名映射逻辑
}
```

**步骤 2：注册 Provider**

在 `provider.go` 的 `getProviderByBaseURL()` 和 `getProvider()` 中添加关键词匹配：

```go
case containsAny(baseURL, "newstation"):
    return &newstationProvider{}
```

**步骤 3：配置渠道**

在管理后台或数据库中添加渠道：
- `type` = 58 (ChannelTypeOpenAIVideo)
- `base_url` = 新平台的 API 地址
- `priority` = 优先级数值
- `models` = 支持的模型列表
- `model_mapping` = 模型名映射（如需要）
- `auto_ban` = 1（启用自动禁用）

**步骤 4：验证**

1. 提交测试请求，确认任务提交成功
2. 查询任务状态，确认轮询正常
3. 模拟主渠道故障，确认自动故障转移
4. 确认模型名映射正确

### 7.7 当前架构的局限与改进方向

**已解决的问题：**

| 问题 | 状态 | 解决方案 |
|------|------|----------|
| parseQueryResponseAuto 字段碰撞导致路由错误 | ✅ 已修复 | 改用 Init 时确定的 Provider 直接解析 |
| getProvider 缺少 apexerapi 匹配 | ✅ 已修复 | 添加 apexer 关键词匹配 |
| getProviderByBaseURL 缺少 newapi 匹配 | ✅ 已修复 | 添加 newapi 关键词匹配 |

**当前局限：**

| 局限 | 影响 | 改进方向 |
|------|------|----------|
| Provider 路由依赖 baseURL 关键词匹配 | 如果两个平台 baseURL 相似可能误匹配 | 改为渠道配置字段指定 Provider 名 |
| 模型名映射分散在 Provider 和 Channel 两层 | 维护成本高，需要同时修改两处 | 统一由 Channel 的 model_mapping 处理 |
| 首尾帧/Components 等高级功能未在所有平台验证 | 部分平台可能不支持但未明确拒绝 | 添加平台能力声明，请求前校验 |
| 轮询阶段无重试 | 如果查询请求失败，只能等下一轮 | 添加查询失败重试机制 |
| 无主动健康检查 | 只有请求失败时才发现渠道不可用 | 添加定时健康检查探针 |

**扩展性评估：**

- ✅ 接入新平台：只需创建 Provider 文件 + 注册关键词 + 配置渠道，无需修改核心逻辑
- ✅ 新增模型：在 `constants.go` 的 ModelList 添加 + 在 `model_ratio.go` 添加定价 + 在渠道中注册
- ✅ 新增能力（如音频生成）：参考视频生成的 Provider 模式，创建新的 ChannelType 和 Adaptor
- ⚠️ 跨平台能力差异：当前没有平台能力声明机制，无法在请求前判断某平台是否支持特定功能
