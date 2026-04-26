/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

const docsBaseUrl = 'https://moapi.moshanjun.com';
const hiddenDocIds = new Set(['doc-2694962', 'doc-2664690', 'doc-6479345']);

const modelsListMarkdown = [
  '# 列出模型',
  '',
  '使用以下接口获取当前密钥可调用的模型列表：',
  '',
  '```text',
  'GET https://moapi.moshanjun.com/v1/models',
  '```',
  '',
  '该接口会返回当前 API Key 可调用的模型列表。返回结果会根据后台启用模型、用户分组、令牌模型限制以及价格/倍率配置动态变化。',
  '',
  '## 请求',
  '',
  '| 项 | 值 |',
  '| --- | --- |',
  '| 方法 | `GET` |',
  '| URL | `https://moapi.moshanjun.com/v1/models` |',
  '| 鉴权 | `Authorization: Bearer YOUR_API_KEY` |',
  '| 请求体 | 无 |',
  '',
  '## curl 示例',
  '',
  '```bash',
  'curl https://moapi.moshanjun.com/v1/models \\',
  '  -H "Authorization: Bearer YOUR_API_KEY"',
  '```',
  '',
  '## 成功响应',
  '',
  '```json',
  '{',
  '  "success": true,',
  '  "object": "list",',
  '  "data": [',
  '    {',
  '      "id": "gpt-4o",',
  '      "object": "model",',
  '      "created": 1626777600,',
  '      "owned_by": "openai",',
  '      "supported_endpoint_types": ["openai"]',
  '    },',
  '    {',
  '      "id": "text-embedding-3-small",',
  '      "object": "model",',
  '      "created": 1626777600,',
  '      "owned_by": "openai",',
  '      "supported_endpoint_types": ["embeddings"]',
  '    }',
  '  ]',
  '}',
  '```',
  '',
  '## 返回字段',
  '',
  '| 字段 | 类型 | 说明 |',
  '| --- | --- | --- |',
  '| `success` | boolean | 请求是否成功。 |',
  '| `object` | string | 固定为 `list`。 |',
  '| `data` | array | 当前密钥可用的模型数组。 |',
  '| `data[].id` | string | 调用其他接口时填写的模型 ID。 |',
  '| `data[].object` | string | 固定为 `model`。 |',
  '| `data[].created` | integer | 模型记录时间戳。 |',
  '| `data[].owned_by` | string | 模型来源或渠道名称。 |',
  '| `data[].supported_endpoint_types` | string[] | 该模型支持的接口类型，例如 `openai`、`openai-response`、`anthropic`、`gemini`、`embeddings`、`image-generation`。 |',
  '',
  '## 获取单个模型',
  '',
  '也可以按模型 ID 查询单个模型：',
  '',
  '```text',
  'GET https://moapi.moshanjun.com/v1/models/{model}',
  '```',
  '',
  '示例：',
  '',
  '```bash',
  'curl https://moapi.moshanjun.com/v1/models/gpt-4o \\',
  '  -H "Authorization: Bearer YOUR_API_KEY"',
  '```',
  '',
  '如果模型不存在，会返回 OpenAI 兼容错误对象，错误码为 `model_not_found`。',
  '',
  '## OpenAPI Specification',
  '',
  '```yaml',
  'openapi: 3.0.1',
  'info:',
  "  title: 'MO API Models'",
  "  description: 'MO API 模型列表接口'",
  '  version: 1.0.0',
  'servers:',
  '  - url: https://moapi.moshanjun.com',
  '    description: 正式环境',
  'paths:',
  '  /v1/models:',
  '    get:',
  '      summary: 列出模型',
  '      description: 返回当前 API Key 可调用的模型列表。',
  '      tags:',
  '        - 模型接口/模型（Models）',
  '      parameters:',
  '        - name: Authorization',
  '          in: header',
  "          description: 'Bearer YOUR_API_KEY'",
  '          required: true',
  '          schema:',
  '            type: string',
  '      responses:',
  "        '200':",
  '          description: 成功',
  '          content:',
  '            application/json:',
  '              schema:',
  '                type: object',
  '                properties:',
  '                  success:',
  '                    type: boolean',
  '                  object:',
  '                    type: string',
  '                    example: list',
  '                  data:',
  '                    type: array',
  '                    items:',
  '                      type: object',
  '                      properties:',
  '                        id:',
  '                          type: string',
  '                        object:',
  '                          type: string',
  '                          example: model',
  '                        created:',
  '                          type: integer',
  '                        owned_by:',
  '                          type: string',
  '                        supported_endpoint_types:',
  '                          type: array',
  '                          items:',
  '                            type: string',
  '  /v1/models/{model}:',
  '    get:',
  '      summary: 获取单个模型',
  '      description: 按模型 ID 返回模型信息。',
  '      tags:',
  '        - 模型接口/模型（Models）',
  '      parameters:',
  '        - name: model',
  '          in: path',
  '          required: true',
  '          schema:',
  '            type: string',
  '        - name: Authorization',
  '          in: header',
  "          description: 'Bearer YOUR_API_KEY'",
  '          required: true',
  '          schema:',
  '            type: string',
  '      responses:',
  "        '200':",
  '          description: 成功或 OpenAI 兼容错误对象',
  '```',
].join('\n');

const endpoint = (path) => `${docsBaseUrl}${path}`;

const requestGuideMarkdown = `# 发出请求

MO API 提供 OpenAI 兼容的 API Key 鉴权方式。所有接口统一使用以下基础地址：

\`\`\`text
${docsBaseUrl}
\`\`\`

## 鉴权方式

所有模型转发接口都需要在请求头里携带 API Key：

\`\`\`http
Authorization: Bearer YOUR_API_KEY
\`\`\`

如果软件只支持填写 Base URL，一般填写：

\`\`\`text
${docsBaseUrl}/v1
\`\`\`

如果软件要求填写完整接口地址，就填写对应接口完整路径，例如聊天接口：

\`\`\`text
${endpoint('/v1/chat/completions')}
\`\`\`

## 常用接口地址

| 类型 | 方法 | 接口地址 |
| --- | --- | --- |
| 模型列表 | GET | \`${endpoint('/v1/models')}\` |
| 聊天接口 | POST | \`${endpoint('/v1/chat/completions')}\` |
| Responses 接口 | POST | \`${endpoint('/v1/responses')}\` |
| 文本补全 | POST | \`${endpoint('/v1/completions')}\` |
| 图像生成 | POST | \`${endpoint('/v1/images/generations')}\` |
| 图像编辑 | POST | \`${endpoint('/v1/images/edits')}\` |
| 向量生成 | POST | \`${endpoint('/v1/embeddings')}\` |
| 文本转语音 | POST | \`${endpoint('/v1/audio/speech')}\` |
| 音频转文字 | POST | \`${endpoint('/v1/audio/transcriptions')}\` |
| 音频翻译 | POST | \`${endpoint('/v1/audio/translations')}\` |

## 错误格式

MO API 转发接口尽量保持 OpenAI 兼容错误结构：

\`\`\`json
{
  "error": {
    "message": "错误说明",
    "type": "invalid_request_error",
    "param": "",
    "code": "错误码"
  }
}
\`\`\`

## 注意事项

- 不要把 API Key 写进前端公开代码或浏览器页面里。
- 模型是否可用会受到后台渠道、用户分组、令牌模型限制和余额状态影响。
- 支持流式输出的接口可传 \`"stream": true\`，客户端需要按 SSE 流处理返回内容。`;

const chatCompletionsMarkdown = `# 聊天接口

聊天补全接口兼容 OpenAI Chat Completions 格式。

\`\`\`text
POST ${endpoint('/v1/chat/completions')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/chat/completions')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`application/json\` |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`model\` | string | 是 | 要调用的模型 ID，可先通过 \`/v1/models\` 查询。 |
| \`messages\` | array | 是 | OpenAI 兼容消息数组，支持 \`system\`、\`user\`、\`assistant\`、\`tool\`。 |
| \`stream\` | boolean | 否 | 是否使用 SSE 流式输出。 |
| \`temperature\` | number | 否 | 采样温度。 |
| \`max_tokens\` | integer | 否 | 最大输出 token 数。 |
| \`tools\` | array | 否 | 工具调用定义。 |
| \`tool_choice\` | string/object | 否 | 工具调用选择方式。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/chat/completions')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "system", "content": "你是一个简洁的助手。" },
      { "role": "user", "content": "你好，介绍一下 MO API。" }
    ],
    "stream": false
  }'
\`\`\`

## 成功响应

\`\`\`json
{
  "id": "chatcmpl_xxx",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好，这里是 MO API。"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 12,
    "total_tokens": 32
  }
}
\`\`\`

## OpenAPI Specification

\`\`\`yaml
openapi: 3.0.1
servers:
  - url: ${docsBaseUrl}
paths:
  /v1/chat/completions:
    post:
      summary: 聊天接口
      description: OpenAI 兼容聊天补全接口。
      tags:
        - 模型接口/聊天接口（Chat）
      parameters:
        - name: Authorization
          in: header
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [model, messages]
              properties:
                model:
                  type: string
                messages:
                  type: array
                  items:
                    type: object
                stream:
                  type: boolean
                temperature:
                  type: number
                max_tokens:
                  type: integer
      responses:
        '200':
          description: 成功
\`\`\``;

const responsesMarkdown = `# 响应 responses 接口

Responses 接口适合多模态输入、工具调用、推理模型和更统一的任务输出。

\`\`\`text
POST ${endpoint('/v1/responses')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/responses')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`application/json\` |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`model\` | string | 是 | 模型 ID。 |
| \`input\` | string/array | 是 | 输入内容，可为纯文本或 Responses 消息数组。 |
| \`instructions\` | string | 否 | 系统级指令。 |
| \`stream\` | boolean | 否 | 是否启用 SSE 流式响应。 |
| \`tools\` | array | 否 | 工具定义。 |
| \`reasoning\` | object | 否 | 支持推理模型时可传推理配置。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/responses')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4.1",
    "input": "用一句话介绍 MO API"
  }'
\`\`\`

## 成功响应

\`\`\`json
{
  "id": "resp_xxx",
  "object": "response",
  "created_at": 1710000000,
  "status": "completed",
  "model": "gpt-4.1",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "MO API 是一个统一的大模型接口转发服务。"
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 12,
    "output_tokens": 18,
    "total_tokens": 30
  }
}
\`\`\`

## 相关接口

MO API 同时提供 Responses 压缩接口：

\`\`\`text
POST ${endpoint('/v1/responses/compact')}
\`\`\`

该接口主要供支持 Responses compaction 的模型或客户端使用。`;

const completionsMarkdown = `# 内容补全接口

文本补全接口兼容 OpenAI Legacy Completions 格式。

\`\`\`text
POST ${endpoint('/v1/completions')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/completions')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`application/json\` |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`model\` | string | 是 | 支持 completions 的模型 ID。 |
| \`prompt\` | string/array | 是 | 输入提示词。 |
| \`stream\` | boolean | 否 | 是否使用 SSE 流式输出。 |
| \`max_tokens\` | integer | 否 | 最大输出 token 数。 |
| \`temperature\` | number | 否 | 采样温度。 |
| \`stop\` | string/array | 否 | 停止序列。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/completions')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-3.5-turbo-instruct",
    "prompt": "写一句简短欢迎语：",
    "max_tokens": 64
  }'
\`\`\`

## 成功响应

\`\`\`json
{
  "id": "cmpl_xxx",
  "object": "text_completion",
  "created": 1710000000,
  "model": "gpt-3.5-turbo-instruct",
  "choices": [
    {
      "text": "欢迎使用 MO API。",
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
\`\`\`

## 注意事项

新项目优先使用 \`/v1/chat/completions\` 或 \`/v1/responses\`。该接口主要用于兼容仍然依赖补全文本格式的软件。`;

const imageVariationMarkdown = `# 图像变化

该接口暂未开放。需要图片生成或编辑时，请使用下方替代接口。

\`\`\`text
POST ${endpoint('/v1/images/variations')}
\`\`\`

## 当前状态

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/images/variations')}\` |
| 状态 | 暂未开放 |
| HTTP 状态码 | \`501 Not Implemented\` |

## 返回示例

\`\`\`json
{
  "error": {
    "message": "API not implemented",
    "type": "new_api_error",
    "param": "",
    "code": "api_not_implemented"
  }
}
\`\`\`

## 替代接口

如果需要生成图片，请使用：

\`\`\`text
POST ${endpoint('/v1/images/generations')}
\`\`\`

如果需要基于图片编辑，请使用：

\`\`\`text
POST ${endpoint('/v1/images/edits')}
\`\`\``;

const imageEditsMarkdown = `# 图像编辑

图像编辑接口兼容 OpenAI Images Edits 格式。

\`\`\`text
POST ${endpoint('/v1/images/edits')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/images/edits')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`multipart/form-data\` |

## 表单字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`model\` | string | 是 | 图像编辑模型 ID。 |
| \`image\` | file | 是 | 要编辑的原图。 |
| \`prompt\` | string | 是 | 编辑说明。 |
| \`mask\` | file | 否 | 蒙版图。 |
| \`n\` | integer | 否 | 返回图片数量。 |
| \`size\` | string | 否 | 图片尺寸，例如 \`1024x1024\`。 |
| \`response_format\` | string | 否 | \`url\` 或 \`b64_json\`。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/images/edits')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "model=gpt-image-1" \\
  -F "image=@image.png" \\
  -F "prompt=把背景改成干净的浅色工作室"
\`\`\`

## 成功响应

\`\`\`json
{
  "created": 1710000000,
  "data": [
    {
      "url": "https://..."
    }
  ]
}
\`\`\``;

const imageGenerationsMarkdown = `# 创建图像

图像生成接口兼容 OpenAI Images Generations 格式。

\`\`\`text
POST ${endpoint('/v1/images/generations')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/images/generations')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`application/json\` |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`model\` | string | 是 | 图像生成模型 ID。 |
| \`prompt\` | string | 是 | 图像描述。 |
| \`n\` | integer | 否 | 返回图片数量。 |
| \`size\` | string | 否 | 图片尺寸。 |
| \`quality\` | string | 否 | 图片质量，取决于模型支持情况。 |
| \`response_format\` | string | 否 | \`url\` 或 \`b64_json\`。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/images/generations')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-image-1",
    "prompt": "一张 MO API 控制台风格的科技产品图",
    "size": "1024x1024"
  }'
\`\`\`

## 成功响应

\`\`\`json
{
  "created": 1710000000,
  "data": [
    {
      "url": "https://..."
    }
  ]
}
\`\`\``;

