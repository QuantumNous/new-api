# CustomPass API 文档

本文档详细说明CustomPass渠道的API接口、请求格式、响应格式和使用方法。

## 概述

CustomPass通过标准的OpenAI兼容接口提供服务，支持同步和异步两种调用模式。所有请求都会经过预扣费、参数透传、上游调用和结算的完整流程。

## 基础信息

- **基础URL**: `https://your-api.com/v1`
- **认证方式**: Bearer Token
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## 同步API

### 请求格式

```http
POST /v1/chat/completions
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "model-name",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 1000,
  ...
}
```

### 响应格式

#### 成功响应

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

#### 错误响应

```json
{
  "error": {
    "message": "Insufficient quota",
    "type": "quota_exceeded",
    "code": "insufficient_quota"
  }
}
```

### 预扣费机制

CustomPass会自动处理预扣费流程：

1. **第一次请求**: 发送预扣费请求到上游，获取usage估算
2. **预扣费**: 根据估算扣除用户quota
3. **实际请求**: 发送真实请求到上游
4. **结算**: 根据实际usage进行多退少补

用户无需关心预扣费细节，整个过程对用户透明。

## 异步API

### 任务提交

异步模型名称必须以`/submit`结尾。

#### 请求格式

```http
POST /v1/chat/completions
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "custom-image-gen/submit",
  "prompt": "A beautiful sunset over mountains",
  "size": "1024x1024",
  "quality": "high"
}
```

#### 响应格式

```json
{
  "id": "task-550e8400-e29b-41d4-a716-446655440000",
  "object": "task.submission",
  "created": 1677652288,
  "model": "custom-image-gen/submit",
  "status": "submitted",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 0,
    "total_tokens": 10
  }
}
```

### 任务查询

任务提交后，系统会自动轮询任务状态。用户可以通过任务管理页面查看任务进度和结果。

#### 任务状态

- `submitted`: 已提交，等待处理
- `processing`: 处理中
- `completed`: 已完成
- `failed`: 处理失败

#### 任务结果

任务完成后，结果会保存在任务记录中，包括：
- 最终输出结果
- 实际token使用量
- 处理时间信息
- 错误信息（如果失败）

## 支持的参数

### 通用参数

所有传递给CustomPass的参数都会透传到上游API，包括但不限于：

#### 文本生成参数
```json
{
  "model": "string",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 0.9,
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0,
  "stop": ["string"],
  "stream": false
}
```

#### 图像生成参数
```json
{
  "model": "custom-image-gen/submit",
  "prompt": "string",
  "size": "1024x1024",
  "quality": "high",
  "style": "natural",
  "n": 1
}
```

#### 音频生成参数
```json
{
  "model": "custom-audio-gen/submit",
  "prompt": "string",
  "duration": 30,
  "format": "mp3",
  "quality": "high"
}
```

### 自定义参数

CustomPass支持透传任意自定义参数：

```json
{
  "model": "custom-model",
  "custom_param_1": "value1",
  "custom_param_2": {
    "nested": "value"
  },
  "custom_array": [1, 2, 3]
}
```

## 认证和授权

### API密钥认证

```http
Authorization: Bearer sk-your-api-key-here
```

### 自定义Token传递

CustomPass会自动将用户token传递给上游API：

```http
# 发送到上游的请求头
Authorization: Bearer channel-api-key
X-Custom-Token: user-api-key
```

自定义token头名称可以通过渠道配置或环境变量设置：

- 渠道配置优先级最高
- 环境变量`CUSTOM_PASS_HEADER_KEY`
- 默认使用`X-Custom-Token`

## 计费说明

### 计费模式

CustomPass支持三种计费模式：

#### 1. 免费模式
- 模型未在ability中配置
- 不扣除quota，不记录消费日志

#### 2. 按量计费
- 模型配置了倍率但未配置固定价格
- 根据实际token使用量计费
- 公式：`费用 = 基础价格 × 模型倍率 × 分组倍率 × 用户倍率`

#### 3. 按次计费
- 模型配置了固定价格
- 每次调用扣除固定费用
- 不考虑token使用量

### 计费流程

1. **预扣费**: 根据估算usage预先扣除quota
2. **实际调用**: 发送请求到上游API
3. **结算**: 根据实际usage计算最终费用
4. **多退少补**: 退还多扣的quota或补扣不足的quota
5. **记录日志**: 记录详细的消费日志

## 错误处理

### 错误类型

