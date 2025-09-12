# 使用说明

## 服务架构和调度策略

为了提供较大的RPM（每分钟请求数），服务端持有一个大的号池，采用多厂商渠道调度策略：

### GPT模型调度优先级
- **Azure** → **OpenAI官方**
- 调用时会优先使用Azure渠道，Azure不可用时自动切换到OpenAI官方

### 各厂商调度优先级
- **Gemini**: Vertex → GCP
- **GPT**: Azure → OpenAI
- **Claude**: AWS → Anthropic  
- **Doubao**: 火山方舟

### 注意事项

#### 1. 第三方渠道模型参数限制
各第三方渠道（Azure、Vertex、AWS等）的部分模型参数可能不支持，遇到此类情况：
- 建议使用前进行小量测试和效果验证，确保参数支持
- 如有确实效果问题，必须优先调度官方，可联系支持

#### 2. 模型版本差异
**所有多供应商渠道都存在此问题**：第三方渠道和官方的不带日期版本模型名对应的具体版本可能不一致：

**GPT示例**：
- Azure上：`gpt-4o-audio-preview` → `gpt-4o-audio-preview-2024-12-17`
- 官方上：`gpt-4o-audio-preview` → `gpt-4o-audio-preview-2025-06-03`


**建议**：如需调用特定版本，请使用带明确版本号的模型名。


## 超时时间设置

统一使用30分钟作为超时时间设置。

## 可用性和重试

由于各家官方可能会不定期封禁号源，因此可用性在官方封禁期间会有一些影响，可能是抖动或者彻底不可用。

建议的重试时间间隔和次数可以相对设多一些，比如10分钟重试一次，重试10次，这样整体的兜底时间差不多2小时，一般常规封号情况都会在这个时间内解决。
非常规情况请联系支持。

## 各个厂商官方SDK使用办法

### OpenAI

```python
from openai import OpenAI
import base64

# 初始化 client，传入 api_key 和自定义 base_url
client = OpenAI(
    api_key="sk-xxxx",
    base_url="https://www.furion-tech.com/v1/"
)
```

### Google Gemini

```python
import os
import google.generativeai as genai

# 设置环境变量
os.environ['GOOGLE_API_KEY'] = "sk-xxxx"
os.environ['GOOGLE_GEMINI_BASE_URL'] = "https://www.furion-tech.com/"

# 初始化 Gemini 客户端
client = genai.Client()
```