const embeddingsMarkdown = `# 创建嵌入

向量生成接口兼容 OpenAI Embeddings 格式。

\`\`\`text
POST ${endpoint('/v1/embeddings')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/embeddings')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`application/json\` |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`model\` | string | 是 | 向量模型 ID。 |
| \`input\` | string/string[] | 是 | 要向量化的文本。 |
| \`encoding_format\` | string | 否 | 返回格式，例如 \`float\` 或 \`base64\`。 |
| \`dimensions\` | integer | 否 | 部分模型支持自定义向量维度。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/embeddings')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "text-embedding-3-small",
    "input": "MO API 文档"
  }'
\`\`\`

## 成功响应

\`\`\`json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.0123, -0.0045],
      "index": 0
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 6,
    "total_tokens": 6
  }
}
\`\`\``;

const audioSpeechMarkdown = `# tts 文本转语音

文本转语音接口兼容 OpenAI Audio Speech 格式。

\`\`\`text
POST ${endpoint('/v1/audio/speech')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/audio/speech')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`application/json\` |
| 响应 | 音频二进制数据 |

## 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`model\` | string | 是 | TTS 模型 ID。 |
| \`input\` | string | 是 | 要转换成语音的文本。 |
| \`voice\` | string | 是 | 声音 ID。 |
| \`response_format\` | string | 否 | 输出格式，如 \`mp3\`、\`wav\`、\`pcm\`。 |
| \`speed\` | number | 否 | 语速，取决于模型支持情况。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/audio/speech')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -o speech.mp3 \\
  -d '{
    "model": "tts-1",
    "input": "欢迎使用 MO API",
    "voice": "alloy",
    "response_format": "mp3"
  }'
\`\`\``;

const audioTranscriptionsMarkdown = `# 创建转录

音频转文字接口兼容 OpenAI Audio Transcriptions 格式。

\`\`\`text
POST ${endpoint('/v1/audio/transcriptions')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/audio/transcriptions')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`multipart/form-data\` |

## 表单字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`file\` | file | 是 | 要转录的音频文件。 |
| \`model\` | string | 是 | 转录模型 ID，例如 \`whisper-1\`。 |
| \`language\` | string | 否 | 输入音频语言。 |
| \`prompt\` | string | 否 | 额外提示词。 |
| \`response_format\` | string | 否 | \`json\`、\`text\`、\`srt\`、\`verbose_json\` 或 \`vtt\`。 |
| \`temperature\` | number | 否 | 采样温度。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/audio/transcriptions')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "model=whisper-1" \\
  -F "file=@audio.mp3" \\
  -F "response_format=json"
\`\`\`

## 成功响应

\`\`\`json
{
  "text": "这里是转录后的文字。"
}
\`\`\``;

const audioTranslationsMarkdown = `# 创建翻译

音频翻译接口兼容 OpenAI Audio Translations 格式。

\`\`\`text
POST ${endpoint('/v1/audio/translations')}
\`\`\`

## 请求

| 项 | 值 |
| --- | --- |
| 方法 | \`POST\` |
| URL | \`${endpoint('/v1/audio/translations')}\` |
| 鉴权 | \`Authorization: Bearer YOUR_API_KEY\` |
| Content-Type | \`multipart/form-data\` |

## 表单字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| \`file\` | file | 是 | 要翻译的音频文件。 |
| \`model\` | string | 是 | 翻译模型 ID，例如 \`whisper-1\`。 |
| \`prompt\` | string | 否 | 英文提示词。 |
| \`response_format\` | string | 否 | \`json\`、\`text\`、\`srt\`、\`verbose_json\` 或 \`vtt\`。 |
| \`temperature\` | number | 否 | 采样温度。 |

## curl 示例

\`\`\`bash
curl ${endpoint('/v1/audio/translations')} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "model=whisper-1" \\
  -F "file=@audio.mp3" \\
  -F "response_format=json"
\`\`\`

## 成功响应

\`\`\`json
{
  "text": "This is the translated text."
}
\`\`\``;

const usageDetailsMarkdown = `# 查询用量详情（小时粒度）

该接口暂未开放，不能作为正式 API 使用。

\`\`\`text
POST ${endpoint('/v1/query/usage_details')}
\`\`\`

## 当前状态

| 项 | 值 |
| --- | --- |
| URL | \`${endpoint('/v1/query/usage_details')}\` |
| 状态 | 暂未开放 |
| 预期结果 | 不可作为正式 API 使用 |

## 替代方式

- 在控制台查看用量日志和令牌消耗记录。
- 需要程序化查询用量时，请以后续正式开放的查询接口为准。
- 当前模型调用类接口请优先使用 \`/v1/models\`、\`/v1/chat/completions\`、\`/v1/responses\`、\`/v1/embeddings\` 等已注册路由。`;

