# 本地测试：经 new-api 中转调用豆包 OpenSpeech TTS（HTTP V3）

本文说明在本地（例如 `http://127.0.0.1:3000`）如何用 **OpenAI 兼容接口** `POST /v1/audio/speech` 测试 **火山 VolcEngine 渠道 + OpenSpeech V3（单向 NDJSON）** 中转。

## 前置条件

1. **new-api 已启动**，对外地址示例：`http://127.0.0.1:3000`（端口以你实际为准）。
2. 已在后台创建 **类型为 VolcEngine（45）** 的渠道，且：
   - **API 地址** 为 `openspeech-tts-v3` 或完整地址  
     `https://openspeech.bytedance.com/api/v3/tts/unidirectional`
   - **密钥** 格式：`APPID|ACCESS_TOKEN`（与火山豆包语音控制台「语音应用」一致）
3. 该渠道已为你的用户分组开通 **模型名**（例如 `doubao-tts-v3` 或 `tts-1`），且与下文请求里的 `model` 字段一致。
4. 准备 **new-api 令牌**（用户令牌或 API 令牌，一般以 `sk-` 开头），仅用于访问你的网关，**不要**与火山密钥混用。

## 接口说明

| 项目 | 值 |
|------|-----|
| URL | `{BASE}/v1/audio/speech` |
| 方法 | `POST` |
| 鉴权 | `Authorization: Bearer <你的 new-api 令牌>` |
| 请求体 | `Content-Type: application/json`，OpenAI Speech 格式 |

### 请求体字段（与 V3 中转相关）

| 字段 | 说明 |
|------|------|
| `model` | 必须与渠道里启用的模型名一致（用于选路与计费）。 |
| `input` | 要合成的文本。 |
| `voice` | 对应火山 V3 的 **speaker**（须与 `resource_id` 在官方音色表里成对）。 |
| `response_format` | 建议 `mp3`（网关会映射为 V3 `audio_params.format`）。 |
| `metadata` | **JSON 对象**，可含 `resource_id`（默认 `seed-tts-2.0`）。示例：`{"resource_id":"seed-tts-2.0"}` |

### 成功响应

- HTTP `200`
- `Content-Type` 一般为 `audio/mpeg`（mp3 时）
- Body 为 **完整二进制音频**（网关已把 NDJSON 分片拼好）

### 失败响应

- 一般为 JSON，`error.message` 中含网关或上游错误说明。

## cURL 示例

将 `BASE`、`TOKEN` 换成你的值；`model`、`voice`、`metadata` 按后台配置调整。

```bash
BASE="http://127.0.0.1:3000"
TOKEN="sk-你的new-api令牌"

curl -sS "$BASE/v1/audio/speech" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-tts-v3",
    "input": "你好，这是经 new-api 中转的豆包语音合成测试。",
    "voice": "zh_female_vv_uranus_bigtts",
    "response_format": "mp3",
    "metadata": { "resource_id": "seed-tts-2.0" }
  }' \
  --output speech.mp3
```

### Windows（必读）

PowerShell 里 **`curl` 默认是 `Invoke-WebRequest` 的别名**，参数与真正 curl 不一致，容易把**错误 JSON/HTML** 存成 `speech.mp3`，播放器会提示无法识别。

请使用 **系统自带的 curl 可执行文件**：

```powershell
curl.exe -sS -w "`nhttp_code=%{http_code}`n" "http://127.0.0.1:3000/v1/audio/speech" `
  -H "Authorization: Bearer sk-你的令牌" `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"doubao-tts-v3\",\"input\":\"你好测试\",\"voice\":\"zh_female_vv_uranus_bigtts\",\"response_format\":\"mp3\",\"metadata\":{\"resource_id\":\"seed-tts-2.0\"}}" `
  --output speech.mp3
```

更稳妥：把 JSON 存成文件再发（避免转义出错）：

```powershell
@'
{"model":"doubao-tts-v3","input":"你好，测试。","voice":"zh_female_vv_uranus_bigtts","response_format":"mp3","metadata":{"resource_id":"seed-tts-2.0"}}
'@ | Set-Content -Encoding utf8 body.json

curl.exe -sS -w "`nhttp_code=%{http_code}`n" "http://127.0.0.1:3000/v1/audio/speech" `
  -H "Authorization: Bearer sk-你的令牌" `
  -H "Content-Type: application/json" `
  -d "@body.json" `
  --output speech.mp3
```

### 排错：MP3「无法识别」

1. 看 **HTTP 状态码**：`curl.exe -w "\n%{http_code}\n"` 或加 `-i`；非 200 时 `--output` 里多半是 **JSON 错误**，不是音频。  
2. 看文件头：合法 MP3 常见以 **`ID3`** 或十六进制 **`ff fb` / `ff f3`** 开头；若以 **`{`** 开头则是 JSON。  
3. 确认渠道 **API 地址** 已设为 `openspeech-tts-v3`（或完整 V3 URL），否则会走其它路径，响应可能不是预期二进制。

## Node.js 示例

见仓库内示例脚本：`docs/examples/relay-tts-speech-test.mjs`。

```bash
set NEW_API_BASE=http://127.0.0.1:3000
set NEW_API_TOKEN=sk-你的new-api令牌
node docs/examples/relay-tts-speech-test.mjs
```

（Linux / macOS 使用 `export`。）

## 安全提示

- **切勿**把 new-api 令牌或火山 `APPID|TOKEN` 提交到 Git 或公开截图。
- 若令牌已泄露，请在 new-api 后台 **作废并重新生成**。

## 相关代码位置

- 路由：`router/relay-router.go` → `POST /v1/audio/speech`
- VolcEngine V3：`relay/channel/volcengine/tts_v3.go`、`relay/channel/volcengine/adaptor.go`
- 占位 Base URL 常量：`constant.VolcEngineOpenSpeechTTSV3BaseURL`
