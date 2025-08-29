# 使用说明

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
