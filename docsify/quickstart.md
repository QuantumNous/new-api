# 快速上手

三步开始使用 61kj GPT 服务。

1. **注册并登录**
访问 61kj 平台，注册你的账号并完成登录。

2. **充值额度**
在控制台中为账号充值额度，支持多种支付方式。

3. **创建令牌**
在「令牌管理」中创建 API Key，配置所需的模型权限。

## 使用示例

创建令牌后，即可像使用 OpenAI API 一样调用：

```bash
curl http://61kj.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-token-here" \
  -d '{
    "model": "gpt-5.4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

<div class="callout tip">
  <div class="callout-icon">💡</div>
  <div class="callout-content">
    <p><strong>提示：</strong>将 <code>http://61kj.top</code> 作为 Base URL，替换原始的 OpenAI 地址即可。令牌以 <code>sk-</code> 开头。</p>
  </div>
</div>

## Python 示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-token-here",
    base_url="http://61kj.top/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

## Node.js 示例

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-token-here',
  baseURL: 'http://61kj.top/v1',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);
```
