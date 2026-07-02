# 操练场不支持模型的提示弹框设计

> 适用项目：new-api（fork）
> 模块定位：**操练场（Playground）选中非 chat 类模型时，弹框提示并给出 curl 示例，不发请求**
> 日期：2026-05-18

## 1. 背景

操练场（`/playground`）目前仅通过 `/pg/chat/completions` 调试 chat / multimodal chat 类模型，state 与 hooks 全部围绕 messages / temperature / top_p 设计。

随着后端持续接入图像生成（dall-e、gpt-image）、视频生成（Sora、MiniMax 系、Doubao Seedance）、embeddings、rerank 等模型，用户在操练场模型下拉里能选到这些非 chat 模型，但点击发送后会发到 `/pg/chat/completions`，导致后端报错或返回不符合预期。

**根本决策**：操练场只覆盖 chat 类调试场景。非 chat 模型在提交前拦截，弹框提示用户直接调用 API，**不**为图像 / 视频 / 嵌入 / 重排序在操练场内做专门 UI（参见 `MEMORY.md` 中 [Debug Panel Decision]、[上游对齐优先] 两条偏好）。

## 2. 设计原则

- **零侵入现有 chat 流**：不动 `usePlaygroundState` / `ChatArea` / `useApiRequest` 的现有逻辑分支
- **数据源用后端真值**：模型是否属于 chat 类，以 `/api/pricing` 返回的 `supported_endpoint_types` 为准，不用模型名前缀启发式
- **黑名单优于白名单**：枚举已知的非 chat 端点（image-generation / openai-video / embeddings / jina-rerank），命中即拦
- **多处放行**：拉不到 pricing、模型未在 pricing 中、自定义请求体模式 —— 全部放行，避免误伤

## 3. 数据流

```
页面挂载
   │
   ├─ loadModels()  ──> /api/user/models  ──> 模型下拉列表
   │
   └─ loadModelEndpointTypes()  ──> /api/pricing
                                      │
                                      └─> Map<modelName, EndpointType[]>
                                           保存到 playground state
点击发送
   │
   └─ useApiRequest 入口
        │
        ├─ customRequestMode === true   → 放行
        ├─ map 为空 / 拉取失败           → 放行
        ├─ model 不在 map 中             → 放行
        ├─ endpoint_types 为空数组       → 放行
        ├─ 有任何已知非 chat 端点        → 弹框、return
        └─ 否则                          → 放行
```

## 4. 黑名单与拦截规则

### 4.1 已知非 chat 端点黑名单

来源于 `constant/endpoint_type.go`，定义在 `PLAYGROUND_UNSUPPORTED_ENDPOINTS`：

```
image-generation  → POST /v1/images/generations
openai-video      → POST /v1/videos
embeddings        → POST /v1/embeddings
jina-rerank       → POST /v1/rerank
```

### 4.2 拦截判断

```js
function isPlaygroundSupported(model, modelEndpointTypes) {
  const types = modelEndpointTypes.get(model);
  if (!types || types.length === 0) return true;                 // 兜底放行
  return !types.some(t => t in PLAYGROUND_UNSUPPORTED_ENDPOINTS); // 命中任意非 chat 端点 → 拦
}
```

### 4.3 为什么不用白名单

后端 `common/endpoint_type.go` 的 `GetEndpointTypesByChannelType` 会给纯 image-gen 模型（`dall-e-3` / `gpt-image-1` / `flux-*` / `imagen-*`）**自动追加 openai 兜底端点**——这是结构上的产物，不代表模型真能 chat。

如果用「至少有一个 chat 端点就放行」的白名单逻辑，`dall-e-3` 的 `supported_endpoint_types = ["image-generation", "openai"]` 会被错误放行到 `/pg/chat/completions`。

反过来用黑名单：**只要命中任何一个已知非 chat 端点就拦截**，dall-e-3 因为有 `image-generation` 端点直接被拦。

### 4.4 hybrid 模型处理

某个模型若 `supported_endpoint_types = ["openai", "image-generation"]`（无论是真·hybrid 还是后端兜底产物）一律拦截。在 playground 里用户无法明确表达"我要调哪个端点"，给他看 curl 示例更清晰。

多模态输入的 chat 模型（gpt-4o vision、claude-3.5-sonnet、Kimi-VL、Qwen-VL）走的是 `/v1/chat/completions`，端点类型就是 `openai`，**不命中黑名单**，正常放行。

## 5. 弹框设计

Semi `Modal` + 代码块 + 复制按钮：

```
┌─ 操练场暂不支持该模型 ────────────────────┐
│                                          │
│ 模型 MiniMax-Hailuo-02 仅支持视频生成     │
│ 端点（openai-video），请直接调用 API：    │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ curl -X POST <origin>/v1/videos \    │ │
│ │   -H 'Authorization: Bearer $YOUR_   │ │
│ │      API_KEY' \                      │ │
│ │   -H 'Content-Type: application/    │ │
│ │      json' \                         │ │
│ │   -d '{                              │ │
│ │     "model": "MiniMax-Hailuo-02",    │ │
│ │     "prompt": "<用户已填的>",         │ │
│ │     "duration": 6,                   │ │
│ │     "size": "1280x720"               │ │
│ │   }'                                 │ │
│ └──────────────────────────────────────┘ │
│                                          │
│              [复制]  [我知道了]           │
└──────────────────────────────────────────┘
```

### 5.1 Curl 模板表

| endpoint_type | path | body 模板 |
|---|---|---|
| `image-generation` | `/v1/images/generations` | `{model, prompt, size: "1024x1024", n: 1}` |
| `openai-video` | `/v1/videos` | `{model, prompt, duration: 6, size: "1280x720"}` |
| `embeddings` | `/v1/embeddings` | `{model, input: "<prompt>"}` |
| `jina-rerank` | `/v1/rerank` | `{model, query: "<prompt>", documents: ["doc1", "doc2"]}` |