#### 1. 认证错误
```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

#### 2. 余额不足
```json
{
  "error": {
    "message": "Insufficient quota",
    "type": "quota_exceeded",
    "code": "insufficient_quota"
  }
}
```

#### 3. 上游API错误
```json
{
  "error": {
    "message": "Upstream API error: Model not found",
    "type": "upstream_error",
    "code": "model_not_found"
  }
}
```

#### 4. 配置错误
```json
{
  "error": {
    "message": "Channel configuration error",
    "type": "configuration_error",
    "code": "invalid_config"
  }
}
```

#### 5. 系统错误
```json
{
  "error": {
    "message": "Internal server error",
    "type": "server_error",
    "code": "internal_error"
  }
}
```

### 重试机制

- **网络错误**: 自动重试最多3次
- **临时错误**: 指数退避重试
- **永久错误**: 不重试，直接返回错误

## 限制和约束

### 请求限制

- **请求大小**: 最大32MB
- **超时时间**: 同步请求30秒，异步任务提交10秒
- **并发限制**: 根据用户等级和配置动态调整

### 模型限制

- **同步模型**: 支持任意模型名称
- **异步模型**: 必须以`/submit`结尾
- **模型映射**: 支持通过渠道配置进行模型名称映射

### 任务限制

- **任务生命周期**: 默认1小时，可配置
- **轮询频率**: 默认30秒，可配置
- **批量查询**: 单次最多50个任务

## 最佳实践

### 1. 错误处理

```javascript
async function callCustomPass(payload) {
  try {
    const response = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer your-api-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('CustomPass API call failed:', error);
    throw error;
  }
}
```

### 2. 异步任务处理

```javascript
async function submitAsyncTask(payload) {
  // 提交任务
  const response = await callCustomPass({
    model: 'custom-image-gen/submit',
    ...payload
  });
  
  const taskId = response.id;
  console.log(`Task submitted: ${taskId}`);
  
  // 任务会自动在后台处理，可以通过任务管理页面查看进度
  return taskId;
}
```

### 3. 参数优化

```javascript
// 优化token使用量
const optimizedPayload = {
  model: 'gpt-4',
  messages: messages,
  max_tokens: 500,        // 限制输出长度
  temperature: 0.7,       // 平衡创造性和一致性
  top_p: 0.9,            // 核采样
  frequency_penalty: 0.1, // 减少重复
  presence_penalty: 0.1   // 鼓励多样性
};
```

## 监控和调试

### 日志记录

所有CustomPass请求都会记录详细日志：

- 请求参数和响应
- 预扣费和结算信息
- 上游API调用详情
- 错误信息和堆栈跟踪

### 性能监控

- 请求响应时间
- 成功率和错误率
- 并发连接数
- 资源使用情况

### 调试工具

- 任务管理页面查看任务状态
- 日志页面查看详细调用记录
- 渠道测试功能验证配置
- Mock服务器进行本地测试

## 示例代码

### Python示例

```python
import requests
import json

def call_custompass_sync(model, messages, **kwargs):
    """调用同步API"""
    url = "https://your-api.com/v1/chat/completions"
    headers = {
        "Authorization": "Bearer your-api-key",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model,
        "messages": messages,
        **kwargs
    }
    
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    
    return response.json()

def submit_async_task(model, **kwargs):
    """提交异步任务"""
    if not model.endswith('/submit'):
        model += '/submit'
    
    url = "https://your-api.com/v1/chat/completions"
    headers = {
        "Authorization": "Bearer your-api-key",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model,
        **kwargs
    }
    
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    
    return response.json()

# 使用示例
if __name__ == "__main__":
    # 同步调用
    result = call_custompass_sync(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}],
        temperature=0.7
    )
    print("Sync result:", result)
    
    # 异步任务
    task = submit_async_task(
        model="custom-image-gen",
        prompt="A beautiful sunset",
        size="1024x1024"
    )
    print("Task submitted:", task['id'])
```

### Node.js示例

```javascript
const axios = require('axios');

class CustomPassClient {
  constructor(apiKey, baseURL = 'https://your-api.com/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  async callSync(model, messages, options = {}) {
    try {
      const response = await this.client.post('/chat/completions', {
        model,
        messages,
        ...options
      });
      return response.data;
    } catch (error) {
      throw new Error(`CustomPass API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
  
  async submitTask(model, options = {}) {
    if (!model.endsWith('/submit')) {
      model += '/submit';
    }
    
    try {
      const response = await this.client.post('/chat/completions', {
        model,
        ...options
      });
      return response.data;
    } catch (error) {
      throw new Error(`CustomPass task submission error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

// 使用示例
async function example() {
  const client = new CustomPassClient('your-api-key');
  
  try {
    // 同步调用
    const result = await client.callSync('gpt-4', [
      { role: 'user', content: 'Hello, world!' }
    ], { temperature: 0.7 });
    
    console.log('Sync result:', result);
    
    // 异步任务
    const task = await client.submitTask('custom-image-gen', {
      prompt: 'A beautiful sunset over mountains',
      size: '1024x1024'
    });
    
    console.log('Task submitted:', task.id);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

example();
```

## 常见问题

### Q: 如何区分同步和异步模型？
A: 异步模型名称必须以`/submit`结尾，同步模型则不需要。

### Q: 预扣费是如何工作的？
A: 系统会先发送预扣费请求获取usage估算，预扣相应quota，然后发送实际请求，最后根据实际usage进行结算。

### Q: 如何处理上游API的错误？
A: CustomPass会透传上游API的错误信息，同时添加适当的错误处理和重试机制。

### Q: 支持流式响应吗？
A: 目前CustomPass主要支持非流式响应，流式响应的支持正在开发中。

### Q: 如何监控API使用情况？
A: 可以通过任务管理页面、日志页面和监控面板查看详细的使用情况和性能指标。