const stripSoftwareGuideIntroBlocks = (markdown) =>
  markdown.replace(/\n# 费用[\s\S]*?(?=\n# 常见软件\/插件使用方法：)/, '\n\n');

const docsOverrides = {
  'doc-5547696': {
    markdown: stripSoftwareGuideIntroBlocks,
  },
  'doc-2664688': {
    sourceUrl: `${docsBaseUrl}/v1`,
    markdown: requestGuideMarkdown,
  },
  'api-92222074': {
    sourceUrl: endpoint('/v1/models'),
    markdown: modelsListMarkdown,
  },
  'api-92222076': {
    sourceUrl: endpoint('/v1/chat/completions'),
    markdown: chatCompletionsMarkdown,
  },
  'api-385209336': {
    sourceUrl: endpoint('/v1/responses'),
    markdown: responsesMarkdown,
  },
  'api-92222077': {
    sourceUrl: endpoint('/v1/completions'),
    markdown: completionsMarkdown,
  },
  'api-230939726': {
    sourceUrl: endpoint('/v1/images/variations'),
    markdown: imageVariationMarkdown,
  },
  'api-230941694': {
    sourceUrl: endpoint('/v1/images/edits'),
    markdown: imageEditsMarkdown,
  },
  'api-92222078': {
    sourceUrl: endpoint('/v1/images/generations'),
    markdown: imageGenerationsMarkdown,
  },
  'api-92222081': {
    sourceUrl: endpoint('/v1/embeddings'),
    markdown: embeddingsMarkdown,
  },
  'api-123375854': {
    sourceUrl: endpoint('/v1/audio/speech'),
    markdown: audioSpeechMarkdown,
  },
  'api-92222082': {
    sourceUrl: endpoint('/v1/audio/transcriptions'),
    markdown: audioTranscriptionsMarkdown,
  },
  'api-92222083': {
    sourceUrl: endpoint('/v1/audio/translations'),
    markdown: audioTranslationsMarkdown,
  },
  'api-165664739': {
    sourceUrl: endpoint('/v1/query/usage_details'),
    markdown: usageDetailsMarkdown,
  },
};

const docsPayload = {
  docs: [
    {
      id: 'doc-5547696',
      title: '常用软件使用教程',
      group: '帮助中心',
      category: ['帮助中心'],
      method: null,
      path: null,
      sourceUrl: 'https://chatanywhere.apifox.cn/doc-5547696.md',
      markdown:
        '# 常用软件使用教程\n\n:::highlight yellow 📌\n支持Gpt, Claude, Gemini, Grok, Deepseek, qwen, kimi, MiniMax\n\nAPIKey需要搭配第三方软件或者插件使用，如浏览器插件ChatGPTSidebar, ChatBox, Cherry Studio等。  \n\n支持国内使用，无需梯子！  \n\n绝不乱计Token乱扣费  \n\n:::\n\n\n# 费用  \n\n:::highlight yellow 👍\n标准模型价格折算后比OpenAi官方稍低\nCA系列模型折算后相当于OpenAI官方的五六折  \nClaude系列模型价格为官方的六八折左右\nDeepseek,GLM, MiniMax系列模型价格为官方的六折\nQwen, Kimi, 价格为官方的七折 \n:::\n:::highlight yellow 💡\n关于标准模型和结尾带-ca模型区别  \n\n标准模型提供 $99\\%$ 以上可用性保障，CA模型提供 $90\\%$ 以上可用性保障：  \n\n标准模型来源OpenAI官方和Azure OpenAI(微软), 我们自持有账户保证稳定性；  \nCA模型来源第三方优质提供商；  \n\n标准模型响应速度相对更快，CA模型可能相对慢一些；  \n\nOpenAI和Azure返回的结果是否有区别: 没有区别, 返回的结果和模型性能都是一样的. 只不过这两个部署的地方不是同一个地方.\n:::\n模型价格如表格：  \n\n所有模型均无速率限制  \n\n以下为比较常用的模型价格[单位(CA币)：元]，[如需查看所有支持的模型和价格请点击此处获取价格详情。 ](#doc-2694962) \n\n| **模型（Model）**      | **请求（Input）**                   | **回答（Output）** | **是否支持** | **特点**                                                     |\n| ---------------------- | ----------------------------------- | ------------------ | ------------ | ------------------------------------------------------------ |\n| gpt-5.2 | 0.01225 / 1K Tokens | 0.098  / 1K Tokens | 支持 | 面向各行各业的编码和智能体任务的旗舰模型 |\n| gpt-5.1 | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | 用于编码和智能体任务的旗舰模型，它具备可配置的推理和非推理能力 |\n| gpt-5 | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | GPT-5 是用于跨领域编码、推理和代理任务的旗舰模型 |\n| gpt-5-chat-latest |0.00875 / 1K Tokens | 0.07 / 1K Tokens | 支持 | GPT-5 Chat 指的是 ChatGPT 当前使用的 GPT-5 快照|\n| gpt-4o | 0.0175/1K Tokens + 图片费用[2]| 0.07/1K Tokens| 支持 | Openai 价格更低, 速度更快更聪明,指向最新版的4o版本|\n| gpt-5.1-ca | 0.005 / 1K Tokens | 0.04  / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5-ca | 0.005 / 1K Tokens | 0.04  / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| deepseek-v3-2 |  0.0012  / 1K Tokens | 0.0018 / 1K Tokens | 支持 |deepseek的聊天模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-sonnet-4-6 | 0.015 / 1K Tokens | 0.075 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，现在使用的为Claude code的逆向或官方逆向的渠道。|\n| gemini-3.1-pro-preview | 0.008 / 1K Tokens | 0.048 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n:::highlight yellow 💡\n\n# 使用注意事项：  \n\n转发APl无法直接向官方接口api.openai.com发起请求，需要将请求地址改为moapi.moshanjun.com才可以使用，大部分插件和软件都可以修改。一般来说不支持各种网页应用，因为没法改API请求地址。现在已经支持Gpt，Claude，Gemini等和图像生成模型。Token计算示例：https://tiktokenizer.vercel.app  \n\n余额和使用记录查询（通知公告也会发在这里）：https://api.chatanywhere.org\n\n接口Host（接入点）：  \n\n1.moapi.moshanjun.com（国内使用，延时更低）\n2.api.chatanywhere.org（国外使用）  \n:::\n\n# API文档  \n\n:::highlight yellow 💡\nhttps://chatanywhere.apifox.cn/  \n:::\n\n# 常见软件/插件使用方法：  \n\n以下所有插件均为我们实际体验后感觉不错的软件/插件，但不是我们的产品，我们不对以下产品的行为负责  \n\n# Python Open Al Host(AutoGPT) \n方法一：  \n\n```python\nfrom openai import OpenAI\n\nclient = OpenAI(\n    # defaults to os.environ.get("OPENAI_API_KEY")\n    api_key="YOUR API KEY",\n    base_url="https://moapi.moshanjun.com/v1"\n    # base_url="https://api.chatanywhere.org/v1"\n)\n```\n\n方法二：  \n\n修改环境变量，各个系统怎么改环境变量请自行百度，修改环境变量后不起作用请重启系统。  \n\n```js\nOPENAI_API_BASE = https://moapi.moshanjun.com/v1\n```\n\n# 开源 gpt academic  \n\n找到config.py文件中的API_URL_REDIRECT配置并修改为以下内容：\n\n```json\nAPI_URL_REDIRECT = {"https://api.openai.com/v1/chat/completions":"https://moapi.moshanjun.com/v1/chat/completions"}\n```\n\n# Gomoon\n\nGomoon是一款开源的桌面大模型应用，支持mac和Windows平台。额外支持了解析文件、图片，本地知识库等能力。  \n\n官网地址：https://gomoon.top  \n\n使用方法，进入Gomoon设置页面(页面右上角)，如图在设置中填入密钥，并将代理设置为https://moapi.moshanjun.com/v1  \n\n![1.png](https://api.apifox.com/api/v1/projects/2946232/resources/480653/image-preview)\n\n# ChatBox\n\nChatGPT开源桌面应用，支持全部桌面平台。  \n\n下载链接：https://github.com/Bin-Huang/chatbox/releases  \n\n网页版地址: https://web.chatboxai.app  \n新版本的使用方法方法\nAPI主机的地方填写https://moapi.moshanjun.com\n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/530097/image-preview)\n\n\n如在Chatbox中想使用claude或gemini等模型按下图设置  \n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/532218/image-preview)\n如在Chatbox中想使用deepseek-r1 按下图设置\n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/532220/image-preview)\nAPI地址填写: https://moapi.moshanjun.com/v1\nAPI路径填写: /chat/completions\n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/532219/image-preview)\n\n# Cherry Studio (支持Gpt和Gemini的Image,支持知识库)\n\n官网: https://www.cherry-ai.com/\n使用方法如图所示\n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/628402/image-preview)\n\n# Claude code\n### 1) 首先先安装好Claude code,如和安装请参考官方文档\n### 2) 找到配置文件\n- Windows: %USERPROFILE%.claude\\settings.json\n- macOS/Linux: ~/.claude/settings.json\n### 3) 修改该配置文件,并保存即可使用\n```json\n{\n  "env": {\n    "ANTHROPIC_BASE_URL": "https://moapi.moshanjun.com",\n    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxxxxx",\n    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0",\n    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",\n    "CLAUDE_CODE_DISABLE_TERMINAL_TITLE": "1"\n  }\n}\n```\n\n\n# Openclaw\n此教程只是最简单的使用方法,需要有一定的代码能力才可以使用, 具体详细的使用方法请查看官方教程\n### 核心配置（3 步）\n\n#### 1) 找到配置文件\n- Windows：`C:\\Users\\你的用户名\\.openclaw\\openclaw.json`\n- macOS/Linux：`~/.openclaw/openclaw.json`\n\n#### 2) 添加 Provider（关键：`api` 必须是 `openai-completions`）如未有provider需要手动添加\n```json\n{\n  "models": {\n    "mode": "merge",\n    "providers": {\n      "chatanywhere": {\n        "baseUrl": "https://moapi.moshanjun.com/v1",\n        "apiKey": "sk-xxxxx",\n        "api": "openai-completions",\n        "models": [\n          { "id": "gpt-4.1", "name": "gpt-4.1" },\n          { "id": "gpt-5.1", "name": "gpt-5.1" }\n        ]\n      }\n    }\n  }\n}\n```\n\n#### 3) 设置默认模型（格式：`Provider/模型ID`）\n```json\n{\n  "agents": {\n    "defaults": {\n      "model": {\n        "primary": "chatanywhere/gpt-4.1"\n      }\n    }\n  }\n}\n```\n\n> 常见问题 404：`primary` 漏写 `chatanywhere/` 前缀。\n\n# RikkaHub\n一款Android 应用程序\n官网和下载地址 https://github.com/rikkahub/rikkahub\n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/538544/image-preview)\n\n![Xnip2025-06-25_15-27-49.png](https://api.apifox.com/api/v1/projects/2946232/resources/538546/image-preview)\n# BotGem  \n\n官网: https://bytemyth.com/ama  \n\n\n![4.png](https://api.apifox.com/api/v1/projects/2946232/resources/480656/image-preview)\n\n# 沉浸式翻译  \n\n官网链接https://immersivetranslate.com/  \n\n一款免费的，好用的，没有废话的，革命性的，饱受赞誉的，AI驱动的双语网页翻译扩展，帮助你有效地打破信息差，在手机上也可以用  \n自定义API接口处填写下面这个https://moapi.moshanjun.com/v1/chat/completions  \n\n\n![5.png](https://api.apifox.com/api/v1/projects/2946232/resources/480657/image-preview)\n\n# ChatGPT Siderbar  \n\n官网链接：https://chatgpt-sidebar.com/  \n\n安装好插件后进入设置页面，如图所示修改设置，并将url设置为https://moapi.moshanjun.com/v1 即可。  \n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/499012/image-preview)\n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/499013/image-preview)\n# Zotero  \n\n软件地址: https://www.zotero.org/  \n\n以下只是介绍了一下常用的，具体详细的使用方法请查看Zotro官方文档  \n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/483484/image-preview)\ncontext length exceeded  \n\n意味着您当前的模型处理的输入文本长度超过了模型的最大token限制。每个模型都有一个最大token限制，例如，gpt-3.5-turbo模型的最大token限制为 $4096_{\\circ}$  \n\n您可以使用以下命令/model gpt-4o 更换模型  \n\n### Zoter中的翻译  \n\n接口地址填写: https://moapi.moshanjun.com/v1/chat/completions 不用管状态是否显示可用填上之后就可以了  \n![9.png](https://api.apifox.com/api/v1/projects/2946232/resources/480663/image-preview)\n\n# MuseBot 基于 Golang 构建的 智能机器人\n基于 Golang 构建的 智能机器人，集成了 LLM API，实现 AI 驱动的自然对话与智能回复\n官网:https://github.com/yincongcyincong/MuseBot/blob/main/README_ZH.md\n配置\n```\n./MuseBot\n-telegram_bot_token=xxx \n-chat_any_where_token=xxx \n-type=chatanywhere \n-media_type=chatanywhere\n```\n如使用后台管理按照下图配置\n![1405fd09affa77055eb892a9021268b2.png](https://api.apifox.com/api/v1/projects/2946232/resources/584297/image-preview)\n\n# 微×助手聊天机器人  \n\n下载地址和官网未知  \n\n非官方接口处填写下面这个https://moapi.moshanjun.com/v1/chat/completions  \n\n![10.png](https://api.apifox.com/api/v1/projects/2946232/resources/480665/image-preview)\n\n\n\n# Dify  \n\nDify是一个LLM应用开发平台开源。其绘图的界面结合了AI工作流程、RAG管道、代理、模型管理、可安装性功能等，让您可以快速从原型到生产。以下是其核心功能列表：  \n\n官网地址： https://github.com/langgenius/dify\n\n使用方法如下图, Api Base 输入: https://moapi.moshanjun.com  \n\n![12.png](https://api.apifox.com/api/v1/projects/2946232/resources/480666/image-preview)\n\n![13.png](https://api.apifox.com/api/v1/projects/2946232/resources/480667/image-preview)\n\n\n# Anything LL M  \n\nAI的一切都在一个桌面应用程序中。与文档聊天，使用AI代理，以及更全面的本地和离线。\n官网地址：https://anythingllm.com/  \n\n使用方法如下图  \n\nBase URL 输入: https://moapi.moshanjun.com/v1  \n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/491017/image-preview)\n# ChatGPT-Next-Web\n\n官网地址：https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web\n\n使用方法如下图:\nBase URL输入: https://moapi.moshanjun.com\n\n![a0290204-3511-46cb-8b12-b75b9eb4af1f.png](https://api.apifox.com/api/v1/projects/2946232/resources/480671/image-preview)\n# 欧路词典、欧路翻译插件\n一款好用的离线查词翻译工具，支持配置多种大模型翻译引擎。\n官网地址：https://www.eudic.net\n \n使用方法：在翻译引擎-自定义引擎设置中填入购买的密钥，并在自定义API接口里填写 https://moapi.moshanjun.com/v1/chat/completions 即可。\n\n![image.png](https://api.apifox.com/api/v1/projects/2946232/resources/505076/image-preview)\n\n# Cline\n\nIDE中的自主编码代理，能够创建/编辑文件、运行命令、使用浏览器等。\n\n官网地址：https://cline.bot\n\n使用方法如下图:\nBase URL输入: https://moapi.moshanjun.com/v1\n\n![724ab9b5a2159eaa455ab356c74810e6.png](https://api.apifox.com/api/v1/projects/2946232/resources/496104/image-preview)\n# ARGO\n一个本地化大模型Agent开发工具, 支持Mac silicon和Windows平台。支持了解析文件、本地知识库等能力.\n官网地址：https://www.xark-argo.com\n\n使用方法如下图:\nBase URL输入: https://moapi.moshanjun.com/v1\n![Xnip2024-12-20_22-12-55_副本.png](https://api.apifox.com/api/v1/projects/2946232/resources/485457/image-preview)\n# 用户协议  \n\n使用即视为同意本协议！否则请勿使用！  \n\n1.本服务不会以任何形式持久化存储任何用户的任何聊天信息；  \n\n2.本服务不知晓也无从知晓用户在本服务上传输的任何文本内容，用户使用本服务引发的任何违法犯罪后果，由使用者承担，本服务将全力配合由此可能引|起的相关调查；  \n\n3.本服务视为ChatAnywhereAPi项目以及相关项目的辅助调试工具，请勿用于其他用途；  \n\n4.我们有权在市场价格剧烈波动时对价格进行合理调整：  \n',
    },
    {
      id: 'doc-2694962',
      title: '费用标准及模型列表',
      group: '帮助中心',
      category: ['帮助中心'],
      method: null,
      path: null,
      sourceUrl: 'https://chatanywhere.apifox.cn/doc-2694962.md',
      markdown:
        '# 费用标准及模型列表\n\n- 查询余额地址: https://api.chatanywhere.org\n- 列表可能未及时更新，部分模型可能已被官方下架，请以官方信息为准。\n- 以下是转发接口的详细计费[单位(CA币)：元]标准(价格随着供应商的变动而变动)：\n\n| **模型（Model）** | **请求（Input）** | **回答（Output）** | **是否支持** | **特点** |\n| --- | --- | --- | --- | --- |\n| gpt-5.4 | 0.0175 / 1K Tokens [7阶梯计价]| 0.105 / 1K Tokens | 支持 | openai最新推出的面向各行各业的编码和智能体任务的旗舰模型 |\n| gpt-5.4-mini | 0.00525 / 1K Tokens | 0.0315 / 1K Tokens | 支持 | openai2026年3月17日为止最强大的编码、计算机使用和子代理迷你模型 |\n| gpt-5.4-mini-2026-03-17 | 0.00525 / 1K Tokens | 0.0315 / 1K Tokens | 支持 | openai2026年3月17日为止最强大的编码、计算机使用和子代理迷你模型|\n| gpt-5.4-nano | 0.0014 / 1K Tokens | 0.00875 / 1K Tokens | 支持 | openai最便宜的GPT-5.4级型号，适用于简单的高容量任务 |\n| gpt-5.4-nano-2026-03-17 | 0.0014 / 1K Tokens | 0.00875 / 1K Tokens | 支持 | openai最便宜的GPT-5.4级型号，适用于简单的高容量任务 |\n| gpt-5.4-2026-03-05 | 0.0175 / 1K Tokens | 0.105 / 1K Tokens | 支持 | openai最新推出的面向各行各业的编码和智能体任务的旗舰模型 |\n| gpt-5.2 | 0.01225 / 1K Tokens | 0.098  / 1K Tokens | 支持 | 面向各行各业的编码和智能体任务的旗舰模型 |\n| gpt-5.2-2025-12-11 | 0.01225 / 1K Tokens | 0.098  / 1K Tokens |支持| 面向各行各业的编码和智能体任务的旗舰模型 |\n| gpt-5.2-chat-latest | 0.01225 / 1K Tokens | 0.098  / 1K Tokens | 支持 | 指向 ChatGPT网页版本 当前使用的 GPT-5.2 快照。我们推荐GPT-5.2对于大多数 API 用法，但您可以随意使用此 GPT-5.2 聊天模型来测试我们针对聊天用例的最新改进 |\n| gpt-5.2-pro | 0.147 / 1K Tokens | 1.176  / 1K Tokens | 支持 | 目前仅在响应 API 中可用，用于支持在响应 API 请求之前进行多轮模型交互。此模型回复较慢比较长的问题不建议使用有可能会超时。|\n| gpt-5.2-pro-2025-12-11 | 0.147 / 1K Tokens | 1.176  / 1K Tokens | 支持 |   目前仅在响应 API 中可用，用于支持在响应 API 请求之前进行多轮模型交互。此模型回复较慢比较长的问题不建议使用有可能会超时|\n| gpt-5.1 | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | 用于编码和智能体任务的旗舰模型，它具备可配置的推理和非推理能力 |\n| gpt-5.1-2025-11-13 | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | 用于编码和智能体任务的旗舰模型，它具备可配置的推理和非推理能力 |\n| gpt-5.1-chat-latest | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | 指向 ChatGPT 当前使用的 GPT-5.1 快照。我们推荐GPT-5.1对于大多数 API 用法，但您可以随意使用此 GPT-5.1 聊天模型来测试我们针对聊天用例的最新改进 |\n| gpt-5.1-codex | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | GPT-5.1-Codex 是 GPT-5 的一个版本，针对智能编码任务进行了优化。|\n| gpt-5-search-api | 0.00875 / 1K Tokens | 0.07  / 1K Tokens + 搜索费用[6]| 支持 | Openai 出的搜索模型,支持网络搜索,指向最新的gpt-5的搜索模型|\n| gpt-5 | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | GPT-5 是用于跨领域编码、推理和代理任务的旗舰模型 |\n| gpt-5-codex | 0.00875 / 1K Tokens | 0.07  / 1K Tokens | 支持 | GPT-5-Codex 是针对代理编码任务优化。它可在 Responses API仅限此版本，底层模型快照将定期更新。 |\n| gpt-5-pro | 0.105 / 1K Tokens | 0.84  / 1K Tokens | 支持 | 使用更多的计算来更努力地思考，并始终如一地提供更好的答案。此模型回复较慢比较长的问题不建议使用有可能会超时 |\n| gpt-5-mini | 0.00175 / 1K Tokens | 0.014  / 1K Tokens | 支持 |GPT-5 mini 是 GPT-5 的一个更快、更经济的版本。它非常适合执行定义明确的任务和精准的提示 |\n| gpt-5-nano | 0.00035 / 1K Tokens | 0.0028  / 1K Tokens | 支持 |GPT-5 Nano 是速度最快、成本最低的 GPT-5 版本。它非常适合摘要和分类任务 |\n| gpt-5-chat-latest |0.00875 / 1K Tokens | 0.07 / 1K Tokens | 支持 | GPT-5 Chat 指的是 ChatGPT 当前使用的 GPT-5 快照|\n| o3 | 0.014 / 1K Tokens | 0.056  / 1K Tokens | 支持 | 为数学、科学、编码、视觉推理任务和技术写作设定了新的标准。 指向o3-2025-04-16|\n| o3-2025-04-16 | 0.014 / 1K Tokens | 0.056   / 1K Tokens | 支持 | 为数学、科学、编码、视觉推理任务和技术写作设定了新的标准。 |\n| o4-mini | 0.0088 / 1K Tokens | 0.0352  / 1K Tokens | 支持 | 为数学、科学、编码、视觉推理任务和技术写作设定了新的标准。 指向o4-mini-2025-04-16|\n| o4-mini-2025-04-16 | 0.0088 / 1K Tokens | 0.0352  / 1K Tokens | 支持 | 为数学、科学、编码、视觉推理任务和技术写作设定了新的标准。 |\n| gpt-4.1 |  0.014 / 1K Tokens | 0.056   / 1K Tokens | 支持 | OpenAI最新推出的模型 在编码、指令跟踪和长上下文方面都有重大改进1M输入32k输出 指向gpt-4.1-2025-04-14 |\n| gpt-4.1-2025-04-14 | 0.014 / 1K Tokens | 0.056  / 1K Tokens | 支持 | OpenAI最新推出的模型 在编码、指令跟踪和长上下文方面都有重大改进1M输入32k输出|\n| gpt-4.1-mini | 0.0028 / 1K Tokens | 0.0112  / 1K Tokens | 支持 | OpenAI最新推出的模型 在编码、指令跟踪和长上下文方面都有重大改进1M输入32k输出 指向gpt-4.1-mini-2025-04-14 |\n| gpt-4.1-mini-2025-04-14 | 0.0028 / 1K Tokens | 0.0112  / 1K Tokens | 支持 | OpenAI最新推出的模型 在编码、指令跟踪和长上下文方面都有重大改进1M输入32k输出|\n| gpt-4.1-nano | 0.0007 / 1K Tokens | 0.0028  / 1K Tokens | 支持 | OpenAI最新推出的模型 在编码、指令跟踪和长上下文方面都有重大改进1M输入32k输出 指向gpt-4.1-nano-2025-04-14 |\n| gpt-4.1-nano-2025-04-14 | 0.0007 / 1K Tokens | 0.0028  / 1K Tokens | 支持 | OpenAI最新推出的模型 在编码、指令跟踪和长上下文方面都有重大改进1M输入32k输出|\n| gpt-oss-20b| 0.0008 / 1K Tokens | 0.0032  / 1K Tokens | 支持 | OpenAI最新推出的开源模型|\n| gpt-oss-120b| 0.0044 / 1K Tokens | 0.0176  / 1K Tokens | 支持 | OpenAI最新推出的开源模型|\n| gpt-3.5-turbo | 0.0035 / 1K Tokens | 0.0105 / 1K Tokens | 支持 | 默认模型，等于gpt-3.5-turbo-0125|\n| gpt-3.5-turbo-1106 | 0.007 / 1K Tokens | 0.014 / 1K Tokens | 支持 | 2023年11月6日更新的模型|\n| gpt-3.5-turbo-0125 | 0.0035 / 1K Tokens | 0.0105 / 1K Tokens | 支持 | 2024年1月25日最新模型，数据最新，价格更更低，速度更快，修复了一些1106的bug。|\n| gpt-3.5-turbo-16k | 0.021 / 1K Tokens | 0.028 / 1K Tokens | 支持 | 适合快速回答简单问题,字数更多 |\n| gpt-3.5-turbo-instruct | 0.0105 / 1K Tokens | 0.014 / 1K Tokens | 支持 |Completions模型 用于文本生成，提供准确的自然语言处理模型一般人用不上|\n| o3-mini [5]| 0.0088 / 1K Tokens | 0.0352 / 1K Tokens | 支持 | 针对复杂任务的推理模型 |\n| gpt-4o-search-preview  | 0.0175/1K Tokens| 0.07/1K Tokens + 搜索费用[6]| 支持 | Openai 出的搜索模型,支持网络搜索,指向最新的4o的搜索模型|\n| gpt-4o-search-preview-2025-03-11| 0.0175/1K Tokens| 0.07/1K Tokens + 搜索费用[6]| 支持 | Openai 出的搜索模型,支持网络搜索|\n| gpt-4o-mini-search-preview | 0.00105/1K Tokens| 0.0042/1K Tokens + 搜索费用[6]| 支持 | Openai 出的搜索模型,支持网络搜索,指向最新的4o-mini的搜索模型|\n| gpt-4o-mini-search-preview-2025-03-11 |0.00105/1K Tokens| 0.0042/1K Tokens + 搜索费用[6]| 支持 | Openai 出的搜索模型,支持网络搜索|\n| gpt-4 | 0.21 / 1K Tokens | 0.42 / 1K Tokens | 支持 | 默认模型，等于gpt-4-0613 |\n| gpt-4o | 0.0175/1K Tokens + 图片费用[2]| 0.07/1K Tokens| 支持 | Openai 价格更低, 速度更快更聪明,指向最新版的4o版本|\n| gpt-4o-2024-11-20 | 0.0175/1K Tokens + 图片费用[2]| 0.07/1K Tokens | 支持 | Openai 2024-11-20出的gpt-4o模型, 该模型的创意写作能力得到了提升一更自然、更有吸引力、更有针对性的写作|\n| gpt-4o-mini | 0.00105/1K Tokens + 图片费用[2]| 0.0042/1K Tokens| 支持 | Openai 最新模型, 价格更低, 输出质量在3.5之上4o之下, 并且支持读图|\n| gpt-4-0613 | 0.21 / 1K Tokens | 0.42 / 1K Tokens | 支持 | 2023年6月13日更新的模型 |\n| gpt-5.4-ca | 0.01 / 1K Tokens [7阶梯计价]| 0.06 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的  |\n| gpt-5.4-mini-ca | 0.003 / 1K Tokens| 0.018 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的  |\n| gpt-5.4-nano-ca | 0.0008 / 1K Tokens | 0.005 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的  |\n| gpt-5-codex-ca | 0.005 / 1K Tokens | 0.04  / 1K Tokens | 支持 | 支持在codex中使用第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5.1-codex-ca | 0.005 / 1K Tokens | 0.04  / 1K Tokens | 支持 | 支持在codex中使用第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5.2-codex-ca | 0.007 / 1K Tokens | 0.056  / 1K Tokens | 支持 | 支持在codex中使用第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5.2-ca | 0.007 / 1K Tokens | 0.056  / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5.2-chat-latest-ca | 0.007 / 1K Tokens | 0.056  / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5.1-ca | 0.005 / 1K Tokens | 0.04  / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5.1-chat-latest-ca | 0.005 / 1K Tokens | 0.04  / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5-ca | 0.005 / 1K Tokens | 0.04  / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的 |\n| gpt-5-mini-ca | 0.001  / 1K Tokens | 0.008  / 1K Tokens| 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| gpt-5-nano-ca | 0.0002 / 1K Tokens | 0.0016  / 1K Tokens| 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| gpt-5-chat-latest-ca |0.005 / 1K Tokens | 0.04 / 1K Tokens| 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| gpt-4.1-ca| 0.008 / 1K Tokens | 0.032 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| gpt-4.1-mini-ca | 0.0016 / 1K Tokens | 0.0064 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| gpt-4.1-nano-ca | 0.0004 / 1K Tokens | 0.003 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| gpt-3.5-turbo-ca | 0.001 / 1K Tokens | 0.0016  / 1K Tokens | 不支持 | 由于Azure openai已经下架gpt-3.5,故-ca版本的3.5以不可以用,请使用gpt-4o-mini或者gpt-4.1-mini或者更高的模型本模型将会重定向至gpt-4o-mini|\n| gpt-4-ca | 0.12 / 1K Tokens | 0.24 / 1K Tokens | 支持 |由于Azure openai已经下架gpt-4,故-ca版本的4以不可以用,请使用gpt-4o或者gpt-4.1或者更高的模型|\n| gpt-4o-ca | 0.01 / 1K Tokens + 0.0289\\*图片个数[3]| 0.04 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| gpt-4o-mini-ca | 0.00075 / 1K Tokens| 0.003 / 1K Tokens | 支持 | 第三方优质提供商提供的服务,优点价格便宜,但是稳定性没有非-ca的好, 模型返回和能力都是一样的|\n| deepseek-v3.2|  0.0012  / 1K Tokens | 0.0018 / 1K Tokens | 支持 |deepseek的聊天模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-v3.2-thinking|  0.0012  / 1K Tokens | 0.0018 / 1K Tokens | 支持 |deepseek的聊天模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-v3-2-exp |  0.0012  / 1K Tokens | 0.0018 / 1K Tokens | 支持 |deepseek的聊天模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-v3.1-250821 |  0.0024  / 1K Tokens | 0.0072 / 1K Tokens | 支持 |deepseek的聊天模型, 此此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-v3.1-think-250821 | 0.0024  / 1K Tokens | 0.0072 / 1K Tokens | 支持 |deepseek的聊天模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-reasoner | 0.0024  / 1K Tokens | 0.0096 / 1K Tokens | 支持 |deepseek的思考R1模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-r1 | 0.0024  / 1K Tokens | 0.0096 / 1K Tokens | 支持 |deepseek的思考R1模型, 此模型由第三方(火山引擎)供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-r1-250528 | 0.0024  / 1K Tokens | 0.0096 / 1K Tokens | 支持 |deepseek的思考R1模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-v3 | 0.0012  / 1K Tokens | 0.0048 / 1K Tokens | 支持 |deepseek的聊天模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| deepseek-chat |  0.0012  / 1K Tokens | 0.0018 / 1K Tokens | 支持 |deepseek的聊天模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-opus-4-7 | 0.025 / 1K Tokens | 0.125 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-sonnet-4-6 | 0.015 / 1K Tokens | 0.075 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，现在使用的为Claude code的逆向或官方逆向的渠道。|\n| claude-sonnet-4-6-thinking | 0.015 / 1K Tokens | 0.075 | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-opus-4-6 | 0.025 / 1K Tokens | 0.125 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-opus-4-6-thinking | 0.025 / 1K Tokens | 0.125 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-opus-4-5-20251101 | 0.025 / 1K Tokens | 0.125 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-opus-4-5-20251101-thinking | 0.025 / 1K Tokens | 0.125 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-haiku-4-5-20251001 | 0.005 / 1K Tokens | 0.025 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-haiku-4-5-20251001-thinking | 0.005 / 1K Tokens | 0.025 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-sonnet-4-5-20250929 | 0.015 / 1K Tokens | 0.075 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，现在使用的为Claude code的逆向或官方逆向的渠道。|\n| claude-sonnet-4-5-20250929-thinking | 0.015 / 1K Tokens | 0.075 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，现在使用的为Claude code的逆向或官方逆向的渠道。|\n| claude-opus-4-1-20250805 | 0.075 / 1K Tokens | 0.375 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| claude-opus-4-1-20250805-thinking | 0.075 / 1K Tokens | 0.375 / 1K Tokens | 支持 |claude的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-2.5-pro | 0.007 / 1K Tokens | 0.04 / 1K Tokens | 支持 | 是gemini 最新的旗舰模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-2.5-flash | 0.0012 / 1K Tokens | 0.01 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-2.5-flash-nothinking | 0.0012 / 1K Tokens | 0.01 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-2.5-flash-lite | 0.0004 / 1K Tokens | 0.0016 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-2.5-flash-image-preview | 0.0015 / 1K Tokens | 0.15 / 1K Tokens | 支持 | Google Gemini的生图模型也是大家口中所说的nano banana |\n| gemini-3-pro-image-preview | 0 / 1K Tokens | 0.68一张图| 支持 | Google Gemini的生图模型也是大家口中所说的nano banana |\n| gemini-3.1-flash-image-preview | 0.00125 / 1K Tokens | 0.3 / 1K Tokens | 支持 | Google Gemini的生图模型也是大家口中所说的nano banana |\n| gemini-3-pro-preview | 0.008 / 1K Tokens | 0.048 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-3-flash-preview | 0.002 / 1K Tokens | 0.012 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-3-flash-preview-nothinking | 0.002 / 1K Tokens | 0.012 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-3.1-pro-preview | 0.008 / 1K Tokens | 0.048 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| gemini-3.1-flash-lite-preview | 0.001 / 1K Tokens | 0.006 / 1K Tokens | 支持 | Google Gemini 的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| grok-4 | 0.012 / 1K Tokens | 0.06 / 1K Tokens | 支持 |grok基础模此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| grok-4-fast | 0.0008 / 1K Tokens | 0.002 / 1K Tokens | 支持 |grok基础模此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| qwen3.5-plus| 0.00056  / 1K Tokens[7阶梯计价]| 0.00336 / 1K Tokens | 支持 | qwen的模型, 此模型阶梯定价具体定价请查看文档最后的注释,此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| qwen3.5-397b-a17b| 0.00084  / 1K Tokens[7阶梯计价]| 0.00504 / 1K Tokens | 支持 | qwen的模型, 此模型阶梯定价具体定价请查看文档最后的注释,此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| qwen3-max-2026-01-23 | 0.00175 / 1K Tokens[7阶梯计价]| 0.007 / 1K Tokens | 支持 | qwen的模型, 此模型阶梯定价具体定价请查看文档最后的注释,此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| qwen3-235b-a22b | 0.0014 / 1K Tokens | 0.0056 / 1K Tokens | 支持 | qwen的开源模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| qwen3-235b-a22b-instruct-2507 | 0.0014 / 1K Tokens | 0.0056 / 1K Tokens | 支持 | qwen的开源模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| qwen3-coder-plus | 0.0028 / 1K Tokens | 0.0112 / 1K Tokens | 支持 | qwen的开源模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| qwen3-coder-480b-a35b-instruct | 0.0042 / 1K Tokens | 0.0168 / 1K Tokens | 支持 | qwen的开源模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| kimi-k2.5 | 0.0028 / 1K Tokens | 0.0147 / 1K Tokens | 支持 | kimi的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| glm-4.7 | 0.0024 / 1K Tokens | 0.0096 / 1K Tokens | 支持 | glm的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| glm-5 | 0.0024 / 1K Tokens [7阶梯计价]| 0.0108 / 1K Tokens | 支持 | glm模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| minimax-m2.1 | 0.00126 / 1K Tokens | 0.00504 / 1K Tokens | 支持 | minimax的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n| minimax-m2.5 | 0.00126 / 1K Tokens | 0.00504 / 1K Tokens | 支持 | minimax的模型, 此模型由第三方供应商提供，有小概率可能会出现响应速度较慢或报错的情况。|\n\n\n| **模型（Model）** | **价格** | **是否支持** |\n| --- | --- | --- |\n| gpt-image-2 | 文字输入: 0.035CA/1K Tokens, 图片输入: 0.07CA/1K Tokens, 图片输出：0.21 CA/1K Tokens | 不支持 |\n| gpt-image-2-ca | 0.4ca一张图, CA 版的Image为逆向模型，使用时建议尽量编写清晰、完整的 Prompt。为了更容易触发绘图，建议在提示词中加入类似“画一个 xxxx”这样的表述。 | 支持 |\n| gpt-image-1.5 | 文字输入: 0.035CA/1K Tokens, 图片输入: 0.07CA/1K Tokens, 图片输出：0.224 CA/1K Tokens | 支持 |\n| gpt-image-1 | 文字输入: 0.04CA/1K Tokens, 图片输入: 0.08CA/1K Tokens, 图片输出：0.32 CA/1K Tokens | 支持 |\n| gpt-image-1-mini | 文字输入: 0.014CA/1K Tokens, 图片输入: 0.0175CA/1K Tokens, 图片输出：0.056 CA/1K Tokens | 支持 |\n| dall-e-3 1024×1024 | 0.280 / image | 支持 |\n| dall-e-3 1024×1792 | 0.560 / image | 支持 |\n| dall-e-3-hd 1024×1024 | 0.560 / image | 支持 |\n| dall-e-3-hd 1024×1792 | 0.840 / image | 支持 |\n| dall-e-2 1024×1024 | 0.14 / image | 支持 |\n| dall-e-2 512x512 | 0.126 / image | 支持 |\n| dall-e-2 256x256 | 0.112 / image | 支持 |\n| tts-1 | 0.105 / 1K characters | 支持 |\n| tts-1-hd | 0.21 / 1K characters | 支持 |\n| gpt-4o-mini-tts | (0.12 / minute) + (0.012 / 1kToken) | 支持 |\n| Whisper | 0.042 / minute | 支持 |\n| gpt-4o-mini-transcribe | 0.024 / minute | 支持 |\n| gpt-4o-transcribe | 0.048 / minute | 支持 |\n| text-embedding-ada-002 | 0.0007 / 1K Tokens | 支持 |\n| text-embedding-3-small | 0.00014 / 1K Tokens | 支持 |\n| text-embedding-3-large | 0.00091 / 1K Tokens | 支持 |\n\n[OpenAi官方价格文档](https://openai.com/api/pricing/)\n[1] Tokens: GPT中指文本数据的最小处理单位。一个token可以是一个字、一个词或者一个字符，这取决于所使用的语言和处理方式。例如，在英文中，一个token可能是一个单词，如"apple"；在中文中，一个token可能是一个字符，如"苹"。 1K Tokens = 1000个Token。（根据经验估算：gpt-4o模型 1000Tokens≈1000-1200个中文字符；非gpt-4o模型1000Tokens≈700-800中文字符）\n[2] 多模态模型图片如何计算占用tokens请参考OpenAI官方 https://openai.com/api/pricing 。分辨率越高，tokens占用越多，但最高不会超过1445tokens。\n以下以1000x150分辨率的图片为例，计算图片占用Tokens数为425。\n<img src="https://api.apifox.cn/api/v1/projects/2946232/resources/442830/image-preview" width="400"/>\n注意gpt-4o-mini的图片价格并没有降低，与gpt-4o一致。因为mini的token价格为4o的33分之一，所以你应该会看到图片的token计算是4o的33倍，具体参考openai官方的价格页面https://openai.com/api/pricing/\n[3] CA系列多模态模型在计算图片价格时，如果使用流式传输(参数stream=true)，则按照0.10115每张图计费；如果使用非流式传输（参数stream=false），这时按照OpenAI返回的实际消耗量计费，如果你的图片分辨率较低，通常低于0.10115。因此，我们建议在使用gpt-4-turbo分析图片时，使用非流式传输（参数stream=false）。\n[4] 动态更新的版本，持续集成OpenAI最新的研究成果。它为开发人员和研究人员提供了探索最前沿技术的机会。请注意，尽管该模型展示了最新的能力，但对于生产环境的使用，我们仍然建议选择经过优化的旧版GPT模型，以确保更高的稳定性和性能\n[5] o1和o3-mini由于这两种模型的可用账号数量较少，资源稳定性可能存在波动，即可能出现时可用、时不可用的情况。建议如在生产环境中使用时做好相应的容错处理。\n[6] OpenAI 的搜索模型除了输入输出的 token 费用外，还需要缴纳一个按次收费的 web_search 费用。对于 4o-mini 模型，费用为：low: 0.175，medium: 0.1925，high: 0.21。对于 4o 模型，费用为：low: 0.21，medium: 0.245，high: 0.35。\n对于5模型费用为0.07\n默认情况下，费用为 medium。请根据您的需求选择合适的搜索级别，以优化成本和性能。\n此费用为官方收费，非我们额外收费。\n[7] 阶梯计价\n> **gpt-5.4**\n> | 输入范围 | 输入价格 | 输出价格 |\n> |---------|---------|---------|\n> | 0 - 272K | 0.0175 CA/1K Tokens | 0.105 CA/1K Tokens |\n> | > 272K | 0.035 CA/1K Tokens | 0.1575 CA/1K Tokens |\n\n> **gpt-5.4-ca**\n> | 输入范围 | 输入价格 | 输出价格 |\n> |---------|---------|---------|\n> | 0 - 272K | 0.01 CA/1K Tokens | 0.06 CA/1K Tokens |\n> | > 272K | 0.02 CA/1K Tokens | 0.09 CA/1K Tokens |\n\n> **qwen3-max-2026-01-23**\n> | 输入范围 | 输入价格 | 输出价格 |\n> |---------|---------|---------|\n> | 0 - 32K | 0.00175 CA/1K Tokens | 0.007 CA/1K Tokens |\n> | 32K - 128K | 0.0028 CA/1K Tokens | 0.0112 CA/1K Tokens |\n> | > 128K | 0.0049 CA/1K Tokens | 0.0196 CA/1K Tokens |\n\n> **qwen3-max-2026-01-23**\n> | 输入范围 | 输入价格 | 输出价格 |\n> |---------|---------|---------|\n> | 0 - 128K | 0.00056 CA/1K Tokens | 0.00336 CA/1K Tokens |\n> | 128K - 256K | 0.0014 CA/1K Tokens | 0.0084 CA/1K Tokens |\n> | > 256K | 0.0028 CA/1K Tokens | 0.0168 CA/1K Tokens |\n\n> **qwen3.5-397b-a17b**\n> | 输入范围 | 输入价格 | 输出价格 |\n> |---------|---------|---------|\n> | 0 - 128K | 0.00084 CA/1K Tokens | 0.00504 CA/1K Tokens |\n> | > 128K | 0.0021 CA/1K Tokens | 0.0126 CA/1K Tokens |\n\n> **qwen3.5-397b-a17b**\n> | 输入范围 | 输入价格 | 输出价格 |\n> |---------|---------|---------|\n> | 0 - 128K | 0.00056 CA/1K Tokens | 0.00336 CA/1K Tokens |\n> | 128K - 256K | 0.0014 CA/1K Tokens | 0.0084 CA/1K Tokens |\n> |> 256K | 0.0028 CA/1K Tokens | 0.0168 CA/1K Tokens |\n\n> **glm-5**\n>| 输入范围 | 输入价格 | 输出价格 |\n>|---------|---------|---------|\n>| 0 - 32K | 0.0024 CA/1K Tokens | 0.0108 CA/1K Tokens |\n>| >32K| 0.0036 CA/1K Tokens | 0.0132 CA/1K Tokens |\n\n',
    },
    {
      id: 'doc-2664690',
      title: '常见问题及解决办法',
      group: '帮助中心',
      category: ['帮助中心'],
      method: null,
      path: null,
      sourceUrl: 'https://chatanywhere.apifox.cn/doc-2664690.md',
      markdown:
        '# 常见问题及解决办法\n\n## API密钥（Key）是否有使用时间限制？\n- 我们的API密钥（Key）暂时没有使用时间限制，只要密钥（Key）的使用场景没有触犯到OpenAI官方条款或规则。我们并不会对您的密钥（Key）的合理使用进行风控或注销处理。\n\n## 如何开发票？\n- 开票请按照以下格式发送邮件到receipt@chatanywhere.tech，发票在 3-5 个工作日内开具，开具后将发至您的发件邮箱。\n- 请务必按照格式发送，格式错误可能不予开票。\n> \n> 公司名称：（必填） \n> \n> 税号：（必填）\n> \n> 单位地址：选填 \n> \n> 电话号码：选填\n> \n> 开户银行：选填 \n> \n> 银行账户：选填\n> \n> 备注：选填(此项可以备注一些您的需求)\n> \n> 总开票金额：xxx 元(注意此项请填写实付金额, 请勿填写打折前的金额)\n> \n> 最后请附带所有的支付宝付款记录截图（不提供付款记录不予开票）\n\n\n## 转发接口与个人接口有什么区别？\n- 我们提供稳定、可靠且高效的API转发接口，其与官方直连接口区别如下：\n1、API密钥（Key）没有使用时间限制；\n2、允许对API密钥（Key）定制配额；\n3、无需担心OpenAI风控；\n4、国内直连，动态加速（无需工具），比用工具连接 OpenAI 更稳定，延时更低；\n5、一个Key可以使用多种大模型低。\n\n## API接口的并发请求是否有限制？\n- 当前阶段，我们没有按照用户设置硬性并发上限。在系统总负载量较高时，基于系统负载和用户短时历史用量的动态限流模型可能会导致用户收到 503 或 429 错误码。\n\n## API接口的返回数据显示错误是什么意思？\n- 针对不同的数据返回代码，以下是常见的错误代码：\n\n|  错误代码  | 代码解释 |\n| --- | --- |\n| 400 Bad Request    |  请求格式错误或无效。这通常意味着你的请求参数有误，需要你检查并修正请求参数。 |\n| 401 Unauthorized  | API密钥无效或未提供。你需要检查你的API密钥是否正确，并确保在请求中正确提供。 |\n| 403 Forbidden | 一般是余额不足。 |\n| 404 Not Found | 请求的资源未找到。你可能正在试图访问一个不存在的端点。 |\n| 413 Request Entity Too Large | 请求体太大。你可能需要减少你的请求数据量。 |\n| 429 Too Many Requests | 由于短时间内发送过多的请求，你已经超过了你的速率限制。 |\n| 500 Internal Server Error | 服务器内部错误。这可能是OpenAI服务器的问题，或者您传递参数有问题。 |\n| 503 Service Unavailable | 服务暂时不可用。这可能是由于OpenAI正在进行维护或者服务器过载，或者您传递参数有问题。 |\n\n请注意，以上列表并不包含所有可能的错误代码，但它涵盖了大部分常见的情况。如果你遇到任何其他错误，你应该查阅OpenAI的官方文档或者联系我们的技术团队以获取更多信息。\n',
    },
    {
      id: 'doc-6479345',
      title: '模型更新日志: 2026-04-23',
      group: '帮助中心',
      category: ['帮助中心'],
      method: null,
      path: null,
      sourceUrl: 'https://chatanywhere.apifox.cn/doc-6479345.md',
      markdown:
        '# 模型更新日志: 2026-04-23\n\n# 2026-04-23\n- gpt-image-2-ca\n\n# 2026-04-17\n- 新增claude-opus-4-7\n\n# 2026-04-09\n- 支持 Claude 原生协议，Claude 原生协议已适配缓存\n\n# 2026-03-21\n- 新增gpt-5.4-mini, gpt-5.4-nano,gpt-5.4-mini-ca, gpt-5.4-nano-ca\n\n# 2026-03-12\n- 新增gpt-5.4-ca\n\n# 2026-03-06\n- 新增gpt-5.4, gemini-3.1-flash-lite-preview\n\n# 2026-03-02\n- 新增gemini-3.1-flash-image-preview, qwen3.5-plus, qwen3.5-397b-a17b\n\n# 2026-02-20\n- 新增gemini-3.1-pro-preview\n\n# 2026-02-18\n- 新增claude-sonnet-4-6 \n\n# 2026-02-13\n- 新增glm-5, minimax-m2.5\n\n# 2026-02-06\n- 新增claude-opus-4-6, claude-opus-4-6-thinking, gpt-5-codex-ca, gpt-5.1-codex-ca, gpt-5.2-codex-ca, -ca系列的codex可以在codex中使用\n\n# 2026-02-02\n- 新增qwen3-max-2026-01-23, kimi-k2.5\n\n# 2026-01-14\n- 新增glm-4.7, minimax-m2.1\n\n# 2025-12-18\n- 新增gemini-3-flash-preview,gemini-3-flash-preview-nothinking\n\n# 2025-12-17\n- 新增gpt-image-1.5\n\n# 2025-12-12\n- 新增gpt-5.2, gpt-5.2-chat-latest, gpt-5.2-pro, gpt-5.2-ca, gpt-5.2-chat-latest-ca\n\n# 2025-12-08\n- 新增gpt-image-1-mini, gpt-5-search-api\n\n# 2025-12-02\n- 新增deepseek-v3.2, deepseek-v3.2-thinking\n\n# 2025-11-27\n- 新增claude-opus-4-5-20251101, claude-opus-4-5-20251101-thinking\n\n# 2025-11-21\n- 新增gemini-3-pro-image-preview\n\n# 2025-11-17\n- 新增gemini-3-pro-preview\n\n# 2025-11-16\n- 新增gpt-5.1-ca, gpt-5.1-chat-latest-ca\n\n# 2025-11-14\n- 新增gpt-5.1, gpt-5.1-chat-latest, gpt-5.1-codex\n\n# 2025-11-10\n- 新增kimi-k2-0905-preview, kimi-k2-thinking, kimi-k2-thinking-turbo\n\n# 2025-11-04\n- 新增deepseek-ocr, claude-haiku-4-5-20251001, claude-haiku-4-5-20251001-thinking模型\n\n# 2025-10-27\n- 新增gpt-5-pro模型\n- gpt系列全系支持responses接口, 并支持流式输出\n\n# 2025-10-16\n- 新增gpt-5-codex, responses接口\n    - responses 接口目前仅支持调用 gpt-5-codex 模型并且仅支持非流式模式。\n\n# 2025-10-09\n- 新增grok-4-fast, deepseek-v3-2-exp模型\n\n# 2025-09-30\n- 新增claude-sonnet-4-5-20250929, claude-sonnet-4-5-20250929-thinking模型\n\n# 2025-09-04\n- gemini-2.5-flash-image-preview 模型, 该模型即是nano banana\n\n# 2025-08-25\n- 新增gpt-5-ca, gpt-5-mini-ca, gpt-5-nano-ca, gpt-5-chat-latest-ca, deepseek-v3.1-250821, deepseek-v3.1-think-250821 模型\n\n# 2025-08-08\n- 新增gpt-5, gpt-5-mini, gpt-5-nano, gpt-5-chat-latest 模型\n\n# 2025-08-06\n- 新增claude-opus-4-1-20250805, claude-opus-4-1-20250805-thinking , gpt-oss-20b, gpt-oss-120b 模型\n\n# 2025-07-25\n- 新增qwen3-coder-480b-a35b-instruct, qwen3-coder-plus, qwen3-235b-a22b-instruct-2507 模型\n\n# 2025-07-21\n- 新增qwen3-235b-a22b, kimi-k2-0711-preview 模型\n\n# 2025-07-15\n- 同官方下架gpt-4.5-preview模型\n\n# 2025-07-11\n- 新增grok-4模型\n\n# 2025-06-18\n- 新增gemini-2.5-flash,gemini-2.5-pro,gemini-2.5-flash-lite-preview-06-17模型\n\n# 2025-06-11\n- o3模型降价, 价格甚至比GPT-4o还要优惠\n\n# 2025-06-08\n- 新增gemini-2.5-pro-preview-06-05\n\n# 2025-05-30\n- 新增deepseek-r1-250528\n\n# 2025-05-28\n- 新增gpt-4.1-ca, gpt-4.1-mini-ca, gpt-4.1-nano-ca 模型\n\n# 2025-05-24\n- 新增claude-opus-4-20250514, claude-opus-4-20250514-thinking, claude-sonnet-4-20250514, claude-sonnet-4-20250514-thinking模型\n\n# 2025-05-22\n- 新增gemini-2.5-flash-preview-05-20模型\n\n# 2025-05-12\n- 新增gemini-2.5-pro-preview-05-06模型\n\n# 2025-04-25\n- 新增gpt-image-1模型, openai最新的生成图片模型\n\n# 2025-04-18\n- 新增gemini-2.5-flash-preview-04-17 模型\n\n# 2025-04-17\n- 添加了两个新的o系列推理模型，o3和o4-mini。他们为数学、科学、编码、视觉推理任务和技术写作设定了新的标准。\n\n# 2025-04-15\n- 将gpt-4.1、gpt-4.1-mini和gpt-4.1-nano模型添加到API中。这些新模型具有改进的指令跟踪、编码和更大的上下文窗口（最多1M令牌）\n\n# 2025-03-27\n- 新增了gemini-2.5-pro-exp-03-25 模型\n\n# 2025-03-17\n- 新增 deepseek-r1和deepseek-v3 \n\n# 2025-03-13\n- 新增了gpt-4o-mini-search-preview和 gpt-4o-search-preview 模型, Openai支持在线网络搜索的模型\n\n# 2025-02-28\n- 新增了以下模型：grok-3、grok-3-reasoner、grok-3-deepsearch\n\n\n> 更早新增的模型未在本日志中记录请查看 [费用标准及模型列表](#doc-2694962)。\n',
    },
    {
      id: 'doc-2664688',
      title: '发出请求',
      group: '模型接口',
      category: ['模型接口'],
      method: null,
      path: null,
      sourceUrl: 'https://chatanywhere.apifox.cn/doc-2664688.md',
      markdown:
        '# 发出请求\n\n\n\n您可以将下面的命令粘贴到您的终端中以运行您的第一个 API 请求。确保替换`YOUR_API_KEY`为您的秘密 API 密钥。\n\n\n\n```bash\n\n1 curl https://moapi.moshanjun.com/v1/chat/completions \\\n2   -H \'Content-Type: application/json\' \\\n3   -H \'Authorization: Bearer YOUR_API_KEY\' \\\n4   -d \'{\n5   "model": "gpt-3.5-turbo",\n6   "messages": [{"role": "user", "content": "Say this is a test!"}],\n7   "temperature": 0.7\n8 }\'\n```\n\n此请求查询模型以完成以提示“ *Say this is a test*`gpt-3.5-turbo` ”开头的文本。您应该会收到类似于以下内容的响应：\n\n\n\n```json\n\n1 {\n2    "id":"chatcmpl-abc123",\n3    "object":"chat.completion",\n4    "created":1677858242,\n5    "model":"gpt-3.5-turbo-0301",\n6    "usage":{\n7       "prompt_tokens":13,\n8       "completion_tokens":7,\n9       "total_tokens":20\n10    },\n11    "choices":[\n12       {\n13          "message":{\n14             "role":"assistant",\n15             "content":"\\n\\nThis is a test!"\n16          },\n17          "finish_reason":"stop",\n18          "index":0\n19       }\n20    ]\n21 }\n```\n\n现在你已经生成了你的第一个聊天完成。我们可以看到`finish_reason`is`stop`这意味着 API 返回了模型生成的完整完成。在上面的请求中，我们只生成了一条消息，但是你可以设置参数`n`来生成多条消息选择。在这个例子中，`gpt-3.5-turbo`更多的是用于传统的[文本完成任务](https://platform.openai.com/docs/guides/completion/introduction)。该模型还针对[聊天应用程序](https://platform.openai.com/docs/guides/chat)进行了优化。\n',
    },
    {
      id: 'api-92222074',
      title: '列出模型',
      group: '模型接口',
      category: ['模型接口', '模型（Models）'],
      method: 'GET',
      path: '/v1/models',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-92222074.md',
      markdown:
        '# 列出模型\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: \'\'\n  description: \'\'\n  version: 1.0.0\npaths:\n  /v1/models:\n    get:\n      summary: 列出模型\n      deprecated: false\n      description: >+\n        列出并描述 API\n        中可用的各种模型。您可以参考[模型](https://platform.openai.com/docs/models)文档以了解可用的模型以及它们之间的区别。\n\n\n        列出当前可用的模型，并提供有关每个模型的基本信息，例如所有者和可用性。\n\n      tags:\n        - 模型接口/模型（Models）\n      parameters:\n        - name: Authorization\n          in: header\n          description: \'\'\n          required: false\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n      responses:\n        \'200\':\n          description: \'\'\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  data:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        id:\n                          type: string\n                        object:\n                          type: string\n                        owned_by:\n                          type: string\n                        permission:\n                          type: array\n                          items:\n                            type: string\n                      required:\n                        - id\n                        - object\n                        - owned_by\n                        - permission\n                      x-apifox-orders:\n                        - id\n                        - object\n                        - owned_by\n                        - permission\n                  object:\n                    type: string\n                required:\n                  - data\n                  - object\n                x-apifox-orders:\n                  - data\n                  - object\n              example: |-\n                {\n                  "data": [\n                    {\n                      "id": "model-id-0",\n                      "object": "model",\n                      "owned_by": "organization-owner",\n                      "permission": [...]\n                    },\n                    {\n                      "id": "model-id-1",\n                      "object": "model",\n                      "owned_by": "organization-owner",\n                      "permission": [...]\n                    },\n                    {\n                      "id": "model-id-2",\n                      "object": "model",\n                      "owned_by": "openai",\n                      "permission": [...]\n                    }\n                  ],\n                  "object": "list"\n                }\n          headers: {}\n          x-apifox-name: List models\n      security: []\n      x-apifox-folder: 模型接口/模型（Models）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-92222074-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n',
    },
    {
      id: 'api-92222076',
      title: '聊天接口',
      group: '模型接口',
      category: ['模型接口', '聊天接口（Chat）'],
      method: 'POST',
      path: '/v1/chat/completions',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-92222076.md',
      markdown:
        "# 聊天接口\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/chat/completions:\n    post:\n      summary: 聊天接口\n      deprecated: false\n      description: |+\n        给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。\n\n        为提供的提示和参数创建完成\n\n      tags:\n        - 模型接口/聊天接口（Chat）\n      parameters:\n        - name: Authorization\n          in: header\n          description: ''\n          required: true\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: ''\n          required: true\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                model:\n                  type: string\n                  description: >-\n                    要使用的模型的 ID。有关哪些模型适用于聊天 API\n                    的详细信息，请参阅[模型端点兼容性表。](https://platform.openai.com/docs/models/model-endpoint-compatibility)\n                messages:\n                  type: array\n                  items:\n                    type: object\n                    properties:\n                      role:\n                        type: string\n                      content:\n                        type: string\n                    x-apifox-orders:\n                      - role\n                      - content\n                  description: >-\n                    以[聊天格式](https://platform.openai.com/docs/guides/chat/introduction)生成聊天完成的消息。\n                temperature:\n                  type: number\n                  description: >-\n                    使用什么采样温度，介于 0 和 2 之间。较高的值（如 0.8）将使输出更加随机，而较低的值（如\n                    0.2）将使输出更加集中和确定。  我们通常建议改变这个或`top_p`但不是两者。\n                top_p:\n                  type: number\n                  description: >-\n                    一种替代温度采样的方法，称为核采样，其中模型考虑具有 top_p 概率质量的标记的结果。所以 0.1 意味着只考虑构成前\n                    10% 概率质量的标记。  我们通常建议改变这个或`temperature`但不是两者。\n                'n':\n                  type: integer\n                  description: 为每个输入消息生成多少个聊天完成选项。\n                stream:\n                  type: boolean\n                  description: >-\n                    如果设置，将发送部分消息增量，就像在 ChatGPT\n                    中一样。当令牌可用时，令牌将作为纯数据[服务器发送事件](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)`data:\n                    [DONE]`发送，流由消息终止。[有关示例代码](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_stream_completions.ipynb)，请参阅\n                    OpenAI Cookbook 。\n                stop:\n                  type: string\n                  description: API 将停止生成更多令牌的最多 4 个序列。\n                max_tokens:\n                  type: integer\n                  description: 聊天完成时生成的最大令牌数。  输入标记和生成标记的总长度受模型上下文长度的限制。\n                presence_penalty:\n                  type: number\n                  description: >-\n                    -2.0 和 2.0 之间的数字。正值会根据到目前为止是否出现在文本中来惩罚新标记，从而增加模型谈论新主题的可能性。 \n                    [查看有关频率和存在惩罚的更多信息。](https://platform.openai.com/docs/api-reference/parameter-details)\n                frequency_penalty:\n                  type: number\n                  description: >-\n                    -2.0 和 2.0 之间的数字。正值会根据新标记在文本中的现有频率对其进行惩罚，从而降低模型逐字重复同一行的可能性。 \n                    [查看有关频率和存在惩罚的更多信息。](https://platform.openai.com/docs/api-reference/parameter-details)\n                logit_bias:\n                  type: object\n                  properties: {}\n                  description: >-\n                    修改指定标记出现在生成中的可能性。  接受一个 json 对象，该对象将标记（由标记器中的标记 ID 指定）映射到从\n                    -100 到 100 的关联偏差值。从数学上讲，偏差会在采样之前添加到模型生成的 logits\n                    中。确切的效果因模型而异，但 -1 和 1 之间的值应该会减少或增加选择的可能性；像 -100 或 100\n                    这样的值应该导致相关令牌的禁止或独占选择。\n                  x-apifox-orders: []\n                user:\n                  type: string\n                  description: >-\n                    代表您的最终用户的唯一标识符，可以帮助 OpenAI\n                    监控和检测滥用行为。[了解更多](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids)。\n                stream_options:\n                  type: object\n                  properties:\n                    include_usage:\n                      type: boolean\n                      description: >-\n                        如果设置，则在消息data:\n                        [DONE]之前会流式传输一个额外的usage块。此块上的字段显示整个请求的令牌使用情况统计信息，并且该choices字段将始终为空数组。\n                  x-apifox-orders:\n                    - include_usage\n                  description: 流式响应的选项。\n                logprobs:\n                  type: boolean\n                  description: 是否返回输出标记的对数概率。如果为 true，则返回message的content中返回的每个输出token的对数概率。\n                top_logprobs:\n                  type: integer\n                  description: >-\n                    0 到 20\n                    之间的整数，指定在每个标记位置返回的最可能标记的数量，每个标记均具有相关的对数概率。如果使用此参数，则logprobs必须设置为true。\n                response_format:\n                  type: object\n                  properties:\n                    type:\n                      type: string\n                      description: 必须是text或json_object。\n                  x-apifox-orders:\n                    - type\n                  description: >-\n                    指定模型必须输出的格式的对象。与GPT-4 Turbo和所有比gpt-3.5-turbo-1106更新的 GPT-3.5\n                    Turbo 模型兼容。 设置为{ \"type\": \"json_object\" }启用 JSON\n                    模式，保证模型生成的消息是有效的 JSON。 重要提示：使用 JSON\n                    模式时，您还必须通过系统或用户消息指示模型自行生成\n                    JSON。如果不这样做，模型可能会生成无休止的空白流，直到生成达到令牌限制，从而导致长时间运行且看似“卡住”的请求。另请注意，如果finish_reason=\"length\"，消息内容可能会被部分截断，这表示生成超出max_tokens或对话超出了最大上下文长度。\n                tools:\n                  type: array\n                  items:\n                    type: object\n                    properties:\n                      type:\n                        type: string\n                      function:\n                        type: object\n                        properties:\n                          description:\n                            type: string\n                          name:\n                            type: string\n                          parameters:\n                            type: object\n                            properties: {}\n                            x-apifox-orders: []\n                        x-apifox-orders:\n                          - description\n                          - name\n                          - parameters\n                        required:\n                          - name\n                    x-apifox-orders:\n                      - type\n                      - function\n                    required:\n                      - type\n                  description: >-\n                    函数调用使用，参考[OpenAI官方文档](https://platform.openai.com/docs/guides/function-calling)\n                tool_choice:\n                  oneOf:\n                    - type: string\n                    - type: object\n                      additionalProperties: false\n                      x-apifox-orders:\n                        - type\n                        - function\n                      properties:\n                        type:\n                          type: string\n                        function:\n                          type: object\n                          properties:\n                            name:\n                              type: string\n                          x-apifox-orders:\n                            - name\n                          required:\n                            - name\n                      required:\n                        - type\n                        - function\n                  description: >-\n                    函数调用使用，参考[OpenAI官方文档](https://platform.openai.com/docs/guides/function-calling)\n              required:\n                - model\n                - messages\n              x-apifox-orders:\n                - messages\n                - model\n                - frequency_penalty\n                - logit_bias\n                - logprobs\n                - top_logprobs\n                - max_tokens\n                - 'n'\n                - presence_penalty\n                - response_format\n                - stop\n                - stream\n                - stream_options\n                - temperature\n                - top_p\n                - tools\n                - tool_choice\n                - user\n            example:\n              model: gpt-3.5-turbo\n              messages:\n                - role: system\n                  content: You are a helpful assistant.\n                - role: user\n                  content: Hello!\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  id:\n                    type: string\n                  object:\n                    type: string\n                  created:\n                    type: integer\n                  choices:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        index:\n                          type: integer\n                        message:\n                          type: object\n                          properties:\n                            role:\n                              type: string\n                            content:\n                              type: string\n                          required:\n                            - role\n                            - content\n                          x-apifox-orders:\n                            - role\n                            - content\n                        finish_reason:\n                          type: string\n                      x-apifox-orders:\n                        - index\n                        - message\n                        - finish_reason\n                  usage:\n                    type: object\n                    properties:\n                      prompt_tokens:\n                        type: integer\n                      completion_tokens:\n                        type: integer\n                      total_tokens:\n                        type: integer\n                    required:\n                      - prompt_tokens\n                      - completion_tokens\n                      - total_tokens\n                    x-apifox-orders:\n                      - prompt_tokens\n                      - completion_tokens\n                      - total_tokens\n                required:\n                  - id\n                  - object\n                  - created\n                  - choices\n                  - usage\n                x-apifox-orders:\n                  - id\n                  - object\n                  - created\n                  - choices\n                  - usage\n              example:\n                id: chatcmpl-123\n                object: chat.completion\n                created: 1677652288\n                choices:\n                  - index: 0\n                    message:\n                      role: assistant\n                      content: |-\n\n\n                        Hello there, how may I assist you today?\n                    finish_reason: stop\n                usage:\n                  prompt_tokens: 9\n                  completion_tokens: 12\n                  total_tokens: 21\n          headers: {}\n          x-apifox-name: OK\n      security: []\n      x-apifox-folder: 模型接口/聊天接口（Chat）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-92222076-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-385209336',
      title: '响应responses接口',
      group: '模型接口',
      category: ['模型接口', '聊天接口（Chat）'],
      method: 'POST',
      path: '/v1/responses',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-385209336.md',
      markdown:
        "# 响应responses接口\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/responses:\n    post:\n      summary: 响应responses接口\n      deprecated: false\n      description: >-\n        创建模型响应。提供文本或图像输入以生成文本或JSON输出。让模型调用您自己的自定义代码，或使用内置工具（如网络搜索或文件输入）将您自己的数据用作模型响应的输入。\n\n        本页面只展示最简答的调用和参数,\n        更详细的文档请查看[官方文档](https://platform.openai.com/docs/api-reference/responses/create)\n      tags:\n        - 模型接口/聊天接口（Chat）\n      parameters:\n        - name: Content-Type\n          in: header\n          description: ''\n          required: false\n          example: application/json\n          schema:\n            type: string\n        - name: Authorization\n          in: header\n          description: ''\n          required: false\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                model:\n                  type: string\n                  title: 模型名\n                  default: gpt-4.1\n                input:\n                  type: string\n                  title: 用于生成响应的模型的文本、图像或文件输入\n                  default: 你好\n              x-apifox-orders:\n                - model\n                - input\n              required:\n                - model\n                - input\n            example:\n              model: gpt-4.1\n              input: 你好\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties: {}\n          headers: {}\n          x-apifox-name: 成功\n      security: []\n      x-apifox-folder: 模型接口/聊天接口（Chat）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-385209336-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-92222077',
      title: '内容补全接口',
      group: '模型接口',
      category: ['模型接口', '自动补全接口（Completions）'],
      method: 'POST',
      path: '/v1/completions',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-92222077.md',
      markdown:
        "# 内容补全接口\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/completions:\n    post:\n      summary: 内容补全接口\n      deprecated: false\n      description: |+\n        给定一个提示，该模型将返回一个或多个预测的完成，并且还可以返回每个位置的替代标记的概率。\n\n        为提供的提示和参数创建完成\n\n      tags:\n        - 模型接口/自动补全接口（Completions）\n      parameters:\n        - name: Authorization\n          in: header\n          description: ''\n          required: true\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: ''\n          required: true\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                model:\n                  type: string\n                  title: ''\n                  description: >-\n                    要使用的模型的 ID。您可以使用[List\n                    models](https://platform.openai.com/docs/api-reference/models/list)\n                    API\n                    来查看所有可用模型，或查看我们的[模型概述](https://platform.openai.com/docs/models/overview)以了解它们的描述。\n                prompt:\n                  type: string\n                  title: ''\n                  description: >-\n                    生成完成的提示，编码为字符串、字符串数组、标记数组或标记数组数组。  请注意，<|endoftext|>\n                    是模型在训练期间看到的文档分隔符，因此如果未指定提示，模型将生成新文档的开头。\n                max_tokens:\n                  type: integer\n                  title: ''\n                  description: >-\n                    完成时生成的最大[令牌](https://platform.openai.com/tokenizer)数。 \n                    您的提示加上的令牌计数`max_tokens`不能超过模型的上下文长度。大多数模型的上下文长度为 2048\n                    个标记（最新模型除外，它支持 4096）。\n                temperature:\n                  type: integer\n                  title: ''\n                  description: >-\n                    使用什么采样温度，介于 0 和 2 之间。较高的值（如 0.8）将使输出更加随机，而较低的值（如\n                    0.2）将使输出更加集中和确定。  我们通常建议改变这个或`top_p`但不是两者。\n                top_p:\n                  type: integer\n                  description: >-\n                    一种替代温度采样的方法，称为核采样，其中模型考虑具有 top_p 概率质量的标记的结果。所以 0.1 意味着只考虑构成前\n                    10% 概率质量的标记。  我们通常建议改变这个或`temperature`但不是两者。\n                'n':\n                  type: integer\n                  description: >-\n                    为每个提示生成多少完成。 \n                    **注意：**因为这个参数会产生很多完成，它会很快消耗你的令牌配额。请谨慎使用并确保您对`max_tokens`和进行了合理的设置`stop`。\n                stream:\n                  type: boolean\n                  title: ''\n                  description: >-\n                    是否回流部分进度。如果设置，令牌将在可用时作为仅数据[服务器发送事件](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format)发送，流由`data:\n                    [DONE]`消息终止。\n                logprobs:\n                  type: 'null'\n                  title: ''\n                  description: >-\n                    包括最有可能标记的对数概率`logprobs`，以及所选标记。例如，如果`logprobs`是 5，API 将返回 5\n                    个最有可能的标记的列表。API 将始终返回采样令牌的\n                    ，因此响应中`logprob`最多可能有元素。`logprobs+1`  的最大值`logprobs`为\n                    5。如果您需要更多，请通过我们的[帮助中心](https://help.openai.com/)联系我们并描述您的用例。\n                stop:\n                  type: string\n                  title: ''\n                  description: API 将停止生成更多令牌的最多 4 个序列。返回的文本将不包含停止序列。\n              required:\n                - model\n              x-apifox-orders:\n                - model\n                - prompt\n                - max_tokens\n                - temperature\n                - top_p\n                - 'n'\n                - stream\n                - logprobs\n                - stop\n            example:\n              model: gpt-3.5-turbo-instruct\n              prompt: Say this is a test\n              max_tokens: 7\n              temperature: 0\n              top_p: 1\n              'n': 1\n              stream: false\n              logprobs: null\n              stop: |+\n\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  id:\n                    type: string\n                  object:\n                    type: string\n                  created:\n                    type: integer\n                  model:\n                    type: string\n                  choices:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        text:\n                          type: string\n                        index:\n                          type: integer\n                        logprobs:\n                          type: 'null'\n                        finish_reason:\n                          type: string\n                      x-apifox-orders:\n                        - text\n                        - index\n                        - logprobs\n                        - finish_reason\n                  usage:\n                    type: object\n                    properties:\n                      prompt_tokens:\n                        type: integer\n                      completion_tokens:\n                        type: integer\n                      total_tokens:\n                        type: integer\n                    required:\n                      - prompt_tokens\n                      - completion_tokens\n                      - total_tokens\n                    x-apifox-orders:\n                      - prompt_tokens\n                      - completion_tokens\n                      - total_tokens\n                required:\n                  - id\n                  - object\n                  - created\n                  - model\n                  - choices\n                  - usage\n                x-apifox-orders:\n                  - id\n                  - object\n                  - created\n                  - model\n                  - choices\n                  - usage\n              example:\n                id: cmpl-uqkvlQyYK7bGYrRHQ0eXlWi7\n                object: text_completion\n                created: 1589478378\n                model: text-davinci-003\n                choices:\n                  - text: |-\n\n\n                      This is indeed a test\n                    index: 0\n                    logprobs: null\n                    finish_reason: length\n                usage:\n                  prompt_tokens: 5\n                  completion_tokens: 7\n                  total_tokens: 12\n          headers: {}\n          x-apifox-name: Ok\n      security: []\n      x-apifox-folder: 模型接口/自动补全接口（Completions）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-92222077-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-230939726',
      title: '图像变化',
      group: '模型接口',
      category: ['模型接口', '图像接口（Images）'],
      method: 'POST',
      path: '/v1/images/variations',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-230939726.md',
      markdown:
        "# 图像变化\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/images/variations:\n    post:\n      summary: 图像变化\n      deprecated: false\n      description: |+\n        创建给定图像的变体。\n\n      tags:\n        - 模型接口/图像接口（Images）\n      parameters:\n        - name: Authorization\n          in: header\n          description: ''\n          required: false\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: ''\n          required: false\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          multipart/form-data:\n            schema:\n              type: object\n              properties:\n                image:\n                  format: binary\n                  type: string\n                  description: 用作变化基础的图像。必须是有效的PNG文件，小于4MB，并且是方形的。\n                  example: ''\n                model:\n                  description: |\n                    用于图像生成的模型。目前仅支持dall-e-2。\n                  example: dall-e-2\n                  type: string\n                size:\n                  description: 生成的图像的大小。必须是256x256、512x512或1024x1024之一。\n                  example: 1024x1024\n                  type: string\n              required:\n                - image\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  created:\n                    type: integer\n                  data:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        url:\n                          type: string\n                      required:\n                        - url\n                      x-apifox-orders:\n                        - url\n                required:\n                  - created\n                  - data\n                x-apifox-orders:\n                  - created\n                  - data\n              example:\n                created: 1589478378\n                data:\n                  - url: https://...\n                  - url: https://...\n          headers: {}\n          x-apifox-name: 成功\n      security: []\n      x-apifox-folder: 模型接口/图像接口（Images）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-230939726-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-230941694',
      title: '图像编辑',
      group: '模型接口',
      category: ['模型接口', '图像接口（Images）'],
      method: 'POST',
      path: '/v1/images/edits',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-230941694.md',
      markdown:
        "# 图像编辑\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/images/edits:\n    post:\n      summary: 图像编辑\n      deprecated: false\n      description: |-\n        在给定原始图像和提示的情况下创建编辑图像。\n        本文档只展示出了一些常用的参数,如需进阶使用请参考官方文档\n        https://platform.openai.com/docs/api-reference/images/createEdit\n      tags:\n        - 模型接口/图像接口（Images）\n      parameters:\n        - name: Authorization\n          in: header\n          description: ''\n          required: false\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: ''\n          required: false\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          multipart/form-data:\n            schema:\n              type: object\n              properties:\n                image:\n                  format: binary\n                  type: string\n                  description: 每张图片应为png、webp或jpg大小不超过 25MB 的文件。您最多可以提供 16 张图片\n                  example: ''\n                prompt:\n                  description: 所需图像的文本描述。最大长度为32000个字符。\n                  example: ''\n                  type: string\n                model:\n                  description: |\n                    用于图像生成的模型。目前仅支持gpt-image-1。\n                  example: gpt-image-1\n                  type: string\n                size:\n                  description: 必须是1024x1024、1536x1024（横向）、1024x1536之一默认为1024x1024\n                  example: 1024x1024\n                  type: string\n              required:\n                - image\n                - prompt\n            examples: {}\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  created:\n                    type: integer\n                  data:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        b64_json:\n                          type: string\n                      x-apifox-orders:\n                        - b64_json\n                      required:\n                        - b64_json\n                  usage:\n                    type: object\n                    properties:\n                      total_tokens:\n                        type: integer\n                      input_tokens:\n                        type: integer\n                      output_tokens:\n                        type: integer\n                      input_tokens_details:\n                        type: object\n                        properties:\n                          text_tokens:\n                            type: integer\n                          image_tokens:\n                            type: integer\n                        required:\n                          - text_tokens\n                          - image_tokens\n                        x-apifox-orders:\n                          - text_tokens\n                          - image_tokens\n                    required:\n                      - total_tokens\n                      - input_tokens\n                      - output_tokens\n                      - input_tokens_details\n                    x-apifox-orders:\n                      - total_tokens\n                      - input_tokens\n                      - output_tokens\n                      - input_tokens_details\n                required:\n                  - created\n                  - data\n                  - usage\n                x-apifox-orders:\n                  - created\n                  - data\n                  - usage\n              example:\n                created: 1713833628\n                data:\n                  - b64_json: ...\n                usage:\n                  total_tokens: 100\n                  input_tokens: 50\n                  output_tokens: 50\n                  input_tokens_details:\n                    text_tokens: 10\n                    image_tokens: 40\n          headers: {}\n          x-apifox-name: 成功\n      security: []\n      x-apifox-folder: 模型接口/图像接口（Images）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-230941694-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-92222078',
      title: '创建图像',
      group: '模型接口',
      category: ['模型接口', '图像接口（Images）'],
      method: 'POST',
      path: '/v1/images/generations',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-92222078.md',
      markdown:
        "# 创建图像\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/images/generations:\n    post:\n      summary: 创建图像\n      deprecated: false\n      description: |+\n        [图片](https://platform.openai.com/docs/api-reference/images)\n\n        给定提示和/或输入图像，模型将生成新图像。\n\n        相关指南：[图像生成](https://platform.openai.com/docs/guides/images)\n\n        根据提示创建图像。\n\n      tags:\n        - 模型接口/图像接口（Images）\n      parameters:\n        - name: Authorization\n          in: header\n          description: ''\n          required: true\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: ''\n          required: true\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                prompt:\n                  type: string\n                  description: 所需图像的文本描述。最大长度为 1000 个字符。\n                'n':\n                  type: integer\n                  description: 要生成的图像数。必须介于 1 和 10 之间。\n                model:\n                  type: string\n                  description: 模型名称dall-e-3,dall-e-2,gpt-image-1\n                size:\n                  type: string\n                  description: 生成图像的大小。必须是256x256、512x512或 之一1024x1024, 1024x1792。\n                quality:\n                  type: string\n                  description: 如果过调用hd 此处填hd\n                  examples:\n                    - hd\n              required:\n                - prompt\n                - 'n'\n                - model\n                - size\n              x-apifox-orders:\n                - prompt\n                - 'n'\n                - size\n                - model\n                - quality\n            example:\n              prompt: A colorful sunset over the mountains\n              'n': 1\n              model: dall-e-3\n              size: 1024x1024\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  created:\n                    type: integer\n                  data:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        url:\n                          type: string\n                      required:\n                        - url\n                      x-apifox-orders:\n                        - url\n                required:\n                  - created\n                  - data\n                x-apifox-orders:\n                  - created\n                  - data\n              example:\n                created: 1589478378\n                data:\n                  - url: https://...\n                  - url: https://...\n          headers: {}\n          x-apifox-name: Create image\n      security: []\n      x-apifox-folder: 模型接口/图像接口（Images）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-92222078-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-92222081',
      title: '创建嵌入',
      group: '模型接口',
      category: ['模型接口', '向量生成接口（Embeddings）'],
      method: 'POST',
      path: '/v1/embeddings',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-92222081.md',
      markdown:
        '# 创建嵌入\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: \'\'\n  description: \'\'\n  version: 1.0.0\npaths:\n  /v1/embeddings:\n    post:\n      summary: 创建嵌入\n      deprecated: false\n      description: |+\n        获取给定输入的矢量表示，机器学习模型和算法可以轻松使用该表示。\n\n        相关指南：[嵌入](https://platform.openai.com/docs/guides/embeddings)\n\n        创建表示输入文本的嵌入向量。\n\n      tags:\n        - 模型接口/向量生成接口（Embeddings）\n      parameters:\n        - name: Authorization\n          in: header\n          description: \'\'\n          required: true\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: \'\'\n          required: true\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                model:\n                  type: string\n                  description: >-\n                    要使用的模型的 ID。您可以使用[List\n                    models](https://platform.openai.com/docs/api-reference/models/list)\n                    API\n                    来查看所有可用模型，或查看我们的[模型概述](https://platform.openai.com/docs/models/overview)以了解它们的描述。\n                input:\n                  type: string\n                  description: >-\n                    输入文本以获取嵌入，编码为字符串或标记数组。要在单个请求中获取多个输入的嵌入，请传递一个字符串数组或令牌数组数组。每个输入的长度不得超过\n                    8192 个标记。\n              required:\n                - model\n                - input\n              x-apifox-orders:\n                - model\n                - input\n            example:\n              model: text-embedding-ada-002\n              input: The food was delicious and the waiter...\n      responses:\n        \'200\':\n          description: \'\'\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  object:\n                    type: string\n                  data:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        object:\n                          type: string\n                        embedding:\n                          type: array\n                          items:\n                            type: number\n                        index:\n                          type: integer\n                      x-apifox-orders:\n                        - object\n                        - embedding\n                        - index\n                  model:\n                    type: string\n                  usage:\n                    type: object\n                    properties:\n                      prompt_tokens:\n                        type: integer\n                      total_tokens:\n                        type: integer\n                    required:\n                      - prompt_tokens\n                      - total_tokens\n                    x-apifox-orders:\n                      - prompt_tokens\n                      - total_tokens\n                required:\n                  - object\n                  - data\n                  - model\n                  - usage\n                x-apifox-orders:\n                  - object\n                  - data\n                  - model\n                  - usage\n              example: |-\n                {\n                  "object": "list",\n                  "data": [\n                    {\n                      "object": "embedding",\n                      "embedding": [\n                        0.0023064255,\n                        -0.009327292,\n                        .... (1536 floats total for ada-002)\n                        -0.0028842222\n                      ],\n                      "index": 0\n                    }\n                  ],\n                  "model": "text-embedding-ada-002",\n                  "usage": {\n                    "prompt_tokens": 8,\n                    "total_tokens": 8\n                  }\n                }\n          headers: {}\n          x-apifox-name: Create embeddings\n      security: []\n      x-apifox-folder: 模型接口/向量生成接口（Embeddings）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-92222081-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n',
    },
    {
      id: 'api-123375854',
      title: 'tts文本转语音',
      group: '模型接口',
      category: ['模型接口', '音频接口（Audio）'],
      method: 'POST',
      path: '/v1/audio/speech',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-123375854.md',
      markdown:
        "# tts文本转语音\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/audio/speech:\n    post:\n      summary: tts文本转语音\n      deprecated: false\n      description: |\n        了解如何将文本转换为音频。\n\n        相关指南：[本转换为音频](https://platform.openai.com/docs/guides/text-to-speech)\n\n        将输入文本转录为音频。\n      tags:\n        - 模型接口/音频接口（Audio）\n      parameters:\n        - name: Authorization\n          in: header\n          description: ''\n          required: true\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: ''\n          required: true\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                model:\n                  type: string\n                  description: 要使用的模型的 ID (tts-1, tts-1-hd)\n                input:\n                  type: string\n                  description: 要输出的文本\n                voice:\n                  type: string\n                  description: 语音选项不同声音ID(alloy, echo, fable, onyx, nova, shimmer)\n              required:\n                - input\n                - voice\n                - model\n              x-apifox-orders:\n                - model\n                - input\n                - voice\n            example:\n              model: tts-1\n              input: The quick brown fox jumped over the lazy dog.\n              voice: alloy\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties: {}\n          headers: {}\n          x-apifox-name: 成功\n      security: []\n      x-apifox-folder: 模型接口/音频接口（Audio）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-123375854-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-92222082',
      title: '创建转录',
      group: '模型接口',
      category: ['模型接口', '音频接口（Audio）'],
      method: 'POST',
      path: '/v1/audio/transcriptions',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-92222082.md',
      markdown:
        "# 创建转录\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/audio/transcriptions:\n    post:\n      summary: 创建转录\n      deprecated: false\n      description: |+\n        了解如何将音频转换为文本。\n\n        相关指南：[语音转文本](https://platform.openai.com/docs/guides/speech-to-text)\n\n        将音频转录为输入语言。\n\n      tags:\n        - 模型接口/音频接口（Audio）\n      parameters:\n        - name: Content-Type\n          in: header\n          description: ''\n          required: true\n          example: multipart/form-data\n          schema:\n            type: string\n        - name: Authorization\n          in: header\n          description: ''\n          required: true\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n      requestBody:\n        content:\n          multipart/form-data:\n            schema:\n              type: object\n              properties:\n                file:\n                  description: 要转录的音频文件，采用以下格式之一：mp3、mp4、mpeg、mpga、m4a、wav 或 webm。\n                  type: string\n                  format: binary\n                model:\n                  description: 要使用的模型的 ID。仅`whisper-1`当前可用。\n                  example: whisper-1\n                  type: string\n                prompt:\n                  description: >-\n                    可选文本，用于指导模型的风格或继续之前的音频片段。提示应[与](https://platform.openai.com/docs/guides/speech-to-text/prompting)音频语言相匹配。\n                  example: eiusmod nulla\n                  type: string\n                response_format:\n                  description: 成绩单输出的格式，采用以下选项之一：json、text、srt、verbose_json 或 vtt。\n                  example: json\n                  type: string\n                temperature:\n                  description: >+\n                    采样温度，介于 0 和 1 之间。较高的值（如 0.8）将使输出更加随机，而较低的值（如\n                    0.2）将使输出更加集中和确定。如果设置为\n                    0，模型将使用[对数概率](https://en.wikipedia.org/wiki/Log_probability)自动升高温度，直到达到特定阈值。\n\n                  example: 0\n                  type: number\n                language:\n                  description: >+\n                    输入音频的语言。[以ISO-639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)格式提供输入语言将提高准确性和延迟。\n\n                  example: ''\n                  type: string\n              required:\n                - file\n                - model\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  text:\n                    type: string\n                required:\n                  - text\n                x-apifox-orders:\n                  - text\n              example:\n                text: >-\n                  Imagine the wildest idea that you've ever had, and you're\n                  curious about how it might scale to something that's a 100, a\n                  1,000 times bigger. This is a place where you can get to do\n                  that.\n          headers: {}\n          x-apifox-name: OK\n      security: []\n      x-apifox-folder: 模型接口/音频接口（Audio）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-92222082-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-92222083',
      title: '创建翻译',
      group: '模型接口',
      category: ['模型接口', '音频接口（Audio）'],
      method: 'POST',
      path: '/v1/audio/translations',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-92222083.md',
      markdown:
        "# 创建翻译\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/audio/translations:\n    post:\n      summary: 创建翻译\n      deprecated: false\n      description: |+\n        将音频翻译成英文。\n\n      tags:\n        - 模型接口/音频接口（Audio）\n      parameters:\n        - name: Content-Type\n          in: header\n          description: ''\n          required: true\n          example: multipart/form-data\n          schema:\n            type: string\n        - name: Authorization\n          in: header\n          description: ''\n          required: true\n          example: Bearer {{YOUR_API_KEY}}\n          schema:\n            type: string\n      requestBody:\n        content:\n          multipart/form-data:\n            schema:\n              type: object\n              properties:\n                file:\n                  description: ' 要翻译的音频文件，支持以下格式：mp3，mp4，mpeg，mpga，m4a，wav 或 webm。'\n                  type: string\n                  format: binary\n                model:\n                  description: (要使用的模型的 ID，目前仅有 whisper-1 可用。\n                  example: whisper-1\n                  type: string\n                prompt:\n                  description: 一个可选的文本，用于指导模型的风格或继续先前的音频片段。 prompt 应为英文。\n                  example: ''\n                  type: string\n                response_format:\n                  description: 转录输出的格式，支持以下选项之一：json、text、srt、verbose_json 或 vtt。\n                  example: json\n                  type: string\n                temperature:\n                  description: >-\n                    采样温度，介于 0 和 1 之间。 较高的值（如 0.8）将使输出更随机，而较低的值（如\n                    0.2）将使其更加专注和确定性。 如果设置为 0，则模型将使用对数概率自动增加温度，直到达到一定的阈值。\n                  example: 0\n                  type: number\n              required:\n                - file\n                - model\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  text:\n                    type: string\n                required:\n                  - text\n                x-apifox-orders:\n                  - text\n              example:\n                text: >-\n                  Hello, my name is Wolfgang and I come from Germany. Where are\n                  you heading today?\n          headers: {}\n          x-apifox-name: OK\n      security: []\n      x-apifox-folder: 模型接口/音频接口（Audio）\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-92222083-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
    {
      id: 'api-165664739',
      title: '查询用量详情（小时粒度）',
      group: '模型接口',
      category: ['模型接口', '查询接口'],
      method: 'POST',
      path: '/v1/query/usage_details',
      sourceUrl: 'https://chatanywhere.apifox.cn/api-165664739.md',
      markdown:
        "# 查询用量详情（小时粒度）\n\n## OpenAPI Specification\n\n```yaml\nopenapi: 3.0.1\ninfo:\n  title: ''\n  description: ''\n  version: 1.0.0\npaths:\n  /v1/query/usage_details:\n    post:\n      summary: 查询用量详情（小时粒度）\n      deprecated: false\n      description: ''\n      tags:\n        - 模型接口/查询接口\n      parameters:\n        - name: Authorization\n          in: header\n          description: ''\n          required: false\n          example: '{{YOUR_API_KEY}}'\n          schema:\n            type: string\n        - name: Content-Type\n          in: header\n          description: ''\n          required: false\n          example: application/json\n          schema:\n            type: string\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n              properties:\n                model:\n                  type: string\n                  description: 模型名称，支持模式匹配\n                hours:\n                  type: integer\n                  description: 查询时间跨度，查询hours小时前到现在为止的数据\n              required:\n                - model\n                - hours\n              x-apifox-orders:\n                - model\n                - hours\n            example:\n              model: gpt-3.5-turbo%\n              hours: 24\n      responses:\n        '200':\n          description: ''\n          content:\n            application/json:\n              schema:\n                type: array\n                items:\n                  type: object\n                  properties:\n                    time:\n                      type: string\n                    promptTokens:\n                      type: integer\n                    completionTokens:\n                      type: integer\n                    totalTokens:\n                      type: integer\n                    count:\n                      type: integer\n                    cost:\n                      type: integer\n                  required:\n                    - time\n                    - promptTokens\n                    - completionTokens\n                    - totalTokens\n                    - count\n                    - cost\n                  x-apifox-orders:\n                    - time\n                    - promptTokens\n                    - completionTokens\n                    - totalTokens\n                    - count\n                    - cost\n              example:\n                - time: '2024-04-17 00:00:00'\n                  promptTokens: 18\n                  completionTokens: 34\n                  totalTokens: 52\n                  count: 2\n                  cost: 0\n                - time: '2024-04-17 01:00:00'\n                  promptTokens: 35\n                  completionTokens: 55\n                  totalTokens: 90\n                  count: 4\n                  cost: 0.01\n          headers: {}\n          x-apifox-name: 成功\n      security: []\n      x-apifox-folder: 模型接口/查询接口\n      x-apifox-status: released\n      x-run-in-apifox: https://app.apifox.com/web/project/2946232/apis/api-165664739-run\ncomponents:\n  schemas: {}\n  securitySchemes: {}\nservers:\n  - url: https://moapi.moshanjun.com\n    description: 正式环境\nsecurity: []\n\n```\n",
    },
  ],
  tree: [
    {
      title: '帮助中心',
      items: ['doc-5547696'],
    },
    {
      title: '模型接口',
      items: [
        'doc-2664688',
        {
          title: '模型（Models）',
          items: ['api-92222074'],
        },
        {
          title: '聊天接口（Chat）',
          items: ['api-92222076', 'api-385209336'],
        },
        {
          title: '自动补全接口（Completions）',
          items: ['api-92222077'],
        },
        {
          title: '图像接口（Images）',
          items: ['api-230939726', 'api-230941694', 'api-92222078'],
        },
        {
          title: '向量生成接口（Embeddings）',
          items: ['api-92222081'],
        },
        {
          title: '音频接口（Audio）',
          items: ['api-123375854', 'api-92222082', 'api-92222083'],
        },
        {
          title: '查询接口',
          items: ['api-165664739'],
        },
      ],
    },
  ],
  aliases: {
    models: 'api-92222074',
    'api-92222074.md': 'api-92222074',
    transcriptions: 'api-92222082',
    transcription: 'api-92222082',
    'api-92222082.md': 'api-92222082',
  },
};

const resolveDocOverride = (doc) => {
  const override = docsOverrides[doc.id] || {};

  if (typeof override.markdown === 'function') {
    return {
      ...override,
      markdown: override.markdown(doc.markdown),
    };
  }

  return override;
};

export const docs = docsPayload.docs
  .filter((doc) => !hiddenDocIds.has(doc.id))
  .map((doc) => ({
    ...doc,
    ...resolveDocOverride(doc),
  }));
export const docsTree = docsPayload.tree.map((section) => ({
  ...section,
  items: section.items.filter((item) =>
    typeof item === 'string' ? !hiddenDocIds.has(item) : true,
  ),
}));
export const docsAliases = docsPayload.aliases;
export const docsById = Object.fromEntries(docs.map((doc) => [doc.id, doc]));
export const defaultDocId = 'api-92222082';
export { docsBaseUrl };