### 5.2 模板细节

- **origin**：优先 `import.meta.env.VITE_REACT_APP_SERVER_URL`（dashboard 与 API 跨域部署），fallback 到 `window.location.origin`
- **API Key 占位符**：`$YOUR_API_KEY`（操练场登录态走 session cookie，没有 key 可暴露）
- **prompt 取值**：优先用用户当前输入框中最后一条用户消息的文本；为空则用占位符 `"你的提示词"`
- **shell 安全**：body 中的单引号 `'` 全部替换为 `'\''`（POSIX 通用转义），避免 prompt 含 `don't` 之类撇号时把外层 `-d '...'` 截断
- **多端点优先级**：一个 model 挂多个非 chat 端点时（罕见），优先级 `openai-video > image-generation > embeddings > jina-rerank`，用于决定弹框里选哪个模板展示

## 6. 改动清单

| 文件 | 改动 |
|---|---|
| `web/classic/src/constants/playground.constants.js` | 加 `PLAYGROUND_UNSUPPORTED_ENDPOINTS` 黑名单 + 模板表、`API_ENDPOINTS.PRICING = '/api/pricing'` |
| `web/classic/src/hooks/playground/usePlaygroundState.js` | state 增加 `modelEndpointTypes`（Map）与 `setModelEndpointTypes` |
| `web/classic/src/hooks/playground/useDataLoader.js` | 在 `loadModels` 旁新增 `loadModelEndpointTypes`，并行拉 `/api/pricing`，失败 silent（state 保持空 Map） |
| `web/classic/src/pages/Playground/index.jsx` | `onMessageSend` 入口拦截：命中黑名单则弹 Modal、return；customRequestMode 直接放行 |
| `web/classic/src/helpers/playground.js`（新增） | `isPlaygroundSupported` + `pickPrimaryUnsupportedEndpoint` + `buildCurlExample` + `getApiOrigin` |
| `web/classic/src/components/playground/UnsupportedModelModal.jsx`（新增） | Modal 内容组件：代码块 + 复制按钮（复用 `helpers/copy`） |

### 不动的地方

- `web/default/`：按 [feedback_frontend_classic_first] 偏好延后
- `usePlaygroundState` 现有 state 字段、`ChatArea`、`SettingsPanel`、`DebugPanel`：不修改
- 后端：不增不改任何接口
- 模型下拉：**不**过滤非 chat 模型，保留可见性，仅在提交时拦截

## 7. 验收

1. 选 `gpt-4o`，输入 hello，提交 → 正常 chat 响应（不受影响）
2. 选 `dall-e-3`，提交 → 弹框出现，curl 模板 path = `/v1/images/generations`，body 含 `size: "1024x1024"`
3. 选 `MiniMax-Hailuo-02`，提交 → 弹框，path = `/v1/videos`，body 含 `duration: 6`
4. 选 `text-embedding-3-small`，提交 → 弹框，path = `/v1/embeddings`，body 含 `input`
5. 选 `jina-reranker-v2`，提交 → 弹框，path = `/v1/rerank`
6. 弹框 [复制] 按钮点击 → 剪贴板内容可在终端直接 paste 执行（替换 `$YOUR_API_KEY` 后能跑通）
7. 切到自定义请求体模式，选 `dall-e-3` → 不弹框，直接发请求（escape hatch 生效）
8. 模拟 `/api/pricing` 503（断网或后端挂） → 选 `dall-e-3` 提交，**不**拦截直接发请求（fallback 放行）
9. 弹框文案里用户当前已填的 prompt 文本能正确填入 curl 的 `prompt` 字段
10. 弹框关闭后 playground 状态不变，可重新选模型继续操作

## 8. 不做的事

- 不做"图像 / 视频 / 嵌入 / 重排序"在操练场内的独立调试 UI（新增页签 / 新增路由），保持操练场只覆盖 chat 场景
- 不动 web/default
- 不修改 ModelTestModal（渠道测试弹框）中已有的端点类型选项
- 不在弹框中放"查看 API 文档"链接（暂无合适落点）
- 不在模型下拉中过滤非 chat 模型，保留可见性以避免用户疑惑"为什么我看不到我有权限的模型"

## 9. 风险与回滚

- **风险**：后端 `/api/pricing` 性能下降 → 当前模型量级 100 + 条，单次拉取无压力；如未来翻倍，可拆轻量"模型→端点类型"接口
- **风险**：后端新增非 chat 端点类型（如 audio、kling、jimeng）未及时加入黑名单 → 新端点的模型会被误放行到 chat。修复成本极低：黑名单 map 加一个 key + 模板
- **已知 trade-off：跨 group 同名异语义模型会被误拦**
  - 后端 `/api/pricing` 返回的 `supported_endpoint_types` 是按 model 名全局聚合的（`model/pricing.go:modelSupportEndpointsStr`），不区分 group
  - 若同一个 model 名在 group A 是 chat、在 group B 是 image-gen，聚合后的端点列表会包含 `["openai", "image-generation"]`
  - 黑名单逻辑会判定为非 chat 模型予以拦截，即使用户当前选的是 group A
  - **为什么接受这个 trade-off**：跨 group 同名异语义是 user-error 性质的配置，实际部署中极罕见；而 `dall-e-3` / `gpt-image-1` / `flux-*` 这种自带 OpenAI 兜底端点的 image-gen 模型每个部署都有，必须拦
  - **逃逸方式**：用户可以切到自定义请求体模式（`customRequestMode`）绕过拦截
- **回滚**：删除新增文件、回退 4 个文件的 diff 即可。无后端改动、无 DB 迁移、无破坏性变更
